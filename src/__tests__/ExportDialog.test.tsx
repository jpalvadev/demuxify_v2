import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportDialog } from "../components/ExportDialog";
import { StemName } from "../lib/chunkOverlapAdd";
import { StemMixerStates } from "../lib/stemPlayerEngine";
import type { ClickTrackMixerState } from "../lib/stemPlayerEngine";
import * as bundleZip from "../lib/bundleZip";
import * as customMixdown from "../lib/customMixdown";

describe("ExportDialog", () => {
  const mockStems: Record<StemName, Float32Array[]> = {
    vocals: [new Float32Array(1152 * 2), new Float32Array(1152 * 2)],
    drums: [new Float32Array(1152 * 2), new Float32Array(1152 * 2)],
    bass: [new Float32Array(1152 * 2), new Float32Array(1152 * 2)],
    other: [new Float32Array(1152 * 2), new Float32Array(1152 * 2)],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ExportDialog
        isOpen={false}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with mode selection and format options when isOpen is true", () => {
    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    expect(
      screen.getByRole("region", { name: /export audio stems/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Export Audio Stems/i)).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /single stem/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /full export bundle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /custom mixdown/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export & download/i })
    ).toBeInTheDocument();
  });

  it("allows toggling between Single Stem and Full Bundle mode", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    const singleStemRadio = screen.getByRole("radio", { name: /single stem/i });
    const bundleRadio = screen.getByRole("radio", {
      name: /full export bundle/i,
    });

    expect(singleStemRadio).toBeChecked();
    expect(screen.getByLabelText(/select stem/i)).toBeInTheDocument();

    await user.click(bundleRadio);
    expect(bundleRadio).toBeChecked();
    // In full bundle mode, single stem select should not be visible
    expect(screen.queryByLabelText(/select stem/i)).not.toBeInTheDocument();
  });

  it("renders Custom Mixdown mode controls and presets correctly", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    // Switch to Custom Mixdown mode
    const mixdownRadio = screen.getByRole("radio", {
      name: /custom mixdown/i,
    });
    await user.click(mixdownRadio);
    expect(mixdownRadio).toBeChecked();

    // Single stem select should not be visible in Custom Mixdown
    expect(screen.queryByLabelText(/select stem/i)).not.toBeInTheDocument();

    // Verify preset buttons are present
    expect(
      screen.getByRole("button", { name: /karaoke \/ instrumental/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /acapella/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /minus drums/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();

    // Verify individual stem checkboxes and volume sliders
    for (const stem of ["vocals", "drums", "bass", "other"]) {
      const checkbox = screen.getByRole("checkbox", {
        name: new RegExp(`${stem} stem`, "i"),
      });
      expect(checkbox).toBeChecked();
      const slider = screen.getByRole("slider", {
        name: new RegExp(`${stem} volume`, "i"),
      });
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveValue("1");
    }

    // Verify Master Volume slider and Anti-Clipping toggle
    const masterSlider = screen.getByRole("slider", {
      name: /master mixdown volume/i,
    });
    expect(masterSlider).toBeInTheDocument();
    expect(masterSlider).toHaveValue("1");

    const antiClippingCheckbox = screen.getByRole("checkbox", {
      name: /anti-clipping/i,
    });
    expect(antiClippingCheckbox).toBeChecked();
  });

  it("updates stem selection and volumes when preset buttons are clicked", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

    const vocalsCheckbox = screen.getByRole("checkbox", {
      name: /vocals stem/i,
    });
    const drumsCheckbox = screen.getByRole("checkbox", { name: /drums stem/i });
    const bassCheckbox = screen.getByRole("checkbox", { name: /bass stem/i });
    const otherCheckbox = screen.getByRole("checkbox", { name: /other stem/i });

    // Click Karaoke / Instrumental: vocals muted/unchecked, drums/bass/other checked
    await user.click(
      screen.getByRole("button", { name: /karaoke \/ instrumental/i })
    );
    expect(vocalsCheckbox).not.toBeChecked();
    expect(drumsCheckbox).toBeChecked();
    expect(bassCheckbox).toBeChecked();
    expect(otherCheckbox).toBeChecked();

    // Click Acapella: vocals checked, drums/bass/other unchecked
    await user.click(screen.getByRole("button", { name: /acapella/i }));
    expect(vocalsCheckbox).toBeChecked();
    expect(drumsCheckbox).not.toBeChecked();
    expect(bassCheckbox).not.toBeChecked();
    expect(otherCheckbox).not.toBeChecked();

    // Click Minus Drums: drums unchecked, vocals/bass/other checked
    await user.click(screen.getByRole("button", { name: /minus drums/i }));
    expect(vocalsCheckbox).toBeChecked();
    expect(drumsCheckbox).not.toBeChecked();
    expect(bassCheckbox).toBeChecked();
    expect(otherCheckbox).toBeChecked();

    // Click Reset: all checked at 100%
    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(vocalsCheckbox).toBeChecked();
    expect(drumsCheckbox).toBeChecked();
    expect(bassCheckbox).toBeChecked();
    expect(otherCheckbox).toBeChecked();
  });

  it("disables export button when no stems are selected or when active stem volumes are zero", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));
    const exportBtn = screen.getByRole("button", {
      name: /export & download/i,
    });
    expect(exportBtn).not.toBeDisabled();

    const vocalsCheckbox = screen.getByRole("checkbox", {
      name: /vocals stem/i,
    });
    const drumsCheckbox = screen.getByRole("checkbox", { name: /drums stem/i });
    const bassCheckbox = screen.getByRole("checkbox", { name: /bass stem/i });
    const otherCheckbox = screen.getByRole("checkbox", { name: /other stem/i });

    // Uncheck all stems
    await user.click(vocalsCheckbox);
    await user.click(drumsCheckbox);
    await user.click(bassCheckbox);
    await user.click(otherCheckbox);

    // Export button should now be disabled
    expect(exportBtn).toBeDisabled();

    // Re-check vocals stem with volume 1.0 -> button becomes enabled
    await user.click(vocalsCheckbox);
    expect(exportBtn).not.toBeDisabled();

    // Set vocals volume slider to 0 -> button becomes disabled again
    const vocalsSlider = screen.getByRole("slider", { name: /vocals volume/i });
    fireEvent.change(vocalsSlider, { target: { value: "0" } });
    expect(exportBtn).toBeDisabled();

    // Bring vocals volume back up to 0.5 -> button becomes enabled
    fireEvent.change(vocalsSlider, { target: { value: "0.5" } });
    expect(exportBtn).not.toBeDisabled();
  });

  it("exports custom mixdown as WAV with anti-clipping protection", async () => {
    const user = userEvent.setup();
    const handleExportComplete = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
        onExportComplete={handleExportComplete}
      />
    );

    // Switch to Custom Mixdown
    await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

    // Click Karaoke preset (mutes vocals)
    await user.click(
      screen.getByRole("button", { name: /karaoke \/ instrumental/i })
    );

    // Click Export & Download
    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/export complete/i)).toBeInTheDocument();
    });

    // Descriptor for minus vocals is "karaoke"
    expect(handleExportComplete).toHaveBeenCalledWith(
      "audioslave_stone_karaoke.wav"
    );
  });

  it("exports custom mixdown as MP3 with selected bitrate", async () => {
    const user = userEvent.setup();
    const handleExportComplete = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
        onExportComplete={handleExportComplete}
      />
    );

    // Switch to Custom Mixdown
    await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

    // Click Acapella preset (solo vocals)
    await user.click(screen.getByRole("button", { name: /acapella/i }));

    // Switch to MP3
    await user.click(screen.getByRole("radio", { name: /^mp3/i }));

    // Select 320 kbps
    const bitrateSelect = screen.getByLabelText(/bitrate/i);
    await user.selectOptions(bitrateSelect, "320");

    // Click Export & Download
    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/export complete/i)).toBeInTheDocument();
    });

    // Descriptor for vocals only is "acapella"
    expect(handleExportComplete).toHaveBeenCalledWith(
      "audioslave_stone_acapella.mp3"
    );
  });

  it("passes custom master volume and antiClipping options to mixAudioStems and WAV encoder", async () => {
    const user = userEvent.setup();
    const mixAudioStemsSpy = vi.spyOn(customMixdown, "mixAudioStems");

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

    // Select 24-bit PCM
    const bitDepthSelect = screen.getByLabelText(/bit depth/i);
    await user.selectOptions(bitDepthSelect, "24");

    // Adjust master volume to 0.75
    const masterSlider = screen.getByRole("slider", {
      name: /master mixdown volume/i,
    });
    fireEvent.change(masterSlider, { target: { value: "0.75" } });

    // Toggle anti-clipping off
    const antiClippingCheckbox = screen.getByRole("checkbox", {
      name: /anti-clipping/i,
    });
    await user.click(antiClippingCheckbox);
    expect(antiClippingCheckbox).not.toBeChecked();

    // Export & Download
    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(mixAudioStemsSpy).toHaveBeenCalledWith(
        mockStems,
        expect.objectContaining({
          masterGain: 0.75,
          antiClipping: false,
          format: "wav",
          sourceMixTitle: "audioslave_stone.mp3",
        })
      );
    });

    mixAudioStemsSpy.mockRestore();
  });

  it("allows selecting format and sub-parameters (WAV bit-depth & MP3 bitrate)", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    // Default is WAV 16-bit
    const wavRadio = screen.getByRole("radio", { name: /^wav/i });
    const mp3Radio = screen.getByRole("radio", { name: /^mp3/i });
    expect(wavRadio).toBeChecked();

    const bitDepthSelect = screen.getByLabelText(/bit depth/i);
    expect(bitDepthSelect).toHaveValue("16");

    // Switch to MP3
    await user.click(mp3Radio);
    expect(mp3Radio).toBeChecked();

    const bitrateSelect = screen.getByLabelText(/bitrate/i);
    expect(bitrateSelect).toBeInTheDocument();
    await user.selectOptions(bitrateSelect, "320");
    expect(bitrateSelect).toHaveValue("320");
  });

  it("exports a single stem as WAV and triggers browser download", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleExportComplete = vi.fn();

    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");

    render(
      <ExportDialog
        isOpen={true}
        onClose={handleClose}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
        onExportComplete={handleExportComplete}
      />
    );

    // Select Vocals stem
    const stemSelect = screen.getByLabelText(/select stem/i);
    await user.selectOptions(stemSelect, "vocals");

    // Click Export & Download
    const exportBtn = screen.getByRole("button", {
      name: /export & download/i,
    });
    await user.click(exportBtn);

    // Verify progress indicator is shown
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Verify download was triggered
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/export complete/i)).toBeInTheDocument();
    });

    expect(handleExportComplete).toHaveBeenCalledWith(
      "audioslave_stone_vocals.wav"
    );
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("exports full 4-stem bundle as ZIP archive", async () => {
    const user = userEvent.setup();
    const handleExportComplete = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
        onExportComplete={handleExportComplete}
      />
    );

    // Select Bundle mode
    await user.click(
      screen.getByRole("radio", { name: /full export bundle/i })
    );

    // Export
    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/export complete/i)).toBeInTheDocument();
    });

    expect(handleExportComplete).toHaveBeenCalledWith(
      "audioslave_stone_stems.zip"
    );
  });

  it("carries a live Click Track lane as its own WAV file in the Export Bundle", async () => {
    const user = userEvent.setup();

    // ~1.8 s of Stems so the 107.7 BPM Beat Grid fits inside the export.
    const len = 80000;
    const stems: Record<StemName, Float32Array[]> = {
      vocals: [new Float32Array(len)],
      drums: [new Float32Array(len)],
      bass: [new Float32Array(len)],
      other: [new Float32Array(len)],
    };
    const beatGrid = Float64Array.from([0.5, 1.0572789, 1.6145578]);
    const enabled: ClickTrackMixerState = {
      enabled: true,
      volume: 0.7,
    };

    const bundleSpy = vi.spyOn(bundleZip, "createStemBundleZip");

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={stems}
        sampleRate={44100}
        sourceMixTitle="audioslave_stone.mp3"
        clickTrackBeatGrid={beatGrid}
        clickTrackSettings={enabled}
      />
    );

    await user.click(
      screen.getByRole("radio", { name: /full export bundle/i })
    );
    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/export complete/i)).toBeInTheDocument();
    });

    expect(bundleSpy).toHaveBeenCalledTimes(1);
    const options = bundleSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(options.format).toBe("wav");
    // Exactly one extra bundle member: encoded Click Track bytes ride
    // alongside the four Stems, never inside the Stems set.
    expect(options.clickTrack).toBeInstanceOf(Uint8Array);

    bundleSpy.mockRestore();
  });

  it("encodes the Click Track file as MP3 when the Stems export format is MP3", async () => {
    const user = userEvent.setup();

    const shortLen = 4096;
    const stems: Record<StemName, Float32Array[]> = {
      vocals: [new Float32Array(shortLen)],
      drums: [new Float32Array(shortLen)],
      bass: [new Float32Array(shortLen)],
      other: [new Float32Array(shortLen)],
    };
    // Beat Grid inside the 0.093 s export window.
    const beatGrid = Float64Array.from([0.01, 0.03, 0.05, 0.07]);

    const bundleSpy = vi.spyOn(bundleZip, "createStemBundleZip");

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={stems}
        sampleRate={44100}
        sourceMixTitle="RockTrack"
        clickTrackBeatGrid={beatGrid}
        clickTrackSettings={{
          enabled: true,
          volume: 1,
        }}
      />
    );

    await user.click(screen.getByRole("radio", { name: /^mp3/i }));
    await user.click(
      screen.getByRole("radio", { name: /full export bundle/i })
    );
    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/export complete/i)).toBeInTheDocument();
    });

    expect(bundleSpy).toHaveBeenCalledTimes(1);
    const options = bundleSpy.mock.calls[0][1] as Record<string, unknown>;
    // Format follows the Stems' export choice: MP3 Stems get an MP3 click
    // file, encoded through the existing encodeMp3 path.
    expect(options.format).toBe("mp3");
    expect(options.clickTrack).toBeInstanceOf(Uint8Array);
    bundleSpy.mockRestore();
  });

  it("leaves the Export Bundle unchanged when the Click Track lane is off or absent", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(bundleZip, "createStemBundleZip");

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
      />
    );

    await user.click(
      screen.getByRole("radio", { name: /full export bundle/i })
    );
    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/export complete/i)).toBeInTheDocument();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const options = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(options.clickTrack).toBeUndefined();
    spy.mockRestore();
  });

  it("hosts no Click Track affordance: the concept stays out of the dialog and its mixdown picker", async () => {
    const user = userEvent.setup();
    const enabled: ClickTrackMixerState = {
      enabled: true,
      volume: 1,
    };
    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={mockStems}
        sourceMixTitle="audioslave_stone.mp3"
        clickTrackBeatGrid={Float64Array.from([0.5, 1.0572789])}
        clickTrackSettings={enabled}
      />
    );

    // Even with the lane live and a Beat Grid in hand, the dialog gains no
    // Click Track control of any kind.
    expect(screen.queryByText(/click track/i)).toBeNull();
    for (const role of ["radio", "button", "slider", "switch"]) {
      expect(screen.queryByRole(role, { name: /click track/i })).toBeNull();
    }

    // Switch into Custom Mixdown mode: its preset picker is karaoke,
    // acapella, minus-drums, reset — never a Click Track affordance.
    await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));
    const presetButtons = screen.getAllByRole("button", {
      name: /karaoke|acapella|minus drums|reset/i,
    });
    expect(presetButtons).toHaveLength(4);
    expect(
      presetButtons.filter((b) =>
        /click|track|metronome/i.test(b.textContent ?? "")
      )
    ).toHaveLength(0);
  });

  it("displays error alert if stem export fails", async () => {
    const user = userEvent.setup();
    const brokenStems: any = {
      vocals: null,
      drums: null,
      bass: null,
      other: null,
    };

    render(
      <ExportDialog
        isOpen={true}
        onClose={vi.fn()}
        stems={brokenStems}
        sourceMixTitle="broken.mp3"
      />
    );

    await user.click(
      screen.getByRole("button", { name: /export & download/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/export failed/i)).toBeInTheDocument();
    });
  });

  describe("Stem Player Mixer Synchronization", () => {
    it("pre-populates Custom Mixdown controls from initialMixerStates and initialMasterVolume", async () => {
      const user = userEvent.setup();
      const initialMixerStates: StemMixerStates = {
        vocals: { volume: 0.75, muted: false, solo: false },
        drums: { volume: 0.6, muted: true, solo: false },
        bass: { volume: 0.9, muted: false, solo: false },
        other: { volume: 0.4, muted: false, solo: false },
      };

      render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          initialMixerStates={initialMixerStates}
          initialMasterVolume={0.8}
        />
      );

      await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

      // Vocals: unmuted, vol 0.75 -> enabled & vol 0.75
      const vocalsCheckbox = screen.getByRole("checkbox", {
        name: /vocals stem/i,
      });
      expect(vocalsCheckbox).toBeChecked();
      const vocalsSlider = screen.getByRole("slider", {
        name: /vocals volume/i,
      });
      expect(vocalsSlider).toHaveValue("0.75");

      // Drums: muted, vol 0.6 -> unchecked/disabled in mix & vol 0.6
      const drumsCheckbox = screen.getByRole("checkbox", {
        name: /drums stem/i,
      });
      expect(drumsCheckbox).not.toBeChecked();
      const drumsSlider = screen.getByRole("slider", { name: /drums volume/i });
      expect(drumsSlider).toHaveValue("0.6");

      // Bass: unmuted, vol 0.9 -> enabled & vol 0.9
      const bassCheckbox = screen.getByRole("checkbox", { name: /bass stem/i });
      expect(bassCheckbox).toBeChecked();
      const bassSlider = screen.getByRole("slider", { name: /bass volume/i });
      expect(bassSlider).toHaveValue("0.9");

      // Other: unmuted, vol 0.4 -> enabled & vol 0.4
      const otherCheckbox = screen.getByRole("checkbox", {
        name: /other stem/i,
      });
      expect(otherCheckbox).toBeChecked();
      const otherSlider = screen.getByRole("slider", { name: /other volume/i });
      expect(otherSlider).toHaveValue("0.4");

      // Master Volume: 0.8
      const masterSlider = screen.getByRole("slider", {
        name: /master mixdown volume/i,
      });
      expect(masterSlider).toHaveValue("0.8");
    });

    it("reflects solo states by only enabling soloed stems in Custom Mixdown", async () => {
      const user = userEvent.setup();
      const initialMixerStates: StemMixerStates = {
        vocals: { volume: 0.85, muted: false, solo: true },
        drums: { volume: 0.7, muted: false, solo: false },
        bass: { volume: 0.95, muted: false, solo: false },
        other: { volume: 0.5, muted: false, solo: false },
      };

      render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          initialMixerStates={initialMixerStates}
        />
      );

      await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

      // Only vocals was soloed, so only vocals is enabled; others are silenced
      expect(
        screen.getByRole("checkbox", { name: /vocals stem/i })
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: /drums stem/i })
      ).not.toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: /bass stem/i })
      ).not.toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: /other stem/i })
      ).not.toBeChecked();
    });

    it("allows on-the-fly adjustment inside the dialog without being overwritten", async () => {
      const user = userEvent.setup();
      const initialMixerStates: StemMixerStates = {
        vocals: { volume: 0.5, muted: false, solo: false },
        drums: { volume: 0.5, muted: false, solo: false },
        bass: { volume: 0.5, muted: false, solo: false },
        other: { volume: 0.5, muted: false, solo: false },
      };

      render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          initialMixerStates={initialMixerStates}
          initialMasterVolume={0.5}
        />
      );

      await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

      // Uncheck vocals
      const vocalsCheckbox = screen.getByRole("checkbox", {
        name: /vocals stem/i,
      });
      await user.click(vocalsCheckbox);
      expect(vocalsCheckbox).not.toBeChecked();

      // Change master volume slider
      const masterSlider = screen.getByRole("slider", {
        name: /master mixdown volume/i,
      });
      fireEvent.change(masterSlider, { target: { value: "0.85" } });
      expect(masterSlider).toHaveValue("0.85");
    });

    it("re-synchronizes with new mixer settings when closed and re-opened", async () => {
      const user = userEvent.setup();
      const initialMixerStates1: StemMixerStates = {
        vocals: { volume: 0.5, muted: false, solo: false },
        drums: { volume: 0.5, muted: false, solo: false },
        bass: { volume: 0.5, muted: false, solo: false },
        other: { volume: 0.5, muted: false, solo: false },
      };

      const { rerender } = render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          initialMixerStates={initialMixerStates1}
          initialMasterVolume={0.5}
        />
      );

      await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));
      expect(
        screen.getByRole("slider", { name: /master mixdown volume/i })
      ).toHaveValue("0.5");

      // Close dialog
      rerender(
        <ExportDialog
          isOpen={false}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          initialMixerStates={initialMixerStates1}
          initialMasterVolume={0.5}
        />
      );

      // Re-open with new mixer states
      const initialMixerStates2: StemMixerStates = {
        vocals: { volume: 0.9, muted: true, solo: false },
        drums: { volume: 0.8, muted: false, solo: false },
        bass: { volume: 0.7, muted: false, solo: false },
        other: { volume: 0.6, muted: false, solo: false },
      };

      rerender(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          initialMixerStates={initialMixerStates2}
          initialMasterVolume={0.75}
        />
      );

      await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

      expect(
        screen.getByRole("checkbox", { name: /vocals stem/i })
      ).not.toBeChecked();
      expect(
        screen.getByRole("slider", { name: /vocals volume/i })
      ).toHaveValue("0.9");
      expect(
        screen.getByRole("slider", { name: /master mixdown volume/i })
      ).toHaveValue("0.75");
    });
  });

  describe("Active Pitch & Tempo Adjustments Export", () => {
    it("displays 'Apply active Pitch & Tempo adjustments' checkbox with informative label when session values are non-neutral", () => {
      render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          activeTempo={1.25}
          activePitch={2}
        />
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /apply active pitch & tempo adjustments/i,
      });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
      expect(screen.getByText(/\+2 st, 1\.25x/i)).toBeInTheDocument();
    });

    it("does not display adjustments checkbox when session values are at neutral default (1.00x, 0 st)", () => {
      render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          activeTempo={1.0}
          activePitch={0}
        />
      );

      expect(
        screen.queryByRole("checkbox", {
          name: /apply active pitch & tempo adjustments/i,
        })
      ).not.toBeInTheDocument();
    });

    it("applies pitch and tempo adjustments to exported custom mixdown when checked", async () => {
      const user = userEvent.setup();
      const mixAudioSpy = vi.spyOn(customMixdown, "mixAudioStems");

      render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          activeTempo={1.5}
          activePitch={-2}
        />
      );

      // Select Custom Mixdown mode
      await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

      const checkbox = screen.getByRole("checkbox", {
        name: /apply active pitch & tempo adjustments/i,
      });
      expect(checkbox).toBeChecked();

      // Trigger export
      await user.click(
        screen.getByRole("button", { name: /export & download/i })
      );

      await waitFor(() => {
        expect(mixAudioSpy).toHaveBeenCalled();
      });

      // Transformed stems should have scaled sample length (1152*2 / 1.5 = 1536)
      const passedStems = mixAudioSpy.mock.calls[0][0];
      const vocalsLength = (passedStems.vocals as Float32Array[])[0].length;
      expect(vocalsLength).toBe(Math.round((1152 * 2) / 1.5));
    });

    it("exports unmodified audio when adjustments checkbox is unchecked by user", async () => {
      const user = userEvent.setup();
      const mixAudioSpy = vi.spyOn(customMixdown, "mixAudioStems");

      render(
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={mockStems}
          sourceMixTitle="audioslave_stone.mp3"
          activeTempo={1.5}
          activePitch={-2}
        />
      );

      // Select Custom Mixdown mode
      await user.click(screen.getByRole("radio", { name: /custom mixdown/i }));

      const checkbox = screen.getByRole("checkbox", {
        name: /apply active pitch & tempo adjustments/i,
      });
      // Uncheck adjustments
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      // Trigger export
      await user.click(
        screen.getByRole("button", { name: /export & download/i })
      );

      await waitFor(() => {
        expect(mixAudioSpy).toHaveBeenCalled();
      });

      // Passed stems should maintain original sample length (1152 * 2 = 2304)
      const passedStems = mixAudioSpy.mock.calls[0][0];
      const vocalsLength = (passedStems.vocals as Float32Array[])[0].length;
      expect(vocalsLength).toBe(1152 * 2);
    });
  });
});
