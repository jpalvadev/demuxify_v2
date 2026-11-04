/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Bold stem quartet (ticket 09): single identity set for chips,
        // canvases and strips, fed from the ticket 01 sheet's --stem-* vars.
        "stem-vocals": "hsl(var(--stem-vocals) / <alpha-value>)",
        "stem-drums": "hsl(var(--stem-drums) / <alpha-value>)",
        "stem-bass": "hsl(var(--stem-bass) / <alpha-value>)",
        "stem-other": "hsl(var(--stem-other) / <alpha-value>)",
        // Status hues (ticket 09 follow-up): sheet's --ok / --warn tokens.
        "status-ok": "hsl(var(--status-ok) / <alpha-value>)",
        "status-warn": "hsl(var(--status-warn) / <alpha-value>)",
        // Stitch Skin chrome ramp (ticket 01, ADR-0014): Tab Band + stage surfaces,
        // coral control ink, honest status hues, waveform canvas box.
        "st-canvas": "hsl(var(--st-canvas) / <alpha-value>)",
        "st-body": "hsl(var(--st-body) / <alpha-value>)",
        "st-panel": "hsl(var(--st-panel) / <alpha-value>)",
        "st-surface": "hsl(var(--st-surface) / <alpha-value>)",
        "st-surface-light": "hsl(var(--st-surface-light) / <alpha-value>)",
        "st-hairline": "hsl(var(--st-hairline) / <alpha-value>)",
        "st-highlight": "hsl(var(--st-highlight) / <alpha-value>)",
        "st-coral": "hsl(var(--st-coral) / <alpha-value>)",
        "st-coral-hover": "hsl(var(--st-coral-hover) / <alpha-value>)",
        "st-ink": "hsl(var(--st-ink) / <alpha-value>)",
        "st-ink-dim": "hsl(var(--st-ink-dim) / <alpha-value>)",
        "st-ink-faint": "hsl(var(--st-ink-faint) / <alpha-value>)",
        "st-ok": "hsl(var(--st-ok) / <alpha-value>)",
        "st-warn": "hsl(var(--st-warn) / <alpha-value>)",
        "st-waveform-box": "hsl(var(--st-waveform-box) / <alpha-value>)",
        // Mockup zinc gray palette (verbatim Stitch DESIGN TRUTH): Tailwind v3
        // ships no zinc scale, so every text-zinc-*/border-zinc-* utility the
        // skin ports from the mockup would die. These are the stock zinc hexes
        // the mock's own computed paint shows (zinc-200 #e4e4e7, 400 #a1a1aa,
        // 500 #71717a); the rest complete the scale for the skin's usages.
        zinc: {
          100: "#f0f0f3",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
        },
      },
      fontFamily: {
        // Bold pairing (ticket 01 sheet): Archivo Black display for
        // headings/branding, JetBrains Mono for readouts. woff2 subsets are
        // bundled in ticket 10; until then these fall back to the stacks.
        display: ['"Inter"', '"Archivo Black"', "Impact", "sans-serif"],
        sans: [
          '"Inter"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        // Stitch Skin (ticket 01): --radius retuned to 0.5rem on the sheet — one
        // uniform sweep replaces the grz-15 chrome-0 radii (`rounded-none` is
        // retired across the shell).
        default: "var(--radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Stitch Skin (06b): coral glow ported verbatim from the mockup
        // arbitrary shadows — chip glow on the ACTIVE Tab chip, mark glow
        // on the Brand Unit diamond, play glow on the Transport play chip.
        "chip-glow": "0 0 10px rgba(248, 81, 83, 0.4)",
        "mark-glow": "0 0 8px rgba(248, 81, 83, 0.8)",
        "play-glow": "0 0 16px rgba(248, 81, 83, 0.55)",
      },
    },
  },
  plugins: [],
};
