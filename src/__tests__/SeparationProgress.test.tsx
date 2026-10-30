import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeparationProgress } from "../components/SeparationProgress";

describe("SeparationProgress Component", () => {
  it("renders downloading state with byte count and progress bar", () => {
    const handleCancel = vi.fn();
    render(
      <SeparationProgress
        phase="downloading"
        downloadProgress={{
          loadedBytes: 25 * 1024 * 1024,
          totalBytes: 50 * 1024 * 1024,
          progress: 0.5,
        }}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText(/downloading model weights/i)).toBeInTheDocument();
    expect(screen.getAllByText(/50%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/25.0 MB \/ 50.0 MB/i)).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "50");

    // Cancel button
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("renders separating chunks state with elapsed time and ETA", () => {
    const handleCancel = vi.fn();
    render(
      <SeparationProgress
        phase="separating"
        chunkProgress={{
          chunkIndex: 2,
          totalChunks: 5,
          progress: 0.6,
          elapsedMs: 12000, // 12s
          etaMs: 8000, // 8s
        }}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText(/separating chunk 3 of 5/i)).toBeInTheDocument();
    expect(screen.getAllByText(/60%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/elapsed: 00:12/i)).toBeInTheDocument();
    expect(screen.getByText(/eta: 00:08/i)).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "60");
  });

  it("renders error state with error message and retry button", () => {
    const handleRetry = vi.fn();
    render(
      <SeparationProgress
        phase="error"
        error="WebGPU device lost"
        onCancel={vi.fn()}
        onRetry={handleRetry}
      />
    );

    expect(screen.getByText(/separation error/i)).toBeInTheDocument();
    expect(screen.getByText(/webgpu device lost/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders early chunk_start state while chunk 1 is compiling shaders", () => {
    render(
      <SeparationProgress
        phase="separating"
        chunkStart={{
          chunkIndex: 0,
          totalChunks: 42,
          stage: "webgpu_compiling",
        }}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/separating chunk 1 of 42/i)).toBeInTheDocument();
    expect(screen.getByText(/compiling webgpu shaders/i)).toBeInTheDocument();
  });

  it("renders early chunk_start state while chunk 1 is compiling shaders", () => {
    render(
      <SeparationProgress
        phase="separating"
        chunkStart={{
          chunkIndex: 0,
          totalChunks: 42,
          stage: "webgpu_compiling",
        }}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/separating chunk 1 of 42/i)).toBeInTheDocument();
    expect(screen.getByText(/compiling webgpu shaders/i)).toBeInTheDocument();
  });
});
