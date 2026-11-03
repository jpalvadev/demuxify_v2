# OpenDesign MCP — recovery procedure

Reached from the "OpenDesign MCP for all view design" rule in `AGENTS.md`
(which now carries the failure route inline) and the UI View Design rule
(`CODING_STANDARDS.md` §6): every view/look normally comes from an OpenDesign
MCP run, and this doc covers what to do when the MCP itself stops answering.
every view/look normally comes from an OpenDesign MCP run, and this doc covers
what to do when the MCP itself stops answering.

## Liveness (last observed)

Dead for the sessions of 2026-11-01 and 2026-11-02: every design call errored
("Tool execution failed") even though `opencode.jsonc` still has the
`"open-design"` block enabled, and the tickets in that window carry the
agent-authored fallback instead. This is not a stale-path problem — the
configured daemon path points at `versions/0.26.1`, the newest installed
version (only `0.21.1` and `0.26.1` exist on disk). So: probe with a light
`list_projects` call FIRST, and if it errors go straight to the fallback below
without trying a design call. Update this section when a session finds the MCP
alive again.

## Reconnect without restarting OpenCode

If OpenDesign MCP calls fail because the daemon connection was lost, restore it
without restarting OpenCode: in `C:\Users\Lorenzo06\.config\opencode\opencode.jsonc`,
comment out the whole `"open-design"` MCP-server block, save the file; then
uncomment it verbatim and save again. The connection is back when a light call
(e.g. `list_projects`) returns.

## When it dies for good

Attempt the reconnection above and allow OpenDesign exactly one more chance:
retry the pending call once after reconnecting. If it fails again or does not
respond, take charge of the design and of everything else for the rest of the
job: hand-design and port the remaining views into the React components
yourself, and record on the ticket that the look came from the agent instead of
an OpenDesign run. After that fallback fires, do not call the OpenDesign MCP
again for the rest of the session.
