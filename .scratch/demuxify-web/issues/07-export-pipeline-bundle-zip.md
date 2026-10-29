# 07: Individual Stem Export (WAV / MP3) & Full Export Bundle ZIP Packaging

**What to build:** The user exports isolated audio tracks; the application offers single-Stem export and full 4-Stem Export Bundle download, encoding into uncompressed WAV or MP3 (with selectable bitrate 128 to 320 kbps) via a dedicated background worker and generating a clean ZIP archive with clear filenames without freezing the interface.

**Blocked by:** 04: Multi-Track Stem Player with Synchronized Playback, Solo & Mute Controls

**Status:** claimed

- [ ] Export dialog in the Stem Player allowing selection of export format (WAV PCM 16/24-bit or MP3) and bitrate (128, 192, 256, 320 kbps).
- [ ] Dedicated audio export worker encoding MP3 using LameJS off the main UI thread.
- [ ] Direct single-click download for any individual Stem (e.g., `SongTitle_vocals.wav` or `SongTitle_drums.mp3`).
- [ ] Export Bundle packaging creating a single ZIP file containing all 4 Stems with standardized naming conventions.
- [ ] Progress toast notifications indicating encoding and packaging percentage with error recovery.
- [ ] Automated tests asserting WAV header compliance, MP3 bitstream headers, and ZIP archive contents.

