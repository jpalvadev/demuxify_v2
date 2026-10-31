# 01: OpenDesign Bold design run

**What to build:** A new OpenDesign project rendering the redesigned Tab Shell in the Bold identity — five tabs with a left rail on desktop and a top strip on mobile, near-black dark-only surfaces, one acid-lime signature accent, a high-contrast quartet of hues for the four Stems, heavyweight display headings, and a mono readout face. Verifiable by opening the OD preview URL; the run also produces a design sheet (palette values, type pairing, spacing/radius notes) recorded under `## Comments` of this ticket for the port tickets to copy from.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent (OD run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7` in flight)

- [ ] An OpenDesign project exists and its run succeeded using the Bold design-system plugin from the bundled catalog (no external MCPs).
- [ ] Preview shows five tabs (Separate, Listen, Mix, Export, System) with rail-on-desktop / strip-on-mobile responsive behavior.
- [ ] Design sheet appended to this ticket: near-black canvas values, acid-lime accent, Stem quartet hues, font pairing, heading/mono type notes.
- [ ] Dark-only: the preview has no light theme variant.

## Comments

- OpenDesign project `demuxify-tab-shell` (designSystem `bold`) created. Run `378f15f6-3cc6-404d-896e-f0f6a8aaf9e7` (requestId `0e57a1c2-8a17-4dbf-90b1-2f0a6e2e77d0`) launched with agent `opencode`, plugin `design-system-bold` — bundled catalog only, no paid services.
- Earlier attempts abandoned: `3747e186…` crashed (`--dir` flag rejected by local CLI v2.2.5); `51d7e136…` used the AMR cloud route and was rejected per the no-paid-services mandate.
- Fix for the local route (installed, do not revert): `C:\Users\Lorenzo06\AppData\Roaming\npm\opencode.cmd` now spawns `od-shim.mjs`, which strips `--dir <path>` and re-spawns `opencode.exe` with `cwd: <path>` (v2.2.5 takes the directory positionally). Verified locally before relaunching the real run.
- Studio URL (current daemon session): http://127.0.0.1:65294/projects/demuxify-tab-shell/conversations/43a2a4cf-246d-4fde-ba38-cae47abc3a02
