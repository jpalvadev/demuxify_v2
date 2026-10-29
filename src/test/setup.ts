import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  if (!window.PointerEvent) {
    window.PointerEvent = window.MouseEvent as any;
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }

  if (!window.Worker) {
    class MockWorker {
      url: string | URL;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      constructor(stringUrl: string | URL) {
        this.url = stringUrl;
      }
      postMessage(_data: any) {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    }
    window.Worker = MockWorker as any;
    (globalThis as any).Worker = MockWorker as any;
  }

  if (!window.AudioContext) {
    class MockAudioContext {
      currentTime = 0;
      state = 'running';
      destination = { connect: vi.fn(), disconnect: vi.fn() };
      resume = vi.fn().mockResolvedValue(undefined);
      suspend = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createGain() {
        const gainNode = {
          gain: {
            value: 1.0,
            setValueAtTime: vi.fn(function (this: any, val: number) {
              this.value = val;
            }),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        return gainNode;
      }
      createBufferSource() {
        return {
          buffer: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
      }
      createBuffer(channels: number, length: number, sampleRate: number) {
        const channelArrays = Array.from({ length: channels }, () => new Float32Array(length));
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: vi.fn((ch: number) => channelArrays[ch]),
          copyToChannel: vi.fn((src: Float32Array, ch: number) => {
            channelArrays[ch].set(src);
          }),
        };
      }
      decodeAudioData = vi.fn();
    }
    window.AudioContext = MockAudioContext as any;
  }

  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextType: string) {
      if (contextType === '2d') {
        return {
          canvas: this,
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          closePath: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          arc: vi.fn(),
          scale: vi.fn(),
          translate: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          fillText: vi.fn(),
          measureText: vi.fn().mockReturnValue({ width: 20 }),
          createLinearGradient: vi.fn().mockReturnValue({
            addColorStop: vi.fn(),
          }),
          setLineDash: vi.fn(),
          lineWidth: 1,
          fillStyle: '#000',
          strokeStyle: '#000',
          font: '10px sans-serif',
          textAlign: 'left',
          textBaseline: 'top',
        };
      }
      return null;
    } as any;
  }
}

