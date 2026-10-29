import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StemStrip } from '../components/StemStrip';
import { StemMixerSettings } from '../lib/sessionStore';

describe('StemStrip UI Component', () => {
  const dummySettings: StemMixerSettings = {
    volume: 0.85,
    muted: false,
    solo: false,
  };

  it('renders StemStrip with aria-label matching Glossary standard ("Vocals Stem")', () => {
    render(
      <StemStrip
        stem="vocals"
        settings={dummySettings}
        duration={60}
        currentTime={10}
        onVolumeChange={vi.fn()}
        onToggleMute={vi.fn()}
        onToggleSolo={vi.fn()}
      />
    );

    const strip = screen.getByRole('group', { name: 'Vocals Stem' });
    expect(strip).toBeInTheDocument();
  });

  it('accepts StemMixerSettings and reflects volume, mute, and solo state', () => {
    const onVolumeChange = vi.fn();
    const onToggleMute = vi.fn();
    const onToggleSolo = vi.fn();

    const { rerender } = render(
      <StemStrip
        stem="drums"
        settings={{ volume: 0.5, muted: false, solo: true }}
        duration={120}
        currentTime={30}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
        onToggleSolo={onToggleSolo}
      />
    );

    const muteBtn = screen.getByRole('button', { name: 'Mute Drums' });
    const soloBtn = screen.getByRole('button', { name: 'Solo Drums' });
    const volumeSlider = screen.getByRole('slider', { name: 'Drums Volume' });

    expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
    expect(soloBtn).toHaveAttribute('aria-pressed', 'true');
    expect(volumeSlider).toHaveValue('0.5');

    // Trigger volume change
    fireEvent.change(volumeSlider, { target: { value: '0.9' } });
    expect(onVolumeChange).toHaveBeenCalledWith(0.9);

    // Trigger toggle mute
    fireEvent.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalled();

    // Trigger toggle solo
    fireEvent.click(soloBtn);
    expect(onToggleSolo).toHaveBeenCalled();

    // Rerender with muted settings
    rerender(
      <StemStrip
        stem="drums"
        settings={{ volume: 0.5, muted: true, solo: false }}
        duration={120}
        currentTime={30}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
        onToggleSolo={onToggleSolo}
      />
    );
    expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
    expect(soloBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('supports seek when canvas waveform is clicked', () => {
    const onSeek = vi.fn();
    const { container } = render(
      <StemStrip
        stem="bass"
        settings={dummySettings}
        duration={100}
        currentTime={0}
        onVolumeChange={vi.fn()}
        onToggleMute={vi.fn()}
        onToggleSolo={vi.fn()}
        onSeek={onSeek}
      />
    );

    const waveformBox = container.querySelector('[role="presentation"]');
    expect(waveformBox).toBeInTheDocument();

    if (waveformBox) {
      vi.spyOn(waveformBox, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 200,
        height: 56,
        bottom: 56,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.click(waveformBox, { clientX: 100 });
      // 100 / 200 = 0.5 -> 0.5 * 100 = 50 seconds
      expect(onSeek).toHaveBeenCalledWith(50);
    }
  });
});
