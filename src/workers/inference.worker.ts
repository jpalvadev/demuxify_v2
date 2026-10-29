import * as ort from "onnxruntime-web";
import {
  getModelWeights,
  DownloadProgress,
  DEFAULT_MODEL_URL,
} from "../lib/modelCache";

// Configure ONNX Runtime WASM binary paths to matching version
ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";

// Memory & thread safety: constrain to 1 thread to prevent 32-bit WASM heap fragmentation
// when allocating large models (>300 MB).
ort.env.wasm.numThreads = 1;
import {
  createChunkSegments,
  reconstructStemsFromChunks,
  StemName,
  ChunkOptions,
  ChunkInferenceResult,
} from "../lib/chunkOverlapAdd";

export type WorkerInMessage =
  | { type: "init"; modelUrl?: string; useMock?: boolean }
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

// HTDemucs stem order standard: [drums, bass, other, vocals]
const DEMUCS_STEM_ORDER: StemName[] = ["drums", "bass", "other", "vocals"];

async function handleInit(
  modelUrl: string = DEFAULT_MODEL_URL,
  useMock: boolean = false,
  postMsg: (msg: WorkerOutMessage) => void = (m) => self.postMessage(m)
) {
  if (useMock) {
    isMockSession = true;
    session = null;
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

    let backend: "webgpu" | "wasm" = "webgpu";
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

    isMockSession = false;
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
      let chunkStems: Record<StemName, Float32Array[]>;

      if (session && !isMockSession) {
        // Prepare tensor for ONNX Demucs
        // Demucs expects [1, 2, chunkSamples]
        const chunkSamples = chunk.audio[0].length;
        const tensorData = new Float32Array(2 * chunkSamples);
        tensorData.set(chunk.audio[0], 0);
        tensorData.set(chunk.audio[1], chunkSamples);

        const inputName = session.inputNames[0];
        const inputTensor = new ort.Tensor("float32", tensorData, [
          1,
          2,
          chunkSamples,
        ]);

        const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
        const outputFeeds = await session.run(feeds);
        const outputName = session.outputNames[0];
        const outputTensor = outputFeeds[outputName];
        // Shape: [1, 4, 2, chunkSamples] (stems, channels, samples)
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
          chunkStems[stemName][0].set(
            outData.subarray(stemOffset, stemOffset + chunkSamples)
          );
          chunkStems[stemName][1].set(
            outData.subarray(
              stemOffset + chunkSamples,
              stemOffset + 2 * chunkSamples
            )
          );
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
      await handleInit(msg.modelUrl, msg.useMock, postMsg);
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
