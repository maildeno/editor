// core/borderRadius.ts
// ─────────────────────────────────────────────────────────────────────────────
// The corner radius model, shared by everything that reads or writes one: the
// Border Radius control in the Row, Column, Image, Video and Button panels, the
// editor canvas, the Preview screen, the Saved Rows thumbnails, and the HTML,
// MJML and React Email exporters.
//
// A radius is saved in one of two forms:
//
//   8                                  one number: all four corners
//   { topLeft: 8, topRight: 8,         one number per corner
//     bottomRight: 0, bottomLeft: 0 }
//
// The number is what every template saved before 0.4.22 holds, and it stays the
// saved form whenever the four corners are equal (toStoredBorderRadius). A
// template that does not use individual corners therefore saves exactly as it
// did, and anything that reads a radius as a plain number keeps working for it.
//
// Pure, no Vue. Every reader goes through normalizeBorderRadius, so a value that
// is missing, partial or wrong (an old template, hand-edited JSON) is read as
// zero or as the fallback, and never reaches the CSS as written.
// ─────────────────────────────────────────────────────────────────────────────

import type { BorderRadius, BorderRadiusCorners } from "../types/emailBuilder";

export type { BorderRadius, BorderRadiusCorners };

/** The corners in CSS order: the order `border-radius` lists them in. */
export const BORDER_RADIUS_CORNERS = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
] as const;

export type BorderRadiusCorner = (typeof BORDER_RADIUS_CORNERS)[number];

/**
 * The range of the Border Radius control, in px. The control clamps to it. A
 * stored value is not clamped to it (see MAX_STORED), so a template that holds
 * a larger radius, such as a pill's 999, is exported as it always was.
 */
export const BORDER_RADIUS_LIMITS = { min: 0, max: 100 } as const;

/**
 * The largest radius a reader accepts. It is far above anything the control
 * offers; it only keeps a hand-edited 1e308 from reaching the CSS as an
 * exponent.
 */
const MAX_STORED = 9999;

// ─── Reading a value ──────────────────────────────────────────────────────────

/** A finite number from 0 to MAX_STORED, or null when `value` is not one. */
const readCorner = (value: unknown): number | null => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), MAX_STORED);
};

const uniform = (n: number): BorderRadiusCorners => ({
  topLeft: n,
  topRight: n,
  bottomRight: n,
  bottomLeft: n,
});

/**
 * Any stored value to four corner radii. A number is the same radius on every
 * corner. An object is read corner by corner, and a corner it leaves out, or
 * holds something unusable in, is 0. Anything else (nothing, null, text that is
 * not a number) is `fallback` on every corner, which is how a button that has
 * lost its radius still previews with the default one. Never throws, and never
 * returns the object it was given.
 */
export const normalizeBorderRadius = (
  raw?: unknown,
  fallback = 0,
): BorderRadiusCorners => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    return {
      topLeft: readCorner(r.topLeft) ?? 0,
      topRight: readCorner(r.topRight) ?? 0,
      bottomRight: readCorner(r.bottomRight) ?? 0,
      bottomLeft: readCorner(r.bottomLeft) ?? 0,
    };
  }
  return uniform(readCorner(raw) ?? readCorner(fallback) ?? 0);
};

const allEqual = (r: BorderRadiusCorners): boolean =>
  r.topLeft === r.topRight &&
  r.topRight === r.bottomRight &&
  r.bottomRight === r.bottomLeft;

/** True when the four corners have the same radius. */
export const isUniformBorderRadius = (raw?: unknown): boolean =>
  allEqual(normalizeBorderRadius(raw));

/** True when at least one corner is rounded. */
export const hasBorderRadius = (raw?: unknown): boolean => {
  const r = normalizeBorderRadius(raw);
  return (
    r.topLeft > 0 || r.topRight > 0 || r.bottomRight > 0 || r.bottomLeft > 0
  );
};

/**
 * True when the two radii round the same corners by the same amounts, whatever
 * form each is stored in: 8 and { all four 8 } are equal, and so are a missing
 * radius and 0.
 */
export const borderRadiusEquals = (a: unknown, b: unknown): boolean => {
  const x = normalizeBorderRadius(a);
  const y = normalizeBorderRadius(b);
  return BORDER_RADIUS_CORNERS.every((c) => x[c] === y[c]);
};

// ─── Writing a value ──────────────────────────────────────────────────────────

/**
 * The form a radius is saved in: a number when the four corners are equal, and
 * an object with all four corners otherwise. A fresh value every call.
 */
export const toStoredBorderRadius = (raw?: unknown): BorderRadius => {
  const r = normalizeBorderRadius(raw);
  return allEqual(r) ? r.topLeft : r;
};

/** `raw` with one corner set to `value`, in its saved form. */
export const withBorderRadiusCorner = (
  raw: unknown,
  corner: BorderRadiusCorner,
  value: number,
): BorderRadius =>
  toStoredBorderRadius({ ...normalizeBorderRadius(raw), [corner]: value });

/** The same radius on all four corners, in its saved form: a number. */
export const uniformBorderRadius = (value: number): number =>
  normalizeBorderRadius(value).topLeft;

/**
 * A copy that shares nothing with `raw`, so a mobile override and the desktop
 * value it started from never end up as one object. Numbers, and anything that
 * is not an object, come back as they are.
 */
export const cloneBorderRadius = <T>(raw: T): T =>
  raw && typeof raw === "object" ? ({ ...(raw as object) } as T) : raw;

// ─── Writing CSS ──────────────────────────────────────────────────────────────

/**
 * The value of the `border-radius` property: `8px` when the corners are equal,
 * which is what the editor has always written, and all four otherwise, in CSS
 * order (top left, top right, bottom right, bottom left): `8px 8px 0px 0px`.
 * Lengths always carry their unit, which email clients parse most reliably.
 */
export const borderRadiusValue = (raw?: unknown, fallback = 0): string => {
  const r = normalizeBorderRadius(raw, fallback);
  return allEqual(r)
    ? `${r.topLeft}px`
    : `${r.topLeft}px ${r.topRight}px ${r.bottomRight}px ${r.bottomLeft}px`;
};

/** The declaration for a mobile override, inside a media query. */
export const borderRadiusMobileRule = (raw?: unknown): string =>
  `border-radius: ${borderRadiusValue(raw)} !important`;
