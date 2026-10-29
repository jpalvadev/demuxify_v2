# 07: Individual Stem Export (WAV / MP3) & Full Export Bundle ZIP Packaging

**What to build:** The user exports isolated audio tracks; the application offers single-Stem export and full 4-Stem Export Bundle download, encoding into uncompressed WAV or MP3 (with selectable bitrate 128 to 320 kbps) via a dedicated background worker and generating a clean ZIP archive with clear filenames without freezing the interface.

**Blocked by:** 04: Multi-Track Stem Player with Synchronized Playback, Solo & Mute Controls

**Status:** resolved

- [x] Export dialog in the Stem Player allowing selection of export format (WAV PCM 16/24-bit or MP3) and bitrate (128, 192, 256, 320 kbps).
- [x] Dedicated audio export worker encoding MP3 using LameJS off the main UI thread.
- [x] Direct single-click download for any individual Stem (e.g., `SongTitle_vocals.wav` or `SongTitle_drums.mp3`).
- [x] Export Bundle packaging creating a single ZIP file containing all 4 Stems with standardized naming conventions.
- [x] Progress toast notifications indicating encoding and packaging percentage with error recovery.
## Answer
Implemented individual and full bundle stem exports:
- `src/lib/wavEncoder.ts`: RIFF WAVE encoder for 16-bit and 24-bit PCM.
- `src/workers/mp3Encoder.worker.ts` & `src/lib/mp3Encoder.ts`: Off-thread MP3 encoding worker with selectable bitrates (128, 192, 256, 320 kbps).
- `src/lib/bundleZip.ts`: Export Bundle packaging combining all 4 stems into a ZIP file with standard naming conventions.
- `src/components/ExportDialog.tsx`: UI export dialog supporting single stems, full bundle, format selection, progress bar, toast feedback, and download triggering.
- Integrated into `StemPlayer.tsx` with comprehensive test suites (25 unit and component tests).

