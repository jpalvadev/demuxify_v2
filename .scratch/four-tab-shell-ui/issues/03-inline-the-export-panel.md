# 03: Inline the Export panel

**What to build:** There is no "Export Stems" action on the Mix Tab anymore. Whenever Stems exist, the Export panel is simply present, inline, in the Export Tab — no click-to-open, no modal state. It always reflects the latest mixer states, Master Volume, Time-Stretch tempo, Pitch-Shift, and Formant Preservation, re-emitted live on every change through the Transport bridge; tweaks made while the panel is on screen appear in it. The Cancel control inside the panel survives; the panel's standalone fallback (used only outside the app) stays alone.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] No Export Stems button anywhere in the Mix Tab
- [x] Export panel region present in the Export Tab as soon as Stems exist, without any action being clicked
- [x] Mixer-level, Master Volume, and tempo/pitch/formant changes made while the panel is present appear in it live
- [x] Cancel inside the panel still aborts an in-flight Export Bundle
- [x] Existing live-mirror app test keeps its assertions with the open-the-panel trigger replaced by "already present"
- [x] Old "opens the Export panel when the action is clicked" app test inverted to present-by-default

## Comments

- Panel lives in the Export Tab region (`aria-labelledby="export-dialog-title"`), mounted unconditionally once
  `separationPhase === "completed"` with stems + decoded mix: `isOpen` bare, no Close control at all in the
  hosted form (`onClose` optional in `ExportDialogProps`; header X and action-row "Close" render only when
  provided). Mix Tab renders no action: StemPlayer's `exportDialogHosted` discriminator gates both the old
  "Export Stems" button and the standalone fallback (fallback still alone, gated by `isExportDialogOpen`).
  Cancel ported from the existing `demuxify-tab-shell` Bold artifact ("Export & Download" + "Cancel encoding",
  idle toast "encoding cancelled · nothing written") — deliberate no-new-OpenDesign-run exception per ADR-0008
  Increment 3.
- Live mirroring: identity refs (`prevMixerStatesRef`/`prevMasterVolumeRef`/`prevAdjustmentsRef`) re-sync the
  open-transition controls/apply-adjustments on every bridge re-emission; handlers are engine-first (read
  engine, set engine, sync state, emit) — the fork defers state-updater callbacks, so updater-first handlers
  emitted one stale state. `TransportControls`/`onExportDialogState` bridge signature untouched; engine,
  encoders, IndexedDB schema untouched.
- Cancel flags `cancelExportRef` and every stem-loop / `renderOfflineStems` / `createStemBundleZip` / download
  boundary bails before any file is written; cancelled notice `role="status"` + status message + `toast.info`.
  Seam tests: hosted-form action-free + bridge re-emission spies at the StemPlayer seam; app seam asserts
  present-by-default, live mirror (already-present trigger), live adjustments, mid-bundle Cancel abort
  (no "Export complete" banner, notice present, Cancel disabled again). `npm run test` green: 294 passed / 37
  files.
