# 08: Toast notices stacked at the rail bottom

**What to build:** Toast notifications stop floating over content: the Toast container re-parents to a slim stacked notice area at the bottom end of the rail (left column on desktop, below the top strip on mobile portrait). Notice content model — dismiss action, severity styling, timers — is unchanged, and stacking order keeps the most recent notice most prominent.

**Blocked by:** 03 (tool relocation).

**Design mandate:** MANDATORY — the views/looks involved in this ticket are always designed through the OpenDesign MCP, never hand-designed in code. Port only what an OpenDesign run produced (the ticket 01 project; bundled catalog plugins only, no external MCPs). If the existing artifact doesn't cover this ticket's view, run a new OpenDesign run in that project first, and record the run + preview URL under `## Comments` on this ticket.

**Status:** resolved

- [x] Notices render in a rail-bottom stack in both rail orientations; no fixed bottom-right floating container anywhere.
- [x] Toast dismissal and timing behavior unchanged and asserted at the existing Toast test seam, green.

## Answer

Commit `803490a` — `feat(tab-shell-ui): ticket 08 - toast notices stacked at the rail bottom` (full suite green: 37 files / 286 tests).

- `Toast.tsx` `ToastContainer` re-parented from `fixed bottom-4 right-4 z-50 …` to an in-flow stacked notice area (`flex flex-col gap-2.5 w-full max-w-md … mt-4`), matching the artifact's `.toasts{display:flex;flex-direction:column;gap:6px}` + `margin-top:auto` rail stack. Port root carries `data-testid="toast-stack"` (artifact `data-od-id="toast-stack"`).
- `App.tsx` moved the single `<ToastContainer />` from after `</main>` into the end of the rail `<nav aria-label="Tab rail">`, after the five rail buttons: desktop rail is `md:flex-col` so the stack sits at the bottom of the left column; mobile portrait rail wraps (`flex-wrap`, top strip) so the stack flows directly below the strip. There is no other toast container in the app.
- Notice content model untouched: per-`Toast` dismiss button (`aria-label="Dismiss Notification"` → `toastManager.dismiss`), severity styling (`TOAST_STYLES`/icons), and `lib/toast` timers/auto-dismiss all unchanged. Insertion order preserved → most recent at the bottom of the stack = nearest the rail end = most prominent.
- New App seam emits a toast via `lib/toast`, then asserts the `toast-stack` and its message live `within` the rail `<nav>` and that the container carries no `fixed` positioning class. `Toast.test.tsx` (lifecycle/dismiss/auto-dismiss/ExportDialog-visibility) untouched and green — it never depended on container positioning.

## Comments

- Design mandate satisfied without a new run: the ticket 01 Bold artifact already designs the notice stack — `data-od-id="toast-stack"` placed inside the rail (`.toasts{margin-top:auto}` under the vertical list, below the strip in the portrait media query), with severity dot colors (`ok`/`warn`/`err`) and ≤4 visible notices. Preview: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html
- The artifact's hard contract line "toasts stack at rail bottom / below strip" is now satisfied structurally; token/color porting for the notices happens in ticket 09 (Bold skin).
- Toast max-4 cap and fade-out timers stay in `lib/toast` (engine-side), untouched per spec.
