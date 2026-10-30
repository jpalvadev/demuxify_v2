import * as ort from "onnxruntime-web";
import {
  getModelWeights,
  DownloadProgress,
  DEFAULT_MODEL_URL,
} from "../lib/modelCache";
import {
  resolveModelProfile,
  ModelProfile,
  ModelId,
  BS_ROFORMER_PROFILE,
} from "../lib/modelConfig";

// Configure ONNX Runtime WASM binary paths to matching version
ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";

// Constrain WASM to 1 thread to prevent 32-bit heap fragmentation and multi-arena memory multiplication (std::bad_alloc)
ort.env.wasm.numThreads = 1;

import {
  createChunkSegments,
  reconstructStemsFromChunks,
  StemName,
  ChunkOptions,
  ChunkInferenceResult,
} from "../lib/chunkOverlapAdd";
import {
  computeStereoSTFT,
  computeBatchISTFT,
  BS_ROFORMER_STEM_ORDER,
} from "../lib/stft";

export { BS_ROFORMER_STEM_ORDER };

export type WorkerInMessage =
  | {
      type: "init";
      modelUrl?: string;
      modelProfileId?: ModelId;
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
let activeProfile: ModelProfile = BS_ROFORMER_PROFILE;

// Canonical BS-RoFormer 4-stem order: [drums, bass, other, vocals]
// (BS_ROFORMER_STEM_ORDER is imported from ../lib/stft)

async function handleInit(
  modelUrl: string = DEFAULT_MODEL_URL,
  useMock: boolean = false,
  preferredBackend?: "webgpu" | "wasm",
  postMsg: (msg: WorkerOutMessage) => void = (m) => self.postMessage(m),
  modelProfileId?: ModelId
) {
  activeProfile = resolveModelProfile(modelProfileId || modelUrl);

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
    let weightsBuffer: ArrayBuffer | null = await getModelWeights(
      modelUrl,
      (progress) => {
        postMsg({
          type: "download_progress",
          ...progress,
        } satisfies WorkerOutMessage);
      },
      activeProfile.cacheName
    );

    let weightsBytes: Uint8Array | null = new Uint8Array(weightsBuffer);
    weightsBuffer = null; // Release JS ArrayBuffer to free ~270 MB before session creation

    // Memory pattern planning & arena pooling: pre-plan activation tensor allocation to eliminate heap fragmentation
    const baseSessionOptions: ort.InferenceSession.SessionOptions = {
      graphOptimizationLevel: "disabled",
      enableCpuMemArena: true,
      enableMemPattern: true,
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
            "Qualcomm Adreno GPU detected: automatically routing to CPU/WASM mode (single-thread memory safe) to bypass mobile driver lockups.",
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

    weightsBytes = null; // Release typed array reference after session loads into WASM runtime
    isMockSession = false;
    activeBackend = backend;
    postMsg({ type: "init_complete", backend } satisfies WorkerOutMessage);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const profile = resolveModelProfile(modelProfileId || modelUrl);
    let userFacingMessage = errorMessage;
    if (errorMessage.includes("std::bad_alloc")) {
      userFacingMessage = `Memory allocation failed (std::bad_alloc). The browser ran out of WASM heap space loading the ${profile.name} (${profile.memoryRequirementDescription}). Close background browser tabs or restart your browser to free memory.`;
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
    const effectiveChunkSamples =
      options?.chunkSamples ??
      Math.round(activeProfile.chunkDurationSec * sampleRate);
    const effectiveOverlapSamples =
      options?.overlapSamples ??
      Math.round(activeProfile.chunkOverlapSec * sampleRate);
    const effectiveChunkOptions: ChunkOptions = {
      chunkSamples: effectiveChunkSamples,
      overlapSamples: effectiveOverlapSamples,
    };

    const chunks = createChunkSegments(audio, effectiveChunkOptions);
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

      if (session && !isMockSession) {
        const chunkSamples = chunk.audio[0].length;
        const inputNames = session.inputNames;
        const isSpecModel =
          inputNames.includes("spec_real") && inputNames.includes("spec_imag");
        const isOpenUnmix =
          inputNames.includes("magnitude") ||
          activeProfile.architecture === "open-unmix";

        postMsg({
          type: "chunk_start",
          chunkIndex: i,
          totalChunks,
          stage: isSpecModel || isOpenUnmix ? "stft" : "waveform_prep",
        } satisfies WorkerOutMessage);

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
            message: `Chunk ${i + 1}/${totalChunks}: Executing ${activeBackend.toUpperCase()} session.run()${isFirstChunk && activeBackend === "webgpu" ? " (compiling shaders in GPU driver)..." : activeBackend === "wasm" ? " (memory-safe SIMD)..." : "..."}`,
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
        } else if (isOpenUnmix) {
          // Open-Unmix (UMX) STFT magnitude processor with ratio masking
          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: Computing Open-Unmix STFT (4096/1024)...`,
          } satisfies WorkerOutMessage);

          const UMX_N_FFT = 4096;
          const UMX_HOP_LENGTH = 1024;
          const UMX_WIN_LENGTH = 4096;

          const stftStart = Date.now();
          const { real, imag, F, T } = computeStereoSTFT(
            chunk.audio[0],
            chunk.audio[1],
            chunkSamples,
            UMX_N_FFT,
            UMX_HOP_LENGTH,
            UMX_WIN_LENGTH
          );

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: STFT done in ${Date.now() - stftStart}ms`,
          } satisfies WorkerOutMessage);

          const totalBins = 2 * F * T;
          const mag = new Float32Array(totalBins);
          for (let idx = 0; idx < totalBins; idx++) {
            mag[idx] = Math.hypot(real[idx], imag[idx]);
          }

          const magTensor = new ort.Tensor("float32", mag, [1, 2, F, T]);
          const inputName = session.inputNames[0] || "magnitude";
          const feeds: Record<string, ort.Tensor> = {
            [inputName]: magTensor,
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

          const inferStart = Date.now();
          const outputFeeds = await session.run(feeds);
          const inferElapsed = Date.now() - inferStart;

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: Open-Unmix ${activeBackend.toUpperCase()} inference completed in ${inferElapsed}ms!`,
          } satisfies WorkerOutMessage);

          const vocalsTensor = outputFeeds["vocals_magnitude"];
          const drumsTensor = outputFeeds["drums_magnitude"];
          const bassTensor = outputFeeds["bass_magnitude"];
          const otherTensor = outputFeeds["other_magnitude"];

          const vocalsMag = vocalsTensor.data as Float32Array;
          const drumsMag = drumsTensor.data as Float32Array;
          const bassMag = bassTensor.data as Float32Array;
          const otherMag = otherTensor.data as Float32Array;

          // Prepare 4-stem complex STFT tensors: [drums=0, bass=1, other=2, vocals=3]
          const sliceStride = F * T;
          const outReal = new Float32Array(4 * 2 * sliceStride);
          const outImag = new Float32Array(4 * 2 * sliceStride);
          const stemData = [drumsMag, bassMag, otherMag, vocalsMag];

          for (let c = 0; c < 2; c++) {
            const cOff = c * sliceStride;
            for (let k = 0; k < sliceStride; k++) {
              const idx = cOff + k;
              const d = stemData[0][idx];
              const b = stemData[1][idx];
              const o = stemData[2][idx];
              const v = stemData[3][idx];
              const sum = d + b + o + v + 1e-8;

              const re = real[idx];
              const im = imag[idx];

              for (let s = 0; s < 4; s++) {
                const ratio = stemData[s][idx] / sum;
                const outIdx = s * 2 * sliceStride + cOff + k;
                outReal[outIdx] = re * ratio;
                outImag[outIdx] = im * ratio;
              }
            }
          }

          magTensor.dispose();
          vocalsTensor.dispose();
          drumsTensor.dispose();
          bassTensor.dispose();
          otherTensor.dispose();

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
            UMX_N_FFT,
            UMX_HOP_LENGTH,
            UMX_WIN_LENGTH,
            4
          );

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: Open-Unmix iSTFT completed in ${Date.now() - istftStart}ms`,
          } satisfies WorkerOutMessage);
        } else {
          // Polymorphic tensor adapter for HT-Demucs (Direct Waveform Tensor input)
          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: Preparing HT-Demucs waveform tensor...`,
          } satisfies WorkerOutMessage);

          // Standard Demucs audio normalization: (mix - mean) / std
          let sum = 0;
          let sqSum = 0;
          for (let sIdx = 0; sIdx < chunkSamples; sIdx++) {
            const monoVal = 0.5 * (chunk.audio[0][sIdx] + chunk.audio[1][sIdx]);
            sum += monoVal;
            sqSum += monoVal * monoVal;
          }
          const mean = sum / chunkSamples;
          const variance = Math.max(0, sqSum / chunkSamples - mean * mean);
          const std = Math.max(Math.sqrt(variance), 1e-4);

          const inputBuffer = new Float32Array(2 * chunkSamples);
          for (let sIdx = 0; sIdx < chunkSamples; sIdx++) {
            inputBuffer[sIdx] = (chunk.audio[0][sIdx] - mean) / std;
            inputBuffer[chunkSamples + sIdx] =
              (chunk.audio[1][sIdx] - mean) / std;
          }

          const inputTensorName = session.inputNames[0] || "mix";
          const inputTensor = new ort.Tensor("float32", inputBuffer, [
            1,
            2,
            chunkSamples,
          ]);

          const feeds: Record<string, ort.Tensor> = {
            [inputTensorName]: inputTensor,
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

          const inferStart = Date.now();
          const outputFeeds = await session.run(feeds);
          const inferElapsed = Date.now() - inferStart;

          postMsg({
            type: "worker_log",
            level: "info",
            message: `Chunk ${i + 1}/${totalChunks}: HT-Demucs ${activeBackend.toUpperCase()} inference completed in ${inferElapsed}ms!`,
          } satisfies WorkerOutMessage);

          const outputTensorName = session.outputNames[0] || "stems";
          const outputTensor = outputFeeds[outputTensorName];
          const outData = (outputTensor.data as Float32Array).slice();

          inputTensor.dispose();
          outputTensor.dispose();

          // Canonical HT-Demucs 4-Stem layout: [batch=1, stems=4, channels=2, samples=chunkSamples]
          // Native source order: [drums, bass, other, vocals]
          const DEMUCS_STEM_ORDER: StemName[] = [
            "drums",
            "bass",
            "other",
            "vocals",
          ];
          chunkStems = {} as Record<StemName, Float32Array[]>;

          for (let s = 0; s < 4; s++) {
            const stemName = DEMUCS_STEM_ORDER[s];
            const leftStart = s * 2 * chunkSamples;
            const rightStart = (s * 2 + 1) * chunkSamples;
            const left = new Float32Array(chunkSamples);
            const right = new Float32Array(chunkSamples);
            for (let sIdx = 0; sIdx < chunkSamples; sIdx++) {
              left[sIdx] = outData[leftStart + sIdx] * std + mean;
              right[sIdx] = outData[rightStart + sIdx] * std + mean;
            }
            chunkStems[stemName] = [left, right];
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
      effectiveChunkOptions
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
        postMsg,
        msg.modelProfileId
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
