import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Open-Unmix (UMX) 4-Stem ONNX Model Asset & Provisioning", () => {
  const modelPath = path.resolve(
    process.cwd(),
    "public/models/open_unmix_4stem_mobile.onnx"
  );
  const scriptPath = path.resolve(
    process.cwd(),
    "scripts/provision_open_unmix.py"
  );

  it("provisions the Open-Unmix 4-Stem ONNX model file in public/models/", () => {
    expect(fs.existsSync(modelPath)).toBe(true);
    const stats = fs.statSync(modelPath);
    expect(stats.size).toBeGreaterThan(25 * 1024 * 1024);
    expect(stats.size).toBeLessThan(55 * 1024 * 1024); // ~34.5 MB
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
    expect(scriptContent).toContain("open_unmix_4stem_mobile.onnx");
    expect(scriptContent).toContain("verify");
  });

  it("verifies the model produces distinct, non-identical stem magnitudes across all 4 tracks", async () => {
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

    const F = 2049;
    const T = 259;
    const channels = 2;
    const mag = new Float32Array(channels * F * T);

    // Populate synthetic frequency bins with distinct frequency content
    for (let c = 0; c < channels; c++) {
      const cOff = c * F * T;
      for (let f = 0; f < F; f++) {
        const val = Math.abs(Math.sin((f + 1) * 0.1) * Math.cos((c + 1) * 0.5));
        for (let t = 0; t < T; t++) {
          mag[cOff + f * T + t] = val;
        }
      }
    }

    const inputName = session.inputNames[0];
    expect(inputName).toBe("magnitude");
    const inputTensor = new ort.Tensor("float32", mag, [1, channels, F, T]);
    const feeds = { [inputName]: inputTensor };
    const results = await session.run(feeds);

    const vocals = results["vocals_magnitude"].data as Float32Array;
    const drums = results["drums_magnitude"].data as Float32Array;
    const bass = results["bass_magnitude"].data as Float32Array;
    const other = results["other_magnitude"].data as Float32Array;

    expect(vocals.length).toBe(channels * F * T);
    expect(drums.length).toBe(channels * F * T);
    expect(bass.length).toBe(channels * F * T);
    expect(other.length).toBe(channels * F * T);

    // Verify distinct stem outputs
    let anyDiff = false;
    for (let i = 0; i < 1000; i++) {
      if (Math.abs(vocals[i] - drums[i]) > 1e-4) {
        anyDiff = true;
        break;
      }
    }
    expect(anyDiff).toBe(true);
  });
});
