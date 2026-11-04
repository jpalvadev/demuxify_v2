# 03: Separate Tab in the mockup pattern — dashed seam band dies

**What to build:** the **Separate Tab** header zone and its shipped content re-skinned in the mockup's Title-zone pattern at the desktop breakpoint. Every shipped component (Session Recovery, decoding card, Model Profile selector, Source Mix Dropzone, Source Mix Card, Separation Progress, Tempo Detector micro-line, Separation Complete banner) keeps working as it does today — wrapper look only.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** resolved

## Design source (agent-authored fallback; palette per ticket 01)

- **Title zone**: mockup's pattern extrapolated — UPPERCASE display title ("SEPARATE MUSIC INTO STEMS") + tiny sans caption (shipped subtitle copy) + bordered micro-chip (shipped mono meta line "HT-DEMUCS 4-STEM · local onnx"). The Grizzlython header zone's **dashed seam band and coral rule die** (death list: no wash-style rule behind the words).
- Content panels wear the new language: hairline border `st` token, panel surface, rounded corners (radii per ticket 01). `rounded-none` usages in this Tab (decode alert, decoding card, complete banner, stem chips) take the retuned radii.
- Stem chips in the Separation Complete banner keep their shipped shape; their color may retune to the ticket 02 stem hexes where the mockup implies it.
- The Tempo Detector status micro-line stays honest and mono (JetBrains Mono now); no chip-ification unless the mockup pattern demands it — pattern extrapolation only.

## Checklist

- [x] Title zone renders without seam band/coral rule; shipped title/caption/meta copy survives verbatim.
- [x] All Separate-Tab wrapper classes retarget to the new tokens; suite green (component tests untouched unless their DOM contract changes).
- [x] Nothing on the drop list appears; gating behavior (`tabPanelClass`) untouched.

## Comments

### Port record - Stitch skin (agent-authored design)

- Design source: spec mockup title-zone pattern extrapolated to the Separate
  Tab header (`stitch-skin/spec.md`); agent-authored fallback, OpenDesign MCP
  deliberately not called this effort. Landed as one gated commit on branch
  `stitch-skin`; the pre-commit chain ran green at commit time.
- Title zone: the Grizzlython seam band is DEAD - the zone div's
  `border-t-[1px] border-dashed sm:border-solid border-muted-foreground/60`
  classes removed (no dashed hairline, no solid coral rule, no wash behind
  the words). Pattern now: uppercase display h2 (`text-st-ink`, copy verbatim
  "Separate Music Into Stems") + tiny sans caption (shipped subtitle copy,
  `text-st-ink-dim`) + bordered micro-chip: `rounded-full bg-st-surface
border border-st-hairline` pill carrying the shipped mono meta line
  "HT-DEMUCS 4-STEM · local onnx" with its `text-status-ok` pip. DOM
  reorder (meta chip after the caption) is style-only: no test targets the
  meta line (grep-verified), and `check:glossary` sees copy unchanged.
- Content panels: every wrapper class was already semantic (`bg-card`,
  `border-border`, `rounded`) and ticket 01's sweep retuned the radii and
  token values; no `rounded-none` usage survived in this Tab (global sweep,
  261 replacements). Decode alert keeps its destructive semantic colors.
- Separation Complete banner stem chips: shape untouched (`rounded border
border-border bg-card/80 p-3 shadow-xs`); the Music note icon retunes to
  the stem hue via `text-stem-${stem}` (config already carries the Stitch
  stem ramp from ticket 01).
- Tempo Detector status micro-line: untouched, still honest mono (JetBrains
  Mono via the ticket-01 stack) - pattern extrapolation only, no
  chip-ification.
- `tabPanelClass` gating untouched; drop list absent (grep sweep clean in
  src/; the seam classes are gone at the token level).
