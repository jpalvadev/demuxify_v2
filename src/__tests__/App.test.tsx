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

  it("renders application branding and header", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
      adapterInfo: { vendor: "NVIDIA", device: "RTX 3080" },
    });

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /demuxify/i
    );
    expect(
      screen.getByText(/client-side stem separation/i)
    ).toBeInTheDocument();

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
      // Metadata in SourceMixCard and MasterWaveform
      expect(screen.getAllByText(/3:00/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/44\.1\s*kHz/i)).toBeInTheDocument();
      expect(screen.getByText(/Stereo/i)).toBeInTheDocument();
      // Primary button
      expect(
        screen.getByRole("button", { name: /separate stems|start separation/i })
      ).toBeInTheDocument();
      // No timeline surface yet: the Mix Tab owns the spine and stays gated
      expect(
        screen.queryByRole("slider", { name: /master waveform timeline/i })
      ).toBeNull();
      const rail = screen.getByRole("navigation", { name: /tab rail/i });
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
    expect(
      within(stemPlayerRegion).getByRole("button", { name: /play/i })
    ).toBeInTheDocument();
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
    const rail = screen.getByRole("navigation", { name: /tab rail/i });
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

    expect(await sessionStore.hasActiveSession()).toBe(false);
    expect(
      screen.getByText(/drag and drop your source mix/i)
    ).toBeInTheDocument();
  });

  it("allows purging the active session from Stem Player to return to clean state", async () => {
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

    const purgeBtn = screen.getByRole("button", {
      name: /purge session|reset session/i,
    });
    fireEvent.click(purgeBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /stem player/i })
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(/drag and drop your source mix/i)
    ).toBeInTheDocument();
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

    const rail = screen.getByRole("navigation", { name: /tab rail/i });
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

    // grz-18: rail chrome is grizzly — hairline border (grz-600/40) on every
    // chip, no rounded corner
    for (const entry of railEntries) {
      const classes = entry.getAttribute("class") ?? "";
      expect(classes).not.toMatch(/(^|\s)rounded(?!-none)/);
      expect(classes).toContain("border-grz-600/40");
    }

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

    const rail = screen.getByRole("navigation", { name: /tab rail/i });
    const gatedEntries = ["Mix", "Export"].map((name) =>
      within(rail).getByRole("button", { name })
    );
    for (const entry of gatedEntries) {
      expect(entry.getAttribute("class") ?? "").toContain("opacity-50");
      expect(within(entry).getByText(/no Stems yet/i)).toBeInTheDocument();
    }

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
  });

  it("keeps the shell chrome contract: clipped stage and fixed 112px rail cells", async () => {
    render(<App />);

    const rail = screen.getByRole("navigation", { name: /tab rail/i });
    // Four Tab cells, each a fixed 112px chip
    expect(rail.getAttribute("class") ?? "").toContain("grid-cols-4");
    expect(rail.getAttribute("class") ?? "").toContain(
      "grid-cols-[112px_112px_112px_112px]"
    );

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
    const rail = screen.getByRole("navigation", { name: /tab rail/i });
    const button = within(rail).getByRole("button", {
      name: new RegExp(`^${name}$`, "i"),
    });
    fireEvent.click(button);
    await waitFor(() => {
      expect(
        within(screen.getByRole("navigation", { name: /tab rail/i })).getByRole(
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

  it("activates the Tab rail: clicking a rail Tab button moves the stage panel", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    // Separation completion auto-activates the Mix Tab
    const rail = screen.getByRole("navigation", { name: /tab rail/i });
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

  it("keeps gated Tabs locked: clicking the Mix rail Tab before separation is blocked with a notice", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    const rail = screen.getByRole("navigation", { name: /tab rail/i });
    const mixRailBtn = within(rail).getByRole("button", { name: /^Mix$/i });
    fireEvent.click(mixRailBtn);

    // Blocked: the stage stays on Separate and a rail notice explains why
    const separateRailBtn = within(rail).getByRole("button", {
      name: /^Separate$/i,
    });
    expect(separateRailBtn.getAttribute("aria-current")).toBe("true");
    expect(mixRailBtn.getAttribute("aria-current")).toBeNull();
    expect(
      within(rail).getAllByText(/blocked.*no Stems yet/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("places each tool in its Tab home once separation completes", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    // Separate Tab keeps ingestion: the Source Mix dropzone lives there
    const separateTab = screen.getByRole("region", { name: /separate tab/i });
    expect(
      within(separateTab).getByRole("button", { name: /remove source mix/i })
    ).toBeInTheDocument();

    // Mix Tab hosts the shared Master Waveform spine and the Stem Player
    const mixTab = screen.getByRole("region", { name: /mix tab/i });
    expect(
      within(mixTab).getByRole("slider", {
        name: /master waveform timeline/i,
      })
    ).toBeInTheDocument();
    expect(
      within(mixTab).getByRole("region", { name: /stem player/i })
    ).toBeInTheDocument();

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

  it("runs the Grizzly header band only in the System Tab and keeps the other Tabs chrome-free", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);

    // Separation incomplete: the shell is parked on the Separate Tab, so the
    // band cannot run.
    expect(screen.queryByTestId("header-band")).toBeNull();

    await loadAndSeparate();

    // Separated but parked on the Separate Tab: still nowhere.
    expect(screen.queryByTestId("header-band")).toBeNull();

    await clickTabButton("mix");
    expect(screen.queryByTestId("header-band")).toBeNull();

    await clickTabButton("export");
    expect(screen.queryByTestId("header-band")).toBeNull();

    // Only the System Tab carries the band: a bordered chrome strip with the
    // Tab title and its two named faces — chrome, never a modal.
    await clickTabButton("system");
    const band = screen.getByTestId("header-band");
    expect(band).toHaveClass("border-grz-600/40");
    expect(within(band).getByText(/^System$/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    const faces = screen.getAllByTestId("header-band-face");
    expect(faces).toHaveLength(2);
    expect(faces[0]).toHaveAccessibleName(/grz-01/);
    expect(faces[1]).toHaveAccessibleName(/grz-02/);

    // Leaving the System Tab kills the band everywhere else.
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
  });

  it("renders a single Play/Pause toggle transport with mono readout on the Mix Tab", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });

    // One Transport toggle; no dedicated Play, Pause, or Seek-to-start buttons
    const mixToggleBtn = within(mixTab).getByRole("button", {
      name: /^play\/pause$/i,
    });
    expect(mixToggleBtn).toBeInTheDocument();
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
      within(mixTab).getAllByText(/\d{2}:\d{2}/).length
    ).toBeGreaterThanOrEqual(2);

    // Pressing the toggle drives the shared Stem Player engine
    expect(mixToggleBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mixToggleBtn);
    await waitFor(() => {
      expect(mixToggleBtn).toHaveAttribute("aria-pressed", "true");
    });

    // Pressing the same toggle again pauses
    fireEvent.click(mixToggleBtn);
    await waitFor(() => {
      expect(mixToggleBtn).toHaveAttribute("aria-pressed", "false");
    });

    // Space key toggles that same control
    fireEvent.keyDown(window, { code: "Space", key: " " });
    await waitFor(() => {
      expect(mixToggleBtn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("paints the bundled Bold faces on banners, branding and time readouts", async () => {
    completeSeparationMocks();

    render(<App />);
    await loadAndSeparate();

    const mixTab = screen.getByRole("region", { name: /mix tab/i });

    // Display face: branding h1 + Tab banners (the bundled Archivo Black subset)
    const branding = screen.getByRole("heading", { level: 1 });
    const mixBanner = within(mixTab).getByRole("heading", {
      level: 3,
      name: /multi-track stem player/i,
    });
    expect(window.getComputedStyle(branding).fontFamily).toMatch(
      /Archivo Black/
    );
    expect(window.getComputedStyle(mixBanner).fontFamily).toMatch(
      /Archivo Black/
    );
    expect(window.getComputedStyle(branding).fontFamily).toMatch(
      /sans-serif\s*$/
    );

    // Mono face: Stem Player time display (JetBrains Mono subset)
    const stemPlayerTime = screen.getByTestId("stem-player-time");
    expect(window.getComputedStyle(stemPlayerTime).fontFamily).toMatch(
      /JetBrains Mono/
    );
    expect(window.getComputedStyle(stemPlayerTime).fontFamily).toMatch(
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

  it("stacks toast notices at the rail bottom instead of floating over content", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    toastModule.toast.success("source mix queued · demo notice");

    render(<App />);

    const railNav = screen.getByRole("navigation", { name: /tab rail/i });
    const stack = within(railNav).getByTestId("toast-stack");
    expect(stack).toBeInTheDocument();
    expect(within(railNav).getByText(/source mix queued/)).toBeInTheDocument();

    // The stack is an in-flow notice area at the rail end, not a floating
    // bottom-right container
    expect(stack.className.includes("fixed")).toBe(false);

    toastModule.toastManager.clear();
  });
});
