/**
 * Centralized Model Registry and Device Profile Configuration
 *
 * Defines canonical Model Profiles (BS-RoFormer for Desktop, HT-Demucs for Mobile/Fast),
 * device detection logic, and single-source-of-truth metadata.
 */

export type ModelId =
  | "bs-roformer-4stem"
  | "htdemucs-4stem"
  | "open-unmix-4stem"
  | "umx-4stem"
  | "mdx-net-4stem";

export type DeviceCategory = "desktop" | "mobile";

export type ModelArchitecture =
  "bs-roformer" | "htdemucs" | "open-unmix" | "mdx-net";

export interface ModelProfile {
  id: ModelId;
  name: string;
  shortName: string;
  tagline: string;
  deviceCategory: DeviceCategory;
  explanation: string;
  modelUrl: string;
  cacheName: string;
  estimatedSizeMb: number;
  chunkDurationSec: number;
  chunkOverlapSec: number;
  architecture: ModelArchitecture;
  memoryRequirementDescription: string;
}

export const BS_ROFORMER_PROFILE: ModelProfile = {
  id: "bs-roformer-4stem",
  name: "BS-RoFormer 4-Stem",
  shortName: "Studio",
  tagline: "Maximum acoustic isolation and studio fidelity",
  deviceCategory: "desktop",
  explanation:
    "Maximum acoustic isolation and studio-grade fidelity using BS-RoFormer neural network weights. Optimized for desktop workstations with WebGPU acceleration.",
  modelUrl: "/models/bs_roformer_4stem_webgpu.onnx",
  cacheName: "demuxify-roformer-cache-v1",
  estimatedSizeMb: 270,
  chunkDurationSec: 8.0,
  chunkOverlapSec: 1.0,
  architecture: "bs-roformer",
  memoryRequirementDescription:
    "~270 MB model download; requires ~1.5 GB memory",
};

export const HT_DEMUCS_PROFILE: ModelProfile = {
  id: "htdemucs-4stem",
  name: "HT-Demucs 4-Stem",
  shortName: "Balanced",
  tagline: "High-quality hybrid separation with balanced memory footprint",
  deviceCategory: "mobile",
  explanation:
    "High-quality hybrid transformer waveform separation model. Balanced quality and memory footprint (~54 MB) suitable for laptops and mobile devices.",
  modelUrl: "/models/htdemucs_4stem_mobile.onnx",
  cacheName: "demuxify-htdemucs-cache-v1",
  estimatedSizeMb: 54,
  chunkDurationSec: 6.0,
  chunkOverlapSec: 1.0,
  architecture: "htdemucs",
  memoryRequirementDescription:
    "~54 MB model download; requires ~300 MB memory",
};

export const OPEN_UNMIX_PROFILE: ModelProfile = {
  id: "open-unmix-4stem",
  name: "Open-Unmix 4-Stem",
  shortName: "Ultra Fast",
  tagline:
    "Instant separation (~50ms per chunk) optimized for mobile responsiveness",
  deviceCategory: "mobile",
  explanation:
    "Ultra-fast Bi-LSTM separation model tailored for mobile phones and low-latency client-side execution. Eliminates lag with instant processing (~50ms per chunk).",
  modelUrl: "/models/open_unmix_4stem_mobile.onnx",
  cacheName: "demuxify-openunmix-cache-v1",
  estimatedSizeMb: 35,
  chunkDurationSec: 6.0,
  chunkOverlapSec: 1.0,
  architecture: "open-unmix",
  memoryRequirementDescription:
    "~35 MB model download; requires ~150 MB memory",
};

// Backwards-compatible alias for legacy MDX-Net references
export const MDX_NET_PROFILE: ModelProfile = {
  ...HT_DEMUCS_PROFILE,
  id: "mdx-net-4stem",
};

export const UMX_PROFILE: ModelProfile = {
  ...OPEN_UNMIX_PROFILE,
  id: "umx-4stem",
};

export const MODEL_PROFILES: Record<ModelId, ModelProfile> = {
  "bs-roformer-4stem": BS_ROFORMER_PROFILE,
  "htdemucs-4stem": HT_DEMUCS_PROFILE,
  "open-unmix-4stem": OPEN_UNMIX_PROFILE,
  "umx-4stem": UMX_PROFILE,
  "mdx-net-4stem": MDX_NET_PROFILE,
};

export const ALL_MODEL_CACHE_NAMES = [
  BS_ROFORMER_PROFILE.cacheName,
  HT_DEMUCS_PROFILE.cacheName,
  OPEN_UNMIX_PROFILE.cacheName,
  "demuxify-mdxnet-cache-v1",
] as const;

export const DEFAULT_DESKTOP_MODEL_ID: ModelId = "bs-roformer-4stem";
export const DEFAULT_MOBILE_MODEL_ID: ModelId = "open-unmix-4stem";

/**
 * Resolves a Model Profile by identifier or model URL without magic strings.
 */
export function resolveModelProfile(idOrUrl?: string): ModelProfile {
  if (!idOrUrl) {
    return MODEL_PROFILES[DEFAULT_DESKTOP_MODEL_ID];
  }
  if (idOrUrl in MODEL_PROFILES) {
    return MODEL_PROFILES[idOrUrl as ModelId];
  }
  if (
    idOrUrl.toLowerCase().includes("unmix") ||
    idOrUrl.toLowerCase().includes("umx")
  ) {
    return OPEN_UNMIX_PROFILE;
  }
  if (idOrUrl.toLowerCase().includes("mdx")) {
    return HT_DEMUCS_PROFILE;
  }
  for (const profile of [
    BS_ROFORMER_PROFILE,
    HT_DEMUCS_PROFILE,
    OPEN_UNMIX_PROFILE,
  ]) {
    if (profile.modelUrl === idOrUrl || profile.cacheName === idOrUrl) {
      return profile;
    }
  }
  if (
    idOrUrl.toLowerCase().includes("demucs") ||
    idOrUrl.toLowerCase().includes("htdemucs")
  ) {
    return HT_DEMUCS_PROFILE;
  }
  return MODEL_PROFILES[DEFAULT_DESKTOP_MODEL_ID];
}

/**
 * Retrieves a Model Profile by identifier. Falls back to default desktop model if not found.
 */
export function getModelProfile(id: ModelId | string): ModelProfile {
  return resolveModelProfile(id);
}

/**
 * Lists all registered Model Profiles for presentation.
 */
export function listModelProfiles(): ModelProfile[] {
  return [BS_ROFORMER_PROFILE, HT_DEMUCS_PROFILE, OPEN_UNMIX_PROFILE];
}

/**
 * Detects whether the current device is a mobile phone or tablet based on user agent and touch capabilities.
 */
export function isMobileDevice(
  userAgent?: string,
  maxTouchPoints?: number
): boolean {
  const ua = (
    userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")
  ).toLowerCase();

  const touchPoints =
    maxTouchPoints ??
    (typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0);

  // Direct user-agent mobile matches
  const mobileRegex =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
  if (mobileRegex.test(ua)) {
    return true;
  }

  // Modern iPadOS Safari reports "Macintosh" user agent with touch points
  if (ua.includes("macintosh") && touchPoints > 1) {
    return true;
  }

  // Generic touch tablets/smartphones
  if (touchPoints > 1 && /tablet|touch/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Determines the default Model Profile for the active environment.
 * Mobile devices default to Open-Unmix (Ultra Fast) to eliminate lag and OOM crashes; desktop defaults to BS-RoFormer.
 */
export function getDefaultModelProfile(
  userAgent?: string,
  maxTouchPoints?: number
): ModelProfile {
  if (isMobileDevice(userAgent, maxTouchPoints)) {
    return MODEL_PROFILES[DEFAULT_MOBILE_MODEL_ID];
  }
  return MODEL_PROFILES[DEFAULT_DESKTOP_MODEL_ID];
}
