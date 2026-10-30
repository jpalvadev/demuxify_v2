# 03: Polymorphic Inference Worker & 4-Stem Processing Adapter

**What to build:** The background inference worker transparently executes either BS-RoFormer or MDX-Net according to the active model profile. It dynamically adapts chunk slicing and tensor I/O formats to match the loaded neural network, always returning the canonical dictionary of four isolated stems (Vocals, Drums, Bass, Other) across sequential chunks.

**Blocked by:** 01: Centralized Model Registry & Unified Model Identity, 02: MDX-Net 4-Stem ONNX Model Asset & Provisioning Script

**Status:** ready-for-agent

- [ ] The inference worker initializes sessions dynamically using the model URL and cache partition designated by the active model profile.
- [ ] A polymorphic tensor adapter prepares input buffers matching the model architecture (spectrogram inputs for BS-RoFormer, magnitude/waveform inputs for MDX-Net).
- [ ] Sequential chunk inference processes the Source Mix and outputs the canonical four discrete Stems (`vocals`, `drums`, `bass`, `other`) without audio dropouts or phase misalignments.
- [ ] Unit and worker tests verify that switching between model profiles successfully executes chunked separation and emits the four expected stems.
