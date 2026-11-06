# 04: The Bridge Purge — Direct Shell Facts & Snapshot Feed

**What to build:** Eliminate the intermediate `ExportDialogState` bridge that connects `StemPlayer.tsx` to `App.tsx`. Make `ExportTab` consume mixer and time-stretch facts directly from the shell's active `StemPlayerSnapshot` and session state. Remove the redundant state variables, callbacks, and channel props from `App.tsx` and `StemPlayer.tsx`.

**Blocked by:** 03: ExportTab UI Conversion & Modal Affordance Purge.

**Status:** ready-for-agent

- [ ] `ExportDialogState` interface, `onExportDialogState` prop, and `emitExportDialogState()` method are removed from `src/components/StemPlayer.tsx`.
- [ ] `exportDialogState` state variable and `handleExportDialogStateChange` handler are removed from `src/App.tsx`.
- [ ] `App.tsx` renders `<ExportTab />` directly with facts derived from the active player snapshot, session, and tempo analysis.
- [ ] Switching between Tabs preserves user export preferences (format, bitrate, mode) without leaking state across unrelated views.
- [ ] All App-seam tests (`src/__tests__/App.test.tsx`) pass cleanly with the bridge state removed.
