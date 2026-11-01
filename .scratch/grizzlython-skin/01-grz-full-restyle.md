# grz-01: Full Grizzlython restyle (whole app)

Status: resolved

## Question

Full visual restyle of the Demuxify app to match the Wayback snapshot
`https://web.archive.org/web/20230713095318/https://solana.com/grizzlython`
(Solana Grizzlython, July 2023), done unattended and verified via screenshots

- vision against the reference.

## OpenDesign mandate (ADR-0007)

- Project `grizzlython-skin` (Bold design-system plugin catalog, local `opencode`
  agent, no paid services).
- Run 1 `cc2e4785-13f6-466b-9b70-bdbe23f9d828`: succeeded with `artifactCount:0`
  (inner agent echoed `<od-done>` without writing) → DELIVERABLE_MISSING.
- Run 2 `77a26d2f-c8f5-4116-a2a0-5a0b3d0d6c8d` (requestId `d18be5a2-2c47-4f86-9a1e-7c02b8e41f6d`):
  SUCCEEDED, artifact `grizzlython-skin.html` (26.7 KB) — archived in this
  directory at `.scratch/grizzlython-skin/grizzlython-skin.html` as the port
  source of truth.

## Answer

Skin ported; screenshots vision-matched against `grizzly_ref.png`. Engine,
persistence and export logic untouched.

- `src/index.css`: identity tokens lifted verbatim from the snapshot's own CSS
  (black #161515 · cream #eae7dd · tan #979385 · peach #f1b994 · coral #ef474a ·
  deep red #c12f2f), retuned onto the shadcn HSL triplets (`--background`,
  `--primary`, …); `--radius: 0`; status roles → peach (ok) / deep red (warn);
  8 local `@font-face`s (Diatype 400/500/700, DSemi 400/500/700, BlenderPro
  Book/Bold) bundled from the snapshot's own `im_` woff2 URLs into
  `public/fonts/grizzly/`; legacy Archivo/JetBrains subsets removed from dist.
  Component chrome: `.grizzly-grid` (32px canvas grid), `.grizzly-hero-fade`
  (mask), `.grizzly-pulse`.
- `src/lib/typography.ts` + `tailwind.config.js`: BlenderPro display / Diatype
  body+`font-sans` / DSemi mono; Archivo Black + JetBrains Mono kept in the
  fallback tails only, so the ticket 10 css-asserted font seam
  (`/Archivo Black/`, `/JetBrains Mono/`) stays green.
- `src/App.tsx`: canvas grid on the shell root; rail labels uppercase 0.2em
  tracked tan-2; ACTIVE rail tab is a solid coral chip with cream ink
  (`bg-primary text-primary-foreground border-primary`, compact `md:w-full`
  rows); active stage card → tan hairline zero-radius; coral hero band
  (fading, dashed edge) behind the Separate stage top; footer deep-red
  gradient band; every `rounded-*` utility → `rounded-none` across App +
  all 17 components (zero-radius flat chrome).
- `src/components/Header.tsx`: brand status dot → square pulsing coral chip.

Verified: `tsc --noEmit`, `check:glossary`, `vitest` 290/290 (jsdom class-token
contracts, stage invariant, font seam all green); headless-Chrome screenshots
1440×900 and 390×844 vision-compared to `grizzly_ref.png` (grid, hero, chips,
rail tabs, footer fade, wordmark all matching).

## Comments

- Snapshot fonts come from the snapshot itself (`im_` URLs, offline-first rule
  honored: zero CDN URLs in dist).
- `text-primary` was the trap: with `primary: {DEFAULT, foreground}` the cream
  ink utility is `text-primary-foreground`; the first pass rendered coral-on-coral
  labels, fixed in the follow-up patch.
- OD daemon had to be revived via `ELECTRON_RUN_AS_NODE=1` + the app's own
  Electron exe (better-sqlite3 ABI 145 vs 137 with system node).
