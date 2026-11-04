# 05: System Tab re-skinned — grizzly header band and both faces die

**What to build:** the **System Tab** loses its Grizzlython header band outright (death list) and wears the mockup's Title-zone pattern; its diagnostics surface retargets to the new tokens. WebGPU status badge, Fallback Advisory, Model Cache status, saved-session line, and DiagnosticsPanel stay behaviorally identical.

**Blocked by:** 01 (tokens/fonts/Tab Band).

**Status:** resolved

## Design source (agent-authored fallback; palette per ticket 01)

- **Deaths (absence-pinned per coding standards §9)**: `header-band`, `header-band-face` ×2, accessible names `grz-01 …` / `grz-02 …`, the mascot-face SVG machinery (`faceElements`, grz name data in App), the uppercase grizzly-style System lockup. Existing test pins that reference these flip to absence assertions in this commit.
- **Also dies this ticket (page-level deaths, per spec)**: the footer identity lines ("Demuxify Web • 100% Client-Side Audio Source Separation", "Powered by Client Neural Inference & WebGPU") — page ends flat, footer element gone or empty; and the System-Tab mono identity line ("Client-Side Stem Separation") carried for mobile — the new Tab Band's tagline is desktop-only, so the mobile identity story is resolved by the Band itself (brand block renders there), not by a tab-internal copy. `grizzly-pulse` CSS and `grizzly-grid` backdrop also die (they belong to this skin's machinery).
- **Title zone**: UPPERCASE "SYSTEM" + tiny caption (shipped one-liner "Hardware acceleration, Model Cache and on-device diagnostics.") in the mockup pattern, no band, no faces.
- Panels/badges retarget to `st-*` hairlines + new surfaces + radii; emerald ok-pip language from ticket 01 applies to status badges.

## Checklist

- [x] Band + faces + names absent from source and DOM; retargeted test pins flip to absence (this is the death, not a rename).
- [x] Footer identity lines gone; footer flat or removed; suite green with the footer pins flipped.
- [x] Diagnostics, WebGPU, Model Cache, session-info surfaces keep every pinned testid resolving.
- [x] `check:retired-affordances` bans `grz`/`grizzly`/face machinery green from this commit.

## Comments

### Port record (resolved in commit on branch stitch-skin)

- **Design source:** agent-authored fallback per spec.md mockups (OpenDesign MCP forbidden this effort); recorded on this ticket.

- **Band death:** the System-Tab Grizzly band chrome died outright — the header-band strip, both header-band-face spans (grz-01 Demuxer / grz-02 Mixer accessible names), the faceElements + createElement SVG machinery, the uppercase BANNER_FONT System lockup, and the grizzly import line all excised from src/App.tsx; src/lib/grizzly.ts git-rm'd.

- **Title zone:** System Tab now wears the unconditional sibling pattern — uppercase display h3 SYSTEM + tiny caption (shipped one-liner kept verbatim); active/inactive ternary collapsed.

- **Identity <p> death:** the System-Tab mono "Client-Side Stem Separation" <p> deleted; the mobile identity story rides the Tab Band brand lockup (survived at ticket 01). Absence-pinned via within(systemPanel).queryByText null.

- **Footer death:** both copy lines gone; footer is now an empty <footer className="w-full block border-t border-st-hairline py-3" /> marker. Footer copy pins flipped to 100% absence (queryByText(/powered by/i) + queryByText(/client-side audio source separation/i) null); flat hairline class pins kept.

- **Test flips:** band test renamed to "keeps the dead Grizzly header band absent everywhere, active System Tab included" — presence pins (getByTestId header-band + faces length 2 + grz-01/grz-02 names) flipped to null/absence at every Tab including System-active; panel-survives assertions (region getByText ^System$ + /hardware acceleration/i) added. Identity presence -> queryByText null. grz-01/grz-02 accessible-name pins gone with the block.

- **Badge retarget:** WebGPUStatusBadge chips rounded -> rounded-full micro-chip pills; the "Detecting" chip re-tuned to bg-st-surface + text-st-ink-dim + border-st-hairline; ok/warn status tokens preserved (emerald ok-pip language from ticket 01).

- **Gate bans (check-retired-affordances, this commit):** /\bheader-band\b/ and /\b(faceElements|grzNames|grz0[12])\b/ inserted as revival bans; gate green. grizzly-grid/pulse + fonts/grizzly + font-name bans were already in force from ticket 01's stage.

- **Gates/suite:** glossary, doc-anchors, testids (64 presence pins), retired-affordances, test-fixtures, typecheck all green; vitest 359/359.
