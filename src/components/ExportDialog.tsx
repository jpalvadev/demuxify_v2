import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  Download,
  FileArchive,
  Music,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
  Mic,
  Drum,
  Radio,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { StemName, STEM_NAMES } from "../lib/chunkOverlapAdd";
import { StemMixerStates, TimeStretchState } from "../lib/stemPlayerEngine";
import { encodeWav, createWavBlob } from "../lib/wavEncoder";
import {
  encodeMp3,
  createMp3Blob,
  Mp3Bitrate,
  VALID_MP3_BITRATES,
} from "../lib/mp3Encoder";
import {
  createStemBundleZip,
  formatStemFileName,
  sanitizeSourceMixTitle,
} from "../lib/bundleZip";
import { mixAudioStems, formatMixdownFileName } from "../lib/customMixdown";
import { renderOfflineStems } from "../lib/signalsmithStretchAdapter";
import { toast } from "../lib/toast";
import { cn } from "../lib/utils";

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stems: Record<StemName, Float32Array[] | AudioBuffer>;
  sampleRate?: number;
  sourceMixTitle?: string;
  initialMixerStates?: StemMixerStates;
  initialMasterVolume?: number;
  onExportComplete?: (fileName: string) => void;
  activeTimeStretch?: TimeStretchState;
  activeTempo?: number;
  activePitch?: number;
  activeFormantPreservation?: boolean;
}

export type ExportMode = "single" | "bundle" | "mixdown";
export type ExportFormat = "wav" | "mp3";

export interface StemControlState {
  enabled: boolean;
  volume: number;
}

export type MixdownPresetId = "karaoke" | "acapella" | "minus_drums" | "reset";

export interface MixdownPresetConfig {
  id: MixdownPresetId;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export const MIXDOWN_PRESETS: MixdownPresetConfig[] = [
  { id: "karaoke", label: "Karaoke / Instrumental" },
  { id: "acapella", label: "Acapella" },
  { id: "minus_drums", label: "Minus Drums" },
  { id: "reset", label: "Reset", icon: RotateCcw },
];

const DEFAULT_STEM_CONTROLS: Record<StemName, StemControlState> = {
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

const STEM_ICONS: Record<
  StemName,
  React.ComponentType<{ className?: string }>
> = {
  vocals: Mic,
  drums: Drum,
  bass: Radio,
  other: Music,
};

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  stems,
  sampleRate = 44100,
  sourceMixTitle = "source_mix",
  initialMixerStates,
  initialMasterVolume,
  onExportComplete,
  activeTimeStretch,
  activeTempo: propTempo,
  activePitch: propPitch,
  activeFormantPreservation: propFormant,
}) => {
  const activeTempo = activeTimeStretch?.tempo ?? propTempo;
  const activePitch = activeTimeStretch?.pitch ?? propPitch;
  const activeFormantPreservation =
    activeTimeStretch?.formantPreservation ?? propFormant;

  const [mode, setMode] = useState<ExportMode>("single");
  const [selectedStem, setSelectedStem] = useState<StemName>("vocals");
  const [format, setFormat] = useState<ExportFormat>("wav");
  const [bitDepth, setBitDepth] = useState<16 | 24>(16);
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(192);

  const hasActiveAdjustments =
    (activeTempo !== undefined && Math.abs(activeTempo - 1.0) >= 0.01) ||
    (activePitch !== undefined && Math.abs(activePitch) >= 1);

  const [applyAdjustments, setApplyAdjustments] =
    useState<boolean>(hasActiveAdjustments);

  // Custom Mixdown state
  const [stemControls, setStemControls] = useState<
    Record<StemName, StemControlState>
  >(() => computeInitialStemControls(initialMixerStates));
  const [masterGain, setMasterGain] = useState<number>(
    initialMasterVolume ?? 1.0
  );
  const [antiClipping, setAntiClipping] = useState<boolean>(true);

  // Export execution state
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(
    null
  );

  const isMixdownExportDisabled =
    mode === "mixdown" &&
    !STEM_NAMES.some(
      (s) => stemControls[s].enabled && stemControls[s].volume > 0
    );

  const handleApplyPreset = (preset: MixdownPresetId) => {
    switch (preset) {
      case "karaoke":
        setStemControls({
          vocals: { enabled: false, volume: 0 },
          drums: { enabled: true, volume: 1.0 },
          bass: { enabled: true, volume: 1.0 },
          other: { enabled: true, volume: 1.0 },
        });
        break;
      case "acapella":
        setStemControls({
          vocals: { enabled: true, volume: 1.0 },
          drums: { enabled: false, volume: 0 },
          bass: { enabled: false, volume: 0 },
          other: { enabled: false, volume: 0 },
        });
        break;
      case "minus_drums":
        setStemControls({
          vocals: { enabled: true, volume: 1.0 },
          drums: { enabled: false, volume: 0 },
          bass: { enabled: true, volume: 1.0 },
          other: { enabled: true, volume: 1.0 },
        });
        break;
      case "reset":
        setStemControls(DEFAULT_STEM_CONTROLS);
        setMasterGain(1.0);
        setAntiClipping(true);
        break;
    }
  };

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isExporting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  const prevOpenRef = useRef(false);

  // Reset notifications & sync mixer settings on opening
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setError(null);
      setSuccessNotification(null);
      setProgress(0);
      setStatusMessage("");
      setStemControls(computeInitialStemControls(initialMixerStates));
      setMasterGain(initialMasterVolume ?? 1.0);
      setApplyAdjustments(hasActiveAdjustments);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialMixerStates, initialMasterVolume, hasActiveAdjustments]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);
    setSuccessNotification(null);

    try {
      let exportStems = stems;
      if (applyAdjustments && hasActiveAdjustments) {
        setStatusMessage("Applying active pitch and tempo adjustments...");
        let stemsToRender: Partial<
          Record<StemName, Float32Array[] | AudioBuffer>
        > = stems;
        if (mode === "single") {
          stemsToRender = { [selectedStem]: stems[selectedStem] };
        } else if (mode === "mixdown") {
          stemsToRender = {};
          for (const name of STEM_NAMES) {
            if (stemControls[name]?.enabled) {
              stemsToRender[name] = stems[name];
            }
          }
        }
        const rendered = await renderOfflineStems(stemsToRender as any, {
          sampleRate,
          tempo: activeTempo ?? 1.0,
          pitch: activePitch ?? 0,
          formantPreservation: activeFormantPreservation ?? true,
        });
        exportStems = { ...stems, ...rendered };
      }

      if (mode === "single") {
        setStatusMessage(`Encoding ${selectedStem}...`);
        const stemData = exportStems[selectedStem];
        if (!stemData) {
          throw new Error(`Stem "${selectedStem}" is not available.`);
        }
        const channels = extractChannels(stemData);
        let blob: Blob;
        let fileName: string;

        if (format === "wav") {
          setProgress(30);
          blob = createWavBlob(channels, { sampleRate, bitDepth });
          fileName = formatStemFileName(sourceMixTitle, selectedStem, "wav");
          setProgress(100);
        } else {
          blob = await createMp3Blob(channels, {
            sampleRate,
            bitrate,
            onProgress: (p) => setProgress(Math.round(p * 100)),
          });
          fileName = formatStemFileName(sourceMixTitle, selectedStem, "mp3");
          setProgress(100);
        }

        setStatusMessage("Triggering download...");
        triggerDownload(blob, fileName);
        const successMsg = `Export complete! Downloaded ${fileName}`;
        setSuccessNotification(successMsg);
        toast.success(successMsg);
        onExportComplete?.(fileName);
      } else if (mode === "bundle") {
        // Full Export Bundle (ZIP)
        setStatusMessage("Encoding all 4 stems for bundle packaging...");
        const encodedStems: Record<StemName, Uint8Array> = {} as any;

        const stemCount = STEM_NAMES.length;
        for (let i = 0; i < stemCount; i++) {
          const stemName = STEM_NAMES[i];
          const stemData = exportStems[stemName];
          if (!stemData) {
            throw new Error(`Stem "${stemName}" is missing from stems set.`);
          }
          const channels = extractChannels(stemData);
          setStatusMessage(`Encoding ${stemName} (${i + 1}/${stemCount})...`);

          if (format === "wav") {
            encodedStems[stemName] = encodeWav(channels, {
              sampleRate,
              bitDepth,
            });
            setProgress(Math.round(((i + 1) / stemCount) * 75));
          } else {
            const startPct = (i / stemCount) * 75;
            const rangePct = 75 / stemCount;
            encodedStems[stemName] = await encodeMp3(channels, {
              sampleRate,
              bitrate,
              onProgress: (subP) => {
                setProgress(Math.round(startPct + subP * rangePct));
              },
            });
          }
        }

        setStatusMessage("Packaging ZIP bundle...");
        const zipBlob = await createStemBundleZip(encodedStems, {
          sourceMixTitle,
          format,
          onProgress: (zipPct) => {
            setProgress(Math.round(75 + zipPct * 0.25));
          },
        });

        const zipFileName = `${sanitizeSourceMixTitle(sourceMixTitle)}_stems.zip`;
        setStatusMessage("Triggering download...");
        triggerDownload(zipBlob, zipFileName);
        const successMsg = `Export complete! Downloaded ${zipFileName}`;
        setSuccessNotification(successMsg);
        toast.success(successMsg);
        onExportComplete?.(zipFileName);
      } else {
        // Custom Mixdown
        setStatusMessage("Summing stems & applying mixdown...");
        const stemGains: Partial<Record<StemName, number>> = {};
        for (const name of STEM_NAMES) {
          const ctrl = stemControls[name];
          stemGains[name] = ctrl.enabled ? ctrl.volume : 0;
        }

        const mixResult = mixAudioStems(exportStems, {
          stemGains,
          masterGain,
          antiClipping,
          sourceMixTitle,
          format,
        });

        let blob: Blob;
        const fileName =
          mixResult.fileName ||
          formatMixdownFileName(sourceMixTitle, mixResult.descriptor, format);

        if (format === "wav") {
          setProgress(30);
          blob = createWavBlob(mixResult.audio, { sampleRate, bitDepth });
          setProgress(100);
        } else {
          blob = await createMp3Blob(mixResult.audio, {
            sampleRate,
            bitrate,
            onProgress: (p) => setProgress(Math.round(p * 100)),
          });
          setProgress(100);
        }

        setStatusMessage("Triggering download...");
        triggerDownload(blob, fileName);
        const successMsg = `Export complete! Downloaded ${fileName}`;
        setSuccessNotification(successMsg);
        toast.success(successMsg);
        onExportComplete?.(fileName);
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : String(err);
      setError(errText);
      toast.error(errText);
    } finally {
      setIsExporting(false);
    }
  }, [
    mode,
    selectedStem,
    format,
    bitDepth,
    bitrate,
    stems,
    sampleRate,
    sourceMixTitle,
    stemControls,
    masterGain,
    antiClipping,
    onExportComplete,
    applyAdjustments,
    hasActiveAdjustments,
    activeTempo,
    activePitch,
    activeFormantPreservation,
  ]);

  if (!isOpen) return null;

  return (
    <section
      role="region"
      aria-labelledby="export-dialog-title"
      className="w-full rounded-none border border-border bg-card p-6 sm:p-8 space-y-6 relative"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-primary/10 border border-primary/20 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="export-dialog-title"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              Export Audio Stems
            </h2>
            <p className="text-xs text-muted-foreground">
              Save isolated stems as pristine WAV or compressed MP3 files
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={isExporting}
          className="rounded-none p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Form Body */}
      <div className="space-y-5">
        {/* Export Mode Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Export Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label
              className={cn(
                "flex items-center gap-2.5 p-3 rounded-none border cursor-pointer transition-all",
                mode === "single"
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
              )}
            >
              <input
                type="radio"
                name="export-mode"
                value="single"
                checked={mode === "single"}
                onChange={() => setMode("single")}
                disabled={isExporting}
                className="accent-primary"
              />
              <div className="flex items-center gap-1.5 truncate">
                <Music className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs sm:text-sm font-medium truncate">
                  Single Stem
                </span>
              </div>
            </label>

            <label
              className={cn(
                "flex items-center gap-2.5 p-3 rounded-none border cursor-pointer transition-all",
                mode === "bundle"
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
              )}
            >
              <input
                type="radio"
                name="export-mode"
                value="bundle"
                checked={mode === "bundle"}
                onChange={() => setMode("bundle")}
                disabled={isExporting}
                className="accent-primary"
              />
              <div className="flex items-center gap-1.5 truncate">
                <FileArchive className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs sm:text-sm font-medium truncate">
                  Full Export Bundle
                </span>
              </div>
            </label>

            <label
              className={cn(
                "flex items-center gap-2.5 p-3 rounded-none border cursor-pointer transition-all",
                mode === "mixdown"
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
              )}
            >
              <input
                type="radio"
                name="export-mode"
                value="mixdown"
                checked={mode === "mixdown"}
                onChange={() => setMode("mixdown")}
                disabled={isExporting}
                className="accent-primary"
              />
              <div className="flex items-center gap-1.5 truncate">
                <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs sm:text-sm font-medium truncate">
                  Custom Mixdown
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Active Pitch & Tempo Adjustments Checkbox */}
        {hasActiveAdjustments && (
          <div className="flex items-center justify-between p-3 rounded-none border border-border/80 bg-secondary/40">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyAdjustments}
                onChange={(e) => setApplyAdjustments(e.target.checked)}
                disabled={isExporting}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                aria-label="Apply active Pitch & Tempo adjustments"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Apply active Pitch & Tempo adjustments
                </span>
                <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-none border border-primary/20">
                  {[
                    activePitch !== undefined && activePitch !== 0
                      ? `${activePitch > 0 ? "+" : ""}${activePitch} st`
                      : null,
                    activeTempo !== undefined && activeTempo !== 1.0
                      ? `${activeTempo.toFixed(2)}x`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Stem Selector (Visible only in Single Stem mode) */}
        {mode === "single" && (
          <div className="space-y-1.5">
            <label
              htmlFor="stem-select"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Select Stem
            </label>
            <select
              id="stem-select"
              aria-label="Select Stem"
              value={selectedStem}
              onChange={(e) => setSelectedStem(e.target.value as StemName)}
              disabled={isExporting}
              className="w-full rounded-none border border-border bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 capitalize"
            >
              {STEM_NAMES.map((stem) => (
                <option
                  key={stem}
                  value={stem}
                  className="capitalize bg-card text-foreground"
                >
                  {stem}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Custom Mixdown Controls (Visible only in Custom Mixdown mode) */}
        {mode === "mixdown" && (
          <div className="space-y-4">
            {/* Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mixdown Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MIXDOWN_PRESETS.map((preset) => {
                  const PresetIcon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      disabled={isExporting}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-none border border-border bg-secondary/50 text-foreground hover:bg-secondary hover:border-primary/40 active:scale-95 transition-all text-center disabled:opacity-50"
                    >
                      {PresetIcon && <PresetIcon className="h-3 w-3" />}
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stem Controls: Checkboxes & Volume Sliders */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stem Controls
              </label>
              <div className="space-y-2 rounded-none border border-border bg-secondary/20 p-3">
                {STEM_NAMES.map((stem) => {
                  const Icon = STEM_ICONS[stem];
                  const { enabled, volume } = stemControls[stem];
                  return (
                    <div
                      key={stem}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-none transition-colors",
                        enabled
                          ? "bg-card/70 border border-border/50"
                          : "opacity-50 bg-secondary/30"
                      )}
                    >
                      <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 w-24">
                        <input
                          type="checkbox"
                          aria-label={`${stem} stem`}
                          checked={enabled}
                          onChange={(e) =>
                            setStemControls((prev) => ({
                              ...prev,
                              [stem]: {
                                ...prev[stem],
                                enabled: e.target.checked,
                              },
                            }))
                          }
                          disabled={isExporting}
                          className="accent-primary h-4 w-4 rounded cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-semibold capitalize text-foreground">
                            {stem}
                          </span>
                        </div>
                      </label>

                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={volume}
                          onChange={(e) =>
                            setStemControls((prev) => ({
                              ...prev,
                              [stem]: {
                                ...prev[stem],
                                volume: parseFloat(e.target.value),
                              },
                            }))
                          }
                          aria-label={`${stem} volume`}
                          disabled={!enabled || isExporting}
                          className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-none appearance-none disabled:opacity-50"
                        />
                        <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
                          {Math.round((enabled ? volume : 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Master Volume and Anti-Clipping controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5 rounded-none border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    Master Volume
                  </span>
                  <span className="font-mono text-muted-foreground font-semibold">
                    {Math.round(masterGain * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={masterGain}
                  onChange={(e) => setMasterGain(parseFloat(e.target.value))}
                  aria-label="Master Mixdown Volume"
                  disabled={isExporting}
                  className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-none appearance-none"
                />
              </div>

              <div className="flex items-center rounded-none border border-border bg-secondary/20 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="anti-clipping-toggle"
                    aria-label="Anti-Clipping Protection"
                    checked={antiClipping}
                    onChange={(e) => setAntiClipping(e.target.checked)}
                    disabled={isExporting}
                    className="accent-primary h-4 w-4 rounded mt-0.5 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-status-ok" />
                      <span>Anti-Clipping Protection</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      Automatic -0.3 dBFS safety ceiling prevents digital
                      clipping
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Format Selector: WAV vs MP3 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Audio Format
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={cn(
                "flex items-center gap-3 p-3 rounded-none border cursor-pointer transition-all",
                format === "wav"
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
              )}
            >
              <input
                type="radio"
                name="export-format"
                value="wav"
                checked={format === "wav"}
                onChange={() => setFormat("wav")}
                disabled={isExporting}
                className="accent-primary"
              />
              <div>
                <div className="text-sm">WAV</div>
                <div className="text-[11px] text-muted-foreground">
                  Lossless PCM
                </div>
              </div>
            </label>

            <label
              className={cn(
                "flex items-center gap-3 p-3 rounded-none border cursor-pointer transition-all",
                format === "mp3"
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
              )}
            >
              <input
                type="radio"
                name="export-format"
                value="mp3"
                checked={format === "mp3"}
                onChange={() => setFormat("mp3")}
                disabled={isExporting}
                className="accent-primary"
              />
              <div>
                <div className="text-sm">MP3</div>
                <div className="text-[11px] text-muted-foreground">
                  Compressed MPEG-1
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Sub-Format Options */}
        {format === "wav" ? (
          <div className="space-y-1.5">
            <label
              htmlFor="bit-depth-select"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Bit Depth
            </label>
            <select
              id="bit-depth-select"
              aria-label="Bit Depth"
              value={bitDepth}
              onChange={(e) =>
                setBitDepth(parseInt(e.target.value, 10) as 16 | 24)
              }
              disabled={isExporting}
              className="w-full rounded-none border border-border bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="16" className="bg-card text-foreground">
                16-bit PCM (CD Standard)
              </option>
              <option value="24" className="bg-card text-foreground">
                24-bit PCM (Studio Studio High-Res)
              </option>
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label
              htmlFor="bitrate-select"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              MP3 Bitrate
            </label>
            <select
              id="bitrate-select"
              aria-label="Bitrate"
              value={bitrate}
              onChange={(e) =>
                setBitrate(parseInt(e.target.value, 10) as Mp3Bitrate)
              }
              disabled={isExporting}
              className="w-full rounded-none border border-border bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {VALID_MP3_BITRATES.map((br) => (
                <option key={br} value={br} className="bg-card text-foreground">
                  {br} kbps{" "}
                  {br === 320
                    ? "(Maximum Quality)"
                    : br === 192
                      ? "(Balanced)"
                      : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Progress Indicator (Visible while exporting or upon recent progress) */}
        {(isExporting || (progress > 0 && !error)) && (
          <div className="space-y-2 rounded-none border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-primary font-medium">
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-ok" />
                )}
                {statusMessage || "Encoding..."}
              </span>
              <span className="font-mono text-primary font-bold">
                {progress}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-none bg-secondary"
            >
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Notification */}
        {successNotification && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-none border border-status-ok/30 bg-status-ok/10 p-3.5 text-xs text-status-ok"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successNotification}</span>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-none border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Export failed: {error}</span>
          </div>
        )}
      </div>

      {/* Dialog Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isExporting}
          className="px-4 py-2 text-sm font-medium rounded-none border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all disabled:opacity-50"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || isMixdownExportDisabled}
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-none bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Export &amp; Download</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
};
