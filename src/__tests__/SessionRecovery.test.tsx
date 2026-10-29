import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SessionRecovery } from '../components/SessionRecovery';

describe('SessionRecovery', () => {
  it('renders previous session information with title and duration', () => {
    render(
      <SessionRecovery
        title="Audioslave - Stone"
        duration={284}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
      />
    );

    // Matches requirement: "Previous session found: [Song Title] ([duration]). Resume or Discard?"
    expect(screen.getByText(/Previous session found/i)).toBeInTheDocument();
    expect(screen.getByText(/Audioslave - Stone/i)).toBeInTheDocument();
    expect(screen.getByText(/04:44|4:44/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
  });

  it('invokes onResume when Resume button is clicked', async () => {
    const user = userEvent.setup();
    const handleResume = vi.fn();
    const handleDiscard = vi.fn();

    render(
      <SessionRecovery
        title="Audioslave - Stone"
        duration={120}
        onResume={handleResume}
        onDiscard={handleDiscard}
      />
    );

    const resumeBtn = screen.getByRole('button', { name: /resume/i });
    await user.click(resumeBtn);

    expect(handleResume).toHaveBeenCalledTimes(1);
    expect(handleDiscard).not.toHaveBeenCalled();
  });

  it('invokes onDiscard when Discard button is clicked', async () => {
    const user = userEvent.setup();
    const handleResume = vi.fn();
    const handleDiscard = vi.fn();

    render(
      <SessionRecovery
        title="Audioslave - Stone"
        duration={120}
        onResume={handleResume}
        onDiscard={handleDiscard}
      />
    );

    const discardBtn = screen.getByRole('button', { name: /discard/i });
    await user.click(discardBtn);

    expect(handleDiscard).toHaveBeenCalledTimes(1);
    expect(handleResume).not.toHaveBeenCalled();
  });

  it('shows loading state when isResuming is true and disables buttons', () => {
    render(
      <SessionRecovery
        title="Audioslave - Stone"
        duration={120}
        isResuming={true}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
      />
    );

    const resumeBtn = screen.getByRole('button', { name: /restoring|resume/i });
    const discardBtn = screen.getByRole('button', { name: /discard/i });

    expect(resumeBtn).toBeDisabled();
    expect(discardBtn).toBeDisabled();
    expect(screen.getByText(/restoring|resuming/i)).toBeInTheDocument();
  });
});
