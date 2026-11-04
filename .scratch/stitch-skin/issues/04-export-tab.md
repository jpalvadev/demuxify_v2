# 04: Export Tab in the mockup pattern — dialog retargeted, not restructured

**What to build:** the **Export Tab** head and **Export Bundle** surface wearing the new language at the desktop breakpoint. The **Export Dialog**'s internal layout is out of scope beyond token retarget (hairlines, radii, ink, mono stack) — its shipped flow (Export Bundle choices, Custom Mixdown controls, download progress) is untouched behaviorally.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** ready-for-agent

## Design source (agent-authored fallback; palette per ticket 01)

- **Title zone** extrapolated like ticket 03's: UPPERCASE display title ("EXPORT") + tiny caption (shipped inline copy "The Export panel is always here — no action to click." and the gated one-liner reason stay as the caption) + bordered micro-chip where the mockup pattern puts one.
- Gated and open states both wear the same title-zone pattern; gating (`stemsReady` / `tabPanelClass`) semantics untouched.
- Inside the dialog: hairline borders, new surfaces, retuned radii, JetBrains Mono for readouts; every pinned testid in the dialog keeps resolving (check:testids gates it).

## Checklist

- [ ] Both states render in the pattern with shipped copy verbatim.
- [ ] Dialog class tokens retargeted in its component; existing ExportDialog test asserts keep green (only retarget pins whose classes changed).
- [ ] No new controls anywhere in this Tab; suite green through the chain.

## Comments
