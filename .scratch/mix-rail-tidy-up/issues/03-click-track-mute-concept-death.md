# 03: Click Track mute concept death — rail, engine, Session, record

**What to build:** the **Click Track** rail exposes exactly one control pair — the ♪ on/off switch and the volume fader. The separate "M" mute button dies, and the mute concept retires end to end: the lane state loses its `muted` axis at the engine seam, the **Session**'s persisted lane settings stop writing it and ignore it on load (no back-compat, per the ADR-0011 Amendment precedent), and the GLOSSARY definition of the **Click Track** stops promising a mute. The **Export Bundle** rule stays byte-identical — it always gated the Click Track file on `enabled` + **Beat Grid**, never on mute.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The Click Track rail renders one and only one button (the ♪ `role="switch"` on/off) plus one and only one slider (volume, no rate control of its own); the mute accessible-name pin retires from the rail tests.
- [x] `toggleClickTrackMute` and the lane-state `muted` field die at the engine seam; typecheck stays clean through the app wiring, the Session persistence payload type, and the export panel's lane-settings prop.
- [x] Session write side stops persisting the flag; the load gate validates the reduced payload; a legacy stored payload carrying the flag loads without effect and without refusal.
- [x] The lane's volume-icon mute face reties from `muted` to `volume === 0`, so the visual feedback survives without the concept; the fader keeps its value while the lane is off (settled in grilling story 15).
- [x] The existing Click Track export tests (bundle seam and export-panel seam) stay green untouched — that is the parity proof: `enabled` + Beat Grid gating and the uniform synthesized tap are unchanged.
- [x] GLOSSARY **Click Track** definition amended: "its own on/off and volume controls" — the word mute is gone; `check:glossary` green.
- [x] ADR-0010 gains an amendment span recording the lane-mute retirement (why: off + volume already answer silence; export never consulted mute; no back-compat), styled after the ADR-0011 Amendment.
- [x] Full pre-commit check cycle green.

## Design decisions for this ticket

- Full concept retirement, not UI-only (settled in grilling Q8): the field would otherwise be dead weight in the Session schema and the export prop shape.
- Watch the sibling trap (spec Further Notes): the **Stem** Strip's M button and Mute concept stay alive — only the Click Track lane loses mute.
- Anchor every edit in the two big files with the outline map (AGENTS.md big-file steering).

**Branch:** mix-rail-tidy-up (new branch off `main` at porting start)

**Spec:** `.scratch/mix-rail-tidy-up/spec.md`

## Comments

- **Ported — commit `6f485c8` (2026-11-02).** What landed: mute concept death end to end — rail M button (`aria-label="Mute Click Track"`) and `handleToggleClickTrackMute` gone from `StemPlayer.tsx`; `setClickTrackMuted`/`toggleClickTrackMute` and the `muted` field gone from `stemPlayerEngine.ts` (`applyClickGain` now `enabled ? volume : 0`); sessionStore write reduced, `isValidClickTrack` stops requiring the legacy key, `loadActiveSession` reconstitutes the lane reduced so an old `muted: true` never resurfaces and never refuses; the VolumeX icon face reties to `volume === 0`; GLOSSARY Click Track entry drops the mute word; ADR-0010 gains the lane-mute Amendment. Test delta: suite 355→356 (+1 new sessionStore legacy-payload test proving reconstitution); retargets kept the rail/engine/store/export fixtures compiling against the narrowed type. Gotchas: RED first came as TS missing-key errors on the annotated fixtures plus the rail button-count pin — `getAllByRole` throws on zero matches, so the absence pin uses `queryAllByRole("button")`; the sibling trap held (stem-level `muted` in mixer fixtures stays alive); the export literals retarget shape only — gating behavior untouched, those tests green as the parity proof; the ADR amendment heading carries "retired" to stay doc-anchor exempt.
