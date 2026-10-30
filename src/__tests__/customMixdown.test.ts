import { describe, it, expect } from "vitest";
import {
  mixAudioStems,
  resolveMixdownDescriptor,
  formatMixdownFileName,
} from "../lib/customMixdown";

describe("mixAudioStems", () => {
  it("sums multi-channel audio across stems with individual gains and master gain", () => {
    // 2 channels, 3 samples
    const vocals = [
      new Float32Array([0.1, 0.2, 0.3]),
      new Float32Array([0.15, 0.25, 0.35]),
    ];
    const drums = [
      new Float32Array([0.2, 0.2, 0.2]),
      new Float32Array([0.1, 0.1, 0.1]),
    ];
    const bass = [
      new Float32Array([0.05, 0.05, 0.05]),
      new Float32Array([0.05, 0.05, 0.05]),
    ];
    const other = [
      new Float32Array([0.0, 0.1, 0.0]),
      new Float32Array([0.0, 0.0, 0.1]),
    ];

    const result = mixAudioStems(
      { vocals, drums, bass, other },
      {
        stemGains: {
          vocals: 1.0,
          drums: 0.5,
          bass: 2.0,
          other: 0.0, // muted
        },
        masterGain: 0.8,
        antiClipping: true,
      }
    );

    // Channel 0:
    // sample 0: (0.1 * 1.0 + 0.2 * 0.5 + 0.05 * 2.0 + 0.0 * 0.0) * 0.8 = (0.1 + 0.1 + 0.1 + 0) * 0.8 = 0.24
    // sample 1: (0.2 * 1.0 + 0.2 * 0.5 + 0.05 * 2.0 + 0.1 * 0.0) * 0.8 = (0.2 + 0.1 + 0.1 + 0) * 0.8 = 0.32
    // sample 2: (0.3 * 1.0 + 0.2 * 0.5 + 0.05 * 2.0 + 0.0 * 0.0) * 0.8 = (0.3 + 0.1 + 0.1 + 0) * 0.8 = 0.40
    expect(result.audio).toHaveLength(2);
    expect(result.audio[0]).toHaveLength(3);
    expect(result.audio[1]).toHaveLength(3);

    expect(result.audio[0][0]).toBeCloseTo(0.24, 5);
    expect(result.audio[0][1]).toBeCloseTo(0.32, 5);
    expect(result.audio[0][2]).toBeCloseTo(0.4, 5);

    // Channel 1:
    // sample 0: (0.15 * 1.0 + 0.1 * 0.5 + 0.05 * 2.0 + 0.0 * 0.0) * 0.8 = (0.15 + 0.05 + 0.1 + 0) * 0.8 = 0.24
    // sample 1: (0.25 * 1.0 + 0.1 * 0.5 + 0.05 * 2.0 + 0.0 * 0.0) * 0.8 = (0.25 + 0.05 + 0.1 + 0) * 0.8 = 0.32
    // sample 2: (0.35 * 1.0 + 0.1 * 0.5 + 0.05 * 2.0 + 0.1 * 0.0) * 0.8 = (0.35 + 0.05 + 0.1 + 0) * 0.8 = 0.40
    expect(result.audio[1][0]).toBeCloseTo(0.24, 5);
    expect(result.audio[1][1]).toBeCloseTo(0.32, 5);
    expect(result.audio[1][2]).toBeCloseTo(0.4, 5);

    expect(result.normalized).toBe(false);
    expect(result.scaleFactor).toBe(1.0);
    expect(result.peakAmplitude).toBeCloseTo(0.4, 5);
    expect(result.activeStems).toEqual(["vocals", "drums", "bass"]);
  });

  it("scales summed audio to -0.3 dBFS ceiling when peak exceeds ceiling and anti-clipping is enabled", () => {
    // Two stems with peak 0.8 each -> sum peak = 1.6 > 0.96605 (-0.3 dBFS)
    const vocals = [new Float32Array([0.8, -0.4])];
    const drums = [new Float32Array([0.8, 0.2])];
    const bass = [new Float32Array([0.0, 0.0])];
    const other = [new Float32Array([0.0, 0.0])];

    const result = mixAudioStems(
      { vocals, drums, bass, other },
      { antiClipping: true }
    );

    const expectedCeiling = Math.pow(10, -0.3 / 20); // ~0.96605088
    const expectedScale = expectedCeiling / 1.6; // ~0.60378

    expect(result.normalized).toBe(true);
    expect(result.scaleFactor).toBeCloseTo(expectedScale, 5);
    expect(result.peakAmplitude).toBeCloseTo(1.6, 5);

    // Peak sample (index 0) should equal expected ceiling
    expect(result.audio[0][0]).toBeCloseTo(expectedCeiling, 5);
    // Other sample should be scaled by the same factor: (-0.4 + 0.2) * expectedScale = -0.2 * expectedScale
    expect(result.audio[0][1]).toBeCloseTo(-0.2 * expectedScale, 5);
  });

  it("bypasses anti-clipping normalization when antiClipping is false", () => {
    const vocals = [new Float32Array([0.8, 0.5])];
    const drums = [new Float32Array([0.8, 0.5])];
    const bass = [new Float32Array([0.0, 0.0])];
    const other = [new Float32Array([0.0, 0.0])];

    const result = mixAudioStems(
      { vocals, drums, bass, other },
      { antiClipping: false }
    );

    expect(result.normalized).toBe(false);
    expect(result.scaleFactor).toBe(1.0);
    expect(result.peakAmplitude).toBeCloseTo(1.6, 5);
    // Unscaled raw sum
    expect(result.audio[0][0]).toBeCloseTo(1.6, 5);
    expect(result.audio[0][1]).toBeCloseTo(1.0, 5);
  });

  it("handles total silence and zero volume gracefully without NaN or division by zero", () => {
    const vocals = [new Float32Array([0.0, 0.0, 0.0])];
    const drums = [new Float32Array([0.0, 0.0, 0.0])];
    const bass = [new Float32Array([0.0, 0.0, 0.0])];
    const other = [new Float32Array([0.0, 0.0, 0.0])];

    const result = mixAudioStems(
      { vocals, drums, bass, other },
      {
        stemGains: { vocals: 0, drums: 0, bass: 0, other: 0 },
        masterGain: 0,
        antiClipping: true,
      }
    );

    expect(result.normalized).toBe(false);
    expect(result.scaleFactor).toBe(1.0);
    expect(result.peakAmplitude).toBe(0);
    expect(result.activeStems).toEqual([]);
    expect(result.audio[0]).toEqual(new Float32Array([0, 0, 0]));

    for (let i = 0; i < result.audio[0].length; i++) {
      expect(Number.isNaN(result.audio[0][i])).toBe(false);
      expect(Number.isFinite(result.audio[0][i])).toBe(true);
    }
  });

  it("handles AudioBuffer inputs correctly", () => {
    const mockAudioBuffer = {
      numberOfChannels: 2,
      getChannelData: (ch: number) =>
        ch === 0 ? new Float32Array([0.2, 0.4]) : new Float32Array([0.1, 0.3]),
    } as unknown as AudioBuffer;

    const silence = [new Float32Array([0, 0]), new Float32Array([0, 0])];

    const result = mixAudioStems({
      vocals: mockAudioBuffer,
      drums: silence,
      bass: silence,
      other: silence,
    });

    expect(result.audio).toHaveLength(2);
    expect(result.audio[0][0]).toBeCloseTo(0.2, 5);
    expect(result.audio[0][1]).toBeCloseTo(0.4, 5);
    expect(result.audio[1][0]).toBeCloseTo(0.1, 5);
    expect(result.audio[1][1]).toBeCloseTo(0.3, 5);
  });

  it("automatically generates semantic fileName when sourceMixTitle and format are provided", () => {
    const vocals = [new Float32Array([0.1])];
    const drums = [new Float32Array([0.2])];
    const bass = [new Float32Array([0.3])];
    const other = [new Float32Array([0.4])];

    const result = mixAudioStems(
      { vocals, drums, bass, other },
      {
        stemGains: { vocals: 0, drums: 1, bass: 1, other: 1 },
        sourceMixTitle: "Queen - Don't Stop Me Now",
        format: "mp3",
      }
    );

    expect(result.descriptor).toBe("karaoke");
    expect(result.fileName).toBe("Queen - Don't Stop Me Now_karaoke.mp3");
  });

  it("treats omitted stems in partial stemGains as inactive (0.0 gain)", () => {
    const vocals = [new Float32Array([0.5, 0.5])];
    const drums = [new Float32Array([0.5, 0.5])];
    const bass = [new Float32Array([0.5, 0.5])];
    const other = [new Float32Array([0.5, 0.5])];

    const result = mixAudioStems(
      { vocals, drums, bass, other },
      { stemGains: { vocals: 1.0 } }
    );

    expect(result.activeStems).toEqual(["vocals"]);
    expect(result.descriptor).toBe("acapella");
    expect(result.audio[0][0]).toBeCloseTo(0.5, 5);
    expect(result.audio[0][1]).toBeCloseTo(0.5, 5);
  });
});

describe("resolveMixdownDescriptor", () => {
  it("resolves acapella when only vocals are active", () => {
    expect(resolveMixdownDescriptor(["vocals"])).toBe("acapella");
    expect(
      resolveMixdownDescriptor({ vocals: 1, drums: 0, bass: 0, other: 0 })
    ).toBe("acapella");
    expect(
      resolveMixdownDescriptor({
        vocals: true,
        drums: false,
        bass: false,
        other: false,
      })
    ).toBe("acapella");
  });

  it("resolves karaoke when drums, bass, and other are active without vocals", () => {
    expect(resolveMixdownDescriptor(["drums", "bass", "other"])).toBe(
      "karaoke"
    );
    expect(
      resolveMixdownDescriptor({
        vocals: 0,
        drums: 0.8,
        bass: 1.0,
        other: 0.5,
      })
    ).toBe("karaoke");
    expect(
      resolveMixdownDescriptor({
        vocals: false,
        drums: true,
        bass: true,
        other: true,
      })
    ).toBe("karaoke");
    expect(
      resolveMixdownDescriptor(["drums", "bass", "other"], {
        preferInstrumental: true,
      })
    ).toBe("instrumental");
  });

  it("resolves minus_drums when vocals, bass, and other are active without drums", () => {
    expect(resolveMixdownDescriptor(["vocals", "bass", "other"])).toBe(
      "minus_drums"
    );
    expect(
      resolveMixdownDescriptor({
        vocals: 1,
        drums: 0,
        bass: 1,
        other: 1,
      })
    ).toBe("minus_drums");
  });

  it("resolves mixdown for full mix or other custom combinations", () => {
    expect(resolveMixdownDescriptor(["vocals", "drums", "bass", "other"])).toBe(
      "mixdown"
    );
    expect(resolveMixdownDescriptor(["drums", "bass"])).toBe("mixdown");
    expect(resolveMixdownDescriptor([])).toBe("mixdown");
  });
});

describe("formatMixdownFileName", () => {
  it("formats sanitized filename with semantic descriptor and extension", () => {
    expect(
      formatMixdownFileName("Bohemian Rhapsody.wav", "karaoke", "wav")
    ).toBe("Bohemian Rhapsody_karaoke.wav");

    expect(formatMixdownFileName("Track / 01 * Live", "acapella", "mp3")).toBe(
      "Track _ 01 _ Live_acapella.mp3"
    );

    expect(
      formatMixdownFileName("MySong", ["vocals", "bass", "other"], "wav")
    ).toBe("MySong_minus_drums.wav");

    expect(formatMixdownFileName("Demo", "instrumental", "mp3")).toBe(
      "Demo_instrumental.mp3"
    );
  });
});
