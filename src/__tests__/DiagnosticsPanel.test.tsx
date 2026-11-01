import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { diagnostics } from "../lib/diagnostics";

describe("DiagnosticsPanel", () => {
  beforeEach(() => {
    diagnostics.clear();
  });

  afterEach(() => {
    diagnostics.clear();
  });

  it("renders inline System Diagnostics panel with error count badge", async () => {
    diagnostics.info("general", "App started");
    diagnostics.error("inference", "Test failure");

    render(<DiagnosticsPanel />);

    const panel = screen.getByRole("region", { name: /system diagnostics/i });
    expect(panel).toBeInTheDocument();
    expect(screen.getByText("System Diagnostics")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/1 error/)).toBeInTheDocument(); // 1 error badge
    });
  });

  it("displays log entries inline without opening anything", async () => {
    diagnostics.info("inference", "Loading model weights");
    diagnostics.error("system", "WebGPU fallback active");

    render(<DiagnosticsPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /system diagnostics/i })
      ).toBeInTheDocument();
      expect(screen.getByText("Loading model weights")).toBeInTheDocument();
      expect(screen.getByText("WebGPU fallback active")).toBeInTheDocument();
    });
  });

  it("allows copying diagnostics report to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    diagnostics.info("network", "Fetched 100 bytes");

    render(<DiagnosticsPanel />);

    const copyBtn = await screen.findByRole("button", {
      name: /copy report/i,
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });
    expect(writeTextMock.mock.calls[0][0]).toContain(
      "# Demuxify Diagnostics Report"
    );
    expect(writeTextMock.mock.calls[0][0]).toContain("Fetched 100 bytes");
  });

  it("clears logs when clear button is clicked", async () => {
    diagnostics.info("general", "Log to clear");

    render(<DiagnosticsPanel />);

    expect(await screen.findByText("Log to clear")).toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: /clear logs/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText("Log to clear")).not.toBeInTheDocument();
      expect(screen.getByText(/no logs recorded/i)).toBeInTheDocument();
    });
  });
});
