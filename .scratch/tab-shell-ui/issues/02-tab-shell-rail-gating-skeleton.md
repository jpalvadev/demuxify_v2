# 02: Tab Shell — rail, registry, gating skeleton

**What to build:** The app opens into a persistent Tab Shell with exactly five Tabs (Separate, Listen, Mix, Export, System) driven by one tab registry; a vertical left rail at desktop widths and a horizontal top strip on mobile portrait. All five Tabs stay pinned even with no Source Mix; Listen, Mix, and Export render greyed-out with a one-line reason ("no Stems yet") until separated Stems exist. The active Tab defaults to Separate while idle/running and moves to Listen when Separation is Complete. Tab panels hold placeholder content for now (real tools land in ticket 03). Shell structure lands before the Bold skin; current neutral tokens are fine.

**Blocked by:** None (can start immediately).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] Five Tab containers always present in the DOM in the canonical order, accessible by name from the rail.
- [ ] Desktop viewport renders a left vertical rail; mobile portrait viewport renders a top strip (no horizontal scroll, no hidden Tab).
- [ ] Before separation completes, Listen/Mix/Export are greyed with a visible reason line; the mask is driven by the existing separation-phase state machine.
- [ ] Active-Tab focus: Separate while idle/running, auto-switch to Listen on Complete, asserted at the App-level test seam.
- [ ] App-level vitest tests updated and green; 44x44px touch targets on rail entries.
