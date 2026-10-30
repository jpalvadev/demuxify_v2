export interface WebGPUAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

export interface WebGPUCapability {
  supported: boolean;
  isFallback: boolean;
  adapterInfo?: WebGPUAdapterInfo;
  errorReason?: string;
}

/**
 * Detects whether WebGPU is supported and available on the current browser and hardware.
 * Probes navigator.gpu, adapter, and device initialization.
 * Returns clear capability state and fallback reasons if unsupported.
 */
export async function detectWebGPUCapability(): Promise<WebGPUCapability> {
  const nav = typeof navigator !== "undefined" ? (navigator as any) : undefined;
  if (!nav || !nav.gpu) {
    return {
      supported: false,
      isFallback: true,
      errorReason:
        "WebGPU is not supported in this browser. Running in CPU/WASM fallback mode.",
    };
  }

  let adapter: any;
  try {
    adapter = await nav.gpu.requestAdapter();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      supported: false,
      isFallback: true,
      errorReason: `WebGPU adapter error: ${message}. Running in CPU/WASM fallback mode.`,
    };
  }

  if (!adapter) {
    return {
      supported: false,
      isFallback: true,
      errorReason:
        "No compatible WebGPU adapter found on your hardware. Running in CPU/WASM fallback mode.",
    };
  }

  let device: any;
  try {
    device = await adapter.requestDevice();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      supported: false,
      isFallback: true,
      errorReason: `Failed to initialize WebGPU device: ${message}. Running in CPU/WASM fallback mode.`,
    };
  }

  // Safely extract adapter info if available
  let adapterInfo: WebGPUAdapterInfo | undefined;
  if (adapter.info) {
    adapterInfo = {
      vendor: adapter.info.vendor,
      architecture: adapter.info.architecture,
      device: adapter.info.device,
      description: adapter.info.description,
    };
  } else if (typeof adapter.requestAdapterInfo === "function") {
    try {
      const info = await adapter.requestAdapterInfo();
      adapterInfo = {
        vendor: info?.vendor,
        architecture: info?.architecture,
        device: info?.device,
        description: info?.description,
      };
    } catch {
      // Non-fatal if info probe fails
    }
  }

  // Release the probe device so we don't hold resources
  if (device && typeof device.destroy === "function") {
    try {
      device.destroy();
    } catch {
      // Ignore cleanup error
    }
  }

  // Qualcomm Adreno mobile GPUs have known driver compiler deadlocks with RoFormer WGSL shaders.
  // Fall back cleanly to CPU/WASM to prevent hanging the browser.
  const isAdreno = /qualcomm|adreno/i.test(
    `${adapterInfo?.vendor || ""} ${adapterInfo?.description || ""} ${adapterInfo?.architecture || ""}`
  );

  if (isAdreno) {
    return {
      supported: false,
      isFallback: true,
      adapterInfo,
      errorReason:
        "Qualcomm Adreno GPU detected. Automatically switched to CPU/WASM mode to bypass mobile GPU driver lockups.",
    };
  }

  return {
    supported: true,
    isFallback: false,
    adapterInfo,
  };
}
