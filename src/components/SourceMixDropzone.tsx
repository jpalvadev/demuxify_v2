import React, { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Upload, Music2, FileAudio, CheckCircle2, X } from "lucide-react";
import { cn } from "../lib/utils";

interface SourceMixDropzoneProps {
  onSourceMixSelected: (file: File) => void;
  selectedFile: File | null;
  onClearFile?: () => void;
}

const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a"];
const SUPPORTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
  "audio/*",
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const SourceMixDropzone: React.FC<SourceMixDropzoneProps> = ({
  onSourceMixSelected,
  selectedFile,
  onClearFile,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onSourceMixSelected(file);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onSourceMixSelected(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        id="source-mix-input"
        aria-label="Select Source Mix file"
        accept={
          SUPPORTED_EXTENSIONS.join(",") + "," + SUPPORTED_MIME_TYPES.join(",")
        }
        className="sr-only"
        onChange={handleInputChange}
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200 select-none min-h-[280px]",
            isDragOver
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border bg-card/60 hover:border-primary/50 hover:bg-card/90"
          )}
        >
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <Music2 className="h-8 w-8" />
            <div className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1 text-primary-foreground shadow">
              <Upload className="h-3.5 w-3.5" />
            </div>
          </div>

          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            Drag and drop your Source Mix
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Load an unseparated audio recording to isolate{" "}
            <span className="text-foreground font-medium">Vocals</span>,{" "}
            <span className="text-foreground font-medium">Drums</span>,{" "}
            <span className="text-foreground font-medium">Bass</span>, and{" "}
            <span className="text-foreground font-medium">Other</span> stems.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBrowseClick();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Upload className="h-4 w-4" />
              <span>Browse Files</span>
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-secondary/80 px-2.5 py-1 font-mono">
              MP3
            </span>
            <span className="rounded-md bg-secondary/80 px-2.5 py-1 font-mono">
              WAV
            </span>
            <span className="rounded-md bg-secondary/80 px-2.5 py-1 font-mono">
              FLAC
            </span>
            <span className="rounded-md bg-secondary/80 px-2.5 py-1 font-mono">
              AAC
            </span>
            <span className="rounded-md bg-secondary/80 px-2.5 py-1 font-mono">
              OGG
            </span>
            <span className="text-muted-foreground/70">
              • 100% In-Browser &amp; Offline Ready
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <FileAudio className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-status-ok">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Loaded Source Mix
                  </span>
                </div>
                <h4 className="text-base font-semibold text-foreground truncate max-w-md">
                  {selectedFile.name}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(selectedFile.size)} •{" "}
                  {selectedFile.type || "audio/unknown"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBrowseClick}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Change
              </button>
              {onClearFile && (
                <button
                  type="button"
                  onClick={onClearFile}
                  aria-label="Remove Source Mix"
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
