import * as ort from "onnxruntime-web";
import {
  getModelWeights,
  DownloadProgress,
  DEFAULT_MODEL_URL,
} from "../lib/modelCache";

// Configure ONNX Runtime WASM binary paths to matching version
ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";

// Multi-threaded WASM execution (capped at 4 threads to prevent heap fragmentation while leveraging multi-core CPUs)
const hardwareThreads =
  typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 2;
ort.env.wasm.numThreads = Math.min(4, Math.max(1, hardwareThreads));

import {
  createChunkSegments,
  reconstructStemsFromChunks,
  StemName,
  ChunkOptions,
  ChunkInferenceResult,
} from "../lib/chunkOverlapAdd";
import { computeStereoSTFT, computeBatchISTFT } from "../lib/stft";

export type WorkerInMessage =
  | {
      type: "init";
      modelUrl?: string;
      useMock?: boolean;
      preferredBackend?: "webgpu" | "wasm";
    }
  | {
      type: "start";
      audio: Float32Array[];
      sampleRate: number;
      options?: ChunkOptions;
    }
  | { type: "cancel" };

export type WorkerOutMessage =
  | ({ type: "download_progress" } & DownloadProgress)
  | { type: "init_complete"; backend: "webgpu" | "wasm" | "mock" }
  | {
      type: "chunk_start";
      chunkIndex: number;
      totalChunks: number;
      stage: string;
    }
  | {
      type: "worker_log";
      level: "info" | "warn" | "error";
      message: string;
      data?: unknown;
    }
  | {
      type: "chunk_progress";
      chunkIndex: number;
      totalChunks: number;
      progress: number;
      elapsedMs: number;
      etaMs: number;
    }
  | {
      type: "complete";
      stems: Record<StemName, Float32Array[]>;
      duration: number;
    }
  | { type: "cancelled" }
  | { type: "error"; error: string };

let session: ort.InferenceSession | null = null;
let isMockSession = false;
let isCancelled = false;
let activeBackend: "webgpu" | "wasm" | "mock" = "webgpu";

// HTDemucs stem order standard: [drums, bass, other, vocals]
const DEMUCS_STEM_ORDER: StemName[] = ["drums", "bass", "other", "vocals"];

async function handleInit(
  modelUrl: string = DEFAULT_MODEL_URL,
  useMock: boolean = false,
  preferredBackend?: "webgpu" | "wasm",
  postMsg: (msg: WorkerOutMessage) => void = (m) => self.postMessage(m)
) {
  if (useMock) {
    isMockSession = true;
    session = null;
    activeBackend = "mock";
    postMsg({
      type: "init_complete",
      backend: "mock",
    } satisfies WorkerOutMessage);
    return;
  }

  try {
    const weightsBuffer = await getModelWeights(modelUrl, (progress) => {
      postMsg({
        type: "download_progress",
        ...progress,
      } satisfies WorkerOutMessage);
    });

    const weightsBytes = new Uint8Array(weightsBuffer);

    // Disable graph optimization and CPU memory arena to prevent duplicate buffer
    // allocations and memory pool reservation that trigger std::bad_alloc in 32-bit WASM
    const baseSessionOptions: ort.InferenceSession.SessionOptions = {
      graphOptimizationLevel: "disabled",
      enableCpuMemArena: false,
      enableMemPattern: false,
      executionMode: "sequential",
    };

    // Check if the GPU adapter is Qualcomm Adreno (which has driver compiler deadlocks with RoFormer WGSL shaders)
    let isAdrenoGpu = false;
    const nav =
      typeof navigator !== "undefined" ? (navigator as any) : undefined;
    if (nav?.gpu?.requestAdapter) {
      try {
        const probeAdapter = await nav.gpu.requestAdapter();
        const info =
          probeAdapter?.info ||
          (await probeAdapter?.requestAdapterInfo?.()) ||
          {};
        const combined =
          `${info.vendor || ""} ${info.description || ""} ${info.architecture || ""}`.toLowerCase();
        if (combined.includes("qualcomm") || combined.includes("adreno")) {
          isAdrenoGpu = true;
        }
      } catch {
        // Non-fatal probe
      }
    }

    let backend: "webgpu" | "wasm" = "webgpu";

    if (preferredBackend === "wasm" || isAdrenoGpu) {
      if (isAdrenoGpu) {
        postMsg({
          type: "worker_log",
          level: "warn",
          message:
            "Qualcomm Adreno GPU detected: automatically routing to CPU/WASM mode (multi-threaded SIMD) to bypass mobile driver lockups.",
        } satisfies WorkerOutMessage);
      }
      session = await ort.InferenceSession.create(weightsBytes, {
        ...baseSessionOptions,
        executionProviders: ["wasm"],
      });
      backend = "wasm";
    } else {
      try {
        session = await ort.InferenceSession.create(weightsBytes, {
          ...baseSessionOptions,
          executionProviders: ["webgpu"],
        });
        backend = "webgpu";
      } catch (gpuErr) {
        console.warn(
          "WebGPU EP initialization failed in Worker, falling back to WASM:",
          gpuErr
        );
        session = await ort.InferenceSession.create(weightsBytes, {
          ...baseSessionOptions,
          executionProviders: ["wasm"],
        });
        backend = "wasm";
      }
    }

    isMockSession = false;
    activeBackend = backend;
    postMsg({ type: "init_complete", backend } satisfies WorkerOutMessage);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    let userFacingMessage = errorMessage;
    if (errorMessage.includes("std::bad_alloc")) {
      userFacingMessage =
        "Memory allocation failed (std::bad_alloc). The browser ran out of WASM heap space loading the Demucs model (~300 MB). Close background browser tabs or restart your browser to free memory.";
    }
    postMsg({
      type: "error",
      error: userFacingMessage,
    } satisfies WorkerOutMessage);
  }
}

async function handleStart(
  audio: Float32Array[],
  sampleRate: number,
  options?: ChunkOptions,
  postMsg: (msg: WorkerOutMessage) => void = (m) => self.postMessage(m)
) {
  isCancelled = false;
  const startTime = Date.now();

  try {
    const chunks = createChunkSegments(audio, options);
    const totalChunks = chunks.length;
    const results: ChunkInferenceResult[] = [];

    for (let i = 0; i < totalChunks; i++) {
      if (isCancelled) {
        postMsg({ type: "cancelled" } satisfies WorkerOutMessage);
        return;
      }

      const chunk = chunks[i];
      const chunkStart = Date.now();
      let chunkStems: Record<StemName, Float32Array[]>;

      postMsg({
        type: "chunk_start",
        chunkIndex: i,
        totalChunks,
        stage: "stft",
      } satisfies WorkerOutMessage);

      if (session && !isMockSession) {
        const chunkSamples = chunk.audio[0].length;
        const inputNames = session.inputNames;
        const isSpecModel =
          inputNames.includes("spec_real") && inputNames.includes("spec_imag");

        if (isSpecModel) {
          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: Computing STFT...`,
          } satisfies WorkerOutMessage);

          const stftStart = Date.now();
          const { real, imag, F, T } = computeStereoSTFT(
            chunk.audio[0],
            chunk.audio[1],
            chunkSamples
          );

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: STFT done in ${Date.now() - stftStart}ms`,
          } satisfies WorkerOutMessage);

          const realTensor = new ort.Tensor("float32", real, [1, 2, F, T]);
          const imagTensor = new ort.Tensor("float32", imag, [1, 2, F, T]);

          const feeds: Record<string, ort.Tensor> = {
            spec_real: realTensor,
            spec_imag: imagTensor,
          };

          const isFirstChunk = i === 0;
          postMsg({
            type: "chunk_start",
            chunkIndex: i,
            totalChunks,
            stage:
              activeBackend === "wasm"
                ? "wasm_inference"
                : isFirstChunk
                  ? "webgpu_compiling"
                  : "webgpu_inference",
          } satisfies WorkerOutMessage);

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: Executing ${activeBackend.toUpperCase()} session.run()${isFirstChunk && activeBackend === "webgpu" ? " (compiling shaders in GPU driver)..." : activeBackend === "wasm" ? ` (multi-threaded SIMD, ${ort.env.wasm.numThreads} threads)...` : "..."}`,
          } satisfies WorkerOutMessage);

          const inferStart = Date.now();
          const outputFeeds = await session.run(feeds);
          const inferElapsed = Date.now() - inferStart;

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: ${activeBackend.toUpperCase()} inference completed in ${inferElapsed}ms!`,
          } satisfies WorkerOutMessage);

          const outRealTensor =
            outputFeeds["out_spec_real"] || outputFeeds[session.outputNames[0]];
          const outImagTensor =
            outputFeeds["out_spec_imag"] || outputFeeds[session.outputNames[1]];

          const numStemsInOutput = outRealTensor.dims[1] || 6;
          // .slice() ensures an owned copy in JS heap before disposing WebGPU tensor resources
          const outReal = (outRealTensor.data as Float32Array).slice();
          const outImag = (outImagTensor.data as Float32Array).slice();

          realTensor.dispose();
          imagTensor.dispose();
          outRealTensor.dispose();
          outImagTensor.dispose();

          postMsg({
            type: "chunk_start",
            chunkIndex: i,
            totalChunks,
            stage: "istft",
          } satisfies WorkerOutMessage);

          const istftStart = Date.now();
          chunkStems = computeBatchISTFT(
            outReal,
            outImag,
            chunkSamples,
            undefined,
            undefined,
            undefined,
            numStemsInOutput
          );

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: iSTFT completed in ${Date.now() - istftStart}ms`,
          } satisfies WorkerOutMessage);
        } else {
          // Standard time-domain waveform model fallback
          let sum = 0;
          let sumSq = 0;
          const totalChunkSamples = 2 * chunkSamples;
          for (let sIdx = 0; sIdx < chunkSamples; sIdx++) {
            const l = chunk.audio[0][sIdx];
            const r = chunk.audio[1][sIdx];
            sum += l + r;
            sumSq += l * l + r * r;
          }
          const mean = sum / totalChunkSamples;
          const variance = Math.max(
            1e-8,
            sumSq / totalChunkSamples - mean * mean
          );
          const std = Math.sqrt(variance);

          const tensorData = new Float32Array(2 * chunkSamples);
          for (let sIdx = 0; sIdx < chunkSamples; sIdx++) {
            tensorData[sIdx] = (chunk.audio[0][sIdx] - mean) / std;
            tensorData[chunkSamples + sIdx] =
              (chunk.audio[1][sIdx] - mean) / std;
          }

          const inputName = session.inputNames[0];
          const inputTensor = new ort.Tensor("float32", tensorData, [
            1,
            2,
            chunkSamples,
          ]);

          const feeds: Record<string, ort.Tensor> = {
            [inputName]: inputTensor,
          };
          const outputFeeds = await session.run(feeds);
          const outputName = session.outputNames[0];
          const outputTensor = outputFeeds[outputName];
          const outData = outputTensor.data as Float32Array;

          chunkStems = {
            drums: [
              new Float32Array(chunkSamples),
              new Float32Array(chunkSamples),
            ],
            bass: [
              new Float32Array(chunkSamples),
              new Float32Array(chunkSamples),
            ],
            other: [
              new Float32Array(chunkSamples),
              new Float32Array(chunkSamples),
            ],
            vocals: [
              new Float32Array(chunkSamples),
              new Float32Array(chunkSamples),
            ],
          };

          const stridePerStem = 2 * chunkSamples;
          for (let s = 0; s < DEMUCS_STEM_ORDER.length; s++) {
            const stemName = DEMUCS_STEM_ORDER[s];
            const stemOffset = s * stridePerStem;
            const leftTarget = chunkStems[stemName][0];
            const rightTarget = chunkStems[stemName][1];
            for (let sIdx = 0; sIdx < chunkSamples; sIdx++) {
              leftTarget[sIdx] = outData[stemOffset + sIdx] * std + mean;
              rightTarget[sIdx] =
                outData[stemOffset + chunkSamples + sIdx] * std + mean;
            }
          }
        }
      } else {
        // Mock / simulation mode: deterministic DSP filter separation
        await new Promise((resolve) => setTimeout(resolve, 5));

        chunkStems = {
          vocals: chunk.audio.map((c) => c.slice()),
          drums: chunk.audio.map((c) => c.map((v) => v * 0.7)),
          bass: chunk.audio.map((c) => c.map((v) => v * 0.5)),
          other: chunk.audio.map((c) => c.map((v) => v * 0.3)),
        };
      }

      results.push({
        chunkIndex: chunk.chunkIndex,
        startSample: chunk.startSample,
        validSamples: chunk.validSamples,
        stems: chunkStems,
      });

      const elapsedMs = Date.now() - startTime;
      const chunksCompleted = i + 1;
      const msPerChunk = elapsedMs / chunksCompleted;
      const remainingChunks = totalChunks - chunksCompleted;
      const etaMs = Math.round(msPerChunk * remainingChunks);

      postMsg({
        type: "worker_log",
        level: "info",
        message: `Chunk ${chunksCompleted}/${totalChunks} finished in ${Date.now() - chunkStart}ms (Overall: ${(elapsedMs / 1000).toFixed(1)}s elapsed, ${(etaMs / 1000).toFixed(1)}s ETA)`,
      } satisfies WorkerOutMessage);

      postMsg({
        type: "chunk_progress",
        chunkIndex: i,
        totalChunks,
        progress: chunksCompleted / totalChunks,
        elapsedMs,
        etaMs,
      } satisfies WorkerOutMessage);
    }

    if (isCancelled) {
      postMsg({ type: "cancelled" } satisfies WorkerOutMessage);
      return;
    }

    const totalSamples = audio[0].length;
    const reconstructed = reconstructStemsFromChunks(
      results,
      totalSamples,
      options
    );

    postMsg({
      type: "complete",
      stems: reconstructed,
      duration: totalSamples / sampleRate,
    } satisfies WorkerOutMessage);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postMsg({ type: "error", error: errorMessage } satisfies WorkerOutMessage);
  }
}

export async function handleWorkerMessage(
  msg: WorkerInMessage,
  postMsg: (msg: WorkerOutMessage) => void = (m) => self.postMessage(m)
): Promise<void> {
  switch (msg.type) {
    case "init":
      await handleInit(
        msg.modelUrl,
        msg.useMock,
        msg.preferredBackend,
        postMsg
      );
      break;
    case "start":
      await handleStart(msg.audio, msg.sampleRate, msg.options, postMsg);
      break;
    case "cancel":
      isCancelled = true;
      postMsg({ type: "cancelled" });
      break;
  }
}

if (typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
    handleWorkerMessage(event.data);
  };
}
