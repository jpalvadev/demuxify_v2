// Debug mode (ticket 08, user 2026-11-04): appending `#debug` to the URL boots
// a SYNTHETIC session — fake waveform, fake Stems, a ranked Tempo Detector
// reading — so every Tab (Mix, Export) renders its full composition without
// waiting for a real upload + WebGPU separation pass. It is a preview and
// screenshot channel for the composition, not a fake product surface: the media
// is labelled synthetic in the Band, and the flag never fabricates a Session —
// the auto-saver is disarmed while it is on, so debug can never poison the
// IndexedDB slot a later boot resumes from. A real restored session still wins:
// the resume pass overwrites these state defaults as it always has.
import { StemName } from "./chunkOverlapAdd";
import { WaveformPeaks } from "./waveformPeaks";
import { DecodedSourceMix, SourceMixMetadata } from "./audioDecoder";
import { TempoAnalysisResult } from "./beatClient";
import type { TempoCandidate } from "../workers/beatDetection.worker";

// Anchor discipline (ADR-0015): every number a doc records is a named const
// here. Debug shape: a ~4.8 min Source Mix at 107.7 BPM, playhead 1/3 in.
const DEBUG_SESSION_DURATION_SEC = 287.4;
const DEBUG_SESSION_SAMPLE_RATE = 44100;
const DEBUG_SESSION_ANALYZED_BPM = 107.7;
const DEBUG_SESSION_PLAYHEAD_SEC = 93.2;
const DEBUG_SESSION_PEAK_BINS = 600;
const DEBUG_SESSION_STEM_SAMPLES = 24000;

export function isDebugModeRequested(): boolean {
  try {
    const loc = (
      globalThis as { location?: { hash?: string; search?: string } }
    ).location;
    if (!loc) return false;
    const hash = (loc.hash ?? "").toLowerCase();
    const search = (loc.search ?? "").toLowerCase();
    return hash.includes("debug") || search.includes("debug");
  } catch {
    return false;
  }
}

export interface DebugSessionFixture {
  decodedSourceMix: DecodedSourceMix;
  waveformPeaks: WaveformPeaks;
  separatedStems: Record<StemName, Float32Array[]>;
  tempoAnalysis: TempoAnalysisResult;
  currentTime: number;
}

// Deterministic mulberry32: the same #debug URL always paints the same
// waveform, so the screenshot channel is reproducible across runs.
export function createDebugSessionFixture(): DebugSessionFixture {
  let seed = 0x6d2b79f5;
  const rnd = () => {
    seed = (seed * 1663247515 + 1) % 4294967296;
    return seed / 4294967296;
  };

  // The mockup's OWN waveform recipe (view_target/stitch.html: drawDetailedAudio
  // Waveform + renderAllWaveforms). #debug media follows it verbatim — seeded
  // pseudo-Rand per canvas, the song-shape envelope (intro taper, verse and
  // chorus bumps, outro fade) and the mirrored amplitude capped at 92% of the
  // half-height — so the screenshot channel compares the app against the
  // TARGET's shapes, not a sine placeholder.
  const mockupRand = (canvasSeed: number) => {
    let s = canvasSeed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  };
  const mockupEnvelopeAt = (progress: number) => {
    let envelope = Math.sin(progress * Math.PI) * 0.75;
    if (progress > 0.15 && progress < 0.45) envelope += 0.25;
    if (progress > 0.55 && progress < 0.85) envelope += 0.35;
    if (progress > 0.88) envelope *= Math.max(0, 1 - (progress - 0.88) / 0.12);
    return envelope;
  };
  const mockupAmplitudes = (
    bins: number,
    canvasSeed: number,
    density: number
  ) => {
    const rand = mockupRand(canvasSeed);
    const amps = new Float32Array(bins);
    for (let bin = 0; bin < bins; bin += 1) {
      const noise = (rand() * 0.7 + 0.3) * density;
      amps[bin] = Math.min(0.92, mockupEnvelopeAt(bin / bins) * noise);
    }
    return amps;
  };

  // Master: the mockup's lime trace is seed 101 at density 1.15
  const min = new Float32Array(DEBUG_SESSION_PEAK_BINS);
  const max = new Float32Array(DEBUG_SESSION_PEAK_BINS);
  const masterAmps = mockupAmplitudes(DEBUG_SESSION_PEAK_BINS, 101, 1.15);
  for (let bin = 0; bin < DEBUG_SESSION_PEAK_BINS; bin += 1) {
    min[bin] = -masterAmps[bin];
    max[bin] = masterAmps[bin];
  }

  // Samples are what the engine decodes; the strips' peaks are recomputed
  // from them, so the per-bin samples must reach the bin's amp at both ends
  const samplesPerBin = DEBUG_SESSION_STEM_SAMPLES / DEBUG_SESSION_PEAK_BINS;
  const fillSamples = (
    samples: Float32Array,
    amps: Float32Array,
    scale: number
  ) => {
    let signed = 1;
    for (let bin = 0; bin < amps.length; bin += 1) {
      const from = Math.floor(bin * samplesPerBin);
      const to = Math.floor((bin + 1) * samplesPerBin);
      for (let i = from; i < to; i += 1) {
        // Alternate sign and keep the magnitude high so the bin's max/min
        // reach the mockup's amp (the strip re-bins these samples, and a
        // sparse ±rand*amp spread would paint thin bars instead of the
        // target's dense mirrored fill).
        signed = -signed;
        samples[i] = signed * amps[bin] * (0.62 + rnd() * 0.36) * scale;
      }
    }
  };

  const mixSamples = new Float32Array(DEBUG_SESSION_STEM_SAMPLES);
  fillSamples(mixSamples, masterAmps, 0.9);
  // A structural stand-in for a decoded AudioBuffer (same shape the App
  // fixtures hand to the engine: numberOfChannels/length/sampleRate/
  // duration/getChannelData); the real class only exists inside an AudioContext.
  const mixBuffer = {
    numberOfChannels: 2,
    length: DEBUG_SESSION_STEM_SAMPLES,
    sampleRate: DEBUG_SESSION_SAMPLE_RATE,
    duration: DEBUG_SESSION_DURATION_SEC,
    getChannelData: () => mixSamples,
  } as unknown as AudioBuffer;

  // Per-stem channels keep the mockup's OWN seed and density per canvas
  // (renderAllWaveforms: vocals 202/0.85, drums 303/1.0, bass 404/0.75,
  // other 505/0.95), so each row is shaped like its target row.
  const stemChannel = (canvasSeed: number, density: number) => {
    const channel = new Float32Array(DEBUG_SESSION_STEM_SAMPLES);
    fillSamples(
      channel,
      mockupAmplitudes(DEBUG_SESSION_PEAK_BINS, canvasSeed, density),
      0.95
    );
    return [channel, channel];
  };
  const separatedStems: Record<StemName, Float32Array[]> = {
    vocals: stemChannel(202, 0.85),
    drums: stemChannel(303, 1.0),
    bass: stemChannel(404, 0.75),
    other: stemChannel(505, 0.95),
  };

  const stepSec = 60 / DEBUG_SESSION_ANALYZED_BPM;
  const beatCount = Math.floor(DEBUG_SESSION_DURATION_SEC / stepSec);
  const beatGrid = new Float64Array(beatCount);
  for (let b = 0; b < beatCount; b++) beatGrid[b] = 0.42 + b * stepSec;

  const candidates: TempoCandidate[] = [
    { bpm: 107.7, confidence: 0.93 },
    { bpm: 215.4, confidence: 0.61 },
    { bpm: 53.9, confidence: 0.44 },
    { bpm: 94.0, confidence: 0.34 },
  ];

  return {
    decodedSourceMix: {
      buffer: mixBuffer,
      metadata: {
        fileName: "Debug Session (synthetic)",
        fileSize: 0,
        duration: DEBUG_SESSION_DURATION_SEC,
        sampleRate: DEBUG_SESSION_SAMPLE_RATE,
        numberOfChannels: 2,
      } as SourceMixMetadata,
    },
    waveformPeaks: { min, max, length: DEBUG_SESSION_PEAK_BINS },
    separatedStems,
    tempoAnalysis: {
      candidates,
      beatGrid,
      analyzedBpm: DEBUG_SESSION_ANALYZED_BPM,
      duration: DEBUG_SESSION_DURATION_SEC,
      chosenTempoBpm: DEBUG_SESSION_ANALYZED_BPM,
    },
    currentTime: DEBUG_SESSION_PLAYHEAD_SEC,
  };
}
