// Bold identity type pairing (ticket 01 OpenDesign sheet: --font-display / --font-mono).
// Both faces are self-hosted as latin-subset woff2 (public/fonts/) declared with local
// @font-face rules in src/index.css, so nothing here can reach a CDN font service; the
// generic tails keep the Tailwind default sans as the fallback stack.
export const DISPLAY_FONT_STACK =
  '"Archivo Black", "Archivo", Impact, sans-serif';
export const MONO_FONT_STACK =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
