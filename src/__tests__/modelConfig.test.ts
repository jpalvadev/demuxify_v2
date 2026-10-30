import { describe, it, expect } from "vitest";
import {
  getModelProfile,
  listModelProfiles,
  isMobileDevice,
  getDefaultModelProfile,
  DEFAULT_DESKTOP_MODEL_ID,
  DEFAULT_MOBILE_MODEL_ID,
} from "../lib/modelConfig";

describe("Model Registry & Configuration", () => {
  it("provides comprehensive profile configuration for Studio (BS-RoFormer) model", () => {
    const profile = getModelProfile(DEFAULT_DESKTOP_MODEL_ID);
    expect(profile.id).toBe("bs-roformer-4stem");
    expect(profile.name).toBe("BS-RoFormer 4-Stem");
    expect(profile.shortName).toBe("Studio");
    expect(profile.deviceCategory).toBe("desktop");
    expect(profile.modelUrl).toContain("bs_roformer_4stem_webgpu.onnx");
    expect(profile.cacheName).toBe("demuxify-roformer-cache-v1");
    expect(profile.estimatedSizeMb).toBeGreaterThan(200);
    expect(profile.explanation).toBeDefined();
    expect(profile.explanation.length).toBeGreaterThan(10);
    expect(profile.memoryRequirementDescription).toContain("MB");
  });

  it("provides comprehensive profile configuration for Fast/Mobile (HT-Demucs) model", () => {
    const profile = getModelProfile(DEFAULT_MOBILE_MODEL_ID);
    expect(profile.id).toBe("htdemucs-4stem");
    expect(profile.name).toBe("HT-Demucs 4-Stem");
    expect(profile.shortName).toBe("Fast");
    expect(profile.deviceCategory).toBe("mobile");
    expect(profile.modelUrl).toContain("htdemucs_4stem_mobile.onnx");
    expect(profile.cacheName).toBe("demuxify-htdemucs-cache-v1");
    expect(profile.estimatedSizeMb).toBeLessThan(100);
    expect(profile.explanation).toBeDefined();
    expect(profile.explanation.length).toBeGreaterThan(10);
    expect(profile.memoryRequirementDescription).toContain("MB");
  });

  it("lists all available model profiles", () => {
    const profiles = listModelProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    const ids = profiles.map((p) => p.id);
    expect(ids).toContain("bs-roformer-4stem");
    expect(ids).toContain("htdemucs-4stem");
  });

  it("resolves legacy mdx-net-4stem requests to HT-Demucs", () => {
    const profile = getModelProfile("mdx-net-4stem");
    expect(profile.name).toBe("HT-Demucs 4-Stem");
  });

  it("falls back to default desktop model when unknown identifier is requested", () => {
    const fallback = getModelProfile("unknown-model-xyz");
    expect(fallback.id).toBe(DEFAULT_DESKTOP_MODEL_ID);
  });
});

describe("Device Detection & Default Model Resolution", () => {
  it("detects mobile phones from user-agent string", () => {
    const iPhoneUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
    const androidUA =
      "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36";

    expect(isMobileDevice(iPhoneUA, 5)).toBe(true);
    expect(isMobileDevice(androidUA, 5)).toBe(true);
  });

  it("detects tablets with touch capabilities", () => {
    const iPadUA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15";
    // Modern iPads report Mac OS X UA but have maxTouchPoints > 1
    expect(isMobileDevice(iPadUA, 5)).toBe(true);
  });

  it("classifies standard desktop browsers without touch as non-mobile", () => {
    const desktopChromeUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(isMobileDevice(desktopChromeUA, 0)).toBe(false);
  });

  it("resolves HT-Demucs 4-Stem as default profile on mobile devices", () => {
    const mobileUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
    const profile = getDefaultModelProfile(mobileUA, 5);
    expect(profile.id).toBe("htdemucs-4stem");
    expect(profile.deviceCategory).toBe("mobile");
  });

  it("resolves BS-RoFormer 4-Stem as default profile on desktop devices", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const profile = getDefaultModelProfile(desktopUA, 0);
    expect(profile.id).toBe("bs-roformer-4stem");
    expect(profile.deviceCategory).toBe("desktop");
  });
});
