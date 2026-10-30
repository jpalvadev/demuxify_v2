# Spec: Lightweight Mobile Model (MDX-Net) & Centralized Model Profiles

Status: ready-for-agent

## Problem Statement

Users accessing Demuxify Web on smartphones and tablets frequently experience browser crashes, tab reloads, and Out-Of-Memory (OOM) failures due to the memory intensity of the default 270 MB BS-RoFormer neural network weights and WebGPU driver incompatibilities on mobile chipsets. Concurrently, desktop users with modest hardware lack an option to prioritize fast processing over maximum acoustic precision. Throughout the codebase and UI, model names, cache storage keys, and hardware error messages are tightly coupled and hardcoded as "BS-RoFormer", preventing modular multi-model support and confusing users about which model is operating and why.

## Solution

Demuxify Web introduces a hardware-adapted Model Profile system with a centralized identity registry. Mobile devices (smartphones and tablets) are automatically assigned a lightweight, tested 4-stem model (MDX-Net 4-Stem, ~45 MB) to eliminate WASM heap exhaustion and guarantee smooth, crash-free execution. Desktop users default to the high-fidelity BS-RoFormer 4-Stem model (~270 MB) with dedicated WebGPU acceleration, while gaining a visual selector in the interface to opt into the fast MDX-Net model when desired.

A prominent, accessible advisory badge in both the file intake area and the separation progress modal informs the user in plain language which model is active and why. All model metadata, display labels, explanations, download estimates, and cache partitions are managed through a single source of truth, eliminating magic strings across the codebase. The background inference worker transparently inspects model tensor requirements to run the appropriate audio pre/post-processing while guaranteeing the canonical 4-Stem output (Vocals, Drums, Bass, Other).

## User Stories

1. As a mobile phone user, I want the web application to automatically select a lightweight 4-stem model (MDX-Net), so that my browser does not crash from out-of-memory errors during audio separation.
2. As a mobile phone user, I want to see an informative banner explaining that the mobile-optimized model is active to preserve memory and speed up processing, so that I understand why this model was chosen.
3. As a mobile user, I want the lightweight model to separate audio into four discrete Stems (Vocals, Drums, Bass, Other), so that I can use the full multi-track Stem Player, solo/mute controls, and custom mixdown features on my phone.
4. As a tablet user with touch input, I want the system to detect my device and apply the lightweight model profile by default, so that audio processing remains responsive on mobile hardware.
5. As a desktop user with a dedicated GPU, I want the application to default to the Studio model (BS-RoFormer), so that I get maximum acoustic isolation and fidelity.
6. As a desktop user on an older laptop or without WebGPU, I want a model selector to switch to the Fast model (MDX-Net), so that I can separate tracks without freezing my computer or waiting extended periods.
7. As a desktop user, I want to see a clear description of the trade-offs between Studio (BS-RoFormer: highest fidelity, larger download) and Fast (MDX-Net: rapid processing, smaller footprint) in the model selector, so that I can make an informed choice.
8. As a user on any device, I want the active model's name and download size to be clearly reflected in the download progress modal, so that I know exactly how many megabytes are being downloaded.
9. As a user, I want neural network weights for different models to be stored in isolated browser cache partitions, so that caching one model does not corrupt or prematurely evict the other.
10. As a user experiencing a hardware or memory error, I want the diagnostic message to display the active model's specific name and memory requirements dynamically, so that error advice is accurate and relevant to my session.
11. As a developer, I want all model names, labels, and parameters to be sourced from a single centralized configuration module, so that updating or adding models does not require searching and modifying scattered strings.
12. As a user returning to a previous session, I want the session state to preserve the identifier of the model used to separate the stems, so that playback and export metadata accurately reflect the source model.

## Implementation Decisions

- **Centralized Model Registry**: Introduce a dedicated configuration module serving as the single source of truth for all model metadata. The registry defines model identifiers, human-readable display names, short names, device categories, user-facing explanations, static model URLs, cache storage names, estimated file sizes, and chunk duration parameters.
- **Device-Based Fixed Policy for Mobile**: Device detection evaluates mobile indicators (user agent and touch capabilities). When mobile is detected, the active model is locked to MDX-Net 4-Stem, preventing mobile users from triggering memory-fatal BS-RoFormer downloads.
- **Desktop Model Selector**: On desktop viewports, the interface defaults to BS-RoFormer but renders a clean, accessible selector control allowing the user to toggle to MDX-Net before initiating separation.
- **User Advisory Placement**: Render an informative badge/callout on the initial Source Mix dropzone and inside the Separation Progress modal dynamically rendering the active model's name and explanation.
- **Polymorphic Worker Adapter**: The background inference worker inspects the loaded model's tensor requirements (spectrogram inputs vs raw waveform inputs) and routes chunked audio through the matching pre/post-processing pipeline while always outputting the canonical 4-Stem dictionary (Vocals, Drums, Bass, Other).
- **Independent Cache Partitions**: Separate Cache Storage keys are configured per model profile (e.g. `demuxify-cache-roformer-v1` and `demuxify-cache-mdxnet-v1`), ensuring clean isolation and predictable offline caching.
- **Model Asset Provisioning**: Provide the verified ONNX model file for MDX-Net 4-Stem in the public static assets directory along with a reproducible acquisition/verification script in the project scripts directory.

## Testing Decisions

- **Good Test Philosophy**: Tests must exercise external observable behavior rather than internal private variables. They should verify that device detection yields the appropriate profile, that UI components render the correct dynamic text and explanation without hardcoded fallback strings, that cache partitioning uses model-specific stores, and that the inference client orchestrates 4-stem separation successfully.
- **Tested Modules**:
  - Centralized model configuration and device detection logic.
  - Model cache partitioning and retrieval using dynamic profile keys.
  - Separation progress modal and file intake UI verifying dynamic model identity display.
  - Inference worker initialization and chunk processing adapter with 4-stem verification.
- **Prior Art**:
  - `src/__tests__/modelCache.test.ts` for cache lifecycle and eviction testing.
  - `src/__tests__/SeparationProgress.test.tsx` for progress rendering and error state verification.
  - `src/__tests__/inferenceWorker.test.ts` for worker message protocol and stem ordering validation.

## Out of Scope

- Arbitrary user-uploaded custom ONNX models (BYOM / Bring-Your-Own-Model).
- 2-stem models (Vocals/Instrumental only); the pipeline strictly adheres to 4 discrete Stems.
- Cloud-based server fallbacks or remote API execution; 100% client-side offline execution is preserved.
- Dynamic runtime model swapping mid-separation; model selection is fixed per separation job.

## Further Notes

- The MDX-Net 4-Stem architecture drastically reduces WASM memory pressure compared to BS-RoFormer because it avoids the large quadratic self-attention matrices of transformer architectures, making it resilient on constrained mobile browsers.
- Adherence to the project GLOSSARY is mandatory: the terms **Inference Engine**, **Model Profile**, **Stem**, and **Source Mix** must be used consistently across all code, tests, and documentation.
