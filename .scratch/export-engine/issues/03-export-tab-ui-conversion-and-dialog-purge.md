# 03: ExportTab UI Conversion & Modal Affordance Purge

**What to build:** Refactor `ExportDialog.tsx` into `ExportTab.tsx` as a focused view component that drives `exportAudio` and delegates browser downloads to an isolated `triggerDownload` adapter. Delete all dead modal and dialog affordances (`isOpen`, `onClose`, `role="dialog"`, modal overlay backdrops), converting the container into a native Tab panel in alignment with ADR-0007 and GLOSSARY.md. Retarget the component test suite to focus strictly on user interactions and form controls.

**Blocked by:** 02: Custom Mixdown & Preset Resolution in the Export Engine.

**Status:** resolved

- [x] `src/components/ExportDialog.tsx` is renamed to `src/components/ExportTab.tsx` and exports `ExportTab`.
- [x] Modal-specific props (`isOpen`, `onClose`) and container wrappers (`role="dialog"`, overlay backdrops) are removed; container renders as a clean Tab panel.
- [x] Export execution delegates to `exportAudio` in `src/lib/exportEngine.ts`, and successful exports invoke `triggerDownload` via an isolated DOM helper.
- [x] Export cancellation uses an internal `AbortController` linked to the UI "Cancel" button, cleanly resetting state without throwing unhandled rejections.
- [x] Visual fidelity, Tailwind class tokens, and responsive layout at 1440×900 and 390×844 match `view_target/stitch.html` exactly.
- [x] `src/__tests__/ExportDialog.test.tsx` is retargeted to `src/__tests__/ExportTab.test.tsx`, testing mode selection, preset buttons, format dropdowns, and download invocation.
