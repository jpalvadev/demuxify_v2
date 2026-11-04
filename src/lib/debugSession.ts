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

  const min = new Float32Array(DEBUG_SESSION_PEAK_BINS);
  const max = new Float32Array(DEBUG_SESSION_PEAK_BINS);
  for (let bin = 0; bin < DEBUG_SESSION_PEAK_BINS; bin++) {
    const swell = Math.abs(
      Math.sin(bin * 0.031) + 0.35 * Math.sin(bin * 0.011)
    );
    const amp = 0.16 + 0.72 * Math.pow(swell, 1.35) * (0.45 + 0.55 * rnd());
    min[bin] = -amp;
    max[bin] = amp;
  }

  const mixSamples = new Float32Array(DEBUG_SESSION_STEM_SAMPLES);
  for (let i = 0; i < DEBUG_SESSION_STEM_SAMPLES; i++) {
    mixSamples[i] = (rnd() - 0.5) * 0.3;
  }
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

  const stemChannel = () => {
    const channel = new Float32Array(DEBUG_SESSION_STEM_SAMPLES);
    for (let i = 0; i < DEBUG_SESSION_STEM_SAMPLES; i++) {
      channel[i] = (rnd() - 0.5) * 0.4;
    }
    return [channel, channel];
  };
  const separatedStems: Record<StemName, Float32Array[]> = {
    vocals: stemChannel(),
    drums: stemChannel(),
    bass: stemChannel(),
    other: stemChannel(),
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
