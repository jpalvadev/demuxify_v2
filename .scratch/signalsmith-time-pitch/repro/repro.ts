/**
 * Browser repro harness for the Signalsmith Stretch tempo/pitch engine.
 * Served by Vite, driven from Node via CDP (see ./cdp-run.mjs).
 * Exposes `window.__repro.run(name)` resolving to { ok, res, console }.
 */
import { StemPlayerEngine } from "../../../src/lib/stemPlayerEngine";
import {
  createMultiTrackStretchAdapter,
  isSignalsmithStretchSupported,
  renderOfflineStems,
} from "../../../src/lib/signalsmithStretchAdapter";
import { registerWsolaAudioWorklet } from "../../../src/lib/wsolaProcessor";

const SR = 44100;
const STEMS = ["vocals", "drums", "bass", "other"] as const;
type Stem = (typeof STEMS)[number];
type AnyRec = Record<string, any>;

// ---------------------------------------------------------------- diagnostics
const consoleLog: string[] = [];
const origWarn = console.warn.bind(console);
const origError = console.error.bind(console);
console.warn = (...a: unknown[]) => {
  consoleLog.push("warn: " + a.map(String).join(" "));
  origWarn(...a);
};
console.error = (...a: unknown[]) => {
  consoleLog.push("error: " + a.map(String).join(" "));
  origError(...a);
};
window.addEventListener("error", (e) =>
  consoleLog.push(`window.onerror: ${e.message} @ ${e.filename}:${e.lineno}`)
);
window.addEventListener("unhandledrejection", (e) =>
  consoleLog.push(
    "unhandledrejection: " + String((e as PromiseRejectionEvent).reason)
  )
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: number, d = 3) => Number(v.toFixed(d));

function errStr(e: unknown): string {
  const err = e as { stack?: string; message?: string };
  if (err && (err.stack || err.message))
    return String(err.stack || err.message);
  return String(e);
}

// ------------------------------------------------------------------- signals
function sineChannel(
  seconds: number,
  hz: number,
  sr: number,
  amp = 0.5
): Float32Array {
  const n = Math.round(seconds * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return out;
}

function silentChannel(seconds: number, sr: number): Float32Array {
  return new Float32Array(Math.round(seconds * sr));
}

// Positive-going zero crossings per second = fundamental frequency estimate.
function zeroCrossRate(
  data: Float32Array,
  from: number,
  to: number,
  sr: number
): number {
  let crossings = 0;
  for (let i = Math.max(1, from); i < to; i++) {
    if (data[i - 1] < 0 && data[i] >= 0) crossings++;
  }
  const secs = (to - from) / sr;
  return secs > 0 ? crossings / secs : 0;
}

function activeRange(
  data: Float32Array,
  thr = 0.02
): { from: number; to: number } {
  let from = 0;
  while (from < data.length && Math.abs(data[from]) < thr) from++;
  let to = data.length - 1;
  while (to > from && Math.abs(data[to]) < thr) to--;
  return { from, to };
}

function measureRendered(data: Float32Array, sr: number, inputSecs: number) {
  const { from, to } = activeRange(data);
  if (to - from < Math.round(sr * 0.05))
    return { freqHz: 0, durSec: 0, durRatio: 0 };
  const mid = Math.round((from + to) / 2);
  const win = Math.round(sr * 0.25);
  const a = Math.max(from, mid - win);
  const b = Math.min(to, mid + win);
  const durSec = (to - from) / sr;
  return {
    freqHz: num(zeroCrossRate(data, a, b, sr), 1),
    durSec: num(durSec, 3),
    durRatio: num(durSec / inputSecs, 3),
  };
}

async function measureAnalyser(analyser: AnalyserNode, sr: number, ms: number) {
  const buf = new Float32Array(analyser.fftSize);
  const readings: number[] = [];
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    analyser.getFloatTimeDomainData(buf);
    readings.push(zeroCrossRate(buf, 0, buf.length, sr));
    await sleep(60);
  }
  readings.sort((x, y) => x - y);
  const mid = readings[Math.floor(readings.length / 2)];
  return {
    medianHz: num(mid, 1),
    minHz: num(readings[0], 1),
    maxHz: num(readings[readings.length - 1], 1),
    samples: readings.length,
  };
}

// inputTime advance per audio-clock second == playback rate the node is running at.
async function measureInputRate(node: AnyRec, ctx: AudioContext, ms: number) {
  const a = node.inputTime;
  const ta = ctx.currentTime;
  await sleep(ms);
  const b = node.inputTime;
  const tb = ctx.currentTime;
  const dt = tb - ta;
  return dt > 0 ? num((b - a) / dt, 3) : 0;
}
// -------------------------------------------------------------------- tests
async function testEnv() {
  const out: AnyRec = {};
  out.hasAudioContext = typeof (window as any).AudioContext === "function";
  out.hasWasm = typeof WebAssembly !== "undefined";
  out.userAgent = navigator.userAgent;
  out.crossOriginIsolated = (window as any).crossOriginIsolated === true;
  const ctx = new AudioContext({ sampleRate: SR });
  out.stateBeforeResume = ctx.state;
  out.sampleRate = ctx.sampleRate;
  out.hasAudioWorklet =
    !!ctx.audioWorklet && typeof ctx.audioWorklet.addModule === "function";
  const AWN = (window as any).AudioWorkletNode;
  out.nativeWorklet =
    typeof AWN === "function" && String(AWN).includes("[native code]");
  out.supportedByHelper = isSignalsmithStretchSupported(ctx);
  try {
    await ctx.resume();
  } catch (e) {
    out.resumeError = errStr(e);
  }
  out.stateAfterResume = ctx.state;
  const t0 = ctx.currentTime;
  await sleep(300);
  out.clockAdvancePer300msWall = num(ctx.currentTime - t0);
  const oac = new OfflineAudioContext(2, 128, SR);
  out.offlineSupportedByHelper = isSignalsmithStretchSupported(oac);
  await ctx.close();
  return out;
}

async function testWasmDirect() {
  const out: AnyRec = {};
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.resume().catch(() => undefined);
  let mod: AnyRec;
  try {
    mod = (await import("signalsmith-stretch")) as AnyRec;
    out.moduleKeys = Object.keys(mod);
  } catch (e) {
    out.importError = errStr(e);
    await ctx.close();
    return out;
  }
  const SignalsmithStretch = mod.default || mod;
  out.factoryType = typeof SignalsmithStretch;
  let node: AnyRec;
  try {
    node = await SignalsmithStretch(ctx, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
  } catch (e) {
    out.createError = errStr(e);
    await ctx.close();
    return out;
  }
  out.created = true;
  out.className = node?.constructor?.name;
  out.numberOfInputs = node.numberOfInputs;
  out.numberOfOutputs = node.numberOfOutputs;
  out.paramNames = Array.from(
    { length: node.numberOfParameters },
    (_, i) => node.parameters[i]?.name
  );
  out.methods = [
    "schedule",
    "start",
    "stop",
    "addBuffers",
    "dropBuffers",
    "connect",
  ].map((m) => `${m}:${typeof node[m]}`);

  const left = sineChannel(3, 440, SR);
  const right = sineChannel(3, 440, SR);
  try {
    out.addBuffersReturn = await node.addBuffers([left, right]);
  } catch (e) {
    out.addBuffersError = errStr(e);
    await ctx.close();
    return out;
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  node.connect(analyser);
  node.connect(ctx.destination);

  try {
    await node.schedule({ active: true, input: 0, rate: 1, semitones: 2 });
    node.start(ctx.currentTime + 0.05, 0);
  } catch (e) {
    out.scheduleStartError = errStr(e);
    await ctx.close();
    return out;
  }

  await sleep(400);
  out.rate1_semi2_freq = await measureAnalyser(analyser, SR, 800);
  out.rate1_semi2_inputRate = await measureInputRate(node, ctx, 500);
  try {
    await node.schedule({ rate: 1.5, semitones: 2 });
  } catch (e) {
    out.rescheduleError = errStr(e);
  }
  await sleep(350);
  out.rate15_semi2_freq = await measureAnalyser(analyser, SR, 800);
  out.rate15_semi2_inputRate = await measureInputRate(node, ctx, 500);
  try {
    await node.schedule({ rate: 1, semitones: 0 });
  } catch (e) {
    out.reschedule2Error = errStr(e);
  }
  await sleep(350);
  out.rate1_semi0_freq = await measureAnalyser(analyser, SR, 800);
  try {
    node.stop(ctx.currentTime + 0.1);
  } catch (e) {
    out.stopError = errStr(e);
  }
  await ctx.close();
  return out;
}

async function testAdapter() {
  const out: AnyRec = {};
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.resume().catch(() => undefined);
  try {
    const adapter = await createMultiTrackStretchAdapter({
      audioContext: ctx,
      sampleRate: SR,
    });
    out.adapterClass = adapter.constructor.name;
    out.isFallback = adapter.isFallback;
  } catch (e) {
    out.adapterError = errStr(e);
  }
  await ctx.close();
  return out;
}

async function testWsola() {
  const out: AnyRec = {};
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.resume().catch(() => undefined);
  try {
    out.registered = await registerWsolaAudioWorklet(ctx);
  } catch (e) {
    out.wsolaError = errStr(e);
  }
  await ctx.close();
  return out;
}
function makeStems(seconds: number): Record<Stem, Float32Array[]> {
  const stems = {} as Record<Stem, Float32Array[]>;
  for (const stem of STEMS) {
    stems[stem] =
      stem === "vocals"
        ? [sineChannel(seconds, 440, SR), sineChannel(seconds, 440, SR)]
        : [silentChannel(seconds, SR), silentChannel(seconds, SR)];
  }
  return stems;
}

async function testEngine() {
  const out: AnyRec = {};
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.resume().catch(() => undefined);
  const engine = new StemPlayerEngine(makeStems(4), {
    audioContext: ctx,
    sampleRate: SR,
  });
  out.workletReady = await engine.waitForWorkletReady();
  const adapter = engine.getStretchAdapter();
  out.adapterClass = adapter ? adapter.constructor.name : null;
  out.adapterIsFallback = adapter ? adapter.isFallback : null;

  const logs: AnyRec[] = [];
  if (adapter && !adapter.isFallback) {
    for (const stem of STEMS) {
      const node = adapter.getStemNode(stem) as AnyRec;
      const orig = node.schedule.bind(node);
      node.schedule = (p: AnyRec) => {
        logs.push({ stem, ...p });
        return orig(p);
      };
    }
    out.instrumented = true;
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  engine.getMasterGainNode().connect(analyser);

  await engine.play();
  out.playing = engine.isPlaying();
  out.fallbackSourceRates = engine
    .getActiveSources()
    .map((s) => s.playbackRate.value);
  out.tempo1_pitch0_freq = await measureAnalyser(analyser, SR, 800);

  engine.setPitch(3);
  await sleep(300);
  out.tempo1_pitch3_freq = await measureAnalyser(analyser, SR, 800);

  engine.setTempo(1.5);
  await sleep(300);
  out.tempo15_pitch3_freq = await measureAnalyser(analyser, SR, 800);
  out.fallbackSourceRatesAfter = engine
    .getActiveSources()
    .map((s) => s.playbackRate.value);
  out.scheduleLogTail = logs.slice(-10);

  engine.pause();
  engine.dispose();
  await ctx.close();
  return out;
}

async function renderDirect(
  channels: Float32Array[],
  tempo: number,
  pitch: number,
  formant = false
) {
  const inLen = channels[0].length;
  const inputSecs = inLen / SR;
  const targetLen = Math.max(1, Math.round(inLen / tempo));
  const oac = new OfflineAudioContext(channels.length, targetLen, SR);
  const mod = (await import("signalsmith-stretch")) as AnyRec;
  const SignalsmithStretch = mod.default || mod;
  const node = await SignalsmithStretch(oac, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [channels.length],
  });
  await node.addBuffers(channels);
  await node.schedule({
    active: true,
    input: 0,
    rate: tempo,
    semitones: pitch,
    formantCompensation: formant,
  });
  node.start(0, 0);
  node.connect(oac.destination);
  const rendered = await oac.startRendering();
  const data = rendered.getChannelData(0);
  return {
    targetSec: num(targetLen / SR, 3),
    ...measureRendered(data, SR, inputSecs),
  };
}

async function testOffline() {
  const out: AnyRec = {};
  const cases = [
    { tempo: 1.0, pitch: 0, expectHz: 440, expectRatio: 1 },
    { tempo: 1.0, pitch: 2, expectHz: 493.9, expectRatio: 1 },
    { tempo: 1.5, pitch: 0, expectHz: 440, expectRatio: 0.667 },
    { tempo: 1.5, pitch: 2, expectHz: 493.9, expectRatio: 0.667 },
    { tempo: 0.75, pitch: -3, expectHz: 369.99, expectRatio: 1.333 },
  ];
  const rows: AnyRec[] = [];
  for (const c of cases) {
    try {
      const r = await renderDirect(
        [sineChannel(2, 440, SR), sineChannel(2, 440, SR)],
        c.tempo,
        c.pitch
      );
      rows.push({ ...c, ...r });
    } catch (e) {
      rows.push({ ...c, error: errStr(e) });
    }
  }
  out.directWasm = rows;
  return out;
}

async function testExportRender() {
  const out: AnyRec = {};
  const stems = makeStems(2);
  const rendered = await renderOfflineStems(stems, {
    sampleRate: SR,
    tempo: 1.5,
    pitch: 2,
    formantPreservation: true,
  });
  out.vocals = measureRendered(rendered.vocals[0], SR, 2);
  out.vocalsLen = rendered.vocals[0].length;
  return out;
}

async function testWorkletDiag() {
  const out: AnyRec = {};
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.resume().catch(() => undefined);

  // Capture the worklet module source the library builds for addModule()
  const captured: string[] = [];
  const origCreate = URL.createObjectURL.bind(URL);
  (URL as any).createObjectURL = function (b: any) {
    const p = (b as Blob).text?.();
    if (p) (p as Promise<string>).then((t) => captured.push(t)).catch(() => {});
    return origCreate(b as Blob);
  };

  const mod = (await import("signalsmith-stretch")) as AnyRec;
  const S = mod.default || mod;
  out.optimizedFactory = await Promise.race([
    S(ctx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
      .then(() => "resolved")
      .catch((e: unknown) => "error: " + errStr(e)),
    sleep(6000).then(() => "timeout (promise never settles)"),
  ]);

  await sleep(300);
  (URL as any).createObjectURL = origCreate;

  const code = captured[0];
  (globalThis as AnyRec).__capturedCode = code || "";
  out.capturedCount = captured.length;
  out.capturedBytes = code ? code.length : 0;
  out.capturedHasRegisterProcessor =
    !!code && code.includes("registerProcessor");

  if (code) {
    const diagKey = "diag-stretch";
    const head =
      "self.addEventListener('unhandledrejection',function(e){console.log('WORKLET_REJECT '+(e.reason&&(e.reason.stack||e.reason.message||String(e.reason))))});" +
      "self.onerror=function(m,u,l,c,e2){console.log('WORKLET_ERROR '+m+' @'+u+':'+l+' '+(e2&&e2.stack?e2.stack:''))};" +
      "console.log('WORKLET_LOADED AWProc='+typeof AudioWorkletProcessor+' wasm='+typeof WebAssembly+' loc='+String(self.location&&self.location.href).slice(0,40));";
    const body = code.replace(
      /"signalsmith-stretch"/g,
      JSON.stringify(diagKey)
    );
    const diagCode =
      head +
      "try{" +
      body +
      "console.log('WORKLET_TOPLEVEL_OK')}catch(e){console.log('WORKLET_SYNC_ERR '+(e&&e.stack||e))}";

    try {
      const url = origCreate(new Blob([diagCode], { type: "text/javascript" }));
      await ctx.audioWorklet.addModule(url);
      out.diagModuleRegistered = true;
    } catch (e) {
      out.diagModuleError = errStr(e);
    }

    if (out.diagModuleRegistered) {
      const messages: string[] = [];
      try {
        const node = new AudioWorkletNode(ctx, diagKey, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });
        node.port.onmessage = (ev: MessageEvent) => {
          const d = ev.data;
          messages.push(
            Array.isArray(d)
              ? d
                  .map((x: unknown) =>
                    typeof x === "object"
                      ? JSON.stringify(x).slice(0, 120)
                      : String(x)
                  )
                  .join(" | ")
              : String(d)
          );
        };
        out.nodeConstructed = true;
        const t0 = Date.now();
        while (Date.now() - t0 < 8000 && messages.length === 0)
          await sleep(100);
        out.diagMessages = messages.slice(0, 8);
        out.diagSawReady = messages.some((m) => m.startsWith("ready"));
      } catch (e) {
        out.nodeConstructError = errStr(e);
      }
    }
  }
  await ctx.close();
  return out;
}

async function testRawFactory() {
  const out: AnyRec = {};
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.resume().catch(() => undefined);
  const res = await fetch(
    "/.scratch/signalsmith-time-pitch/repro/SignalsmithStretch.raw.mjs"
  );
  out.fetchedStatus = res.status;
  const src = await res.text();
  out.srcBytes = src.length;
  const blobUrl = URL.createObjectURL(
    new Blob([src], { type: "text/javascript" })
  );
  let mod: AnyRec;
  try {
    mod = await import(/* @vite-ignore */ blobUrl);
  } catch (e) {
    out.rawImportError = errStr(e);
    await ctx.close();
    return out;
  }
  const S = mod.default || mod;
  out.rawFactoryType = typeof S;
  out.rawFactory = await Promise.race([
    S(ctx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
      .then(
        (n: AnyRec) =>
          "resolved:" + (n && n.constructor ? n.constructor.name : typeof n)
      )
      .catch((e: unknown) => "error: " + errStr(e)),
    sleep(9000).then(() => "timeout (promise never settles)"),
  ]);
  await ctx.close();
  return out;
}

async function testDumpRawModule(): Promise<Record<string, unknown>> {
  const out: AnyRec = {};
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.resume().catch(() => undefined);
  const res = await fetch(
    "/.scratch/signalsmith-time-pitch/repro/SignalsmithStretch.raw.mjs"
  );
  const src = await res.text();
  const blobUrl = URL.createObjectURL(
    new Blob([src], { type: "text/javascript" })
  );
  const origCreate = URL.createObjectURL.bind(URL);
  const captured: string[] = [];
  (URL as any).createObjectURL = function (b: any) {
    const p = (b as Blob).text?.();
    if (p) (p as Promise<string>).then((t) => captured.push(t)).catch(() => {});
    return origCreate(b as Blob);
  };
  const mod = (await import(/* @vite-ignore */ blobUrl)) as AnyRec;
  const S = mod.default || mod;
  out.factory = await Promise.race([
    S(ctx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
      .then(
        (n: AnyRec) =>
          "resolved:" + (n && n.constructor ? n.constructor.name : typeof n)
      )
      .catch((e: unknown) => "error: " + errStr(e)),
    sleep(6000).then(() => "timeout (promise never settles)"),
  ]);
  await sleep(300);
  (URL as any).createObjectURL = origCreate;
  const code = captured[0];
  (globalThis as AnyRec).__capturedRawCode = code || "";
  out.capturedCount = captured.length;
  out.capturedBytes = code ? code.length : 0;
  await ctx.close();
  return out;
}

async function testDumpCaptured(): Promise<Record<string, unknown>> {
  let code = (globalThis as AnyRec).__capturedCode as string | undefined;
  if (!code) {
    await testWorkletDiag();
    code = (globalThis as AnyRec).__capturedCode as string | undefined;
  }
  if (!code) throw new Error("no captured code");
  return { bytes: code.length, code };
}

async function testDumpBoth(): Promise<Record<string, unknown>> {
  await testWorkletDiag();
  await testDumpRawModule();
  return {
    optimized: (globalThis as AnyRec).__capturedCode || "",
    raw: (globalThis as AnyRec).__capturedRawCode || "",
  };
}

const tests: Record<string, () => Promise<unknown>> = {
  env: testEnv,
  wasmDirect: testWasmDirect,
  adapter: testAdapter,
  wsola: testWsola,
  engine: testEngine,
  offline: testOffline,
  exportRender: testExportRender,
  workletDiag: testWorkletDiag,
  rawFactory: testRawFactory,
  dumpCaptured: testDumpCaptured,
  dumpRaw: testDumpRawModule,
  dumpBoth: testDumpBoth,
};

(window as any).__repro = {
  ready: true,
  tests: Object.keys(tests),
  run: async (name: string) => {
    const fn = tests[name];
    if (!fn) return { ok: false, error: "unknown test: " + name };
    const start = consoleLog.length;
    try {
      const res = await fn();
      return { ok: true, res, console: consoleLog.slice(start) };
    } catch (e) {
      return { ok: false, error: errStr(e), console: consoleLog.slice(start) };
    }
  },
};

const el = document.getElementById("out");
if (el) el.textContent = "harness ready: " + Object.keys(tests).join(", ");
