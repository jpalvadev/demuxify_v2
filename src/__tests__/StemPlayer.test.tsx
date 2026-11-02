import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StemPlayer } from "../components/StemPlayer";
import { StemName } from "../lib/chunkOverlapAdd";
import {
  StemPlayerEngine,
  ClickTrackMixerState,
} from "../lib/stemPlayerEngine";
import * as customMixdown from "../lib/customMixdown";
import { createMockAudioContext } from "./audioContextMockFactory";

describe("StemPlayer UI Component", () => {
  let mockCtx: any;
  const sampleRate = 44100;
  const sampleCount = 44100 * 10; // 10s

  const dummyStems: Record<StemName, Float32Array[]> = {
    vocals: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    drums: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    bass: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    other: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCtx = createMockAudioContext();
  });

  it("renders the Master Waveform, Transport bar, and all 4 Stem tracks", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    // Primary region
    expect(
      screen.getByRole("region", { name: /stem player/i })
    ).toBeInTheDocument();

    // Transport: one Play/Pause toggle, no dedicated Play/Pause/Seek buttons
    const toggleBtn = screen.getByRole("button", { name: /^play\/pause$/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: /^play$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^pause$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /seek to start/i })).toBeNull();
    // ADR-0008 (ticket 04): no trash / Purge / Reset Session button in the
    // action row — the interface has no onPurgeSession affordance at all, so
    // the player can never mount a destructive Session wipe
    expect(
      screen.queryByRole("button", { name: /purge session|reset session/i })
    ).toBeNull();
    expect(screen.getByText(/00:00/)).toBeInTheDocument();

    // 4 Stem tracks
    expect(screen.getByText("Vocals")).toBeInTheDocument();
    expect(screen.getByText("Drums")).toBeInTheDocument();
    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();

    // Master Waveform
    expect(
      screen.getByRole("slider", { name: /master waveform timeline/i })
    ).toBeInTheDocument();
  });

  it("toggles playback with the single Play/Pause toggle", async () => {
    const playSpy = vi.spyOn(StemPlayerEngine.prototype, "play");
    const pauseSpy = vi.spyOn(StemPlayerEngine.prototype, "pause");

    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /^play\/pause$/i });

    // Paused: icon promises play, assistive tech reports unpressed
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");

    // One press starts playback: engine gets play, button reports pressed
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    });
    expect(playSpy).toHaveBeenCalled();

    // Pressing the same button again stops playback: engine gets pause
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    });
    expect(pauseSpy).toHaveBeenCalled();
  });

  it("toggles playback using Spacebar hotkey listener", async () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /^play\/pause$/i });
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");

    // Press Spacebar: the same control starts playback
    fireEvent.keyDown(window, { code: "Space", key: " " });
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    });

    // Press Spacebar again: it stops playback
    fireEvent.keyDown(window, { code: "Space", key: " " });
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("adjusts stem volume using individual volume faders", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const vocalsSlider = screen.getByRole("slider", { name: /vocals volume/i });
    expect(vocalsSlider).toHaveValue("1");

    fireEvent.change(vocalsSlider, { target: { value: "0.6" } });
    expect(vocalsSlider).toHaveValue("0.6");
  });

  it("toggles Mute and Solo states on individual stem tracks", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const muteDrumsBtn = screen.getByRole("button", { name: /mute drums/i });
    const soloVocalsBtn = screen.getByRole("button", { name: /solo vocals/i });

    expect(muteDrumsBtn).toHaveAttribute("aria-pressed", "false");
    expect(soloVocalsBtn).toHaveAttribute("aria-pressed", "false");

    // Click Mute Drums
    fireEvent.click(muteDrumsBtn);
    expect(muteDrumsBtn).toHaveAttribute("aria-pressed", "true");

    // Click Solo Vocals
    fireEvent.click(soloVocalsBtn);
    expect(soloVocalsBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("allows seeking via Master Waveform timeline", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
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

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    // Seeking updates timeline position
    expect(screen.getByText(/00:05/)).toBeInTheDocument();
  });

  it("repositions the playhead with spine scrubbing instead of a Seek button", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    // The Seek-to-start button is gone from the Transport row
    expect(screen.queryByRole("button", { name: /seek to start/i })).toBeNull();

    const slider = screen.getByRole("slider", {
      name: /master waveform timeline/i,
    });

    // Scrub the spine forward to 5s
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(screen.getByText(/00:05/)).toBeInTheDocument();

    // Scrub the spine back to the start: one mechanism, no button
    fireEvent.keyDown(slider, { key: "Home" });
    expect(screen.getByText(/00:00/)).toBeInTheDocument();
  });

  it("adjusts master volume fader", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
      />
    );

    const masterSlider = screen.getByRole("slider", { name: /master volume/i });
    expect(masterSlider).toHaveValue("1");

    fireEvent.change(masterSlider, { target: { value: "0.45" } });
    expect(masterSlider).toHaveValue("0.45");
  });

  it("opens ExportDialog when Export Stems button is clicked", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    const exportBtn = screen.getByRole("button", { name: /export stems/i });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    expect(
      screen.getByRole("region", { name: /export audio stems/i })
    ).toBeInTheDocument();
  });

  it("synchronizes stem player mixer levels and master volume into Custom Mixdown export dialog", async () => {
    const user = userEvent.setup();
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    // 1. Adjust Master Volume to 0.75
    const masterSlider = screen.getByRole("slider", { name: /master volume/i });
    fireEvent.change(masterSlider, { target: { value: "0.75" } });

    // 2. Adjust Drums volume fader to 0.4
    const drumsSlider = screen.getByRole("slider", { name: /drums volume/i });
    fireEvent.change(drumsSlider, { target: { value: "0.4" } });

    // 3. Mute Vocals
    const vocalsMuteBtn = screen.getByRole("button", { name: /mute vocals/i });
    await user.click(vocalsMuteBtn);

    // 4. Open ExportDialog
    const exportBtn = screen.getByRole("button", { name: /export stems/i });
    await user.click(exportBtn);

    const panel = screen.getByRole("region", { name: /export audio stems/i });
    expect(panel).toBeInTheDocument();
    const dialogScope = within(panel);

    // 5. Switch to Custom Mixdown mode
    const mixdownRadio = dialogScope.getByRole("radio", {
      name: /custom mixdown/i,
    });
    await user.click(mixdownRadio);

    // 6. Verify synchronized mixer states in Custom Mixdown:
    // Vocals was muted -> unchecked, volume preserved at 1.0
    expect(
      dialogScope.getByRole("checkbox", { name: /vocals stem/i })
    ).not.toBeChecked();

    // Drums was set to 0.4 -> checked, volume 0.4
    expect(
      dialogScope.getByRole("checkbox", { name: /drums stem/i })
    ).toBeChecked();
    expect(
      dialogScope.getByRole("slider", { name: /drums volume/i })
    ).toHaveValue("0.4");

    // Bass and Other remained unmuted & 1.0 -> checked, volume 1.0
    expect(
      dialogScope.getByRole("checkbox", { name: /bass stem/i })
    ).toBeChecked();
    expect(
      dialogScope.getByRole("slider", { name: /bass volume/i })
    ).toHaveValue("1");

    expect(
      dialogScope.getByRole("checkbox", { name: /other stem/i })
    ).toBeChecked();
    expect(
      dialogScope.getByRole("slider", { name: /other volume/i })
    ).toHaveValue("1");

    // Master Mixdown Volume synchronized to 0.75
    expect(
      dialogScope.getByRole("slider", { name: /master mixdown volume/i })
    ).toHaveValue("0.75");
  });

  it("keeps the hosted form action-free while the bridge still re-emits", async () => {
    const emittedStates: any[] = [];
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        sourceMixTitle="audioslave_stone.mp3"
        exportDialogHosted
        onExportDialogState={(state) => {
          emittedStates.push(state);
        }}
      />
    );

    // Ticket 03: the hosted form (Tab Shell Export Tab) renders neither the
    // action button nor the standalone fallback panel.
    expect(screen.queryByRole("button", { name: /export stems/i })).toBeNull();
    expect(
      screen.queryByRole("region", { name: /export audio stems/i })
    ).toBeNull();

    // Mixer, Master Volume, and Time-Stretch/Pitch-Shift/Formant tweaks still
    // reach the Transport bridge.
    fireEvent.change(screen.getByRole("slider", { name: /drums volume/i }), {
      target: { value: "0.4" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /master volume/i }), {
      target: { value: "0.9" },
    });
    for (let step = 0; step < 2; step += 1) {
      fireEvent.click(screen.getByRole("button", { name: /increment tempo/i }));
    }
    fireEvent.click(screen.getByRole("button", { name: /increment pitch/i }));
    fireEvent.click(
      screen.getByRole("switch", { name: /vocal formant preservation/i })
    );

    await waitFor(() => {
      expect(emittedStates.length).toBeGreaterThanOrEqual(5);
    });
    const lastState = emittedStates[emittedStates.length - 1];
    expect(lastState.mixerStates.drums.volume).toBeCloseTo(0.4);
    expect(lastState.masterVolume).toBeCloseTo(0.9);
    expect(lastState.timeStretch.tempo).toBeCloseTo(1.1);
    expect(lastState.timeStretch.pitch).toBe(1);
    expect(lastState.timeStretch.formantPreservation).toBe(false);
  });

  it("synchronizes solo states into Custom Mixdown export dialog", async () => {
    const user = userEvent.setup();
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    // Solo Vocals stem in Stem Player
    const vocalsSoloBtn = screen.getByRole("button", { name: /solo vocals/i });
    await user.click(vocalsSoloBtn);

    // Open ExportDialog
    const exportBtn = screen.getByRole("button", { name: /export stems/i });
    await user.click(exportBtn);

    const panel = screen.getByRole("region", { name: /export audio stems/i });
    expect(panel).toBeInTheDocument();
    const dialogScope = within(panel);

    // Switch to Custom Mixdown mode
    await user.click(
      dialogScope.getByRole("radio", { name: /custom mixdown/i })
    );

    // Vocals is soloed -> checked
    expect(
      dialogScope.getByRole("checkbox", { name: /vocals stem/i })
    ).toBeChecked();

    // Drums, Bass, Other are silenced by solo -> unchecked
    expect(
      dialogScope.getByRole("checkbox", { name: /drums stem/i })
    ).not.toBeChecked();
    expect(
      dialogScope.getByRole("checkbox", { name: /bass stem/i })
    ).not.toBeChecked();
    expect(
      dialogScope.getByRole("checkbox", { name: /other stem/i })
    ).not.toBeChecked();
  });

  it("completes full roundtrip workflow from fader adjustments to Custom Mixdown export", async () => {
    const user = userEvent.setup();
    const mixAudioStemsSpy = vi.spyOn(customMixdown, "mixAudioStems");

    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    // Set master volume to 0.65
    const masterSlider = screen.getByRole("slider", { name: /master volume/i });
    fireEvent.change(masterSlider, { target: { value: "0.65" } });

    // Set vocals volume to 0.7
    const vocalsSlider = screen.getByRole("slider", { name: /vocals volume/i });
    fireEvent.change(vocalsSlider, { target: { value: "0.7" } });

    // Mute drums
    const drumsMuteBtn = screen.getByRole("button", { name: /mute drums/i });
    await user.click(drumsMuteBtn);

    // Open ExportDialog
    const exportBtn = screen.getByRole("button", { name: /export stems/i });
    await user.click(exportBtn);

    const panel = screen.getByRole("region", { name: /export audio stems/i });
    const dialogScope = within(panel);

    // Switch to Custom Mixdown mode
    await user.click(
      dialogScope.getByRole("radio", { name: /custom mixdown/i })
    );

    // Click Export & Download
    await user.click(
      dialogScope.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(mixAudioStemsSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          masterGain: 0.65,
          stemGains: expect.objectContaining({
            vocals: 0.7,
            drums: 0,
            bass: 1.0,
            other: 1.0,
          }),
        })
      );
    });

    mixAudioStemsSpy.mockRestore();
  });

  it("hosts the Click Track rail inside the Mix player: domain-separate, off by default, reported out to the app", () => {
    // The rail reports its own state out to the app (Session persistence seam,
    // ticket 05): nothing here joins the Stem mixer contract.
    const reported: ClickTrackMixerState[] = [];
    const collect = (state: ClickTrackMixerState) => {
      reported.push(state);
    };

    // No Beat Grid yet (Separate tab still running / analysis pending).
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        onClickTrackState={collect}
      />
    );

    expect(screen.getByTestId("click-track-rail")).toBeInTheDocument();
    expect(screen.getByTestId("click-track-bpm-label")).toHaveTextContent(
      "No Beat Grid"
    );
    expect(screen.getByTestId("click-track-meter-label")).toHaveTextContent(
      "Meter 4/4"
    );

    const enableSwitch = screen.getByRole("switch", { name: /^click track$/i });
    expect(enableSwitch).toHaveAttribute("aria-checked", "false");
    // Nothing to lock clicks to: the toggle is inert until the Beat Grid exists.
    expect(enableSwitch).toHaveAttribute("disabled");
    fireEvent.click(enableSwitch);
    expect(enableSwitch).toHaveAttribute("aria-checked", "false");

    // The rail's initial state is reported out: off, un-muted, full volume, 4/4.
    expect(reported[0]).toEqual({
      enabled: false,
      muted: false,
      volume: 1,
      meter: "4/4",
    });
  });

  it("lights the Click Track rail once the Beat Grid exists: BPM readout, live toggle, reported state", () => {
    const reported: ClickTrackMixerState[] = [];
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        beatGrid={Float64Array.from([0.5, 1.0572789, 1.6145578])}
        clickTrackBpm={107.7}
        onClickTrackState={(state) => {
          reported.push(state);
        }}
      />
    );

    expect(screen.getByTestId("click-track-bpm-label")).toHaveTextContent(
      "107.7 BPM"
    );
    const liveSwitch = screen.getByRole("switch", { name: /^click track$/i });
    expect(liveSwitch.getAttribute("disabled")).toBeNull();
    fireEvent.click(liveSwitch);
    expect(liveSwitch).toHaveAttribute("aria-checked", "true");
    expect(reported[reported.length - 1]).toEqual({
      enabled: true,
      muted: false,
      volume: 1,
      meter: "4/4",
    });

    // The rail is never one of the Stems: the four identities stay intact.
    const stemGroups = screen.getAllByRole("group", { name: /stem$/i });
    expect(stemGroups).toHaveLength(4);
    expect(stemGroups.map((g) => g.getAttribute("aria-label"))).toEqual([
      "Vocals Stem",
      "Drums Stem",
      "Bass Stem",
      "Other Stem",
    ]);
  });

  it("ranks the Tempo Detector honestly on the rail: top reading plus alternatives with confidence, never one BPM presented as certain", () => {
    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        beatGrid={Float64Array.from([0.5, 1.0572789, 1.6145578])}
        clickTrackBpm={107.7}
        tempoCandidates={[
          { bpm: 107.7, confidence: 0.93 },
          { bpm: 215.4, confidence: 0.61 },
          { bpm: 72, confidence: 0.34 },
        ]}
        // The shell always wires the picker: only the ranked alternatives
        // are actionable, the tempo the Beat Grid is locked to is not.
        onChooseTempoCandidate={() => {}}
      />
    );

    // The locked reading keeps its readout...
    expect(screen.getByTestId("click-track-bpm-label")).toHaveTextContent(
      "107.7 BPM"
    );
    // ...but the rail names the ranking rather than a certainty: a pulse and
    // its metric doubling are indistinguishable, so the user picks the feel.
    expect(
      screen.getByTestId("click-track-confidence-label")
    ).toHaveTextContent("3 readings ranked");

    const picker = screen.getByTestId("click-track-candidate-picker");
    const chips = within(picker).getAllByRole("button");
    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => (chip.textContent ?? "").trim())).toEqual([
      "107.7 BPM 93%",
      "215.4 BPM 61%",
      "72.0 BPM 34%",
    ]);

    // The Beat Grid is already locked to the top reading: that chip is
    // informational, the alternatives are actionable.
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");
    expect(chips[0]).toHaveAttribute("disabled");
    expect(chips[1].getAttribute("disabled")).toBeNull();
    expect(chips[1]).toHaveAttribute(
      "aria-label",
      "Re-lock Beat Grid to 215.4 BPM"
    );
  });

  it("hands the rail's candidate picker to the app: choosing an alternative asks for a re-lock at that tempo", async () => {
    const user = userEvent.setup();
    const requested: number[] = [];

    render(
      <StemPlayer
        stems={dummyStems}
        sampleRate={sampleRate}
        audioContext={mockCtx}
        beatGrid={Float64Array.from([0.5, 1.0572789, 1.6145578])}
        clickTrackBpm={107.7}
        tempoCandidates={[
          { bpm: 107.7, confidence: 0.93 },
          { bpm: 215.4, confidence: 0.61 },
        ]}
        onChooseTempoCandidate={(bpm) => {
          requested.push(bpm);
        }}
      />
    );

    // Only the ranked alternative is picked: nothing but the locked tempo.
    await user.click(
      screen.getByRole("button", {
        name: /re-lock beat grid to 215\.4 bpm/i,
      })
    );
    expect(requested).toEqual([215.4]);

    // Picking the tempo the Beat Grid is already locked to asks for nothing.
    fireEvent.click(
      screen.getByRole("button", {
        name: /beat grid locked to 107\.7 bpm/i,
      })
    );
    expect(requested).toEqual([215.4]);
  });
});
