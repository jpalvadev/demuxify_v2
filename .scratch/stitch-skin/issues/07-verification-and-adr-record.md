# 07: Verification sweep and the record (ADR-0014)

**What to build:** the whole overhaul verified as one picture at both breakpoints, all gates green, and the decisions written down as ADR-0014 with its supersessions — the answer-file for "why coral/Inter/rounded, why Tab Band, why Transport last, why no faces."

**Blocked by:** 01, 02, 03, 04, 05, 06.

**Status:** ready-for-agent

## Checklist

- [ ] Full vitest suite green via `npm run test:report` + `npm run typecheck`; no assertion left testing grz tokens, grizzly faces, the vertical rail column, the seam band, the footer identity, or the old Mix rail order.
- [ ] `check:testids`, extended `check:retired-affordances` (drop list + `grz`/`grizzly`/retired-font families + drop/death lists), `check:glossary`, `check:doc-anchors` all green.
- [ ] `git diff --name-only <pre-increment-commit>..HEAD` lists only skin/composition files: App, components, index.css, tailwind.config.js, typography module, test files, font provisioning, scripts gate, GLOSSARY.md, `docs/adr/0014-…` — zero engine/audio/encoder/model files.
- [ ] ADR-0014 authored in house format (Decision, Considered Options, Hard to Reverse, Supersede): supersedes ADR-0007 (fonts/accent), ADR-0009 (chrome placement: vertical rail column at md+ → Tab Band at every breakpoint), ADR-0013 (Mix rail order); cites ADR-0010/0011 Amendments where the mockup contradicted them (e.g. mockup's transport TAP and beat readouts vs those retirements — the guardrail wins). Numbers recorded as `NAME = <number>` anchors with named consts in code; radii as prose pointer.
- [ ] GLOSSARY touch-up: **Tab Band** named (vertical rail column / Tab Rail phrasing retired as _Avoid_), one-line edits only.
- [ ] Design source recorded on this record: agent-authored via the dead-MCP fallback route (`docs/agents/open-design-mcp.md`); the mockup/screenshots are conversation-only, values carried on tickets 01–06.
- [ ] Visual verification honestly limited (no screenshot tooling on this branch): DOM/class-token seam proof, flagged for human eyeball pass.

## Comments
