# Spec: Rail-Hosted Chrome — Brand Unit in the Tab Shell, Inline Notices, Flatter Footer

Status: ready-for-agent

Recorded on the tracker 2026-11-01. Supersedes chrome claims in `docs/adr/0007-tab-shell-ui.md` (page-level header, rail-mounted toast stack, hero band) and cites the removals/re-home exception of `docs/adr/0008-four-tab-shell-and-single-toggle-transport.md`; ADR-0009 is authored with this increment. Glossary terms used throughout: **Tab Shell**, **Tab**, **Brand Unit**, **Transport**, **Stem Player**, **Master Waveform**, **Source Mix**, **Stems**, **Session**, **Export Bundle**, **Custom Mixdown**, **Model Profile**, **Model Cache**, **Inference Engine**.

## Problem Statement

The Tab Shell wears chrome that reads as generic and heavy rather than as part of the Grizzlython identity:

- On desktop the page opens with a **full-width top header** (icon box, wordmark, status dot, mono tagline) that competes with the rail for the frame and pushes the stage down.
- The Separate Tab opens on a **coral hero band** carrying the state micro-copy "IN-BROWSER · NOTHING UPLOADED" — the last wash-style banner the user wants deleted outright.
- Notices (gated-Tab refusals, export results) stack as **floating toasts** at the bottom of the rail, over the tools.
- The **footer** is a deep-red slab: a 2px red rule over a downward red gradient fade the user calls "awful".
- On mobile, the brand lockup and the four Tab chips live in two separate strips, and only one of them stays pinned while scrolling.

The user wants branding to belong to the Tab Shell itself, the banners and floating notices gone, and the page to end flat.

## Solution

Move the identity **into** the Tab Shell and remove the surfaces that competed with it.

- **Desktop (md and up)**: the page-level header dies. The **Brand Unit** — icon mark, `DEMUXIFY` display wordmark, status dot, mono tagline — sits at the head of the **Tab Rail**, flush on canvas, above the four Tab chips, which keep their widths and gating behavior. The page opens straight into rail + stage.
- **Mobile (below md)**: the header and the rail strip merge into one **sticky top block**: a brand row (icon + wordmark + status dot) over the four-chip Tab row. This is the **reduced lockup** — the tagline is desktop-rail-only, keeping the sticky block near 108px.
- **Hero band dies** at both breakpoints; the Separate Tab opens on its seam, the UPPERCASE Tab title, the peach-pipped mono meta line, and the subtitle copy (the grz-03 requirement that the heading and subtitle survive stays honored).
- **The toast surface dies**: no rail notice stack anywhere. Every notice renders **inline in the Tab panel that raised it** — gated-Tab refusal becomes a silent no-op (the chip's reason line is the whole answer), export results become an inline line or alert card in the Export Tab.
- **Footer goes flat**: one tan hairline like the rail's own dividers, two centered micro lines, zero gradient.

Visual language is unchanged — same Grizzlython ramp, same Bold typography, same tokens. No new design pass.

## User Stories

1. As a desktop user, I want no full-width page header, so the Tab Shell and its stage start at the top edge of the viewport.
2. As a desktop user, I want the Brand Unit (icon mark + `DEMUXIFY` wordmark) at the head of the Tab Rail, so the identity lives in the frame that is already carrying the tools.
3. As a desktop user, I want the 8px pulsing status dot kept beside the wordmark, so the live-state marker survives the move.
4. As a desktop user, I want the mono tagline "Client-Side Stem Separation" on its own line under the wordmark, so the identity statement stays where the identity lives.
5. As a desktop user, I want the Brand Unit flush on the canvas with no bordered card around it, so the rail chips remain the only bordered things in the rail.
6. As a desktop user, I want the rail to keep its current widths and its vertical hairline divider, so the stage geometry does not shift.
7. As a desktop user, I want air (not a rule) between the tagline and the `SEPARATE` chip, so the lockup reads as chrome, not as a fifth Tab.
8. As a mobile user, I want one top block that carries the brand row over the four Tab chips, so branding and navigation scroll as a single unit.
9. As a mobile user, I want that top block pinned while I scroll a long Separate Tab, so I can always reach the Tabs.
10. As a mobile user, I want the mobile lockup to drop the tagline, so the pinned block stays slim (~108px) and the stage gets the viewport.
11. As a mobile user, I want the four Tab chips to keep their 44px touch targets and reason lines, so the merge costs nothing to my fingers.
12. As a mobile user, I want the identity statement still available on mobile, so the System Tab carries it rather than the pinned block.
13. As any user, I want the Separate Tab to open on its UPPERCASE Tab title and mono meta line, with no coral hero band above them at any breakpoint, so the panel stops reading as a marketing banner.
14. As any user, I want the "in-browser · nothing uploaded" state copy gone from all chrome, so the app does not announce upload state where nothing asked for it.
15. As a user who taps a grayscaled Mix/Export Tab before Stems exist, I want a silent no-op, so the chip's reason line ("No Stems Yet") is the whole answer with no notice noise.
16. As an exporter, I want a single inline mono line under the Export panel confirming the Export Bundle with a peach status pip, so I get proof of success at the surface I acted on.
17. As an exporter who cancelled, I want the same inline line in tan with no pip saying nothing was written, so the cancellation is visible in the panel.
18. As an exporter whose export failed, I want the existing inline alert-card treatment in the Export Tab, so the failure is styled like every other hard failure.
19. As a screen-reader user, I want export failures to keep the alert role, so the failure is announced, not just painted red.
20. As any user, I want no floating notices stacked over the tools or in the rail, so nothing hovers over the Tab Shell.
21. As an engineer, I want the notice plumbing behind these messages to stay usable, so only the floating surface dies and the emission mechanism is untouched.
22. As any user, I want the footer to carry one tan hairline instead of a 2px red rule over a red gradient, so the page end reads like the rail dividers.
23. As any user, I want the footer's two centered micro lines kept, so the identity line and inference credit survive.
24. As a returning user, I want Session Recovery, Model Selector, Source Mix ingestion, Inference Engine, and Separation Progress untouched, so this is chrome-only.
25. As an engineer, I want the Inference Engine, Stem Player engine, mixer math, Master Waveform spine, Transport, and export encoders untouched, so no audio behavior changes.
26. As a maintainer, I want the increment recorded as tickets and an ADR that supersedes the old chrome claims, so a future reader learns why there is no desktop header and no toast surface.
27. As a maintainer, I want the glossary to name the Brand Unit and stop calling it a header, so the vocabulary matches the new chrome.
28. As an engineer, I want this chrome handled through the existing app-level test seams rather than new ones, so the surface stays AI-navigable.
29. As an engineer, I want the Bold-face typography assertions on the branding heading to still pass once the wordmark lives in the rail, so self-hosted woff2 subsets stay verified.

## Implementation Decisions

- **Surface layer (app component)**: the page-level header element is removed from the composition at md and up; the Brand Unit renders at the head of the Tab Rail. A single responsive rule governs the split — the same breakpoint the rail already uses to switch from horizontal strip to vertical column — so there is no second "desktop" breakpoint to keep in sync.
- **Brand Unit component**: keeps its existing lockup parts (icon mark in its bordered box, display wordmark heading, status dot, mono tagline) and gains a variant: rail-hosted lockup with tagline below the wordmark, and reduced lockup (tagline absent) for the mobile brand row. The heading stays the document's single top-level heading so the typography and document-outline assertions keep a stable target.
- **Tab Rail / mobile strip**: unchanged geometry — rail widths, hairline divider, chip classes, touch-target floors, and the gated reason line all stay; only the Brand Unit enters the rail above them. On mobile the brand row and the chip row become children of one sticky top block (the old rail strip was not pinned; the merged block is).
- **Toast surface component retired**: the rail-mounted notice container and the Separate Tab's toast placement die. The notice mechanism (the toast manager's emissions) stays for engine-side and test use; components stop routing through a floating surface and render their own results instead.
- **Gated Tab selection**: the refusal toast on a gated Tab click is dropped; selection stays a no-op, the grayscaled chip and its reason line remain the only feedback.
- **Export panel notices**: three new inline treatments inside the Export Tab, reusing the existing inline-alert card pattern for failures: success = mono micro line with the peach status-ok pip; cancel = same line in tan, no pip; failure = existing alert card with alert semantics. Custom Mixdown and Export Bundle success/cancel paths both route to these lines.
- **Hero strip deletion**: the Separate Tab's hero band element (desktop solid rule and mobile gradient strip) and its state micro-copy are removed from the composition and its stylesheet rules drop the responsive pair. Title zone rhythm (seam, title, meta line, subtitle) is preserved as it was ported from the run-7 artifact; no re-tuning of the title zone is in scope.
- **Footer**: inline gradient background style and the 2px warn-colored rule drop; the footer becomes a flat surface with one tan hairline (`--grz-600/40`, the token the rail chips and System band already use) and keeps its two centered micro lines. `w-full`/block constraint stays, preserving the grz-02 fix that kept narrow viewports from widening the document.
- **CSS surface**: no token or palette changes; the deep-red footer hue stays reserved for alert semantics only, which is why the footer rule moves to the tan hairline token.
- **No OpenDesign run** (deliberate exception, precedent from ADR-0008 and the grz-11–18 addendum): every change here is a removal or a re-home of existing chrome — the lockup already exists in the artifacts, the rail already exists, the notice patterns already exist. New visual language would resume the OpenDesign mandate.
- **Record**: this spec plus four implementation tickets in this feature directory (01 desktop rail Brand Unit, 02 mobile merged sticky block, 03 inline notices and toast death, 04 footer flat and hero-band death), and ADR-0009 "Rail-Hosted Chrome and Inline Notices" partially superseding ADR-0007 and citing ADR-0008.

## Testing Decisions

- A good test observes external behavior only: rendered DOM, accessible names and roles, and applied class/computed-style tokens through the testing library. Never engine internals, never the toast manager's private state.
- **Primary seam (existing, highest): the whole-app test seam** — render the app with the standard mocks (audio decode, WebGPU capability detection) plus the fake-IndexedDB Session setup, as the existing app-level describe block already does. Everything below is asserted here:
  - Brand Unit present exactly once, inside the Tab Rail region, and **no page-level header element** in the composition; the single top-level heading carries the wordmark and still resolves to the bundled display face (the existing Bold-face assertion keeps its target after the move).
  - Tagline copy present in the DOM (desktop rail form; present in DOM on the reduced lockup only as its absence — assert the brand-row variant by its structure, since the DOM seam does not evaluate media queries, following the grz-18 precedent of asserting class tokens instead).
  - Tab Rail contracts survive: four Tab entries, hairline + chrome-0 classes on every rail entry, 44px touch-target floors, gating reason line; the rail's own divider token unchanged.
  - Mobile merge contract: brand row and chip row are siblings under one sticky top block (assert sticky class token and the single nav region), no separate header region on mobile.
  - No hero-band element and no "in-browser · nothing uploaded" copy anywhere at any viewport.
  - Gated Tab click produces no notice element at all; the reason line stays.
  - Export success/cancel render the inline mono line inside the Export Tab region (status pip on success only); export failure renders the inline alert card with alert semantics.
  - Footer asserts flat tokens (1px hairline, no gradient style) and keeps its two copy lines.
- **Secondary seam (existing): the Export Dialog component seam** with its mocked encoders — update its existing notice assertions from toast-emission to inline-rendered result, keeping the cancel-path and failure-path coverage that already exists there.
- **Toast mechanism tests**: the toast manager's unit seam stays green untouched; only the DOM-surface tests shrink.
- **Prior art to imitate**: the grz-18 rail contract tests (class-token + hairline assertions on rail entries), the app-level "renders application branding and header" test (retargeted to the rail Brand Unit), the grz-13 System-Tab band tests (region-scoped chrome assertions), and the Export Dialog cancel/failure tests.
- **No new seams.** Seams stay at the existing two (app level, Export Dialog); the Brand Unit and inline notices are asserted through the app seam.

## Out of Scope

- Audio and engine behavior: Inference Engine, Model Profile selection, Model Cache, separation pipeline, Stem Player engine, mixer math, Transport, Time-Stretch/Pitch-Shift/Formant Preservation, Master Waveform spine, and WAV/MP3/ZIP export encoders.
- Session persistence schema, Session Recovery Resume flow, and the Separate Tab's Discard-as-full-purge wiring.
- System Tab diagnostics, Fallback Advisory, Model Cache status panels, and the System Tab's own band chrome.
- The Separate Tab title zone's rhythm and typography (already ported from the run-7 artifact) — only the band above it dies.
- Palette, typography, and token changes; no new OpenDesign run in this increment (exception recorded in ADR-0009).
- PWA offline packaging and the self-hosted woff2 subsets.
- Toast emission mechanism internals and the toast manager's lifecycle (only its DOM surface dies).

## Further Notes

- Decisions were reached through a grilling session whose full design tree is recorded in ADR-0009 and the updated GLOSSARY.md (**Tab Shell** hosts the **Brand Unit**; "header" and "sidebar" are retired _Avoid_ terms).
- Breakpoint authority is the rail's own existing strip/column switch, so desktop/tablet share one rule and no new breakpoint is introduced.
- The DOM test seam cannot see media queries; responsive chrome is asserted through class tokens, per the grz-18 precedent already in the repo.
- The repo's AGENTS.md mandates OpenDesign for view design; this increment is the deliberate re-home/removals exception — if a later change introduces genuinely new visual language, the mandate resumes normally.
- Watch the grz-02 lesson: any footer width unconstraint re-widens the document under ~390 CSS px; keep the block constraint when flattening.
- Toast usage is only four call sites (gated-Tab refusal, export cancel/success/failure), which is why inline treatment per owning panel is cheap and needs no new mechanism.
