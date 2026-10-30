"""
Rewrite negative `axis` attrs (e.g. axis=-1) to explicit non-negative ones.

ORT-Web's WebGPU EP miscomputes Concat/Split with negative axes on this
model — it ignores the `to=` direction and produces zero-sized buffers.
Resolving negatives at export time is a one-pass fix.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import onnx
import onnx.shape_inference


SINGLE_AXIS_OPS = {
    "Concat", "Gather", "Softmax", "LogSoftmax", "Hardmax", "Flatten",
    "ArgMax", "ArgMin",
    "ReduceMean", "ReduceSum", "ReduceMax", "ReduceMin", "ReduceProd",
    "ReduceL1", "ReduceL2", "ReduceLogSum", "ReduceLogSumExp", "ReduceSumSquare",
    "GatherElements", "Scatter", "ScatterElements", "Unique", "Cumsum", "Split",
}


def normalize(in_path: Path, out_path: Path) -> None:
    print(f"Loading {in_path}")
    model = onnx.load(str(in_path))
    model = onnx.shape_inference.infer_shapes(model)

    init_rank = {i.name: len(i.dims) for i in model.graph.initializer}
    value_rank = {
        v.name: len(v.type.tensor_type.shape.dim)
        for v in list(model.graph.value_info) + list(model.graph.input) + list(model.graph.output)
        if len(v.type.tensor_type.shape.dim) > 0
    }

    rewrites = 0
    for node in model.graph.node:
        if node.op_type not in SINGLE_AXIS_OPS:
            continue
        for attr in node.attribute:
            if attr.name != "axis" or attr.i >= 0:
                continue
            inp = node.input[0]
            rank = value_rank.get(inp) or init_rank.get(inp)
            if rank is None:
                continue
            new_axis = attr.i + rank
            if 0 <= new_axis < rank:
                attr.i = new_axis
                rewrites += 1
            break

    print(f"Rewrote {rewrites} negative axis attrs")
    onnx.save(model, str(out_path))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--in-path", required=True)
    p.add_argument("--out-path", required=True)
    args = p.parse_args()
    normalize(Path(args.in_path), Path(args.out_path))

