import { StemName, STEM_NAMES } from "./chunkOverlapAdd";
import {
  ClickTrackMixerState,
  synthesizeClickTrackChannel,
} from "./stemPlayerEngine";
import { encodeWav, createWavBlob } from "./wavEncoder";
import {
  encodeMp3,
  createMp3Blob,
  Mp3Bitrate,
  VALID_MP3_BITRATES,
} from "./mp3Encoder";
import {
  createStemBundleZip,
  formatStemFileName,
  formatClickTrackFileName,
  sanitizeSourceMixTitle,
} from "./bundleZip";
import { MixdownDescriptor } from "./customMixdown";
import { renderOfflineStems } from "./signalsmithStretchAdapter";

export { VALID_MP3_BITRATES };

export type ExportFormat = "wav" | "mp3";
export type ExportMode = "single" | "bundle" | "mixdown";

export interface SingleStemExportRequest {
  mode: "single";
  stem: StemName;
  format: ExportFormat;
  bitDepth?: 16 | 24;
  bitrate?: Mp3Bitrate;
  applyAdjustments?: boolean;
}

export interface BundleExportRequest {
  mode: "bundle";
  format: ExportFormat;
  bitDepth?: 16 | 24;
  bitrate?: Mp3Bitrate;
  applyAdjustments?: boolean;
  includeClickTrack?: boolean;
}

export interface MixdownExportRequest {
  mode: "mixdown";
  format: ExportFormat;
  bitDepth?: 16 | 24;
  bitrate?: Mp3Bitrate;
  applyAdjustments?: boolean;
  stemGains: Record<StemName, number>;
  masterGain: number;
  antiClipping: boolean;
  preferInstrumental?: boolean;
}

export type ExportRequest =
  SingleStemExportRequest | BundleExportRequest | MixdownExportRequest;

export interface ExportContext {
  stems: Record<StemName, Float32Array[] | AudioBuffer>;
  sampleRate: number;
  sourceMixTitle: string;
  timeStretch?: {
    tempo: number;
    pitch: number;
    formantPreservation?: boolean;
  };
  clickTrack?: {
    beatGrid?: Float64Array | null;
    settings?: ClickTrackMixerState | null;
  };
}

export interface ExportOptions {
  onProgress?: (progress: number, stageMessage: string) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  descriptor?: MixdownDescriptor;
}

export function extractChannels(
  source: Float32Array[] | AudioBuffer
): Float32Array[] {
  if ("numberOfChannels" in source) {
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < source.numberOfChannels; ch++) {
      channels.push(source.getChannelData(ch));
    }
    return channels;
  }
  return source;
}

export function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    if (signal.reason instanceof Error) {
      if (!signal.reason.name || signal.reason.name === "Error") {
        signal.reason.name = "AbortError";
      }
      throw signal.reason;
    }
    const err = new Error(
      typeof signal.reason === "string"
        ? signal.reason
        : "The operation was aborted"
    );
    err.name = "AbortError";
    throw err;
  }
}

export async function runWithAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return promise;
  checkAborted(signal);

  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => {
      try {
        checkAborted(signal);
      } catch (err) {
        reject(err);
      }
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

/**
 * Headless Export Engine entry point: coordinates offline time-stretch rendering,
 * stem encoding (WAV/MP3), click track synthesis, and ZIP bundle packaging.
 */
export async function exportAudio(
  request: ExportRequest,
  context: ExportContext,
  options?: ExportOptions
): Promise<ExportResult> {
  checkAborted(options?.signal);

  const { stems, sampleRate, sourceMixTitle, timeStretch, clickTrack } =
    context;
  const activeTempo = timeStretch?.tempo ?? 1.0;
  const activePitch = timeStretch?.pitch ?? 0;
  const activeFormantPreservation = timeStretch?.formantPreservation ?? true;

  const hasActiveAdjustments =
    Math.abs(activeTempo - 1.0) > 1e-3 || Math.abs(activePitch) > 1e-3;

  let exportStems = stems;

  if (request.applyAdjustments && hasActiveAdjustments) {
    options?.onProgress?.(5, "Applying active pitch and tempo adjustments...");
    checkAborted(options?.signal);

    let stemsToRender: Partial<Record<StemName, Float32Array[] | AudioBuffer>> =
      stems;
    if (request.mode === "single") {
      stemsToRender = { [request.stem]: stems[request.stem] };
    } else if (request.mode === "mixdown") {
      stemsToRender = {};
      for (const name of STEM_NAMES) {
        if (request.stemGains[name] && request.stemGains[name] > 0) {
          stemsToRender[name] = stems[name];
        }
      }
    }

    const rendered = await runWithAbort(
      renderOfflineStems(
        stemsToRender as Record<StemName, Float32Array[] | AudioBuffer>,
        {
          sampleRate,
          tempo: activeTempo,
          pitch: activePitch,
          formantPreservation: activeFormantPreservation,
        }
      ),
      options?.signal
    );
    checkAborted(options?.signal);
    exportStems = { ...stems, ...rendered };
  }

  if (request.mode === "single") {
    options?.onProgress?.(20, `Encoding ${request.stem}...`);
    checkAborted(options?.signal);

    const stemData = exportStems[request.stem];
    if (!stemData) {
      throw new Error(`Stem "${request.stem}" is not available.`);
    }

    const channels = extractChannels(stemData);
    let blob: Blob;
    let fileName: string;

    if (request.format === "wav") {
      options?.onProgress?.(40, `Encoding ${request.stem}...`);
      checkAborted(options?.signal);
      blob = createWavBlob(channels, {
        sampleRate,
        bitDepth: request.bitDepth ?? 16,
      });
      fileName = formatStemFileName(sourceMixTitle, request.stem, "wav");
      options?.onProgress?.(100, "Export complete");
    } else {
      fileName = formatStemFileName(sourceMixTitle, request.stem, "mp3");
      blob = await runWithAbort(
        createMp3Blob(channels, {
          sampleRate,
          bitrate: request.bitrate ?? 192,
          onProgress: (p) => {
            checkAborted(options?.signal);
            options?.onProgress?.(
              Math.round(20 + p * 80),
              `Encoding ${request.stem}...`
            );
          },
        }),
        options?.signal
      );
      options?.onProgress?.(100, "Export complete");
    }

    checkAborted(options?.signal);
    return {
      blob,
      fileName,
      mimeType:
        blob.type || (request.format === "wav" ? "audio/wav" : "audio/mp3"),
    };
  }

  if (request.mode === "bundle") {
    options?.onProgress?.(10, "Encoding all 4 stems for bundle packaging...");
    checkAborted(options?.signal);

    const encodedStems: Record<StemName, Uint8Array> = {} as any;
    const stemCount = STEM_NAMES.length;

    for (let i = 0; i < stemCount; i++) {
      checkAborted(options?.signal);
      const stemName = STEM_NAMES[i];
      const stemData = exportStems[stemName];
      if (!stemData) {
        throw new Error(`Stem "${stemName}" is missing from stems set.`);
      }

      const channels = extractChannels(stemData);
      options?.onProgress?.(
        Math.round(10 + (i / stemCount) * 65),
        `Encoding ${stemName} (${i + 1}/${stemCount})...`
      );

      if (request.format === "wav") {
        encodedStems[stemName] = encodeWav(channels, {
          sampleRate,
          bitDepth: request.bitDepth ?? 16,
        });
        options?.onProgress?.(
          Math.round(10 + ((i + 1) / stemCount) * 65),
          `Encoding ${stemName} (${i + 1}/${stemCount})...`
        );
      } else {
        const startPct = 10 + (i / stemCount) * 65;
        const rangePct = 65 / stemCount;
        encodedStems[stemName] = await runWithAbort(
          encodeMp3(channels, {
            sampleRate,
            bitrate: request.bitrate ?? 192,
            onProgress: (subP) => {
              checkAborted(options?.signal);
              options?.onProgress?.(
                Math.round(startPct + subP * rangePct),
                `Encoding ${stemName} (${i + 1}/${stemCount})...`
              );
            },
          }),
          options?.signal
        );
      }
    }

    checkAborted(options?.signal);

    let clickTrackBytes: Uint8Array | undefined;
    const clickLaneLive = Boolean(
      request.includeClickTrack &&
      clickTrack?.settings?.enabled &&
      clickTrack?.beatGrid?.length
    );

    if (clickLaneLive && clickTrack?.beatGrid && clickTrack?.settings) {
      options?.onProgress?.(
        75,
        `Encoding ${formatClickTrackFileName(sourceMixTitle, request.format)}...`
      );
      const stretchFactor =
        request.applyAdjustments && hasActiveAdjustments && activeTempo
          ? activeTempo
          : 1.0;
      const clickGrid = Float64Array.from(
        Array.from(clickTrack.beatGrid).map((t) => t / stretchFactor)
      );
      const exportChannel = extractChannels(exportStems[STEM_NAMES[0]])[0];
      const clickDurationSec =
        (exportChannel?.length ?? 0) / (sampleRate || 44100);
      const clickChannels = [
        synthesizeClickTrackChannel(clickGrid, sampleRate, clickDurationSec),
      ];
      clickTrackBytes =
        request.format === "wav"
          ? encodeWav(clickChannels, {
              sampleRate,
              bitDepth: request.bitDepth ?? 16,
            })
          : await runWithAbort(
              encodeMp3(clickChannels, {
                sampleRate,
                bitrate: request.bitrate ?? 192,
                onProgress: (p) => {
                  checkAborted(options?.signal);
                  options?.onProgress?.(
                    Math.round(75 + p * 15),
                    `Encoding ${formatClickTrackFileName(sourceMixTitle, request.format)}...`
                  );
                },
              }),
              options?.signal
            );
    }

    checkAborted(options?.signal);
    options?.onProgress?.(90, "Packaging ZIP bundle...");

    const zipBlob = await runWithAbort(
      createStemBundleZip(encodedStems, {
        sourceMixTitle,
        format: request.format,
        clickTrack: clickTrackBytes,
        onProgress: (zipPct) => {
          checkAborted(options?.signal);
          options?.onProgress?.(
            Math.round(90 + zipPct * 0.1),
            "Packaging ZIP bundle..."
          );
        },
      }),
      options?.signal
    );

    checkAborted(options?.signal);
    options?.onProgress?.(100, "Export complete");

    const zipFileName = `${sanitizeSourceMixTitle(sourceMixTitle)}_stems.zip`;
    return {
      blob: zipBlob,
      fileName: zipFileName,
      mimeType: "application/zip",
    };
  }

  // mode: "mixdown" - stub for Ticket 01, completed in Ticket 02
  throw new Error(`Mode "${(request as any).mode}" not yet implemented.`);
}
