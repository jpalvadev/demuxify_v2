import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceMixCard } from '../components/SourceMixCard';
import { SourceMixMetadata } from '../lib/audioDecoder';

describe('SourceMixCard', () => {
  const sampleMetadata: SourceMixMetadata = {
    fileName: 'super_track.mp3',
    fileSize: 10 * 1024 * 1024, // 10 MB
    duration: 215.5, // 3m 35s
    sampleRate: 44100,
    numberOfChannels: 2,
  };

  it('renders audio metadata: filename, duration, sample rate, channels, file size', () => {
    render(<SourceMixCard metadata={sampleMetadata} />);

    expect(screen.getByText('super_track.mp3')).toBeInTheDocument();
    // 215.5 seconds = 03:35 (or 3:35)
    expect(screen.getByText(/3:35/)).toBeInTheDocument();
    // 44.1 kHz
    expect(screen.getByText(/44\.1\s*kHz/i)).toBeInTheDocument();
    // Stereo
    expect(screen.getByText(/Stereo/i)).toBeInTheDocument();
    // 10 MB
    expect(screen.getByText(/10\.00\s*MB|10\s*MB/i)).toBeInTheDocument();
  });

  it('displays Mono for 1-channel audio', () => {
    const monoMetadata: SourceMixMetadata = {
      ...sampleMetadata,
      numberOfChannels: 1,
    };
    render(<SourceMixCard metadata={monoMetadata} />);

    expect(screen.getByText(/Mono/i)).toBeInTheDocument();
  });

  it('triggers onStartSeparation when clicking the primary action button', () => {
    const onStartSeparation = vi.fn();
    render(
      <SourceMixCard
        metadata={sampleMetadata}
        onStartSeparation={onStartSeparation}
      />
    );

    const startBtn = screen.getByRole('button', { name: /separate stems|start separation/i });
    expect(startBtn).toBeInTheDocument();
    fireEvent.click(startBtn);

    expect(onStartSeparation).toHaveBeenCalledTimes(1);
  });

  it('disables primary button when isProcessing is true', () => {
    const onStartSeparation = vi.fn();
    render(
      <SourceMixCard
        metadata={sampleMetadata}
        isProcessing={true}
        onStartSeparation={onStartSeparation}
      />
    );

    const startBtn = screen.getByRole('button', { name: /separate stems|start separation|separating/i });
    expect(startBtn).toBeDisabled();
    fireEvent.click(startBtn);
    expect(onStartSeparation).not.toHaveBeenCalled();
  });

  it('triggers onRemove and onChangeFile callbacks', () => {
    const onRemove = vi.fn();
    const onChangeFile = vi.fn();

    render(
      <SourceMixCard
        metadata={sampleMetadata}
        onRemove={onRemove}
        onChangeFile={onChangeFile}
      />
    );

    const removeBtn = screen.getByRole('button', { name: /remove|remove source mix/i });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);

    const changeBtn = screen.getByRole('button', { name: /change/i });
    fireEvent.click(changeBtn);
    expect(onChangeFile).toHaveBeenCalledTimes(1);
  });
});
