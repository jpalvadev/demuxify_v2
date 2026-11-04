# 05: System Tab re-skinned — grizzly header band and both faces die

**What to build:** the **System Tab** loses its Grizzlython header band outright (death list) and wears the mockup's Title-zone pattern; its diagnostics surface retargets to the new tokens. WebGPU status badge, Fallback Advisory, Model Cache status, saved-session line, and DiagnosticsPanel stay behaviorally identical.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** ready-for-agent

## Design source (agent-authored fallback; palette per ticket 01)

- **Deaths (absence-pinned per coding standards §9)**: `header-band`, `header-band-face` ×2, accessible names `grz-01 …` / `grz-02 …`, the mascot-face SVG machinery (`faceElements`, grz name data in App), the uppercase grizzly-style System lockup. Existing test pins that reference these flip to absence assertions in this commit.
- **Also dies this ticket (page-level deaths, per spec)**: the footer identity lines ("Demuxify Web • 100% Client-Side Audio Source Separation", "Powered by Client Neural Inference & WebGPU") — page ends flat, footer element gone or empty; and the System-Tab mono identity line ("Client-Side Stem Separation") carried for mobile — the new Tab Band's tagline is desktop-only, so the mobile identity story is resolved by the Band itself (brand block renders there), not by a tab-internal copy. `grizzly-pulse` CSS and `grizzly-grid` backdrop also die (they belong to this skin's machinery).
- **Title zone**: UPPERCASE "SYSTEM" + tiny caption (shipped one-liner "Hardware acceleration, Model Cache and on-device diagnostics.") in the mockup pattern, no band, no faces.
- Panels/badges retarget to `st-*` hairlines + new surfaces + radii; emerald ok-pip language from ticket 01 applies to status badges.

## Checklist

- [ ] Band + faces + names absent from source and DOM; retargeted test pins flip to absence (this is the death, not a rename).
- [ ] Footer identity lines gone; footer flat or removed; suite green with the footer pins flipped.
- [ ] Diagnostics, WebGPU, Model Cache, session-info surfaces keep every pinned testid resolving.
- [ ] `check:retired-affordances` bans `grz`/`grizzly`/face machinery green from this commit.

## Comments
