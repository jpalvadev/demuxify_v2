import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StemPlayer } from '../components/StemPlayer';
import { StemName } from '../lib/chunkOverlapAdd';

// Mock Web Audio API
function createMockAudioContext() {
  let currentTime = 0;
  return {
    get currentTime() {
      return currentTime;
    },
    set currentTime(t: number) {
      currentTime = t;
    },
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => ({
      gain: {
        value: 1.0,
        setValueAtTime: vi.fn(function (this: any, val: number) {
          this.value = val;
        }),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const channelArrays = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: vi.fn((ch: number) => channelArrays[ch]),
      };
    }),
  };
}

describe('StemPlayer UI Component', () => {
  let mockCtx: any;
  const sampleRate = 44100;
  const sampleCount = 44100 * 10; // 10s

  const dummyStems: Record<StemName, Float32Array[]> = {
    vocals: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    drums: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    bass: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
    other: [new Float32Array(sampleCount), new Float32Array(sampleCount)],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCtx = createMockAudioContext();
  });

  it('renders the Master Waveform, Transport bar, and all 4 Stem tracks', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    // Primary region
    expect(screen.getByRole('region', { name: /stem player/i })).toBeInTheDocument();

    // Transport controls
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByText(/00:00/)).toBeInTheDocument();

    // 4 Stem tracks
    expect(screen.getByText('Vocals')).toBeInTheDocument();
    expect(screen.getByText('Drums')).toBeInTheDocument();
    expect(screen.getByText('Bass')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();

    // Master Waveform
    expect(screen.getByRole('slider', { name: /master waveform timeline/i })).toBeInTheDocument();
  });

  it('toggles playback via the Play/Pause transport button', async () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const playBtn = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playBtn);

    // Button should now show Pause
    expect(await screen.findByRole('button', { name: /pause/i })).toBeInTheDocument();

    // Clicking pause returns to play
    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseBtn);
    expect(await screen.findByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('toggles playback using Spacebar hotkey listener', async () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();

    // Press Spacebar
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(await screen.findByRole('button', { name: /pause/i })).toBeInTheDocument();

    // Press Spacebar again
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(await screen.findByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('adjusts stem volume using individual volume faders', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const vocalsSlider = screen.getByRole('slider', { name: /vocals volume/i });
    expect(vocalsSlider).toHaveValue('1');

    fireEvent.change(vocalsSlider, { target: { value: '0.6' } });
    expect(vocalsSlider).toHaveValue('0.6');
  });

  it('toggles Mute and Solo states on individual stem tracks', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const muteDrumsBtn = screen.getByRole('button', { name: /mute drums/i });
    const soloVocalsBtn = screen.getByRole('button', { name: /solo vocals/i });

    expect(muteDrumsBtn).toHaveAttribute('aria-pressed', 'false');
    expect(soloVocalsBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Mute Drums
    fireEvent.click(muteDrumsBtn);
    expect(muteDrumsBtn).toHaveAttribute('aria-pressed', 'true');

    // Click Solo Vocals
    fireEvent.click(soloVocalsBtn);
    expect(soloVocalsBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows seeking via Master Waveform timeline', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const slider = screen.getByRole('slider', { name: /master waveform timeline/i });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 100,
      right: 500,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    // Seeking updates timeline position
    expect(screen.getByText(/00:05/)).toBeInTheDocument();
  });

  it('resets playback to beginning when Reset button is clicked', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const slider = screen.getByRole('slider', { name: /master waveform timeline/i });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 100,
      right: 500,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Seek to 5s
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(screen.getByText(/00:05/)).toBeInTheDocument();

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: /reset to beginning/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText(/00:00/)).toBeInTheDocument();
  });

  it('adjusts master volume fader', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const masterSlider = screen.getByRole('slider', { name: /master volume/i });
    expect(masterSlider).toHaveValue('1');

    fireEvent.change(masterSlider, { target: { value: '0.45' } });
    expect(masterSlider).toHaveValue('0.45');
  });
});
