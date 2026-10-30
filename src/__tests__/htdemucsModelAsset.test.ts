import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("HT-Demucs 4-Stem ONNX Model Asset & Provisioning", () => {
  const modelPath = path.resolve(
    process.cwd(),
    "public/models/htdemucs_4stem_mobile.onnx"
  );
  const scriptPath = path.resolve(
    process.cwd(),
    "scripts/provision_htdemucs.py"
  );

  it("provisions the HT-Demucs 4-Stem ONNX model file in public/models/", () => {
    expect(fs.existsSync(modelPath)).toBe(true);
    const stats = fs.statSync(modelPath);
    expect(stats.size).toBeGreaterThan(40 * 1024 * 1024);
    expect(stats.size).toBeLessThan(75 * 1024 * 1024); // ~53.7 MB
  });

  it("verifies the model file contains valid ONNX protobuf structure", () => {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(modelPath, "r");
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // Standard ONNX ModelProto starts with field 1 (ir_version, varint: 0x08)
    expect(buffer[0]).toBe(0x08);
  });

  it("provides a reproducible provisioning and verification script in scripts/", () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");
    expect(scriptContent).toContain("license");
    expect(scriptContent).toContain("MIT");
    expect(scriptContent).toContain("htdemucs_4stem_mobile.onnx");
    expect(scriptContent).toContain("verify");
  });

  it("verifies the model produces distinct, non-identical separated stems across all 4 tracks", async () => {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    const modelBuffer = fs.readFileSync(modelPath);
    const u8 = new Uint8Array(
      modelBuffer.buffer,
      modelBuffer.byteOffset,
      modelBuffer.byteLength
    );
    const session = await ort.InferenceSession.create(u8, {
      executionProviders: ["wasm"],
    });

    const chunkSamples = 264600;
    const sr = 44100;
    const left = new Float32Array(chunkSamples);
    const right = new Float32Array(chunkSamples);

    for (let i = 0; i < chunkSamples; i++) {
      const sec = i / sr;
      const bassTone = 0.3 * Math.sin(2 * Math.PI * 80 * sec);
      const vocalTone = 0.3 * Math.sin(2 * Math.PI * 1000 * sec);
      const drumTone = 0.2 * Math.sin(2 * Math.PI * 6000 * sec);
      left[i] = bassTone + vocalTone + drumTone;
      right[i] = bassTone + vocalTone * 0.9 + drumTone * 1.1;
    }

    const inputBuffer = new Float32Array(2 * chunkSamples);
    inputBuffer.set(left, 0);
    inputBuffer.set(right, chunkSamples);

    const inputName = session.inputNames[0];
    const inputTensor = new ort.Tensor("float32", inputBuffer, [
      1,
      2,
      chunkSamples,
    ]);
    const feeds = { [inputName]: inputTensor };
    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const outData = results[outputName].data as Float32Array;

    // HT-Demucs Stem layout: 0=drums, 1=bass, 2=other, 3=vocals
    const drumsLeft = outData.subarray(0, chunkSamples);
    const bassLeft = outData.subarray(2 * chunkSamples, 3 * chunkSamples);
    const otherLeft = outData.subarray(4 * chunkSamples, 5 * chunkSamples);
    const vocalsLeft = outData.subarray(6 * chunkSamples, 7 * chunkSamples);

    // Verify stems are not identical to each other
    let vocDrumsDiff = 0;
    let vocBassDiff = 0;
    let drumsBassDiff = 0;
    let otherBassDiff = 0;
    for (let i = 1000; i < 5000; i++) {
      vocDrumsDiff += Math.abs(vocalsLeft[i] - drumsLeft[i]);
      vocBassDiff += Math.abs(vocalsLeft[i] - bassLeft[i]);
      drumsBassDiff += Math.abs(drumsLeft[i] - bassLeft[i]);
      otherBassDiff += Math.abs(otherLeft[i] - bassLeft[i]);
    }

    expect(vocDrumsDiff).toBeGreaterThan(0.01);
    expect(vocBassDiff).toBeGreaterThan(0.01);
    expect(drumsBassDiff).toBeGreaterThan(0.01);
    expect(otherBassDiff).toBeGreaterThan(0.01);
  });
});
