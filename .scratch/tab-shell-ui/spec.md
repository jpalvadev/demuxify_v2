# Spec: Tab Shell UI Redesign (Bold Identity)

Status: ready-for-agent

## Problem Statement

The app currently presents itself as a long vertical scroll of stacked cards: the tools (Model Selector, Source Mix ingestion, playback, mixing, export, diagnostics) have no obvious homes, tool position feels unintuitive, and configuring an Export opens a full-screen modal that hides the Stem Player. The visual identity is the stock shadcn dark theme, which reads as "AI-made" and generic. Users want a real application with a unique, bold look, tools grouped into persistent tabs instead of a modal-riddled scroll, and less floating clutter.

## Solution

Rebuild the interface as a persistent **Tab Shell** with exactly five always-present **Tabs** — **Separate**, **Listen**, **Mix**, **Export**, **System** — organized by a left vertical rail on desktop and a horizontal top strip on mobile portrait. Nothing opens as a modal or floating overlay. The visual identity moves to the **Bold** design system (heavyweight display type, high-contrast, commanding layout) on a near-black dark-only canvas with a single acid-lime accent, a re-harmonized high-contrast quartet of Stem hues, and self-hosted subset woff2 fonts bundled into the PWA. The design is generated in OpenDesign (Bold design-system plugin from the bundled catalog) and then ported onto the existing shadcn HSL CSS-variable token architecture, leaving the engine, persistence, and export pipelines untouched.

## User Stories

1. As a Demuxify user, I want the app to open in a Tab Shell with five pinned Tabs (Separate, Listen, Mix, Export, System), so that every tool has an obvious, permanent home.
2. As a desktop user, I want the Tab rail to run vertically on the left, so that switching between tools never scrolls a page.
3. As a mobile portrait user, I want the same five Tabs as a horizontal top strip (System last), so that I never lose a tool on a small screen.
4. As a returning user with no Source Mix loaded, I want Listen, Mix, and Export to remain pinned but greyed-out with a one-line reason ("no Stems yet"), so that I understand the app's state without opening anything.
5. As a user starting a separation, I want the active Tab to default to Separate, so that the Model Selector, dropzone, and Inference Engine flow are where my attention is.
6. As a user whose separation just completed, I want the active Tab to move automatically to Listen, so that playback is ready without hunting for it.
7. As a producer scrubbing a timeline, I want a shared Master Waveform spine that persists across the Listen and Mix Tabs at the identical playhead position, so that switching tools resumes exactly where I left off.
8. As a listener, I want the Master Waveform spine hidden in Separate, Export, and System, so that each Tab shows only the tools relevant to it.
9. As a player user, I want dedicated Play and Pause buttons (plus seek-to-start and a mono time readout) in a proper Transport row, so that playback control reads like a real app, not a single toggle pill.
10. As a keyboard user, I want the spacebar play/pause toggle and arrow-key seek hotkeys to keep working in the new shell, so that my muscle memory survives the redesign.
11. As a mixer, I want the four Stem strips with mute/solo buttons and volume sliders, plus the Time-Stretch, Pitch-Shift, and Formant Preservation panel, grouped in the Mix Tab, so that all mixing tools live together.
12. As an exporting user, I want the Export Tab to show Export Mode (Single Stem / Export Bundle / Custom Mixdown), format options, and Custom Mixdown presets inline and permanently, so that I can configure an Export Bundle without any modal.
13. As an exporting user, I want export progress, results, and the anti-clipping option rendered inside the Export Tab panel itself, so that configuring an export never hides what I am working with.
14. As a user, I want no full-screen overlays anywhere in the app, so that nothing I open erases the rest of the interface.
15. As a user checking hardware state, I want the WebGPU status badge, Fallback Advisory, and Model Cache status in the System Tab, so that technical status is out of the way of the work but always inspectable.
16. As a developer debugging in the field, I want Diagnostics (Logs/Device views, level filters, clear-and-copy report) as an inline panel of the System Tab instead of a floating pill and full-screen modal, so that logs behave like a normal tool.
17. As a user, I want Toast notifications stacked as slim notices at the bottom of the rail instead of floating over content, so that notifications stop obscuring tools.
18. As a returning user, I want Session Recovery ("previous session found") to appear at the top of the Separate Tab, so that resuming is part of the file workflow.
19. As a user, I want a unique, bold identity: near-black dark-only surfaces, one acid-lime signature accent, and heavyweight display typography for headings, so that the app stops looking like a generic AI-generated template.
20. As a returning user with a previous Session, I want Session Recovery ("previous session found") at the top of the Separate Tab, so that resuming belongs to the file workflow rather than floating mid-scroll.
21. As a user of the separated Stems, I want a distinct hue for each of my Stems (Vocals, Drums, Bass, Other) drawn from a retuned high-contrast quartet harmonized with the new palette, so that I can tell Stems apart at a glance in waveforms and chips.
22. As a time-readout reader, I want time values and transport readouts set in a strong mono face, so that numbers stay legible on the near-black canvas.
23. As an offline PWA user, I want the custom fonts bundled as self-hosted, subset woff2 files, so that the bold identity works with zero network access.
24. As a user, I want a dark-only app with no theme toggle, so that there is one strong identity and less settings clutter.
25. As a touch-screen user, I want every Tab, Transport button, and control to keep 44x44px minimum touch targets, so that the redesign stays usable on phones and tablets.
26. As a keyboard/screen-reader user, I want the Tab rail, the Tabs, and the Transport controls to carry accessible names and keyboard focus management, so that the new shell is navigable without a pointer.
27. As a developer porting the design, I want the new skin to sit on the existing shadcn-style HSL CSS-variable token architecture, so that tests, Tailwind config, and component plumbing keep working with zero new installs.
28. As an agent maintaining the UI tests, I want tab gating, active-Tab focus, shared spine position, and the absence of modal overlays all assertable from the existing App-level vitest seam, so that the shell's behavior is testable in one place.

## Implementation Decisions

- **Shell architecture**: the App UI shell component is rebuilt from a single-column card flow into a Tab Shell. A tab registry (id, title, panel, enabled-for state) drives both desktop left rail and mobile top strip from one component; breakpoints switch rail orientation.
- **Canonical Tab vocabulary**: Separate, Listen, Mix, Export, System — as defined in `GLOSSARY.md`. "Workspace", "menu", "dashboard" are avoided per the glossary.
- **State gating**: the existing separation-phase state machine (idle / decoding / model download / inference / complete) additionally yields `activeTab` (default Separate; auto-switch to Listen on complete) and an enabled mask: Listen, Mix, Export greyed with a one-line reason until Stems exist. All five Tabs stay in the DOM always.
- **Shared spine**: a single Master Waveform component instance is promoted to the shell, rendered for Listen and Mix with one shared playhead; hidden in Separate/Export/System. Existing scrubbing and keyboard-seek behavior (spacebar, arrows, Shift, Home/End) moves with it.
- **Export Tab**: the ExportDialog component is reshaped from a full-screen modal (`fixed inset-0`, `aria-modal`) into an always-visible panel of the Export Tab. Same content model (Export Mode radio group, Pitch & Tempo checkbox, stem picker, Custom Mixdown presets and per-Stem volumes, WAV bit-depth / MP3 bitrate selects, progress, success/error banners, Close + Export & Download actions). The export encoding pipeline (wav/mp3 encoders, worker, bundle, mixdown lib) is untouched.
- **System Tab**: WebGPU status badge, Fallback Advisory, Model Cache status, and the Diagnostics content (Logs/Device tabs, level filters, clear/copy report) become inline System panels; the floating pill trigger and full-screen overlay of the Diagnostics Overlay component are deleted.
- **Toasts**: the Toast container is re-parented from fixed bottom-right to a stack at the rail bottom (rail end, both orientations). Toast content model unchanged.
- **Stem Player Transport**: Play/Pause becomes two dedicated buttons plus seek-to-start and mono time readout; the engine (stemPlayerEngine) keeps its interface.
- **Theme**: dark-only; the header theme-toggle button and the `.light` CSS-variable overrides are removed; the PWA manifest background/theme colors are retuned to the new near-black canvas.
- **Design system**: Bold (from the OpenDesign bundled catalog) as the base skin, generated once in an OpenDesign project and ported: retuned HSL values in the existing token file, radius/shadow/type scale changes, one acid-lime accent variable, heavyweight display type in headings and section banners. No external MCP plugins installed.
- **Fonts**: two self-hosted woff2 families (bold condensed display face for headings/branding, strong mono for readouts), subset and bundled as PWA assets with `@font-face`; no CDN references (offline-first constraint stands).
- **Stem palette**: the per-Stem hues (vocals/drums/bass/other constants in the player components and waveform canvases) are retuned as a high-contrast quartet over near-black; the four-identity mapping is unchanged.
- **Header**: slimmed to branding + minimal state dot; the "Private & Offline" pill and status badges relocate into System. Footer branding retuned to the Bold identity.
- **Unchanged**: engine libs, workers, persistence (IndexedDB/OPFS per ADR-0003), export DSP, model provisioning, WebGPU detection, Session semantics. ADR-0007 records the shell decision and partially supersedes the UI half of ADR-0003.

## Testing Decisions

- Good tests assert external behavior only: rendered DOM/screen text, roles, and visibility at the component boundary — never internal state or style internals beyond user-visible class/role presence.
- Primary seam: the existing App-level vitest + @testing-library/react jsdom tests (css: true), which already render the whole shell with the audio-decoder, WebGPU-detection, and Inference Client module mocks. New asserts there: five-Tab rail in DOM, gating mask ("no Stems yet") before separation, active-Tab focus Separate→Listen transition, Export Tab panel inline (no `role=dialog`/`aria-modal` anywhere), System panel present, no fixed overlay containers rendered.
- Secondary (existing) seams, updated in place: the StemPlayer test gains dedicated Play/Pause button assertions; the ExportDialog test migrates to the Export Tab panel; the DiagnosticsOverlay test migrates to the System panel; Header loses the theme-toggle assertions; ToastContainer assertions move to the rail stack.
- No new test seams: the shell is verified at the App level (ideal single seam), component-level coverage reuses the existing per-component test files.

## Out of Scope

- Any change to separation quality, chunking, overlap logic, model provisioning, or the Model Profiles decision (ADR-0005).
- Changes to export encoding, bundling, mixdown DSP, anti-clipping behavior, or Session persistence semantics (ADR-0006, ADR-0004, ADR-0003 persistence halves).
- New keyboard shortcuts beyond preserving the existing hotkeys; tab keyboard navigation only needs accessible names/focus, not a new scheme.
- New product features (e.g., more export formats, marker tools, multi-file sessions).
- Native/desktop packaging — this stays a PWA.
- Installing third-party MCP servers or design plugins beyond the bundled OpenDesign catalog.

## Further Notes

- Workflow agreed with the user: OpenDesign (Bold design-system plugin) generates the redesigned shell in a new project; the result is then ported into the existing React components. OpenDesign's own runs may take 5-30 minutes.
- **Mandatory design rule:** every view or look in this feature is designed through the OpenDesign MCP — no hand-designing UI or layout in code. Each ticket ports an OpenDesign artifact; if no artifact covers a ticket's view, that ticket must run OpenDesign first.
- Environment constraint (AGENTS.md): no subagents on this machine (memory limits); work in the main checkout.
- Vocabulary in this spec uses `GLOSSARY.md` canonical terms (Tab Shell, Tab, Transport); those three entries were added during the design session and ADR-0007 written as they crystallized.
