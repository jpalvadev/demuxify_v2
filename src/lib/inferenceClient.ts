import { StemName, ChunkOptions } from './chunkOverlapAdd';
import { DownloadProgress, DEFAULT_MODEL_URL } from './modelCache';
import type { WorkerInMessage, WorkerOutMessage } from '../workers/inference.worker';

export interface ChunkProgress {
  chunkIndex: number;
  totalChunks: number;
  progress: number;
  elapsedMs: number;
  etaMs: number;
}

export type InferenceProgressEvent =
  | ({ stage: 'download' } & DownloadProgress)
  | ({ stage: 'inference' } & ChunkProgress);

export interface SeparationResult {
  stems: Record<StemName, Float32Array[]>;
  duration: number;
}

export interface InitOptions {
  modelUrl?: string;
  useMock?: boolean;
  onDownloadProgress?: (progress: DownloadProgress) => void;
}

export interface SeparateOptions {
  chunkOptions?: ChunkOptions;
  onChunkProgress?: (progress: ChunkProgress) => void;
}

export class InferenceClient {
  private worker: Worker;
  private isProcessing = false;
  private currentInitResolve: ((val: { backend: string }) => void) | null = null;
  private currentInitReject: ((err: Error) => void) | null = null;
  private currentSeparationResolve: ((val: SeparationResult) => void) | null = null;
  private currentSeparationReject: ((err: Error) => void) | null = null;
  private onDownloadProgressCb?: (progress: DownloadProgress) => void;
  private onChunkProgressCb?: (progress: ChunkProgress) => void;

  constructor(worker?: Worker) {
    if (worker) {
      this.worker = worker;
    } else {
      this.worker = new Worker(
        new URL('../workers/inference.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    this.setupWorkerListeners();
  }

  private setupWorkerListeners() {
    this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const data = event.data;
      if (!data) return;

      switch (data.type) {
        case 'download_progress':
          this.onDownloadProgressCb?.({
            loadedBytes: data.loadedBytes,
            totalBytes: data.totalBytes,
            progress: data.progress,
          });
          break;

        case 'init_complete':
          if (this.currentInitResolve) {
            this.currentInitResolve({ backend: data.backend });
            this.currentInitResolve = null;
            this.currentInitReject = null;
            this.onDownloadProgressCb = undefined;
          }
          break;

        case 'chunk_progress':
          this.onChunkProgressCb?.({
            chunkIndex: data.chunkIndex,
            totalChunks: data.totalChunks,
            progress: data.progress,
            elapsedMs: data.elapsedMs,
            etaMs: data.etaMs,
          });
          break;

        case 'complete':
          this.isProcessing = false;
          if (this.currentSeparationResolve) {
            this.currentSeparationResolve({
              stems: data.stems,
              duration: data.duration,
            });
            this.cleanupSeparation();
          }
          break;

        case 'cancelled':
          this.isProcessing = false;
          if (this.currentSeparationReject) {
            this.currentSeparationReject(new Error('Separation was cancelled by user'));
            this.cleanupSeparation();
          }
          break;

        case 'error':
          this.isProcessing = false;
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
      const error = new Error(err.message || 'Worker runtime error');
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
    this.onChunkProgressCb = undefined;
  }

  public isBusy(): boolean {
    return this.isProcessing;
  }

  public init(options: InitOptions = {}): Promise<{ backend: string }> {
    return new Promise((resolve, reject) => {
      this.currentInitResolve = resolve;
      this.currentInitReject = reject;
      this.onDownloadProgressCb = options.onDownloadProgress;

      const message: WorkerInMessage = {
        type: 'init',
        modelUrl: options.modelUrl ?? DEFAULT_MODEL_URL,
        useMock: options.useMock ?? false,
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
      return Promise.reject(new Error('Inference engine is already processing a task'));
    }

    this.isProcessing = true;
    this.onChunkProgressCb = options.onChunkProgress;

    return new Promise((resolve, reject) => {
      this.currentSeparationResolve = resolve;
      this.currentSeparationReject = reject;

      const message: WorkerInMessage = {
        type: 'start',
        audio,
        sampleRate,
        options: options.chunkOptions,
      };
      this.worker.postMessage(message);
    });
  }

  public cancel(): void {
    if (this.isProcessing) {
      const message: WorkerInMessage = { type: 'cancel' };
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
