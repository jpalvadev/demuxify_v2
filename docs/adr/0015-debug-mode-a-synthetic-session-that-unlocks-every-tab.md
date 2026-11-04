# Debug Mode: a Synthetic Session that Unlocks Every Tab

Extends [ADR-0003](./0003-indexeddb-session-and-shadcn-ui.md) (the Session slot: Debug mode never touches it) and [ADR-0013](./0013-mix-tab-cohesion-and-the-single-playhead-readout.md) (the Mix stage it unlocks: every contract there runs on the fixture unchanged). Recorded 2026-11-04 as the answer to the Stitch Skin increment's blocker: the no-session boot gates the Mix and Export Tabs, so the fidelity loop could never SEE the compositions it was porting.

## Decision

**`#debug` in the URL boots a SYNTHETIC session fixture (`src/lib/debugSession.ts`) so every Tab — Mix, Export — renders its full composition at once; the flag is a preview and screenshot channel, not a fake product surface.**

The fixture is deterministic (a fixed-seed generator, so the same URL always paints the same waveform): a ~4.8 min two-channel Source Mix of `DEBUG_SESSION_DURATION_SEC = 287.4` s at `DEBUG_SESSION_SAMPLE_RATE = 44100` Hz, a `DEBUG_SESSION_PEAK_BINS = 600` waveform, four Stems of `DEBUG_SESSION_STEM_SAMPLES = 24000` samples each, and a ranked Tempo Detector reading at `DEBUG_SESSION_ANALYZED_BPM = 107.7` with a Beat Grid and the playhead at `DEBUG_SESSION_PLAYHEAD_SEC = 93.2`. It flows through the ordinary state defaults of the App component — the real UI code paths paint it; nothing in the fixture is rendered by special-cased markup.

The flag is HONEST chrome while it is on: the Tab Band carries a coral mono marker, "Debug · synthetic media", so a preview can never be mistaken for a real upload. And the auto-saver is swapped for a silent stand-in while the flag is on: the fixture never writes the IndexedDB Session slot, so a debug pass cannot poison what Session Recovery resumes from. A real restored session still wins over the fixture: the resume pass overwrites the state defaults as it always has.

## Why these trades

**Why a committed mode instead of a screenshot-time seed:** the fidelity loop needed the Mix/Export compositions visible at capture time, and a temporary uncommitted seed hack broke twice (setState-in-render loop, restored-file races) while never being reviewable. A committed, URL-gated feature is honest about itself, survives across sessions, and doubles as the verification channel: `scripts/shot-mix.mjs` clicks the MIX chip at `#debug` and screenshots the real composition.

**Why synthetic media rather than a fixture Session:** the fixture fabricates media shapes (decoded buffer, peaks, Stem channels, Tempo reading), never a `DemuxifySession` — with the auto-saver disarmed, there is no write path to the Session slot at all. Fabricating a Session would blur the one contract this mode exists to bypass (media) with the one it must not (persistence).

**Why a URL flag rather than a UI toggle:** a toggle is a shipped affordance and the spec says a fake preview surface must not exist as product chrome; a URL fragment only exists in dev/screenshot hands, never in the Band's live controls. `isDebugModeRequested()` reads the location hash/search only when a `location` exists, so non-browser boots (the whole test suite) are never in debug and keep the no-session boot intact — every shipped assertion still runs unflagged.

## Considered Options

- Temporary uncommitted seed block for screenshots only (rejected: unreviewable, broke twice, and the user's ask — "implement a debug mode" — wants a real feature).
- A shipped hidden dev flag in the Diagnostics Panel (rejected: product chrome for a preview; the URL fragment costs nothing at the a11y or gate level).
- Letting the fixture persist through the auto-saver (rejected: poisoning the resume slot is the exact failure this mode must never make).
- Wiring debug to real separation passes (rejected: screenshot determinism needs a fixed-seed fixture; a real pass races capture).

## Hard to Reverse

`debugSession.ts`'s anchors are the fixture's shape: the ADR's numbers and the named consts cannot drift apart (`check:doc-anchors` gates the pair). The Band's "Debug · synthetic media" marker and the disarmed auto-saver ternary in App.tsx are the mode's honesty contract: removing either makes the preview indistinguishable from a real session or debug-capable of writing the Session slot. The unflagged boot must stay byte-identical in behavior — the whole test suite and the shipped gating (no Stems yet) run with the flag off.

## Supersede

Supersedes nothing: it adds a preview channel next to the shipped gating (ADR-0008's Tab gating stays the product's rule), and the fixture only feeds the state defaults ADR-0003's Session flow already overwrites on resume.
