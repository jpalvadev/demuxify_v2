// Tempo Detector client (ADR-0010): drives the beat-detection worker off the
// main thread over one channel of the decoded Source Mix and relays ranked BPM
// candidates + the Beat Grid back as a TempoAnalysisResult. Mirrors the
// established heavy-pass client↔worker pattern (see inferenceClient.ts).
import { diagnostics } from "./diagnostics";
import type {
  WorkerInMessage,
  WorkerOutMessage,
  TempoCandidate,
} from "../workers/beatDetection.worker";

export interface TempoAnalysisResult {
  // Ranked BPM candidates (top first); the engine only ranks, it never
  // silently picks over octave ambiguity — the user decides the feel.
  candidates: TempoCandidate[];
  // Beat Grid: beat positions in seconds where the beats actually fall.
  beatGrid: Float64Array;
  analyzedBpm: number;
  duration: number;
  // The candidate the Beat Grid is locked to (ticket 06): the hint the user
  // picked on a re-lock, otherwise the top-ranked reading. Persisted with the
  // Session so Session Recovery resumes clicks at the chosen feel.
  chosenTempoBpm?: number;
}

export class BeatClient {
  private worker: Worker;
  private isProcessing = false;
  private currentAnalysisResolve: ((val: TempoAnalysisResult) => void) | null =
    null;
  private currentAnalysisReject: ((err: Error) => void) | null = null;
  // Re-lock hint (ticket 06): the candidate the user chose for this pass, so
  // the completed result can name the tempo the Beat Grid got locked to.
  private currentHintBpm: number | undefined = undefined;

  constructor(worker?: Worker) {
    if (worker) {
      this.worker = worker;
    } else {
      this.worker = new Worker(
        new URL("../workers/beatDetection.worker.ts", import.meta.url),
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
        case "worker_log":
          if (data.level === "error") {
            diagnostics.error("audio", data.message, data.data);
          } else if (data.level === "warn") {
            diagnostics.warn("audio", data.message, data.data);
          } else {
            diagnostics.info("audio", data.message, data.data);
          }
          break;

        case "complete":
          this.isProcessing = false;
          diagnostics.info(
            "audio",
            `Tempo Detector completed: ${data.analyzedBpm.toFixed(1)} BPM grid, ${data.candidates.length} ranked candidates (${data.duration.toFixed(1)}s)`
          );
          if (this.currentAnalysisResolve) {
            this.currentAnalysisResolve({
              candidates: data.candidates,
              beatGrid: data.beatGrid,
              analyzedBpm: data.analyzedBpm,
              duration: data.duration,
              // The user's pick (re-lock hint) is the tempo the Beat Grid is
              // locked to; with no hint, the top-ranked reading is.
              chosenTempoBpm: this.currentHintBpm ?? data.analyzedBpm,
            });
            this.cleanupAnalysis();
          }
          break;

        case "cancelled":
          this.isProcessing = false;
          diagnostics.warn(
            "audio",
            "Tempo Detector analysis cancelled by user"
          );
          if (this.currentAnalysisReject) {
            this.currentAnalysisReject(
              new Error("Tempo analysis was cancelled by user")
            );
            this.cleanupAnalysis();
          }
          break;

        case "error":
          this.isProcessing = false;
          diagnostics.error("audio", `Tempo Detector failed: ${data.error}`);
          const error = new Error(data.error);
          if (this.currentAnalysisReject) {
            this.currentAnalysisReject(error);
            this.cleanupAnalysis();
          }
          break;
      }
    };

    this.worker.onerror = (err) => {
      this.isProcessing = false;
      const msg =
        err.message || "Worker runtime error (uncaught exception or OOM crash)";
      diagnostics.error(
        "audio",
        `Tempo Detector Web Worker failed: ${msg}`,
        err
      );
      const error = new Error(msg);
      if (this.currentAnalysisReject) {
        this.currentAnalysisReject(error);
        this.cleanupAnalysis();
      }
    };
  }

  private cleanupAnalysis() {
    this.currentAnalysisResolve = null;
    this.currentAnalysisReject = null;
  }

  public isBusy(): boolean {
    return this.isProcessing;
  }

  public analyze(
    samples: Float32Array,
    sampleRate: number,
    hintBpm?: number
  ): Promise<TempoAnalysisResult> {
    if (this.isProcessing) {
      return Promise.reject(
        new Error("Tempo Detector is already processing an analysis")
      );
    }

    const durationSec = samples.length / (sampleRate || 44100);
    diagnostics.info(
      "audio",
      `Starting Tempo Detector analysis: ${samples.length} samples (${durationSec.toFixed(1)}s at ${sampleRate}Hz${hintBpm ? `, re-lock hint ${hintBpm} BPM` : ""})`
    );

    this.isProcessing = true;
    this.currentHintBpm = hintBpm;

    return new Promise((resolve, reject) => {
      this.currentAnalysisResolve = resolve;
      this.currentAnalysisReject = reject;

      const message: WorkerInMessage = {
        type: "start",
        samples,
        sampleRate,
        hintBpm,
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
    this.cleanupAnalysis();
    this.worker.terminate();
  }
}
