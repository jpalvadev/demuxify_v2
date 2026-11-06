import { StemName, STEM_NAMES } from "./chunkOverlapAdd";
import { sanitizeSourceMixTitle } from "./bundleZip";
import type { StemMixerStates } from "./stemPlayerEngine";

export interface StemControlState {
  enabled: boolean;
  volume: number;
}

export type MixdownPresetId = "karaoke" | "acapella" | "minus_drums" | "reset";

export interface MixdownPresetConfig {
  id: MixdownPresetId;
  label: string;
}

export const MIXDOWN_PRESETS: MixdownPresetConfig[] = [
  { id: "karaoke", label: "Karaoke / Instrumental" },
  { id: "acapella", label: "Acapella" },
  { id: "minus_drums", label: "Minus Drums" },
  { id: "reset", label: "Reset" },
];

export const DEFAULT_STEM_CONTROLS: Record<StemName, StemControlState> = {
  vocals: { enabled: true, volume: 1.0 },
  drums: { enabled: true, volume: 1.0 },
  bass: { enabled: true, volume: 1.0 },
  other: { enabled: true, volume: 1.0 },
};

export function computeInitialStemControls(
  initialMixerStates?: StemMixerStates
): Record<StemName, StemControlState> {
  if (!initialMixerStates) {
    return DEFAULT_STEM_CONTROLS;
  }
  const hasAnySolo = STEM_NAMES.some((s) => initialMixerStates[s]?.solo);
  const controls: Record<StemName, StemControlState> = {} as any;
  for (const stem of STEM_NAMES) {
    const state = initialMixerStates[stem];
    const isHeard = state
      ? hasAnySolo
        ? Boolean(state.solo && !state.muted)
        : Boolean(!state.muted)
      : true;
    const vol = state ? state.volume : 1.0;
    controls[stem] = {
      enabled: isHeard,
      volume: vol,
    };
  }
  return controls;
}

export type MixdownDescriptor =
  "karaoke" | "instrumental" | "acapella" | "minus_drums" | "mixdown";

export interface MixdownDescriptorOptions {
  /** If true, returns "instrumental" instead of "karaoke" for stem mixes without vocals */
  preferInstrumental?: boolean;
}

export interface MixdownOptions {
  stemGains?: Partial<Record<StemName, number>>;
  masterGain?: number;
  antiClipping?: boolean;
  sourceMixTitle?: string;
  format?: "wav" | "mp3";
  preferInstrumental?: boolean;
}

export interface MixdownResult {
  audio: Float32Array[];
  peakAmplitude: number;
  normalized: boolean;
  scaleFactor: number;
  activeStems: StemName[];
  descriptor: MixdownDescriptor;
  fileName?: string;
}

export const MIXDOWN_SAFETY_CEILING_DB = -0.3;
export const MIXDOWN_SAFETY_CEILING_LINEAR = Math.pow(
  10,
  MIXDOWN_SAFETY_CEILING_DB / 20
); // ~0.96605088

function extractChannels(source: Float32Array[] | AudioBuffer): Float32Array[] {
  if ("numberOfChannels" in source) {
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < source.numberOfChannels; ch++) {
      channels.push(source.getChannelData(ch));
    }
    return channels;
  }
  return source;
}

/**
 * Resolves the semantic descriptor for an active stem combination:
 * - Vocals only: "acapella"
 * - Drums + Bass + Other (no vocals): "karaoke" (or "instrumental" if preferred)
 * - Vocals + Bass + Other (no drums): "minus_drums"
 * - All stems or any other combination: "mixdown"
 */
export function resolveMixdownDescriptor(
  activeStemsOrGains: StemName[] | Partial<Record<StemName, number | boolean>>,
  options?: MixdownDescriptorOptions
): MixdownDescriptor {
  let activeSet: Set<StemName>;

  if (Array.isArray(activeStemsOrGains)) {
    activeSet = new Set(
      activeStemsOrGains.filter((s) => STEM_NAMES.includes(s))
    );
  } else {
    activeSet = new Set();
    for (const name of STEM_NAMES) {
      const val = activeStemsOrGains[name];
      if (typeof val === "boolean" && val) {
        activeSet.add(name);
      } else if (typeof val === "number" && val > 0) {
        activeSet.add(name);
      }
    }
  }

  const hasVocals = activeSet.has("vocals");
  const hasDrums = activeSet.has("drums");
  const hasBass = activeSet.has("bass");
  const hasOther = activeSet.has("other");

  if (hasVocals && !hasDrums && !hasBass && !hasOther) {
    return "acapella";
  }

  if (!hasVocals && hasDrums && hasBass && hasOther) {
    return options?.preferInstrumental ? "instrumental" : "karaoke";
  }

  if (hasVocals && !hasDrums && hasBass && hasOther) {
    return "minus_drums";
  }

  return "mixdown";
}

/**
 * Formats a clean mixdown output filename: `<SourceMixTitle>_<descriptor>.<ext>`
 */
export function formatMixdownFileName(
  sourceMixTitle: string,
  descriptorOrStems:
    | MixdownDescriptor
    | StemName[]
    | Partial<Record<StemName, number | boolean>>,
  ext: "wav" | "mp3"
): string {
  const descriptor =
    typeof descriptorOrStems === "string"
      ? descriptorOrStems
      : resolveMixdownDescriptor(descriptorOrStems);

  const baseTitle = sanitizeSourceMixTitle(sourceMixTitle);
  return `${baseTitle}_${descriptor}.${ext}`;
}

/**
 * Mixes and sums multi-channel stems into a single audio buffer with individual gains,
 * master volume, and intelligent -0.3 dBFS anti-clipping normalization.
 */
export function mixAudioStems(
  stems: Record<StemName, Float32Array[] | AudioBuffer>,
  options: MixdownOptions = {}
): MixdownResult {
  const {
    stemGains,
    masterGain = 1.0,
    antiClipping = true,
    preferInstrumental = false,
  } = options;

  // Cache extracted channels and calculate effective gains once per stem
  const defaultGain = stemGains !== undefined ? 0.0 : 1.0;
  const resolvedStems: {
    name: StemName;
    gain: number;
    channels: Float32Array[];
  }[] = [];
  const activeStems: StemName[] = [];
  let channelCount = 0;
  let sampleLength = 0;

  for (const name of STEM_NAMES) {
    const rawGain = stemGains ? (stemGains[name] ?? defaultGain) : 1.0;
    const effectiveGain = rawGain * masterGain;
    const stemSource = stems[name];

    if (stemSource) {
      const channels = extractChannels(stemSource);
      if (channels.length > 0 && channels[0].length > 0) {
        if (channelCount === 0) {
          channelCount = channels.length;
          sampleLength = channels[0].length;
        }
        if (effectiveGain > 0) {
          activeStems.push(name);
          resolvedStems.push({ name, gain: effectiveGain, channels });
        }
      }
    }
  }

  // Allocate output channels
  const output: Float32Array[] = [];
  for (let ch = 0; ch < channelCount; ch++) {
    output.push(new Float32Array(sampleLength));
  }

  // Sum active stems into output
  for (const stem of resolvedStems) {
    for (let ch = 0; ch < channelCount; ch++) {
      const src = stem.channels[ch];
      const dest = output[ch];
      if (src && dest) {
        const len = Math.min(src.length, sampleLength);
        const gain = stem.gain;
        for (let i = 0; i < len; i++) {
          dest[i] += src[i] * gain;
        }
      }
    }
  }

  // Detect peak amplitude across all channels and samples
  let peak = 0;
  for (let ch = 0; ch < channelCount; ch++) {
    const channelData = output[ch];
    for (let i = 0; i < sampleLength; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) {
        peak = abs;
      }
    }
  }

  let normalized = false;
  let scaleFactor = 1.0;

  if (antiClipping && peak > MIXDOWN_SAFETY_CEILING_LINEAR && peak > 0) {
    scaleFactor = MIXDOWN_SAFETY_CEILING_LINEAR / peak;
    normalized = true;
    for (let ch = 0; ch < channelCount; ch++) {
      const channelData = output[ch];
      for (let i = 0; i < sampleLength; i++) {
        channelData[i] *= scaleFactor;
      }
    }
  }

  const descriptor = resolveMixdownDescriptor(activeStems, {
    preferInstrumental,
  });
  const fileName = options.sourceMixTitle
    ? formatMixdownFileName(
        options.sourceMixTitle,
        descriptor,
        options.format ?? "wav"
      )
    : undefined;

  return {
    audio: output,
    peakAmplitude: peak,
    normalized,
    scaleFactor,
    activeStems,
    descriptor,
    fileName,
  };
}
