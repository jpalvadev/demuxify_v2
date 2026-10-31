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

  it("decodes audio and displays SourceMixCard and MasterWaveform when a file is selected", async () => {
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
      // Master waveform
      expect(
        screen.getByRole("slider", { name: /master waveform timeline/i })
      ).toBeInTheDocument();
    });
  });

  it("allows interactive scrubbing on the Master Waveform to seek playback position", async () => {
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
        screen.getByRole("slider", { name: /master waveform timeline/i })
      ).toBeInTheDocument();
    });

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 100,
      right: 600,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Seek via arrow key (5 seconds)
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "5");

    // Seek via pointer at 50% (300px / 600px * 180s = 90s)
    fireEvent.pointerDown(slider, { clientX: 300, pointerId: 1 });
    expect(slider).toHaveAttribute("aria-valuenow", "90");
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

  it("toggles theme between dark and light", async () => {
    vi.spyOn(webgpuModule, "detectWebGPUCapability").mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });

    const themeToggle = screen.getByRole("button", { name: /toggle theme/i });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(themeToggle);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(themeToggle);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
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

  it("opens in a Tab Shell with five pinned Tab rail entries in canonical order", async () => {
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
    expect(railEntries).toHaveLength(5);
    expect(
      railEntries.map((entry) => entry.getAttribute("aria-label"))
    ).toEqual(["Separate", "Listen", "Mix", "Export", "System"]);

    // 44x44px minimum touch targets on every rail entry
    for (const entry of railEntries) {
      const classes = entry.getAttribute("class") ?? "";
      expect(classes).toContain("min-h-[44px]");
      expect(classes).toContain("min-w-[44px]");
    }

    // All five Tab panels stay pinned in the DOM even with no Source Mix
    const tabPanels = screen.getAllByRole("region", {
      name: /^(Separate|Listen|Mix|Export|System) Tab$/,
    });
    expect(tabPanels).toHaveLength(5);
  });

  it("greys out Listen, Mix, and Export with a reason line until Separation is complete", async () => {
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
    const gatedEntries = ["Listen", "Mix", "Export"].map((name) =>
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

  it("moves active-Tab focus from Separate to Listen when Separation is complete", async () => {
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
    expect(focusedOnComplete[0].getAttribute("aria-label")).toBe("Listen");
  });
});
