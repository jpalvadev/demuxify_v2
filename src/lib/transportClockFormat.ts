// The one shared Playhead clock formatter (transport-snapshot spec ticket 03,
// 2026-11-06): every `mm:ss` Playhead-reading face — the footer clock chip and
// the Stem Player's standalone transport readout — paints from this single
// rule. The twin formatters (App's clamp-then-floor, StemPlayer's early-return)
// had already drifted on their clamp edge (Infinity landed "NaN:NaN" there);
// the shared rule clamps NaN/negatives to 0 first, so every surface agrees.
// Master Waveform's own `m:ss` ruler face is deliberately NOT this formatter —
// the spine's accessible face is one digit wider by design.
export function formatTransportClock(totalSeconds: number): string {
  const safe =
    isNaN(totalSeconds) || totalSeconds < 0 ? 0 : Math.floor(totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
