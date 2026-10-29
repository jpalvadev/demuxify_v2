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

