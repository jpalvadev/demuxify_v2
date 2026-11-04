# 08: Debug mode — every Tab visible at once

**What to build:** a committed debug mode: with the flag on, the app boots a synthetic session so the Mix and Export Tabs render their full compositions — the fidelity loop (and the user) can SEE and screenshot every Tab, no upload or WebGPU separation pass needed.

**Blocked by:** 07 (the record that flagged the Mix stage as not screenshot-visible).

**Status:** resolved — commit `eecb668` ("debug mode 08"), recorded as ADR-0015.

## Checklist

- [x] `src/lib/debugSession.ts`: deterministic fixture (fixed-seed) — decoded two-channel Source Mix (`DEBUG_SESSION_DURATION_SEC = 287.4` s at `DEBUG_SESSION_SAMPLE_RATE = 44100` Hz), 600-bin waveform, four Stem channels of 24000 samples, ranked Tempo reading at 107.7 BPM with Beat Grid, playhead at 93.2 s; `isDebugModeRequested()` reads the URL hash/search only when a `location` exists.
- [x] App.tsx: fixture flows into the ordinary state DEFAULTS (no setState-in-render hack — the earlier infinite-render and seed-hack failures are gone); the real UI code paths paint it.
- [x] Honesty contract: Tab Band coral mono marker "Debug · synthetic media" while on; auto-saver swapped for a silent stand-in while debug — the fixture never writes the IndexedDB Session slot; a real restored session still wins (resume pass overwrites defaults).
- [x] Unflagged behavior untouched: `isDebugModeRequested()` is false with no `location` (the whole vitest suite) and for ordinary URLs; the no-session boot and its gating stay exactly as shipped.
- [x] Screenshot channel now uses it: `scripts/shot-mix.mjs` (untracked scratch) boots `#debug`, clicks the MIX chip, captures desktop/mobile — the Mix composition is screenshot-VERIFIED (uniform stem-tinted waveforms, Debug marker, transport at section foot).

## Comments

- 2026-11-04: user's ask ("OMG, just implement a debug mode and if its on you can see all tabs") promoted the temporary uncommitted seed hack to a committed feature; the temp block was fully REMOVED from App.tsx in the same commit. Recorded as ADR-0015 (`docs/adr/0015-debug-mode-a-synthetic-session-that-unlocks-every-tab.md`), agent-authored per the dead-MCP fallback route (no OpenDesign calls this effort).
- Fixture numbers are ADR-0015 anchors (`NAME = <number>` spans verified by `check:doc-anchors` against the named consts).
- Debug mode is a preview/screenshot channel, not product chrome: no UI toggle exists; the URL fragment is the only switch. Cleanup commits must not erase the marker or the disarmed-saver ternary (ADR-0015 "Hard to Reverse").
