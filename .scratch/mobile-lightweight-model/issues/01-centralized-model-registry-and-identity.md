# 01: Centralized Model Registry & Unified Model Identity

**What to build:** A centralized model registry defines all neural network metadata (identifiers, display names, short names, device categories, user explanations, static URLs, cache storage keys, and memory requirements) in a single source of truth. All components, progress screens, error dialogues, and cache managers dynamically consume the active model's properties, eliminating all hardcoded model names across the user interface and codebase.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A centralized model configuration module defines the `ModelProfile` contract and exports configurations for both BS-RoFormer (Studio) and MDX-Net (Mobile/Fast).
- [ ] Device detection logic evaluates mobile user agents and touch indicators to determine the default model profile for the active environment.
- [ ] The model cache module adopts dynamic cache partition names per model profile rather than a single hardcoded cache key.
- [ ] Hardcoded model name strings in UI components, progress indicators, and hardware memory error messages are replaced with dynamic properties of the active model profile.
- [ ] Unit tests verify that device detection and model profile resolution return expected metadata for desktop and mobile environments without relying on hardcoded strings.
