# Agent Guidelines

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
