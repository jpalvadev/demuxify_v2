# Spec: Stitch Skin — Coral-on-Black Reskin of the Whole Tab Shell

Status: ready-for-agent

Recorded on the tracker 2026-11-03. Supersedes visual-language claims in `docs/adr/0007-tab-shell-ui.md` (acid-lime accent, its font contract), the chrome placement of `docs/adr/0009-rail-hosted-chrome-and-inline-notices.md` (vertical rail column at md+), and the Mix rail order of `docs/adr/0013-mix-tab-cohesion-and-the-single-playhead-readout.md`; it must not resurrect anything `docs/adr/0010`/`docs/adr/0011` Amendments retired. Design source: the user's Google Stitch Mix-Tab mockup plus desktop/mobile screenshots, extrapolated to the other Tabs by the agent — the OpenDesign MCP was NOT called (forbidden for this effort); the look is recorded on the tickets as agent-authored via the documented fallback route (`docs/agents/open-design-mcp.md`). ADR-0014 is authored with this increment. Glossary terms used throughout: **Tab Shell**, **Tab**, **Tab Band**, **Brand Unit**, **Transport**, **Stem Player**, **Stem Strip**, **Master Waveform**, **Playhead**, **Hand Calibration**, **Tempo Detector**, **Beat Grid**, **Click Track**, **Time-Stretch**, **Pitch-Shift**, **Formant Preservation**, **Source Mix**, **Stems**, **Session**, **Model Profile**, **Model Cache**, **Inference Engine**, **Export Bundle**, **Custom Mixdown**, **BPM Candidate**.

> Vocabulary note: the increment renames the chrome mechanism — the desktop **vertical rail column dies** and the merged sticky top block of the mobile shell becomes the only **Tab Band** at every breakpoint. The glossary entry for **Tab Shell** and the "Tab Rail" phrasing get a one-line touch-up when the ADR record is written; the four Tabs, their gating, and every Rail inside them keep their names.

## Problem Statement

The app ships the Grizzlython skin (cream/tan ink, acid-lime canvas marks, zero-radius chips, Wayback-bundled type, grizzly mascot marks, page-level footer identity). The user wants a complete visual overhaul in the language of a Google Stitch mockup they generated for the Mix Tab: deep-black surfaces, hairline-bordered panels, rounded chips, a coral accent, Inter + JetBrains Mono, a Transport row with a coral-circle Play/Pause, and Stem Strips with waveform racks — at both breakpoints, extrapolated to the Separate, Export, and System Tabs.

## Solution

A reskin plus re-composition — never a new behavior. What exists stays and behaves exactly as it does today; what the mockup shows that the app never had is dropped, and what a guardrail already retired stays dead. One sticky **Tab Band** (Brand Unit row + the four Tab chips) replaces the page-level header at every breakpoint. The Mix stage re-stages in the mockup's order around a slimmed **Master Waveform** spine; **Transport** stays the stage's last rail, full-bleed, with **Stem Player** ownership. Every token, font, radius, and canvas color moves through the existing shadcn-style CSS-variable and Tailwind config architecture — the mockup's Tailwind-CDN classes and hex arbitrary values are the design source, never code to copy. The **Mix Tab** gets a full pass at both breakpoints; the other three Tabs and the mobile shell extrapolate the mockup's pattern in the same visual language.

## User Stories

1. As a first-time visitor, I want the Tab Band to open the page with the Brand Unit and four Tab chips at every breakpoint, so that the four-Tab world is legible the moment the app loads, without a competing full-width header.
2. As a first-time visitor, I want the brand mark to be the mockup's coral rounded-square with a white diamond glyph, so that the identity feels like the new skin rather than the Waves icon.
3. As a first-time visitor, I want the wordmark set in mixed-case bold Inter over the mono tagline (desktop only), so that the identity reads calm instead of an all-caps lockup.
4. As a returning visitor, I want the active Tab chip to be a solid coral pill with black ink, so that I always know which Tab I'm in.
5. As a visitor without Stems, I want the gated Tab chips grayed with their one-line reason ("no Stems yet"), so that I know what's coming and why it isn't here yet.
6. As a visitor on touch, I want every Tab chip to keep a 44px target and `aria-disabled` while gated, so that the chrome is reachable and honest to a screen reader.
7. As a mixer, I want the Mix stage to open on the **Master Waveform** spine card with the waveform box, its `mm:ss` graduations, the STEREO MIX chip, and the "Overview" caption — and no spine clock — so that one clock governs the stage.
8. As a mixer, I want the **Hand Calibration** thin lane welded under the spine wearing the shipped copy and its coral Confirm chip plus the "Reset taps" chip, so that the calibration ritual reads as part of the tempo story.
9. As a mixer, I want the **BPM Candidates** row directly under the calibration lane — the top reading as the anchor, ranked alternatives with confidence, and the lock chip — so that I can judge and lock the reading.
10. As a mixer, I want **Transport** as the stage's last rail, full-bleed, with the timecode block, a coral-circle Play/Pause toggle, the Master Volume slider with its `100%` readout, and an honest status line ("4 STEMS · PHASE-LOCKED" with an ok pip only when Stems exist), so that the claim I act on is the claim I can trust.
11. As a mixer, I want each **Stem Strip** to wear its stem dot, name, ISO-N chip, waveform with its own playhead, M/S square chips, and volume slider — with no mute chip on the Click Track — so that the strip grid stays the mute-and-volume surface it always was.
12. As a mixer, I want the **Time-Stretch** card (slider + six preset chips + `1.00x` readout) and the **Pitch-Shift** card (slider + Formant Preservation chip + a Reset Pitch & Tempo button that resets only what's actually moved), so that speed and pitch are one honest control surface.
13. As a mixer, I want the Click Track card to state only its honest BPM line — no invented "SYNC READY" claim — so that nothing on screen promises synchronization we don't perform.
14. As a mixer, I want the master waveform, stem waveforms, and Playhead rendered in the new canvas palette (electric-lime trace, deep-black waveform box, white Playhead) while the Beat Grid's anchor math is untouched, so that the look moves and the analysis does not.

15. As a separate-mode user, I want the **Separate Tab** to keep its shipped copy (Model Profile chooser, file picker, Start Session chip, inference progress) re-skinned in the mockup's pattern — UPPERCASE title + tiny caption + hairline panels — so that the work surface looks new but behaves old.
16. As a separate-mode user, I want the dashed seam band and the grizzly header band with its two mascot faces gone from the app entirely, so that nothing Grizzlython survives to compete with the new skin.
17. As an exporter, I want the **Export Tab** to wear the same Title-zone pattern over its shipped content (Export Bundle choices, Custom Mixdown, download progress), so that the Tab reads in the new language without gaining a single behavior.
18. As a settings user, I want the **System Tab** to be re-skinned in the same language — no grizzly header band, no mascot faces, no `/grz-01/` `/grz-02/` accessible names — while its diagnostics and cache controls stay exactly as they work today, so that even the last Tab completes the overhaul.
19. As a mobile user, I want the Tab Band stacked over the stage exactly like the screenshot (brand block, centered Tab chips, tighter spacing), with the Mix stage keeping the mockup's order including Transport last, so that the phone reads in the same language as the desktop.
20. As a keyboard/screen-reader user, I want every retargeted control to keep its existing accessible name, focus ring, and pinned test identity (`check:testids`), so that a reskin never breaks the contracts the test suite guards.
21. As a user of the offline PWA, I want Inter and JetBrains Mono self-hosted as woff2 subsets loaded from the app's own font directory, so that no Google Fonts CDN request ever leaves the device.
22. As a maintainer, I want the retired affordances (undo/redo, gear badge, Loop toggle, Seek-to-start, fast-forward, tap button, VU meters, beat-dot readouts, "4/4 Beat", grizzly marks, page-level footer identity) pinned as absent by the guardrail sweep, so that no future session can sneak them back in.
23. As a maintainer, I want the new design numbers recorded as named constants with anchors, so that the doc check catches them drifting from code.

## Implementation Decisions

- **Scope**: reskin + re-composition. **Session** lifecycle, Tab gating, the **Transport** ↔ **Stem Player** bridge, inference engines, and one-**Playhead**/single-clock contracts are untouched.
- **Mockup precedence**: the mockup wins every style/composition question. Mockup controls with no shipped behavior are **dropped**, never rendered as decoration. Guardrail-retired affordances stay dead regardless of the mockup.
- **Chrome**: one sticky top **Tab Band** at every breakpoint — a merged block (Brand Unit row over four centered Tab chips), never a `<header>` element (`queryByRole("header")` must stay null). The desktop vertical rail column dies. No utility icons (undo/redo/gear), no engine-badge row. Active chip = solid coral pill; gated chips grayscaled with their shipped one-line reason; 44px targets and `aria-disabled` survive.
- **Mix stage order (mockup)**: spine card → **Hand Calibration** lane welded under the spine → **BPM Candidate** chips row (top + ranked with confidence, `aria-pressed` lock survives) → **Transport** as the stage's last rail, full-bleed, **Stem Player** keeps ownership → four **Stem Strips** → **Click Track** card → **Time-Stretch** card → **Pitch-Shift** card with **Formant Preservation** chip and the **Reset Pitch & Tempo** button (the only added control; honest 1.00x/0 st reset, no state or behavior beyond resetting pitch and tempo).
- **Drop list — never rendered**: undo/redo, gear, engine badge (`DSP·LATENCY·BUFFERS`), Loop toggle, Seek-to-start/⏮, fast-forward/⏭, Transport TAP button, VU "0 dB" meters, "4/4 Beat", beat-dot/BAR readout, Click-lane mute.
- **Deaths (absence-pinned)**: page-level identity footer lines, `grizzly-grid` backdrop, System-Tab grizzly header band and its two mascot faces (ids, accessible names `/grz-01/` `/grz-02/`), Grizzlython faces, uppercase DEMUXIFY lockup, dashed Separate-tab seam band.
- **Brand Unit**: coral rounded-square mark with white diamond glyph replaces the Waves icon; mixed-case bold Inter wordmark + coral status dot; mono tagline desktop-only. Existing testids (`brand-unit`, `brand-unit-status-dot`) stay resolving.
- **Title zones**: the mockup's pattern (UPPERCASE display title + tiny sans caption + bordered micro-chip) extrapolates to Separate/Export/System heads; shipped copy survives.
- **Tokens**: keep the shadcn HSL CSS-variable architecture. A new named chrome ramp (working name `st-*`) replaces the `grz` ramp in the Tailwind config; an ink scale replaces default Tailwind grays on surfaces (no surface may read the default palette); radii retuned (mockup is rounded; register in the config's radius scale). Custom coral slider thumbs (12px glowing) and slim scrollbar CSS go into the token layer. Key values from the mockup: canvas `#0e0e11` (body `#0d0d10`), panel `#141418`, surface `#18181f`, surface-light `#202028`, hairline border `#24242c`, border highlight `#32323e`; accent coral `#f85153` (hover `#ff6264`, muted wash ~15% alpha); ok status emerald ~`#34d399`; ink zinc-200 `#d1d5db`.
- **Canvas palette** (marked in the mockup, ported to the modules' color constants — math untouched): master waveform trace acid-lime → electric lime `#39ff14`; waveform box `#0a0a0d`; Playhead white with glow; **Stem Strip** waveforms Vocals `#c084fc`, Drums `#818cf8`, Bass `#f59e0b`, Other `#22d3ee`.
- **Fonts**: Inter (UI/display) + JetBrains Mono (mono), 400/500/600/700, subsetted self-hosted woff2 delivered from the app's own font directory (the Wayback precedent's folder and loader pattern stay the mechanism); the mockup's CDN `<link>`s must not be copied. The display/mono stacks in the typography module retarget to these families.
- **Suite retarget**: existing presence pins (hairline-border utilities, `/grz-01/` `/grz-02/` faces) move to the new tokens or become absence pins; font computed-style asserts become Inter/JetBrains Mono stacks; every testid keeps resolving.
- **Gates**: the retired-affordances sweep grows revival bans for the drop list and the `grz`/`grizzly`/retired-font token families. ADR-0014 records supersessions of ADR-0007 (fonts/accent), ADR-0009 (chrome placement), ADR-0013 (Mix rail order) and cites ADR-0010/0011 Amendments where the mockup contradicted them. Per the doc-anchor discipline, ADR numbers must be `NAME = <number>` anchors with named constants in code; radii stay prose pointers to code.
- **Tickets (7)**: 01 tokens/fonts/Tab Band → 02 Mix stage → 03 Separate Tab → 04 Export Tab → 05 System Tab → 06 mobile shell → 07 verification + ADR record. One commit per ticket through the pre-commit chain.

## Testing Decisions

- Good tests assert external behavior only: rendered DOM shape (classes, accessible names, states, sticky/chrome composition), pinned test identities, and computed styles — never internals of the engines or the Session.
- **Primary seam — the whole app**: the existing **Tab Shell** test file over the app (the one that already boots the four Tabs and asserts chrome composition, gating, the Mix stage's rail order, Transport behavior, class-token presence/absence, and font stacks by computed style). All Mix-stage re-composition, Tab Band chrome, token retarget, and death assertions land here, following the precedent set by the rail-hosted-chrome and grizzlython-skin increments (sticky-block asserts, dead-affordance absence pins).
- **Secondary seams — existing component tests, only where their DOM contracts change**: the **Master Waveform** and **Stem Strip** test files (canvas constants and DOM wrappers; no engine math re-asserted), the Separate/Export/Settings panel tests if their wrappers gain title-zone or chip markup, and the **Brand Unit** test for the new lockup. No behavior asserts are added to these.
- **Verification seams (gates, existing)**: `check:testids` (every presence pin must resolve at the new composition), the extended `check:retired-affordances` sweep, `check:glossary`, `check:doc-anchors`.
- **No new seams.** No new test files.

## Out of Scope

- Any behavior change whatsoever — inference, separation, **Hand Calibration** mechanics, **Tempo Detector**, **Beat Grid** anchoring, **Time-Stretch**, **Pitch-Shift**, volume gain nodes, **Session** persistence, gating, or the transport bridge (visual-only edits to those modules' rendering constants at most).
- New controls the mockup suggests but the app never had (Loop toggle, VU meters, beat-dot readouts, transport tap button, mute on the Click lane) — they are dropped by rule; anything already retired stays retired.
- Reworking the Export dialog's, diagnostics panel's, or model selector's internal layouts beyond title-zone treatment and token retarget.
- Touch targets, `aria-pressed`, `aria-disabled`, focus rings — they exist and must survive untouched; the reskin never rewrites an interaction contract.
- The audio engine, ONNX provisioning, and any file under the model directories.
- ADR-0011's derived-number discipline stays as-is: replay half of its derivation (the tracker's reference decode) is not re-run here; only the doc-anchor check guards recorded constants, and this increment changes none.

## Further Notes

- The mockup HTML and screenshots exist only in the originating conversation — no future agent can recover them. The tickets under this spec must carry the design values (hex palette, radii, stage order, drop list) so implementation can proceed without the images.
- The mockup is Tailwind-CDN + hex-arbitrary-value flavored; port every value through the config's token scales before it touches a component, per the repo's coding standards.
- `rounded-none` utility usage across the app must be swept as part of the radius retune (the zero-radius skin relied on it broadly).
- The mobile screenshot is the source for the mobile Tab Band stacking and the Mix stage's mobile order; treat it as authoritative where it and the desktop mockup disagree, same as the desktop mockup wins over prose.
- Expect the suite to stay green at each ticket commit; the two doc gates (`check:glossary`, `check:doc-anchors`) and `check:testids` fail on composition drift, so retarget the pins in the same commit as the markup move.
