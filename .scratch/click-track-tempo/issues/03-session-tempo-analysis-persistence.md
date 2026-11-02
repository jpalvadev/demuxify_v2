# 03: Tempo Analysis persisted in the Session

**What to build:** A recovered Session resumes with the same Tempo Detector result: the ranked candidates, the user-chosen tempo, and the Beat Grid survive the session store round-trip and Session Recovery, so the tempo readout is identical after reload/recovery.

**Blocked by:** 02 (Tempo Detector — automatic analysis at decode with Separate-tab readout).

**Status:** ready-for-agent

- [ ] Session metadata gains the Tempo Analysis state (candidates + confidence, chosen tempo, Beat Grid) without touching the four `StemName` identities or existing mixer-settings structures.
- [ ] Existing session-store test seam extended: save → reload round-trip returns identical candidates, chosen tempo, and Beat Grid.
- [ ] Session Recovery test pair extended: a recovered Session shows the same Separate-tab Tempo readout as the original.
- [ ] Auto-save debounce and quota behavior unchanged (no storage-quota regressions on longer Beat Grids).
- [ ] Older sessions written before this feature still load (state is optional on read).

## Comments
