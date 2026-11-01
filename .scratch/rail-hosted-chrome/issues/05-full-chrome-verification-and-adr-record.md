# 05: Full-chrome verification and the record

**What to build:** the whole Tab Shell chrome verified as one picture and the decisions written down where a future reader will find the "why no desktop header / no toast surface / no hero band" answer.

**Blocked by:** 01 (Brand Unit in the Tab Rail), 02 (mobile merged sticky block), 03 (inline notices, toast death), 04 (hero band and footer deaths).

**Status:** ready-for-agent

- [ ] True-CSS screenshots at 1440, 390 and 320 CSS px show the settled chrome: desktop opens on rail + stage with the Brand Unit at the rail head; mobile shows one sticky block of brand row over four chips, flat footer, no hero band, no floating notices.
- [ ] The whole vitest suite is green with the chrome seams retargeted as specified — no assertion left testing a page-level header, a toast surface, a hero band, or a gradient footer.
- [ ] `docs/adr/0009-rail-hosted-chrome-and-inline-notices.md` authored: states the decision, the considered alternatives (slim desktop header, sticky-vs-in-flow mobile strip, rail toast stack vs inline notices), why it is hard to reverse, and its Supersede section over ADR-0007's header/rail-toast/hero-band claims, citing ADR-0008's removals-and-re-home exception as the precedent for skipping an OpenDesign run.
- [ ] GLOSSARY.md already names **Tab Shell** as hosting the **Brand Unit** with "header"/"sidebar" retired as _Avoid_ terms; the ADR cross-references that entry.
- [ ] Engine logic, audio behavior, and export encoders verified untouched by the suite diff for the increment.
