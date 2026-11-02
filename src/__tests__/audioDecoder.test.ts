import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  decodeAudio,
  DecodedSourceMix,
  SourceMixMetadata,
} from "../lib/audioDecoder";

describe("audioDecoder", () => {
  let mockAudioContext: any;
  let mockAudioBuffer: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAudioBuffer = {
      duration: 124.5,
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 124.5 * 44100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(1000)),
    };

    mockAudioContext = {
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
      close: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("decodes a valid File and extracts full metadata", async () => {
    const file = new File(["dummy binary audio data"], "test_mix.wav", {
      type: "audio/wav",
    });

    const result: DecodedSourceMix = await decodeAudio(file, {
      audioContext: mockAudioContext,
    });

    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(result.buffer).toBe(mockAudioBuffer);
    const expectedMetadata: SourceMixMetadata = {
      fileName: "test_mix.wav",
      fileSize: file.size,
      duration: 124.5,
      sampleRate: 44100,
      numberOfChannels: 2,
    };
    expect(result.metadata).toEqual(expectedMetadata);
  });

  it("decodes an ArrayBuffer with optional metadata overrides", async () => {
    const arrayBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;

    const result = await decodeAudio(arrayBuffer, {
      audioContext: mockAudioContext,
      fileName: "imported_track.flac",
      fileSize: 8,
    });

    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(result.metadata.fileName).toBe("imported_track.flac");
    expect(result.metadata.fileSize).toBe(8);
    expect(result.metadata.duration).toBe(124.5);
    expect(result.metadata.numberOfChannels).toBe(2);
  });

  it("provides default filename and computes byteLength for ArrayBuffer when omitted", async () => {
    const arrayBuffer = new Uint8Array([10, 20, 30, 40]).buffer;

    const result = await decodeAudio(arrayBuffer, {
      audioContext: mockAudioContext,
    });

    expect(result.metadata.fileName).toBe("Source Mix");
    expect(result.metadata.fileSize).toBe(4);
  });

  it("throws descriptive error when audio file is corrupted or decodeAudioData fails", async () => {
    mockAudioContext.decodeAudioData.mockRejectedValue(
      new DOMException(
        "Unable to decode audio data: Corrupt header",
        "EncodingError"
      )
    );

    const corruptedFile = new File(["corrupted content"], "corrupted.mp3", {
      type: "audio/mp3",
    });

    await expect(
      decodeAudio(corruptedFile, { audioContext: mockAudioContext })
    ).rejects.toThrow(/Failed to decode audio file "corrupted.mp3"/i);
  });

  it("rejects empty audio files with a descriptive error", async () => {
    const emptyFile = new File([], "empty.wav", { type: "audio/wav" });

    await expect(
      decodeAudio(emptyFile, { audioContext: mockAudioContext })
    ).rejects.toThrow(/Audio file "empty.wav" is empty/i);
  });

  it("throws error when AudioContext is not supported", async () => {
    const originalAudioContext = window.AudioContext;
    const originalWebkit = (window as any).webkitAudioContext;
    (window as any).AudioContext = undefined;
    (window as any).webkitAudioContext = undefined;

    try {
      const file = new File(["12345"], "sample.wav", { type: "audio/wav" });
      await expect(decodeAudio(file)).rejects.toThrow(
        /Web Audio API \(AudioContext\) is not supported in this browser/i
      );
    } finally {
      window.AudioContext = originalAudioContext;
      (window as any).webkitAudioContext = originalWebkit;
    }
  });
});
