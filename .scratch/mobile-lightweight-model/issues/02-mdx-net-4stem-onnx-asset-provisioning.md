# 02: MDX-Net 4-Stem ONNX Model Asset & Provisioning Script

**What to build:** The user can reliably load a verified, lightweight (~45 MB) MDX-Net 4-Stem ONNX model asset designed for client-side execution in web browsers without memory exhaustion. The asset is permanently accessible in static storage with a reproducible acquisition and verification script.

**Blocked by:** None (can start immediately)

**Status:** complete

- [x] A verified 4-stem MDX-Net ONNX model asset (~45 MB) is placed in static assets storage under `public/models/mdx_net_4stem_mobile.onnx`.
- [x] A reproducible python script in `scripts/` verifies the model asset integrity, downloads or exports the model, and documents the upstream source repository and license.
- [x] Automated tests verify the model file exists, is non-empty, and possesses valid input/output tensor configurations matching the 4-stem separation contract.
