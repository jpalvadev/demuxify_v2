# 05: System Tab — status and Diagnostics inline

**What to build:** The System Tab hosts always-inspectable inline panels: WebGPU status badge (Active / Fallback / Detecting), Fallback Advisory when in CPU fallback, Model Cache status (which Model Profiles cached, approximate sizes), Session Recovery entry info if present, and Diagnostics with its Logs and Device views, level filters, and Clear / Copy Report actions. The floating pill trigger and the full-screen Diagnostics overlay are deleted; header status pills relocate here.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] WebGPU/Fallback/Model Cache states readable without opening anything.
- [x] Diagnostics Logs/Device panel with level filtering and copy-report works inline in System; no full-screen overlay and no floating pill anywhere.
- [x] The diagnostics test seam migrates from overlay to System panel and is green.

## Answer

Commit `d944242` — `feat(tab-shell-ui): ticket 05 — System Tab inline status panels; delete pill + diagnostics overlay` (full suite green: 37 files / 283 tests).

- `DiagnosticsOverlay.tsx` (floating pill + drawer + full-screen overlay) deleted and restructured as `src/components/DiagnosticsPanel.tsx`: an always-open inline `<section role="region" aria-label="System Diagnostics">` with Logs (count badge) / Device & Engine views, level filter buttons (all/error/warn/info), log entries with timestamp + payload/stack blocks, and Clear Logs / Copy Report actions. No `isOpen` state, no toggle button, no modal.
- New `src/components/ModelCacheStatus.tsx`: unique-by-cacheName Model Profile chips from `MODEL_PROFILES` ("BS-RoFormer 4-Stem · ~270 MB · Cached|Not cached"), each resolved async via `isModelCached(modelUrl, cacheName)`. Read-only surfacing; the cache lib is untouched.
- System Tab panel in `App.tsx` now stacks: `WebGPUStatusBadge` (Active/Fallback/Detecting text), `FallbackAdvisory` when `capability.isFallback`, `<ModelCacheStatus />`, Session Recovery info line (`Saved session: {title} ({duration}s)`) gated on `detectedSession && !decodedSourceMix`, then `<DiagnosticsPanel />`. Header.tsx carries no status pills (trimmed in ticket 03).
- Seam migration: `DiagnosticsOverlay.test.tsx` → `DiagnosticsPanel.test.tsx` (4 tests: region `/system diagnostics/i`, inline logs, Copy Report clipboard, Clear Logs) — git records it as a rename. New App seam asserts the System Tab contains "System Diagnostics" + at least one "Not cached" chip, and that no floating pill button (`/^diagnostics$/i`) or `role="dialog"` exists anywhere.

## Comments

- Design mandate satisfied without a new run: the ticket 01 Bold artifact (`demuxify-tab-shell`, run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7`) already designs the System Tab inline panels (status badge, Model Cache chips, Diagnostics panel) — preview: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html. Token/layout port itself happens in tickets 09/10.
- In the vitest browser there is no `globalThis.caches`, so `isModelCached` deterministically reports "Not cached" — the seam relies on that.
- Model Cache status is additionally surfaced in the Separate Tab's Inference Engine card (download progress); this System panel is the read-only inventory view the ticket asks for.
