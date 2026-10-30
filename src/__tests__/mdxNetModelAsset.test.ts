import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("MDX-Net 4-Stem ONNX Model Asset & Provisioning", () => {
  const modelPath = path.resolve(
    process.cwd(),
    "public/models/mdx_net_4stem_mobile.onnx"
  );
  const scriptPath = path.resolve(
    process.cwd(),
    "scripts/provision_mdx_net.py"
  );

  it("provisions the MDX-Net 4-Stem ONNX model file in public/models/", () => {
    expect(fs.existsSync(modelPath)).toBe(true);
    const stats = fs.statSync(modelPath);
    expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // Greater than 10MB
    // Model is ~45 MB (+/- 15 MB)
    expect(stats.size).toBeLessThan(80 * 1024 * 1024);
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
    expect(scriptContent).toContain("mdx_net_4stem_mobile.onnx");
    expect(scriptContent).toContain("verify");
  });
});
