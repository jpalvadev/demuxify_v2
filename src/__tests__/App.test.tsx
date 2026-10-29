import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../App';
import * as webgpuModule from '../lib/webgpu';

describe('App UI Shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders application branding and header', async () => {
    vi.spyOn(webgpuModule, 'detectWebGPUCapability').mockResolvedValue({
      supported: true,
      isFallback: false,
      adapterInfo: { vendor: 'NVIDIA', device: 'RTX 3080' },
    });

    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/demuxify/i);
    expect(screen.getByText(/client-side stem separation/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });
  });

  it('shows WebGPU Active badge when hardware acceleration is available', async () => {
    vi.spyOn(webgpuModule, 'detectWebGPUCapability').mockResolvedValue({
      supported: true,
      isFallback: false,
      adapterInfo: { vendor: 'Apple', device: 'Apple M2' },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Fallback Mode (CPU)')).not.toBeInTheDocument();
  });

  it('shows Fallback Mode badge and advisory alert when WebGPU is unavailable', async () => {
    vi.spyOn(webgpuModule, 'detectWebGPUCapability').mockResolvedValue({
      supported: false,
      isFallback: true,
      errorReason: 'WebGPU is not supported in this browser.',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Fallback Mode (CPU)')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/WebGPU is not supported in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/running in cpu\/wasm fallback mode/i)).toBeInTheDocument();
  });

  it('renders the Source Mix dropzone ready to receive audio files', async () => {
    vi.spyOn(webgpuModule, 'detectWebGPUCapability').mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    expect(screen.getByText(/drag and drop your source mix/i)).toBeInTheDocument();
    expect(screen.getByText(/browse files/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });
  });

  it('updates UI when a Source Mix file is selected', async () => {
    vi.spyOn(webgpuModule, 'detectWebGPUCapability').mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });

    const file = new File(['dummy audio content'], 'song_master.mp3', { type: 'audio/mp3' });
    const fileInput = screen.getByLabelText(/select source mix file/i, { selector: 'input' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('song_master.mp3')).toBeInTheDocument();
      expect(screen.getByText(/loaded source mix/i)).toBeInTheDocument();
    });
  });

  it('toggles theme between dark and light', async () => {
    vi.spyOn(webgpuModule, 'detectWebGPUCapability').mockResolvedValue({
      supported: true,
      isFallback: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/webgpu active/i)).toBeInTheDocument();
    });

    const themeToggle = screen.getByRole('button', { name: /toggle theme/i });
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(themeToggle);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(themeToggle);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
