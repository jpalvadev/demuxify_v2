# 03: Toast surface dies — notices render inline in their owning Tab

**What to build:** nothing floats over the Tab Shell anymore. Gated Tab taps become a silent no-op, and every export outcome announces itself **inline in the Export Tab** at the surface the user acted on. The notice mechanism behind the scenes stays usable; only its floating DOM surface and its rail placement die.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] No toast notice container anywhere: not in the Tab Rail, not over the stage, not at the rail bottom on mobile.
- [ ] Tapping a grayscaled Mix/Export Tab before Stems exist is a silent no-op — the chip's reason line is the whole answer, and no notice element is produced.
- [ ] Export success (Export Bundle and Custom Mixdown paths) renders one inline mono micro line under the inline Export panel, with the peach status pip.
- [ ] Cancelled encoding renders the same inline line in tan with no pip, saying nothing was written.
- [ ] Failed export keeps the existing inline alert-card treatment inside the Export Tab and keeps alert semantics for assistive tech.
- [ ] Hard failures elsewhere (decode failure, WebGPU fallback advisory) keep their existing inline treatment — no regression, no relocation.
- [ ] Notice mechanism tests (the manager's own seam) stay green untouched; only the DOM-surface tests shrink and the Export Dialog seam retargets from toast emission to inline result.
- [ ] No notice stack visible in desktop or mobile screenshots.
