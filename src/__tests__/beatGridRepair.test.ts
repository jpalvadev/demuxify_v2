import { describe, it, expect } from "vitest";
import { repairBeatGrid } from "../lib/beatGridRepair";

// ADR-0011 hybrid snap repair: unit underpinning of the mechanic (slips
// relocated, double gaps filled, rubato kept). The tolerance itself is not
// invented here — ADR-0011 records it from verification runs of the real
// Source Mix against the librosa anchor (see ADR 0011 and the comment on
// SNAP_TOLERANCE_SEC). These tests pin the contract at the grid level with
// the same tolerance the worker uses.

const TOL = 0.08;
const BPM = 120;
const PULSE = 0.5;

const near = (a: number[], b: number[]) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThan(1e-9);
  }
};

const assertAllGapsWithinTolerance = (beats: number[]) => {
  for (let i = 0; i + 1 < beats.length; i++) {
    const gap = beats[i + 1] - beats[i];
    expect(Math.abs(gap - PULSE)).toBeLessThanOrEqual(TOL);
  }
};

describe("Beat Grid hybrid snap repair (ADR-0011)", () => {
  it("keeps a clean lattice untouched: repair is a no-op when every gap matches the pulse", async () => {
    const beats = Float64Array.from(
      Array.from({ length: 21 }, (_, i) => i * PULSE)
    );
    const repaired = repairBeatGrid(beats, BPM);
    near(Array.from(repaired), Array.from(beats));
  });

  it("keeps a rubato run: human-feel fluctuation inside the tolerance survives verbatim", async () => {
    // Alternating 0.56/0.44 s gaps: inside the anchor's genuine fluctuation
    // band (0.058 s measured on the real track, tolerance 0.08 s) — the Beat
    // Grid's defining point: these positions are kept, not re-derived.
    const times: number[] = [0];
    for (let i = 1; i <= 12; i++) {
      times.push(times[i - 1] + (i % 2 === 1 ? 0.56 : 0.44));
    }
    const repaired = repairBeatGrid(Float64Array.from(times), BPM);
    near(Array.from(repaired), times);
    assertAllGapsWithinTolerance(Array.from(repaired));
  });

  it("fills a double gap: a skipped pulse is inserted, the tracked half keeps its own position", async () => {
    // Music beats at ~0, ~1.02 (skipped ~0.5), ~1.5. Repair inserts the
    // skipped lattice pulse at 0.5 and keeps the tracked 1.02 (within tol of
    // the 2-pulse count) so the second half stays human-feel.
    const beats = Float64Array.from([0, 1.02, 1.5]);
    const repaired = Array.from(repairBeatGrid(beats, BPM));
    near(repaired, [0, 0.5, 1.02, 1.5]);
    assertAllGapsWithinTolerance(repaired);
  });

  it("relocates a slip: off-lattice beyond tolerance snaps onto the lattice chain", async () => {
    // A beat tracked at 0.35 where the pulse says 0.5 (off by 0.15 > tol):
    // the position is not trusted, the lattice one replaces it.
    const beats = Float64Array.from([0, 0.35, 1.0]);
    const repaired = Array.from(repairBeatGrid(beats, BPM));
    near(repaired, [0, 0.5, 1.0]);
    assertAllGapsWithinTolerance(repaired);
  });

  it("repairs a slipped double gap: skipped pulses inserted, the slipped beat replaced", async () => {
    // Gap 0.85 (nearer to two pulses than one, beyond tolerance off both):
    // both lattice pulses are emitted and the raw slip is replaced; a later
    // raw beat already at the lattice line folds into the chain.
    const beats = Float64Array.from([0, 0.5, 1.35, 1.5, 2.0]);
    const repaired = Array.from(repairBeatGrid(beats, BPM));
    near(repaired, [0, 0.5, 1.0, 1.5, 2.0]);
    assertAllGapsWithinTolerance(repaired);
  });

  it("drops non-monotone tracker noise and preserves the empty/single-beat grids", async () => {
    const junk = Float64Array.from([0, 0.5, 0.52, 1.5]);
    const repaired = Array.from(repairBeatGrid(junk, BPM));
    // 0.52 is a duplicate-adjacent slip: gap 0.02 (k floors to 1, off −0.48)
    // → lattice relocation to 1.0, then 1.5 keeps its place.
    near(repaired, [0, 0.5, 1.0, 1.5]);
    assertAllGapsWithinTolerance(repaired);

    expect(repairBeatGrid(new Float64Array(0), BPM).length).toBe(0);
    const single = Float64Array.from([3.7]);
    expect(Array.from(repairBeatGrid(single, BPM))).toEqual([3.7]);
    // A tracker tempo that is not a positive finite number repairs nothing.
    expect(Array.from(repairBeatGrid(Float64Array.from([1, 2]), 0))).toEqual([
      1, 2,
    ]);
  });

  it("repairs deterministically and guarantees the guard: every repaired gap sits on the pulse lattice within tolerance", async () => {
    const mixed = Float64Array.from([
      0,
      0.54, // rubato, kept
      1.62, // double gap (skipped ~1.04), kept half
      2.1,
      2.95, // slip (lattice 2.6/3.1 region), relocated
      3.6,
    ]);
    const first = Array.from(repairBeatGrid(mixed, BPM));
    const second = Array.from(repairBeatGrid(mixed, BPM));
    near(first, second);
    assertAllGapsWithinTolerance(first);
    // Positions the lattice had to vouch for changed; rubato ones did not.
    expect(first[0]).toBe(0);
    expect(first[1]).toBeCloseTo(0.54, 9);
  });
});
