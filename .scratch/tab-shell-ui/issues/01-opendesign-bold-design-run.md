# 01: OpenDesign Bold design run

**What to build:** A new OpenDesign project rendering the redesigned Tab Shell in the Bold identity — five tabs with a left rail on desktop and a top strip on mobile, near-black dark-only surfaces, one acid-lime signature accent, a high-contrast quartet of hues for the four Stems, heavyweight display headings, and a mono readout face. Verifiable by opening the OD preview URL; the run also produces a design sheet (palette values, type pairing, spacing/radius notes) recorded under `## Comments` of this ticket for the port tickets to copy from.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] An OpenDesign project exists and its run succeeded using the Bold design-system plugin from the bundled catalog (no external MCPs).
- [x] Preview shows five tabs (Separate, Listen, Mix, Export, System) with rail-on-desktop / strip-on-mobile responsive behavior.
- [x] Design sheet appended to this ticket: near-black canvas values, acid-lime accent, Stem quartet hues, font pairing, heading/mono type notes.
- [x] Dark-only: the preview has no light theme variant.

## Answer

Run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7` **succeeded** (exit code 0, `deliverableValidation: valid`, syntax check `pass` with 0 diagnostics over `chk.js` + `demuxify-tab-shell.html`). OpenDesign project `demuxify-tab-shell`, designSystem `bold`, plugin `design-system-bold` (bundled catalog only), agent `opencode` via the local CLI shim.

- Preview URL: http://127.0.0.1:65282/api/projects/demuxify-tab-shell/raw/demuxify-tab-shell.html
- Studio URL: http://127.0.0.1:65294/projects/demuxify-tab-shell/conversations/43a2a4cf-246d-4fde-ba38-cae47abc3a02/files/demuxify-tab-shell.html
- Artifact: `demuxify-tab-shell.html` (66,485 bytes), kind html, manifest status complete.

Verified in the artifact: five always-pinned tabs (Separate / Listen / Mix / Export / System), desktop left rail + mobile top strip (System last) via responsive CSS, near-black dark-only canvas (no light variant, no theme toggle), Listen/Mix/Export greyed with "no stems yet" until inference completes, shared waveform spine (`data-od-id="sl-voc/dru/bas/oth"` with shared `xsl-*` transport bindings), inline export + diagnostics (no modals), rail-bottom toast stack, ≥44×44 segment-button targets.

## Design sheet (from the artifact's `data-od-id="design-sheet"` band — copy these in the port tickets)

Palette · exact HSL:

- `--bg hsl(232 12% 4%)` · `--surface hsl(232 10% 9%)` · `--surface-2 hsl(232 9% 13%)` · `--surface-3 hsl(232 8% 18%)`
- `--border hsl(232 12% 22%)` · `--border-soft hsl(232 10% 16%)`
- `--fg hsl(232 6% 96%)` · `--fg-2 hsl(232 6% 72%)` · `--muted hsl(232 6% 56%)`
- `--accent hsl(92 100% 58%)` acid lime · `--accent-on hsl(232 24% 6%)`
- Stem quartet: `--stem-vocals hsl(320 88% 64%)` · `--stem-drums hsl(264 84% 70%)` · `--stem-bass hsl(34 95% 60%)` · `--stem-other hsl(196 86% 62%)`
- `--ok hsl(140 72% 52%)` · `--warn hsl(48 95% 58%)` · `--err hsl(358 78% 62%)`

Typography: display Archivo Black / Archivo 800–900, tracking −2.5% (banners, tab heads, card titles); body Inter 400–600 at 16px / 1.52 (UI labels, copy); readouts JetBrains Mono 500–800, tabular tnum (time, dB, MB, logs).

Radius scale: 4px toasts/chips · 8px buttons/controls · 12px cards/panels · 9999px dots/sliders.
Spacing scale: 4 hairline gaps · 8 chip gap · 12 rail gap · 16 card pad x · 24 card pad y/section · 32 block rhythm · 48 sheet gutter max.
Type scale: 11 micro mono / mobile tab label · 13 card title · 16 body base · 24 time readout floor · 30 panel banner · 54 display max.

Hard contract: dark-only · no theme toggle · no modals / floating overlays anywhere · one action = one primary CTA · touch targets ≥ 44×44 · accent ≤ 2 focal spots per screen · stem hues reserved for waveform + stem chips only · rail: desktop vertical list, mobile top strip (System last) · toasts stack at rail bottom / below strip.

## Comments

- OpenDesign project `demuxify-tab-shell` (designSystem `bold`) created. Run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7` (requestId `0e57a1c2-8a17-4dbf-90b1-2f0a6e2e77d0`) launched with agent `opencode`, plugin `design-system-bold` — bundled catalog only, no paid services.
- Earlier attempts abandoned: `3747e186…` crashed (`--dir` flag rejected by local CLI v2.2.5); `51d7e136…` used the AMR cloud route and was rejected per the no-paid-services mandate.
- Fix for the local route (installed, do not revert): `C:\Users\Lorenzo06\AppData\Roaming\npm\opencode.cmd` now spawns `od-shim.mjs`, which strips `--dir <path>` and re-spawns `opencode.exe` with `cwd: <path>` (v2.2.5 takes the directory positionally). Verified locally before relaunching the real run.
- Inner-agent verification (from `agentMessage`): `node --check` SYNTAX_OK on the 22.7 KB script, 57 `data-od-id` ids → 0 unresolved, markup completeness list, one desktop + one mobile render pulled to check layout integrity. The design sheet band was authored into the artifact specifically for porting (tokens above copied verbatim from it).
