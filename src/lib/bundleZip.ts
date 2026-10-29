import JSZip from 'jszip';
import { STEM_NAMES, StemName } from './chunkOverlapAdd';

export interface CreateStemBundleOptions {
  songTitle?: string;
  format?: 'wav' | 'mp3';
  onProgress?: (percent: number) => void;
}

/**
 * Strips file extensions and sanitizes characters that are illegal across modern file systems.
 */
export function sanitizeSongTitle(title?: string): string {
  if (!title) return 'track';
  const withoutExt = title.replace(/\.[a-zA-Z0-9]+$/, '').trim();
  const sanitized = withoutExt.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return sanitized || 'track';
}

/**
 * Formats a clean stem filename: `<SongTitle>_<stem>.<ext>`
 */
export function formatStemFileName(
  songTitle: string,
  stem: StemName,
  ext: 'wav' | 'mp3'
): string {
  const base = sanitizeSongTitle(songTitle);
  return `${base}_${stem}.${ext}`;
}

/**
 * Packages all 4 Stems (Vocals, Drums, Bass, Other) into a single ZIP archive.
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

  const songTitle = options?.songTitle || 'track';
  const format = options?.format || 'wav';
  const onProgress = options?.onProgress;

  const zip = new JSZip();

  for (const stem of STEM_NAMES) {
    const fileName = formatStemFileName(songTitle, stem, format);
    const data = stemFiles[stem];
    zip.file(fileName, data);
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(metadata.percent);
    }
  );

  return zipBlob;
}
