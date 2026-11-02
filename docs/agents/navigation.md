# Codebase Navigation Gotchas

- Rail controls pin DOM `data-testid` attributes across `src/__tests__` (e.g.
  `click-track-bpm-label`): grep `src/__tests__` for the id before touching or
  removing any rail control, or the suite breaks on an orphaned pin.
- When the suite goes red, `npm run test:report` gives a compact failure list —
  do not re-read raw vitest output (thousands of tokens of DOM dumps).
