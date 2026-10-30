import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StemPlayer } from "../components/StemPlayer";
import { StemName } from "../lib/chunkOverlapAdd";

function createMockAudioContext() {
  let currentTime = 0;
  return {
    get currentTime() {
      return currentTime;
    },
    set currentTime(t: number) {
      currentTime = t;
    },
    state: "running" as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => ({
      gain: {
        value: 1.0,
        setValueAtTime: vi.fn(function (this: any, val: number) {
          this.value = val;
        }),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      playbackRate: {
        value: 1.0,
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
    createBuffer: vi.fn(
      (channels: number, length: number, sampleRate: number) => {
        const channelArrays = Array.from(
          { length: channels },
          () => new Float32Array(length)
        );
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: vi.fn((ch: number) => channelArrays[ch]),
        };
      }
    ),
  };
}

describe("StemPlayer Time-Stretch & Pitch Controls", () => {
  let mockCtx: any;
  const sampleRate = 44100;
  const sampleCount = 44100 * 5; // 5s

  const dummyStems: Record<StemName, Float32Array[]> = {
    vocals: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    drums: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    bass: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    other: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
  };

  const EXPECTED_TEMPO_PRESETS = [
    "0.50x",
    "0.75x",
    "1.00x",
    "1.25x",
    "1.50x",
    "1.75x",
    "2.00x",
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCtx = createMockAudioContext();
  });

  it("renders tempo slider with 0.25x steps, 7 discrete preset buttons, pitch slider with 1st step, stepper, and disabled reset button", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    // Tempo Section
    const tempoSlider = screen.getByRole("slider", { name: /playback tempo/i });
    expect(tempoSlider).toBeInTheDocument();
    expect(tempoSlider).toHaveAttribute("step", "0.25");
    expect(tempoSlider).toHaveAttribute("min", "0.5");
    expect(tempoSlider).toHaveAttribute("max", "2");
    expect(screen.getByTestId("current-tempo-label")).toHaveTextContent(
      "1.00x"
    );

    // All 7 discrete preset buttons exist
    EXPECTED_TEMPO_PRESETS.forEach((preset) => {
      const btn = screen.getByRole("button", {
        name: new RegExp(`tempo preset ${preset.replace(".", "\\.")}`, "i"),
      });
      expect(btn).toBeInTheDocument();
      if (preset === "1.00x") {
        expect(btn).toHaveAttribute("aria-pressed", "true");
      } else {
        expect(btn).toHaveAttribute("aria-pressed", "false");
      }
    });

    // Pitch Section
    const pitchSlider = screen.getByRole("slider", { name: /pitch shift/i });
    expect(pitchSlider).toBeInTheDocument();
    expect(pitchSlider).toHaveAttribute("step", "1");
    expect(pitchSlider).toHaveAttribute("min", "-12");
    expect(pitchSlider).toHaveAttribute("max", "12");
    expect(screen.getByTestId("current-pitch-label")).toHaveTextContent("0 st");
    expect(
      screen.getByRole("button", { name: /decrement pitch/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /increment pitch/i })
    ).toBeInTheDocument();

    // Reset button is disabled initially
    const resetBtn = screen.getByRole("button", {
      name: /reset time-stretch|reset pitch and tempo/i,
    });
    expect(resetBtn).toBeDisabled();
  });

  it("adjusts tempo via quantized slider and highlights active preset across all 7 intervals", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const tempoSlider = screen.getByRole("slider", { name: /playback tempo/i });
    const tempoLabel = screen.getByTestId("current-tempo-label");

    // Change slider to 1.75x
    fireEvent.change(tempoSlider, { target: { value: "1.75" } });
    expect(tempoLabel).toHaveTextContent("1.75x");
    const preset175 = screen.getByRole("button", {
      name: /tempo preset 1\.75x/i,
    });
    expect(preset175).toHaveAttribute("aria-pressed", "true");

    // Click 0.50x preset button
    const preset050 = screen.getByRole("button", {
      name: /tempo preset 0\.50x/i,
    });
    fireEvent.click(preset050);
    expect(tempoLabel).toHaveTextContent("0.50x");
    expect(tempoSlider).toHaveValue("0.5");
    expect(preset050).toHaveAttribute("aria-pressed", "true");

    // Click 2.00x preset button
    const preset200 = screen.getByRole("button", {
      name: /tempo preset 2\.00x/i,
    });
    fireEvent.click(preset200);
    expect(tempoLabel).toHaveTextContent("2.00x");
    expect(tempoSlider).toHaveValue("2");
    expect(preset200).toHaveAttribute("aria-pressed", "true");
  });

  it("adjusts pitch exclusively in whole integer semitones and clamps at [-12, +12]", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const pitchSlider = screen.getByRole("slider", { name: /pitch shift/i });
    const incBtn = screen.getByRole("button", { name: /increment pitch/i });
    const decBtn = screen.getByRole("button", { name: /decrement pitch/i });
    const pitchLabel = screen.getByTestId("current-pitch-label");

    expect(pitchLabel).toHaveTextContent("0 st");

    // Increment pitch by 1 semitone
    fireEvent.click(incBtn);
    expect(pitchLabel).toHaveTextContent("+1 st");
    expect(pitchSlider).toHaveValue("1");

    // Increment again
    fireEvent.click(incBtn);
    expect(pitchLabel).toHaveTextContent("+2 st");
    expect(pitchSlider).toHaveValue("2");

    // Decrement pitch 3 times -> -1 st
    fireEvent.click(decBtn);
    fireEvent.click(decBtn);
    fireEvent.click(decBtn);
    expect(pitchLabel).toHaveTextContent("-1 st");
    expect(pitchSlider).toHaveValue("-1");

    // Direct slider change to +12 st
    fireEvent.change(pitchSlider, { target: { value: "12" } });
    expect(pitchLabel).toHaveTextContent("+12 st");
    expect(incBtn).toBeDisabled();

    // Direct slider change to -12 st
    fireEvent.change(pitchSlider, { target: { value: "-12" } });
    expect(pitchLabel).toHaveTextContent("-12 st");
    expect(decBtn).toBeDisabled();
  });

  it("enables reset button on any adjustment and restores both controls to neutral default", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const tempoSlider = screen.getByRole("slider", { name: /playback tempo/i });
    const pitchSlider = screen.getByRole("slider", { name: /pitch shift/i });
    const resetBtn = screen.getByRole("button", {
      name: /reset time-stretch|reset pitch and tempo/i,
    });
    const tempoLabel = screen.getByTestId("current-tempo-label");
    const pitchLabel = screen.getByTestId("current-pitch-label");

    expect(resetBtn).toBeDisabled();

    // Alter tempo only
    fireEvent.change(tempoSlider, { target: { value: "1.25" } });
    expect(resetBtn).not.toBeDisabled();
    expect(tempoLabel).toHaveTextContent("1.25x");

    // Reset
    fireEvent.click(resetBtn);
    expect(tempoLabel).toHaveTextContent("1.00x");
    expect(resetBtn).toBeDisabled();

    // Alter pitch only
    fireEvent.change(pitchSlider, { target: { value: "3" } });
    expect(resetBtn).not.toBeDisabled();
    expect(pitchLabel).toHaveTextContent("+3 st");

    // Reset
    fireEvent.click(resetBtn);
    expect(pitchLabel).toHaveTextContent("0 st");
    expect(tempoLabel).toHaveTextContent("1.00x");
    expect(tempoSlider).toHaveValue("1");
    expect(pitchSlider).toHaveValue("0");
    expect(resetBtn).toBeDisabled();
  });

  it("renders Vocal Formant Preservation toggle switch enabled by default and responds to user toggle", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const formantToggle = screen.getByRole("switch", {
      name: /vocal formant preservation/i,
    });
    expect(formantToggle).toBeInTheDocument();
    expect(formantToggle).toHaveAttribute("aria-checked", "true");

    // Click to toggle off
    fireEvent.click(formantToggle);
    expect(formantToggle).toHaveAttribute("aria-checked", "false");

    // Click to toggle back on
    fireEvent.click(formantToggle);
    expect(formantToggle).toHaveAttribute("aria-checked", "true");
  });

  it("anchors Master Waveform duration display to canonical duration during time-stretch playback", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    // Initial canonical duration (5s -> 00:05)
    expect(screen.getByText("00:05")).toBeInTheDocument();

    // Alter tempo to 2.00x
    const tempoSlider = screen.getByRole("slider", { name: /playback tempo/i });
    fireEvent.change(tempoSlider, { target: { value: "2.00" } });

    // Duration display must remain anchored to 00:05 (never shortened to 00:02)
    expect(screen.getByText("00:05")).toBeInTheDocument();
  });
});
