# 04: Discard-as-full-purge + Mix trash death

**What to build:** The Stem Player's action row loses its trash/Purge Session button — nothing destructive sits in the playback surface. The Session Recovery panel on the Separate Tab keeps its Discard button and trash icon, and pressing Discard now deletes everything: it cancels the auto-saver, drops the cached and saved Session from browser storage, and clears the in-memory Source Mix, Stems, mixer levels, and playhead, leaving a clean app on the Separate Tab. The System Tab's Clear Logs button and icon are untouched.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] No Purge/Reset Session/trash button in the Mix Tab Stem Player row
- [ ] Session Recovery Discard (Separate Tab) rewired to the full-purge routine — no duplicated wipe logic
- [ ] After Discard: saved Session cleared from fake-IndexedDB storage and in-memory Source Mix/Stems/mixer cleared
- [ ] Re-render after Discard shows the clean Separate Tab with Mix/Export grayscaled
- [ ] Resume flow unaffected: Resume button still restores Session and lands per ticket 01
- [ ] System Tab Clear Logs button unchanged
