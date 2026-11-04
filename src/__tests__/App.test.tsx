import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import App from "../App";
import * as webgpuModule from "../lib/webgpu";
import * as audioDecoderModule from "../lib/audioDecoder";
import { InferenceClient } from "../lib/inferenceClient";
import * as toastModule from "../lib/toast";
import * as bundleZip from "../lib/bundleZip";
import { WorkerOutMessage } from "../workers/beatDetection.worker";
import { decodeWavOnsets } from "./wavOnsetsHelper";

// --- Tempo Detector Worker stub (ticket 06) ---------------------------------
// The app only ever reaches the heavy BPM pass through the Web Worker seam, so
// the re-lock tests swap this stub in: it answers a start message with a Beat
// Grid at the requested feel (the hint is the candidate the rail's picker
// chose). Completions are queued instead of fired on post, which is how a test
// watches the Mix tab while a re-lock pass is still in flight and hands the
// reply over when it wants.
// Navigation pointer: the App feeds the ExportDialog props from App-level refs
// (tempoAnalysis, clickTrackStateRef), so a StemPlayer-only click (rail
// toggle, candidate pick) re-renders only that subtree and leaves those props
// stale. Click a Tab button (e.g. "Export") before asserting the bundler's
// call args.
let tempoWorkerQueue: (() => void)[] = [];
// Ticket 07 (Drums Stem re-detection): which channel each heavy pass was
// posted over. The stub records every start message so tests can prove the
// policy point — Drums Stem samples when available, Source Mix as fallback —
// without reaching into the worker.
let tempoWorkerStarts: { sampleCount: number; hintBpm: number | undefined }[] =
  [];

class StubTempoWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: any) {
    if (!message || message.type !== "start") return;
    tempoWorkerStarts.push({
      sampleCount: message.samples?.length ?? 0,
      hintBpm: message.hintBpm,
    });
    const bpm = message.hintBpm ?? 107.7;
    const intervalSec = 60 / bpm;
    // Short span so a completed export bundle stays cheap to encode: the
    // Click Track file the export tests read is cut on this grid.
    const beatCount = Math.round(2 / intervalSec);
    // Typed against the worker's own WorkerOutMessage union, so typecheck
    // polices drift between what the stub answers and what the real relay
    // can send: a renamed field there stops these tests compiling instead
    // of failing as a bare assertion at runtime.
    const complete: WorkerOutMessage = {
      type: "complete",
      // The engine's ranking never changes: only the user's pick does.
      candidates: [
        { bpm: 107.7, confidence: 0.93 },
        { bpm: 215.4, confidence: 0.61 },
      ],
      beatGrid: Float64Array.from(
        Array.from({ length: beatCount }, (_, i) => i * intervalSec)
      ),
      analyzedBpm: bpm,
      duration: 2,
    };
    tempoWorkerQueue.push(() => {
      this.onmessage?.({ data: complete } as MessageEvent);
    });
  }

  terminate() {}
}

const fireQueuedTempoCompletions = () => {
  const queued = tempoWorkerQueue;
  tempoWorkerQueue = [];
  queued.forEach((deliver) => deliver());
};

describe("App UI Shell", () => {
  const dummyBuffer = {
    duration: 180,
    sampleRate: 44100,
    numberOfChannels: 2,
    length: 180 * 44100,
    getChannelData: () => new Float32Array(500),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(audioDecoderModule, "decodeAudio").mockResolvedValue({
      buffer: dummyBuffer as any,
      metadata: {
        fileName: "song_master.mp3",
        fileSize: 5000000,
        duration: 180,
        sampleRate: 44100,
        numberOfChannels: 2,
      },
    });
  });

  it("hosts the Brand Unit in the one sticky Tab Rail block with no page-level header at any breakpoint", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
      adapterInfo: { vendor: "NVIDIA", device: "RTX 3080" },
    });

    render(<App />);

    // One shell chrome region: the Tab Rail is the only navigation, the page-level
    // <header> is gone for good (ticket 02), and the rail itself carries the pinning.
    const rail = screen.getByRole("navigation", { name: /tab band/i });
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.queryByRole("header")).toBeNull();

    // Sticky merged block asserted by class tokens (the DOM seam cannot evaluate
    // media queries — grz-18 precedent): the rail is one sticky top block at every
    // breakpoint, brand row over the four-chip Tab row.
    const railClasses = rail.getAttribute("class") ?? "";
    for (const token of ["sticky", "top-0", "z-30"]) {
      expect(railClasses).toContain(token);
    }

    // The Brand Unit lives inside the Tab Rail, not in a page-level header
    const brand = within(rail).getByTestId("brand-unit");
    expect(brand).toBeInTheDocument();

    // The lockup paints at every breakpoint (no display-gating tokens); shrink-0
    // keeps it whole beside the chip container in the Band row at md+.
    const brandClasses = brand.getAttribute("class") ?? "";
    expect(brandClasses).not.toMatch(/(^|\s)hidden(\s|$|:)/);
    expect(brandClasses).toContain("shrink-0");

    // The single top-level heading is the rail wordmark
    const heading = within(brand).getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/demuxify/i);

    // Lockup parts: pulsing coral status dot; the mono tagline line is always
    // visible — the mockup 9px uppercase micro-line (06b port).
    expect(
      within(brand).getByTestId("brand-unit-status-dot")
    ).toBeInTheDocument();
    const tagline = within(brand).getByText(/client-side stem separation/i);
    expect(tagline.getAttribute("class") ?? "").toContain("uppercase");
    expect(tagline.getAttribute("class") ?? "").toContain("text-[9px]");

    // Stitch skin (ticket 05): the System Tab's mono identity <p> died with
    // the band — the claim rides the mobile lockup line (pinned above), so
    // the System region must not resurrect it.
    const systemPanel = screen.getByRole("region", { name: /^System Tab$/ });
    expect(
      within(systemPanel).queryByText(/client-side stem separation/i)
    ).toBeNull();

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });
  });

  it("shows WebGPU Active badge when hardware acceleration is available", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
      adapterInfo: { vendor: "Apple", device: "Apple M2" },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Fallback Mode (CPU)")).not.toBeInTheDocument();
  });

  it("shows Fallback Mode badge and advisory alert when WebGPU is unavailable", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: false,
      isFallback: true,
      errorReason: "WebGPU is not supported in this browser.",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Fallback Mode (CPU)")).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/WebGPU is not supported in this browser/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/running in cpu\/wasm fallback mode/i)
    ).toBeInTheDocument();
  });

  it("renders the Source Mix dropzone ready to receive audio files", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    expect(
      screen.getByText(/drag and drop your source mix/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/browse files/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });
  });

  it("decodes audio and displays the Source Mix card while the timeline stays gated", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });

    const file = new File(["dummy audio content"], "song_master.mp3", {
      type: "audio/mp3",
    });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("song_master.mp3")).toBeInTheDocument();
      // Metadata in SourceMixCard and MasterWaveform (getAllByText: the Band
      // engine-badge placeholder now echoes the 44.1 kHz readout too).
      expect(screen.getAllByText(/3:00/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/44\.1\s*kHz/i).length).toBeGreaterThanOrEqual(
        1
      );
      expect(screen.getByText(/Stereo/i)).toBeInTheDocument();
      // Primary button
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
      // No timeline surface yet: the Mix Tab owns the spine and stays gated
      expect(
        screen.queryByRole("slider", { name: /master waveform timeline/i })
      ).toBeNull();
      const rail = screen.getByRole("navigation", { name: /tab band/i });
      const mixChip = within(rail).getByRole("button", { name: /^Mix$/i });
      expect(mixChip.getAttribute("class") ?? "").toContain("opacity-50");
    });
  });

  it("allows interactive scrubbing on the Master Waveform to seek playback position", async () => {
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });
    const spine = within(mixTab).getByRole("slider", {
      name: /master waveform timeline/i,
    });

    // Keyboard scrub: arrows walk the shared transport by 5s steps
    fireEvent.keyDown(spine, { key: "ArrowRight" });
    await waitFor(() => {
      expect(spine).toHaveAttribute("aria-valuenow", "5");
    });

    fireEvent.keyDown(spine, { key: "ArrowRight", shift: true });
    await waitFor(() => {
      expect(spine).toHaveAttribute("aria-valuenow", "10");
    });

    // Pointer scrub: drag the playhead to 75% of the track
    vi.spyOn(spine, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 84,
      right: 600,
      bottom: 84,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    fireEvent.pointerDown(spine, { clientX: 450, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(spine, { clientX: 450, clientY: 40, pointerId: 1 });
    await waitFor(() => {
      expect(spine).toHaveAttribute("aria-valuenow", "135");
    });
    fireEvent.pointerUp(spine, { clientX: 450, clientY: 40, pointerId: 1 });
  });

  it("allows removing the loaded Source Mix to return to the dropzone", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("song_master.mp3")).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole("button", {
      name: /remove source mix/i,
    });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText("song_master.mp3")).not.toBeInTheDocument();
      expect(
        screen.getByText(/drag and drop your source mix/i)
      ).toBeInTheDocument();
    });
  });

  it("displays descriptive error when audio decoding fails", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    vi.spyOn(audioDecoderModule, "decodeAudio").mockRejectedValue(
      new Error(
        'Failed to decode audio file "corrupted.mp3": Unsupported codec'
      )
    );

    render(<App />);

    const file = new File(["bad data"], "corrupted.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Failed to decode audio file "corrupted\.mp3": Unsupported codec/i
        )
      ).toBeInTheDocument();
    });
  });

  it("ships dark-only with no theme toggle anywhere", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });

    // Dark-only contract: no toggle button, and html keeps the `dark` class
    expect(screen.queryByRole("button", { name: /toggle theme/i })).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("initiates stem separation when Separate Stems button is clicked and displays progress", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    // Should display SeparationProgress region
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /separation progress/i })
      ).toBeInTheDocument();
    });
  });

  it("completes separation and renders the 4 separated discrete stems", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    const initSpy = vi
      .spyOn(InferenceClient.prototype, "init")
      .mockResolvedValue({ backend: "webgpu" });
    const separateSpy = vi
      .spyOn(InferenceClient.prototype, "separate")
      .mockResolvedValue({
        stems: {
          vocals: [new Float32Array(500), new Float32Array(500)],
          drums: [new Float32Array(500), new Float32Array(500)],
          bass: [new Float32Array(500), new Float32Array(500)],
          other: [new Float32Array(500), new Float32Array(500)],
        },
        duration: 180,
      });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /separation complete/i })
      ).toBeInTheDocument();
    });

    const completeRegion = screen.getByRole("region", {
      name: /separation complete/i,
    });
    expect(completeRegion).toBeInTheDocument();
    expect(within(completeRegion).getByText(/vocals/i)).toBeInTheDocument();
    expect(within(completeRegion).getByText(/drums/i)).toBeInTheDocument();
    expect(within(completeRegion).getByText(/bass/i)).toBeInTheDocument();
    expect(within(completeRegion).getByText(/other/i)).toBeInTheDocument();

    expect(initSpy).toHaveBeenCalled();
    expect(separateSpy).toHaveBeenCalled();
  });

  it("allows cancelling separation at any time", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /cancel separation/i })
      ).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", {
      name: /cancel separation/i,
    });
    fireEvent.click(cancelBtn);

    // Should return to idle without SeparationProgress region
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /separation progress/i })
      ).not.toBeInTheDocument();
    });
  });

  it("activates and displays the Stem Player with all 4 stems and controls when separation completes", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
      backend: "webgpu",
    });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /stem player/i })
      ).toBeInTheDocument();
    });

    const stemPlayerRegion = screen.getByRole("region", {
      name: /stem player/i,
    });
    // Stitch skin 07j: the live Play/Pause transport row is erased from the
    // hosted Mix Tab; the row controls anchor the "controls render" claim.
    expect(
      within(stemPlayerRegion).queryByRole("button", {
        name: /^play\/pause$/i,
      })
    ).toBeNull();
    expect(
      within(stemPlayerRegion).getByRole("button", { name: /mute vocals/i })
    ).toBeInTheDocument();
    expect(
      within(stemPlayerRegion).getByRole("button", { name: /solo drums/i })
    ).toBeInTheDocument();
    expect(
      within(stemPlayerRegion).getByRole("slider", { name: /bass volume/i })
    ).toBeInTheDocument();
  });

  it("rules the Stem Player outer frames at every width — below-md is the same skin, restacked", async () => {
    // Stitch skin (ticket 06): the mobile sheet is the same skin re-stacked,
    // not a different one — the flattening dies and the Stem Player root
    // carries its hairline at EVERY width, with mobile-tight density. Class
    // tokens still carry the responsive truth (the DOM seam cannot evaluate
    // media queries; grz-18 precedent). The DSP rack underneath is unbuilt as
    // a container (07k, mockup truth): its cards do the ruling.
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
      backend: "webgpu",
    });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /stem player/i })
      ).toBeInTheDocument();
    });

    const stemPlayerRegion = screen.getByRole("region", {
      name: /stem player/i,
    });

    // The root region: ruled everywhere, no md: border birth left anywhere.
    const rootClasses = stemPlayerRegion.getAttribute("class") ?? "";
    expect(rootClasses).toContain("border");
    expect(rootClasses).toContain("border-st-hairline");
    expect(rootClasses).not.toMatch(/md:border/);
    // Stitch skin 07e: the root is now the mockup's section panel — bg-st-panel,
    // p-3 rhythm, space-y-2.5 gaps, rounded-lg sweep (no blur, no lifted
    // shadow). The ruling-everywhere invariant above still guards md: drift.
    for (const token of [
      "w-full",
      "rounded-lg",
      "bg-st-panel",
      "p-3",
      "space-y-2.5",
    ]) {
      expect(rootClasses).toContain(token);
    }

    // The DSP rack: the mockup has no container behind the rack (Stitch skin
    // 07k unbuilt it; 07n deleted its heading row), so the wrapper is
    // transparent — bare layout tokens, no border, no fill. Locator: the
    // rack root carries its own testid (the reset chip moved to the Tempo
    // card's foot, so the parentElement chain no longer lands on the rack).
    // Stitch skin 08c (user: "each functionality should be OUTSIDE of the 4
    // stems container"): the rack is no longer inside the Stem Player card —
    // it is the section's sibling on the stage, so the locator drops the
    // region scope and the card keeps no rack inside it.
    const rackClasses =
      screen.getByTestId("dsp-rack-root").getAttribute("class") ?? "";
    expect(rackClasses).not.toContain("border");
    expect(rackClasses).not.toContain("bg-secondary");
    for (const token of ["w-full", "flex", "flex-col", "gap-3", "sm:gap-4"]) {
      expect(rackClasses).toContain(token);
    }
    expect(within(stemPlayerRegion).queryByTestId("dsp-rack-root")).toBeNull();

    // Deliberate untouched neighbors: the Tempo/Speed and Pitch Transposition
    // sub-boxes keep their ruled frames at every viewport (06e ports the mockup
    // hairline token: border-st-hairline replaces border-border/50), and
    // the Click Track rail is lifted onto the same blanket card rule (08a:
    // the mix card's own container must be visible against the card ground,
    // so the translucent lane wash of 06/07 is no longer enough).
    const tempoSubBoxClasses =
      screen
        .getByTestId("current-tempo-label")
        .parentElement?.parentElement?.getAttribute("class") ?? "";
    expect(tempoSubBoxClasses).toContain("border border-st-hairline");
    const pitchSubBoxClasses =
      screen
        .getByTestId("current-pitch-label")
        .parentElement?.parentElement?.getAttribute("class") ?? "";
    expect(pitchSubBoxClasses).toContain("border border-st-hairline");

    await waitFor(() => {
      expect(screen.getByTestId("click-track-rail")).toBeInTheDocument();
    });
    const railClasses =
      screen.getByTestId("click-track-rail").getAttribute("class") ?? "";
    // Stitch skin 08a: the rail's rim is the blanket card rule, so the seam
    // pins the opaque hairline and proves the /40 lane wash died.
    expect(railClasses).toContain("border border-st-hairline");
    expect(railClasses).toContain("bg-st-panel");
    expect(railClasses.includes("border-st-hairline/40")).toBe(false);
  });

  it("keeps the Formant pill-slider dead in the composed Mix stage and homes the Mic chip on its label row", async () => {
    // Mix Rail Tidy-Up (ticket 02): the whole-app seam proves no pill-slider
    // marker (track span, translating knob, white-knob ring) survives
    // anywhere in the composed stage, the re-homed switch lives inline on
    // its label row inside the Pitch Transposition box, and the "Vocals
    // Stem" copy chip beside the label stays verbatim.
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
      backend: "webgpu",
    });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /stem player/i })
      ).toBeInTheDocument();
    });

    // Stitch skin 08c: the rack chrome this test inspects sits OUTSIDE the
    // Stem Player card, so the page itself is the right scope.
    // The re-homed control: one switch, announced state, square chip. It
    // lives on the rack's Pitch Transposition card, which Stitch skin 08c
    // parked OUTSIDE the Stem Player card (the user's 4-stems container
    // carries only its masthead and the waveform rows), so the lookups
    // drop the region scope.
    const formantSwitch = screen.getByRole("switch", {
      name: /vocal formant preservation/i,
    });
    expect(formantSwitch).toHaveAttribute("aria-checked", "true");
    const switchClasses = formantSwitch.getAttribute("class") ?? "";
    expect(switchClasses).toContain("h-8");
    expect(switchClasses).toContain("w-8");
    expect(switchClasses).not.toMatch(/translate-x|cursor-pointer/);
    expect(formantSwitch.querySelectorAll("span")).toHaveLength(0);

    // No pill-slider markup marker anywhere in the composed page.
    expect(document.querySelectorAll('[class*="translate-x-4"]').length).toBe(
      0
    );
    expect(document.querySelectorAll('[class*="translate-x-5"]').length).toBe(
      0
    );
    expect(document.querySelectorAll('[class*="ring-0"]').length).toBe(0);

    // The label-row copy chip stays verbatim next to the label — on the
    // rack's Pitch card, outside the Stem Player card (08c).
    const vocalsChip = screen.getByText("Vocals Stem");
    expect(vocalsChip.getAttribute("class") ?? "").toContain("bg-primary/10");
    expect(vocalsChip.getAttribute("class") ?? "").toContain(
      "border-primary/20"
    );
  });

  it("detects a saved session on startup and presents the recovery banner", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    const sessionStore = await import("../lib/sessionStore");
    await sessionStore.saveActiveSession({
      metadata: {
        id: "saved-session-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: "Stone",
        filename: "stone.mp3",
        duration: 284,
        sampleRate: 44100,
      },
      sourceMix: {
        channels: [new Float32Array(500), new Float32Array(500)],
      },
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      mixer: {
        stems: {
          vocals: { volume: 0.6, muted: false, solo: false },
          drums: { volume: 0.8, muted: true, solo: false },
          bass: { volume: 1.0, muted: false, solo: true },
          other: { volume: 0.5, muted: false, solo: false },
        },
        masterVolume: 0.9,
        currentTime: 42,
        pitchSemitones: 0,
        tempoRatio: 1.0,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /previous session recovery/i })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("heading", { name: /previous session found.*Stone/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resume session/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /discard/i })
    ).toBeInTheDocument();

    await sessionStore.clearActiveSession();
  });

  it("hydrates audio buffers and mixer states into Stem Player when resuming session", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    const sessionStore = await import("../lib/sessionStore");
    await sessionStore.saveActiveSession({
      metadata: {
        id: "hydrate-session-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: "Stone",
        filename: "stone.mp3",
        duration: 284,
        sampleRate: 44100,
      },
      sourceMix: {
        channels: [new Float32Array(500), new Float32Array(500)],
      },
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      mixer: {
        stems: {
          vocals: { volume: 0.6, muted: false, solo: false },
          drums: { volume: 0.8, muted: true, solo: false },
          bass: { volume: 1.0, muted: false, solo: true },
          other: { volume: 0.5, muted: false, solo: false },
        },
        masterVolume: 0.9,
        currentTime: 42,
        pitchSemitones: 0,
        tempoRatio: 1.0,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /resume session/i })
      ).toBeInTheDocument();
    });

    const resumeBtn = screen.getByRole("button", { name: /resume session/i });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /stem player/i })
      ).toBeInTheDocument();
    });

    // Recovery banner should disappear after resuming
    expect(
      screen.queryByRole("region", { name: /previous session recovery/i })
    ).not.toBeInTheDocument();

    // Resuming lands the shell on the Mix Tab, where the Stem Player lives
    const rail = screen.getByRole("navigation", { name: /tab band/i });
    expect(
      within(rail).getByRole("button", { name: /^Mix$/i })
    ).toHaveAttribute("aria-current", "true");

    // Verify Stem Player has the restored state (e.g. Drums muted, Bass solo)
    const stemPlayerRegion = screen.getByRole("region", {
      name: /stem player/i,
    });
    const drumsMuteBtn = within(stemPlayerRegion).getByRole("button", {
      name: /mute drums/i,
    });
    expect(drumsMuteBtn).toHaveAttribute("aria-pressed", "true");

    const bassSoloBtn = within(stemPlayerRegion).getByRole("button", {
      name: /solo bass/i,
    });
    expect(bassSoloBtn).toHaveAttribute("aria-pressed", "true");

    await sessionStore.clearActiveSession();
  });

  it("resumes a recovered Session with an identical Separate-tab Tempo Detector readout", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    const sessionStore = await import("../lib/sessionStore");
    await sessionStore.saveActiveSession({
      metadata: {
        id: "tempo-resume-session-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: "Stone",
        filename: "stone.mp3",
        duration: 284,
        sampleRate: 44100,
      },
      sourceMix: {
        channels: [new Float32Array(500), new Float32Array(500)],
      },
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      mixer: {
        stems: {
          vocals: { volume: 0.6, muted: false, solo: false },
          drums: { volume: 0.8, muted: true, solo: false },
          bass: { volume: 1.0, muted: false, solo: true },
          other: { volume: 0.5, muted: false, solo: false },
        },
        masterVolume: 0.9,
        currentTime: 42,
        pitchSemitones: 0,
        tempoRatio: 1.0,
      },
      // Tempo Detector state survives the store round-trip (ticket 03); the
      // recovered Session must show the exact same Separate-tab readout.
      tempo: {
        candidates: [
          { bpm: 107.7, confidence: 0.93 },
          { bpm: 215.4, confidence: 0.61 },
        ],
        chosenTempoBpm: 107.7,
        beatGrid: new Float64Array([0.557, 1.114, 1.671]),
        analyzedBpm: 107.7,
        duration: 284,
      },
      // Ticket 05: the Click Track lane settings persist with the Session too,
      // parallel to the Stem mixer contract — the rail must resume switched ON.
      clickTrack: {
        enabled: true,
        volume: 0.6,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /resume session/i })
      ).toBeInTheDocument();
    });

    const resumeBtn = screen.getByRole("button", { name: /resume session/i });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /stem player/i })
      ).toBeInTheDocument();
    });

    // Ticket 03: the recovered Session carries its Tempo Detector result, so
    // the readout resumes identical (ranked candidates survive the store
    // round-trip). The readout lives on the (inactive) Separate panel, which
    // stays in the DOM per the Tab Shell invariant (ADR-0008).
    expect(
      screen.getByText(
        /^Tempo Detector: 107\.7 BPM \| alternatives 215\.4 BPM$/
      )
    ).toBeInTheDocument();

    // Ticket 04: the recovered Beat Grid feeds the Mix tab's Click Track card,
    // so the card resumes at the same locked tempo — the locked candidate chip
    // names it (Stitch skin 08a erased the separate BPM line).
    expect(
      screen.getByRole("button", {
        name: /^beat grid locked to 107\.7 bpm$/i,
      })
    ).toBeInTheDocument();
    // Ticket 05: the rail resumes exactly as the saved Session left it — ON.
    const resumedRailSwitch = screen.getByRole("switch", {
      name: /^click track$/i,
    });
    expect(resumedRailSwitch).toHaveAttribute("aria-checked", "true");
    // No Meter control and no −/+ phase pair anymore (ADR-0011 Amendment).
    expect(screen.queryByTestId("click-track-meter-label")).toBeNull();
    expect(screen.queryByTestId("click-track-phase-control")).toBeNull();

    await sessionStore.clearActiveSession();
  });

  it("discards saved session and returns to clean dropzone when Discard is clicked", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    const sessionStore = await import("../lib/sessionStore");
    await sessionStore.saveActiveSession({
      metadata: {
        id: "discard-session-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: "Stone",
        filename: "stone.mp3",
        duration: 120,
        sampleRate: 44100,
      },
      sourceMix: {
        channels: [new Float32Array(500), new Float32Array(500)],
      },
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      mixer: {
        stems: {
          vocals: { volume: 1, muted: false, solo: false },
          drums: { volume: 1, muted: false, solo: false },
          bass: { volume: 1, muted: false, solo: false },
          other: { volume: 1, muted: false, solo: false },
        },
        masterVolume: 1,
        currentTime: 0,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /discard/i })
      ).toBeInTheDocument();
    });

    const discardBtn = screen.getByRole("button", { name: /discard/i });
    fireEvent.click(discardBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /previous session recovery/i })
      ).not.toBeInTheDocument();
    });

    // Discard is now a full purge: the saved Session is gone from storage...
    expect(await sessionStore.hasActiveSession()).toBe(false);
    // ...and the in-memory app state is cleared too — no lingering Stems or
    // mixer anywhere
    expect(screen.queryByRole("region", { name: /stem player/i })).toBeNull();
    // A subsequent render shows the clean Separate Tab: dropzone restored and
    // the Mix and Export rail chips gated (grayscaled) with the reason line
    expect(
      screen.getByText(/drag and drop your source mix/i)
    ).toBeInTheDocument();
    const rail = screen.getByRole("navigation", { name: /tab band/i });
    for (const gatedName of ["Mix", "Export"]) {
      const chip = within(rail).getByRole("button", { name: gatedName });
      expect(chip.getAttribute("class") ?? "").toContain("opacity-50");
      expect(within(chip).getByText(/no Stems yet/i)).toBeInTheDocument();
    }
  });

  it("keeps the Mix Tab free of destructive controls — no Purge/Reset Session trash button", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
      backend: "webgpu",
    });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /stem player/i })
      ).toBeInTheDocument();
    });

    // The Mix Tab's playback surface carries NO trash / Purge / Reset Session
    // affordance (ADR-0008 ticket 04: the Mix purge died)...
    const mixTab = screen.getByRole("region", { name: /^Mix Tab$/ });
    expect(
      within(mixTab).queryByRole("button", {
        name: /purge session|reset session/i,
      })
    ).toBeNull();
    // ...and nowhere else while Stems exist: the only confirmed wipe is
    // Discard on the Separate Tab's Session Recovery panel, which needs a
    // detected Session to appear at all
    expect(
      screen.queryByRole("button", { name: /purge session|reset session/i })
    ).toBeNull();

    // Stitch skin 07j goes further: there is no live transport row at all
    // on the hosted Mix Tab — no toggle to anchor, only absence to assert.
    expect(
      within(mixTab).queryByRole("button", { name: /^play\/pause$/i })
    ).toBeNull();

    // Isolation: the auto-saver may have persisted a Session during
    // separation — clear it so later renders don't see recovery prompts
    const sessionStore = await import("../lib/sessionStore");
    await sessionStore.clearActiveSession();
  });

  it("allows desktop users to select Balanced (HT-Demucs) model profile and initializes client with chosen profile", async () => {
    const initSpy = vi
      .spyOn(InferenceClient.prototype, "init")
      .mockResolvedValue({ backend: "wasm" });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    // Click Balanced / HT-Demucs radio button
    const balancedOption = screen.getByRole("radio", { name: /balanced/i });
    fireEvent.click(balancedOption);

    const file = new File(["audio"], "balanced_test.mp3", {
      type: "audio/mp3",
    });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /separate stems|start separation/i,
        })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          modelProfileId: "htdemucs-4stem",
          modelUrl: expect.stringContaining("htdemucs_4stem_mobile.onnx"),
        })
      );
    });
  });

  it("allows desktop users to select Ultra Fast (Open-Unmix) model profile and initializes client with chosen profile", async () => {
    const initSpy = vi
      .spyOn(InferenceClient.prototype, "init")
      .mockResolvedValue({ backend: "wasm" });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    // Click Ultra Fast / Open-Unmix radio button
    const ultraFastOption = screen.getByRole("radio", { name: /ultra fast/i });
    fireEvent.click(ultraFastOption);

    const file = new File(["audio"], "fast_test.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /separate stems|start separation/i,
        })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          modelProfileId: "open-unmix-4stem",
          modelUrl: expect.stringContaining("open_unmix_4stem_mobile.onnx"),
        })
      );
    });
  });

  it("opens in a Tab Shell with four pinned Tab rail entries in canonical order", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });

    const rail = screen.getByRole("navigation", { name: /tab band/i });
    const railEntries = within(rail).getAllByRole("button");
    expect(railEntries).toHaveLength(4);
    expect(
      railEntries.map((entry) => entry.getAttribute("aria-label"))
    ).toEqual(["Separate", "Mix", "Export", "System"]);

    // 44x44px minimum touch targets on every rail entry
    for (const entry of railEntries) {
      const classes = entry.getAttribute("class") ?? "";
      expect(classes).toContain("min-h-[44px]");
      expect(classes).toContain("min-w-[44px]");
    }

    // All four Tab panels stay pinned in the DOM even with no Source Mix
    const tabPanels = screen.getAllByRole("region", {
      name: /^(Separate|Mix|Export|System) Tab$/,
    });
    expect(tabPanels).toHaveLength(4);

    // Stitch chip language (06b): compact JetBrains-Mono chips with slightly
    // rounded corners and NO per-chip pill or border — the hairline frames the
    // bordered tab-band-chips container instead.
    for (const entry of railEntries) {
      const classes = entry.getAttribute("class") ?? "";
      expect(classes).toContain("rounded");
      expect(classes).not.toMatch(/(^|\s)rounded-full/);
      expect(classes).toContain("font-mono");
      expect(classes).toContain("text-[11px]");
      expect(classes).toContain("tracking-wide");
    }
    const chipsClasses =
      within(rail).getByTestId("tab-band-chips").getAttribute("class") ?? "";
    expect(chipsClasses).toContain("grid-cols-4");
    expect(chipsClasses).not.toMatch(/grid-cols-\[/);
    expect(chipsClasses).toContain("border-st-hairline");

    // The Listen surface is gone: no Listen button, region, or banner anywhere
    expect(screen.queryByRole("button", { name: /^listen$/i })).toBeNull();
    expect(screen.queryByRole("region", { name: /listen tab/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^listen$/i })).toBeNull();
  });

  it("greys out Mix and Export with a reason line until Separation is complete", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
      backend: "webgpu",
    });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    const rail = screen.getByRole("navigation", { name: /tab band/i });
    const gatedEntries = ["Mix", "Export"].map((name) =>
      within(rail).getByRole("button", { name })
    );
    for (const entry of gatedEntries) {
      expect(entry.getAttribute("class") ?? "").toContain("opacity-50");
      expect(within(entry).getByText(/no Stems yet/i)).toBeInTheDocument();
    }

    // Ticket 04: the Click Track rail lives inside the Mix player, so while the
    // Mix Tab is grayscaled there is no rail and nothing to click against —
    // and nothing where the retired −/+ rotation buttons used to live.
    expect(screen.queryByTestId("click-track-rail")).toBeNull();
    expect(screen.queryByTestId("click-track-phase-plus")).toBeNull();

    // Drive the state machine to completion
    const file = new File(["audio"], "song_master.mp3", {
      type: "audio/mp3",
    });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /separation complete/i })
      ).toBeInTheDocument();
    });

    // Gating mask lifts once separated Stems exist
    expect(screen.queryByText(/no Stems yet/i)).not.toBeInTheDocument();

    // Mix is live: the rail exists and reports its own state (ADR-0010 ticket
    // 04). Nothing here joins the Stem mixer contract.
    expect(screen.getByTestId("click-track-rail")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /^click track$/i })
    ).toHaveAttribute("aria-checked", "false");
  });

  it("keeps the shell chrome contract: clipped stage and four-up Tab Band cells", async () => {
    render(<App />);

    const rail = screen.getByRole("navigation", { name: /tab band/i });
    // Band composition (06b): flex column below md, brand+chips row at md+;
    // the four-up chip cells live in the bordered chips container.
    expect(rail.getAttribute("class") ?? "").toContain("md:flex-row");
    expect(rail.getAttribute("class") ?? "").not.toMatch(/grid-cols/);
    const bandChips = within(rail).getByTestId("tab-band-chips");
    expect(bandChips.getAttribute("class") ?? "").toContain("grid-cols-4");
    expect(bandChips.getAttribute("class") ?? "").not.toMatch(/grid-cols-\[/);
    expect(bandChips.getAttribute("class") ?? "").toContain("md:gap-2");

    const separatePanel = screen.getByRole("region", {
      name: /^Separate Tab$/,
    });
    const stage = separatePanel.parentElement;
    expect(stage?.getAttribute("class") ?? "").toContain("overflow-hidden");
  });

  it("moves active-Tab focus from Separate to Mix when Separation is complete", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
      backend: "webgpu",
    });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });

    render(<App />);

    const focusedWhileIdle = screen
      .getAllByRole("button")
      .filter((entry) => entry.getAttribute("aria-current") === "true");
    expect(focusedWhileIdle).toHaveLength(1);
    expect(focusedWhileIdle[0].getAttribute("aria-label")).toBe("Separate");

    const file = new File(["audio"], "song_master.mp3", {
      type: "audio/mp3",
    });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /separation complete/i })
      ).toBeInTheDocument();
    });

    const focusedOnComplete = screen
      .getAllByRole("button")
      .filter((entry) => entry.getAttribute("aria-current") === "true");
    expect(focusedOnComplete).toHaveLength(1);
    expect(focusedOnComplete[0].getAttribute("aria-label")).toBe("Mix");
  });

  const completeSeparationMocks = () => {
    vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
      backend: "webgpu",
    });
    vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
      stems: {
        vocals: [new Float32Array(500), new Float32Array(500)],
        drums: [new Float32Array(500), new Float32Array(500)],
        bass: [new Float32Array(500), new Float32Array(500)],
        other: [new Float32Array(500), new Float32Array(500)],
      },
      duration: 180,
    });
  };

  const clickTabButton = async (name: string) => {
    const rail = screen.getByRole("navigation", { name: /tab band/i });
    const button = within(rail).getByRole("button", {
      name: new RegExp(`^${name}$`, "i"),
    });
    fireEvent.click(button);
    await waitFor(() => {
      expect(
        within(screen.getByRole("navigation", { name: /tab band/i })).getByRole(
          "button",
          { name: new RegExp(`^${name}$`, "i") }
        )
      ).toHaveAttribute("aria-current", "true");
    });
  };

  const loadAndSeparate = async () => {
    const file = new File(["audio"], "song_master.mp3", { type: "audio/mp3" });
    const fileInput = screen.getByLabelText(/select source mix file/i, {
      selector: "input",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
    });

    const separateBtn = screen.getByRole("button", {
      name: /separate stems|start separation/i,
    });
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /stem player/i })
      ).toBeInTheDocument();
    });
  };

  // Tempo Detector (ticket 06): separation plus the queued decode-time BPM
  // pass delivered, so the live Mix Tab's rail shows its ranked readings.
  const separateAndDetectTempo = async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();
    tempoWorkerQueue = [];

    render(<App />);
    await loadAndSeparate();

    fireQueuedTempoCompletions();
    await waitFor(() => {
      expect(
        screen.getByTestId("click-track-candidate-picker")
      ).toBeInTheDocument();
    });
  };

  it("activates the Tab rail: clicking a rail Tab button moves the stage panel", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    // Separation completion auto-activates the Mix Tab
    const rail = screen.getByRole("navigation", { name: /tab band/i });
    const mixRailBtn = within(rail).getByRole("button", { name: /^Mix$/i });
    const exportRailBtn = within(rail).getByRole("button", {
      name: /^Export$/i,
    });
    expect(mixRailBtn.getAttribute("aria-current")).toBe("true");

    fireEvent.click(exportRailBtn);

    expect(exportRailBtn.getAttribute("aria-current")).toBe("true");
    expect(mixRailBtn.getAttribute("aria-current")).toBeNull();

    // Stage invariant: only the ACTIVE Tab panel paints; the rest are hidden
    const mixPanel = screen.getByRole("region", { name: /^Mix Tab$/ });
    const exportPanel = screen.getByRole("region", { name: /^Export Tab$/ });
    const mixClasses = (mixPanel.getAttribute("class") ?? "").split(" ");
    const exportClasses = (exportPanel.getAttribute("class") ?? "").split(" ");
    expect(mixClasses).toContain("hidden");
    expect(exportClasses).not.toContain("hidden");
    const panels = screen.getAllByRole("region", {
      name: /^(Separate|Mix|Export|System) Tab$/,
    });
    expect(
      panels.filter((p) => (p.getAttribute("class") ?? "").includes("absolute"))
    ).toHaveLength(1);
  });

  it("keeps gated Tabs locked: clicking the Mix rail Tab before separation is a silent no-op", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    const rail = screen.getByRole("navigation", { name: /tab band/i });
    const mixRailBtn = within(rail).getByRole("button", { name: /^Mix$/i });
    fireEvent.click(mixRailBtn);

    // Silent no-op (ADR-0009): the stage stays on Separate, the mix Tab never
    // reaches the stage, and the click emits no notice of any kind — the
    // chip's bare reason line is the whole refusal answer.
    const separateRailBtn = within(rail).getByRole("button", {
      name: /^Separate$/i,
    });
    expect(separateRailBtn.getAttribute("aria-current")).toBe("true");
    expect(mixRailBtn.getAttribute("aria-current")).toBeNull();
    expect(within(rail).queryAllByText(/blocked/i)).toHaveLength(0);
    expect(within(rail).getAllByText(/no Stems yet/i).length).toBeGreaterThan(
      0
    );
    expect(screen.queryByTestId(/^toast-/)).not.toBeInTheDocument();
  });

  it("places each tool in its Tab home once separation completes", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    // Mix Tab cohesion (ADR-0013, ticket 08): the rail-order chain below needs
    // the Tempo Detector's ranked readings, so this seam runs the full stage —
    // separation plus the queued decode-time BPM pass over the worker stub.
    vi.stubGlobal("Worker", StubTempoWorker);
    await separateAndDetectTempo();

    // Separate Tab keeps ingestion: the Source Mix dropzone lives there
    const separateTab = screen.getByRole("region", { name: /separate tab/i });
    expect(
      within(separateTab).getByRole("button", { name: /remove source mix/i })
    ).toBeInTheDocument();

    // Mix Tab hosts the shared Master Waveform spine and the Stem Player
    const mixTab = screen.getByRole("region", { name: /mix tab/i });
    const spine = within(mixTab).getByRole("slider", {
      name: /master waveform timeline/i,
    });
    expect(spine).toBeInTheDocument();
    expect(
      within(mixTab).getByRole("region", { name: /stem player/i })
    ).toBeInTheDocument();

    // Mix Tab cohesion (ADR-0013, ticket 08): one rail order at every
    // breakpoint — the stage reads in the order the work is done. The whole-app
    // seam walks the Mix stage top-down: Hand Calibration chrome (inline in the
    // spine's meta bar, Stitch skin 07y) → spine canvas → the Stem Strips →
    // Time-Stretch; the Click Track card with its ranked readings INSIDE it
    // (Stitch skins 08a/08b, ADR-0013 amendments) now lives in the DSP rack's
    // third slot, so it follows the Tempo card instead of preceding it; the
    // standalone readings rail and the master Transport row that used to close
    // the section foot are erased from the hosted stage (Stitch skins 07j/08a),
    // and the chain ends at the live click card.
    const tapStrip = within(mixTab).getByTestId("click-tap-calibration-strip");
    const firstStrip = within(mixTab).getAllByRole("group", {
      name: /stem$/i,
    })[0];
    const clickRail = within(mixTab).getByTestId("click-track-rail");
    const pickerRail = within(clickRail).getByTestId(
      "click-track-candidate-picker"
    );
    const timeStretchPanel = within(mixTab).getByRole("slider", {
      name: /playback tempo/i,
    });
    for (const [earlier, later] of [
      [tapStrip, spine],
      [tapStrip, pickerRail],
      [firstStrip, clickRail],
      [timeStretchPanel, pickerRail],
      [timeStretchPanel, clickRail],
    ]) {
      expect(earlier.compareDocumentPosition(later) & 4).not.toBe(0);
    }

    // Stitch skin 07j: the hosted Mix Tab renders no live Transport strip at
    // all — the user erased the timecode / Play-Pause / master-fader cluster
    // from the screen.
    expect(within(mixTab).queryByTestId("transport-row")).toBeNull();
    expect(within(mixTab).queryByTestId("stem-player-time")).toBeNull();

    // Hand Calibration collapse (ADR-0013, ticket 09) + Stitch skin 07y header-
    // row surgery: the card look and the stacked lane are both dead — the chrome
    // is an INLINE row the spine welds into its meta bar, asserted through the
    // component's own class tokens (the DOM seam cannot see media queries):
    // no card fill, no border rhythm, no outer padding, right-aligned inline
    // row, and the live strip's inline style is the phantom rail's thin height,
    // not the old tall card.
    const tapLane = within(mixTab).getByRole("region", {
      name: /beat grid tap calibration/i,
    });
    const laneClasses = tapLane.getAttribute("class") ?? "";
    expect(laneClasses).not.toMatch(/(^|\s)border/);
    expect(laneClasses).not.toContain("bg-card");
    expect(laneClasses).not.toMatch(/(^|\s)p[xxy]-[1-9]/);
    expect(laneClasses).toContain("justify-end");
    expect(tapStrip.getAttribute("style") ?? "").toContain("12px");

    // System Tab hosts the WebGPU status badge
    const systemTab = screen.getByRole("region", { name: /system tab/i });
    expect(within(systemTab).getByText(/webgpu active/i)).toBeInTheDocument();
  });

  it("keeps the Export panel inline in the Export Tab whenever Stems exist", async () => {
    // Ticket 03 inverts the click-to-open flow: there is no Export Stems
    // action on the Mix Tab anymore, and as soon as the Stems exist, the
    // Export panel is simply present inside the active-Tab stage in the
    // Export Tab, no click needed and nothing to dismiss.
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    // The action is gone from the Mix Tab and from the rest of the shell.
    expect(screen.queryByRole("button", { name: /export stems/i })).toBeNull();

    // The panel is present in the Export Tab without any action clicked.
    const exportTab = screen.getByRole("region", { name: /export tab/i });
    const exportPanel = await waitFor(() =>
      within(exportTab).getByRole("region", { name: /export audio stems/i })
    );
    expect(exportPanel).toBeInTheDocument();

    // Exactly one panel in the app: Stem Player's standalone fallback stays
    // out of the hosted form.
    expect(screen.getAllByText(/export audio stems/i)).toHaveLength(1);

    // Without modal state there is nothing to dismiss: no Close control.
    expect(
      within(exportPanel).queryByRole("button", { name: /close/i })
    ).toBeNull();
  });

  it("keeps the dead Grizzly header band absent everywhere, active System Tab included", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);

    // Stitch skin (ticket 05): the System-Tab Grizzly band is DEAD outright —
    // absence at every size and every Tab, even while the System Tab is the
    // active stage panel.
    expect(screen.queryByTestId("header-band")).toBeNull();

    await loadAndSeparate();

    expect(screen.queryByTestId("header-band")).toBeNull();

    await clickTabButton("mix");
    expect(screen.queryByTestId("header-band")).toBeNull();

    await clickTabButton("export");
    expect(screen.queryByTestId("header-band")).toBeNull();

    // System Tab active: no band, no named faces — chrome dies, the panel
    // survives on its title zone (title + caption) and the chips below.
    await clickTabButton("system");
    expect(screen.queryByTestId("header-band")).toBeNull();
    expect(screen.queryByTestId("header-band-face")).toBeNull();
    const systemPanel = screen.getByRole("region", { name: /^System Tab$/ });
    expect(within(systemPanel).getByText(/^System$/)).toBeInTheDocument();
    expect(
      within(systemPanel).getByText(/hardware acceleration/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();

    // Leaving the System Tab finds nothing.
    await clickTabButton("separate");
    expect(screen.queryByTestId("header-band")).toBeNull();
    expect(screen.queryByTestId("header-band-face")).toBeNull();
  });

  it("mirrors live Stem Player mixer state into the Export Tab panel", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });

    // Adjust Drums volume to 0.4 in the Mix Tab
    const drumsSlider = within(mixTab).getByRole("slider", {
      name: /drums volume/i,
    });
    fireEvent.change(drumsSlider, { target: { value: "0.4" } });

    // Mute Vocals
    fireEvent.click(
      within(mixTab).getByRole("button", {
        name: /mute vocals/i,
      })
    );

    // Ticket 03: the panel is already present in the Export Tab, no action
    // opens it; the live trigger is simply that it is on screen.
    const exportTab = screen.getByRole("region", { name: /export tab/i });
    const exportPanel = await waitFor(() =>
      within(exportTab).getByRole("region", { name: /export audio stems/i })
    );

    // Switch to Custom Mixdown and verify synchronized stem state
    fireEvent.click(
      within(exportPanel).getByRole("radio", {
        name: /custom mixdown/i,
      })
    );

    expect(
      within(exportPanel).getByRole("checkbox", { name: /vocals stem/i })
    ).not.toBeChecked();
    expect(
      within(exportPanel).getByRole("checkbox", { name: /drums stem/i })
    ).toBeChecked();
    expect(
      within(exportPanel).getByRole("slider", { name: /drums volume/i })
    ).toHaveValue("0.4");
    expect(
      within(exportPanel).getByRole("slider", {
        name: /master mixdown volume/i,
      })
    ).toHaveValue("1");

    // Live tweak while the panel is on screen: bumping Drums volume in the
    // Mix Tab to 0.7 mirrors into the panel right away.
    fireEvent.change(
      within(mixTab).getByRole("slider", { name: /drums volume/i }),
      { target: { value: "0.7" } }
    );
    expect(
      within(exportPanel).getByRole("slider", { name: /drums volume/i })
    ).toHaveValue("0.7");
  });

  it("reflects live Time-Stretch, Pitch-Shift and Formant Preservation tweaks in the inline panel", async () => {
    // Ticket 03: tweaks made while the panel is on screen appear in it —
    // the Apply active Pitch & Tempo adjustments row and its readout chip
    // follow the Transport bridge live.
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });
    const exportTab = screen.getByRole("region", { name: /export tab/i });
    const exportPanel = await waitFor(() =>
      within(exportTab).getByRole("region", { name: /export audio stems/i })
    );

    // Neutral session: no adjustments row to toggle.
    expect(
      within(exportPanel).queryByRole("checkbox", {
        name: /apply active pitch & tempo adjustments/i,
      })
    ).toBeNull();

    // Time-Stretch 1.00x -> 1.25x and Pitch-Shift +2 st in the Mix Tab.
    const tempoUp = within(mixTab).getByRole("button", {
      name: /increment tempo/i,
    });
    const pitchUp = within(mixTab).getByRole("button", {
      name: /increment pitch/i,
    });
    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(tempoUp);
    }
    fireEvent.click(pitchUp);
    fireEvent.click(pitchUp);

    // The panel re-emits the adjustments row live, checked by default, with
    // the readout chip mirroring both values.
    const applyCheckbox = await waitFor(() =>
      within(exportPanel).getByRole("checkbox", {
        name: /apply active pitch & tempo adjustments/i,
      })
    );
    expect(applyCheckbox).toBeChecked();
    expect(within(exportPanel).getAllByText(/\+2 st/).length).toBeGreaterThan(
      0
    );
    expect(within(exportPanel).getAllByText(/1\.25x/).length).toBeGreaterThan(
      0
    );

    // Toggling Formant Preservation alone never fabricates the row: with
    // tempo and pitch back to neutral it stays hidden.
    fireEvent.click(
      within(mixTab).getByRole("switch", {
        name: /vocal formant preservation/i,
      })
    );
    fireEvent.click(
      within(mixTab).getByRole("button", { name: /reset time-stretch/i })
    );
    await waitFor(() => {
      expect(
        within(exportPanel).queryByRole("checkbox", {
          name: /apply active pitch & tempo adjustments/i,
        })
      ).toBeNull();
    });
  });

  it("cancels an in-flight Export Bundle from inside the inline panel", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const exportTab = screen.getByRole("region", { name: /export tab/i });
    const exportPanel = await waitFor(() =>
      within(exportTab).getByRole("region", { name: /export audio stems/i })
    );

    // The Cancel control sits inside the panel and is inert until an export
    // is running.
    const cancelButton = within(exportPanel).getByRole("button", {
      name: /cancel encoding/i,
    });
    expect(cancelButton).toBeDisabled();

    // Start a Full Export Bundle.
    fireEvent.click(
      within(exportPanel).getByRole("radio", {
        name: /full export bundle/i,
      })
    );
    fireEvent.click(
      within(exportPanel).getByRole("button", { name: /export & download/i })
    );

    // Encoding in flight: Cancel is live, click aborts the bundle.
    await waitFor(() => {
      expect(cancelButton).not.toBeDisabled();
    });
    fireEvent.click(cancelButton);

    // Nothing was written: the success banner never appears and the panel
    // says the export was cancelled.
    await waitFor(() => {
      expect(
        within(exportPanel).getAllByText(/cancelled/i).length
      ).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/export complete/i)).toBeNull();
    expect(cancelButton).toBeDisabled();
  });

  it("keeps System Tab status and Diagnostics inline without any overlay", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
      adapterInfo: { vendor: "NVIDIA", device: "RTX 3080" },
    });

    render(<App />);

    const systemTab = screen.getByRole("region", { name: /system tab/i });
    expect(
      within(systemTab).getByText(/system diagnostics/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(systemTab).queryAllByText(/not cached/i).length
      ).toBeGreaterThan(0);
    });

    // No floating diagnostics pill and no modal overlay anywhere
    expect(screen.queryByRole("button", { name: /^diagnostics$/i })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    // Ticket 04 swept destructive buttons out of the Mix Tab, not the System
    // Tab: Clear Logs keeps its trash affordance and diagnostics stay clearable
    expect(
      within(systemTab).getByRole("button", { name: /clear logs/i })
    ).toBeInTheDocument();
  });

  it("carries no live transport strip on the hosted Mix Tab (Stitch skin 07j)", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });

    // The user erased the timecode / Play-Pause / master-fader cluster from
    // the screen (Stitch skin 07j): none of its chrome renders anywhere on
    // the hosted Mix Tab. The mockup's section foot is the DSP rack.
    expect(within(mixTab).queryByTestId("transport-row")).toBeNull();
    expect(within(mixTab).queryByTestId("stem-player-time")).toBeNull();
    expect(
      within(mixTab).queryByRole("button", { name: /^play\/pause$/i })
    ).toBeNull();
    expect(
      within(mixTab).queryByRole("button", { name: /^play$/i })
    ).toBeNull();
    expect(
      within(mixTab).queryByRole("button", { name: /^pause$/i })
    ).toBeNull();
    expect(
      within(mixTab).queryByRole("button", { name: /seek to start/i })
    ).toBeNull();
    expect(
      within(mixTab).queryByRole("slider", { name: /master volume/i })
    ).toBeNull();

    // The keyboard transport survives the erasure: Space still toggles the
    // shared engine through Stem Player's window keydown handler, and the
    // Master Waveform spine remains the scrub surface (pinned by the spine
    // seam below).
    fireEvent.keyDown(window, { code: "Space", key: " " });
    const mixSpine = within(mixTab).getByRole("slider", {
      name: /master waveform timeline/i,
    });
    await waitFor(async () => {
      expect(mixSpine).toBeInTheDocument();
    });
    // And no transport chrome re-mounts behind the keyboard toggle.
    expect(within(mixTab).queryByTestId("transport-row")).toBeNull();
  });

  it("paints the bundled Bold faces on banners, branding and time readouts", async () => {
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });

    // Display face: branding h1 (the rail Brand Unit) + Tab banners (the bundled
    // Archivo Black subset)
    const railNav = screen.getByRole("navigation", { name: /tab band/i });
    const brandUnit = within(railNav).getByTestId("brand-unit");
    const branding = within(brandUnit).getByRole("heading", { level: 1 });
    const mixBanner = within(mixTab).getByRole("heading", {
      level: 3,
      name: /multi-track stem player/i,
    });
    expect(window.getComputedStyle(branding).fontFamily).toMatch(/Inter/);
    expect(window.getComputedStyle(mixBanner).fontFamily).toMatch(/Inter/);
    expect(window.getComputedStyle(branding).fontFamily).toMatch(
      /sans-serif\s*$/
    );

    // Mono face: the masthead's solo/mute hint (JetBrains Mono subset) — the
    // transport readout this seam used to pin was erased from the hosted Mix
    // Tab (Stitch skin 07j), so the pin rides another always-rendered mono
    // face.
    const soloMuteHint = screen.getByTestId("stem-solo-mute-hint");
    expect(window.getComputedStyle(soloMuteHint).fontFamily).toMatch(
      /JetBrains Mono/
    );
    expect(window.getComputedStyle(soloMuteHint).fontFamily).toMatch(
      /monospace\s*$/
    );
  });

  it("hosts the Master Waveform spine on the Mix Tab and mirrors the shared playhead", async () => {
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });
    const mixSpine = within(mixTab).getByRole("slider", {
      name: /master waveform timeline/i,
    });

    // Keyboard scrub on the Mix spine walks the shared transport
    fireEvent.keyDown(mixSpine, { key: "ArrowRight" });
    await waitFor(() => {
      expect(mixSpine).toHaveAttribute("aria-valuenow", "5");
    });

    // Pointer scrub resumes at the identical spot on the shared engine
    vi.spyOn(mixSpine, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 84,
      right: 600,
      bottom: 84,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    fireEvent.pointerDown(mixSpine, { clientX: 300, pointerId: 1 });
    await waitFor(() => {
      expect(mixSpine).toHaveAttribute("aria-valuenow", "90");
    });

    // The spine is absent from Separate, Export, and System panels
    for (const panelName of [/separate tab/i, /export tab/i, /system tab/i]) {
      const panel = screen.getByRole("region", { name: panelName });
      expect(
        within(panel).queryByRole("slider", {
          name: /master waveform timeline/i,
        })
      ).toBeNull();
    }
  });

  it("mirrors the live Playhead to the spine: press play, no mixer event, the spine walks", async () => {
    completeSeparationMocks();

    // The engine's position loop needs two things jsdom lacks: a rAF pump and
    // a clock that moves. The pump advances the mock AudioContext by half a
    // second per frame, so six frames put the Playhead at 3 s — while no mixer
    // event ever fires, the spine's aria and the Transport both read it.
    const appCtx: { ctx: any } = { ctx: null };
    const OrigAudioContext = window.AudioContext;
    // A constructor function, not an arrow: the app builds the ctx with `new`.
    const LiveAudioContext = function (_options?: AudioContextOptions) {
      appCtx.ctx ??= new OrigAudioContext();
      return appCtx.ctx;
    };
    window.AudioContext = LiveAudioContext as any;

    const rafQueue: (() => void)[] = [];
    const OrigRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((callback: () => void) => {
      rafQueue.push(callback);
      return rafQueue.length;
    }) as any;

    try {
      render(<App />);
      await loadAndSeparate();

      const mixTab = screen.getByRole("region", { name: /mix tab/i });
      const spine = within(mixTab).getByRole("slider", {
        name: /master waveform timeline/i,
      });

      // Stitch skin 07j erased the transport row and 08d wired the footer
      // bar's coral disc as the live transport control: click it and the
      // engine starts (the Space keyboard channel Stem Player owns stays a
      // fallback, exercised by its own test).
      const footerDisc = screen.getByRole("button", {
        name: /^play\/pause$/i,
      });
      fireEvent.click(footerDisc);

      // Each tick re-schedules itself, so the queue keeps refilling while the
      // pump walks the mock clock forward half a second at a time.
      const pump = (frames: number) => {
        for (let i = 0; i < frames; i++) {
          appCtx.ctx!.currentTime += 0.5;
          const next = rafQueue.shift();
          if (!next) return;
          next();
        }
      };
      pump(6);

      await waitFor(() => {
        expect(spine).toHaveAttribute("aria-valuenow", "3");
      });
      // The disc's pressed state follows the engine's play-state channel.
      expect(footerDisc).toHaveAttribute("aria-pressed", "true");
      // The spine's accessible text moves on the same channel — the face is
      // the spine's own m:ss face, one second wider than the Transport's mm:ss.
      expect(spine).toHaveAttribute("aria-valuetext", "0:03");

      // Press it again: pause is the same control, and the playhead freezes
      // (pumping the mock clock forward moves nothing).
      fireEvent.click(footerDisc);
      pump(4);
      expect(spine).toHaveAttribute("aria-valuenow", "3");
      expect(footerDisc).toHaveAttribute("aria-pressed", "false");

      // One Playhead: the hosted Mix Tab no longer carries a Transport
      // readout at all (Stitch skin 07j erased the strip); the spine's
      // accessible face is the only position readout.
      expect(within(mixTab).queryByTestId("stem-player-time")).toBeNull();

      // And the spine block itself carries no PLAYHEAD clock at the whole-app
      // seam: one Playhead keeps exactly one position readout (the Transport's
      // mm:ss pair). Stitch skin 07d ports the mockup's ruler: aria-hidden
      // single-value graduations of the axis, never a "current / total" face —
      // so the pin targets the dead clock shape, not any digit.
      const spineBlock = spine.parentNode as HTMLElement;
      expect(spineBlock.textContent).not.toMatch(
        /\d{1,2}:\d{2}\s*\/\s*\d{1,2}:\d{2}/
      );
    } finally {
      // Hand the globals back so the rest of the suite keeps jsdom's shape.
      window.AudioContext = OrigAudioContext as any;
      window.requestAnimationFrame = OrigRaf as any;
    }
  });

  it("keeps the toast DOM surface dead: no notice container anywhere, notices only in the manager", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    toastModule.toast.success("source mix queued · demo notice");

    render(<App />);

    // A live manager emission must reach no DOM surface at all: the toast
    // container is dead at every breakpoint and every rail placement.
    const railNav = screen.getByRole("navigation", { name: /tab band/i });
    expect(
      within(railNav).queryByTestId("toast-stack")
    ).not.toBeInTheDocument();
    expect(within(railNav).queryAllByText(/source mix queued/i)).toHaveLength(
      0
    );
    expect(screen.queryByTestId("toast-stack")).not.toBeInTheDocument();
    expect(
      screen.queryByText("source mix queued · demo notice")
    ).not.toBeInTheDocument();

    toastModule.toastManager.clear();
  });

  it("opens the Separate Tab on its title zone and ends the page on a flat tan-hairline footer", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    // Hero-band death (ADR-0009): no coral strip and no state copy above the
    // Separate Tab title zone at any viewport (class token + copy check).
    const separateTab = screen.getByRole("region", { name: /separate tab/i });
    expect(separateTab.querySelectorAll(".grizzly-hero-strip")).toHaveLength(0);
    expect(
      screen.queryByText(/in-browser · nothing uploaded/i)
    ).not.toBeInTheDocument();

    // Flat footer (ticket 05 + 06c mockup transport bar): one tan hairline cap;
    // 08d makes the bar LIVE chrome — its coral disc is the real Play/Pause
    // control — while the mockup phantom clusters inside keep their own marks,
    // still no copy lines under the hairline (100% absent).
    const footer = document.querySelectorAll("footer")[0];
    const footerClasses = (footer.getAttribute("class") ?? "").split(" ");
    expect(footerClasses).toContain("border-t");
    expect(footerClasses).toContain("border-st-hairline");
    expect(footerClasses.some((c) => c.startsWith("border-t-2"))).toBe(false);
    // 08e mobile restack rail: wraps for phones, one rail from sm up.
    expect(footerClasses).toContain("flex-wrap");
    expect(footerClasses).toContain("sm:flex-nowrap");
    expect(footerClasses.some((c) => c.includes("border-status-warn"))).toBe(
      false
    );
    expect(footer.getAttribute("style") ?? "").not.toContain("gradient");
    // 08d wiring contract: the bar itself is no longer marked dead; the coral
    // disc is a real accessible button, and the phantom clusters around it
    // carry their individual placeholder marks.
    expect(footer.getAttribute("data-mockup-placeholder")).toBeNull();
    expect(footer.getAttribute("aria-hidden")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^play\/pause$/i })
    ).toBeInTheDocument();
    expect(
      footer.querySelectorAll('[data-mockup-placeholder="true"]').length
    ).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText(/powered by/i)).toBeNull();
    expect(
      screen.queryByText(/client-side audio source separation/i)
    ).toBeNull();
  });

  it("re-locks the Beat Grid from the Mix-tab candidate picker: the user's pick of the metric doubling replaces the grid and the rail follows it", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      await separateAndDetectTempo();

      // The Beat Grid starts locked to the engine's top reading, and the card
      // says honestly that it ranked two readings (Stitch skin 08a: the locked
      // chip is the readout, the picker names the ranking).
      expect(
        screen.getByRole("button", {
          name: /^beat grid locked to 107\.7 bpm$/i,
        })
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByTestId("click-track-candidate-picker")
      ).toHaveAttribute(
        "aria-label",
        "2 readings ranked · pick the feel you hear"
      );

      // The card's picker asks for the metric doubling as a re-lock hint.
      fireEvent.click(
        screen.getByRole("button", {
          name: /^re-lock beat grid to 215\.4 bpm$/i,
        })
      );
      fireQueuedTempoCompletions();

      // The new Beat Grid replaces the old one: the card now marks the chosen
      // feel locked, and the Session keeps working off that same result.
      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: /^beat grid locked to 215\.4 bpm$/i,
          })
        ).toBeInTheDocument();
      });

      // The lock moved: the doubling is now informational and the pulse
      // became the actionable alternative.
      const chips = within(
        screen.getByTestId("click-track-candidate-picker")
      ).getAllByRole("button");
      expect(chips).toHaveLength(2);
      const locked = chips.filter(
        (chip) => chip.getAttribute("aria-pressed") === "true"
      );
      expect(locked).toHaveLength(1);
      expect(locked[0]).toHaveAttribute(
        "aria-label",
        "Beat Grid locked to 215.4 BPM"
      );
      // Candidate row density (stitch-skin-06, retargeted by 08b): one column
      // on mobile, two at sm — the island now lives inside the rack's third
      // card (~427 px inner) and a four-across row cannot fit there, so the
      // pair column is the density truth; md:grid-cols-4 is dead (class-token
      // truth, the DOM seam cannot evaluate media queries; grz-18 precedent).
      const pickerClasses =
        screen
          .getByTestId("click-track-candidate-picker")
          .getAttribute("class") ?? "";
      for (const token of ["grid-cols-1", "sm:grid-cols-2"]) {
        expect(pickerClasses).toContain(token);
      }
      expect(pickerClasses.includes("md:grid-cols-4")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the Mix Tab live while a re-lock pass is in flight: the old Beat Grid stays until the new one arrives, and re-picking mid-flight replaces the pass", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      await separateAndDetectTempo();

      fireEvent.click(
        screen.getByRole("button", {
          name: /^re-lock beat grid to 215\.4 bpm$/i,
        })
      );

      // Mid-pass: nothing half-applied. The locked chip still names the old
      // grid, the Tab Shell is intact, and the Transport still drives the
      // shared engine, so the heavy pass never blocks the Mix Tab.
      expect(
        screen.getByRole("button", {
          name: /^beat grid locked to 107\.7 bpm$/i,
        })
      ).toBeInTheDocument();
      expect(screen.getAllByRole("navigation")).toHaveLength(1);
      expect(
        screen
          .getAllByRole("button")
          .filter((entry) => entry.getAttribute("aria-current") === "true")
      ).toHaveLength(1);

      // Re-picking while the pass is in flight abandons it and starts a fresh
      // one: one Tempo Detector pass at a time.
      fireEvent.click(
        screen.getByRole("button", {
          name: /^re-lock beat grid to 215\.4 bpm$/i,
        })
      );

      // Delivering both queued replies leaves the rail on the last pick: the
      // abandoned pass is discarded, never resurrected as a stale grid.
      fireQueuedTempoCompletions();
      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: /^beat grid locked to 215\.4 bpm$/i,
          })
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId("click-track-candidate-picker")
      ).toHaveAttribute(
        "aria-label",
        "2 readings ranked · pick the feel you hear"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("switches the metric level repeatedly: every pick re-locks the Beat Grid and the rail's locked reading tracks the last choice", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      await separateAndDetectTempo();

      const lockedTo = (bpm: string) =>
        expect(
          screen.getByRole("button", {
            name: new RegExp(`^beat grid locked to ${bpm} bpm$`, "i"),
          })
        ).toBeInTheDocument();
      const actionable = (label: string) =>
        expect(
          screen.queryByRole("button", {
            name: new RegExp(`^re-lock beat grid to ${label}$`, "i"),
          })
        ).toBeInTheDocument();

      lockedTo("107.7");
      actionable("215.4 BPM");

      // Down the octave, back up, down again: each pick is a fresh pass and
      // the rail follows it.
      fireEvent.click(
        screen.getByRole("button", {
          name: /^re-lock beat grid to 215\.4 bpm$/i,
        })
      );
      fireQueuedTempoCompletions();
      await waitFor(() => lockedTo("215.4"));
      actionable("107.7 BPM");

      fireEvent.click(
        screen.getByRole("button", {
          name: /^re-lock beat grid to 107\.7 bpm$/i,
        })
      );
      fireQueuedTempoCompletions();
      await waitFor(() => lockedTo("107.7"));
      actionable("215.4 BPM");

      fireEvent.click(
        screen.getByRole("button", {
          name: /^re-lock beat grid to 215\.4 bpm$/i,
        })
      );
      fireQueuedTempoCompletions();
      await waitFor(() => lockedTo("215.4"));
      actionable("107.7 BPM");

      // The exported file matches the chosen grid: with the Click Track
      // lane on, the Export Bundle handed to the bundler carries a Click
      // Track file cut on the last-locked Beat Grid. Finishing the ZIP and
      // triggering the download is pinned at the Export Dialog and bundle
      // seams; at the App seam, the contract is the bytes handed down.
      fireEvent.click(screen.getByRole("switch", { name: /^click track$/i }));
      await clickTabButton("Export");

      const bundleSpy = vi.spyOn(bundleZip, "createStemBundleZip");
      const exportPanel = await waitFor(() =>
        within(screen.getByRole("region", { name: /export tab/i })).getByRole(
          "region",
          { name: /export audio stems/i }
        )
      );
      fireEvent.click(
        within(exportPanel).getByRole("radio", {
          name: /full export bundle/i,
        })
      );
      fireEvent.click(
        within(exportPanel).getByRole("button", { name: /export & download/i })
      );
      // The bundler is reached exactly once, with the Click Track bytes
      // already encoded: those are the bytes its file would hold.
      await waitFor(() => {
        expect(bundleSpy).toHaveBeenCalledTimes(1);
      });

      expect(bundleSpy).toHaveBeenCalledTimes(1);
      const options = bundleSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(options.format).toBe("wav");
      expect(options.clickTrack).toBeInstanceOf(Uint8Array);

      const onsets = decodeWavOnsets(options.clickTrack as Uint8Array, 44100);
      // Every click sits on the 215.4 grid the rail was locked to (within
      // a couple of samples)...
      const chosenInterval = 60 / 215.4;
      const chosenBeats = Math.round(2 / chosenInterval);
      expect(onsets).toHaveLength(chosenBeats);
      for (let k = 0; k < chosenBeats; k++) {
        expect(Math.abs(onsets[k] - k * chosenInterval)).toBeLessThan(
          3 / 44100
        );
      }
      // ...and one lands where the top reading's grid was silent: 1.5 times
      // its interval is not one of its positions, so the file is not the
      // stale 107.7 clicks.
      expect(
        onsets.some((t) => Math.abs(t - 1.5 * (60 / 107.7)) < 3 / 44100)
      ).toBe(true);

      bundleSpy.mockRestore();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("hosts no Downbeat affordance anymore: no Meter selector, no −/+ pair, tempo-only readout", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      await separateAndDetectTempo();

      // The card is live (the helper lands on the Mix tab with a Beat Grid):
      // the locked candidate chip still names the locked tempo…
      expect(
        screen.getByRole("button", {
          name: /^beat grid locked to 107\.7 bpm$/i,
        })
      ).toBeInTheDocument();
      // …but nothing Downbeat-shaped survives anywhere on the rail (ADR-0011
      // Amendment): no Meter label, no Meter selector, no phase control, no
      // −/+ buttons, and no button phrased around a Downbeat.
      expect(screen.queryByTestId("click-track-meter-label")).toBeNull();
      expect(screen.queryByTestId("click-track-meter-selector")).toBeNull();
      expect(screen.queryByTestId("click-track-phase-control")).toBeNull();
      expect(screen.queryByTestId("click-track-phase-minus")).toBeNull();
      expect(screen.queryByTestId("click-track-phase-plus")).toBeNull();
      expect(
        screen.queryByRole("button", { name: /bring the downbeat/i })
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // Calibrate the Click (ticket 08): when the automatic readings are wrong,
  // the user taps four beats on the spine's timeline; confirm re-locks
  // through the same heavy-pass machinery with the derived BPM as hint, and
  // the picker says "calibrated by hand" — never an auto reading.
  it("anchors the Beat Grid by hand: four taps on the spine re-lock at the derived BPM and the picker says calibrated by hand", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      await separateAndDetectTempo();

      // Four taps half a second apart on the 180 s spine (600 px mock): the
      // strip maps client X to timeline seconds, rounded to ms.
      const strip = screen.getByTestId("click-tap-calibration-strip");
      vi.spyOn(strip, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 600,
        height: 64,
        right: 600,
        bottom: 64,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      fireEvent.pointerDown(strip, { clientX: 300.8333, pointerId: 1 });
      fireEvent.pointerDown(strip, { clientX: 302.5, pointerId: 2 });
      fireEvent.pointerDown(strip, { clientX: 304.1667, pointerId: 3 });
      fireEvent.pointerDown(strip, { clientX: 305.8333, pointerId: 4 });

      // The readout derives the pulse honestly from the taps themselves:
      // 90.25–91.75 s at 0.5 s apart is a 120 BPM pulse.
      await waitFor(() => {
        expect(
          screen.getByTestId("click-tap-calibration-readout")
        ).toHaveTextContent("pulse 500 ms");
      });

      const confirm = screen.getByTestId("click-tap-calibration-confirm");
      expect(confirm).not.toBeDisabled();

      const startsBefore = tempoWorkerStarts.length;
      fireEvent.click(confirm);

      // Mid-pass: nothing half-applied — the locked chip still names the old
      // grid and the picker claims no by-hand decision yet.
      expect(
        screen.getByRole("button", {
          name: /^beat grid locked to 107\.7 bpm$/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("click-track-candidate-picker")
      ).toHaveAttribute(
        "aria-label",
        "2 readings ranked · pick the feel you hear"
      );

      // The re-lock went through the same heavy-pass seam with the derived
      // BPM as its hint (ticket 06 machinery extended, not bypassed).
      expect(tempoWorkerStarts).toHaveLength(startsBefore + 1);
      expect(tempoWorkerStarts[startsBefore].hintBpm).toBe(120);

      fireQueuedTempoCompletions();
      await waitFor(() => {
        expect(
          screen.getByTestId("click-track-candidate-picker")
        ).toHaveAttribute(
          "aria-label",
          "calibrated by hand · your 4 taps anchor the grid"
        );
      });

      // The picker's accessible name carries the hand decision and its taps —
      // never a Detector claim while calibrated (Stitch skin 08a moved the
      // honest copy onto the picker group; the separate confidence line is
      // gone, and the visible text still says no solid reading).
      expect(screen.queryByText(/solid reading/)).toBeNull();

      // Reset clears the taps: the strip returns to its invitation.
      fireEvent.click(screen.getByTestId("click-tap-calibration-reset"));
      await waitFor(() => {
        expect(
          screen.getByTestId("click-tap-calibration-readout")
        ).toHaveTextContent("Tap 4 beats on the groove");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses ragged taps honestly: a double tap never becomes a half-calibration, confirm stays disabled and no pass starts", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      await separateAndDetectTempo();

      const strip = screen.getByTestId("click-tap-calibration-strip");
      vi.spyOn(strip, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 600,
        height: 64,
        right: 600,
        bottom: 64,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      fireEvent.pointerDown(strip, { clientX: 300, pointerId: 1 });
      fireEvent.pointerDown(strip, { clientX: 301, pointerId: 2 });

      await waitFor(() => {
        expect(
          screen.getByTestId("click-tap-calibration-readout")
        ).toHaveTextContent("2 of 4 taps");
      });

      const confirm = screen.getByTestId("click-tap-calibration-confirm");
      expect(confirm).toBeDisabled();
      const startsBefore = tempoWorkerStarts.length;
      fireEvent.click(confirm);

      // Honest refusal: no Tempo Detector pass was started, and the card
      // keeps its automatic reading with no by-hand claim.
      expect(tempoWorkerStarts).toHaveLength(startsBefore);
      expect(
        screen.getByRole("button", {
          name: /^beat grid locked to 107\.7 bpm$/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("click-track-candidate-picker")
      ).toHaveAttribute(
        "aria-label",
        "2 readings ranked · pick the feel you hear"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // Ticket 07 (ADR-0010 Amendment — Drums Stem re-detection): once the Drums
  // Stem exists, the Tempo Detector re-reads the Beat Grid over that isolated
  // groove channel (measured Source Mix tail slips are detection-quality
  // defects, ADR-0011); the Source Mix reading stays the fallback.
  it("re-detects the Beat Grid on the Drums Stem channel once Separation completes", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      tempoWorkerStarts = [];
      vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
        supported: true,
        isFallback: false,
      });
      // A distinguishable Drums Stem: its channels carry 700 frames, while the
      // decode mock's Source Mix channel is 500 — a pass posted over the stem
      // is identifiable by the frame count it hands the worker.
      vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
        backend: "webgpu",
      });
      vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
        stems: {
          vocals: [new Float32Array(700), new Float32Array(700)],
          drums: [new Float32Array(700), new Float32Array(700)],
          bass: [new Float32Array(700), new Float32Array(700)],
          other: [new Float32Array(700), new Float32Array(700)],
        },
        duration: 180,
      });

      render(<App />);
      await loadAndSeparate();

      // Two passes posted: the decode-time Source Mix read and the groove-
      // channel re-detection Separation completion triggers, unhinted.
      expect(tempoWorkerStarts).toEqual([
        { sampleCount: 500, hintBpm: undefined },
        { sampleCount: 700, hintBpm: undefined },
      ]);

      // Delivering both replies leaves the card on the re-detection's grid —
      // its picker island live again — and the abandoned Source Mix read is
      // discarded, never resurrected.
      fireQueuedTempoCompletions();
      await waitFor(() => {
        expect(
          screen.getByTestId("click-track-candidate-picker")
        ).toBeInTheDocument();
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the Source Mix Beat Grid when the Drums Stem carries no samples (fallback)", async () => {
    vi.stubGlobal("Worker", StubTempoWorker);
    try {
      tempoWorkerStarts = [];
      vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
        supported: true,
        isFallback: false,
      });
      vi.spyOn(InferenceClient.prototype, "init").mockResolvedValue({
        backend: "webgpu",
      });
      vi.spyOn(InferenceClient.prototype, "separate").mockResolvedValue({
        stems: {
          vocals: [new Float32Array(700), new Float32Array(700)],
          // A Drums Stem with nothing to read: the groove channel cannot
          // feed the tracker, so the Source Mix reading is kept intact.
          drums: [],
          bass: [new Float32Array(700), new Float32Array(700)],
          other: [new Float32Array(700), new Float32Array(700)],
        },
        duration: 180,
      });

      render(<App />);
      await loadAndSeparate();

      // No stem pass is posted at all: the decode-time Source Mix read is the
      // only pass, and its completion keeps the grid — and the card's picker —
      // live.
      expect(tempoWorkerStarts).toEqual([
        { sampleCount: 500, hintBpm: undefined },
      ]);

      fireQueuedTempoCompletions();
      await waitFor(() => {
        expect(
          screen.getByTestId("click-track-candidate-picker")
        ).toBeInTheDocument();
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
