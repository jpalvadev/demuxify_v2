# OpenDesign MCP — recovery procedure

Reached from `AGENTS.md` ("OpenDesign MCP — when a call fails") and from the
"OpenDesign MCP for all view design" rule and `CODING_STANDARDS.md` rule 8:
every view/look normally comes from an OpenDesign MCP run, and this doc covers
what to do when the MCP itself stops answering.

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
