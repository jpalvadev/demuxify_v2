# 14: Stem Player Mixer Synchronization & End-to-End Integration

**What to build:** Synchronize the active fader positions, mute states, and solo states from the stem player directly into the Custom Mixdown export view so that the export dialog automatically reflects what the user is currently hearing.

**Blocked by:** 13: Custom Mixdown Export Mode & Presets in ExportDialog

**Status:** ready-for-agent

- [ ] Pass current stem player mixer levels (individual stem volumes, mutes, solos) and master volume into the export modal upon opening.
- [ ] Pre-populate Custom Mixdown controls with these initial listening settings while still permitting on-the-fly adjustment inside the dialog.
- [ ] Ensure full roundtrip workflow from transport controls and fader adjustments to export modal download.
- [ ] Verify that existing single stem, ZIP bundle, and stem player tests continue to pass with zero regressions.
