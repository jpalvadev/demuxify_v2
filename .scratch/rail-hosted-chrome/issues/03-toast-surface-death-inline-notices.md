# 03: Toast surface dies — notices render inline in their owning Tab

**What to build:** nothing floats over the Tab Shell anymore. Gated Tab taps become a silent no-op, and every export outcome announces itself **inline in the Export Tab** at the surface the user acted on. The notice mechanism behind the scenes stays usable; only its floating DOM surface and its rail placement die.

**Blocked by:** 01, 02 (the toast DOM surface is part of the merged sticky chrome block: its rail placement and mobile stacking must be settled before its death can be asserted cleanly).

**Status:** resolved

- [x] No toast notice container anywhere: not in the Tab Rail, not over the stage, not at the rail bottom on mobile.
- [x] Tapping a grayscaled Mix/Export Tab before Stems exist is a silent no-op — the chip's reason line is the whole answer, and no notice element is produced.
- [x] Export success (Export Bundle and Custom Mixdown paths) renders one inline mono micro line under the inline Export panel, with the peach status pip.
- [x] Cancelled encoding renders the same inline line in tan with no pip, saying nothing was written.
- [x] Encoding failure keeps the existing `role="alert"` destructive card — the inline result lines replace only the toast cards that duplicated the toast stack.
- [x] The `toast.*` call sites stay (manager seam intact) and typecheck passes with the now-unused DOM import gone.
- [x] Unit tests assert zero toast DOM at every breakpoint and the inline export-result copy — screenshots at desktop/tablet/mobile are limited to DOM-seam proof: the repo has no browser/screenshot tooling, and the responsive chrome assertion uses class tokens (grz-18 precedent).
- [x] Update the ticket 03 spec file with the Branch-Fact Snapshot, all checkboxes, and Comments.

## Ticket 03 · Branch-Fact Snapshot (rail-hosted-chrome)

**Where the toast DOM lives today:**

- `src/App.tsx` imports `ToastContainer` from `./components/Toast` and hosts `<ToastContainer />` INSIDE the rail `<nav>` block (rail `data-od-id="rail"` div) with the `data-od-id="toast-stack"` comment — the rail placement settled by ticket 02's merged mobile chrome block.
- `src/components/Toast.tsx` = the floating DOM surface: wrapper div with `data-testid` ids `toast-stack`/`toast`, `max-w-[50vw]`, `space-y-2`, per-notice `toast-${type}` testids, status/alert roles, dismiss buttons.
- `src/lib/toast.ts` = the manager (`toastManager`/`toast`) — untouched by this ticket: "the notice mechanism behind the scenes stays usable".
- `src/components/ExportDialog.tsx` calls `toast.info`/`toast.success`/`toast.error` at cancel/success×3/failure sites AND already hosts inline status cards (`successNotification`/`hasCancelledExport` status divs + `role="alert"` error card) that mirror the toast copy inside the panel.

**Gated Tab taps today:** `handleSelectTab` calls `toast.error(\`Tab blocked — ${TAB_GATING_REASON}\`)` then returns — a toast-producing refusal; the rail chips already carry the bare reason line.

**Test seams today:** `src/__tests__/Toast.test.tsx` exercises ToastContainer DOM + manager; `App.test.tsx` gates assert `/blocked.*no Stems yet/i` text and a `toast-stack` testid in the rail; ExportDialog success/cancel assertions already target the inline panel copy.

**Branch deltas vs the snapshot** (ADR-0007/0008 port): toast surface relocated from bottom-right fixed into the rail (ticket 01/02 chrome) — now dying; ExportDialog is app-level inline (ADR-0008) so its inline cards ARE the owning-Tab announcements the ticket asks for.

**Design decisions for this ticket:**

- `Toast.tsx` deleted outright (git rm) — `ToastContainer` import becomes an unsatisfiable one, so App.tsx must drop the import and the `<ToastContainer />` placement with it. Manager seam (`lib/toast.ts`) untouched.
- Gated refusal → silent no-op: delete the `toast.error` call only; the `return` stays.
- Inline export results: the existing ExportDialog status cards ARE the inline surface; retype them as mono micro lines (success: peach `bg-status-ok` pip span + kept `Export complete! Downloaded …` copy under `role="status"`; cancel: tan `text-grz-600` mono line, no pip). The `role="alert"` failure card stays verbatim (ADR-0008 precedent).
- Toast.test.tsx re-homed onto the manager seam (lifecycle via `toastManager.getToasts` + fake timers; ExportDialog emission reaches the manager but no DOM) — the only test file whose target surface dies, so its rewrite stays inside the two allowed seams.

**Branch:** rail-hosted-chrome

**Spec:** `.scratch/rail-hosted-chrome/spec.md` · run 77a26d2f · issue 03

---

## Comments

**2026-11-01 (agent):** resolved. `src/components/Toast.tsx` deleted via `git rm`; App.tsx dropped the `ToastContainer` import, the `<ToastContainer />` rail placement, the now-unused `toast` import, and the gated `toast.error(\`Tab blocked — …\`)`(silent no-op; chip reason line untouched). ExportDialog keeps all five`toast.*`emissions and retypes its inline cards: success = mono micro line with peach pip keeping`successNotification` copy; cancel = same line tan (`text-grz-600`, a confirmed tailwind-config palette token — no new tokens added, no pip, no card); failure `role="alert"`card verbatim. Tests:`Toast.test.tsx`rewritten onto the manager seam (2/2 green),`App.test.tsx`gated click retargeted to silent no-op (zero`/blocked/i`in the rail,`queryAllByText`for zero-match assertions per the grz-13`getAllByText`-throws gotcha), toast-stack rail test → notice-surface-death test; App+ExportDialog seam 57/57 green; typecheck clean. Screenshot box honestly limited to DOM-seam proof (no browser tooling; grz-18 class-token precedent).
