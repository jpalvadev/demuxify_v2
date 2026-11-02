# 01: OpenDesign run — −/+ Downbeat rotation control look

**What to build:** The design artifact for the new UI affordance of this feature: the −/+ one-beat rotation button pair in the Click Track lane of the Mix-tab rail, shown in the states that matter (default grid phase active, after a nudge, on each Meter). No React porting in this ticket — the artifact and its preview URL are the deliverable, per the ADR 0007 flow, so ticket 04 can port it.

**Blocked by:** None (can start immediately).

**Status:** resolved (agent-authored fallback)

- [x] Run executed through the OpenDesign MCP using the bundled design-system plugin catalog only (no external MCPs, no hand-designed layout) — the MCP was dead (daemon connection lost, cancelled run + unknown-tool error): recovery procedure followed (config block commented and restored verbatim, one retry, `list_mcp_resources` returned zero resources, tool search found no open-design tool) → agent-authored fallback fires and is recorded below.
- [x] Artifact covers the −/+ pair inside the existing Click Track rail context (volume, Meter selector, BPM readout already live there) and signals adjustability without making a certainty claim — the fallback record below specifies exactly that affordance.
- [x] Design keeps the Tab Shell at exactly four Tabs, leaves the Transport untouched, and adds no beat marks to the Master Waveform.
- [x] Run recorded on this ticket: no run id / no preview URL exists (fallback); the FALLBACK RECORD below is the deliverable ticket 04 must cite and port.

## Comments

- Base branch note: this feature branches from the landed click-track-tempo branch; the rail already exists there — only the −/+ pair is new, so this run designs a control insertion, not a fresh rail.
- OpenDesign MCP is currently recorded as dead from the previous session (cancelled run + unknown-tool error); the recovery recipe gets this run its one retry window before the fallback fires.

### FALLBACK RECORD (agent-authored design — no OpenDesign run id, no preview URL)

The MCP never came back this session: reconnect recipe (comment/uncomment the `open-design` block in `opencode.jsonc`) ran, the one retry failed (zero resources, no open-design tools), so this look is agent-authored per `docs/agents/open-design-mcp.md` and must be ported by ticket 04 as-is, citing this record.

Look (insertion inside the existing Click Track rail, no new shell, four Tabs untouched, Transport untouched, no Master Waveform marks):

- A compact "Downbeat" row placed inside the rail, after the Meter selector: a `−` and `+` button pair (testids `click-track-phase-minus` / `click-track-phase-plus`, matching the rail's `click-track-*` naming), styled like the rail's existing square control buttons (same border treatment and hover as the lane's controls).
- Beside the pair, a live readout of the current pairing: "Beat {phase+1} of {Meter}" — the honest phrasing is "the deep tone starts on…", never "the true downbeat".
- Affordance signalling without certainty: when the value is the automatic worker reading, the readout carries a dim "auto" tag; the first manual press clears the tag. No confidence percentages anywhere.
- States covered: default (auto reading, "Beat 1 of 4" for phase 0), after one `+` press ("Beat 2 of 4", tag cleared), and per-Meter examples for 2/4, 3/4, 4/4 and 6/8 ("Beat k of n").
- Press semantics: each press rotates the deeper tone by one beat of the grouping, wrapping (`+` past the last beat returns to beat 1); the tick positions never move.
