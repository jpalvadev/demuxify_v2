// Bold identity type pairing (ticket 01 OpenDesign sheet: --font-display / --font-mono).
// Both faces are self-hosted as latin-subset woff2 (public/fonts/) declared with local
// @font-face rules in src/index.css, so nothing here can reach a CDN font service; the
// generic tails keep the Tailwind default sans as the fallback stack.
export const DISPLAY_FONT_STACK = // Stitch Skin (ticket 01): Inter first; grz faces retired in ticket 01
  // Grizzlython pairing (grz-01): BlenderPro display grotesque with Diatype
  // behind it; Archivo Black stays in the fallback tail (ticket 10 seam).
  '"Inter", "Archivo Black", "Archivo", Impact, sans-serif';
export const MONO_FONT_STACK =
  // DSemi is the snapshot's semi-mono readout face (Diatype Semi-Mono).
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
