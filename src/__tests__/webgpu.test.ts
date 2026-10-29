import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectWebGPUCapability } from '../lib/webgpu';

describe('detectWebGPUCapability', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('reports fallback mode when navigator.gpu is not available', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, gpu: undefined },
      configurable: true,
      writable: true,
    });

    const result = await detectWebGPUCapability();

    expect(result.supported).toBe(false);
    expect(result.isFallback).toBe(true);
    expect(result.errorReason).toMatch(/not supported/i);
  });

  it('reports fallback mode when requestAdapter returns null', async () => {
    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(null),
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, gpu: mockGpu },
      configurable: true,
      writable: true,
    });

    const result = await detectWebGPUCapability();

    expect(result.supported).toBe(false);
    expect(result.isFallback).toBe(true);
    expect(result.errorReason).toMatch(/no compatible webgpu adapter/i);
  });

  it('reports fallback mode when requestAdapter throws', async () => {
    const mockGpu = {
      requestAdapter: vi.fn().mockRejectedValue(new Error('GPU process crashed')),
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, gpu: mockGpu },
      configurable: true,
      writable: true,
    });

    const result = await detectWebGPUCapability();

    expect(result.supported).toBe(false);
    expect(result.isFallback).toBe(true);
    expect(result.errorReason).toMatch(/GPU process crashed/i);
  });

  it('reports fallback mode when requestDevice fails', async () => {
    const mockAdapter = {
      requestDevice: vi.fn().mockRejectedValue(new Error('Device creation failed')),
      info: { vendor: 'test-vendor', architecture: 'test-arch' },
    };
    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, gpu: mockGpu },
      configurable: true,
      writable: true,
    });

    const result = await detectWebGPUCapability();

    expect(result.supported).toBe(false);
    expect(result.isFallback).toBe(true);
    expect(result.errorReason).toMatch(/failed to initialize webgpu device/i);
  });

  it('reports supported and returns adapter info when WebGPU is fully operational', async () => {
    const mockDevice = {
      destroy: vi.fn(),
    };
    const mockAdapter = {
      requestDevice: vi.fn().mockResolvedValue(mockDevice),
      info: {
        vendor: 'NVIDIA',
        architecture: 'Ampere',
        device: 'RTX 3080',
        description: 'Direct3D12 backend',
      },
    };
    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, gpu: mockGpu },
      configurable: true,
      writable: true,
    });

    const result = await detectWebGPUCapability();

    expect(result.supported).toBe(true);
    expect(result.isFallback).toBe(false);
    expect(result.adapterInfo?.vendor).toBe('NVIDIA');
    expect(result.adapterInfo?.device).toBe('RTX 3080');
    expect(mockDevice.destroy).toHaveBeenCalled();
  });
});
