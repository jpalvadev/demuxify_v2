import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MasterWaveform } from "../components/MasterWaveform";
import { WaveformPeaks } from "../lib/waveformPeaks";

describe("MasterWaveform", () => {
  const dummyPeaks: WaveformPeaks = {
    min: new Float32Array([-0.2, -0.5, -0.8, -0.3, -0.1]),
    max: new Float32Array([0.3, 0.6, 0.9, 0.4, 0.2]),
    length: 5,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders canvas element with the label and chip but no header clock", () => {
    render(
      <MasterWaveform
        peaks={dummyPeaks}
        duration={120} // 2 minutes
        currentTime={30} // 30 seconds
      />
    );

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuenow", "30");
    expect(slider).toHaveAttribute("aria-valuemax", "120");

    // Mix Tab cohesion (ADR-0013): the header's mm:ss / mm:ss position clock is
    // dead — the Transport owns the Mix Tab's only visible clock. The label and
    // the "Overview" chip survive. Stitch skin (07d) adds the mockup's ruler
    // graduations as aria-hidden axis labels, so the pin now targets the dead
    // clock shape (a "current / total" pair) rather than any bare mm:ss text.
    expect(screen.getByText("Master Waveform")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}:\d{2}\s*\/\s*\d{1,2}:\d{2}/)).toBeNull();
  });

  it("handles click to seek on timeline", () => {
    const onSeek = vi.fn();
    render(
      <MasterWaveform
        peaks={dummyPeaks}
        duration={100}
        currentTime={10}
        onSeek={onSeek}
      />
    );

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });

    // Mock getBoundingClientRect
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 100,
      right: 500,
      bottom: 150,
      x: 100,
      y: 50,
      toJSON: () => {},
    });

    // Click at clientX = 200 (which is (200 - 100) / 400 = 25% -> 25s)
    fireEvent.pointerDown(slider, { clientX: 200, pointerId: 1 });

    expect(onSeek).toHaveBeenCalledWith(25);
  });

  it("handles click-and-drag scrubbing to continuously seek position", () => {
    const onSeek = vi.fn();
    render(
      <MasterWaveform
        peaks={dummyPeaks}
        duration={100}
        currentTime={0}
        onSeek={onSeek}
      />
    );

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });

    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 100,
      right: 500,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Pointer down at 100px (20%) -> 20s
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(20);

    // Pointer move to 300px (60%) -> 60s
    fireEvent.pointerMove(slider, { clientX: 300, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(60);

    // Pointer up to finish scrubbing
    fireEvent.pointerUp(slider, { pointerId: 1 });

    // Further pointer moves should not seek after release
    fireEvent.pointerMove(slider, { clientX: 400, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledTimes(2);
  });

  it("supports keyboard navigation seeking (Arrow keys, Home, End)", () => {
    const onSeek = vi.fn();
    render(
      <MasterWaveform
        peaks={dummyPeaks}
        duration={100}
        currentTime={50}
        onSeek={onSeek}
      />
    );

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });

    // ArrowRight (+5s)
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenLastCalledWith(55);

    // ArrowLeft (-5s)
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onSeek).toHaveBeenLastCalledWith(45);

    // Home (0s)
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onSeek).toHaveBeenLastCalledWith(0);

    // End (100s)
    fireEvent.keyDown(slider, { key: "End" });
    expect(onSeek).toHaveBeenLastCalledWith(100);
  });

  it("supports Shift+Arrow keys for fine 1-second seeking", () => {
    const onSeek = vi.fn();
    render(
      <MasterWaveform
        peaks={dummyPeaks}
        duration={100}
        currentTime={50}
        onSeek={onSeek}
      />
    );

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });

    // Shift + ArrowRight (+1s)
    fireEvent.keyDown(slider, { key: "ArrowRight", shiftKey: true });
    expect(onSeek).toHaveBeenLastCalledWith(51);

    // Shift + ArrowLeft (-1s)
    fireEvent.keyDown(slider, { key: "ArrowLeft", shiftKey: true });
    expect(onSeek).toHaveBeenLastCalledWith(49);
  });

  it("does not seek when disabled is true", () => {
    const onSeek = vi.fn();
    render(
      <MasterWaveform
        peaks={dummyPeaks}
        duration={100}
        currentTime={50}
        disabled={true}
        onSeek={onSeek}
      />
    );

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });

    fireEvent.pointerDown(slider, { clientX: 200, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("automatically computes peaks from an AudioBuffer if peaks prop is omitted", () => {
    const channelData = new Float32Array([0.1, -0.2, 0.3, -0.4]);
    const mockAudioBuffer = {
      numberOfChannels: 1,
      length: 4,
      sampleRate: 44100,
      duration: 10,
      getChannelData: () => channelData,
    };

    render(
      <MasterWaveform
        audioBuffer={mockAudioBuffer as any}
        duration={10}
        currentTime={0}
      />
    );

    expect(
      screen.getByRole("slider", { name: /master waveform timeline/i })
    ).toBeInTheDocument();
  });
});
