# Agent Guidelines

## Mandatory rules

### No subagents

MANDATORY: never spawn subagents (explore, general-purpose, or any other subagent type) in this repo. This machine has strict memory constraints, and subagent child sessions spawn additional processes that exhaust memory. Do the exploration yourself, directly and surgically (targeted `read`, `grep`, and `glob` calls on specific paths rather than broad sweeps).

Carve-out: skills whose workflow names sub-agents (e.g. `code-review` spawning two review agents) must run their axes **inline in the current session** — do the work the named sub-agents would do yourself, sequentially, without launching a child session. Never work around this by spawning anything.

### OpenDesign MCP for all view design

MANDATORY: every UI view or visual redesign must be designed through the OpenDesign MCP (bundled design-system plugin catalog only, no external MCPs), never hand-designed in code. OpenDesign generates the design artifact in its project, then the result is ported into the existing React components (`src/App.tsx`, `src/components/`); engine logic stays untouched. If a needed view is not covered by an existing OpenDesign artifact, run a new OpenDesign run first and record it on the ticket. See `docs/adr/0007-tab-shell-ui.md`. Sole exception: the dead-MCP fallback in `docs/agents/open-design-mcp.md`, where the agent takes charge of the design instead.

## Agent skills

### Issue tracker

Local markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/`). See `docs/agents/domain.md`.

### Coding standards

Enforced conventions and architectural guardrails. See `CODING_STANDARDS.md`.

### Codebase navigation

Test files pin DOM `data-testid` attributes across `src/__tests__`; grep the pinned names before touching or removing any rail control. See `docs/agents/navigation.md`.

### Model provisioning

ONNX models and lightweight weights can be downloaded or provisioned using `scripts/provision_htdemucs.py`. See `public/models/`.

### Windows environment & worktrees

When working on Windows, avoid cross-drive NTFS junctions to `node_modules` because native packages (such as Tailwind/PostCSS resolution like `@alloc/quick-lru`) can fail to resolve symlinks across boundaries. Prefer standard branch checkouts in the main repo or independent `npm install` runs.

### Big-file editing

`src/App.tsx`, `src/components/StemPlayer.tsx` and `src/lib/stemPlayerEngine.ts` run 1,100+ lines; anchor every edit with `grep -n`/`sed -n` output. A large `read` slice is advisory until anchored.

### Check cycle

Every commit must pass the gate wired in `.husky/pre-commit`: `npx lint-staged` → `npm run check:glossary` → `npm run check:doc-anchors` → `npm run check:test-fixtures` → `npm run typecheck` → `npm run test`. Never stage and commit without running it; the hook re-runs the full suite (~22–33 s) on every `git commit`.

When the suite fails, do NOT re-read raw vitest output (thousands of tokens of DOM dumps). Run `npm run test:report` (`scripts/vitest-summary.mjs`) and work from its compact failure list.

### Git layout

This repo has **no remote**. All branches and commits are local only; there is no such thing as "unpushed" work here. Do not attempt `git push`, force-pushes, or PR workflows.

### OpenDesign MCP — when a call fails

If OpenDesign MCP calls fail (daemon connection lost, cancelled run, or tool errors): follow the recovery procedure in `docs/agents/open-design-mcp.md` — reconnect recipe, one retry, then the agent-authored fallback that must be recorded on the ticket.
