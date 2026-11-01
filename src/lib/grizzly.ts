/**
 * Grizzly marks (grz-11) — the two faces that front the app.
 *
 * Ported from the OpenDesign grizzlython-skin artifacts (`separate-header-grizzly.html`
 * and the System-Tab band addendum). The face data is declarative — eyes, brows,
 * ears, snout, and an optional carry prop — and the renderer only ever emits a
 * single inline decorative SVG: it is chrome, never an interactive control and
 * never a content placeholder, so it is aria-hidden and pointer-events-none.
 *
 * Identity colors come from the `--color-grizzly-*` tokens in index.css. The
 * `--grz-N` ramp (grz-15/18) is chrome-only: ink/coral for structure, cream
 * for the fur plates.
 */

interface FaceSpec {
  eyeX: [number, number];
  eyeY: number;
  browTilt: [number, number]; // radians, + = worried
  earSize: number; // 0..1, scales the ear domes
  snout: boolean; // true = wide snout plate, false = narrow muzzle
  carry?: { path: string; stroke?: boolean } | null;
  ink: string;
  plate: string;
  ear: string;
}

/* SVG presentation attributes can't resolve CSS custom properties, so the
   marks inline the same snapshot values the `--color-grizzly-*` tokens name:
   black #161515 · cream #eae7dd · peach #f1b994 · coral #ef474a. */
const INK = "#161515";
const CREAM = "#eae7dd";
const PEACH = "#f1b994";

export const grz01: FaceSpec = {
  eyeX: [0.36, 0.64],
  eyeY: 0.44,
  browTilt: [-0.18, 0.18], // lowered — the demuxer squints at waveforms
  earSize: 1.0, // round, wide-set
  snout: true, // broad snout plate
  carry: null, // grz-01 carries nothing
  ink: INK,
  plate: CREAM,
  ear: CREAM,
};

export const grz02: FaceSpec = {
  eyeX: [0.32, 0.6],
  eyeY: 0.42,
  browTilt: [0.12, -0.04], // one cocked — the mixer keeps rhythm
  earSize: 0.82, // smaller, set closer
  snout: false, // narrower muzzle
  carry: {
    path: "M 66 74 L 88 46", // slim machete held diagonally (grz-02's statement)
    stroke: true,
  },
  ink: INK,
  plate: PEACH,
  ear: CREAM,
};

/** Human-readable names for the marks — used in the band's aria-labels. */
export const grzNames: Record<string, string> = {
  grz01: "Demuxer grizzly — round ears, broad snout, lowered brows",
  grz02: "Mixer grizzly — smaller ears, cocked brow, carries a machete",
};

/**
 * Render a mark's primitives as data: tag + attrs, in paint order, inside a
 * 100×100 viewBox. The caller wraps them in a decorative `<svg>` (role
 * presentation) and aria-labels the wrapper with `grzNames` — chrome, never a
 * content placeholder.
 */
export function faceElements(
  spec: FaceSpec
): Array<{ tag: string; attrs: Record<string, string> }> {
  const cx = 50;
  const plateRx = 30;
  const plateRy = 22;
  const eyeRx = 6;
  const eyeRy = 7;
  const pupil = 2.6;

  const [ex0, ex1] = spec.eyeX;
  const [tilt0, tilt1] = spec.browTilt;
  const earR = 12 * spec.earSize;
  const eyeY = spec.eyeY * 100;

  const els: Array<{ tag: string; attrs: Record<string, string> }> = [
    // face plate
    {
      tag: "ellipse",
      attrs: {
        cx: `${cx}`,
        cy: `${eyeY + 10}`,
        rx: `${plateRx}`,
        ry: `${plateRy}`,
        fill: spec.plate,
      },
    },
    // ears, set by earSize
    {
      tag: "ellipse",
      attrs: {
        cx: `${cx - plateRx * 0.85}`,
        cy: `${eyeY - plateRy * 1.35}`,
        rx: `${earR}`,
        ry: `${earR * 1.25}`,
        fill: spec.ear,
      },
    },
    {
      tag: "ellipse",
      attrs: {
        cx: `${cx + plateRx * 0.85}`,
        cy: `${eyeY - plateRy * 1.35}`,
        rx: `${earR}`,
        ry: `${earR * 1.25}`,
        fill: spec.ear,
      },
    },
    // eye plates
    {
      tag: "ellipse",
      attrs: {
        cx: `${ex0 * 100}`,
        cy: `${eyeY}`,
        rx: `${eyeRx}`,
        ry: `${eyeRy}`,
        fill: spec.plate,
      },
    },
    {
      tag: "ellipse",
      attrs: {
        cx: `${ex1 * 100}`,
        cy: `${eyeY}`,
        rx: `${eyeRx}`,
        ry: `${eyeRy}`,
        fill: spec.plate,
      },
    },
    // pupils
    {
      tag: "circle",
      attrs: {
        cx: `${ex0 * 100}`,
        cy: `${eyeY + 1}`,
        r: `${pupil}`,
        fill: spec.ink,
      },
    },
    {
      tag: "circle",
      attrs: {
        cx: `${ex1 * 100}`,
        cy: `${eyeY + 1}`,
        r: `${pupil}`,
        fill: spec.ink,
      },
    },
    // brows: lowered (grz-01) or one cocked (grz-02)
    {
      tag: "line",
      attrs: {
        x1: `${ex0 * 100 - eyeRx}`,
        y1: `${eyeY - eyeRy - 4 - tilt0 * 14}`,
        x2: `${ex0 * 100 + eyeRx}`,
        y2: `${eyeY - eyeRy - 4 + tilt0 * 14}`,
        stroke: spec.ink,
        "stroke-width": "2.4",
        "stroke-linecap": "round",
      },
    },
    {
      tag: "line",
      attrs: {
        x1: `${ex1 * 100 - eyeRx}`,
        y1: `${eyeY - eyeRy - 4 + tilt1 * 14}`,
        x2: `${ex1 * 100 + eyeRx}`,
        y2: `${eyeY - eyeRy - 4 - tilt1 * 14}`,
        stroke: spec.ink,
        "stroke-width": "2.4",
        "stroke-linecap": "round",
      },
    },
    // snout plate + nose
    {
      tag: "ellipse",
      attrs: {
        cx: `${cx}`,
        cy: `${eyeY + (spec.snout ? 24 : 22)}`,
        rx: `${spec.snout ? 12 : 8}`,
        ry: `${spec.snout ? 7 : 5}`,
        fill: spec.plate,
      },
    },
    {
      tag: "ellipse",
      attrs: {
        cx: `${cx}`,
        cy: `${eyeY + (spec.snout ? 20 : 19)}`,
        rx: `${spec.snout ? 4 : 3}`,
        ry: `${spec.snout ? 3 : 2.4}`,
        fill: spec.ink,
      },
    },
  ];

  if (spec.carry) {
    // grz-02's machete — a statement, not a toy
    els.push({
      tag: "path",
      attrs: {
        d: spec.carry.path,
        stroke: spec.ink,
        "stroke-width": "2.6",
        "stroke-linecap": "round",
        fill: "none",
      },
    });
  }

  return els;
}
