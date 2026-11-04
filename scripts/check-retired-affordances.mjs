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
//   - dead markup pinned as its exact class/attr string (the Formant pill-slider
//                                             track, the spine header's readout
//                                             group)
// Convention: EVERY ban pattern carries the identity of the affordance it
// retires — a symbol name, a rendered attribute, an aria-label, or the exact
// class string of the dead markup group — so a red gate always names what must
// be gone instead of an anonymous string an agent has to guess about. The class
// -string pins are the best-effort end of the list: a utility trio could in
// principle be worn by unrelated live markup, so when one goes red, read its
// reason line first and tighten the pattern if the match is not the dead group —
// never drop the ban just because one match looks unrelated.
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

// Stitch Skin (2026-11-04 user override): the Google Stitch mockup shows
// phantom controls the app never had — undo/redo/gear icons, an engine badge
// (DSP WebAudio / LATENCY / BUFFERS), loop/seek-to-start/ff/TAP transport
// glyphs, Stereo VU pips with a 0 dB readout, beat-dot pips with a BAR
// counter, a 4/4 Beat chip and a phantom third DSP-rack card (Click Track /
// Metronome). The override renders these VERBATIM as DEAD PLACEHOLDERS:
// marked data-mockup-placeholder="true", aria-hidden, wired to no behavior,
// to be erased by a later cleanup commit when this exemption goes back to a
// hard ban. So PLACEHOLDER_EXEMPT_IN_SRC below retires that phantom chrome in
// LIVE markup while SKIPPING every line inside a placeholder subtree — one
// scoped exemption, covering exactly this drop list. The strict BANNED_IN_SRC
// list above stays strict everywhere, placeholders included: a grz class, a
// Downbeat symbol or a Formant pill-slider may not hide behind a
// data-mockup-placeholder either.

const SRC_DIR = path.resolve(process.cwd(), "src");

const BANNED_IN_SRC = [
  {
    pattern:
      /(bg|border|text|ring|fill|shadow|divide|space|accent)-(grz-[0-9]+|grz-[0-9]{2,3})\b/,
    reason:
      "Stitch Skin (ticket 01, ADR-0014 supersedes the Grizzlython skin): the " +
      "grz-* Tailwind ramp classes (grz-01…05, grz-600) are fully retired onto " +
      "the st-* chrome ramp; no surface may read a grz class anymore.",
  },
  {
    pattern: /grizzly-(grid|pulse)\b/,
    reason:
      "Stitch Skin retires the grz-02 canvas-grid and brand-pulse CSS " +
      "primitives (.grizzly-grid / .grizzly-pulse); the Band carries its own " +
      "pinned backdrop and the brand dot pulses via animate-pulse.",
  },
  {
    pattern: /fonts\/grizzly/,
    reason:
      "public/fonts/grizzly woff2 are retired with the skin (scripts/provision-" +
      "stitch-fonts.mjs provisions Inter + JetBrains Mono into public/fonts/" +
      "stitch); no @font-face or url may reference the grizzly face bundle.",
  },
  {
    pattern: /"(BlenderPro|Diatype|DSemi)"/,
    reason:
      "the grizzly skin's font-family names are retired: no face declaration or " +
      "stack may name BlenderPro/Diatype/DSemi as an applied face anymore " +
      "(fallback stacks start with Inter / JetBrains Mono).",
  },
  {
    pattern: /\bheader-band\b/,
    reason:
      "Stitch Skin (ticket 05): the System-Tab Grizzly band chrome died — " +
      "the header-band strip (and its header-band-face children) may never " +
      "come back as DOM, a testid, or a rendered attr.",
  },
  {
    pattern: /\b(faceElements|grzNames|grz0[12])\b/,
    reason:
      "Stitch Skin (ticket 05): the grizzly.ts mascot layer (grz01 Demuxer, " +
      "grz02 Mixer faces) is retired with the module (src/lib/grizzly.ts " +
      "deleted); no symbol from it may be revived in src/.",
  },
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
  {
    pattern: /flex items-center gap-1 font-semibold/,
    reason:
      "ADR-0013 killed the Master Waveform spine's header mm:ss / mm:ss readout " +
      "group: the Transport is the Mix Tab's only visible clock, and a second " +
      "readout of one Playhead is the redundancy the amendment deleted. The " +
      "dead group's class string is the pin — do not re-render it on the spine. " +
      "Best-effort pin: a utility trio can in principle be worn by unrelated " +
      "live markup, so if a match is not the spine header's readout, tighten " +
      "the pattern around its context — do not delete this ban.",
  },
];

// Phantom chrome the 2026-11-04 override admits ONLY inside a placeholder
// subtree (see placeholderRanges below). Same identity convention as above:
// every pattern names the mockup control it retires from LIVE markup.
const PLACEHOLDER_EXEMPT_IN_SRC = [
  {
    pattern: /p-1\.5 rounded border border-transparent/,
    reason:
      "Stitch Skin drop list: the mockup's undo/redo/gear icon cluster is " +
      "phantom chrome — the app has no undo/redo or settings buttons. Renders " +
      'only inside an element marked data-mockup-placeholder="true".',
  },
  {
    pattern: /BUFFERS: SYNCED|LATENCY: <1\.8ms|DSP WebAudio/,
    reason:
      "the mockup's engine badge (DSP WebAudio / LATENCY: <1.8ms / " +
      "BUFFERS: SYNCED) is a fake telemetry readout the app never had. " +
      "Placeholder-only.",
  },
  {
    pattern: /Loop Section|M4 4v5h\.582/,
    reason:
      "the mockup's Loop toggle (Loop Section button + the M4 4v5h.582 loop " +
      "glyph) is phantom transport chrome — playback looping is not a shipped " +
      "control. Placeholder-only.",
  },
  {
    pattern: /M8\.445 14\.832|M4\.555 5\.168/,
    reason:
      "the mockup's Seek-to-start and Fast-forward transport glyphs (the " +
      "M8.445…/M4.555… skip-path families) never shipped. Placeholder-only.",
  },
  {
    pattern: /\bTAP\b/,
    reason:
      "the mockup's all-caps transport TAP button is phantom — the live " +
      "Hand Calibration asks for lowercase beat taps, never an all-caps TAP " +
      "button on any rail. Placeholder-only.",
  },
  {
    pattern: /0 dB\b|bg-emerald-\d{3}/,
    reason:
      "the mockup's Stereo VU Peak Output Meters (emerald pips + 0 dB " +
      "readout) are phantom chrome — the app has no VU meter anywhere. " +
      "Placeholder-only.",
  },
  {
    pattern: /\bBAR \d/,
    reason:
      "the mockup's BAR + beat-number counter is a phantom Click Track " +
      "readout — the shipped Click Track shows no BAR display. " +
      "Placeholder-only.",
  },
  {
    pattern: /4\/4 Beat/,
    reason:
      "the mockup's 4/4 Beat chip on its phantom metronome card; the shipped " +
      "DSP rack has two cards, never a third. Placeholder-only.",
  },
];

let hasErrors = false;

// A data-mockup-placeholder="true" element and its whole subtree. The marker
// usually sits on an attribute line below the opening tag, so walk back to the
// line that opens the tag; then walk forward adding opens minus closes minus
// self-closes until depth returns to zero.
function placeholderRanges(lines) {
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('data-mockup-placeholder="true"')) continue;
    let start = i;
    while (start > 0 && !/<[A-Za-z]/.test(lines[start])) start--;
    let depth = 0;
    let end = start;
    for (let j = start; j < lines.length; j++) {
      const opens = (lines[j].match(/<(?!\/)[A-Za-z][A-Za-z0-9-]*/g) || [])
        .length;
      const closes = (lines[j].match(/<\/[A-Za-z][A-Za-z0-9-]*/g) || []).length;
      const selfCloses = (lines[j].match(/\/>/g) || []).length;
      depth += opens - closes - selfCloses;
      end = j;
      if (depth <= 0) break;
    }
    found.push([start, end]);
  }
  return found;
}

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
    const exemptLines = placeholderRanges(lines);

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

      for (const { pattern, reason } of PLACEHOLDER_EXEMPT_IN_SRC) {
        if (
          exemptLines.some(([start, end]) => lineIdx >= start && lineIdx <= end)
        )
          continue;
        if (!pattern.test(line)) continue;
        const relative = path
          .relative(process.cwd(), fullPath)
          .replace(/\\/g, "/");
        console.error(
          `❌ Stitch mockup phantom chrome revived outside a placeholder in ${relative}:${lineIdx + 1}`
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
      "no Click Track mute control, no Formant pill-slider, no spine time " +
      "readout; the Stitch mockup's phantom chrome (undo/redo/gear, engine " +
      "badge, loop/ff/TAP transport, VU meters, BAR counters, the third DSP-rack " +
      "card) renders only inside a data-mockup-placeholder dead placeholder in " +
      "src/.\n"
  );
  process.exit(0);
}
