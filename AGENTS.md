# Agent Guidelines

## Mandatory rules

### No subagents

MANDATORY: never spawn subagents (explore, general-purpose, or any other subagent type) in this repo. This machine has strict memory constraints, and subagent child sessions spawn additional processes that exhaust memory. Do the exploration yourself, directly and surgically (targeted `read`, `grep`, and `glob` calls on specific paths rather than broad sweeps).

Carve-out: skills whose workflow names sub-agents (e.g. `code-review` spawning two review agents) must run their axes **inline in the current session** — do the work the named sub-agents would do yourself, sequentially, without launching a child session. Never work around this by spawning anything.

### OpenDesign MCP for all view design

MANDATORY: every UI view or visual redesign must be designed through the OpenDesign MCP (bundled design-system plugin catalog only, no external MCPs), never hand-designed in code. OpenDesign generates the design artifact in its project, then the result is ported into the existing React components (`src/App.tsx`, `src/components/`); engine logic stays untouched. If a needed view is not covered by an existing OpenDesign artifact, run a new OpenDesign run first and record it on the ticket. See `docs/adr/0007-tab-shell-ui.md`. Sole exception: the dead-MCP fallback in `docs/agents/open-design-mcp.md`, where the agent takes charge of the design instead.

Probe before designing: the MCP daemon dies between sessions without the config changing, so the first OpenDesign call of a session must be a light one (`list_projects`). If it errors, go straight to the fallback in `docs/agents/open-design-mcp.md` and make no further OpenDesign calls that session — do not re-pay a doomed design call per ticket.

Failure route: if an OpenDesign call fails mid-session (daemon connection lost, cancelled run, or tool errors), follow the recovery procedure in `docs/agents/open-design-mcp.md` — reconnect recipe, then exactly one retry of the pending call after reconnecting, and if that fails too, the agent-authored fallback, which must be recorded on the ticket as the design source. After the fallback fires, do not call the OpenDesign MCP again that session.

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

Grep `src/__tests__` for pinned `data-testid` names before touching or removing any rail control — `npm run check:testids` gates that drift at commit time. `docs/agents/navigation.md` carries the full rule set: the presence/absence halves, the lint-staged quote-reflow grep trap, `test:report`, `npm run outline`, and the Playwright Chromium-truth rules.

### Model provisioning

The `scripts/provision_*.py` pair provisions ONNX models and lightweight weights (one script per profile) into `public/models/`. The exported graphs need patching before ORT-Web's WebGPU EP runs them: negative `axis` attrs via `scripts/normalize_axes.py`, and Split/Concat kept under Chrome's 8-storage-buffer limit via `scripts/webgpu_friendly.py`.

### Verification replays

Before changing the Beat Grid's snap tolerance (`src/lib/beatGridRepair.ts`) or anything ADR-0011 records as a derived number, replay both halves of its derivation: `npm run verify:beat-grid-anchor` (the tracker half — ffmpeg-decodes the reference Source Mix and runs the shipped repair module) and `python scripts/check_bpm.py` (the librosa ground-truth half). They are deliberately NOT in the pre-commit chain — they decode a 294 s audio file — but `npm run check:doc-anchors` now compares every `NAME = <number>` span in the ADRs against the constant `src/` actually runs with, so a recorded number cannot silently drift. The same gate anchors every code identifier an ADR cites: write a deleted/renamed identifier's citation on a line that names it deleted/retired/history — the historical-skip rule skips that line, because an ADR records past states legitimately.

### Windows environment & worktrees

When working on Windows, avoid cross-drive NTFS junctions to `node_modules` because native packages (such as Tailwind/PostCSS resolution like `@alloc/quick-lru`) can fail to resolve symlinks across boundaries. Prefer standard branch checkouts in the main repo or independent `npm install` runs. Run inline Python snippets as `python -c "…"`: a bare `python - << 'EOF'` heredoc hangs on this box (stdin gets intercepted by VS Code's Native REPL) and burns the shell timeout.

Shell on this box: the bash has no `ls`/`tail`/`sed` and intermittently loses `grep`/`head`/`npm`, and npm shims die with a WSL `execvpe /bin/bash` error — sift output with `node -e` one-liners and run tools direct from `node_modules` (`node node_modules/vite/bin/vite.js build`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/vitest/vitest.mjs run …`).

Dev-server probe: undici `fetch` ignores `rejectUnauthorized`, so a health-check fetch against the self-signed `https://localhost` server reports a LIVE server DEAD — probe with `require("https").get(url, {rejectUnauthorized: false}, …)`. vite auto-increments a busy port: read the running server's shell output for its real port, keep ONE server (memory-strict box), and kill a duplicate with `netstat -ano -p tcp` + `taskkill /PID <pid> /F`.

### Big-file editing

`src/App.tsx`, `src/components/StemPlayer.tsx` and `src/lib/stemPlayerEngine.ts` run 1,100+ lines; anchor every edit with `grep -n`/`sed -n` output, or in one call with `npm run outline` (`scripts/outline.mjs`: every top-level and exported-component declaration with its line number; pass a path to outline another file). A large `read` slice is advisory until anchored.

### Check cycle

Every commit must pass the chain wired in `.husky/pre-commit` (read it for the current gate list). Never stage and commit blind to it: the hook re-runs the whole chain (~22–33 s) on every `git commit`.

Any commit touching `src/` rebuilds `dist/` first (`npm run build`, or direct `tsc` + vite when the npm shim flakes): `check:dist-fresh` gates EVERY commit — the stitch-skin loop's rebuild step is not skin-only — and forgetting it costs an aborted chain run at the commit itself.

When the suite fails, do NOT re-read raw vitest output (thousands of tokens of DOM dumps). Run `npm run test:report` (`scripts/vitest-summary.mjs`) and work from its compact failure list — the hook's last gate is that same command, so `git commit` itself already prints the compact list (and aborts on red) instead of flooding ~40 k lines of raw vitest into the commit result.

### Git layout

This repo has **no remote**. All branches and commits are local only; there is no such thing as "unpushed" work here. Do not attempt `git push`, force-pushes, or PR workflows.

### Stitch Skin — screenshot-driven fidelity

The DESIGN TRUTH lives in `view_target/` (repo-root, user-owned): `stitch.html` is the Google Stitch mockup, `desktop_stitch_target_design.png` / `mobile_stitch_target_design.png` are its own renders — the VIEW TARGET. MANDATORY: `view_target/` is READ-ONLY — never write, overwrite, rename, delete or git-add anything inside it; the running app's own screenshots go to the temp PNG dir under `app-*`/`probe-*` names and must never replace the targets.

The fidelity loop, run it to convergence (the 06b→07a increment closed 2026-11-05 with the user's confirmation; style extra fidelity commits `stitch-skin 06b`, `06c`, … on branch `stitch-skin`): boot dev in the background → screenshot the RUNNING app at desktop 1440×900 and mobile 390×844 via `scripts/shot.mjs` / `scripts/shot-mix.mjs`, plus the mockup itself (`file:///…/stitch.html`) → `read` the PNGs and diff against `stitch.html` composition/class facts → patch the skin (App.tsx / components / tailwind.config.js / index.css ONLY — engine logic untouched), retarget the class-token test pins in the SAME commit → rebuild `dist/` (the `check:dist-fresh` gate enforces it) → commit gated green. Playwright reads are Chromium truths: UA-painted chrome (range sliders, form controls) drifts on the user's engine — ship NATIVE controls, quantify with probes, and close the loop with the user's eyes. Design source: agent-authored fallback (`docs/agents/open-design-mcp.md`), recorded on the ticket.
