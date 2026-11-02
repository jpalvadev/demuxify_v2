# Agent Guidelines

## Mandatory rules

### No subagents

MANDATORY: never spawn subagents (explore, general-purpose, or any other subagent type) in this repo. This machine has strict memory constraints, and subagent child sessions spawn additional processes that exhaust memory. Do the exploration yourself, directly and surgically (targeted `read`, `grep`, and `glob` calls on specific paths rather than broad sweeps).

### OpenDesign MCP for all view design

MANDATORY: every UI view or visual redesign must be designed through the OpenDesign MCP (bundled design-system plugin catalog only, no external MCPs), never hand-designed in code. OpenDesign generates the design artifact in its project, then the result is ported into the existing React components (`src/App.tsx`, `src/components/`); engine logic stays untouched. If a needed view is not covered by an existing OpenDesign artifact, run a new OpenDesign run first and record it on the ticket. See `docs/adr/0007-tab-shell-ui.md`. Sole exception: the dead-MCP fallback below ("OpenDesign MCP — when it dies for good"), where the agent takes charge of the design instead.

## Agent skills

### Issue tracker

Local markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/`). See `docs/agents/domain.md`.

### Coding standards

Enforced conventions and architectural guardrails. See `CODING_STANDARDS.md`.

### Model provisioning

ONNX models and lightweight weights can be downloaded or provisioned using `scripts/provision_htdemucs.py`. See `public/models/`.

### Windows environment & worktrees

When working on Windows, avoid cross-drive NTFS junctions to `node_modules` because native packages (such as Tailwind/PostCSS resolution like `@alloc/quick-lru`) can fail to resolve symlinks across boundaries. Prefer standard branch checkouts in the main repo or independent `npm install` runs.

### OpenDesign MCP reconnection

If OpenDesign MCP calls fail because the daemon connection was lost, restore it without restarting OpenCode: in `C:\Users\Lorenzo06\.config\opencode\opencode.jsonc`, comment out the whole `"open-design"` MCP-server block, save the file; then uncomment it verbatim and save again. The connection is back when a light call (e.g. `list_projects`) returns.

### OpenDesign MCP — when it dies for good

If the MCP connection drops, attempt the reconnection above and allow OpenDesign exactly one more chance: retry the pending call once after reconnecting. If it fails again or does not respond, take charge of the design and of everything else for the rest of the job: hand-design and port the remaining views into the React components yourself, and record on the ticket that the look came from the agent instead of an OpenDesign run. After that fallback fires, do not call the OpenDesign MCP again for the rest of the session.
