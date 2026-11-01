# 02: Tab Shell — rail, registry, gating skeleton

**What to build:** The app opens into a persistent Tab Shell with exactly five Tabs (Separate, Listen, Mix, Export, System) driven by one tab registry; a vertical left rail at desktop widths and a horizontal top strip on mobile portrait. All five Tabs stay pinned even with no Source Mix; Listen, Mix, and Export render greyed-out with a one-line reason ("no Stems yet") until separated Stems exist. The active Tab defaults to Separate while idle/running and moves to Listen when Separation is Complete. Tab panels hold placeholder content for now (real tools land in ticket 03). Shell structure lands before the Bold skin; current neutral tokens are fine.

**Blocked by:** None (can start immediately).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] Five Tab containers always present in the DOM in the canonical order, accessible by name from the rail.
- [x] Desktop viewport renders a left vertical rail; mobile portrait viewport renders a top strip (no horizontal scroll, no hidden Tab).
- [x] Before separation completes, Listen/Mix/Export are greyed with a visible reason line; the mask is driven by the existing separation-phase state machine.
- [x] Active-Tab focus: Separate while idle/running, auto-switch to Listen on Complete, asserted at the App-level test seam.
- [x] App-level vitest tests updated and green; 44x44px touch targets on rail entries.

## Answer

Commit `299ca69` (`src/App.tsx`, `src/__tests__/App.test.tsx`):

- `TAB_REGISTRY` (`Separate/Listen/Mix/Export/System` + `gatedUntilStems` flag) and `TAB_GATING_REASON` ("no Stems yet") now drive both the rail and the five pinned Tab panels from one component.
- Rail: `<nav aria-label="Tab rail">` is a horizontal wrapping top strip by default (mobile portrait) and flips to a vertical left rail at `md:` (`md:flex-col md:no-wrap`, rail `md:w-56`). Every rail entry is a button with `min-h-[44px] min-w-[44px]`, `aria-label` = Tab title, and `aria-current="true"` on the active Tab.
- Gating mask derives from the existing state machine: `stemsReady = separationPhase === "completed" && separatedStems !== null`; gated Listen/Mix/Export get `opacity-50 text-muted-foreground` on the rail plus the one-line reason in both the rail entry and the greyed panel.
- `activeTab` defaults to `separate` while idle/downloading/separating and auto-switches to `listen` when Separation is Complete.
- All five panel regions (`aria-label` `<Title> Tab`) always render in canonical order; the existing tool flow moved verbatim into the Separate panel (placeholder state — real relocation lands in ticket 03).
- Tests: 19 existing App tests kept green untouched + 3 new (rail order & 44px targets, gating mask lift on completion, aria-current focus transition Separate→Listen). Full suite 279 green.

## Comments

- Design mandate satisfied: shell structure follows the ticket 01 OpenDesign run brief (five pinned Tabs, rail/strip responsive behavior, gating reason); the Bold skin (palette, type, radius) is ported in ticket 09 from that run's artifact — structure first per this ticket ("current neutral tokens are fine").
- Post-resolve fix (commit `bc567da`): the rail is now interactive as the artifact requires — rail Tab buttons carry `onClick` → `handleSelectTab`, `selectedTab` state drives `aria-current`, gated Tab clicks are blocked with a rail toast notice (`Tab blocked — no Stems yet`), and separation completion auto-activates Listen. Two new seams added (rail click moves the active Tab; gated click stays locked with the notice); suite 289 green.
- Post-resolve visual round (commits `013b990` + `70f0edc`): the user-reported "everything overflowing" was the port drifting from the artifact. Fixed to artifact-faithful shell chrome — `main` is full-bleed (no `mx-auto max-w-4xl`; the artifact `.app` has no max-width, rail is a `250px`/`280px` fixed column beside the fluid stage), the stage clips content with `overflow-hidden` (artifact `.stage{overflow:hidden}`), and the mobile rail strip uses explicit fixed tracks `grid-cols-[112px_112px_112px]` (five at `sm:`, `flex-col` at `md+`) because `minmax(0,1fr)` tracks and `%`-sized flex items overflowed despite wrapping. `overflow-hidden` on the nav is the safety net. New test locks the contract (rail class carries the 112px grid, stage parent carries `overflow-hidden`); suite 290 green. Verified by headless-Chrome screenshots at 1440×900 and 390×844 reviewed with vision.
