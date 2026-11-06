# 05: Verification sweep + ADR-0013 amendment record

**What to build:** The increment is proven byte-for-byte behavior-preserving and recorded: every parity-guard suite is green untouched, the full pre-commit chain is green, the stitch-skin screenshot loop shows zero class-token diff at desktop and mobile, and the append-only ADR-0013 amendment — "the shell reads one Transport snapshot; mirror states banned" — is authored so nobody reintroduces the mirrors. The spec's status is updated to record the landing.

**Blocked by:** 01, 02, 03, 04.

**Status:** resolved

- [x] Parity guards green untouched: Stem Player component seam (bridge-channel tests — its interface is unchanged), the 42 engine seam tests, Master Waveform seam tests (repaint ceiling), sessionStore mixer-bridge/save-cadence tests, the Space keyboard test
- [x] Full pre-commit chain green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`
- [x] stitch-skin loop: screenshots of the running app at desktop 1440×900 and mobile 390×844 show zero class-token diff against the view targets; the class-token pins needed no retarget (value sources changed, markup did not)
- [x] ADR-0013 amendment authored (append-only house format): the shell reads one Transport snapshot; App mirror states and the mid-render mutable ref are banned
- [x] Spec status updated to record the increment resolved (tickets 01–05)
- [x] Final commit gated green

## Comments

- 2026-11-06 (agent): Parity guards verified green untouched — StemPlayer.test.tsx + stemPlayerEngine.test.ts (the 42 engine seam tests) + MasterWaveform.test.tsx + sessionStore.test.ts = 87/87, zero retargets; the Space keyboard test rides green in the full suite (382/382 at ticket 04). ADR-0013 amendment appended at the file foot in house format (dense prose, `## Amendment (2026-11-06, transport-snapshot — …)`): snapshot fields + four verbs, live/scripted adapters, cadence rules moved into the module, seed/reset/idle rules, formatter single rule, live-mirror test survives verbatim, mirror states + mid-render ref BANNED. The amendment's deleted-state citations ride the gate's historical-skip convention (the doc-anchor guardrail's retire/deleted line rule) — `check:doc-anchors` and `check:glossary` green with the amendment in. stitch-skin screenshot loop run against the live dev server at desktop 1440×900 and mobile 390×844 — zero class-token diff (value expressions changed, markup byte-identical); the class-token pins needed no retarget. Spec status flipped to resolved-in-full.
