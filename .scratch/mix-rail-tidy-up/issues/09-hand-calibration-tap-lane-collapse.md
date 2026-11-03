# 09: Hand Calibration collapses from bordered card to thin lane

**What to build:** the **Hand Calibration** surface stops eating a third of the fold while idle. It welds directly under the **Master Waveform** spine — same width, same time axis — and collapses from a bordered card to a thin lane: one mono micro-line of instruction copy plus its Confirm and Reset buttons, nothing more. Tapping stays a gesture against the axis the user can already see. The surface's DOM identity survives the collapse intact: the strip, readout, confirm and reset testids all keep resolving, so the rail-tidy-up gate stays honest; only the card look (its height default, its outer padding and border rhythm) reduces. The **Hand Calibration** decision itself is untouched — the four-tap contract, the honest rejections and the "calibrated by hand" honesty of the lane readout all stay exactly as shipped (this is the collapse of the _surface_, not a change to the decision).

**Blocked by:** 06 (the **Hand Calibration** tool/decision pairing is recorded in the GLOSSARY before the surface collapses; no other ticket gates this one).

**Status:** ready-for-agent

- [ ] The tap lane reads as a thin lane on the spine's width and time axis, welded under the spine in the composed Mix stage; its card look (height default, outer padding, border rhythm) is gone — asserted through the component's class tokens at the DOM seam.
- [ ] Exactly one mono micro-line of instruction copy, with Confirm and Reset surviving as the existing square-button family.
- [ ] All four testids survive the collapse: strip, readout, confirm, reset — `npm run check:testids` presence pins still resolve with nothing added and nothing retired.
- [ ] The decision contract untouched: taps, confirm, refusal readouts and the re-anchor through the same re-lock machinery stay green at the existing calibration seams without edits.
- [ ] Look is agent-authored: OpenDesign MCP answered nothing this session (documented dead-MCP fallback) — the collapsed lane's look recorded here, the same route the tap strip's own ticket already took.
