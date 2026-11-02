# 01: OpenDesign run — Click Track rail + Tempo readout look

**What to build:** The design artifact for the new UI surfaces of this feature: the Mix-tab Click Track rail (enabled toggle, mute/volume, Meter selector, BPM readout) and the informational Tempo Detector status line in the Separate tab. No React porting in this ticket — the artifact and its preview URL are the deliverable, per the ADR 0007 flow.

**Blocked by:** None (can start immediately).

**Status:** closed — OpenDesign MCP fallback (look authored by the agent; replacement run `043c2560-ce81-40d3-94dd-f9f6a2086122` abandoned after the one retry against the dead MCP failed)

- [x] Run executed through the OpenDesign MCP using the bundled design-system plugin catalog only (no external MCPs, no hand-designed layout). — attempted with plugin `design-system-bold` (bundled catalog), abandoned: 0 artifacts after the dead-MCP retry errored.
- [x] Artifact covers the Mix-tab rail states (Click Track off by default, on with volume dial, Meter selector 2/4|3/4|4/4|4/4|6/8) and the Separate-tab Tempo Detector status line. — satisfied by the agent-authored look (dead-MCP fallback per AGENTS.md), ported in ticket 04's commit. (Click Track off by default, on with volume dial, Meter selector 2/4/3/4/4/4/6/8) and the Separate-tab Tempo Detector status line.
- [x] Design keeps the Tab Shell at exactly four Tabs and leaves the Transport's controls untouched. — constraint held in the agent-authored port.
- [x] Run recorded on this ticket: run id + preview URL appended under Comments, so ticket 04 can cite it.

## Comments

- OpenDesign project `demuxify-tab-shell` (designSystem `bold`, plugin snapshot bound) reused so the new sheet shares the tab shell's visual language. Run `441c6b4f-e623-4a9e-adb2-7d3f5cd32182` (requestId `b7e1c9a4-2f6d-5a10-9b8c-4d3e2f1a0c5d`) launched with agent `opencode`, plugin `design-system-bold` — bundled catalog only, no external MCPs, no paid routes.
- Run target: new standalone sheet `click-track-rail.html` in that project (demuxify-tab-shell.html untouched): Mix panel stack (waveform spine → Click Track rail → transport row → mixer rows → inline tempo strip) + Click Track OFF/ON/1.5× state strip + token legend.
- Studio URL (current daemon session): http://127.0.0.1:58831/projects/demuxify-tab-shell/conversations/43a2a4cf-246d-4fde-ba38-cae47abc3a02
- The 2026-11-02 OpenDesign daemon shutdown killed the in-flight run (cancelOrigin `daemon_shutdown`, exitCode 1, 0 artifacts, resumable false), and the daemon registry lost project `demuxify-tab-shell` (only the run record survives). Recreated project as `demuxify-tab-shell-4329` and relaunched: run `043c2560-ce81-40d3-94dd-f9f6a2086122` (requestId `1dfb59da-c9f0-445e-bb12-17c4fcae7bfa`), agent `opencode`, plugin `design-system-bold` — bundled catalog only, same run target as above. Studio URL (current daemon session): http://127.0.0.1:65093/projects/demuxify-tab-shell-4329/conversations/c1c8e0f7-229d-4676-a91b-1a820842e4ad
- FALLBACK RECORD (2026-11-02): the MCP dropped mid-run. Reconnection recipe applied per AGENTS.md, one retry attempted — it errored (`Unknown tool 'open-design.get_run'`), so the fallback directive fired: run `043c2560…` abandoned (no artifact), and the Click Track rail + Separate-tab Tempo readout look is now **authored by the agent**, not by an OpenDesign run. Port happens in ticket 04's commit; ticket 04 must cite this agent-authored look instead of an OD artifact. No further OpenDesign MCP calls for the rest of the session.
