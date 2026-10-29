import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StemPlayer } from '../components/StemPlayer';
import { StemName } from '../lib/chunkOverlapAdd';

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
      playbackRate: {
        value: 1.0,
        setValueAtTime: vi.fn(),
      },
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

describe('StemPlayer Time-Stretch & Pitch Controls', () => {
  let mockCtx: any;
  const sampleRate = 44100;
  const sampleCount = 44100 * 5; // 5s

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

  it('renders tempo slider, speed label, preset buttons, pitch slider, stepper, and reset button', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    // Tempo Section
    expect(screen.getByRole('slider', { name: /playback tempo/i })).toBeInTheDocument();
    expect(screen.getByTestId('current-tempo-label')).toHaveTextContent('1.00x');
    expect(screen.getByRole('button', { name: /tempo preset 0\.75x/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tempo preset 1\.00x/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tempo preset 1\.25x/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tempo preset 1\.50x/i })).toBeInTheDocument();

    // Pitch Section
    expect(screen.getByRole('slider', { name: /pitch shift/i })).toBeInTheDocument();
    expect(screen.getByTestId('current-pitch-label')).toHaveTextContent('0 st');
    expect(screen.getByRole('button', { name: /decrement pitch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increment pitch/i })).toBeInTheDocument();

    // Time-Stretch Reset Button
    expect(screen.getByRole('button', { name: /reset time-stretch|reset pitch and tempo/i })).toBeInTheDocument();
  });

  it('adjusts tempo via slider and preset buttons', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const tempoSlider = screen.getByRole('slider', { name: /playback tempo/i });
    const tempoLabel = screen.getByTestId('current-tempo-label');
    expect(tempoSlider).toHaveValue('1');

    // Change slider to 1.35x
    fireEvent.change(tempoSlider, { target: { value: '1.35' } });
    expect(tempoLabel).toHaveTextContent('1.35x');

    // Click 0.75x preset button
    const preset075 = screen.getByRole('button', { name: /tempo preset 0\.75x/i });
    fireEvent.click(preset075);
    expect(tempoLabel).toHaveTextContent('0.75x');
    expect(tempoSlider).toHaveValue('0.75');

    // Click 1.50x preset button
    const preset15 = screen.getByRole('button', { name: /tempo preset 1\.50x/i });
    fireEvent.click(preset15);
    expect(tempoLabel).toHaveTextContent('1.50x');
    expect(tempoSlider).toHaveValue('1.5');
  });

  it('adjusts pitch via stepper buttons and pitch slider', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const pitchSlider = screen.getByRole('slider', { name: /pitch shift/i });
    const incBtn = screen.getByRole('button', { name: /increment pitch/i });
    const decBtn = screen.getByRole('button', { name: /decrement pitch/i });
    const pitchLabel = screen.getByTestId('current-pitch-label');

    expect(pitchLabel).toHaveTextContent('0 st');

    // Increment pitch by 1 semitone
    fireEvent.click(incBtn);
    expect(pitchLabel).toHaveTextContent('+1 st');
    expect(pitchSlider).toHaveValue('1');

    // Increment again
    fireEvent.click(incBtn);
    expect(pitchLabel).toHaveTextContent('+2 st');
    expect(pitchSlider).toHaveValue('2');

    // Decrement pitch 3 times -> -1 st
    fireEvent.click(decBtn);
    fireEvent.click(decBtn);
    fireEvent.click(decBtn);
    expect(pitchLabel).toHaveTextContent('-1 st');
    expect(pitchSlider).toHaveValue('-1');

    // Direct slider change to -5 st
    fireEvent.change(pitchSlider, { target: { value: '-5' } });
    expect(pitchLabel).toHaveTextContent('-5 st');
  });

  it('resets both pitch and tempo to default with a single click', () => {
    render(<StemPlayer stems={dummyStems} sampleRate={sampleRate} audioContext={mockCtx} />);

    const tempoSlider = screen.getByRole('slider', { name: /playback tempo/i });
    const pitchSlider = screen.getByRole('slider', { name: /pitch shift/i });
    const resetBtn = screen.getByRole('button', { name: /reset time-stretch|reset pitch and tempo/i });
    const tempoLabel = screen.getByTestId('current-tempo-label');
    const pitchLabel = screen.getByTestId('current-pitch-label');

    // Alter tempo and pitch
    fireEvent.change(tempoSlider, { target: { value: '1.25' } });
    fireEvent.change(pitchSlider, { target: { value: '3' } });
    expect(tempoLabel).toHaveTextContent('1.25x');
    expect(pitchLabel).toHaveTextContent('+3 st');

    // Click Reset Time-Stretch
    fireEvent.click(resetBtn);

    expect(tempoLabel).toHaveTextContent('1.00x');
    expect(pitchLabel).toHaveTextContent('0 st');
    expect(tempoSlider).toHaveValue('1');
    expect(pitchSlider).toHaveValue('0');
  });
});
