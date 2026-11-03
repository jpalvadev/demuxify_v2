# Codebase Navigation Gotchas

- Rail controls pin DOM `data-testid` attributes across `src/__tests__` (e.g.
  `click-track-bpm-label`): grep `src/__tests__` for the id before touching or
  removing any rail control, or the suite breaks on an orphaned pin. `npm run
check:testids` gates that drift at commit time — every id a PRESENCE accessor
  (`getByTestId`/`getAllByTestId`/`findByTestId`/`findAllByTestId`) asks for must
  be rendered by some component. The ABSENCE half (`queryByTestId`,
  `queryAllByTestId`, `filterByTestId`) is exempt by construction: it names what
  must stay gone, which is what makes it the pin that proves a retirement held.
- The other half of the same rule is gated too: `npm run check:retired-affordances`
  bans a retired affordance from shipped code — the Click Track's accent/Downbeat
  axis (`docs/adr/0011-downbeat-reading-and-beat-grid-repair.md` Amendment: deleted
  symbols, the `meter` field, the rail's Meter selector and −/+ pair). Tests and
  comments are exempt, so the absence pins and the ADR history stay readable.
- When the suite goes red, `npm run test:report` gives a compact failure list —
  do not re-read raw vitest output (thousands of tokens of DOM dumps).
- To anchor an edit inside a 1,100+ line file in one call, `npm run outline`
  prints every declaration (state hooks included) with its line number.
