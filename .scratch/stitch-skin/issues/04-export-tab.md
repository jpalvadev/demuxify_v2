# 04: Export Tab in the mockup pattern — dialog retargeted, not restructured

**What to build:** the **Export Tab** head and **Export Bundle** surface wearing the new language at the desktop breakpoint. The **Export Dialog**'s internal layout is out of scope beyond token retarget (hairlines, radii, ink, mono stack) — its shipped flow (Export Bundle choices, Custom Mixdown controls, download progress) is untouched behaviorally.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** resolved

## Design source (agent-authored fallback; palette per ticket 01)

- **Title zone** extrapolated like ticket 03's: UPPERCASE display title ("EXPORT") + tiny caption (shipped inline copy "The Export panel is always here — no action to click." and the gated one-liner reason stay as the caption) + bordered micro-chip where the mockup pattern puts one.
- Gated and open states both wear the same title-zone pattern; gating (`stemsReady` / `tabPanelClass`) semantics untouched.
- Inside the dialog: hairline borders, new surfaces, retuned radii, JetBrains Mono for readouts; every pinned testid in the dialog keeps resolving (check:testids gates it).

## Checklist

- [x] Both states render in the pattern with shipped copy verbatim.
- [x] Dialog class tokens retargeted in its component; existing ExportDialog test asserts keep green (only retarget pins whose classes changed).
- [x] No new controls anywhere in this Tab; suite green through the chain.

## Comments

### Port record - Stitch skin (agent-authored design)

- Design source: spec mockup title-zone pattern extrapolated from ticket 03
  (`stitch-skin/spec.md` Export cell); agent-authored fallback - OpenDesign MCP
  deliberately not called this effort. One gated commit on `stitch-skin`, chain
  green at commit time.
- Open state: title zone = UPPERCASE display h3 (`font-display text-[15px]
leading-[18px] font-bold uppercase tracking-[0.07em] text-st-ink`) + the
  shipped caption verbatim ("The Export panel is always here - no action to
  click.") + bordered micro-chip pill `rounded-full bg-st-surface
border border-st-hairline` with the mono meta `WAV · MP3 · ZIP` -
  an honest format line (bundleZip ships ZIP; dialog copy says WAV/MP3).
- Gated state: same title + caption shape; `{TAB_GATING_REASON}` copy
  untouched (four `/no Stems yet/i` pins keep resolving); NO meta chip in the
  gated state (a formats chip next to "no Stems yet" would claim a ready
  state) - pattern-consistent, honesty-preserving deviation from the
  "bordered micro-chip" clause, recorded here.
- Dialog internals: token retarget only - outer card `rounded border
border-border bg-card` -> `rounded-lg border border-st-hairline bg-st-panel`,
  header rule `border-b border-st-hairline/60`, icon box `rounded` ->
  `rounded-full` with `border-primary/30`. Layout, form flow, bundle choices,
  Custom Mixdown sliders, download progress and every pinned testid untouched
  (`check:testids` green without test edits; ExportDialog assertions kept
  green as-is, no retargets were needed because no pinned class changed).
- No new controls; `tabPanelClass`/`stemsReady` gating semantics untouched.
