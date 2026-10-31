# 05: System Tab — status and Diagnostics inline

**What to build:** The System Tab hosts always-inspectable inline panels: WebGPU status badge (Active / Fallback / Detecting), Fallback Advisory when in CPU fallback, Model Cache status (which Model Profiles cached, approximate sizes), Session Recovery entry info if present, and Diagnostics with its Logs and Device views, level filters, and Clear / Copy Report actions. The floating pill trigger and the full-screen Diagnostics overlay are deleted; header status pills relocate here.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** ready-for-agent

- [ ] WebGPU/Fallback/Model Cache states readable without opening anything.
- [ ] Diagnostics Logs/Device panel with level filtering and copy-report works inline in System; no full-screen overlay and no floating pill anywhere.
- [ ] The diagnostics test seam migrates from overlay to System panel and is green.
