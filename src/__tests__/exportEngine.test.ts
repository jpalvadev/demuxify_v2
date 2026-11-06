import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import {
  exportAudio,
  ExportContext,
  SingleStemExportRequest,
  BundleExportRequest,
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

  describe("Cancellation with AbortSignal", () => {
    it("rejects immediately with AbortError if pre-aborted signal is passed", async () => {
      const controller = new AbortController();
      controller.abort();

      const request: SingleStemExportRequest = {
        mode: "single",
        stem: "vocals",
        format: "wav",
      };

      await expect(
        exportAudio(request, mockContext, { signal: controller.signal })
      ).rejects.toThrow();

      try {
        await exportAudio(request, mockContext, { signal: controller.signal });
      } catch (err: any) {
        expect(err.name).toBe("AbortError");
      }
    });

    it("rejects with AbortError when aborted mid-flight", async () => {
      const controller = new AbortController();

      const request: BundleExportRequest = {
        mode: "bundle",
        format: "mp3",
      };

      const exportPromise = exportAudio(request, mockContext, {
        signal: controller.signal,
        onProgress: (p) => {
          if (p >= 10) {
            controller.abort();
          }
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
});
