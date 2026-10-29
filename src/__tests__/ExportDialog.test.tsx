import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportDialog } from "../components/ExportDialog";
import { StemName } from "../lib/chunkOverlapAdd";

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

    expect(screen.getByRole("dialog", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByText(/Export Audio Stems/i)).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /single stem/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /full export bundle/i })
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
});
