// Shared test reader: Click Track WAV bytes -> click onsets in seconds. Walks
// the RIFF chunk list, reads the Int16 LE data chunk, clusters first crossings.
// Both seams that hear an exported Click Track back import this one reader —
// the App seam (bytes handed to the bundler) and the real-audio seam (bytes
// read out of the ZIP) — instead of each keeping its own copy of the shape.
export function decodeWavOnsets(bytes: Uint8Array, rate: number): number[] {
  return readWavClicks(bytes, rate).map((click) => click.t);
}

// ADR-0011 (ticket 06): deeper tones are synthesized louder than the plain
// clicks (amp 1.0 vs 0.55), so each onset carries a peak level and a test can
// see WHICH onsets are the Downbeat's without reaching into the synthesizer.
// One pass, one clustering: levels align one-to-one with decodeWavOnsets.
export interface WavClick {
  t: number;
  peak: number;
}

function readWavClicks(bytes: Uint8Array, rate: number): WavClick[] {
  const clicks: WavClick[] = [];
  if (!bytes) return clicks;
  let dataStart = -1;
  let dataLen = 0;
  for (let off = 12; off + 8 <= bytes.length;) {
    const size =
      bytes[off + 4] |
      (bytes[off + 5] << 8) |
      (bytes[off + 6] << 16) |
      (bytes[off + 7] << 24);
    const fourcc = String.fromCharCode(
      bytes[off],
      bytes[off + 1],
      bytes[off + 2],
      bytes[off + 3]
    );
    if (fourcc === "data") {
      dataStart = off + 8;
      dataLen = size;
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (dataStart < 0) return clicks;
  const sampleAt = (s: number): number => {
    const raw = bytes[dataStart + s * 2] | (bytes[dataStart + s * 2 + 1] << 8);
    return raw >= 0x8000 ? raw - 0x10000 : raw;
  };
  const totalSamples = Math.floor(dataLen / 2);
  const windowSamples = Math.round(0.03 * rate);
  let prev = false;
  for (let s = 0; s < totalSamples; s++) {
    const v = sampleAt(s);
    const nz = Math.abs(v) > 100;
    if (nz && !prev) {
      const t = s / rate;
      if (clicks.length === 0 || t - clicks[clicks.length - 1].t > 0.1) {
        let peak = 0;
        const windowEnd = Math.min(totalSamples, s + windowSamples);
        for (let w = s; w < windowEnd; w++) {
          const abs = Math.abs(sampleAt(w));
          if (abs > peak) peak = abs;
        }
        clicks.push({ t, peak });
      }
    }
    prev = nz;
  }
  return clicks;
}

export function decodeWavOnsetPeakLevels(
  bytes: Uint8Array,
  rate: number
): number[] {
  return readWavClicks(bytes, rate).map((click) => click.peak);
}
