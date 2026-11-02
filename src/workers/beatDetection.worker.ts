// Tempo Detector worker (ADR-0010): one detection pass over ONE channel of the
// decoded Source Mix, off the main thread. Reports ranked BPM candidates
// (engine only ranks, never silently picks over octave ambiguity — user decision)
// and a Beat Grid of beat positions in seconds. The Click Track is NOT a Stem:
// nothing here touches the StemName identities.
import { combTempo, beatTrack } from "@audio/beat";

export interface TempoCandidate {
  bpm: number;
  confidence: number;
}

export type WorkerInMessage =
  | {
      type: "start";
      samples: Float32Array;
      sampleRate: number;
      // Re-lock hint (ticket 06): choosing a candidate re-runs the tracker
      // with that tempo as hint, regenerating the Beat Grid.
      hintBpm?: number;
    }
  | { type: "cancel" };

export type WorkerOutMessage =
  | {
      type: "worker_log";
      level: "info" | "warn" | "error";
      message: string;
      data?: unknown;
    }
  | {
      type: "complete";
      // Ranked top candidate first, alternatives after; engine never presents
      // an ambiguous reading as certain.
      candidates: TempoCandidate[];
      // Beat Grid: beat positions in seconds where the beats actually fall.
      beatGrid: Float64Array;
      analyzedBpm: number;
      duration: number;
    }
  | { type: "cancelled" }
  | { type: "error"; error: string };

// Search window widened past the engine defaults (60–200 BPM) so the metric
// doubling of a rock tempo (e.g. 107.7 → 215.4) is always among the ranked
// candidates the user can choose from (ADR-0010: octave ambiguity is a user
// decision, not an engine guess).
const MIN_BPM = 45;
const MAX_BPM = 240;
const CANDIDATE_COUNT = 4;

let isCancelled = false;

function dedupeAndRankCandidates(tempoResult: {
  bpm: number;
  confidence: number;
  candidates?: any;
}): TempoCandidate[] {
  const byBpm = new Map<number, TempoCandidate>();
  const push = (bpm: number, confidence: number) => {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const key = Math.round(bpm * 10);
    const existing = byBpm.get(key);
    if (!existing || confidence > existing.confidence) {
      byBpm.set(key, { bpm: Math.round(bpm * 10) / 10, confidence });
    }
  };
  push(tempoResult.bpm, tempoResult.confidence);
  const alternatives = tempoResult.candidates;
  if (alternatives && alternatives.length) {
    for (const alt of alternatives) {
      push(alt.bpm, alt.confidence);
    }
  }
  return [...byBpm.values()].sort((a, b) => b.confidence - a.confidence);
}

async function handleStart(
  samples: Float32Array,
  sampleRate: number,
  hintBpm: number | undefined,
  postMsg: (msg: WorkerOutMessage) => void = (m) => self.postMessage(m)
) {
  isCancelled = false;

  try {
    if (!samples || samples.length === 0) {
      throw new Error("Tempo Detector received no samples to analyze");
    }

    const fs = sampleRate || 44100;
    const durationSec = samples.length / fs;
    postMsg({
      type: "worker_log",
      level: "info",
      message: `Tempo Detector analysis started: ${samples.length} samples (${durationSec.toFixed(1)}s at ${fs}Hz)`,
    } satisfies WorkerOutMessage);

    // Comb-filter tempo pass with ranked candidates.
    const tempoResult = combTempo(samples, {
      fs,
      minBpm: MIN_BPM,
      maxBpm: MAX_BPM,
      candidates: CANDIDATE_COUNT,
    });
    if (isCancelled) {
      postMsg({ type: "cancelled" } satisfies WorkerOutMessage);
      return;
    }

    const candidates = dedupeAndRankCandidates(tempoResult);
    if (candidates.length === 0) {
      throw new Error("Tempo Detector found no plausible BPM in range");
    }

    const topBpm = candidates[0].bpm;
    const altText = candidates
      .slice(1)
      .map((c) => c.bpm.toFixed(1))
      .join(", ");
    postMsg({
      type: "worker_log",
      level: "info",
      message: `Tempo Detector ranked candidates: ${candidates.map((c) => `${c.bpm.toFixed(1)} BPM @ ${(c.confidence * 100).toFixed(0)}%`).join(", ")} (top: ${topBpm.toFixed(1)}, alternatives: ${altText || "none"})`,
      data: { candidates },
    } satisfies WorkerOutMessage);

    // Phase-aligned Beat Grid: hint the top candidate (or the user-selected
    // tempo on a re-lock) so clicks land where beats actually fall.
    const targetBpm = hintBpm && hintBpm > 0 ? hintBpm : topBpm;
    const trackResult = beatTrack(samples, { fs, bpm: targetBpm });
    if (isCancelled) {
      postMsg({ type: "cancelled" } satisfies WorkerOutMessage);
      return;
    }

    postMsg({
      type: "complete",
      candidates,
      beatGrid: trackResult.beats,
      analyzedBpm: trackResult.bpm,
      duration: samples.length / fs,
    } satisfies WorkerOutMessage);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postMsg({ type: "error", error: errorMessage } satisfies WorkerOutMessage);
  }
}

export async function handleWorkerMessage(
  msg: WorkerInMessage,
  postMsg: (msg: WorkerOutMessage) => void = (m) => self.postMessage(m)
): Promise<void> {
  switch (msg.type) {
    case "start":
      await handleStart(msg.samples, msg.sampleRate, msg.hintBpm, postMsg);
      break;
    case "cancel":
      isCancelled = true;
      postMsg({ type: "cancelled" });
      break;
  }
}

if (typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
    handleWorkerMessage(event.data);
  };
}
