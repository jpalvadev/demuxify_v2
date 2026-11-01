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
      },
      fontFamily: {
        // Bold pairing (ticket 01 sheet): Archivo Black display for
        // headings/branding, JetBrains Mono for readouts. woff2 subsets are
        // bundled in ticket 10; until then these fall back to the stacks.
        display: [
          '"BlenderPro"',
          '"Diatype"',
          '"Archivo Black"',
          "Impact",
          "sans-serif",
        ],
        sans: [
          '"Diatype"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"DSemi"',
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
