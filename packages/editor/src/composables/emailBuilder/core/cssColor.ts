// core/cssColor.ts
// ─────────────────────────────────────────────────────────────────────────────
// Parsing and formatting of the CSS colour strings the editor writes and reads:
// `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, and `rgb()` / `rgba()` in the comma
// and the space syntax.
//
// Pure, no Vue: the colour picker (to open on a value that has alpha), the box
// shadow model (to write one canonical string) and the exporters all use it.
//
// Not a full CSS colour parser. Named colours, `hsl()` and the rest return
// null, and callers decide what to do with a string they cannot read.
// ─────────────────────────────────────────────────────────────────────────────

export interface Rgba {
  /** 0–255 */
  r: number;
  /** 0–255 */
  g: number;
  /** 0–255 */
  b: number;
  /** 0–1 */
  a: number;
}

const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_RE = /^rgba?\(\s*([^()]*?)\s*\)$/i;
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)%?$/;

/** A channel: a number of 0–255, or a percentage of 255. */
const channel = (token: string): number | null => {
  if (!NUMBER_RE.test(token)) return null;
  const n = parseFloat(token);
  return clamp(token.endsWith("%") ? (n / 100) * 255 : n, 0, 255);
};

/** An alpha: a number of 0–1, or a percentage. */
const alpha = (token: string): number | null => {
  if (!NUMBER_RE.test(token)) return null;
  const n = parseFloat(token);
  return clamp(token.endsWith("%") ? n / 100 : n, 0, 1);
};

/**
 * Reads a CSS colour string. Returns null for anything that is not one of the
 * forms in the header, or that is not a string.
 */
export const parseCssColor = (input: unknown): Rgba | null => {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;

  const hex = HEX_RE.exec(s);
  if (hex) {
    let h = hex[1];
    // #rgb and #rgba: every digit stands for itself twice.
    if (h.length <= 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const n = parseInt(h.slice(0, 6), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const fn = FUNC_RE.exec(s);
  if (fn) {
    // `1, 2, 3, 0.5`, `1 2 3 / 0.5` and `1 2 3` all split the same way.
    const tokens = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (tokens.length !== 3 && tokens.length !== 4) return null;
    const r = channel(tokens[0]);
    const g = channel(tokens[1]);
    const b = channel(tokens[2]);
    const a = tokens.length === 4 ? alpha(tokens[3]) : 1;
    if (r === null || g === null || b === null || a === null) return null;
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
  }

  return null;
};

const hex2 = (n: number): string =>
  Math.round(clamp(n, 0, 255))
    .toString(16)
    .padStart(2, "0");

/**
 * The one string the editor writes for a colour: `#rrggbb` when it is opaque,
 * `rgba(r, g, b, a)` with the alpha rounded to two decimals otherwise.
 *
 * `#rrggbbaa` and the space syntax of `rgb()` are not written on purpose: email
 * clients read them less reliably than the comma form.
 */
export const formatCssColor = ({ r, g, b, a }: Rgba): string => {
  const a2 = Math.round(clamp(a, 0, 1) * 100) / 100;
  if (a2 >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a2})`;
};
