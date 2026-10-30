# 10: Purge Legacy Demucs Code & Align RoFormer Domain Standards

**What to build:** The codebase cleanly reflects the active BS-RoFormer 4-stem model pipeline by eliminating obsolete HTDemucs naming, dead code paths, misleading download progress messages, and stale cache keys while maintaining strict adherence to `GLOSSARY.md` and `CODING_STANDARDS.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Update `SeparationProgress.tsx` messages to accurately indicate BS-RoFormer model weights download rather than HTDemucs.
- [ ] Rename `DEMUCS_STEM_ORDER` and legacy Demucs constants in `inference.worker.ts` and related helpers to canonical domain terminology.
- [ ] Clean up obsolete cache references and legacy fallback dead code across `modelCache.ts` and worker initialization.
- [ ] Verify `npm run check:glossary` and test suite pass with zero deprecated terminology violations.
