// Shared test reader: Click Track WAV bytes -> click onsets in seconds. Walks
// the RIFF chunk list, reads the Int16 LE data chunk, clusters first crossings.
// Both seams that hear an exported Click Track back import this one reader —
// the App seam (bytes handed to the bundler) and the real-audio seam (bytes
// read out of the ZIP) — instead of each keeping its own copy of the shape.
export function decodeWavOnsets(bytes: Uint8Array, rate: number): number[] {
  const onsets: number[] = [];
  if (!bytes) return onsets;
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
  if (dataStart < 0) return onsets;
  let prev = false;
  for (let s = 0; s * 2 + 1 < dataLen; s++) {
    const raw = bytes[dataStart + s * 2] | (bytes[dataStart + s * 2 + 1] << 8);
    const v = raw >= 0x8000 ? raw - 0x10000 : raw;
    const nz = Math.abs(v) > 100;
    if (nz && !prev) {
      const t = s / rate;
      if (onsets.length === 0 || t - onsets[onsets.length - 1] > 0.1) {
        onsets.push(t);
      }
    }
    prev = nz;
  }
  return onsets;
}
