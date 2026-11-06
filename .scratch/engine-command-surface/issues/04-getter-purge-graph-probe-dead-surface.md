# 04: The getter purge — one graph probe, `getStemBuffer` dies, dead surface deleted, engine suite fully retargeted

**What to build:** The wall of getters comes down. One named **graph probe** — the single accessor handing
out the node bundle (master and per-Stem gains, click gain, analysers/taps, active sources, stretch adapter)
— becomes the observicals' home at both the engine seam and the component seam (`StemPlayer.test.tsx:862`
asserts live gain-node outcomes today). Every other getter leaves the interface: `getLevelTapNodes`,
`getStretchMode`, `getAudioContext`, `getAnalyserNode`, `getMasterGainNode`, `getStemGainNode`,
`getClickGainNode`, `getActiveSources`, `getStretchAdapter`, `getStemState`, `getBeatGrid`, `getTimeStretch`,
`getLevels`, `isUsingWorklet`, and the public `setStemVolume`/`setStemMute`/`setStemSolo`/`setTempo`/`setPitch`
setter pairs. `getStemBuffer` dies and the **Stem Player** derives each **Stem Strip**'s waveform peaks from
its own `stems` prop (the peaks reader is duck-typed on `AudioBufferLike` and `StemStrip` already accepts a
ready `peaks` prop — compute once per Stem at mount, peak values byte-identical). Dead and zero-consumer
surface is deleted, not left public — including the zero-importer backwards-compatibility re-export file
`src/components/StemTrack.tsx`, whose `IGNORED_FILES` exemption in `scripts/check-glossary.mjs` is deleted **in
the same commit** so the ban on "Track" for Stems stops carrying a live exception. The engine suite is fully
retargeted: commands in, Mixer State out, probe for observicals.

**Blocked by:** 01, 02, 03 (all verbs live, so nothing left on the interface has a consumer below).

**Status:** ready-for-agent

- [ ] Graph probe minted on the engine's public surface (one named accessor, node bundle: master/stem
      gains, click gain, analysers, active sources, stretch adapter) — the interface's only node exposure
- [ ] All fifteen node/state getters above leave the public interface (private internals untouched);
      `check:doc-anchors` green — retired names cited on historical-skip lines only where an ADR names them
- [ ] `getStemBuffer` deleted; `StemPlayer` derives per-Stem `peaks` from its `stems` prop via
      `computeWaveformPeaks` (memoized, once per Stem at mount); waveform paint, peak values, and the
      pinned Strip behavior byte-identical; `StemStrip.test.tsx` green untouched
- [ ] `getStretchAdapter` deleted; `stemPlayerSignalsmith.test.ts` (3) retargeted onto the probe in THIS
      commit (the ticket-02 deferral lands here); `mobileLightweightEndToEnd.test.ts` re-verified on the
      probe if it touches the adapter
- [ ] `stemPlayerEngine.test.ts` (42) fully retargeted: every test crosses commands in / snapshot out,
      ADR-0012 press-sequence observicals assert gain on live gain nodes **through the probe** — same
      numbers byte-identical
- [ ] `StemTrack.tsx` deleted (zero importers, backwards-compatibility alias re-export) + its
      `IGNORED_FILES` entry deleted in the same commit; `check:glossary` green with no exemption
- [ ] Zero-consumer deletions verified by grep before removal (`getLevelTapNodes`, `getStretchMode` have
      zero consumers repo-wide; `getAudioContext`'s apparent hits are `audioDecoder.ts`'s own local function)
- [ ] Parity guards green untouched: `StemPlayer.test.tsx` (21), `stemPlayerTimeStretch.test.tsx` (9),
      `App.test.tsx` (60), `transportBridge.test.ts` (11), `StemStrip.test.tsx`, `MasterWaveform.test.tsx`,
      `sessionStore.test.ts`
- [ ] `check:testids`: every existing pin resolves, zero new ids; class-token pins retargeted only if a
      Strip markup fact moved (it must not)
- [ ] Gates green (full chain, dist rebuilt); no view designed — record: "no new look rendered; skin
      byte-untouched"

## Comments

- (agent, at authoring): Q4(a) + Q14 settled here. The probe is the ONE named exception to "no getter
  hands out a live node" — ADR-0016 records it. `setStemSolo`/`setStemMute` stay reachable as **private**
  methods (Q6): the public verbs vanish, the enforcement names survive, ADR-0012 reads clean without a
  historical line.
