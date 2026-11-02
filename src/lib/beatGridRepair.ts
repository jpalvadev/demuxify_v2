// Downbeat Phase reading (ADR-0011): the app-code pass that runs on top of the
// @audio/beat tracker output inside the Tempo Detector worker. The reading is a
// heuristic over the analyzed channel and is never presented as proven: the
// Downbeat is a listening decision, so this only ever suggests a start for the
// user's −/+ hunt. Plain scans over the same Float32Array channel the tracker
// already consumed — no new dependencies, nothing off the main thread's data.
//
// Meter-agnostic by design: everything here takes a beats-per-bar count, which
// the Click Track lane already parses out of its `ClickTrackMeter`, so this
// module owns the phase arithmetic alone.
export function normalizeDownbeatPhase(
  phase: number,
  beatsPerBar: number
): number {
  if (!Number.isFinite(phase) || beatsPerBar <= 1) return 0;
  const wrapped = Math.trunc(phase) % beatsPerBar;
  return wrapped < 0 ? wrapped + beatsPerBar : wrapped;
}

// The energy window around a beat used as the bass-drop / chord-change proxy:
// a bar head typically arrives out of a quiet approach and attacks. The window
// is a fixed slice of the channel (not a fraction of the beat) so the same
// scoring stays meaningful across the octave-ambiguous candidates the engine
// ranks.
const DOWNBEAT_PROMINENCE_WINDOW_SEC = 0.12;

function meanAbsEnergy(
  samples: Float32Array,
  fromSample: number,
  toSample: number
): number {
  const from = Math.max(0, Math.ceil(fromSample));
  const to = Math.min(samples.length, Math.floor(toSample));
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) {
    const s = samples[i];
    sum += s < 0 ? -s : s;
  }
  return sum / (to - from);
}

// Prominence of one beat: how much the sound attacks at the beat compared with
// the quiet approach just before it. High prominence = the beat lands where the
// music opens up (chord change, bass drop, vocal landing) — the usual signs of
// a Downbeat, and the reason this stays a suggestion, not an assertion.
function beatProminence(
  samples: Float32Array,
  sampleRate: number,
  beatSec: number
): number {
  if (beatSec < 0) return 0;
  const at = beatSec * sampleRate;
  const window = DOWNBEAT_PROMINENCE_WINDOW_SEC * sampleRate;
  const approach = meanAbsEnergy(samples, at - window, at - window / 3);
  const attack = meanAbsEnergy(samples, at, at + (2 * window) / 3);
  return attack - approach;
}

// Candidate phases are 0..beatsPerBar−1: which beat index of the grouping is
// the Downbeat. Each phase is scored by the mean prominence of the beats that
// land on it, and the best-scoring one is emitted. Ties break toward the
// earlier phase. Never presented as proven.
export function pickDownbeatPhase(
  beatTimesSec: Float64Array,
  samples: Float32Array,
  sampleRate: number,
  beatsPerBar = 4
): number {
  if (beatTimesSec.length === 0 || samples.length === 0 || beatsPerBar <= 1) {
    return 0;
  }

  let bestPhase = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let phase = 0; phase < beatsPerBar; phase++) {
    let sum = 0;
    let count = 0;
    for (let k = phase; k < beatTimesSec.length; k += beatsPerBar) {
      const beatSec = beatTimesSec[k];
      if (beatSec < 0) continue;
      sum += beatProminence(samples, sampleRate, beatSec);
      count++;
    }
    if (count === 0) continue;
    const score = sum / count;
    // Strictly greater: an equal score keeps the earlier phase (tie-break).
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}
