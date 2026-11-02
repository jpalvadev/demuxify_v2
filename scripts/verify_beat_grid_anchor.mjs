// verify_beat_grid_anchor.mjs — replay the ADR-0011 tolerance derivation.
//
// ADR 0011 records `SNAP_TOLERANCE_SEC = 0.08 s` as a derived number, not a
// blind one: verification runs of the real Source Mix against the librosa
// anchor (scripts/check_bpm.py: 107.7 BPM / 503 beats on the 294.1 s
// reference). That librosa half replays via `python scripts/check_bpm.py`;
// this script carries the other half — the hybrid-snap repair run over the
// real Beat Grid — so a future agent can re-derive the number with one
// command: npm run verify:beat-grid-anchor
//
// Hard assertions (replayable; all must hold for PASS):
//   1. the real tracker grid: beatTrack @ the 107.7 BPM hint on the decoded
//      Source Mix — 530 beats / 529 intervals, every interval nearest to ONE
//      pulse (k = 1): the hinted grid has no double-gaps to fill.
//   2. structural repair no-op on the real hinted grid: 530 -> 530 beats,
//      nothing inserted or dropped.
//   3. the guard invariant asserted at the real-audio seam: every repaired
//      gap sits on the pulse lattice within the EXPORTED SNAP_TOLERANCE_SEC.
//   4. the tolerance ordering against measured quantities: the natural
//      body-slip band sits under the tolerance, and the defect probe (planted
//      0.31 s slip + planted skipped pulse) repairs lattice-clean with the
//      skipped beat re-inserted.
//
// Honest drift report (WARN, not FAIL): ADR-0011 also claims "all 529
// intervals within ±0.014 s of the pulse (so repair is a positional no-op)".
// That does NOT reproduce on any decoder feed (channel 0, channel 1, mono
// average — the grid is identical) nor at any sample scale: the raw hinted
// grid itself carries slips, and repair relocates them. ADR-0011 carries an
// Addendum recording this correction; this script prints the measured band
// so the claim is checkable, not trusted.
//
// Decode: the app decode needs Web Audio; tests mock it. This replay shells
// to ffmpeg (on this machine's PATH) for interleaved stereo float32 at
// 44100 Hz and takes channel 0 — the exact seam feed (`getChannelData(0)`
// into the Tempo Detector worker). The repair module itself is loaded
// verbatim: src/lib/beatGridRepair.ts is transpiled at runtime with the
// already-installed typescript package, so this script can never drift from
// the shipped code (it IS the shipped code).

import * as fs from "fs";
import { spawnSync } from "child_process";
import { join, resolve } from "path";
import { createRequire } from "module";

const require2 = createRequire(import.meta.url);

const SOURCE_MIX_FILE = join(process.cwd(), "audioslave_stone.mp3");
const EXPECTED_BYTES = 7059467; // 294.1 s reference Source Mix
const SAMPLE_RATE = 44100;
// Ground truth from scripts/check_bpm.py (librosa 1.0.0, EXPECTED_BPM):
const ANCHOR_BPM = 107.7;
const ANCHOR_BEATS = 503;
// Recorded by the 2026-11-02 verification runs (ticket 03, ADR-0011):
const RECORDED_TRACKER_INTERVALS = 529;
const RECORDED_TRACKER_BAND_SEC = 0.014; // does NOT replay — see WARN below
const RECORDED_TRACKER_BEATS = 530;
const PROBE_SLIP_SEC = 0.31;
const PROBE_SLIP_AT_SEC = 215;

function loadRepairModule() {
  const ts = require2("typescript");
  const source = fs.readFileSync(
    resolve(process.cwd(), "src", "lib", "beatGridRepair.ts"),
    "utf-8"
  );
  // {module: true} transpiles the ESM source into CommonJS-style code that
  // assigns its own exports onto the `exports` object we hand it — no string
  // surgery, so this script can never drift from the shipped module.
  const js = ts.transpile(source, { module: true });
  const factory = new Function("exports", js);
  const exports = {};
  factory(exports);
  return exports;
}

function decodeChannel0() {
  const rawPath = join(
    require2("os").tmpdir(),
    "verify_beat_grid_anchor.wav.raw"
  );
  const decode = spawnSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    SOURCE_MIX_FILE,
    "-ac",
    "2",
    "-ar",
    String(SAMPLE_RATE),
    "-f",
    "f32le",
    rawPath,
  ]);
  // this Windows/Node build reports code: undefined even on success — trust
  // error + the produced file instead.
  if (decode.error) {
    throw new Error("ffmpeg spawn failed: " + decode.error);
  }
  let wav;
  try {
    wav = fs.readFileSync(rawPath);
  } catch (err) {
    throw new Error(
      "ffmpeg decode failed: " +
        String(decode.stderr || err.message)
          .trim()
          .split("\n")[0]
    );
  } finally {
    try {
      fs.unlinkSync(rawPath);
    } catch {
      // best-effort cleanup; the decode error below is the real signal
    }
  }
  const frames = Math.floor(wav.length / 8); // 2 channels x float32
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    samples[i] = wav.readFloatLE(i * 8);
  }
  return samples;
}

async function main() {
  const fileBytes = fs.readFileSync(SOURCE_MIX_FILE).byteLength;
  console.log(
    `Source Mix: ${fileBytes} bytes (expected ${EXPECTED_BYTES}, ` +
      "the 294.1 s reference)"
  );

  const { beatTrack } = await import("@audio/beat");
  const repair = loadRepairModule();
  const samples = decodeChannel0();
  console.log(
    `decoded feed: channel 0 of the stereo decode, ${samples.length} samples ` +
      `(${(samples.length / SAMPLE_RATE).toFixed(1)} s at ${SAMPLE_RATE} Hz)`
  );

  // 1) the real tracker grid at the librosa-anchor tempo hint — same call
  //    shape as the Tempo Detector worker: beatTrack(samples, {fs, bpm}).
  const trackResult = beatTrack(samples, { fs: SAMPLE_RATE, bpm: ANCHOR_BPM });
  const beats = trackResult.beats;
  const pulse = 60 / trackResult.bpm;
  const intervals = beats.length - 1;

  let kOne = 0;
  let withinBand = 0;
  let maxOffLattice = 0;
  let leadInGapSec = 0;
  const devs = [];
  for (let i = 1; i < beats.length; i++) {
    const gap = beats[i] - beats[i - 1];
    const k = Math.max(1, Math.round(gap / pulse));
    const off = Math.abs(gap - k * pulse);
    if (k === 1) kOne++;
    if (i === 1) leadInGapSec = gap; // phase lead-in, not an inter-beat slip
    if (i > 1 && off > maxOffLattice) maxOffLattice = off;
    devs.push(off);
    if (off <= RECORDED_TRACKER_BAND_SEC) withinBand++;
  }
  const sortedDevs = devs.slice().sort((a, b) => a - b);
  const pct = (p) =>
    sortedDevs[
      Math.min(sortedDevs.length - 1, Math.floor(p * sortedDevs.length))
    ];
  console.log(
    `tracker grid @ ${trackResult.bpm.toFixed(1)} BPM: ${beats.length} beats, ` +
      `${intervals} intervals (recorded ${RECORDED_TRACKER_BEATS}/${RECORDED_TRACKER_INTERVALS}), ` +
      `pulse ${pulse.toFixed(4)} s`
  );
  console.log(
    `  every interval nearest ONE pulse: k=1 for ${kOne}/${intervals}; ` +
      "no double-gaps for repair to fill"
  );
  console.log(
    `  off-pulse deviation: p50 ${pct(0.5).toFixed(4)} s / p90 ${pct(0.9).toFixed(4)} s / ` +
      `p95 ${pct(0.95).toFixed(4)} s / max ${maxOffLattice.toFixed(4)} s (body), ` +
      `lead-in gap ${leadInGapSec.toFixed(4)} s — body slips stay under the ` +
      `${repair.SNAP_TOLERANCE_SEC} s tolerance`
  );
  if (withinBand !== intervals) {
    // Honest drift note: ADR-0011 recorded "ALL intervals within ±0.014 s"
    // (ticket 03 line, ADR Consequences clause). It does not reproduce on
    // any feed or scale — the raw hinted grid carries slips, and repair
    // relocates them. The ADR Addendum records the corrected band.
    console.warn(
      `WARN (drift, not fatal): ${withinBand}/${intervals} intervals within ` +
        `±${RECORDED_TRACKER_BAND_SEC} s; the recorded "all within ±${RECORDED_TRACKER_BAND_SEC} s" ` +
        "does not replay — see ADR-0011 Addendum; tolerance ordering still decides the PASS"
    );
  }

  // 2) repair on the real grid: structural no-op (nothing inserted/dropped)
  //    plus the seam guard with the EXPORTED constant.
  const repaired = repair.repairBeatGrid(beats, trackResult.bpm);
  const structuralNoOp = repaired.length === beats.length;
  let worstMoveSec = 0;
  if (structuralNoOp) {
    for (let i = 0; i < beats.length; i++) {
      const move = Math.abs(repaired[i] - beats[i]);
      if (move > worstMoveSec) worstMoveSec = move;
    }
  }
  let worstRepairedOffLattice = 0;
  for (let i = 1; i < repaired.length; i++) {
    const gap = repaired[i] - repaired[i - 1];
    const k = Math.max(1, Math.round(gap / pulse));
    worstRepairedOffLattice = Math.max(
      worstRepairedOffLattice,
      Math.abs(gap - k * pulse)
    );
  }
  console.log(
    `repair on the real grid: ${beats.length} -> ${repaired.length} beats ` +
      (structuralNoOp
        ? `(structural no-op: nothing inserted/dropped; beats relocated up to ${worstMoveSec.toFixed(4)} s)`
        : "NOT structural no-op — unexpected structural change") +
      `; worst repaired gap off lattice ${worstRepairedOffLattice.toFixed(4)} s ` +
      `<= ${repair.SNAP_TOLERANCE_SEC} s (the seam guard, same exported constant)`
  );

  // 3) defect probe: plant a 0.31 s slip (beyond tolerance) and skip one
  //    later pulse — both repair branches (relocate, fill) must fire.
  const planted = Array.from(beats);
  let slipped = false;
  let skipped = false;
  for (let i = 0; i < planted.length; i++) {
    if (!slipped && planted[i] >= PROBE_SLIP_AT_SEC) {
      planted[i] += PROBE_SLIP_SEC;
      slipped = true;
    } else if (slipped && !skipped && planted[i] >= PROBE_SLIP_AT_SEC + 9) {
      planted.splice(i, 1);
      skipped = true;
    }
  }
  const probeRaw = Float64Array.from(planted);
  const repairedProbe = repair.repairBeatGrid(probeRaw, trackResult.bpm);
  let probeWorst = 0;
  for (let i = 1; i < repairedProbe.length; i++) {
    const gap = repairedProbe[i] - repairedProbe[i - 1];
    const k = Math.max(1, Math.round(gap / pulse));
    probeWorst = Math.max(probeWorst, Math.abs(gap - k * pulse));
  }
  console.log(
    `defect probe (planted ${PROBE_SLIP_SEC} s slip @ ~${PROBE_SLIP_AT_SEC} s + ` +
      `planted skipped pulse): ${planted.length} beats -> ${repairedProbe.length} ` +
      `(skipped beat ${repairedProbe.length > planted.length ? "re-inserted" : "NOT re-inserted"}); ` +
      `worst repaired gap off lattice ${probeWorst.toFixed(4)} s`
  );

  // Tolerance ordering on MEASURED quantities: natural body slips under the
  // tolerance, planted 0.31 s slip above it, probe repaired within it.
  const toleranceSec = repair.SNAP_TOLERANCE_SEC;
  const claimsOk =
    fileBytes === EXPECTED_BYTES &&
    beats.length === RECORDED_TRACKER_BEATS &&
    intervals === RECORDED_TRACKER_INTERVALS &&
    kOne === intervals &&
    structuralNoOp &&
    maxOffLattice < toleranceSec &&
    PROBE_SLIP_SEC > toleranceSec &&
    repairedProbe.length === planted.length + 1 &&
    worstRepairedOffLattice <= toleranceSec + 1e-9 &&
    probeWorst <= toleranceSec + 1e-9;
  console.log(
    claimsOk
      ? `PASS: the ADR-0011 tolerance ordering replays — ${toleranceSec} s sits ` +
          `above the measured natural band (max body slip ${maxOffLattice.toFixed(4)} s, ` +
          `lead-in ${leadInGapSec.toFixed(4)} s) and below the planted ${PROBE_SLIP_SEC} s slip, ` +
          "with repair guarding every repaired gap on the pulse lattice. " +
          "The librosa anchor half replays via python scripts/check_bpm.py."
      : "FAIL: a replayable claim no longer holds (see lines above)"
  );
  process.exit(claimsOk ? 0 : 1);
}

await main();
