import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StemPlayer } from "../components/StemPlayer";
import { StemName } from "../lib/chunkOverlapAdd";
import { createMockAudioContext } from "./audioContextMockFactory";

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

  it("renders tempo slider with 0.05x steps, 7 discrete preset buttons, pitch slider with 1st step, steppers, and disabled reset button", () => {
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
    expect(tempoSlider).toHaveAttribute("step", "0.05");
    expect(tempoSlider).toHaveAttribute("min", "0.5");
    expect(tempoSlider).toHaveAttribute("max", "2");
    expect(screen.getByTestId("current-tempo-label")).toHaveTextContent(
      "1.00x"
    );
    expect(
      screen.getByRole("button", { name: /decrement tempo/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /increment tempo/i })
    ).toBeInTheDocument();

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

  it("steps tempo in 0.05x increments via +/- buttons and clamps at [0.50, 2.00]", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const tempoSlider = screen.getByRole("slider", { name: /playback tempo/i });
    const tempoLabel = screen.getByTestId("current-tempo-label");
    const incBtn = screen.getByRole("button", { name: /increment tempo/i });
    const decBtn = screen.getByRole("button", { name: /decrement tempo/i });

    // One step up: 1.00x -> 1.05x (exact, no float drift in the label)
    fireEvent.click(incBtn);
    expect(tempoLabel).toHaveTextContent("1.05x");
    expect(tempoSlider).toHaveValue("1.05");

    // Six steps up: 1.05x -> 1.35x (sums of 0.05 must stay on the grid)
    for (let i = 0; i < 6; i++) fireEvent.click(incBtn);
    expect(tempoLabel).toHaveTextContent("1.35x");

    // Step back down to 1.30x
    fireEvent.click(decBtn);
    expect(tempoLabel).toHaveTextContent("1.30x");

    // Clamp at the top: 26 increments land on 2.00x and disable the button
    for (let i = 0; i < 26; i++) fireEvent.click(incBtn);
    expect(tempoLabel).toHaveTextContent("2.00x");
    expect(incBtn).toBeDisabled();

    // Clamp at the bottom: 30 decrements land on 0.50x and disable the button
    for (let i = 0; i < 30; i++) fireEvent.click(decBtn);
    expect(tempoLabel).toHaveTextContent("0.50x");
    expect(decBtn).toBeDisabled();
  });

  it("quantizes off-grid slider values down to the 0.05x grid", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const tempoSlider = screen.getByRole("slider", { name: /playback tempo/i });
    const tempoLabel = screen.getByTestId("current-tempo-label");

    fireEvent.change(tempoSlider, { target: { value: "1.37" } });
    expect(tempoLabel).toHaveTextContent("1.35x");

    fireEvent.change(tempoSlider, { target: { value: "1.38" } });
    expect(tempoLabel).toHaveTextContent("1.40x");

    fireEvent.change(tempoSlider, { target: { value: "0.3" } });
    expect(tempoLabel).toHaveTextContent("0.50x");

    fireEvent.change(tempoSlider, { target: { value: "2.4" } });
    expect(tempoLabel).toHaveTextContent("2.00x");
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
    // Re-homed (Mix Rail Tidy-Up ticket 02): OFF wears the rail-button
    // family's unpressed chip treatment, not a shadcn pill track.
    const offClasses = formantToggle.getAttribute("class") ?? "";
    expect(offClasses).toContain("border-border/70");
    expect(offClasses).toContain("bg-secondary/60");

    // Click to toggle back on
    fireEvent.click(formantToggle);
    expect(formantToggle).toHaveAttribute("aria-checked", "true");

    // Mix Rail Tidy-Up (ticket 02): the control is a member of the existing
    // square rail-button family (the ♪/M/S chips' pressed token pair), so
    // nothing of it can overhang the panel border at any viewport.
    const onClasses = formantToggle.getAttribute("class") ?? "";
    for (const token of [
      "h-8",
      "w-8",
      "rounded-none",
      "border",
      "flex items-center justify-center",
      "transition-all",
    ]) {
      expect(onClasses).toContain(token);
    }
    expect(onClasses).toContain("border-primary/70");
    expect(onClasses).toContain("bg-primary");
    expect(onClasses).toContain("text-primary-foreground");
    expect(onClasses).toContain("shadow-xs");

    // The pill-slider markup died outright: no track span, no translating
    // knob span, no white knob ring — and the button carries exactly one
    // lucide glyph (the Mic the Vocals Stem Strip also uses).
    expect(onClasses).not.toMatch(/translate-x|ring-0|cursor-pointer/);
    expect(formantToggle.querySelectorAll("span")).toHaveLength(0);
    expect(formantToggle.querySelectorAll("svg")).toHaveLength(1);
  });

  it("anchors Transport duration display to canonical duration during time-stretch playback", () => {
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

  it("renders the Click Track rail in the Mix player: off by default, tempo-only readout, one volume fader and no rate control of its own", () => {
    const beatGrid = Float64Array.from([
      0.5, 1.0572789, 1.6145578, 2.1718367, 2.7291156,
    ]);

    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        beatGrid={beatGrid}
        clickTrackBpm={107.7}
      />
    );

    expect(screen.getByTestId("click-track-rail")).toBeInTheDocument();

    // The rail is domain-separate: it is a lane of its own, never one of the
    // four Stems.
    const rail = screen.getByTestId("click-track-rail");
    expect(rail).toHaveAccessibleName("Click Track");
    expect(within(rail).queryAllByRole("group")).toHaveLength(0);
    expect(screen.getAllByRole("group", { name: /stem$/i })).toHaveLength(4);

    // Off by default: opening the Mix tab never drops a metronome over the Stems.
    const enableSwitch = screen.getByRole("switch", { name: /^click track$/i });
    expect(enableSwitch).toHaveAttribute("aria-checked", "false");

    // Beat Grid readout shows the tempo the grid was locked at, and nothing
    // else: the retired Meter/accent axis leaves no readout behind.
    expect(screen.getByTestId("click-track-bpm-label")).toHaveTextContent(
      "107.7 BPM"
    );
    expect(screen.queryByTestId("click-track-meter-label")).toBeNull();
    expect(screen.queryByTestId("click-track-meter-selector")).toBeNull();
    expect(
      screen.queryAllByRole("button", { name: /^meter [2346]\/[48]$/i })
    ).toHaveLength(0);
    expect(screen.queryByTestId("click-track-phase-control")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /bring the downbeat/i })
    ).toBeNull();

    // Switching the lane on.
    fireEvent.click(enableSwitch);
    expect(enableSwitch).toHaveAttribute("aria-checked", "true");

    // One and only one Click Track slider: the volume fader. The lane has no
    // rate control of its own — Time-Stretch owns the rate (ADR-0010 story 12).
    expect(
      screen.getAllByRole("slider", { name: /click track/i })
    ).toHaveLength(1);
    expect(
      screen.queryByRole("slider", { name: /click track.*(rate|speed|tempo)/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /click track.*(rate|speed|step)/i })
    ).toBeNull();
  });
});
