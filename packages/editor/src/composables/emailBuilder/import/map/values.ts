// import/map/values.ts
// ─────────────────────────────────────────────────────────────────────────────
// Computed style → the values Maildeno stores
//
// Every function here takes what the cascade computed for one element in one
// view and returns it in Maildeno's value space: whole-pixel spacing, one font
// family name, a font weight from the editor's list, a colour string, a border
// object, a shadow, a gradient. Comparing two views in this space is what
// keeps the mobile overrides free of noise such as 16px against 1rem.
// ─────────────────────────────────────────────────────────────────────────────

import { type BorderRadius, toStoredBorderRadius } from "../../core/borderRadius";
import { DEFAULT_BOX_SHADOW, normalizeBoxShadow } from "../../core/boxShadow";
import type { BackgroundGradient, Border, BoxShadow, Padding } from "../../types/emailBuilder";
import { normalizePosition, normalizeRepeat, normalizeSize, urlOf } from "../css/background";
import type { ElStyle } from "../css/cascade";
import {
  BACKGROUND_FALLBACK,
  type Rgba,
  colorToString,
  parseColor,
  parseLen,
  primaryFamily,
  round2,
  splitCommas,
  splitSpaces,
  splitTopLevel,
} from "../css/values";
import type { Sides } from "../structure/leaves";

// ─── Numbers ──────────────────────────────────────────────────────────────────

export const wholePx = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

export const padding = (s: Sides): Padding => ({
  top: wholePx(s.top),
  right: wholePx(s.right),
  bottom: wholePx(s.bottom),
  left: wholePx(s.left),
});

export const addSides = (a: Sides, b: Sides): Sides => ({
  top: a.top + b.top,
  right: a.right + b.right,
  bottom: a.bottom + b.bottom,
  left: a.left + b.left,
});

export const ZERO_SIDES: Sides = { top: 0, right: 0, bottom: 0, left: 0 };

export const oneDecimal = (n: number): number => Math.round(n * 10) / 10;

// ─── Typography ───────────────────────────────────────────────────────────────

const WEIGHTS = [100, 300, 400, 500, 600, 700, 800, 900];

/** The editor's font-weight list for text blocks: 100, 300, normal, 500, 600, bold, 800, 900. */
export const textWeight = (cs: ElStyle): string => {
  const w = cs.fontWeight();
  let best = WEIGHTS[0];
  for (const candidate of WEIGHTS) {
    if (Math.abs(candidate - w) <= Math.abs(best - w)) best = candidate;
  }
  if (best === 400) return "normal";
  if (best === 700) return "bold";
  return String(best);
};

/** Buttons and anchors offer normal, medium and bold. "medium" is not valid CSS, so it is never written. */
export const buttonWeight = (cs: ElStyle): string => (cs.fontWeight() >= 600 ? "bold" : "normal");

const WEB_SAFE = new Set(
  [
    "arial",
    "arial black",
    "comic sans ms",
    "courier new",
    "georgia",
    "helvetica",
    "impact",
    "lucida console",
    "lucida sans unicode",
    "palatino linotype",
    "tahoma",
    "times new roman",
    "trebuchet ms",
    "verdana",
    "helvetica neue",
    "segoe ui",
    "roboto",
    "open sans",
    "lato",
    "montserrat",
    "inter",
    "poppins",
    "source sans pro",
    "oswald",
    "raleway",
    "nunito",
    "merriweather",
    "playfair display",
    "ubuntu",
    "pt sans",
    "noto sans",
  ].map((s) => s.toLowerCase()),
);

/** The first font family of the stack, as one plain name. Generic families map to a common face. */
export const familyOf = (cs: ElStyle, fonts: Set<string>): string => {
  const found = primaryFamily(cs.inh("font-family"));
  const name = found?.family?.trim();
  if (!name) return "Arial";
  if (!WEB_SAFE.has(name.toLowerCase())) fonts.add(name);
  return name;
};

export const decorationOf = (cs: ElStyle): "none" | "underline" | "line-through" => {
  const d = cs.decorations();
  if (d.underline) return "underline";
  if (d.lineThrough) return "line-through";
  return "none";
};

export interface Typography {
  fontSize: number;
  lineHeight: number;
  color: string;
  fontWeight: string;
  fontFamily: string;
  fontStyle: "normal" | "italic";
  letterSpacing: number;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration: "none" | "underline" | "line-through";
  align: "left" | "center" | "right" | "justify";
}

export const typography = (cs: ElStyle, fonts: Set<string>, kind: "text" | "button" = "text"): Typography => ({
  fontSize: oneDecimal(cs.fontSize()),
  lineHeight: round2(cs.lineHeight()),
  color: colorToString(cs.textColor()),
  fontWeight: kind === "button" ? buttonWeight(cs) : textWeight(cs),
  fontFamily: familyOf(cs, fonts),
  fontStyle: cs.italic() ? "italic" : "normal",
  letterSpacing: round2(cs.letterSpacing()),
  textTransform: cs.textTransform(),
  textDecoration: decorationOf(cs),
  align: cs.textAlign(),
});

// ─── Backgrounds ──────────────────────────────────────────────────────────────

const PAIR_GRADIENT = {
  type: "linear" as const,
  direction: "to right",
  colors: [
    { color: "#ffffff", position: 0 },
    { color: "#eeeeee", position: 100 },
  ],
};

/** A flat colour in the shape Maildeno keeps backgrounds in: a colour and a gradient object, always together. */
export const solidFill = (color: string): { backgroundColor: string; backgroundGradient: BackgroundGradient } => ({
  backgroundColor: color,
  backgroundGradient: {
    useGradient: false,
    solid: color,
    gradient: { ...PAIR_GRADIENT, colors: PAIR_GRADIENT.colors.map((c) => ({ ...c })) },
  },
});

export const NO_FILL = solidFill("transparent");

const ANGLE = /^-?\d*\.?\d+(deg|grad|rad|turn)$/i;
const TO_SIDE = /^to\s+(top|bottom|left|right)(\s+(top|bottom|left|right))?$/i;

const toDegrees = (token: string): string => {
  const m = /^(-?\d*\.?\d+)(deg|grad|rad|turn)$/i.exec(token);
  if (!m) return token;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const deg = unit === "deg" ? n : unit === "grad" ? n * 0.9 : unit === "rad" ? (n * 180) / Math.PI : n * 360;
  return `${round2(deg)}deg`;
};

interface Gradient {
  type: "linear" | "radial";
  direction: string;
  colors: Array<{ color: string; position: number }>;
}

/** Parses one linear-gradient() or radial-gradient() layer. Null when it cannot be read as stops. */
const parseGradient = (layer: string, current: Rgba): Gradient | null => {
  const m = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/is.exec(layer.trim());
  if (!m) return null;
  const type = m[2].toLowerCase() as "linear" | "radial";
  const parts = splitCommas(m[3]);
  if (parts.length < 2) return null;
  let direction = "to bottom";
  let stops = parts;
  const head = parts[0].trim();
  if (type === "linear" && (ANGLE.test(head) || TO_SIDE.test(head))) {
    direction = ANGLE.test(head) ? toDegrees(head) : head.toLowerCase();
    stops = parts.slice(1);
  } else if (type === "radial" && !parseColor(splitSpaces(head)[0], current)) {
    stops = parts.slice(1); // the shape and position: Maildeno draws a centred circle
  }
  const colors: Array<{ color: string; position: number | null }> = [];
  for (const stop of stops) {
    const tokens = splitSpaces(stop);
    const color = parseColor(tokens[0], current);
    if (!color) continue;
    let position: number | null = null;
    for (const t of tokens.slice(1)) {
      const len = parseLen(t);
      if (len && len.unit === "%") position = Math.min(100, Math.max(0, len.n));
    }
    colors.push({ color: colorToString(color), position });
  }
  if (colors.length < 2) return null;
  // missing positions are spread evenly between the ones given
  colors[0].position ??= 0;
  colors[colors.length - 1].position ??= 100;
  for (let i = 1; i < colors.length - 1; i++) {
    if (colors[i].position !== null) continue;
    let j = i;
    while (colors[j].position === null) j++;
    const from = colors[i - 1].position as number;
    const to = colors[j].position as number;
    for (let k = i; k < j; k++) colors[k].position = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  return {
    type,
    direction,
    colors: colors.map((c) => ({ color: c.color, position: Math.round(c.position as number) })),
  };
};

export interface Fill {
  backgroundColor: string;
  backgroundGradient: BackgroundGradient;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
  /** A gradient was present but could not be read. */
  gradientLost: boolean;
  /** More than one background image or gradient layer: the extra layers were left out. */
  extraLayers: boolean;
}

/** Colour, image and gradient from an element's background. Null reads as transparent. */
export const readFill = (cs: ElStyle | null): Fill => {
  const empty: Fill = {
    ...NO_FILL,
    backgroundImage: "",
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
    gradientLost: false,
    extraLayers: false,
  };
  if (!cs) return empty;
  const colour = cs.color("background-color");
  const solid = colour && colour.a > 0.001 ? colour : null;
  const layers = splitCommas(cs.get("background-image") ?? "").filter((l) => l.toLowerCase() !== "none");
  let image = "";
  let gradient: Gradient | null = null;
  let lost = false;
  let extra = false;
  for (const layer of layers) {
    if (/^(repeating-)?(linear|radial)-gradient\(/i.test(layer)) {
      if (gradient) extra = true;
      else {
        gradient = parseGradient(layer, cs.textColor());
        if (!gradient) lost = true;
      }
    } else if (/^url\(/i.test(layer)) {
      if (image) extra = true;
      else image = urlOf(layer);
    }
  }
  // a gradient with no colour of its own: the fallback written before it, else its first stop
  const fallback = gradient && !solid ? cs.color(BACKGROUND_FALLBACK) : null;
  const kept = fallback && fallback.a > 0.001 ? fallback : null;
  const base = solid ? colorToString(solid) : kept ? colorToString(kept) : gradient ? gradient.colors[0].color : "transparent";
  const fill: Fill = {
    backgroundColor: base,
    backgroundGradient: {
      useGradient: gradient !== null,
      solid: base,
      gradient: gradient ?? { ...PAIR_GRADIENT, colors: PAIR_GRADIENT.colors.map((c) => ({ ...c })) },
    },
    backgroundImage: image,
    backgroundSize: image ? normalizeSize(cs.get("background-size"), "auto") : "cover",
    backgroundPosition: image ? normalizePosition(cs.get("background-position"), "left top") : "center center",
    backgroundRepeat: image ? normalizeRepeat(cs.get("background-repeat"), "repeat") : "no-repeat",
    gradientLost: lost,
    extraLayers: extra,
  };
  return fill;
};

// ─── Border, radius, shadow ───────────────────────────────────────────────────

const styleOf = (raw: string): string => (raw === "dashed" || raw === "dotted" ? raw : "solid");

export interface BorderRead {
  width: number;
  style: string;
  color: string;
  /** Only some sides have a border, or the sides differ: it was dropped. */
  partial: boolean;
}

/** One border for all four sides. Sides that differ are reported as partial and dropped. */
export const readBorder = (cs: ElStyle): BorderRead => {
  const sides = (["top", "right", "bottom", "left"] as const).map((s) => cs.border(s));
  const widths = sides.map((s) => s.width);
  if (widths.every((w) => w === 0)) return { width: 0, style: "solid", color: "#000000", partial: false };
  const first = sides[0];
  const same = sides.every(
    (s) =>
      Math.abs(s.width - first.width) < 0.01 &&
      s.style === first.style &&
      colorToString(s.color ?? { r: 0, g: 0, b: 0, a: 1 }) === colorToString(first.color ?? { r: 0, g: 0, b: 0, a: 1 }),
  );
  if (!same) return { width: 0, style: "solid", color: "#000000", partial: true };
  return {
    width: Math.max(1, Math.round(first.width)),
    style: styleOf(first.style),
    color: colorToString(first.color ?? { r: 0, g: 0, b: 0, a: 1 }),
    partial: false,
  };
};

export const radiusOf = (cs: ElStyle): BorderRadius => {
  const [topLeft, topRight, bottomRight, bottomLeft] = cs.radii();
  return toStoredBorderRadius({ topLeft, topRight, bottomRight, bottomLeft });
};

/** A row, column or button border including its radius. */
export const rowBorder = (b: BorderRead, radius: BorderRadius): Border => ({
  width: b.width,
  style: b.style,
  color: b.color,
  radius,
});

/** The border object an image, video or button keeps: no radius inside it. */
export const plainBorder = (b: BorderRead): { width: number; color: string; style: string } => ({
  width: b.width,
  color: b.width === 0 ? "transparent" : b.color,
  style: b.style,
});

export interface ShadowRead {
  shadow: BoxShadow;
  /** More than one shadow layer: the extra layers were left out. */
  extra: boolean;
}

const OFF: BoxShadow = { ...DEFAULT_BOX_SHADOW };

export const readShadow = (cs: ElStyle | null): ShadowRead => {
  if (!cs) return { shadow: { ...OFF }, extra: false };
  const raw = (cs.get("box-shadow") ?? "none").trim();
  if (!raw || raw.toLowerCase() === "none") return { shadow: { ...OFF }, extra: false };
  const layers = splitCommas(raw);
  const tokens = splitTopLevel(layers[0], (c) => /\s/.test(c));
  let inset = false;
  const lengths: number[] = [];
  let color: Rgba | null = null;
  for (const t of tokens) {
    if (t.toLowerCase() === "inset") {
      inset = true;
      continue;
    }
    const len = parseLen(t);
    if (len) {
      lengths.push(len.unit === "em" || len.unit === "rem" ? len.n * cs.fontSize() : len.n);
      continue;
    }
    const c = parseColor(t, cs.textColor());
    if (c) color = c;
  }
  if (lengths.length < 2) return { shadow: { ...OFF }, extra: layers.length > 1 };
  const shadow = normalizeBoxShadow({
    enabled: true,
    offsetX: lengths[0],
    offsetY: lengths[1],
    blur: Math.max(0, lengths[2] ?? 0),
    spread: lengths[3] ?? 0,
    color: colorToString(color ?? { r: 0, g: 0, b: 0, a: 1 }),
    inset,
  });
  return { shadow, extra: layers.length > 1 };
};

// ─── Alignment ────────────────────────────────────────────────────────────────

/**
 * Where a block sits in its container: auto margins centre it or push it to
 * one side, a float pushes it to a side, and otherwise it follows the text
 * alignment it inherits.
 */
export const blockAlign = (cs: ElStyle): "left" | "center" | "right" => {
  const auto = cs.autoMargins();
  if (auto.left && auto.right) return "center";
  if (auto.left) return "right";
  if (auto.right) return "left";
  const float = (cs.get("float") ?? "none").trim().toLowerCase();
  if (float === "right") return "right";
  if (float === "left") return "left";
  const parent = cs.parent;
  const align = (parent ?? cs).textAlign();
  return align === "justify" ? "left" : align;
};

// ─── Columns ──────────────────────────────────────────────────────────────────

export const verticalAlignOf = (cs: ElStyle): "top" | "middle" | "bottom" => {
  const raw = (cs.get("vertical-align") ?? "").trim().toLowerCase();
  if (raw === "middle") return "middle";
  if (raw === "bottom" || raw === "text-bottom") return "bottom";
  return "top";
};
