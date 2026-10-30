import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";
import {
  createStemBundleZip,
  formatStemFileName,
  sanitizeSourceMixTitle,
} from "../lib/bundleZip";
import { STEM_NAMES, StemName } from "../lib/chunkOverlapAdd";

describe("bundleZip", () => {
  describe("naming utilities", () => {
    it("sanitizes source mix titles by stripping audio extensions and illegal path characters", () => {
      expect(sanitizeSourceMixTitle("audioslave_stone.mp3")).toBe(
        "audioslave_stone"
      );
      expect(sanitizeSourceMixTitle("My Mix (Original Mix).wav")).toBe(
        "My Mix (Original Mix)"
      );
      expect(sanitizeSourceMixTitle("Source: Title/Name?*")).toBe(
        "Source_ Title_Name__"
      );
      expect(sanitizeSourceMixTitle("")).toBe("track");
    });

    it("formats stem file names according to specification", () => {
      expect(formatStemFileName("audioslave_stone.mp3", "vocals", "wav")).toBe(
        "audioslave_stone_vocals.wav"
      );
      expect(formatStemFileName("audioslave_stone", "drums", "mp3")).toBe(
        "audioslave_stone_drums.mp3"
      );
      expect(formatStemFileName("track", "bass", "wav")).toBe("track_bass.wav");
      expect(formatStemFileName("track", "other", "mp3")).toBe(
        "track_other.mp3"
      );
    });
  });

  describe("createStemBundleZip", () => {
    it("creates a valid ZIP archive containing all 4 stems with PKZIP header", async () => {
      const mockStems: Record<StemName, Uint8Array> = {
        vocals: new Uint8Array([1, 2, 3]),
        drums: new Uint8Array([4, 5, 6]),
        bass: new Uint8Array([7, 8, 9]),
        other: new Uint8Array([10, 11, 12]),
      };

      const progressSpy = vi.fn();
      const zipBlob = await createStemBundleZip(mockStems, {
        sourceMixTitle: "audioslave_stone.mp3",
        format: "wav",
        onProgress: progressSpy,
      });

      expect(zipBlob).toBeInstanceOf(Blob);
      expect(zipBlob.type).toBe("application/zip");
      expect(progressSpy).toHaveBeenCalled();

      // Check PKZIP magic number (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
      const buffer = await zipBlob.arrayBuffer();
      const header = new Uint8Array(buffer, 0, 4);
      expect(header[0]).toBe(0x50);
      expect(header[1]).toBe(0x4b);
      expect(header[2]).toBe(0x03);
      expect(header[3]).toBe(0x04);

      // Verify zip contents using JSZip
      const unzipped = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(unzipped.files);

      expect(fileNames).toHaveLength(4);
      for (const stem of STEM_NAMES) {
        const expectedName = `audioslave_stone_${stem}.wav`;
        expect(fileNames).toContain(expectedName);

        const content = await unzipped.file(expectedName)?.async("uint8array");
        expect(content).toEqual(mockStems[stem]);
      }
    });

    it("works with MP3 format and Blob inputs", async () => {
      const mockStems: Record<StemName, Blob> = {
        vocals: new Blob([new Uint8Array([10])], { type: "audio/mp3" }),
        drums: new Blob([new Uint8Array([20])], { type: "audio/mp3" }),
        bass: new Blob([new Uint8Array([30])], { type: "audio/mp3" }),
        other: new Blob([new Uint8Array([40])], { type: "audio/mp3" }),
      };

      const zipBlob = await createStemBundleZip(mockStems, {
        sourceMixTitle: "RockTrack",
        format: "mp3",
      });

      const buffer = await zipBlob.arrayBuffer();
      const unzipped = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(unzipped.files);

      expect(fileNames).toEqual(
        expect.arrayContaining([
          "RockTrack_vocals.mp3",
          "RockTrack_drums.mp3",
          "RockTrack_bass.mp3",
          "RockTrack_other.mp3",
        ])
      );
    });

    it("includes bundle manifest when model profile metadata is provided", async () => {
      const mockStems: Record<StemName, Uint8Array> = {
        vocals: new Uint8Array([1]),
        drums: new Uint8Array([2]),
        bass: new Uint8Array([3]),
        other: new Uint8Array([4]),
      };

      const zipBlob = await createStemBundleZip(mockStems, {
        sourceMixTitle: "RockTrack",
        format: "wav",
        modelProfileId: "htdemucs-4stem",
        modelProfileName: "HT-Demucs 4-Stem",
      });

      const zip = await JSZip.loadAsync(zipBlob);
      const manifestFile = zip.file("bundle_manifest.json");
      expect(manifestFile).not.toBeNull();
      const content = JSON.parse(await manifestFile!.async("text"));
      expect(content.modelProfileId).toBe("htdemucs-4stem");
      expect(content.modelProfileName).toBe("HT-Demucs 4-Stem");
      expect(content.stems).toEqual(["vocals", "drums", "bass", "other"]);
    });

    it("throws error if any of the 4 stems are missing", async () => {
      const incomplete = {
        vocals: new Uint8Array([1]),
        drums: new Uint8Array([2]),
      } as any;

      await expect(createStemBundleZip(incomplete)).rejects.toThrow(
        /missing stem/i
      );
    });
  });
});
