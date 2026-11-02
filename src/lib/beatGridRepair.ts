// Beat Grid repair (ADR-0011): the app-code pass that runs on top of the
// @audio/beat tracker output inside the Tempo Detector worker. Plain scans
// over the same Float32Array channel the tracker already consumed — no new
// dependencies. The Click Track has no accent axis anymore (ADR-0011
// Amendment): this module owns the hybrid snap repair alone.

// Snap tolerance for the hybrid repair (ADR-0011), recorded from the
// verification runs of the real Source Mix against the librosa anchor (see
// ADR 0011): librosa's own beat set swings up to 0.058 s away from the uniform
// pulse (0.4992 s .. 0.6153 s intervals at 107.7 BPM) while the tracker's raw
// grid stays within 0.014 s of it — 0.08 s keeps every real interval of the
// reference track (genuine fluctuation survives) and still repairs slips and
// double gaps. Not a blind number: ADR-0011 carries the derivation.
export const SNAP_TOLERANCE_SEC = 0.08;

// Hybrid snap repair of the Beat Grid (ADR-0011): the raw comb-tracker output
// is not trusted as the audible truth (positions slip in quiet passages and
// double beats in noisy ones), but a fully re-derived uniform grid would
// flatten the human-feel fluctuation the Beat Grid is defined to carry. So:
// chain the pulse lattice implied by the chosen tempo off the last EMITTED
// beat; a tracked beat whose gap matches the nearest lattice count (k =
// round(gap/pulse)) within the snap tolerance keeps its own position — that
// preserves rubato runs — while gaps spanning k≥2 lattice counts get the
// skipped pulses inserted; anything off the lattice beyond tolerance is a
// slip and gets relocated onto the lattice. Non-monotone tracker noise is
// dropped. The tolerance is not a blind number: see ADR-0011, derived from
// verification runs of the real Source Mix against the librosa anchor.
//
// ADR-0011 amendment (2026-11-02, measured on the reference Source Mix): a
// first gap of 0.3483 s (a pickup / anacrusis) exceeded the tolerance and
// relocated the beat — but re-measuring the NEXT gap against the RELOCATED
// beat cascaded the shift through 25 beats (up to 0.2088 s, 0.35 s..13.84 s),
// i.e. the intro clicks stopped landing on the hits the tracker had found.
// So an off-lattice gap no longer relocates unconditionally: if the beat sits
// at least one lattice count away (not a near-duplicate) and the FOLLOWING
// gap lands on the lattice from the beat itself, the beat is a pickup and is
// kept verbatim, with the lattice resuming from it. Only an isolated anomaly
// (the run after it does not vouch for the beat's own position) relocates —
// that is the genuine mis-tracking slip the tolerance was tuned for.
export function repairBeatGrid(
  beats: Float64Array,
  bpm: number,
  toleranceSec: number = SNAP_TOLERANCE_SEC
): Float64Array {
  if (!beats || beats.length === 0 || !(bpm > 0) || !isFinite(bpm)) {
    return beats && beats.length > 0 ? beats : new Float64Array(0);
  }
  const pulse = 60 / bpm;
  if (!(toleranceSec > 0) || !isFinite(toleranceSec)) {
    return beats;
  }

  const out: number[] = [];
  let prev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < beats.length; i++) {
    const t = beats[i];
    if (!isFinite(t) || t <= prev) continue;
    if (out.length === 0) {
      out.push(t);
      prev = t;
      continue;
    }
    const gap = t - prev;
    const k = Math.max(1, Math.round(gap / pulse));
    const offFromLattice = gap - k * pulse;
    if (Math.abs(offFromLattice) <= toleranceSec) {
      // Within tolerance of the lattice count: fill skipped pulses for k≥2
      // counts (double gaps), then keep the tracked beat's own position.
      for (let m = 1; m < k; m++) {
        out.push(prev + m * pulse);
      }
      out.push(t);
      prev = t;
    } else {
      // Off the lattice beyond tolerance. Before relocating, ask the beat
      // itself: a beat at ≥1 lattice count whose NEXT gap lands on the
      // lattice FROM the beat is a pickup (anacrusis/rubato arrival) — the
      // tracker saw a real early beat, so it is kept and the lattice resumes
      // from it instead of cascading the shift over the whole run.
      const isPickup =
        gap >= 0.5 * pulse &&
        i + 1 < beats.length &&
        (() => {
          const next = beats[i + 1];
          if (!isFinite(next) || next <= t) return false;
          const nextGap = next - t;
          const nextK = Math.round(nextGap / pulse);
          return (
            nextK >= 1 && Math.abs(nextGap - nextK * pulse) <= toleranceSec
          );
        })();
      if (isPickup) {
        // The run skipped whole lattice counts before arriving at this early
        // beat — those counts are filled, but the beat's own position is kept.
        for (let m = 1; m < k; m++) {
          out.push(prev + m * pulse);
        }
        out.push(t);
        prev = t;
      } else {
        // Slip: relocate onto the lattice chain.
        for (let m = 1; m <= k; m++) {
          out.push(prev + m * pulse);
        }
        prev = out[out.length - 1];
      }
    }
  }
  return Float64Array.from(out);
}
