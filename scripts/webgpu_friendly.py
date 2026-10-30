"""
Rewrite Split / Concat ops so each one fits in Chrome's per-shader-stage
storage-buffer limit (`maxStorageBuffersPerShaderStage = 8`).

ORT-Web's WebGPU EP allocates one storage buffer per input plus one per
output. BS-Roformer's BandSplit has a 62-way Split (63 buffers) and
each MaskEstimator has wide Concats (up to 63 buffers). Without this
rewrite the EP fails to compile those shaders and produces zero outputs
silently.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

MAX_CONCAT_INPUTS = 7
SPLIT_THRESHOLD = 7


def _next_const_name(prefix: str, existing: set[str]) -> str:
    i = 0
    while True:
        name = f"{prefix}_{i}"
        if name not in existing:
            existing.add(name)
            return name
        i += 1


def _make_constant_int64(value: Sequence[int], name: str) -> onnx.NodeProto:
    arr = np.asarray(value, dtype=np.int64)
    return helper.make_node(
        "Constant",
        inputs=[],
        outputs=[name],
        value=numpy_helper.from_array(arr, name=name),
    )


def _rewrite_split(
    node: onnx.NodeProto,
    split_sizes: list[int],
    init_names: set[str],
    node_names: set[str],
) -> list[onnx.NodeProto]:
    axis = next(
        (a.i for a in node.attribute if a.name == "axis"),
        0,
    )

    x_name = node.input[0]
    outputs = list(node.output)
    if len(outputs) != len(split_sizes):
        raise ValueError(
            f"Split {node.name}: {len(outputs)} outputs but {len(split_sizes)} split sizes"
        )

    new_nodes: list[onnx.NodeProto] = []
    start = 0
    axes_const_name = _next_const_name(f"{node.name or 'split'}_axes", init_names)
    new_nodes.append(_make_constant_int64([axis], axes_const_name))

    steps_const_name = _next_const_name(f"{node.name or 'split'}_steps", init_names)
    new_nodes.append(_make_constant_int64([1], steps_const_name))

    for i, sz in enumerate(split_sizes):
        starts = _next_const_name(f"{node.name or 'split'}_start{i}", init_names)
        ends = _next_const_name(f"{node.name or 'split'}_end{i}", init_names)
        new_nodes.append(_make_constant_int64([start], starts))
        new_nodes.append(_make_constant_int64([start + sz], ends))

        slice_name = _next_const_name(f"{node.name or 'split'}_slice{i}", node_names)
        new_nodes.append(
            helper.make_node(
                "Slice",
                inputs=[x_name, starts, ends, axes_const_name, steps_const_name],
                outputs=[outputs[i]],
                name=slice_name,
            )
        )
        start += sz
    return new_nodes


def _rewrite_concat(
    node: onnx.NodeProto,
    init_names: set[str],
    node_names: set[str],
) -> list[onnx.NodeProto]:
    axis = next((a.i for a in node.attribute if a.name == "axis"), 0)
    inputs = list(node.input)
    final_output = node.output[0]
    base_name = node.name or "concat"

    level = 0
    current = inputs
    new_nodes: list[onnx.NodeProto] = []
    while len(current) > MAX_CONCAT_INPUTS:
        next_level: list[str] = []
        for i in range(0, len(current), MAX_CONCAT_INPUTS):
            chunk = current[i : i + MAX_CONCAT_INPUTS]
            if len(chunk) == 1:
                next_level.append(chunk[0])
                continue
            out_name = _next_const_name(f"{base_name}_l{level}_c{i}", init_names)
            cname = _next_const_name(f"{base_name}_l{level}_c{i}_node", node_names)
            new_nodes.append(
                helper.make_node(
                    "Concat",
                    inputs=chunk,
                    outputs=[out_name],
                    axis=axis,
                    name=cname,
                )
            )
            next_level.append(out_name)
        current = next_level
        level += 1

    new_nodes.append(
        helper.make_node(
            "Concat",
            inputs=current,
            outputs=[final_output],
            axis=axis,
            name=node.name + "_final" if node.name else "concat_final",
        )
    )
    return new_nodes


def transform(model: onnx.ModelProto) -> tuple[onnx.ModelProto, dict[str, int]]:
    init_names: set[str] = {i.name for i in model.graph.initializer}
    init_names.update(i.name for i in model.graph.input)
    init_names.update(o for n in model.graph.node for o in n.output)
    node_names: set[str] = {n.name for n in model.graph.node if n.name}

    consts: dict[str, np.ndarray] = {}
    for n in model.graph.node:
        if n.op_type == "Constant" and n.output:
            for attr in n.attribute:
                if attr.name == "value":
                    consts[n.output[0]] = numpy_helper.to_array(attr.t)
                    break
    for init in model.graph.initializer:
        consts[init.name] = numpy_helper.to_array(init)

    new_nodes: list[onnx.NodeProto] = []
    stats = {"split_rewritten": 0, "concat_rewritten": 0, "untouched": 0}

    for node in model.graph.node:
        if node.op_type == "Split" and len(node.output) > SPLIT_THRESHOLD:
            split_sizes = None
            if len(node.input) > 1 and node.input[1] in consts:
                split_sizes = consts[node.input[1]].tolist()
            else:
                for attr in node.attribute:
                    if attr.name == "split":
                        split_sizes = list(attr.ints)
                        break
            if split_sizes is None:
                new_nodes.append(node)
                stats["untouched"] += 1
                continue
            new_nodes.extend(
                _rewrite_split(node, split_sizes, init_names, node_names)
            )
            stats["split_rewritten"] += 1
        elif node.op_type == "Concat" and len(node.input) > MAX_CONCAT_INPUTS:
            new_nodes.extend(_rewrite_concat(node, init_names, node_names))
            stats["concat_rewritten"] += 1
        else:
            new_nodes.append(node)

    referenced: set[str] = set()
    for n in new_nodes:
        for inp in n.input:
            if inp:
                referenced.add(inp)
    pruned_inits = [i for i in model.graph.initializer if i.name in referenced]
    init_dropped = len(model.graph.initializer) - len(pruned_inits)
    nodes_after_const_prune = [
        n for n in new_nodes
        if not (n.op_type == "Constant" and n.output and n.output[0] not in referenced)
    ]
    const_dropped = len(new_nodes) - len(nodes_after_const_prune)
    if init_dropped:
        stats["initializers_pruned"] = init_dropped
    if const_dropped:
        stats["dead_constants_pruned"] = const_dropped

    new_graph = helper.make_graph(
        nodes=nodes_after_const_prune,
        name=model.graph.name,
        inputs=list(model.graph.input),
        outputs=list(model.graph.output),
        initializer=pruned_inits,
        value_info=list(model.graph.value_info),
    )
    new_model = helper.make_model(
        new_graph,
        opset_imports=list(model.opset_import),
        producer_name=model.producer_name,
        producer_version=model.producer_version,
    )
    new_model.ir_version = model.ir_version
    for prop in model.metadata_props:
        np_prop = new_model.metadata_props.add()
        np_prop.key = prop.key
        np_prop.value = prop.value
    return new_model, stats


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--in-path", required=True)
    p.add_argument("--out-path", required=True)
    args = p.parse_args()

    print(f"Loading {args.in_path}")
    model = onnx.load(args.in_path)
    print(f"  nodes: {len(model.graph.node)}")

    transformed, stats = transform(model)
    print(f"Stats: {stats}")
    print(f"  new nodes: {len(transformed.graph.node)}")

    onnx.save(transformed, args.out_path)
    print(f"Wrote {args.out_path}")


if __name__ == "__main__":
    main()

