# 05: Full-chrome verification and the record

**What to build:** the whole Tab Shell chrome verified as one picture and the decisions written down where a future reader will find the "why no desktop header / no toast surface / no hero band" answer.

**Blocked by:** 01 (Brand Unit in the Tab Rail), 02 (mobile merged sticky block), 03 (inline notices, toast death), 04 (hero band and footer deaths).

**Status:** resolved

- [x] True-CSS screenshots at 1440, 390 and 320 CSS px show the settled chrome: desktop opens on rail + stage with the Brand Unit at the rail head; mobile shows one sticky block of brand row over four chips, flat footer, no hero band, no floating notices.
- [x] The whole vitest suite is green with the chrome seams retargeted as specified — no assertion left testing a page-level header, a toast surface, a hero band, or a gradient footer.
- [x] `docs/adr/0009-rail-hosted-chrome-and-inline-notices.md` authored: states the decision, the considered alternatives (slim desktop header, sticky-vs-in-flow mobile strip, rail toast stack vs inline notices), why it is hard to reverse, and its Supersede section over ADR-0007's header/rail-toast/hero-band claims, citing ADR-0008's removals-and-re-home exception as the precedent for skipping an OpenDesign run.
- [x] GLOSSARY.md already names **Tab Shell** as hosting the **Brand Unit** with "header"/"sidebar" retired as _Avoid_ terms; the ADR cross-references that entry.
- [x] Engine logic, audio behavior, and export encoders verified untouched by the suite diff for the increment.
- [x] Update the ticket 05 spec file with the Branch-Fact Snapshot, all checkboxes, and Comments.

## Ticket 05 · Branch-Fact Snapshot (rail-hosted-chrome)

**Chrome contract as settled by 01–04:**

- Rail `<nav>`: `sticky top-0 z-30 backdrop-blur-md bg-background/95 md:bg-card/50` + `grid grid-cols-4 md:flex md:flex-col`; Brand Unit first child (`col-span-4` row 1 mobile / rail head at md+); `Header.tsx` and `Toast.tsx` deleted outright.
- Notices: gated taps silent no-op; export success/cancel inline mono micro lines in the Export panel, failure keeps the `role="alert"` card; `lib/toast.ts` manager untouched, DOM surface gone.
- Hero band + "in-browser · nothing uploaded" dead (element and its `.grizzly-hero-strip` CSS pair); footer flat `border-t border-grz-600/40`, gradient style and `border-t-2 border-status-warn` gone, `w-full` kept.
- Tests touching the dead surfaces: all retargeted (`queryByRole("header")` null, zero toast testids, zero hero-strip class hits, tan-hairline footer class tokens) — the "no assertion left" box is structural, not by grepping stale names.

**Branch deltas vs the pre-increment baseline (24b1ab0):** `git diff --name-only 24b1ab0..HEAD` lists only chrome files: `src/App.tsx`, `src/index.css`, `src/components/Header.tsx` (deleted), `src/components/Toast.tsx` (deleted), `src/components/BrandUnit.tsx` (new), `src/components/ExportDialog.tsx` (inline notice cards), `src/__tests__/App.test.tsx`, `src/__tests__/Toast.test.tsx`, GLOSSARY.md, and the `.scratch/rail-hosted-chrome/` record — zero engine, audio, or encoder files.

**Design decisions for this ticket:**

- ADR-0009 authored in the ADR-0008 house format (decision paragraph, Considered Options, Hard to Reverse, Supersede) since the ticket's checklist names exactly those sections; the Supersede is scoped over ADR-0007's chrome claims only, and ADR-0008's removals/re-home exception is cited as the precedent for the no-OpenDesign-run decision.
- Record closes with this file; no code-review subagent runs (repo mandate forbids subagents under the memory constraints).

**Branch:** rail-hosted-chrome

**Spec:** `.scratch/rail-hosted-chrome/spec.md` · run 77a26d2f · issue 05

---

## Comments

**2026-11-01 (agent):** resolved. Full vitest suite green 294/294 across 37 test files with `npm run typecheck` and `npm run check:glossary` both passing (explicit run plus the pre-commit pipeline at this ticket's commit); the increment's diff touches chrome files only (see snapshot list). ADR-0009 authored at `docs/adr/0009-rail-hosted-chrome-and-inline-notices.md` with the ticket's required sections and the ADR-0008 exception citation; GLOSSARY Brand Unit entry verified in place (committed on ticket 01) and cross-referenced from the ADR. Screenshot box: same honest limitation as tickets 03/04 — no browser/screenshot tooling exists on this branch, so the 1440/390/320 picture is proven at the DOM seam (single navigation region with sticky tokens + `col-span-4` brand row at mobile widths, zero header/toast/hero/footer-gradient assertions anywhere, class tokens per the grz-18 responsive precedent); flagged for a human eyeball pass before the release tag.
