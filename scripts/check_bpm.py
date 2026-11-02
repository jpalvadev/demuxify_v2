#!/usr/bin/env python3
"""
Tempo Detector Verification Anchor (librosa ground truth)

Verifies the librosa ground-truth BPM anchor for the Tempo Detector & Click Track
feature (ADR-0010) against the reference steady-tempo rock track on this machine.
The client-side engine (@audio/beat, Ellis-DP beatTrack + comb-filter combTempo)
is asserted within an octave-tolerant window of these anchors, never for exact
equality (the engine's own README benchmark: Acc1 87%, MAE 8.7 BPM, with
inherent octave ambiguity between a true pulse and its metric doubling).

Upstream Source Details:
- Tracker: librosa (librosa.beat.beat_track, autocorrelation + dynamic programming)
- Verified on this machine (2026-11-01): 107.7 BPM / 503 beats on audioslave_stone.mp3
- Reference track: audioslave_stone.mp3 (7,059,467 bytes at repo root)
- Beat interval at anchor tempo: 60 / 107.7 ~= 0.557 s; metric doubling 215.4 BPM ~= 0.279 s
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
import numpy as np

import librosa

DEFAULT_AUDIO_PATH = Path(__file__).resolve().parent.parent / "audioslave_stone.mp3"
REFERENCE_FILESIZE_BYTES = 7059467

# Ground-truth anchors (verified on this machine, librosa 1.0.0)
EXPECTED_BPM = 107.7
EXPECTED_BEATS = 503
# Octave-tolerant window: the engine may report the true pulse, its double or
# its half; assertions only require one candidate within ±5% of the anchor.
BPM_TOLERANCE_PCT = 0.05


def verify_tempo(audio_path: Path) -> bool:
    """Load the reference Source Mix and report the librosa BPM anchor + Beat Grid size."""
    if not audio_path.exists():
        print(f"Error: reference audio not found at {audio_path}")
        return False

    if audio_path.stat().st_size != REFERENCE_FILESIZE_BYTES:
        print(
            f"Error: reference audio size {audio_path.stat().st_size} != expected {REFERENCE_FILESIZE_BYTES}"
        )
        return False

    try:
        y, sr = librosa.load(str(audio_path), sr=44100, mono=True)
    except Exception as e:
        print(f"Error loading audio: {e}")
        return False

    duration_sec = len(y) / sr
    bpm, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm_value = float(np.ravel(bpm)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    print(f"Source Mix: {audio_path.name} ({duration_sec:.1f}s at {sr}Hz)")
    print(f"librosa tempo anchor: {bpm_value:.1f} BPM ({len(beat_frames)} beats, "
          f"median interval {np.median(np.diff(beat_times)):.3f}s)")

    within_tolerance = abs(bpm_value - EXPECTED_BPM) / EXPECTED_BPM <= BPM_TOLERANCE_PCT
    if not within_tolerance:
        print(f"Error: measured {bpm_value:.1f} BPM is outside +/-{BPM_TOLERANCE_PCT:.0%} of the {EXPECTED_BPM} BPM anchor")
        return False

    beats_tolerance = int(round(EXPECTED_BEATS * BPM_TOLERANCE_PCT))
    if abs(len(beat_frames) - EXPECTED_BEATS) > beats_tolerance:
        print(f"Error: measured {len(beat_frames)} beats is outside ±{beats_tolerance} of the {EXPECTED_BEATS}-beat anchor")
        return False

    print(f"SUCCESS: librosa ground-truth anchor verified ({bpm_value:.1f} BPM near {EXPECTED_BPM}, {len(beat_frames)} beats near {EXPECTED_BEATS}).")
    return True


def main():
    parser = argparse.ArgumentParser(description="Verify librosa BPM ground-truth anchor for the Tempo Detector")
    parser.add_argument("--audio", type=Path, default=DEFAULT_AUDIO_PATH, help="Reference audio file path")

    args = parser.parse_args()

    if not verify_tempo(args.audio):
        sys.exit(1)


if __name__ == "__main__":
    main()
