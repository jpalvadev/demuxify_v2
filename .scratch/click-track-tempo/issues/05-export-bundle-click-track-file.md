# 05: Export Bundle carries the Click Track as its own file

**What to build:** When the Click Track is enabled, the Export Bundle gains one separate Click Track file (WAV or MP3, matching the chosen Stems export format) — droppable on its own DAW lane. When disabled, the bundle is unchanged, and no Custom Mixdown preset ever contains clicks.

**Blocked by:** 04 (Click Track lane in the Stem Player — rail, synthesized clicks, Meter, stretch lock).

**Status:** closed

- [x] Export seam extended: `CreateStemBundleOptions` gains `clickTrack?: Uint8Array | Blob`; when provided, `createStemBundleZip` adds exactly one extra member named via the new `formatClickTrackFileName` (`<Title>_click_track.<ext>`, never a StemName). The Export Bundle seam decodes it back: unzipped WAV data chunk → Int16 LE onsets land 1:1 on the Beat Grid (within 3 samples), median interval 0.557 s at the 107.7 BPM anchor (±10%), and under a Time-Stretch factor 2 the clicks arrive doubled (÷stretch scaling verified at the seam).
- [x] Disabled Click Track: bundle contents as before — bundle member count 4 with zero `/click/` names, and the pre-existing bundle tests stay green unmodified.
- [x] Format follows the Stems' export choice via the existing encoders: WAV bundle → click WAV (`encodeWav`), MP3 bundle → click MP3 (`encodeMp3`, same worker/client fallback); no new encoding path.
- [x] Custom Mixdown presets never sum the Click Track: the mixdown branch renders Stems only through `mixAudioStems` (anti-clipping math untouched, existing `customMixdown` tests green), and the click bytes are handed only to the bundle-mode `createStemBundleZip` options — the Stems set and the manifest contract never see them.
- [x] Mixdown preset picker and dialog gain no Click Track affordance at all: the dialog only accepts passive `clickTrackBeatGrid` + `clickTrackSettings` props; the UI seam asserts zero text/role matches for /click track/ (even with the lane live) and the preset picker stays Karaoke / Acapella / Minus Drums / Reset — per ADR 0010 the concept stays out of mixdowns.
- [x] Session persistence (D8): `clickTrack?: ClickTrackMixerState` is a sibling optional field on `DemuxifySession` / `StoredSessionRecord` — parallel to, not part of, the mixer contract; save copies it field-wise, load gates it through `isValidClickTrack` (malformed/legacy records → `undefined`, rail resumes off by default). `App` saves the live rail via `clickTrackStateRef` (mirrored on `handleMixerChange`) and the resume seam restores it: a Session saved with the rail ON + Meter 6/8 resumes `aria-checked="true"` + "Meter 6/8".

## Comments

- Design source: **no OpenDesign run needed** — this ticket is export/persistence plumbing with ZERO new UI (the dialog's Click Track inputs are passive props, and the "no affordance" box proves it); the only visible surface is the ticket-04 rail, already recorded there as agent-authored.
- The bundle member is added only when the payload is present: ExportDialog omits `clickTrack` when the lane is off/absent, so the byte-for-byte contract holds at both the bundle seam and the dialog seam.
- Stretch scaling lives at the Export seam, not in the encoder: `clickGrid = beatGrid / stretchFactor` when active Time-Stretch adjustments are applied to the Stems, so exported clicks align with the stretched Stems when dropped into a DAW.
- `encodeWav` reuse: its dual signature `(channels, options|sampleRate, bitDepth?)` lets the click file take the exact `bitDepth`/`bitrate` options the Stems already chose.
- Tests added: `bundleZip.test.ts` +3 (naming, one-member-present byte identity, disabled-unchanged), `sessionStore.test.ts` +1 (round-trip + legacy undefined), `ExportDialog.test.tsx` +4 (WAV/MP3 live-lane bundles, off-lane unchanged, zero affordance), `realAudioMix.test.ts` +1 (decode-the-bundle check incl. ÷stretch), `App.test.tsx` resume it() extended (rail resumes ON + Meter 6/8).
