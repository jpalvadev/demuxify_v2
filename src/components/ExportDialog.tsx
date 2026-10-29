import React, { useState, useCallback, useEffect } from "react";
import {
  X,
  Download,
  FileArchive,
  Music,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { StemName, STEM_NAMES } from "../lib/chunkOverlapAdd";
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
import { toast } from "../lib/toast";
import { cn } from "../lib/utils";

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stems: Record<StemName, Float32Array[] | AudioBuffer>;
  sampleRate?: number;
  sourceMixTitle?: string;
  onExportComplete?: (fileName: string) => void;
}

export type ExportMode = "single" | "bundle";
export type ExportFormat = "wav" | "mp3";

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

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  stems,
  sampleRate = 44100,
  sourceMixTitle = "source_mix",
  onExportComplete,
}) => {
  const [mode, setMode] = useState<ExportMode>("single");
  const [selectedStem, setSelectedStem] = useState<StemName>("vocals");
  const [format, setFormat] = useState<ExportFormat>("wav");
  const [bitDepth, setBitDepth] = useState<16 | 24>(16);
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(192);

  // Export execution state
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(
    null
  );

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

  // Reset notifications on opening or changing mode
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessNotification(null);
      setProgress(0);
      setStatusMessage("");
    }
  }, [isOpen]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);
    setSuccessNotification(null);

    try {
      if (mode === "single") {
        setStatusMessage(`Encoding ${selectedStem}...`);
        const stemData = stems[selectedStem];
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
      } else {
        // Full Export Bundle (ZIP)
        setStatusMessage("Encoding all 4 stems for bundle packaging...");
        const encodedStems: Record<StemName, Uint8Array> = {} as any;

        const stemCount = STEM_NAMES.length;
        for (let i = 0; i < stemCount; i++) {
          const stemName = STEM_NAMES[i];
          const stemData = stems[stemName];
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
    onExportComplete,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => {
        if (!isExporting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
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
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all disabled:opacity-50"
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
            <div className="grid grid-cols-2 gap-3">
              <label
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
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
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  <span className="text-sm">Single Stem</span>
                </div>
              </label>

              <label
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
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
                <div className="flex items-center gap-2">
                  <FileArchive className="h-4 w-4 text-primary" />
                  <span className="text-sm">Full Export Bundle</span>
                </div>
              </label>
            </div>
          </div>

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
                className="w-full rounded-xl border border-border bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 capitalize"
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

          {/* Format Selector: WAV vs MP3 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Audio Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
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
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
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
                className="w-full rounded-xl border border-border bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                className="w-full rounded-xl border border-border bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {VALID_MP3_BITRATES.map((br) => (
                  <option
                    key={br}
                    value={br}
                    className="bg-card text-foreground"
                  >
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
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
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
                className="h-2 w-full overflow-hidden rounded-full bg-secondary"
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
              className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successNotification}</span>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
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
            className="px-4 py-2 text-sm font-medium rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
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
      </div>
    </div>
  );
};
