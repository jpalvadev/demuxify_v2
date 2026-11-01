# 04: Discard-as-full-purge + Mix trash death

**What to build:** The Stem Player's action row loses its trash/Purge Session button — nothing destructive sits in the playback surface. The Session Recovery panel on the Separate Tab keeps its Discard button and trash icon, and pressing Discard now deletes everything: it cancels the auto-saver, drops the cached and saved Session from browser storage, and clears the in-memory Source Mix, Stems, mixer levels, and playhead, leaving a clean app on the Separate Tab. The System Tab's Clear Logs button and icon are untouched.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] No Purge/Reset Session/trash button in the Mix Tab Stem Player row
- [x] Session Recovery Discard (Separate Tab) rewired to the full-purge routine — no duplicated wipe logic
- [x] After Discard: saved Session cleared from fake-IndexedDB storage and in-memory Source Mix/Stems/mixer cleared
- [x] Re-render after Discard shows the clean Separate Tab with Mix/Export grayscaled
- [x] Resume flow unaffected: Resume button still restores Session and lands per ticket 01
- [x] System Tab Clear Logs button unchanged

## Comments

- Stem Player action row: trash button deleted outright; `onPurgeSession` prop dropped from
  `StemPlayerProps` (no dead affordance left in the interface), `Trash2` import pruned. Row is
  now toggle-only (hosted form); the standalone Export Stems action stays gated by
  `!exportDialogHosted` per ticket 03.
- App level: `handleDiscardSession` wraps the existing `handlePurgeSession` routine
  (auto-saver cancel, cached Session drop, awaited `clearActiveSession` from storage, then
  `handleClearSourceMix` for in-memory Source Mix/Stems/mixer/playhead) plus `setDetectedSession(null)`
  so the recovery prompt can't re-render after the wipe; no duplicated wipe logic. The old
  Mix-Tab call site is gone, so `handlePurgeSession` has exactly one consumer: Discard.
- Seam tests: app seam rewrote the old "purge from Stem Player" test to assert no
  Purge/Reset Session button in the Mix region or anywhere once Stems exist; the Discard test now
  pins storage clear + clean Separate-Tab re-render with Mix/Export rail chips grayscaled
  (`opacity-50` + reason line); System Tab test pins Clear Logs still present. Stem Player seam
  render test asserts no trash affordance. Resume, Clear Logs, and all engine paths untouched.
- `npm run test`: 294 passed / 37 files; `npm run typecheck` and `npm run check:glossary` clean.
