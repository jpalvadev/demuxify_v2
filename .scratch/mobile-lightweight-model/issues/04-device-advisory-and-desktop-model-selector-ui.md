# 04: Device-Aware User Advisory & Desktop Model Selector UI

**What to build:** The user sees a clear, prominent advisory on both the initial file intake screen and the separation progress modal explaining which model is running and why. Mobile devices are locked to the lightweight MDX-Net model to prevent crashes, while desktop users can use an accessible selector to choose between Studio (BS-RoFormer) and Fast (MDX-Net) before initiating separation.

**Blocked by:** 01: Centralized Model Registry & Unified Model Identity, 03: Polymorphic Inference Worker & 4-Stem Processing Adapter

**Status:** ready-for-agent

- [ ] An advisory badge or callout renders above the Source Mix dropzone displaying the active model name, icon, and device-tailored explanation.
- [ ] On desktop browsers, an interactive Model Selector control allows users to toggle between Studio and Fast models with clear trade-off descriptions.
- [ ] On mobile browsers and touch devices, the Model Selector is hidden or locked, displaying the mobile protection explanation.
- [ ] The Separation Progress modal dynamically reflects the active model's display name, download size, and status during caching and inference.
- [ ] UI component tests verify that simulated mobile viewports lock to MDX-Net, desktop viewports allow model toggling, and user explanations render accurately.
