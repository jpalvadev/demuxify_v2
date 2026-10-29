import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { toast, toastManager } from '../lib/toast';
import { ToastContainer } from '../components/Toast';
import { ExportDialog } from '../components/ExportDialog';

describe('Floating Toast Notification System', () => {
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

  it('manages toast notifications lifecycle (show, dismiss, auto-dismiss, clear)', () => {
    render(<ToastContainer />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      toast.success('Stems exported successfully!');
    });

    const successToast = screen.getByRole('status');
    expect(successToast).toBeInTheDocument();
    expect(screen.getByText('Stems exported successfully!')).toBeInTheDocument();

    // Auto-dismiss after timeout
    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders error toasts with alert role and persists until dismissed or timeout', () => {
    render(<ToastContainer />);

    act(() => {
      toast.error('Failed to export stems: out of memory');
    });

    const errorToast = screen.getByRole('alert');
    expect(errorToast).toBeInTheDocument();
    expect(screen.getByText('Failed to export stems: out of memory')).toBeInTheDocument();

    // Dismiss button click
    const dismissBtn = screen.getByRole('button', { name: /dismiss notification/i });
    act(() => {
      fireEvent.click(dismissBtn);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('triggers floating toast notification from ExportDialog that remains visible after dialog closes', async () => {
    const dummyStems = {
      vocals: [new Float32Array(100), new Float32Array(100)],
      drums: [new Float32Array(100), new Float32Array(100)],
      bass: [new Float32Array(100), new Float32Array(100)],
      other: [new Float32Array(100), new Float32Array(100)],
    };

    // Render both ExportDialog and ToastContainer
    const { rerender } = render(
      <>
        <ToastContainer />
        <ExportDialog
          isOpen={true}
          onClose={vi.fn()}
          stems={dummyStems}
          sourceMixTitle="MySong"
        />
      </>
    );

    // Click Export & Download button
    const exportBtn = screen.getByRole('button', { name: /export & download/i });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    // Verify toast is visible
    expect(screen.getByTestId('toast-success')).toHaveTextContent(
      /Export complete! Downloaded MySong_vocals.wav/i
    );

    // Close the ExportDialog
    rerender(
      <>
        <ToastContainer />
        <ExportDialog
          isOpen={false}
          onClose={vi.fn()}
          stems={dummyStems}
          sourceMixTitle="MySong"
        />
      </>
    );

    // ExportDialog is closed, but floating toast notification remains visible!
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast-success')).toHaveTextContent(
      /Export complete! Downloaded MySong_vocals.wav/i
    );
  });
});
