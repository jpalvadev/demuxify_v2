import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiagnosticsOverlay } from "../components/DiagnosticsOverlay";
import { diagnostics } from "../lib/diagnostics";

describe("DiagnosticsOverlay", () => {
  beforeEach(() => {
    diagnostics.clear();
  });

  afterEach(() => {
    diagnostics.clear();
  });

  it("renders floating toggle button with error count badge", async () => {
    diagnostics.info("general", "App started");
    diagnostics.error("inference", "Test failure");

    render(<DiagnosticsOverlay />);

    const toggleButton = screen.getByRole("button", { name: /diagnostics/i });
    expect(toggleButton).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument(); // 1 error badge
    });
  });

  it("opens drawer when toggle button is clicked and displays log entries", async () => {
    diagnostics.info("inference", "Loading model weights");
    diagnostics.error("system", "WebGPU fallback active");

    render(<DiagnosticsOverlay />);

    const toggleButton = screen.getByRole("button", { name: /diagnostics/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText("System Diagnostics")).toBeInTheDocument();
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

    render(<DiagnosticsOverlay />);

    // Open drawer
    fireEvent.click(screen.getByRole("button", { name: /diagnostics/i }));

    const copyBtn = await screen.findByRole("button", { name: /copy report/i });
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

    render(<DiagnosticsOverlay />);
    fireEvent.click(screen.getByRole("button", { name: /diagnostics/i }));

    expect(await screen.findByText("Log to clear")).toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: /clear logs/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText("Log to clear")).not.toBeInTheDocument();
      expect(screen.getByText(/no logs recorded/i)).toBeInTheDocument();
    });
  });
});
