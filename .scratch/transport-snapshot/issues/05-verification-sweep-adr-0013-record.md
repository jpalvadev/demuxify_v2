# 05: Verification sweep + ADR-0013 amendment record

**What to build:** The increment is proven byte-for-byte behavior-preserving and recorded: every parity-guard suite is green untouched, the full pre-commit chain is green, the stitch-skin screenshot loop shows zero class-token diff at desktop and mobile, and the append-only ADR-0013 amendment — "the shell reads one Transport snapshot; mirror states banned" — is authored so nobody reintroduces the mirrors. The spec's status is updated to record the landing.

**Blocked by:** 01, 02, 03, 04.

**Status:** ready-for-agent

- [ ] Parity guards green untouched: Stem Player component seam (bridge-channel tests — its interface is unchanged), the 42 engine seam tests, Master Waveform seam tests (repaint ceiling), sessionStore mixer-bridge/save-cadence tests, the Space keyboard test
- [ ] Full pre-commit chain green: typecheck, full suite, `check:testids`, `check:retired-affordances`, `check:doc-anchors`, `check:dist-fresh`
- [ ] stitch-skin loop: screenshots of the running app at desktop 1440×900 and mobile 390×844 show zero class-token diff against the view targets; the class-token pins needed no retarget (value sources changed, markup did not)
- [ ] ADR-0013 amendment authored (append-only house format): the shell reads one Transport snapshot; App mirror states and the mid-render mutable ref are banned
- [ ] Spec status updated to record the increment resolved (tickets 01–05)
- [ ] Final commit gated green

## Comments
