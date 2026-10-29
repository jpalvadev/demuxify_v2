# 06: Session Persistence and Recovery via IndexedDB & OPFS

**What to build:** If the user reloads or navigates away from the browser tab, the application automatically saves and restores the active Session (Source Mix, separated Stems, playback position, and mixer levels) from IndexedDB and OPFS, preventing data loss on mobile or desktop reloads.

**Blocked by:** 04: Multi-Track Stem Player with Synchronized Playback, Solo & Mute Controls

**Status:** claimed

- [ ] Persistence store module managing IndexedDB metadata schema and OPFS audio buffer files.
- [ ] Auto-save mechanism persisting the active Session whenever separation finishes or mixer settings change.
- [ ] Session restoration prompt on app startup when a previous Session exists, allowing the user to resume or discard.
- [ ] Hydration of Source Mix and Stem buffers directly into the Stem Player with restored volume, mute, and solo states.
- [ ] Clean Session purge / reset functionality to safely release IndexedDB and OPFS storage.
- [ ] Automated tests verifying storage quota handling, serialization/deserialization of audio buffers, and recovery state machines.

