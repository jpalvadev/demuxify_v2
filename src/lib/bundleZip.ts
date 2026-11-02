import JSZip from "jszip";
import { STEM_NAMES, StemName } from "./chunkOverlapAdd";

export interface CreateStemBundleOptions {
  sourceMixTitle?: string;
  format?: "wav" | "mp3";
  modelProfileId?: string;
  modelProfileName?: string;
  onProgress?: (percent: number) => void;
  // ADR-0010 Click Track lane: when the lane is enabled at export time, the
  // bundle gains exactly one extra Click Track file (already encoded WAV/MP3
  // bytes by the caller, same format as the Stems). Domain-separate: it is
  // never folded into the Stems set or the manifest's stem list, and when
  // absent the bundle is byte-for-byte as before.
  clickTrack?: Uint8Array | Blob;
}

/**
 * Strips file extensions and sanitizes characters that are illegal across modern file systems.
 */
export function sanitizeSourceMixTitle(
  title?: string,
  defaultTitle: string = "track"
): string {
  if (!title) return defaultTitle;
  const withoutExt = title.replace(/\.[a-zA-Z0-9]+$/, "").trim();
  const sanitized = withoutExt.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return sanitized || defaultTitle;
}

/**
 * Formats a clean stem filename: `<SourceMixTitle>_<stem>.<ext>`
 */
export function formatStemFileName(
  sourceMixTitle: string,
  stem: StemName,
  ext: "wav" | "mp3"
): string {
  const base = sanitizeSourceMixTitle(sourceMixTitle);
  return `${base}_${stem}.${ext}`;
}

/**
 * Formats the Click Track filename: `<SourceMixTitle>_click_track.<ext>`.
 * Separate from formatStemFileName: the Click Track is never a StemName.
 */
export function formatClickTrackFileName(
  sourceMixTitle: string,
  ext: "wav" | "mp3"
): string {
  const base = sanitizeSourceMixTitle(sourceMixTitle);
  return `${base}_click_track.${ext}`;
}

/**
 * Packages all 4 Stems (Vocals, Drums, Bass, Other) into a single ZIP archive,
 * plus one optional Click Track file when the Click Track lane was enabled.
 */
export async function createStemBundleZip(
  stemFiles: Record<StemName, Uint8Array | Blob>,
  options?: CreateStemBundleOptions
): Promise<Blob> {
  // Validate that all 4 stems are present
  for (const stem of STEM_NAMES) {
    if (!stemFiles || !stemFiles[stem]) {
      throw new Error(`Missing stem '${stem}' in stemFiles bundle.`);
    }
  }

  const title = options?.sourceMixTitle || "source_mix";
  const format = options?.format || "wav";
  const onProgress = options?.onProgress;

  const zip = new JSZip();

  for (const stem of STEM_NAMES) {
    const fileName = formatStemFileName(title, stem, format);
    const data = stemFiles[stem];
    zip.file(fileName, data);
  }

  // One Click Track file only when the lane was enabled at export time; the
  // Stems packaging contract above is untouched either way.
  if (options?.clickTrack) {
    zip.file(formatClickTrackFileName(title, format), options.clickTrack);
  }

  if (options?.modelProfileId || options?.modelProfileName) {
    const manifest = {
      sourceMixTitle: title,
      modelProfileId: options.modelProfileId,
      modelProfileName: options.modelProfileName,
      stems: STEM_NAMES,
      exportedAt: new Date().toISOString(),
    };
    zip.file("bundle_manifest.json", JSON.stringify(manifest, null, 2));
  }

  const zipBlob = await zip.generateAsync(
    {
      type: "blob",
      mimeType: "application/zip",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(metadata.percent);
    }
  );

  return zipBlob;
}
