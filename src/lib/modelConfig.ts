/**
 * Centralized Model Registry and Device Profile Configuration
 *
 * Defines canonical Model Profiles (BS-RoFormer for Desktop, MDX-Net for Mobile/Fast),
 * device detection logic, and single-source-of-truth metadata.
 */

export type ModelId = "bs-roformer-4stem" | "mdx-net-4stem";

export type DeviceCategory = "desktop" | "mobile";

export type ModelArchitecture = "bs-roformer" | "mdx-net";

export interface ModelProfile {
  id: ModelId;
  name: string;
  shortName: string;
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

export const MDX_NET_PROFILE: ModelProfile = {
  id: "mdx-net-4stem",
  name: "MDX-Net 4-Stem",
  shortName: "Fast",
  deviceCategory: "mobile",
  explanation:
    "Lightweight, fast 4-stem separation model tailored for mobile devices and laptops. Prevents memory exhaustion and crashes on smartphones and tablets.",
  modelUrl: "/models/mdx_net_4stem_mobile.onnx",
  cacheName: "demuxify-mdxnet-cache-v1",
  estimatedSizeMb: 45,
  chunkDurationSec: 8.0,
  chunkOverlapSec: 1.0,
  architecture: "mdx-net",
  memoryRequirementDescription:
    "~45 MB model download; requires ~300 MB memory",
};

export const MODEL_PROFILES: Record<ModelId, ModelProfile> = {
  "bs-roformer-4stem": BS_ROFORMER_PROFILE,
  "mdx-net-4stem": MDX_NET_PROFILE,
};

export const DEFAULT_DESKTOP_MODEL_ID: ModelId = "bs-roformer-4stem";
export const DEFAULT_MOBILE_MODEL_ID: ModelId = "mdx-net-4stem";

/**
 * Retrieves a Model Profile by identifier. Falls back to default desktop model if not found.
 */
export function getModelProfile(id: ModelId | string): ModelProfile {
  if (id in MODEL_PROFILES) {
    return MODEL_PROFILES[id as ModelId];
  }
  return MODEL_PROFILES[DEFAULT_DESKTOP_MODEL_ID];
}

/**
 * Lists all registered Model Profiles.
 */
export function listModelProfiles(): ModelProfile[] {
  return Object.values(MODEL_PROFILES);
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
 * Mobile devices lock to MDX-Net to eliminate OOM crashes; desktop defaults to BS-RoFormer.
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
