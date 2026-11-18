// import/css/values.ts
// ─────────────────────────────────────────────────────────────────────────────
// CSS value helpers for the HTML importer
//
// Pure functions, no DOM. Everything the cascade and the mappers need to turn a
// declared value (a string) into something they can compare or write back:
//
//   • splitting a value on top-level spaces or commas,
//   • colours: names, hsl(), transparent and currentColor on top of the hex and
//     rgb() forms core/cssColor already reads,
//   • lengths: px, pt, em, rem and friends to pixels,
//   • shorthand expansion: margin, padding, border, border-radius, background
//     and font become their longhands, so the cascade can order them one by one,
//   • var(--x) with a fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { formatCssColor, parseCssColor, type Rgba } from "../../core/cssColor";

// ─── Splitting ────────────────────────────────────────────────────────────────

/**
 * Splits `text` at every character for which `isSep` is true, except inside
 * parentheses, brackets and quotes. Empty pieces are dropped.
 */
export const splitTopLevel = (
  text: string,
  isSep: (ch: string) => boolean,
): string[] => {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      cur += ch;
      if (ch === "\\" && i + 1 < text.length) cur += text[++i];
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === "(" || ch === "[") {
      depth++;
      cur += ch;
    } else if (ch === ")" || ch === "]") {
      depth = Math.max(0, depth - 1);
      cur += ch;
    } else if (depth === 0 && isSep(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

export const splitSpaces = (text: string): string[] =>
  splitTopLevel(text, (c) => /\s/.test(c));

export const splitCommas = (text: string): string[] =>
  splitTopLevel(text, (c) => c === ",");

// ─── Colours ──────────────────────────────────────────────────────────────────

const NAMED_COLORS =
  "aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32";

const NAMED = new Map<string, string>(
  NAMED_COLORS.split(",").map((pair) => {
    const [name, hex] = pair.split(":");
    return [name, hex];
  }),
);

export type { Rgba };

export const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** `hsl(210 50% 40% / 0.5)` and `hsla(210, 50%, 40%, 0.5)` to RGBA. */
const parseHsl = (s: string): Rgba | null => {
  const m = /^hsla?\(\s*([^)]*)\)$/i.exec(s);
  if (!m) return null;
  const tokens = m[1].split(/[\s,/]+/).filter(Boolean);
  if (tokens.length !== 3 && tokens.length !== 4) return null;
  const hueTok = /^(-?[\d.]+)(deg|grad|rad|turn)?$/i.exec(tokens[0]);
  if (!hueTok) return null;
  let h = parseFloat(hueTok[1]);
  const unit = (hueTok[2] ?? "deg").toLowerCase();
  if (unit === "grad") h = (h * 360) / 400;
  else if (unit === "rad") h = (h * 180) / Math.PI;
  else if (unit === "turn") h = h * 360;
  h = ((h % 360) + 360) % 360;
  const pct = (t: string): number | null => {
    const mm = /^(-?[\d.]+)%?$/.exec(t);
    return mm ? clamp(parseFloat(mm[1]) / 100, 0, 1) : null;
  };
  const sat = pct(tokens[1]);
  const light = pct(tokens[2]);
  if (sat === null || light === null) return null;
  let a = 1;
  if (tokens.length === 4) {
    const at = /^(-?[\d.]+)(%?)$/.exec(tokens[3]);
    if (!at) return null;
    a = clamp(at[2] ? parseFloat(at[1]) / 100 : parseFloat(at[1]), 0, 1);
  }
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = light - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: Math.round((rgb[0] + mm) * 255),
    g: Math.round((rgb[1] + mm) * 255),
    b: Math.round((rgb[2] + mm) * 255),
    a,
  };
};

/**
 * Reads a CSS colour. Hex and rgb() go through core/cssColor; this adds the
 * 148 named colours, hsl()/hsla(), `transparent`, and `currentColor` (taken
 * from `current`). Returns null for anything else (inherit, var(), gradients,
 * system colours), which callers treat as "no usable colour here".
 */
export const parseColor = (
  value: string | null | undefined,
  current: Rgba | null = null,
): Rgba | null => {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (!s) return null;
  if (s === "transparent") return { ...TRANSPARENT };
  if (s === "currentcolor") return current ? { ...current } : null;
  const named = NAMED.get(s);
  if (named) {
    const n = parseInt(named, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  if (s.startsWith("hsl")) return parseHsl(s);
  return parseCssColor(s);
};

/** The string Maildeno stores for a colour. Fully transparent is the word. */
export const colorToString = (c: Rgba): string =>
  c.a <= 0 ? "transparent" : formatCssColor(c);

/** Composites `top` over `bottom`. Used to flatten a translucent background. */
export const compositeOver = (top: Rgba, bottom: Rgba): Rgba => {
  const a = top.a + bottom.a * (1 - top.a);
  if (a <= 0) return { ...TRANSPARENT };
  const mix = (t: number, b: number): number =>
    Math.round((t * top.a + b * bottom.a * (1 - top.a)) / a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
};

export const sameColor = (a: Rgba | null, b: Rgba | null): boolean => {
  if (!a || !b) return a === b;
  if (a.a === 0 && b.a === 0) return true;
  return a.r === b.r && a.g === b.g && a.b === b.b && Math.abs(a.a - b.a) < 0.005;
};

// ─── Lengths ──────────────────────────────────────────────────────────────────

export interface Len {
  n: number;
  /** "" for a bare number, otherwise lower-case: px, %, em, rem, pt, ... */
  unit: string;
}

const LEN_RE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

export const parseLen = (value: string | null | undefined): Len | null => {
  if (typeof value !== "string") return null;
  const m = LEN_RE.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return { n, unit: m[2].toLowerCase() };
};

export interface LenContext {
  /** The element's own font-size in px, for em. */
  em: number;
  /** The root font-size in px, for rem. Default 16. */
  rem?: number;
  /** The viewport width in px, for vw. */
  vw?: number;
}

/**
 * A length in px, or null when it has no px value without a layout base
 * (a percentage) or is not a length at all. A bare 0 is 0; any other bare
 * number is read as px, which is how the HTML width/height attributes work.
 */
export const lenToPx = (
  len: Len | null,
  ctx: LenContext = { em: 16 },
): number | null => {
  if (!len) return null;
  const { n, unit } = len;
  switch (unit) {
    case "":
    case "px":
      return n;
    case "pt":
      return (n * 4) / 3;
    case "pc":
      return n * 16;
    case "in":
      return n * 96;
    case "cm":
      return (n * 96) / 2.54;
    case "mm":
      return (n * 96) / 25.4;
    case "q":
      return (n * 96) / 101.6;
    case "em":
      return n * ctx.em;
    case "rem":
      return n * (ctx.rem ?? 16);
    case "ex":
      return n * ctx.em * 0.5;
    case "ch":
      return n * ctx.em * 0.5;
    case "vw":
      return ctx.vw === undefined ? null : (n * ctx.vw) / 100;
    default:
      return null;
  }
};

export const px = (
  value: string | null | undefined,
  ctx?: LenContext,
): number | null => lenToPx(parseLen(value), ctx);

export const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── Border pieces ────────────────────────────────────────────────────────────

export const BORDER_STYLES = new Set([
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

const BORDER_WIDTH_WORDS: Record<string, string> = {
  thin: "1px",
  medium: "3px",
  thick: "5px",
};

const isColorToken = (t: string): boolean =>
  /^#[0-9a-f]{3,8}$/i.test(t) ||
  /^(rgb|rgba|hsl|hsla)\(/i.test(t) ||
  t.toLowerCase() === "transparent" ||
  t.toLowerCase() === "currentcolor" ||
  NAMED.has(t.toLowerCase());

const SIDES = ["top", "right", "bottom", "left"] as const;
const CORNERS = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
] as const;

/** The 1-to-4 value box shorthand: [top, right, bottom, left]. */
const box4 = (tokens: string[]): [string, string, string, string] | null => {
  if (tokens.length === 1) return [tokens[0], tokens[0], tokens[0], tokens[0]];
  if (tokens.length === 2) return [tokens[0], tokens[1], tokens[0], tokens[1]];
  if (tokens.length === 3) return [tokens[0], tokens[1], tokens[2], tokens[1]];
  if (tokens.length === 4) return [tokens[0], tokens[1], tokens[2], tokens[3]];
  return null;
};

export type Longhand = [prop: string, value: string];

const borderParts = (
  tokens: string[],
): { width: string; style: string; color: string } => {
  let width = "medium";
  let style = "none";
  let color = "currentcolor";
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (BORDER_STYLES.has(low)) style = low;
    else if (low in BORDER_WIDTH_WORDS) width = BORDER_WIDTH_WORDS[low];
    else if (parseLen(t)) width = t;
    else if (isColorToken(t)) color = t;
  }
  return { width: BORDER_WIDTH_WORDS[width] ?? width, style, color };
};

// ─── background ───────────────────────────────────────────────────────────────

const BG_REPEAT = new Set(["repeat", "repeat-x", "repeat-y", "no-repeat", "space", "round"]);
const BG_POS_WORDS = new Set(["left", "right", "top", "bottom", "center"]);
const BG_ATTACH = new Set(["scroll", "fixed", "local"]);
const BG_BOX = new Set(["border-box", "padding-box", "content-box", "text"]);

const expandBackground = (value: string): Longhand[] => {
  const layers = splitCommas(value);
  let color = "transparent";
  let image = "none";
  let repeat = "repeat";
  let position = "0% 0%";
  let size = "auto";

  layers.forEach((layer, li) => {
    const tokens = splitSpaces(layer);
    const pos: string[] = [];
    let sizeTokens: string[] = [];
    let afterSlash = false;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const low = t.toLowerCase();
      if (t === "/") {
        afterSlash = true;
        continue;
      }
      if (t.includes("/") && !/^(url|[a-z-]*gradient)\(/i.test(t)) {
        // `center/cover` written without spaces
        const [a, b] = t.split("/");
        if (a) pos.push(a);
        afterSlash = true;
        if (b) sizeTokens.push(b);
        continue;
      }
      if (/^url\(/i.test(t) || /^[a-z-]*gradient\(/i.test(t)) {
        if (li === 0 || image === "none") image = t;
      } else if (low === "none") {
        if (li === 0) image = "none";
      } else if (BG_REPEAT.has(low)) {
        if (li === 0) repeat = low;
      } else if (BG_ATTACH.has(low) || BG_BOX.has(low)) {
        // not represented
      } else if (afterSlash && (parseLen(t) || low === "auto" || low === "cover" || low === "contain")) {
        sizeTokens.push(t);
      } else if (BG_POS_WORDS.has(low) || (parseLen(t) && !afterSlash)) {
        if (li === 0) pos.push(t);
      } else if (isColorToken(t)) {
        color = t;
      }
    }
    if (li === 0) {
      if (pos.length) position = pos.join(" ");
      if (sizeTokens.length) size = sizeTokens.join(" ");
    }
    sizeTokens = [];
  });

  return [
    ["background-color", color],
    ["background-image", image],
    ["background-repeat", repeat],
    ["background-position", position],
    ["background-size", size],
  ];
};

/** The colour in a `background` shorthand, or null when it has none. */
const backgroundColourToken = (value: string): string | null => {
  for (const layer of splitCommas(value)) {
    for (const t of splitSpaces(layer)) if (isColorToken(t)) return t;
  }
  return null;
};

/** Where the fallback colour of a gradient shorthand is kept. Nothing draws it; the importer reads it. */
export const BACKGROUND_FALLBACK = "-x-background-fallback";

/**
 * A filter for one declaration block, fed in source order. `background-color:#fff;
 * background:linear-gradient(...)` is how email builders write a fallback: clients
 * that cannot draw the gradient drop the second declaration and keep the colour.
 * The cascade, rightly, lets the shorthand reset the colour, so it would be lost;
 * this keeps it under BACKGROUND_FALLBACK, which is what the editor calls `solid`.
 */
export const fallbackTracker = (): ((prop: string, value: string, longhands: Longhand[]) => Longhand[]) => {
  let colour: string | null = null;
  return (prop, value, longhands) => {
    if (prop === "background-color") {
      colour = value;
    } else if (prop === "background") {
      const keep = colour !== null && backgroundColourToken(value) === null && /gradient\(/i.test(value);
      const fallback = colour;
      colour = null;
      if (keep && fallback) return [...longhands, [BACKGROUND_FALLBACK, fallback]];
    }
    return longhands;
  };
};

// ─── font ─────────────────────────────────────────────────────────────────────

const FONT_STYLE_WORDS = new Set(["italic", "oblique"]);
const FONT_WEIGHT_WORDS = new Set(["bold", "bolder", "lighter"]);
const FONT_SIZE_WORDS = new Set([
  "xx-small",
  "x-small",
  "small",
  "medium",
  "large",
  "x-large",
  "xx-large",
  "xxx-large",
  "smaller",
  "larger",
]);

const expandFont = (value: string): Longhand[] | null => {
  const tokens = splitSpaces(value);
  let style = "normal";
  let weight = "normal";
  let i = 0;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    const low = t.toLowerCase();
    if (low === "normal") continue;
    if (FONT_STYLE_WORDS.has(low)) style = low;
    else if (FONT_WEIGHT_WORDS.has(low) || /^[1-9]00$/.test(low)) weight = low;
    else if (low === "small-caps") continue;
    else break;
  }
  const sizeTok = tokens[i];
  if (!sizeTok) return null;
  const [sizePart, lhPart] = sizeTok.split("/");
  const isSize = parseLen(sizePart) !== null || FONT_SIZE_WORDS.has(sizePart.toLowerCase());
  if (!isSize) return null;
  let lineHeight = lhPart ?? "normal";
  let familyStart = i + 1;
  // `font: 14px / 1.4 Arial` with spaces around the slash.
  if (!lhPart && tokens[i + 1] === "/") {
    lineHeight = tokens[i + 2] ?? "normal";
    familyStart = i + 3;
  } else if (!lhPart && tokens[i + 1]?.startsWith("/")) {
    lineHeight = tokens[i + 1].slice(1) || "normal";
    familyStart = i + 2;
  }
  const family = tokens.slice(familyStart).join(" ");
  if (!family) return null;
  return [
    ["font-style", style],
    ["font-weight", weight],
    ["font-size", sizePart],
    ["line-height", lineHeight],
    ["font-family", family],
  ];
};

// ─── Shorthand expansion ──────────────────────────────────────────────────────

/**
 * One declaration to its longhands. A property that is not a shorthand comes
 * back as itself. A shorthand the reader cannot parse comes back as itself too,
 * so nothing is lost silently (the cascade ignores names it does not know).
 */
export const expandShorthand = (prop: string, value: string): Longhand[] => {
  const v = value.trim();
  const low = v.toLowerCase();
  const wide = low === "inherit" || low === "initial" || low === "unset" || low === "revert";

  const wideAll = (names: string[]): Longhand[] => names.map((n) => [n, low]);

  switch (prop) {
    case "margin":
    case "padding": {
      const names = SIDES.map((s) => `${prop}-${s}`);
      if (wide) return wideAll(names);
      const b = box4(splitSpaces(v));
      return b ? names.map((n, i) => [n, b[i]] as Longhand) : [[prop, v]];
    }
    case "margin-inline":
    case "padding-inline": {
      const base = prop.slice(0, -7);
      const b = splitSpaces(v);
      if (!b.length || b.length > 2) return [[prop, v]];
      return [
        [`${base}-left`, b[0]],
        [`${base}-right`, b[1] ?? b[0]],
      ];
    }
    case "margin-block":
    case "padding-block": {
      const base = prop.slice(0, -6);
      const b = splitSpaces(v);
      if (!b.length || b.length > 2) return [[prop, v]];
      return [
        [`${base}-top`, b[0]],
        [`${base}-bottom`, b[1] ?? b[0]],
      ];
    }
    case "border": {
      if (wide) {
        return wideAll(
          SIDES.flatMap((s) => [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]),
        );
      }
      const p = borderParts(splitSpaces(v));
      return SIDES.flatMap((s) => [
        [`border-${s}-width`, p.width] as Longhand,
        [`border-${s}-style`, p.style] as Longhand,
        [`border-${s}-color`, p.color] as Longhand,
      ]);
    }
    case "border-top":
    case "border-right":
    case "border-bottom":
    case "border-left": {
      const s = prop.slice(7);
      if (wide) return wideAll([`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]);
      const p = borderParts(splitSpaces(v));
      return [
        [`border-${s}-width`, p.width],
        [`border-${s}-style`, p.style],
        [`border-${s}-color`, p.color],
      ];
    }
    case "border-width":
    case "border-style":
    case "border-color": {
      const kind = prop.slice(7);
      const names = SIDES.map((s) => `border-${s}-${kind}`);
      if (wide) return wideAll(names);
      const b = box4(splitSpaces(v));
      if (!b) return [[prop, v]];
      return names.map((n, i) => [n, kind === "width" ? (BORDER_WIDTH_WORDS[b[i].toLowerCase()] ?? b[i]) : b[i]] as Longhand);
    }
    case "border-radius": {
      const names = CORNERS.map((c) => `border-${c}-radius`);
      if (wide) return wideAll(names);
      const horizontal = v.split("/")[0];
      const b = box4(splitSpaces(horizontal));
      return b ? names.map((n, i) => [n, b[i]] as Longhand) : [[prop, v]];
    }
    case "border-top-left-radius":
    case "border-top-right-radius":
    case "border-bottom-right-radius":
    case "border-bottom-left-radius":
      // `10px 5px` is an elliptical corner; the horizontal radius is what a
      // rounded box reads as.
      return [[prop, splitSpaces(v)[0] ?? v]];
    case "background": {
      const names = ["background-color", "background-image", "background-repeat", "background-position", "background-size"];
      if (wide) return wideAll(names);
      return expandBackground(v);
    }
    case "text-decoration": {
      // only the line part matters here; style, colour and thickness are dropped
      if (wide) return [["text-decoration-line", low]];
      const LINES = new Set(["none", "underline", "overline", "line-through", "blink"]);
      const lines = splitSpaces(low).filter((t) => LINES.has(t));
      return [["text-decoration-line", lines.length ? lines.join(" ") : "none"]];
    }
    case "font": {
      const names = ["font-style", "font-weight", "font-size", "line-height", "font-family"];
      if (wide) return wideAll(names);
      return expandFont(v) ?? [[prop, v]];
    }
    default:
      return [[prop, v]];
  }
};

// ─── var() ────────────────────────────────────────────────────────────────────

/**
 * Replaces `var(--name)` and `var(--name, fallback)` using `vars`. A name that
 * is not defined takes its fallback, or leaves the value unusable (returns
 * null) when there is none. Nested var() in a fallback and in a variable's own
 * value are followed to a small depth.
 */
export const resolveVars = (
  value: string,
  vars: ReadonlyMap<string, string>,
  depth = 0,
): string | null => {
  if (!/var\(/i.test(value)) return value;
  if (depth > 5) return null;
  let failed = false;
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.toLowerCase().indexOf("var(", i);
    if (at === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    // find the matching parenthesis
    let level = 0;
    let end = -1;
    for (let j = at + 3; j < value.length; j++) {
      if (value[j] === "(") level++;
      else if (value[j] === ")") {
        level--;
        if (level === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) return null;
    const inner = value.slice(at + 4, end);
    const comma = splitTopLevel(inner, (c) => c === ",");
    const name = (comma[0] ?? "").trim();
    const fallback = comma.length > 1 ? inner.slice(inner.indexOf(",") + 1).trim() : null;
    const defined = vars.get(name);
    let repl: string | null = null;
    if (defined !== undefined) repl = resolveVars(defined, vars, depth + 1);
    if (repl === null && fallback !== null) repl = resolveVars(fallback, vars, depth + 1);
    if (repl === null) failed = true;
    else out += repl;
    i = end + 1;
  }
  return failed ? null : out.trim();
};

// ─── Font family ──────────────────────────────────────────────────────────────

const GENERIC_FAMILIES: Record<string, string> = {
  "sans-serif": "Arial",
  serif: "Georgia",
  monospace: "Courier New",
  cursive: "Comic Sans MS",
  fantasy: "Impact",
  "system-ui": "Arial",
  "ui-sans-serif": "Arial",
  "ui-serif": "Georgia",
  "ui-monospace": "Courier New",
};

/**
 * The family Maildeno stores for a font stack: the first name, unquoted. The
 * exporters write it back as `'Name', Arial, sans-serif`, so a generic keyword
 * at the front becomes a web-safe family of the same kind. `generic` is true
 * when that substitution happened, so the caller can say so.
 */
export const primaryFamily = (
  stack: string | null | undefined,
): { family: string; generic: boolean } | null => {
  if (!stack) return null;
  const names = splitCommas(stack).map((n) => n.replace(/^["']|["']$/g, "").trim());
  const first = names.find((n) => n && !/^(inherit|initial|unset)$/i.test(n));
  if (!first) return null;
  const sub = GENERIC_FAMILIES[first.toLowerCase()];
  if (sub) return { family: sub, generic: true };
  return { family: first, generic: false };
};
