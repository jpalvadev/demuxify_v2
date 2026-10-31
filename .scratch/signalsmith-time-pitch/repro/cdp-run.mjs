#!/usr/bin/env node
/**
 * CDP driver for the Signalsmith time/pitch repro harness.
 * Launches headless Chrome with an isolated profile (never the user profile),
 * opens the harness page, and evaluates `window.__repro.run(name)` per test.
 *
 * Usage:
 *   node cdp-run.mjs [pageUrl] [testNames]
 * Env:
 *   CDP_ATTACH=1   attach to an already-running Chrome on CDP_PORT
 *   CDP_PORT=9333
 *   OUT=<file>     write JSON results to file (default: ./results.json)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = Number(process.env.CDP_PORT || 9333);
const PROFILE =
  process.env.CHROME_PROFILE ||
  "C:\\Users\\Lorenzo06\\AppData\\Local\\Temp\\opencode\\chrome-repro-profile";
const PAGE =
  process.argv[2] ||
  "https://127.0.0.1:5173/.scratch/signalsmith-time-pitch/repro/repro.html";
const TESTS = (
  process.argv[3] || "env,adapter,wsola,wasmDirect,engine,offline,exportRender"
)
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const OUT = process.env.OUT || path.join(HERE, "results.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (msg) =>
  process.stderr.write(`[cdp +${Date.now() - t0}ms] ${msg}\n`);

const chromeArgs = [
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${PORT}`,
  "--remote-allow-origins=*",
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--autoplay-policy=no-user-gesture-required",
  "--ignore-certificate-errors",
  "--mute-audio",
  "--disable-features=Translate,MediaRouter",
  "about:blank",
];

async function waitForJson(url, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return await res.json();
    } catch {
      // endpoint not up yet
    }
    await sleep(400);
  }
  return null;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, method, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error)
          reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  send(method, params = {}, timeoutMs = 30000, sessionId = undefined) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, method, timer });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      this.ws.send(JSON.stringify(msg));
    });
  }
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      maxPayload: 128 * 1024 * 1024,
      connectTimeout: 15000,
    });
    const timer = setTimeout(() => {
      try {
        ws.terminate();
      } catch {}
      reject(new Error("ws connect timeout: " + url));
    }, 15000);
    ws.on("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function main() {
  let proc = null;
  if (process.env.CDP_ATTACH !== "1") {
    proc = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
    proc.stderr.on("data", (d) => log("chrome stderr: " + d.toString().trim()));
    log("launched chrome pid=" + proc.pid);
  }

  const version = await waitForJson(
    `http://127.0.0.1:${PORT}/json/version`,
    30000
  );
  if (!version || !version.webSocketDebuggerUrl) {
    throw new Error("CDP /json/version endpoint not available on port " + PORT);
  }
  log("browser: " + version.Browser);

  const ws = await connectWs(version.webSocketDebuggerUrl);
  log("ws connected");
  const cdp = new Cdp(ws);

  const { targetId } = await cdp.send("Target.createTarget", {
    url: PAGE,
    background: false,
  });
  log("target created " + targetId);
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  log("attached session " + sessionId);

  const ev = (method, params = {}, timeoutMs = 30000) =>
    cdp.send(method, params, timeoutMs, sessionId);

  await ev("Runtime.enable");
  await ev("Page.enable").catch(() => {});
  await ev("Security.enable").catch(() => {});
  await ev("Security.setIgnoreCertificateErrors", { ignore: true }).catch(
    () => {}
  );

  const consoleEvents = [];
  cdp.events = cdp.events || [];
  const pollConsole = () => {
    for (const e of cdp.events) {
      if (
        e.method === "Runtime.consoleAPICalled" &&
        e.params.sessionId === sessionId
      ) {
        consoleEvents.push(
          e.params.type +
            ": " +
            (e.params.args || []).map((a) => a.value ?? a.description).join(" ")
        );
      }
      if (
        e.method === "Runtime.exceptionThrown" &&
        e.params.sessionId === sessionId
      ) {
        consoleEvents.push(
          "exception: " +
            (e.params.exceptionDetails?.exception?.description ||
              e.params.exceptionDetails?.text)
        );
      }
    }
  };

  // Poll for harness module readiness.
  let ready = false;
  let readyDeadline = Date.now() + 45000;
  while (Date.now() < readyDeadline && !ready) {
    const r = await ev(
      "Runtime.evaluate",
      {
        expression: "!!(window.__repro && window.__repro.ready)",
        returnByValue: true,
      },
      10000
    ).catch((e) => {
      log("ready poll error: " + e.message);
      return null;
    });
    ready = r?.result?.value === true;
    if (!ready) await sleep(700);
  }
  if (!ready) {
    const probe = await ev("Runtime.evaluate", {
      expression:
        "'ready=false html=' + document.documentElement.innerHTML.slice(0, 500)",
      returnByValue: true,
    }).catch((e) => ({ value: "probe failed: " + e.message }));
    pollConsole();
    throw new Error(
      "harness not ready. " +
        JSON.stringify(probe?.value) +
        " console=" +
        JSON.stringify(consoleEvents)
    );
  }
  log("harness ready");

  // Synthetic input grants document user activation, which headless autoplay
  // policy otherwise withholds (AudioContext would stay suspended).
  await ev("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "x",
    text: "x",
    windowsVirtualKeyCode: 88,
  }).catch(() => {});
  await ev("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "x",
    text: "x",
    windowsVirtualKeyCode: 88,
  }).catch(() => {});
  await ev("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 10,
    y: 10,
    button: "left",
    clickCount: 1,
    buttons: 1,
  }).catch(() => {});
  await ev("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 10,
    y: 10,
    button: "left",
    clickCount: 1,
    buttons: 0,
  }).catch(() => {});
  const act = await ev("Runtime.evaluate", {
    expression:
      "JSON.stringify({active: !!(navigator.userActivation && navigator.userActivation.hasBeenActive)})",
    returnByValue: true,
  }).catch(() => null);
  log("user activation: " + (act?.result?.value || "unknown"));

  const results = { __browser: version.Browser, __page: PAGE };
  for (const name of TESTS) {
    const started = Date.now();
    log("running " + name);
    try {
      const r = await ev(
        "Runtime.evaluate",
        {
          expression: `window.__repro.run(${JSON.stringify(name)})`,
          awaitPromise: true,
          returnByValue: true,
          timeout: 120000,
        },
        125000
      );
      results[name] = r?.exceptionDetails
        ? {
            ok: false,
            error: JSON.stringify(r.exceptionDetails).slice(0, 1500),
          }
        : r?.result?.value;
    } catch (e) {
      results[name] = { ok: false, error: String(e) };
    }
    results[name].msElapsed = Date.now() - started;
    log(`done ${name} ok=${results[name]?.ok} (${results[name].msElapsed}ms)`);
    pollConsole();
  }
  results.__console = consoleEvents.slice(-40);

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2), "utf8");
  log("wrote " + OUT);

  await cdp.send("Target.detachFromTarget", { sessionId }).catch(() => {});
  await cdp.send("Target.closeTarget", { targetId }, 10000).catch(() => {});
  ws.close();
  if (proc) proc.kill("SIGKILL");
  return 0;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    log("FATAL " + (e?.stack || e));
    try {
      fs.writeFileSync(
        OUT,
        JSON.stringify({ fatal: String(e?.stack || e) }, null, 2),
        "utf8"
      );
    } catch {}
    process.exit(1);
  });
