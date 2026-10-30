# 13: Custom Mixdown Export Mode & Presets in ExportDialog

**What to build:** An interactive "Custom Mixdown" mode within the export modal, allowing users to quickly pick common presets (Karaoke/Instrumental, Acapella, Minus Drums, Reset), toggle individual stems on or off, adjust individual faders and master volume, toggle anti-clipping protection, and trigger WAV or MP3 download.

**Blocked by:** 12: Audio Mixdown DSP Engine & Anti-Clipping Normalization

**Status:** ready-for-agent

- [ ] Add selectable "Custom Mixdown" mode alongside "Single Stem" and "Full Export Bundle" in the export interface.
- [ ] Provide 1-click preset buttons: Karaoke / Instrumental (mute vocals), Acapella (solo vocals), Minus Drums (mute drums), and Reset (all 100%).
- [ ] Provide checkbox toggles and volume sliders (0% to 100%) for each stem.
- [ ] Provide a Master Mixdown Volume slider and an Anti-Clipping toggle (enabled by default).
- [ ] Disable the export action button when no stems are selected or when all active stem volumes are zero.
- [ ] Connect mixdown generation to WAV (16/24-bit) and MP3 (128-320 kbps) encoding with download triggering.
- [ ] Keep Single Stem and Full Export Bundle workflows intact without alterations.
- [ ] Verified with component interaction tests in the export modal test suite.
