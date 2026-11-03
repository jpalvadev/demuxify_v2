import * as fs from "fs";
import * as path from "path";

// Guardrail: a RETIRED affordance may not come back. The accent/Downbeat axis
// of the Click Track is deleted end to end (docs/adr/0011-downbeat-reading-
// and-beat-grid-repair.md, Amendment: `pickDownbeatPhase` and friends gone,
// `ClickTrackMixerState` lost its `meter` field, the rail lost its Meter
// selector and −/+ pair), and the only thing keeping it gone used to be prose
// an agent had to re-grep by hand on every diff. This makes that a per-commit
// gate.
//
// The ban list is deliberately NARROW: the retired axis' vocabulary is live
// elsewhere (`SeparationPhase` for the separation worker, the `accent-primary`
// utility class, "bold accent" waveform colours), so word-level bans would
// false-positive. Only these are banned, and only in shipped code:
//   - the `downbeat` word anywhere            (nothing in src/ is Downbeat-
//                                              shaped anymore)
//   - a bare `meter` / `Meter` identifier     (the Meter selector is gone;
//                                              `meter` is not a field anymore)
//   - retired symbol names, spelled out       (revivals of deleted code)
//   - the retired testids, as rendered attrs  (a control back on the rail)
// Comments and `src/__tests__` are exempt, exactly as `npm run check:glossary`
// exempts them: comments legitimately record the retirement as history, and
// tests carry ABSENCE pins naming what must stay gone (CODING_STANDARDS.md §9).
//
// Mix Rail Tidy-Up (ticket 05) widens the list with the two affordances THIS
// increment killed: the Click Track rail's "M" mute control (docs/adr/0010-
// client-side-tempo-detection-and-click-track.md, Amendment: lane state is
// {enabled, volume}, silence is switch-off + volume 0) and the Formant
// pill-slider markup (Mix Rail Tidy-Up spec + ticket 02 on the tracker: the
// shadcn relative track + translating white-knob span died and the control
// re-homed into the square rail-button family; no ADR — a re-home is not a
// decision that reverses painfully, ADR-0008/0009 exception). The Stem Strip's M/S
// buttons stay live, so the mute bans name the Click Track lane only.

const SRC_DIR = path.resolve(process.cwd(), "src");

const BANNED_IN_SRC = [
  {
    pattern: /downbeat/i,
    reason:
      "ADR-0011 Amendment retired the Click Track's accent/Downbeat axis end " +
      "to end: the grid has an anchor (lattice position) and no beat is the " +
      "Downbeat. Do not revive a Downbeat symbol, prop, label or button.",
  },
  {
    pattern: /\b(meter|Meter)\b/,
    reason:
      "the Click Track rail has no Meter selector and ClickTrackMixerState has " +
      "no meter field (ADR-0011 Amendment). The Meter's accent pattern is gone " +
      "with the axis.",
  },
  {
    pattern:
      /\b(pickDownbeatPhase|normalizeDownbeatPhase|downbeatPhaseRef|accentPattern|onAccent|offAccent|phaseOffset|accentSecs)\b/,
    reason:
      "a retired symbol is back in src/. The deleted names are recorded in " +
      "docs/adr/0011-downbeat-reading-and-beat-grid-repair.md §25 — re-read " +
      "what the module keeps now instead of re-importing what it dropped.",
  },
  {
    pattern: /data-testid=(["'])click-track-(phase|meter)/,
    reason:
      "a retired affordance's DOM is being rendered again (phase −/+ pair, " +
      "Meter selector and their labels). The suite's absence pins will go red " +
      "with this — remove the control.",
  },
  {
    pattern:
      /\b(setClickTrackMuted|toggleClickTrackMute|handleToggleClickTrackMute)\b|clickTrack(State)?\.muted\b/,
    reason:
      "the Click Track lane's mute concept is dead end to end (ADR-0010 " +
      "Amendment, Mix Rail Tidy-Up ticket 03): ClickTrackMixerState is " +
      "{enabled, volume} and the rail's silence routes are the ♪ switch and " +
      "volume 0. The Stem Strip's M/S buttons are live — only the lane is " +
      "named here.",
  },
  {
    pattern: /aria-label="Mute Click Track"/,
    reason:
      "the dead rail M button is being rendered again (Mix Rail Tidy-Up " +
      "ticket 03). The rail renders its ♪ switch and its volume slider only.",
  },
  {
    pattern: /\b(translate-x-4|translate-x-5|ring-0)\b/,
    reason:
      "the Formant pill-slider markup is back (Mix Rail Tidy-Up ticket 02): " +
      "the shadcn relative track + translating white-knob span died; the " +
      "control re-homed into the square rail-button family wearing the Mic " +
      "glyph.",
  },
];

let hasErrors = false;

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "test") continue;
      scanDir(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;

    const lines = fs.readFileSync(fullPath, "utf8").split("\n");

    lines.forEach((line, lineIdx) => {
      // Comments record history legitimately; code does not.
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*")
      )
        return;

      for (const { pattern, reason } of BANNED_IN_SRC) {
        if (!pattern.test(line)) continue;
        const relative = path
          .relative(process.cwd(), fullPath)
          .replace(/\\/g, "/");
        console.error(
          `❌ Retired affordance revived in ${relative}:${lineIdx + 1}`
        );
        console.error(`   "${trimmed}"`);
        console.error(`   👉 ${reason}\n`);
        hasErrors = true;
      }
    });
  }
}

console.log("🔍 Running Retired-Affordance Guardrail...");
scanDir(SRC_DIR);

if (hasErrors) {
  console.error(
    "💥 Retired-affordance check failed! Something the ADRs deleted is back in " +
      "shipped code.\n"
  );
  process.exit(1);
} else {
  console.log(
    "✅ Retired affordances stay gone: no Downbeat axis, no Meter selector, " +
      "no Click Track mute control, no Formant pill-slider in src/.\n"
  );
  process.exit(0);
}
