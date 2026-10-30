import { StemName, ChunkOptions } from "./chunkOverlapAdd";
import { DownloadProgress, DEFAULT_MODEL_URL } from "./modelCache";
import { diagnostics } from "./diagnostics";
import type {
  WorkerInMessage,
  WorkerOutMessage,
} from "../workers/inference.worker";

export interface ChunkProgress {
  chunkIndex: number;
  totalChunks: number;
  progress: number;
  elapsedMs: number;
  etaMs: number;
}

export interface ChunkStartEvent {
  chunkIndex: number;
  totalChunks: number;
  stage: string;
}

export type InferenceProgressEvent =
  | ({ stage: "download" } & DownloadProgress)
  | ({ stage: "inference" } & ChunkProgress);

export interface SeparationResult {
  stems: Record<StemName, Float32Array[]>;
  duration: number;
}

export interface InitOptions {
  modelUrl?: string;
  useMock?: boolean;
  preferredBackend?: "webgpu" | "wasm";
  onDownloadProgress?: (progress: DownloadProgress) => void;
}

export interface SeparateOptions {
  chunkOptions?: ChunkOptions;
  onChunkStart?: (event: ChunkStartEvent) => void;
  onChunkProgress?: (progress: ChunkProgress) => void;
}

export class InferenceClient {
  private worker: Worker;
  private isProcessing = false;
  private currentInitResolve: ((val: { backend: string }) => void) | null =
    null;
  private currentInitReject: ((err: Error) => void) | null = null;
  private currentSeparationResolve: ((val: SeparationResult) => void) | null =
    null;
  private currentSeparationReject: ((err: Error) => void) | null = null;
  private onDownloadProgressCb?: (progress: DownloadProgress) => void;
  private onChunkStartCb?: (event: ChunkStartEvent) => void;
  private onChunkProgressCb?: (progress: ChunkProgress) => void;

  constructor(worker?: Worker) {
    if (worker) {
      this.worker = worker;
    } else {
      this.worker = new Worker(
        new URL("../workers/inference.worker.ts", import.meta.url),
        { type: "module" }
      );
    }

    this.setupWorkerListeners();
  }

  private setupWorkerListeners() {
    this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const data = event.data;
      if (!data) return;

      switch (data.type) {
        case "download_progress":
          this.onDownloadProgressCb?.({
            loadedBytes: data.loadedBytes,
            totalBytes: data.totalBytes,
            progress: data.progress,
          });
          break;

        case "init_complete":
          diagnostics.info(
            "inference",
            `Inference engine ready on backend: ${data.backend}`
          );
          if (this.currentInitResolve) {
            this.currentInitResolve({ backend: data.backend });
            this.currentInitResolve = null;
            this.currentInitReject = null;
            this.onDownloadProgressCb = undefined;
          }
          break;

        case "chunk_start":
          this.onChunkStartCb?.({
            chunkIndex: data.chunkIndex,
            totalChunks: data.totalChunks,
            stage: data.stage,
          });
          break;

        case "worker_log":
          if (data.level === "error") {
            diagnostics.error("inference", data.message, data.data);
          } else if (data.level === "warn") {
            diagnostics.warn("inference", data.message, data.data);
          } else {
            diagnostics.info("inference", data.message, data.data);
          }
          break;

        case "chunk_progress":
          this.onChunkProgressCb?.({
            chunkIndex: data.chunkIndex,
            totalChunks: data.totalChunks,
            progress: data.progress,
            elapsedMs: data.elapsedMs,
            etaMs: data.etaMs,
          });
          break;

        case "complete":
          this.isProcessing = false;
          diagnostics.info(
            "inference",
            `Separation completed successfully (${data.duration.toFixed(2)}s)`
          );
          if (this.currentSeparationResolve) {
            this.currentSeparationResolve({
              stems: data.stems,
              duration: data.duration,
            });
            this.cleanupSeparation();
          }
          break;

        case "cancelled":
          this.isProcessing = false;
          diagnostics.warn("inference", "Separation cancelled by user");
          if (this.currentSeparationReject) {
            this.currentSeparationReject(
              new Error("Separation was cancelled by user")
            );
            this.cleanupSeparation();
          }
          break;

        case "error":
          this.isProcessing = false;
          diagnostics.error("inference", `Inference error: ${data.error}`);
          const error = new Error(data.error);
          if (this.currentSeparationReject) {
            this.currentSeparationReject(error);
            this.cleanupSeparation();
          } else if (this.currentInitReject) {
            this.currentInitReject(error);
            this.currentInitResolve = null;
            this.currentInitReject = null;
          }
          break;
      }
    };

    this.worker.onerror = (err) => {
      this.isProcessing = false;
      const msg =
        err.message || "Worker runtime error (uncaught exception or OOM crash)";
      diagnostics.error("inference", `Web Worker failed: ${msg}`, err);
      const error = new Error(msg);
      if (this.currentSeparationReject) {
        this.currentSeparationReject(error);
        this.cleanupSeparation();
      } else if (this.currentInitReject) {
        this.currentInitReject(error);
        this.currentInitResolve = null;
        this.currentInitReject = null;
      }
    };
  }

  private cleanupSeparation() {
    this.currentSeparationResolve = null;
    this.currentSeparationReject = null;
    this.onChunkStartCb = undefined;
    this.onChunkProgressCb = undefined;
  }

  public isBusy(): boolean {
    return this.isProcessing;
  }

  public init(options: InitOptions = {}): Promise<{ backend: string }> {
    return new Promise((resolve, reject) => {
      diagnostics.info(
        "inference",
        `Initializing inference client (modelUrl: ${options.modelUrl ?? DEFAULT_MODEL_URL}, mock: ${options.useMock ?? false})`
      );
      this.currentInitResolve = resolve;
      this.currentInitReject = reject;
      this.onDownloadProgressCb = options.onDownloadProgress;

      const message: WorkerInMessage = {
        type: "init",
        modelUrl: options.modelUrl ?? DEFAULT_MODEL_URL,
        useMock: options.useMock ?? false,
        preferredBackend: options.preferredBackend,
      };
      this.worker.postMessage(message);
    });
  }

  public separate(
    audio: Float32Array[],
    sampleRate: number,
    options: SeparateOptions = {}
  ): Promise<SeparationResult> {
    if (this.isProcessing) {
      return Promise.reject(
        new Error("Inference engine is already processing a task")
      );
    }

    const durationSec = (audio[0]?.length ?? 0) / (sampleRate || 44100);
    diagnostics.info(
      "inference",
      `Starting separation: ${audio.length} channels, ${audio[0]?.length ?? 0} samples (${durationSec.toFixed(1)}s at ${sampleRate}Hz)`
    );

    this.isProcessing = true;
    this.onChunkStartCb = options.onChunkStart;
    this.onChunkProgressCb = options.onChunkProgress;

    return new Promise((resolve, reject) => {
      this.currentSeparationResolve = resolve;
      this.currentSeparationReject = reject;

      const message: WorkerInMessage = {
        type: "start",
        audio,
        sampleRate,
        options: options.chunkOptions,
      };
      this.worker.postMessage(message);
    });
  }

  public cancel(): void {
    if (this.isProcessing) {
      const message: WorkerInMessage = { type: "cancel" };
      this.worker.postMessage(message);
    }
  }

  public terminate(): void {
    this.isProcessing = false;
    this.cleanupSeparation();
    this.currentInitResolve = null;
    this.currentInitReject = null;
    this.worker.terminate();
  }
}
