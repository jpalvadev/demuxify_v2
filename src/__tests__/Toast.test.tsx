import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast, toastManager } from "../lib/toast";
import { ExportTab } from "../components/ExportTab";

// ADR-0009: the toast DOM surface (src/components/Toast.tsx + <ToastContainer />)
// is dead — notices render inline in their owning Tab. This seam covers the
// manager alone: it stays usable behind the scenes, but its notifications
// reach no DOM at all.

describe("Toast manager behind the dead toast surface", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      toastManager.clear();
    });
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
      toastManager.clear();
    });
    vi.useRealTimers();
  });

  it("manages notification lifecycle (show, dismiss, auto-dismiss, clear) with no DOM surface", () => {
    render(<div />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    const successId = toast.success("Stems exported successfully!");
    toast.error("Failed to export stems: out of memory");

    expect(toastManager.getToasts()).toHaveLength(2);
    // The notifications exist only in the manager: nothing renders anywhere.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Stems exported successfully!")
    ).not.toBeInTheDocument();

    toastManager.dismiss(successId);

    expect(toastManager.getToasts()).toHaveLength(1);

    // Auto-dismiss of the survivor happens on the manager's own timers.
    act(() => {
      vi.advanceTimersByTime(6500);
    });

    expect(toastManager.getToasts()).toHaveLength(0);
  });

  it("ExportDialog outcomes still reach the manager but announce nothing in the DOM", async () => {
    const dummyStems = {
      vocals: [new Float32Array(100), new Float32Array(100)],
      drums: [new Float32Array(100), new Float32Array(100)],
      bass: [new Float32Array(100), new Float32Array(100)],
      other: [new Float32Array(100), new Float32Array(100)],
    };

    render(<ExportTab stems={dummyStems} sourceMixTitle="MySong" />);

    const exportBtn = screen.getByRole("button", {
      name: /export & download/i,
    });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    // The emission survives...
    const notices = toastManager.getToasts();
    expect(
      notices.some((notice) =>
        /Export complete! Downloaded/i.test(notice.message ?? "")
      )
    ).toBe(true);

    // ...but the toast DOM surface is dead: no notice element exists anywhere.
    expect(screen.queryByTestId(/^toast-/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("toast-stack")).not.toBeInTheDocument();
  });
});
