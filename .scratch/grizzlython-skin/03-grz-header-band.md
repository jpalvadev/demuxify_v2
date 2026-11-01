# grz-03: Separate-tab header rebuild (the "Separate Music Into Stems" banner)

Status: resolved

## Question

User report (1440×900 screenshot, desktop Separate tab): the stage opens with a
big sentence-case display title "Separate Music Into Stems" floating over a
full-bleed coral hero band that fades out downward with a dashed bottom edge.
The user says this header "does not belong to the style or design of the app":
it reads as a generic marketing banner, it is the only gradient-washed element
in an otherwise flat matte Grizzlython chrome, and the huge title collides with
the wash so the ink smears coral-on-coral.

Fix: redesign the Separate-tab header zone (title + subtitle + hero band) to
belong to the skin, per ADR-0007 via an OpenDesign run, then port it into
`src/App.tsx` / `src/index.css` without touching engine logic.

## OpenDesign mandate (ADR-0007)

- Project `grizzlython-skin` (plugin `design-system-bold`, agent `opencode`, no paid services).
- Run 1 `e469b814-359c-465d-be3c-dfe46b30da63` (requestId `9db8e234-2f0a-4c46-a3c1-9a35f9e5b2d7`):
  status succeeded but `artifactCount:0` / `deliverableValid:false` (`no_artifact`) —
  inner agent echoed its plan without writing (same failure mode as grz-01 run 1).
- Run 2 `7223629b-0ac2-4c0f-871a-1aac538fde8d` (requestId `c7e13d5b-47f6-41e4-b58a-9d02f38a6c49`,
  same plugin/agent/project): expected artifact `separate-header-grizzly.html`
  (archive in this directory once done).
- Run 2 also DELIVERABLE_MISSING (`artifactCount:0`): opencode CLI "default" is now
  the local strata quant (swift-1.5-iq3_xxs) which echoes `<tool_call>` XML as
  text_delta instead of native tool calls (events.jsonl shows one text_delta + exit 0).
- Run 3 `b8f9b7fe-832a-47e7-8a49-7e4729ab8821` (requestId `41e07c93-55b2-47d0-8de2-b9c49a7c1f22`,
  agent `amr` / model `deepseek-v4.1-flash` default-enabled, plugin `design-system-bold`):
  expected artifact `separate-header-grizzly.html`.
- Run 3 (AMR) failed: `failureAction:"recharge"` (AMR Cloud balance insufficient;
  recharge at https://open-design.ai/cloud/dashboard?source=open_design).
- Run 4 `146cce81-78e7-487a-aa13-c298fc3a6bd1` (requestId `f2b64910-61aa-4b7e-90a6-4f2b8c57d311`,
  agent `opencode`, model `anthropic/claude-sonnet-4-5`): expected artifact
  `separate-header-grizzly.html`.
- Run 4 failed: `Model unavailable` (`switch_model`) — the opencode CLI has only an
  LM Studio entry in auth and LM Studio is gone; no credentials at all.
- Run 5 `49295980-5b30-411c-8a58-74ec340bec59` (requestId `0a37f19d-8e44-4cb1-97b2-51c40b3e9a76`,
  NEW project `separate-header-grizzly` (design system `bold`, fresh native session
  — run 2 had resumed a polluted CLI thread), agent `opencode` default model,
  plugin `design-system-bold`): expected artifact `separate-header-grizzly.html`
  in that project, archived here after.
- Run 5 ALSO DELIVERABLE_MISSING (`artifactCount:0` / `no_artifact`). A new OD run is
  blocked on this machine: the local opencode CLI default (strata `swift-1.5-iq3_xxs`)
  cannot emit native tool calls, AMR balance is 0 (no top-up allowed), and there are
  no provider credentials (LM Studio no longer exists). Resolution proceeds as a
  faithful RE-PORT from the existing artifact truth above (ADR-0007 allows this when
  the view is already covered by existing artifacts).
- User re-enabled the local OpenCode CLI bridge in the OpenDesign UI ("OpenCode ·
  Open-source agent CLI v2.2.5", personalized model id `strata/swift-1.5-iq3_xxs`):
  the daemon spawned `opencode run` with a deprecated `--pure` flag (rejected by
  v2.2.5, "Unrecognized flag: --pure"). Fixed the `od-shim.mjs` wrapper in
  `%APPDATA%\Roaming\npm\node_modules\@opencode\cli\bin` (already stripped `--dir`;
  now also strips `--pure`), and re-pointed the bash/PowerShell npm shims to route
  through the shim. Probe passed ("OpenCode responded — 'ok'").
- Run 6 `07ae708d-035b-476f-beb2-2579d1d94c5f` (requestId `6c1f0b22-7d84-4fa3-90b1-9c2d3e4f5a61`,
  agent `opencode`, personalized model typed as `qwen3.8-flash--next-coder-iql_m`):
  failed `Invalid model reference: qwen3.8-flash-next-coder-iq1_m` (retry) — the CLI
  needs `provider/model` form; corrected by user to `strata/swift-1.5-iq3_xxs`.
- Run 7 `bbe57c53-2f3f-4524-8dee-701c1b7a4b17` (requestId `d3b94c17-2f5a-4b08-93c7-1e6c8051a7f2`,
  agent `opencode`, model `strata/swift-1.5-iq3_xxs`, plugin `design-system-bold`,
  project `separate-header-grizzly`): expected artifact `separate-header-grizzly.html`.
  SUCCEEDED — `artifactCount:1`, `separate-header-grizzly.html` 26229 B (plus two self-rendered
  previews, `preview-header.png` / `preview-header-v2.png`). Artifact archived in this directory
  as `separate-header-grizzly.html` (byte-identical copy from the project dir on disk).

## Truth refs (existing artifacts)

- `separate-header-grizzly.html` (run 7, THE PORT TRUTH): desktop header = chamfered hairline card;
  hero band `--band-desk: 40px` SOLID coral, flat, no fade, no dashed edge, carrying ONLY a 9px
  ink mono tagline (`tracking 0.14em`) + a 6×12 ink tick; seam under the band is `1px solid var(--hair)`;
  title is the card's FIRST line under the seam — 22px / line box 26 / `0.06em` UPPERCASE cream;
  meta mono 10px / `0.14em` tan-2 with a PEACH pip; subtitle body copy 15px / 23px cream,
  measure 660px. Rhythm `40 · 1 · 16 · 26 · 12 · 13 · 14 · 46 · 20` → card 188px, 20px gap →
  content card. Mobile: `--band-mob: 44px` coral 100% → coral-0 gradient strip with NO type and a
  `1px dashed` tan seam; title 15px / line box 18 / `0.07em`; rhythm `44 · 1 · 14 · 18 · 6 · 11 · 10 · 60 · 14`,
  18px gap. Rejected ledger: full-bleed band under the title, desktop downward fade, dashed edge on
  the DESKTOP band, sentence-case 30px title floating on a wash, subtitle riding on the band.
- `grizzlython-skin.html` (desktop, grz-01): hero is a SOLID red block carrying only a small black
  mono `hero-tag`; the big h2 lives inside the chamfered hairline card, not over the band.
- `mobile-shell-grizzly.html` (grz-02): card `::before` is a slim 44px red→0 fade with dashed tan
  hairline; the title is compact uppercase display (15px, cream) INSIDE the hairline card.
- Tailwind hints in the sheet use shadcn utilities (`h-10`/`h-11` band, `bg-coral`, `border-hairline`,
  `font-display`/`font-mono`, `tracking-[0.06em]`/`[0.14em]`, `max-w-[660]`). The app's token names map
  coral → `bg-primary`, ink-on-coral → `text-background`/`bg-background` (canvas #161515), cream →
  `text-foreground`, tan-2 → `text-muted-foreground`, peach pip → `text-status-ok`
  (`tailwind.config.js:48`).

## Answer

FINAL: port of the run-7 OpenDesign artifact `separate-header-grizzly.html` (project
`separate-header-grizzly`, plugin `design-system-bold`, agent `opencode`, model
`strata/swift-1.5-iq3_xxs`). The earlier two-pass re-port below is kept as history and is
SUPERSEDED by this one — the run-7 sheet moved the title OFF the coral band (it is the card's
first line under the seam) and gave the band only mono ink micro-copy.

Port (`src/App.tsx`, Separate Tab header section only; engine logic and shell untouched):

- Band: now IN-FLOW (the absolute full-bleed overlay that caused the paint-order bug is gone),
  `grizzly-hero-strip h-11 sm:h-10` = 44px mobile / 40px desktop, `flex items-center justify-between
gap-6 px-3.5 sm:px-4`. The CSS rule in `src/index.css` is the responsive pair the sheet asks for:
  mobile `linear-gradient(180deg, coral 0% → coral-0 100%)`, desktop `hsl(var(--primary))` FLAT SOLID
  inside `@media (min-width: 640px)` (declared outside the utility layer so a `sm:bg-primary` utility
  can never lose to it, and vice-versa).
- Band content: mobile carries NO type (`hidden` below sm); desktop carries the 9px ink mono tagline
  `In-browser · nothing uploaded` (`text-background` = canvas ink on coral) plus the 6×12 ink tick
  (`w-1.5 h-3 bg-background`) — the rail chip's `bg-primary` + cream pairing, flipped.
- Seam: `border-t-[1px] border-dashed sm:border-solid border-muted-foreground/60` on the copy block
  — dashed tan hairline on mobile, SOLID tan hairline desktop (the sheet keeps the dash only on the
  mobile strip). Note: Tailwind v3.4 has no `border-b-1`/`border-t-px` width step, so the seam uses
  the arbitrary `border-t-[1px]` form (verified by compiling the probe classes).
- Title (h2, copy unchanged): `font-display text-[15px] leading-[18px] tracking-[0.07em]
sm:text-[22px] sm:leading-[26px] sm:tracking-[0.06em] uppercase text-foreground` — the card's first
  line of type, cream on canvas, never riding on the coral.
- Meta line added per the sheet: `HT-DEMUCS 4-STEM · local onnx` as mono 10px / `0.14em` /
  `text-muted-foreground` with the separator as `text-status-ok` peach pip (line box 11px mobile,
  13px desktop).
- Subtitle: cream body copy `text-[13px] leading-[20px] sm:text-[15px] sm:leading-[23px]
sm:max-w-[660px]`, `mt-2.5 sm:mt-3.5` below the meta line, `pb-4.5 sm:pb-5` giving the 18/20px gap
  to the content card.
- Rhythm matches the sheet: 40 · 1 · 16 · 26 · 12 · 13 · 14 · 46 · 20 (desktop) and
  44 · 1 · 14 · 18 · 6 · 11 · 10 · 60 · 14 (mobile).

Verified visually (headless Chrome 1440×900 and 390×844 against the live dev server,
`header_desk_v4.png` / `header_mob_v4.png`): desktop shows the slim solid coral rule with ink mono
tagline + tick, solid seam, then the UPPERCASE tracked cream title, peach-pipped mono meta line and
two-line cream subtitle; mobile shows the 44px coral→0 strip with no type, dashed seam, compact
15px uppercase title, meta line and three-line body copy. `typecheck`, `check:glossary` and 290/290
vitest all pass. (Pre-existing horizontal overflow at the 390 window is unchanged from the earlier
screenshots and is out of scope here.)

---

History (superseded two-pass re-port, no OD run — runs 1–5 were blocked as recorded above):

Pass 1 kept the old `grizzly-hero-fade` mask; the user saw the header content pushed under a band
that read as "missing". Root cause in pass 2 was paint order: the h2 was UNPOSITIONED static text
while the band div was `absolute`, so the coral band (plus its mask) painted ON TOP of the title,
and the mask (`black 10% → transparent 100%` over the 44px box) erased the coral and the dashed
hairline. Pass 2 fixed it by making the h2 `relative` and keeping a SOLID `bg-primary h-11` band
with the title riding ON it — the interim treatment that satisfied the user's complaint but is
replaced by the run-7 sheet above.

## Comments

- Reported by user 2026-11-01 with screenshot; header text and semantic
  heading (h2, region label) must stay; subtitle copy "Extract Vocals, Drums,
  Bass, and Other instruments locally in your browser using neural network
  models." must stay present and readable.

---

## Addendum: band re-home into the System Tab (grz-11/13/15/18, 2026-11-01)

The app's Grizzly header band was re-homed as chrome of the System Tab (four-tab
shell increment, ADR-0008). No new OpenDesign run: the band is a re-home of existing
run-7 chrome (removals-only exception per ADR-0008), restyled with the new ramp.

- **grz-11 — `src/lib/grizzly.ts`**: the two marks as data + names. `grz01` (Demuxer:
  round wide-set ears, broad snout, lowered brows, carries nothing) and `grz02` (Mixer:
  smaller closer ears, one cocked brow, narrower muzzle, carries a machete). `faceElements`
  emits paint-ordered SVG primitives (tags + attrs, 100×100 viewBox); `grzNames` gives the
  accessible names used by the band's `aria-label`s ("grz-01 — Demuxer grizzly…",
  "grz-02 — Mixer grizzly…"). Presentation attributes can't read CSS vars, so the marks
  inline the same snapshot hex the `--color-grizzly-*` tokens name.
- **grz-13 — System-Tab band + 2 faces**: the band renders ONLY while `activeTab === "system"`
  (`data-testid="header-band"`), a bordered in-flow strip — never a modal, never a wash —
  carrying the h2 Tab title flanked by two `data-testid="header-band-face"` spans with the
  grz-11 aria-labels. When another Tab is the active stage panel the plain h3 + intro returns.
- **grz-15 — chrome-0 radius everywhere, incl. the band**: `tailwind.config.js` maps bare
  `rounded` → `var(--radius)` (which is 0), and the remaining bare `rounded` classes in
  DiagnosticsPanel/ExportDialog/FallbackAdvisory/MasterWaveform/SeparationProgress were
  swept to explicit `rounded-none`. `StemPlayer.tsx` untouched (config default covers its
  lone `rounded`).
- **grz-18 — rail chrome-0 + hairline + grz-600 border**: Tab rail chips and the nav
  divider now read `border border-grz-600/40` with `rounded-none`; app-level test asserts
  no corner class + hairline on every rail entry.

Tokens: `--grz-01` coral · `--grz-02` cream · `--grz-03` tan · `--grz-04` ink ·
`--grz-05` peach · `--grz-600` deep red, in `:root` with `hsl(var(--grz-N) / <alpha-value>)`
palette keys so `border-grz-600/40` compiles. App-level seam: grz-13 band test (band only in
System Tab, chrome not dialog, 2 faces named) + grz-18 rail test; 291/291 vitest green.
