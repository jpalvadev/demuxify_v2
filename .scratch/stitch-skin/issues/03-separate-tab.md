# 03: Separate Tab in the mockup pattern — dashed seam band dies

**What to build:** the **Separate Tab** header zone and its shipped content re-skinned in the mockup's Title-zone pattern at the desktop breakpoint. Every shipped component (Session Recovery, decoding card, Model Profile selector, Source Mix Dropzone, Source Mix Card, Separation Progress, Tempo Detector micro-line, Separation Complete banner) keeps working as it does today — wrapper look only.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** ready-for-agent

## Design source (agent-authored fallback; palette per ticket 01)

- **Title zone**: mockup's pattern extrapolated — UPPERCASE display title ("SEPARATE MUSIC INTO STEMS") + tiny sans caption (shipped subtitle copy) + bordered micro-chip (shipped mono meta line "HT-DEMUCS 4-STEM · local onnx"). The Grizzlython header zone's **dashed seam band and coral rule die** (death list: no wash-style rule behind the words).
- Content panels wear the new language: hairline border `st` token, panel surface, rounded corners (radii per ticket 01). `rounded-none` usages in this Tab (decode alert, decoding card, complete banner, stem chips) take the retuned radii.
- Stem chips in the Separation Complete banner keep their shipped shape; their color may retune to the ticket 02 stem hexes where the mockup implies it.
- The Tempo Detector status micro-line stays honest and mono (JetBrains Mono now); no chip-ification unless the mockup pattern demands it — pattern extrapolation only.

## Checklist

- [ ] Title zone renders without seam band/coral rule; shipped title/caption/meta copy survives verbatim.
- [ ] All Separate-Tab wrapper classes retarget to the new tokens; suite green (component tests untouched unless their DOM contract changes).
- [ ] Nothing on the drop list appears; gating behavior (`tabPanelClass`) untouched.

## Comments
