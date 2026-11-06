import { StemName } from "./chunkOverlapAdd";
import { ModelId, ModelProfile, getModelProfile } from "./modelConfig";
import type {
  WorkerInMessage,
  WorkerOutMessage,
} from "../workers/inference.worker";

export type SeparationSource =
  AudioBuffer | { channels: Float32Array[]; sampleRate: number };

export interface SeparationProgressDownloading {
  stage: "downloading";
  loadedBytes: number;
  totalBytes: number;
  progress: number;
}

export interface SeparationProgressInitializing {
  stage: "initializing";
  backend: "webgpu" | "wasm" | "mock";
}

export interface SeparationProgressSeparating {
  stage: "separating";
  chunkIndex: number;
  totalChunks: number;
  progress: number;
  elapsedMs: number;
  etaMs: number;
}

export type SeparationProgressEvent =
  | SeparationProgressDownloading
  | SeparationProgressInitializing
  | SeparationProgressSeparating;

export type SeparationUiState =
  | { status: "idle" }
  | { status: "active"; event: SeparationProgressEvent }
  | { status: "error"; error: string };

export interface SeparationResult {
  stems: Record<StemName, Float32Array[]>;
  duration: number;
  sampleRate: number;
  modelProfileId: ModelId;
  backend: "webgpu" | "wasm" | "mock";
}

export interface SeparationRequest {
  source: SeparationSource;
  modelProfileId?: ModelId;
  preferredBackend?: "webgpu" | "wasm";
}

export interface SeparationOptions {
  signal?: AbortSignal;
  onProgress?: (event: SeparationProgressEvent) => void;
}

export type SeparationErrorCode =
  "OOM" | "BACKEND_UNAVAILABLE" | "MODEL_LOAD_FAILED" | "INFERENCE_FAILED";

export class SeparationError extends Error {
  public readonly code: SeparationErrorCode;

  constructor(code: SeparationErrorCode, message: string) {
    super(message);
    this.name = "SeparationError";
    this.code = code;
  }
}

export function mapToSeparationError(errorMessage: string): SeparationError {
  const lower = errorMessage.toLowerCase();
  if (
    lower.includes("std::bad_alloc") ||
    lower.includes("out of memory") ||
    lower.includes("allocation failed") ||
    lower.includes("heap") ||
    /\boom\b/.test(lower)
  ) {
    return new SeparationError("OOM", errorMessage);
  }
  if (
    lower.includes("webgpu") ||
    lower.includes("adapter") ||
    lower.includes("device lost") ||
    lower.includes("backend unavailable") ||
    lower.includes("not supported in this environment")
  ) {
    return new SeparationError("BACKEND_UNAVAILABLE", errorMessage);
  }
  if (
    lower.includes("model") ||
    lower.includes("weights") ||
    lower.includes("download") ||
    lower.includes("fetch") ||
    lower.includes("cache") ||
    lower.includes("network") ||
    lower.includes("404")
  ) {
    return new SeparationError("MODEL_LOAD_FAILED", errorMessage);
  }
  return new SeparationError("INFERENCE_FAILED", errorMessage);
}

export interface SeparationEngineConfig {
  useMock?: boolean;
  workerFactory?: () => Worker;
}

export interface SeparationEngine {
  separate(
    request: SeparationRequest,
    options?: SeparationOptions
  ): Promise<SeparationResult>;
  dispose(): void;
}

function extractAudioData(source: SeparationSource): {
  channels: Float32Array[];
  sampleRate: number;
  duration: number;
} {
  if (
    "numberOfChannels" in source &&
    typeof (source as AudioBuffer).getChannelData === "function"
  ) {
    const audioBuffer = source as AudioBuffer;
    const channels: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }
    const sampleRate = audioBuffer.sampleRate;
    const duration =
      audioBuffer.duration ??
      (channels[0]?.length ?? 0) / (sampleRate || 44100);
    return { channels, sampleRate, duration };
  } else {
    const raw = source as { channels: Float32Array[]; sampleRate: number };
    const channels = raw.channels;
    const sampleRate = raw.sampleRate;
    const duration = (channels[0]?.length ?? 0) / (sampleRate || 44100);
    return { channels, sampleRate, duration };
  }
}

export function createSeparationEngine(
  config: SeparationEngineConfig = {}
): SeparationEngine {
  const isMock =
    config.useMock ??
    (typeof process !== "undefined" && process.env?.NODE_ENV === "test");

  const workerFactory =
    config.workerFactory ??
    (() => {
      if (typeof Worker === "undefined") {
        throw new SeparationError(
          "BACKEND_UNAVAILABLE",
          "Web Workers are not supported in this environment"
        );
      }
      return new Worker(
        new URL("../workers/inference.worker.ts", import.meta.url),
        { type: "module" }
      );
    });

  let worker: Worker | null = null;
  let activeProfileId: ModelId | null = null;
  let activeBackend: "webgpu" | "wasm" | "mock" | null = null;
  let isProcessing = false;
  let activeReject: ((err: unknown) => void) | null = null;

  function ensureWorker(): Worker {
    if (!worker) {
      worker = workerFactory();
      activeProfileId = null;
      activeBackend = null;
    }
    return worker;
  }

  return {
    async separate(
      request: SeparationRequest,
      options: SeparationOptions = {}
    ): Promise<SeparationResult> {
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted", "AbortError");
      }

      if (isProcessing) {
        throw new SeparationError(
          "INFERENCE_FAILED",
          "Separation engine is already processing a task"
        );
      }

      isProcessing = true;

      const profile: ModelProfile = getModelProfile(
        request.modelProfileId ?? "bs-roformer-4stem"
      );
      const audioData = extractAudioData(request.source);

      return new Promise<SeparationResult>((resolve, reject) => {
        activeReject = reject;
        let currentWorker: Worker;

        try {
          currentWorker = ensureWorker();
        } catch (err) {
          isProcessing = false;
          activeReject = null;
          return reject(
            err instanceof SeparationError
              ? err
              : new SeparationError(
                  "BACKEND_UNAVAILABLE",
                  err instanceof Error ? err.message : String(err)
                )
          );
        }

        const onAbort = () => {
          if (currentWorker) {
            currentWorker.postMessage({
              type: "cancel",
            } satisfies WorkerInMessage);
          }
          cleanup();
          reject(new DOMException("The operation was aborted", "AbortError"));
        };

        if (options.signal) {
          options.signal.addEventListener("abort", onAbort, { once: true });
        }

        const cleanup = () => {
          isProcessing = false;
          activeReject = null;
          if (options.signal) {
            options.signal.removeEventListener("abort", onAbort);
          }
        };

        const backendMismatch =
          request.preferredBackend !== undefined &&
          activeBackend !== "mock" &&
          activeBackend !== null &&
          request.preferredBackend !== activeBackend;

        const needsInit =
          activeProfileId !== profile.id ||
          activeBackend === null ||
          backendMismatch;

        currentWorker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
          const data = event.data;
          if (!data) return;

          switch (data.type) {
            case "download_progress":
              options.onProgress?.({
                stage: "downloading",
                loadedBytes: data.loadedBytes,
                totalBytes: data.totalBytes,
                progress: data.progress,
              });
              break;

            case "init_complete":
              activeBackend = data.backend;
              activeProfileId = profile.id;
              options.onProgress?.({
                stage: "initializing",
                backend: data.backend,
              });

              // Now start inference
              currentWorker.postMessage({
                type: "start",
                audio: audioData.channels,
                sampleRate: audioData.sampleRate,
              } satisfies WorkerInMessage);
              break;

            case "chunk_start":
              options.onProgress?.({
                stage: "separating",
                chunkIndex: data.chunkIndex,
                totalChunks: data.totalChunks,
                progress: data.chunkIndex / Math.max(1, data.totalChunks),
                elapsedMs: 0,
                etaMs: 0,
              });
              break;

            case "chunk_progress":
              options.onProgress?.({
                stage: "separating",
                chunkIndex: data.chunkIndex,
                totalChunks: data.totalChunks,
                progress: data.progress,
                elapsedMs: data.elapsedMs,
                etaMs: data.etaMs,
              });
              break;

            case "complete":
              cleanup();
              resolve({
                stems: data.stems,
                duration: data.duration ?? audioData.duration,
                sampleRate: audioData.sampleRate,
                modelProfileId: profile.id,
                backend: activeBackend ?? "mock",
              });
              break;

            case "cancelled":
              cleanup();
              reject(
                new DOMException(
                  "Separation was cancelled by user",
                  "AbortError"
                )
              );
              break;

            case "error":
              cleanup();
              reject(mapToSeparationError(data.error));
              break;

            case "worker_log":
              // Worker internal logging
              break;
          }
        };

        currentWorker.onerror = (err) => {
          cleanup();
          const msg =
            (err as ErrorEvent)?.message ||
            (err as unknown as Error)?.message ||
            "Worker runtime error (uncaught exception or OOM crash)";
          reject(mapToSeparationError(msg));
        };

        if (needsInit) {
          currentWorker.postMessage({
            type: "init",
            modelUrl: profile.modelUrl,
            modelProfileId: profile.id,
            useMock: isMock,
            preferredBackend: request.preferredBackend,
          } satisfies WorkerInMessage);
        } else {
          // Model profile is already loaded & backend ready — reuse immediately
          options.onProgress?.({
            stage: "initializing",
            backend: activeBackend!,
          });

          currentWorker.postMessage({
            type: "start",
            audio: audioData.channels,
            sampleRate: audioData.sampleRate,
          } satisfies WorkerInMessage);
        }
      });
    },

    dispose(): void {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      activeProfileId = null;
      activeBackend = null;
      isProcessing = false;
      if (activeReject) {
        activeReject(
          new DOMException("The operation was aborted", "AbortError")
        );
        activeReject = null;
      }
    },
  };
}
