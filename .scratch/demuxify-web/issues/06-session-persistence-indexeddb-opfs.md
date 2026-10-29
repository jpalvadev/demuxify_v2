# 06: Session Persistence and Recovery via IndexedDB & OPFS

**What to build:** If the user reloads or navigates away from the browser tab, the application automatically saves and restores the active Session (Source Mix, separated Stems, playback position, and mixer levels) from IndexedDB and OPFS, preventing data loss on mobile or desktop reloads.

**Blocked by:** 04: Multi-Track Stem Player with Synchronized Playback, Solo & Mute Controls

**Status:** resolved

- [x] Persistence store module managing IndexedDB metadata schema and OPFS audio buffer files.
- [x] Auto-save mechanism persisting the active Session whenever separation finishes or mixer settings change.
- [x] Session restoration prompt on app startup when a previous Session exists, allowing the user to resume or discard.
- [x] Hydration of Source Mix and Stem buffers directly into the Stem Player with restored volume, mute, and solo states.
- [x] Clean Session purge / reset functionality to safely release IndexedDB and OPFS storage.
- [x] Automated tests verifying storage quota handling, serialization/deserialization of audio buffers, and recovery state machines.

## Answer
Implemented session persistence and recovery:
- `src/lib/sessionStore.ts`: IndexedDB and OPFS persistence storing session metadata, multi-channel Float32Array PCM buffers (Source Mix and 4 Stems), and mixer states with schema validation and quota error management. Debounced auto-save orchestrator.
- `src/components/SessionRecovery.tsx`: Non-blocking prompt on startup allowing users to Resume previous session (hydrating audio buffers & mixer state into StemPlayer) or Discard session data.
- "Reset Session" purge action in StemPlayer transport bar.
- Tested thoroughly across 14 unit and component test cases.

