# 02: Pure View Refactoring of SeparationProgress

**What to build:** A refactored progress view component (`SeparationProgress`) driven by a single atomic `SeparationUiState` discriminated union (`idle`, `active`, `error`) instead of five fragmented props. It displays animated download progress (MB loaded and total), neural network initialization indicators, active chunk progress with elapsed second timers and ETA readouts, and clear error presentation with a retry action, while maintaining exact stitch visual styling and ARIA accessibility roles.

**Blocked by:** 01: Separation Engine Core, Worker Message Adapter & Telemetry Seam

**Status:** ready-for-agent

- [ ] `SeparationProgressProps` replaces the loose prop set (`phase`, `downloadProgress`, `chunkProgress`, `chunkStart`, `error`) with a single atomic `state: SeparationUiState`, an optional `modelProfile`, `onCancel: () => void`, and optional `onRetry?: () => void`.
- [ ] In `idle` state, the component renders nothing (`null`).
- [ ] In `active` state with `stage: "downloading"`, it renders the download icon, loaded/total megabytes, and download progress bar.
- [ ] In `active` state with `stage: "initializing"`, it displays the neural network initialization message and loader animation.
- [ ] In `active` state with `stage: "separating"`, it displays the current and total chunk counts, active elapsed second counter, ETA readout, and pulse animation.
- [ ] In `error` state, it renders the alert icon, formatted error message, and Retry/Cancel action buttons.
- [ ] Retains the exact CSS classes, layout styling, and ARIA attributes (`role="region"`, `aria-label="Separation Progress"`) matching stitch skin fidelity.
- [ ] Component unit tests verify rendering and interaction across all three active stages, idle state, error presentation, and action callback triggers.
