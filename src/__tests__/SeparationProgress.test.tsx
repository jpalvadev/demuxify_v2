import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeparationProgress } from "../components/SeparationProgress";

describe("SeparationProgress Component", () => {
  it("renders nothing (null) in idle state", () => {
    const { container } = render(
      <SeparationProgress state={{ status: "idle" }} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders downloading state with byte count and progress bar", () => {
    const handleCancel = vi.fn();
    render(
      <SeparationProgress
        state={{
          status: "active",
          event: {
            stage: "downloading",
            loadedBytes: 25 * 1024 * 1024,
            totalBytes: 50 * 1024 * 1024,
            progress: 0.5,
          },
        }}
        onCancel={handleCancel}
      />
    );

    expect(
      screen.getByText(/downloading bs-roformer.*weights/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/persisting bs-roformer 4-stem into model cache/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/htdemucs/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/50%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/25.0 MB \/ 50.0 MB/i)).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "50");

    // Cancel button
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("renders initializing neural network state with backend info", () => {
    const handleCancel = vi.fn();
    render(
      <SeparationProgress
        state={{
          status: "active",
          event: {
            stage: "initializing",
            backend: "webgpu",
          },
        }}
        onCancel={handleCancel}
      />
    );

    expect(
      screen.getByText(/initializing neural network inference/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/compiling webgpu shaders/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("renders separating chunks state with elapsed time and ETA", () => {
    const handleCancel = vi.fn();
    render(
      <SeparationProgress
        state={{
          status: "active",
          event: {
            stage: "separating",
            chunkIndex: 2,
            totalChunks: 5,
            progress: 0.6,
            elapsedMs: 12000,
            etaMs: 8000,
          },
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

  it("renders error state with error message, retry and cancel buttons", () => {
    const handleRetry = vi.fn();
    const handleCancel = vi.fn();
    render(
      <SeparationProgress
        state={{
          status: "error",
          error: "WebGPU device lost",
        }}
        onCancel={handleCancel}
        onRetry={handleRetry}
      />
    );

    expect(screen.getByText(/separation error/i)).toBeInTheDocument();
    expect(screen.getByText(/webgpu device lost/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("renders dynamic model identity when a mobile or fast profile is provided", () => {
    const handleCancel = vi.fn();
    const htdemucsProfile = {
      id: "htdemucs-4stem" as const,
      name: "HT-Demucs 4-Stem",
      shortName: "Fast",
      tagline: "Rapid 4-stem separation with minimal memory footprint",
      deviceCategory: "mobile" as const,
      explanation: "Optimized for mobile devices",
      modelUrl: "/models/htdemucs_4stem_mobile.onnx",
      cacheName: "demuxify-htdemucs-cache-v1",
      estimatedSizeMb: 54,
      chunkDurationSec: 6.0,
      chunkOverlapSec: 1.0,
      architecture: "htdemucs" as const,
      memoryRequirementDescription: "~54 MB model",
    };

    render(
      <SeparationProgress
        state={{
          status: "active",
          event: {
            stage: "downloading",
            loadedBytes: 20 * 1024 * 1024,
            totalBytes: 54 * 1024 * 1024,
            progress: 0.37,
          },
        }}
        modelProfile={htdemucsProfile}
        onCancel={handleCancel}
      />
    );

    expect(
      screen.getByText(/downloading ht-demucs 4-stem weights/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/persisting ht-demucs 4-stem into model cache/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/bs-roformer/i)).not.toBeInTheDocument();
  });

  it("supports transitional legacy props during App.tsx migration", () => {
    const handleCancel = vi.fn();
    render(
      <SeparationProgress
        phase="downloading"
        downloadProgress={{
          loadedBytes: 10 * 1024 * 1024,
          totalBytes: 40 * 1024 * 1024,
          progress: 0.25,
        }}
        onCancel={handleCancel}
      />
    );

    expect(
      screen.getByText(/downloading bs-roformer.*weights/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/10.0 MB \/ 40.0 MB/i)).toBeInTheDocument();
  });
});
