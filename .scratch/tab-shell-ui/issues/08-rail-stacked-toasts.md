# 08: Toast notices stacked at the rail bottom

**What to build:** Toast notifications stop floating over content: the Toast container re-parents to a slim stacked notice area at the bottom end of the rail (left column on desktop, below the top strip on mobile portrait). Notice content model — dismiss action, severity styling, timers — is unchanged, and stacking order keeps the most recent notice most prominent.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] Notices render in a rail-bottom stack in both rail orientations; no fixed bottom-right floating container anywhere.
- [ ] Toast dismissal and timing behavior unchanged and asserted at the existing Toast test seam, green.
