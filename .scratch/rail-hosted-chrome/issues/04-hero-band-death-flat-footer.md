# 04: Chrome deaths — Separate-Tab hero band and the red footer gradient

**What to build:** the two remaining chrome surfaces the user called "awful" go flat. The Separate Tab opens directly on its title zone — no coral hero band above it, no "in-browser · nothing uploaded" state copy anywhere — and the page ends on a flat footer with a single tan hairline instead of a 2px red rule over a red gradient slab.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The hero strip is gone at both breakpoints: the Separate Tab opens on its seam, the UPPERCASE Tab title, the peach-pipped mono meta line, and the subtitle copy — the run-7 title-zone rhythm and typography stay exactly as already ported.
- [ ] The "in-browser · nothing uploaded" copy appears nowhere in any Tab panel or chrome at any viewport.
- [ ] Footer keeps its two centered micro lines but drops the gradient background and the 2px warn-colored rule, reading instead with one tan hairline like the rail dividers.
- [ ] Footer stays width-constrained so narrow viewports do not widen the document again.
- [ ] The System Tab's own grizzly band chrome (title flanked by the two marks) is untouched — the deletion is the Separate Tab's hero band and the page footer only.
- [ ] Deep-red identity hue survives only where it means "alert", which is why the footer rule moves to the tan hairline token.
- [ ] Verified with desktop and mobile screenshots and the existing footer/rail contract assertions.
