# 01: Kill the Listen Tab

**What to build:** The Tab Shell shows exactly four Tabs — Separate, Mix, Export, System — with the Listen surface and its hosted Transport row gone. Mix and Export stay grayscaled with a reason line until Stems exist; selecting a gated Tab still falls back to Separate. When Separation completes and when a saved Session is resumed, the app lands on the Mix Tab, where the Stem Player and the Master Waveform spine already live.

**Blocked by:** None (can start immediately).

**Status:** needs-triage

- [x] Tab Shell renders four Tab regions; no Listen region or Listen button exists anywhere
- [x] Mix and Export Tabs grayscaled with reason line until Stems exist; unlocked once Stems exist
- [x] Completing Separation selects the Mix Tab
- [x] Resuming a saved Session selects the Mix Tab
- [x] Gated-Tab selection still falls back to Separate
- [x] App-level tests updated: four regions asserted, no Listen, separation/resume land on Mix

Addendum (same increment, grz band re-home): the Grizzly header band now runs in the
System Tab as chrome with its two named faces — see `.scratch/grizzlython-skin/03-grz-header-band.md`
grz-11/13/15/18 addendum.
