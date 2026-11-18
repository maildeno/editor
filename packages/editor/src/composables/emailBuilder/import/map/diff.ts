// import/map/diff.ts
// ─────────────────────────────────────────────────────────────────────────────
// Desktop props vs phone props → the sparse `mobile` object
//
// Maildeno stores no mobile version of a node, only the keys that change on
// mobile. Each node type has a fixed list of keys it can override (the ones its
// exporter turns into CSS inside the media query). This module compares the two
// reads key by key, in Maildeno's value space, and keeps the phone value of
// each key that differs.
//
// Two rules from how the exporter writes overrides:
//   - an override replaces a whole object, so a changed padding keeps all four
//     sides, a changed border keeps width, style, colour and radius;
//   - a background is a pair: if the colour or the gradient changes, both are
//     written, or the export draws no background at all.
// ─────────────────────────────────────────────────────────────────────────────

import { borderRadiusEquals } from "../../core/borderRadius";
import { boxShadowEquals } from "../../core/boxShadow";
import type { BlockType } from "../structure/ir";

const TEXT_KEYS = [
  "fontSize",
  "lineHeight",
  "color",
  "fontWeight",
  "fontFamily",
  "fontStyle",
  "letterSpacing",
  "backgroundColor",
  "backgroundGradient",
  "textTransform",
  "textDecoration",
  "align",
  "margin",
  "padding",
] as const;

/** The keys each block can override on mobile. */
export const MOBILE_KEYS: Record<BlockType, readonly string[]> = {
  paragraph: TEXT_KEYS,
  heading: TEXT_KEYS.filter((k) => k !== "fontStyle"),
  list: [
    "fontSize",
    "lineHeight",
    "fontFamily",
    "letterSpacing",
    "color",
    "backgroundColor",
    "backgroundGradient",
    "margin",
    "padding",
    "itemSpacing",
  ],
  button: [
    "fontSize",
    "fontWeight",
    "fontFamily",
    "letterSpacing",
    "backgroundColor",
    "backgroundGradient",
    "color",
    "padding",
    "margin",
    "borderRadius",
    "border",
    "boxShadow",
    "align",
  ],
  anchor: ["fontSize", "fontWeight", "fontFamily", "letterSpacing", "color", "textDecoration", "margin", "padding", "align"],
  image: ["width", "height", "align", "margin", "padding", "borderRadius", "border", "boxShadow"],
  video: ["width", "height", "align", "margin", "padding", "borderRadius", "border"],
  divider: ["backgroundColor", "backgroundGradient", "height", "width", "margin", "padding", "align"],
  spacer: ["height", "backgroundColor", "backgroundGradient"],
  menu: [
    "fontSize",
    "lineHeight",
    "fontWeight",
    "fontFamily",
    "fontStyle",
    "letterSpacing",
    "color",
    "textTransform",
    "textDecoration",
    "backgroundColor",
    "backgroundGradient",
    "spacing",
    "align",
    "margin",
    "padding",
  ],
  socials: ["iconSize", "spacing", "align", "margin", "padding"],
};

export const ROW_MOBILE_KEYS = [
  "backgroundColor",
  "backgroundGradient",
  "padding",
  "border",
  "boxShadow",
  "minHeight",
  "gap",
] as const;

export const COLUMN_MOBILE_KEYS = [
  "backgroundColor",
  "backgroundGradient",
  "padding",
  "border",
  "boxShadow",
  "verticalAlign",
] as const;

export const SPACER_MOBILE_KEYS = ["height", "backgroundColor", "backgroundGradient"] as const;

// ─── Comparison ───────────────────────────────────────────────────────────────

const same = (a: unknown, b: unknown): boolean => {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.005;
  if (a === b) return true;
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
};

const sameBorder = (a: unknown, b: unknown): boolean => {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return same(a, b);
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  return (
    same(x.width, y.width) &&
    same(x.style, y.style) &&
    same(x.color, y.color) &&
    ("radius" in x || "radius" in y ? borderRadiusEquals(x.radius, y.radius) : true)
  );
};

export const sameValue = (key: string, a: unknown, b: unknown): boolean => {
  if (key === "boxShadow") return boxShadowEquals(a, b);
  if (key === "borderRadius") return borderRadiusEquals(a, b);
  if (key === "border") return sameBorder(a, b);
  return same(a, b);
};

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/**
 * The keys of `keys` whose phone value differs from the desktop value, with
 * the phone value. An empty object means no overrides.
 */
export const diffKeys = (
  keys: readonly string[],
  desktop: Record<string, unknown>,
  phone: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  let backgroundChanged = false;
  for (const key of keys) {
    if (key === "backgroundColor" || key === "backgroundGradient") {
      if (!same(desktop[key], phone[key])) backgroundChanged = true;
      continue;
    }
    if (!sameValue(key, desktop[key], phone[key])) out[key] = clone(phone[key]);
  }
  if (backgroundChanged) {
    out.backgroundColor = clone(phone.backgroundColor);
    out.backgroundGradient = clone(phone.backgroundGradient);
  }
  return out;
};
