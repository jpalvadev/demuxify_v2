// Shared test reader: Click Track WAV bytes -> click onsets in seconds. Walks
// the RIFF chunk list, reads the Int16 LE data chunk, clusters first crossings.
// Both seams that hear an exported Click Track back import this one reader —
// the App seam (bytes handed to the bundler) and the real-audio seam (bytes
// read out of the ZIP) — instead of each keeping its own copy of the shape.
export function decodeWavOnsets(bytes: Uint8Array, rate: number): number[] {
  return readWavClickTimes(bytes, rate);
}

// The Click Track has one uniform click tone (ADR-0011 Amendment), so onsets
// alone are enough to compare an exported file against the Beat Grid: one pass,
// one clustering, times in seconds.
function readWavClickTimes(bytes: Uint8Array, rate: number): number[] {
  const clicks: number[] = [];
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
  let prev = false;
  for (let s = 0; s < totalSamples; s++) {
    const v = sampleAt(s);
    const nz = Math.abs(v) > 100;
    if (nz && !prev) {
      const t = s / rate;
      if (clicks.length === 0 || t - clicks[clicks.length - 1] > 0.1) {
        clicks.push(t);
      }
    }
    prev = nz;
  }
  return clicks;
}
