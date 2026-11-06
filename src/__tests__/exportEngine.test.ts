import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import {
  exportAudio,
  ExportContext,
  SingleStemExportRequest,
  BundleExportRequest,
  MixdownExportRequest,
  MIXDOWN_PRESETS,
  DEFAULT_STEM_CONTROLS,
  computeInitialStemControls,
} from "../lib/exportEngine";
import { StemName, STEM_NAMES } from "../lib/chunkOverlapAdd";
import * as signalsmithAdapter from "../lib/signalsmithStretchAdapter";

describe("exportEngine (Single Stem & Full Bundle)", () => {
  const sampleRate = 44100;
  // 1152 * 2 samples is 2 MP3 frames length
  const sampleCount = 1152 * 2;

  const createMockStems = (): Record<StemName, Float32Array[]> => ({
    vocals: [
      new Float32Array(sampleCount).fill(0.1),
      new Float32Array(sampleCount).fill(0.1),
    ],
    drums: [
      new Float32Array(sampleCount).fill(0.2),
      new Float32Array(sampleCount).fill(0.2),
    ],
    bass: [
      new Float32Array(sampleCount).fill(0.15),
      new Float32Array(sampleCount).fill(0.15),
    ],
    other: [
      new Float32Array(sampleCount).fill(0.05),
      new Float32Array(sampleCount).fill(0.05),
    ],
  });

  let mockContext: ExportContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      stems: createMockStems(),
      sampleRate,
      sourceMixTitle: "test_track.mp3",
    };
  });

  describe("Single Stem Export", () => {
    it("exports a single stem as 16-bit WAV", async () => {
      const request: SingleStemExportRequest = {
        mode: "single",
        stem: "vocals",
        format: "wav",
        bitDepth: 16,
      };

      const progressSpy = vi.fn();
      const result = await exportAudio(request, mockContext, {
        onProgress: progressSpy,
      });

      expect(result.fileName).toBe("test_track_vocals.wav");
      expect(result.mimeType).toBe("audio/wav");
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("audio/wav");
      expect(progressSpy).toHaveBeenCalledWith(100, "Export complete");

      // Verify RIFF header
      const buffer = await result.blob.arrayBuffer();
      const view = new DataView(buffer);
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      expect(riff).toBe("RIFF");
      const wave = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      );
      expect(wave).toBe("WAVE");
    });

    it("exports a single stem as 24-bit WAV", async () => {
      const request: SingleStemExportRequest = {
        mode: "single",
        stem: "drums",
        format: "wav",
        bitDepth: 24,
      };

      const result = await exportAudio(request, mockContext);
      expect(result.fileName).toBe("test_track_drums.wav");
      expect(result.mimeType).toBe("audio/wav");

      const buffer = await result.blob.arrayBuffer();
      const view = new DataView(buffer);
      // Bit depth is at offset 34
      expect(view.getUint16(34, true)).toBe(24);
    });

    it("exports a single stem as MP3", async () => {
      const request: SingleStemExportRequest = {
        mode: "single",
        stem: "bass",
        format: "mp3",
        bitrate: 192,
      };

      const progressUpdates: number[] = [];
      const result = await exportAudio(request, mockContext, {
        onProgress: (p) => progressUpdates.push(p),
      });

      expect(result.fileName).toBe("test_track_bass.mp3");
      expect(result.mimeType).toBe("audio/mp3");
      expect(result.blob).toBeInstanceOf(Blob);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it("throws when requested stem is missing", async () => {
      const badContext: ExportContext = {
        ...mockContext,
        stems: { ...mockContext.stems, vocals: undefined as any },
      };

      const request: SingleStemExportRequest = {
        mode: "single",
        stem: "vocals",
        format: "wav",
      };

      await expect(exportAudio(request, badContext)).rejects.toThrow(
        'Stem "vocals" is not available.'
      );
    });
  });

  describe("Bundle Export (ZIP)", () => {
    it("packages all 4 stems into a valid ZIP archive for WAV format", async () => {
      const request: BundleExportRequest = {
        mode: "bundle",
        format: "wav",
        bitDepth: 16,
      };

      const progressSpy = vi.fn();
      const result = await exportAudio(request, mockContext, {
        onProgress: progressSpy,
      });

      expect(result.fileName).toBe("test_track_stems.zip");
      expect(result.mimeType).toBe("application/zip");
      expect(result.blob).toBeInstanceOf(Blob);

      const buffer = await result.blob.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(zip.files);

      expect(fileNames).toHaveLength(4);
      for (const stem of STEM_NAMES) {
        expect(fileNames).toContain(`test_track_${stem}.wav`);
      }
    });

    it("packages all 4 stems into a valid ZIP archive for MP3 format", async () => {
      const request: BundleExportRequest = {
        mode: "bundle",
        format: "mp3",
        bitrate: 128,
      };

      const result = await exportAudio(request, mockContext);
      expect(result.fileName).toBe("test_track_stems.zip");

      const buffer = await result.blob.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(zip.files);

      expect(fileNames).toHaveLength(4);
      for (const stem of STEM_NAMES) {
        expect(fileNames).toContain(`test_track_${stem}.mp3`);
      }
    });

    it("includes synthesized Click Track when includeClickTrack is true and settings are enabled", async () => {
      const request: BundleExportRequest = {
        mode: "bundle",
        format: "wav",
        includeClickTrack: true,
      };

      const contextWithClick: ExportContext = {
        ...mockContext,
        clickTrack: {
          beatGrid: new Float64Array([0.0, 0.5, 1.0, 1.5]),
          settings: {
            volume: 1.0,
            enabled: true,
          },
        },
      };

      const result = await exportAudio(request, contextWithClick);
      const buffer = await result.blob.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(zip.files);

      expect(fileNames).toHaveLength(5);
      expect(fileNames).toContain("test_track_click_track.wav");
      for (const stem of STEM_NAMES) {
        expect(fileNames).toContain(`test_track_${stem}.wav`);
      }
    });

    it("scales Click Track beat times by the active tempo stretch factor", async () => {
      const request: BundleExportRequest = {
        mode: "bundle",
        format: "wav",
        includeClickTrack: true,
        applyAdjustments: true,
      };

      const contextWithStretch: ExportContext = {
        ...mockContext,
        timeStretch: {
          tempo: 1.25,
          pitch: 0,
        },
        clickTrack: {
          beatGrid: new Float64Array([1.0, 2.0]),
          settings: {
            volume: 1.0,
            enabled: true,
          },
        },
      };

      const result = await exportAudio(request, contextWithStretch);
      const buffer = await result.blob.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      expect(zip.files["test_track_click_track.wav"]).toBeDefined();
    });

    it("throws when any stem is missing in bundle mode", async () => {
      const badContext: ExportContext = {
        ...mockContext,
        stems: { ...mockContext.stems, drums: undefined as any },
      };

      const request: BundleExportRequest = {
        mode: "bundle",
        format: "wav",
      };

      await expect(exportAudio(request, badContext)).rejects.toThrow(
        'Stem "drums" is missing from stems set.'
      );
    });
  });

  describe("Offline Time-Stretch Integration", () => {
    it("invokes renderOfflineStems when applyAdjustments: true and active adjustments exist", async () => {
      const renderSpy = vi.spyOn(signalsmithAdapter, "renderOfflineStems");

      const request: SingleStemExportRequest = {
        mode: "single",
        stem: "vocals",
        format: "wav",
        applyAdjustments: true,
      };

      const contextWithAdjustments: ExportContext = {
        ...mockContext,
        timeStretch: {
          tempo: 1.2,
          pitch: 2,
        },
      };

      await exportAudio(request, contextWithAdjustments);
      expect(renderSpy).toHaveBeenCalledWith(
        expect.objectContaining({ vocals: expect.any(Array) }),
        expect.objectContaining({ tempo: 1.2, pitch: 2 })
      );
    });

    it("bypasses renderOfflineStems when applyAdjustments is false even if adjustments exist in context", async () => {
      const renderSpy = vi.spyOn(signalsmithAdapter, "renderOfflineStems");

      const request: SingleStemExportRequest = {
        mode: "single",
        stem: "vocals",
        format: "wav",
        applyAdjustments: false,
      };

      const contextWithAdjustments: ExportContext = {
        ...mockContext,
        timeStretch: {
          tempo: 1.2,
          pitch: 2,
        },
      };

      await exportAudio(request, contextWithAdjustments);
      expect(renderSpy).not.toHaveBeenCalled();
    });
  });

  describe("Custom Mixdown Export", () => {
    it("renders a summed WAV audio file with correct semantic descriptor for karaoke", async () => {
      const request: MixdownExportRequest = {
        mode: "mixdown",
        format: "wav",
        stemGains: {
          vocals: 0.0,
          drums: 1.0,
          bass: 1.0,
          other: 1.0,
        },
        masterGain: 1.0,
        antiClipping: true,
      };

      const result = await exportAudio(request, mockContext);
      expect(result.fileName).toBe("test_track_karaoke.wav");
      expect(result.descriptor).toBe("karaoke");
      expect(result.mimeType).toBe("audio/wav");
      expect(result.blob).toBeInstanceOf(Blob);

      const buffer = await result.blob.arrayBuffer();
      const view = new DataView(buffer);
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      expect(riff).toBe("RIFF");
    });

    it("renders a summed MP3 audio file with correct semantic descriptor for acapella", async () => {
      const request: MixdownExportRequest = {
        mode: "mixdown",
        format: "mp3",
        bitrate: 192,
        stemGains: {
          vocals: 1.0,
          drums: 0.0,
          bass: 0.0,
          other: 0.0,
        },
        masterGain: 1.0,
        antiClipping: true,
      };

      const progressSpy = vi.fn();
      const result = await exportAudio(request, mockContext, {
        onProgress: progressSpy,
      });

      expect(result.fileName).toBe("test_track_acapella.mp3");
      expect(result.descriptor).toBe("acapella");
      expect(result.mimeType).toBe("audio/mp3");
      expect(result.blob).toBeInstanceOf(Blob);
      expect(progressSpy).toHaveBeenCalledWith(100, "Export complete");
    });

    it("supports preferInstrumental option for no-vocals mixdown", async () => {
      const request: MixdownExportRequest = {
        mode: "mixdown",
        format: "wav",
        stemGains: {
          vocals: 0.0,
          drums: 1.0,
          bass: 1.0,
          other: 1.0,
        },
        masterGain: 1.0,
        antiClipping: true,
        preferInstrumental: true,
      };

      const result = await exportAudio(request, mockContext);
      expect(result.fileName).toBe("test_track_instrumental.wav");
      expect(result.descriptor).toBe("instrumental");
    });

    it("applies anti-clipping normalization when summed peaks exceed -0.3 dBFS ceiling", async () => {
      // Create high-amplitude stems that sum to well above 1.0 (clipping)
      const hotContext: ExportContext = {
        ...mockContext,
        stems: {
          vocals: [
            new Float32Array(sampleCount).fill(0.6),
            new Float32Array(sampleCount).fill(0.6),
          ],
          drums: [
            new Float32Array(sampleCount).fill(0.6),
            new Float32Array(sampleCount).fill(0.6),
          ],
          bass: [
            new Float32Array(sampleCount).fill(0.6),
            new Float32Array(sampleCount).fill(0.6),
          ],
          other: [
            new Float32Array(sampleCount).fill(0.6),
            new Float32Array(sampleCount).fill(0.6),
          ],
        },
      };

      const request: MixdownExportRequest = {
        mode: "mixdown",
        format: "wav",
        bitDepth: 16,
        stemGains: {
          vocals: 1.0,
          drums: 1.0,
          bass: 1.0,
          other: 1.0,
        },
        masterGain: 1.0,
        antiClipping: true,
      };

      const result = await exportAudio(request, hotContext);
      expect(result.blob).toBeInstanceOf(Blob);

      // Verify samples in the resulting WAV
      const buffer = await result.blob.arrayBuffer();
      const view = new DataView(buffer);
      // Data chunk starts after 44-byte header for standard 16-bit PCM
      // Check maximum 16-bit integer sample
      let maxSample = 0;
      for (let offset = 44; offset < buffer.byteLength; offset += 2) {
        const sample = Math.abs(view.getInt16(offset, true));
        if (sample > maxSample) {
          maxSample = sample;
        }
      }

      // Max possible 16-bit sample is 32767.
      // -0.3 dBFS corresponds to ~32767 * 0.96605088 ≈ 31654.
      // If antiClipping worked, maxSample should not exceed ~31660.
      expect(maxSample).toBeLessThanOrEqual(31660);
    });

    it("applies offline time-stretch only to enabled mixdown stems", async () => {
      const renderSpy = vi.spyOn(signalsmithAdapter, "renderOfflineStems");

      const request: MixdownExportRequest = {
        mode: "mixdown",
        format: "wav",
        stemGains: {
          vocals: 0.0, // muted
          drums: 0.8,
          bass: 1.0,
          other: 0.0, // muted
        },
        masterGain: 1.0,
        antiClipping: true,
        applyAdjustments: true,
      };

      const contextWithAdjustments: ExportContext = {
        ...mockContext,
        timeStretch: {
          tempo: 1.15,
          pitch: -1,
        },
      };

      await exportAudio(request, contextWithAdjustments);
      expect(renderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          drums: expect.any(Array),
          bass: expect.any(Array),
        }),
        expect.objectContaining({ tempo: 1.15, pitch: -1 })
      );
      // Vocals and other should not be passed to offline render
      const calledStems = renderSpy.mock.calls[0][0];
      expect(calledStems.vocals).toBeUndefined();
      expect(calledStems.other).toBeUndefined();
    });

    it("rejects cleanly with AbortError when cancelled during mixdown", async () => {
      const controller = new AbortController();

      const request: MixdownExportRequest = {
        mode: "mixdown",
        format: "mp3",
        stemGains: {
          vocals: 1.0,
          drums: 1.0,
          bass: 1.0,
          other: 1.0,
        },
        masterGain: 1.0,
        antiClipping: true,
      };

      const exportPromise = exportAudio(request, mockContext, {
        signal: controller.signal,
        onProgress: () => {
          controller.abort();
        },
      });

      await expect(exportPromise).rejects.toThrow();
      try {
        await exportPromise;
      } catch (err: any) {
        expect(err.name).toBe("AbortError");
      }
    });
  });

  describe("Domain Presets & Helpers", () => {
    it("exposes MIXDOWN_PRESETS with expected preset IDs and labels", () => {
      expect(MIXDOWN_PRESETS).toHaveLength(4);
      expect(MIXDOWN_PRESETS.map((p) => p.id)).toEqual([
        "karaoke",
        "acapella",
        "minus_drums",
        "reset",
      ]);
    });

    it("computes initial stem controls with default values when initialMixerStates is undefined", () => {
      const controls = computeInitialStemControls();
      expect(controls).toEqual(DEFAULT_STEM_CONTROLS);
      expect(controls.vocals.enabled).toBe(true);
      expect(controls.vocals.volume).toBe(1.0);
    });

    it("respects solo and mute mixer states when computing initial stem controls", () => {
      const mixerStates: any = {
        vocals: { volume: 0.8, muted: false, solo: true, pan: 0 },
        drums: { volume: 1.0, muted: false, solo: false, pan: 0 },
        bass: { volume: 0.5, muted: true, solo: false, pan: 0 },
        other: { volume: 0.9, muted: false, solo: false, pan: 0 },
      };

      const controls = computeInitialStemControls(mixerStates);
      // Because vocals is soloed:
      expect(controls.vocals.enabled).toBe(true);
      expect(controls.vocals.volume).toBe(0.8);
      // Others should not be heard
      expect(controls.drums.enabled).toBe(false);
      expect(controls.bass.enabled).toBe(false);
      expect(controls.other.enabled).toBe(false);
    });
  });
});
