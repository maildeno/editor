// core/boxShadow.ts
// ─────────────────────────────────────────────────────────────────────────────
// The box shadow model, shared by everything that reads or writes one: the
// Shadow control in the Row, Column, Image and Button panels, the editor canvas,
// the Preview screen, and the HTML, MJML and React Email exporters.
//
// One shadow per element. The stored value is a plain object, so it saves and
// loads as JSON; `enabled` is a switch rather than the presence of the object,
// so a shadow you turn off keeps its values, and a mobile override can say
// "no shadow on mobile" over a desktop shadow (see `boxShadowMobileRule`).
//
// Pure, no Vue. Every reader goes through normalizeBoxShadow, so a value that
// is missing, partial or wrong (an old template, hand-edited JSON) is read as
// "no shadow" or as the defaults, and never reaches the CSS as written.
// ─────────────────────────────────────────────────────────────────────────────

import type { BoxShadow } from "../types/emailBuilder";
import { formatCssColor, parseCssColor } from "./cssColor";

export type { BoxShadow };

/**
 * The range of each field. One source of truth: the control's sliders use it,
 * and normalizeBoxShadow clamps to it, so a slider and the stored value never
 * disagree.
 */
export const BOX_SHADOW_LIMITS = {
  offset: { min: -50, max: 50 },
  blur: { min: 0, max: 100 },
  spread: { min: -50, max: 50 },
} as const;

export const DEFAULT_BOX_SHADOW: Readonly<BoxShadow> = Object.freeze({
  enabled: false,
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
  color: "rgba(0, 0, 0, 0.15)",
  inset: false,
});

/** A fresh object every call, for callers that are about to store it. */
export const createDefaultBoxShadow = (): BoxShadow => ({
  ...DEFAULT_BOX_SHADOW,
});

// ─── Presets ──────────────────────────────────────────────────────────────────

export interface BoxShadowPreset {
  id: string;
  label: string;
  shadow: Omit<BoxShadow, "enabled">;
}

export const BOX_SHADOW_PRESETS: readonly BoxShadowPreset[] = [
  {
    id: "soft",
    label: "Soft",
    shadow: {
      offsetX: 0,
      offsetY: 2,
      blur: 8,
      spread: 0,
      color: "rgba(0, 0, 0, 0.12)",
      inset: false,
    },
  },
  {
    id: "medium",
    label: "Medium",
    shadow: {
      offsetX: 0,
      offsetY: 6,
      blur: 16,
      spread: 0,
      color: "rgba(0, 0, 0, 0.18)",
      inset: false,
    },
  },
  {
    id: "strong",
    label: "Strong",
    shadow: {
      offsetX: 0,
      offsetY: 12,
      blur: 28,
      spread: -4,
      color: "rgba(0, 0, 0, 0.28)",
      inset: false,
    },
  },
  {
    id: "hard",
    label: "Hard",
    shadow: {
      offsetX: 4,
      offsetY: 4,
      blur: 0,
      spread: 0,
      color: "#000000",
      inset: false,
    },
  },
  {
    id: "inner",
    label: "Inner",
    shadow: {
      offsetX: 0,
      offsetY: 2,
      blur: 6,
      spread: 0,
      color: "rgba(0, 0, 0, 0.2)",
      inset: true,
    },
  },
];

// ─── Reading a value ──────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

/** A finite number inside [min, max], to two decimals, or the fallback. */
const toNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.round(clamp(n, min, max) * 100) / 100;
};

// The colour goes into an inline style attribute (or a JSX string) in the
// export, so it is checked, not trusted. Hex, rgb() and rgba() are read and
// rewritten by parseCssColor. What it cannot read is kept only when it is a
// plain colour function or a bare word (`hsl(…)`, `transparent`, `tomato`),
// whose characters cannot end a declaration or an attribute. Anything else,
// such as `red;}</style><script>` or `url(…)`, becomes the default colour.
const SAFE_FUNCTION_RE = /^(?:rgba?|hsla?)\(\s*[-+0-9a-z.%\s,/]*\)$/i;
const SAFE_WORD_RE = /^[a-z]{3,30}$/i;

export const normalizeShadowColor = (value: unknown): string => {
  if (typeof value !== "string") return DEFAULT_BOX_SHADOW.color;
  const s = value.trim();
  const parsed = parseCssColor(s);
  if (parsed) return formatCssColor(parsed);
  if (SAFE_FUNCTION_RE.test(s) || SAFE_WORD_RE.test(s)) return s;
  return DEFAULT_BOX_SHADOW.color;
};

/**
 * Any stored value to a complete, clamped BoxShadow. Missing fields take the
 * defaults; `enabled` and `inset` are true only when they are exactly true.
 * Never throws, and never returns the object it was given.
 */
export const normalizeBoxShadow = (raw?: unknown): BoxShadow => {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const { offset, blur, spread } = BOX_SHADOW_LIMITS;
  return {
    enabled: r.enabled === true,
    offsetX: toNumber(
      r.offsetX,
      DEFAULT_BOX_SHADOW.offsetX,
      offset.min,
      offset.max,
    ),
    offsetY: toNumber(
      r.offsetY,
      DEFAULT_BOX_SHADOW.offsetY,
      offset.min,
      offset.max,
    ),
    blur: toNumber(r.blur, DEFAULT_BOX_SHADOW.blur, blur.min, blur.max),
    spread: toNumber(
      r.spread,
      DEFAULT_BOX_SHADOW.spread,
      spread.min,
      spread.max,
    ),
    color: normalizeShadowColor(r.color),
    inset: r.inset === true,
  };
};

export const boxShadowEquals = (a: unknown, b: unknown): boolean => {
  const x = normalizeBoxShadow(a);
  const y = normalizeBoxShadow(b);
  return (
    x.enabled === y.enabled &&
    x.offsetX === y.offsetX &&
    x.offsetY === y.offsetY &&
    x.blur === y.blur &&
    x.spread === y.spread &&
    x.color === y.color &&
    x.inset === y.inset
  );
};

// ─── Writing CSS ──────────────────────────────────────────────────────────────

export interface BoxShadowCssOptions {
  /**
   * False for an <img>. An inset shadow is painted under an element's content,
   * and an image's content covers its whole box, so it would never show. The
   * flag is dropped and the shadow is drawn outside. Default true.
   */
  allowInset?: boolean;
}

/** True when the shadow would be drawn: on, visible colour, some size. */
export const isBoxShadowActive = (raw?: unknown): boolean => {
  const s = normalizeBoxShadow(raw);
  if (!s.enabled) return false;
  const rgba = parseCssColor(s.color);
  if (rgba ? rgba.a === 0 : s.color.toLowerCase() === "transparent") {
    return false;
  }
  return s.offsetX !== 0 || s.offsetY !== 0 || s.blur !== 0 || s.spread !== 0;
};

/**
 * The value of the `box-shadow` property, e.g. `0px 4px 12px 0px rgba(0, 0, 0,
 * 0.15)`, or "" when the shadow is not active. Lengths always carry their unit,
 * which is what email clients parse most reliably.
 */
export const boxShadowValue = (
  raw?: unknown,
  { allowInset = true }: BoxShadowCssOptions = {},
): string => {
  if (!isBoxShadowActive(raw)) return "";
  const s = normalizeBoxShadow(raw);
  return [
    ...(s.inset && allowInset ? ["inset"] : []),
    `${s.offsetX}px`,
    `${s.offsetY}px`,
    `${s.blur}px`,
    `${s.spread}px`,
    s.color,
  ].join(" ");
};

/**
 * The declaration for a mobile override, inside a media query. An override
 * that is switched off writes `none`: it is the way to take away a desktop
 * shadow on small screens.
 */
export const boxShadowMobileRule = (
  raw?: unknown,
  options?: BoxShadowCssOptions,
): string => `box-shadow: ${boxShadowValue(raw, options) || "none"} !important`;

// ─── Presets ──────────────────────────────────────────────────────────────────

/** A preset as a switched-on shadow. */
export const boxShadowFromPreset = (preset: BoxShadowPreset): BoxShadow => ({
  enabled: true,
  ...preset.shadow,
});

/** The preset the shadow's values match, ignoring `enabled`, or null. */
export const matchBoxShadowPreset = (raw?: unknown): BoxShadowPreset | null => {
  const s = normalizeBoxShadow(raw);
  return (
    BOX_SHADOW_PRESETS.find((p) =>
      boxShadowEquals({ ...p.shadow, enabled: s.enabled }, s),
    ) ?? null
  );
};

// ─── Clipping ─────────────────────────────────────────────────────────────────
// A shadow is painted outside its element, so an ancestor that clips its
// overflow cuts it off. Every row and column clips (`overflow: hidden`, in the
// canvas and in the export), for two reasons: it keeps wide content inside, and
// it rounds the corners of what a rounded row or column holds. A column with a
// square background in a rounded row would otherwise show its square corners
// outside the curve. With no padding around an image, a shadow on it would be
// cut off on every side, and the feature would look broken.
//
// The second job is the only one that needs the clip, and only where something
// inside can reach the curve. So a row or column stops clipping when something
// inside it has a shadow and there is no curve for the content to reach: it is
// square, or its padding keeps the content clear of all four rounded corners (a
// card with 40px of padding and a 20px radius never lets its content touch a
// corner). One whose content can reach a corner keeps clipping, as it has to,
// and a shadow inside it then needs padding. A template without shadows is
// untouched.
//
// An element's own overflow never clips its own shadow, only its ancestors'
// does, so a row's or column's own shadow does not count here. The one
// exception is a table cell: in a table with collapsed borders a <td> that has
// an overflow is drawn without its own shadow. A row's <td> is such a cell, so
// the exports keep a row's clip off it when the row has a shadow (see
// buildRowBox in export/shared/nodeBox.ts).

/** The component types that have a shadow. */
const SHADOW_COMPONENT_TYPES = new Set(["image", "button"]);

interface ShadowHolder {
  boxShadow?: unknown;
  mobile?: { boxShadow?: unknown } | null;
}

/** True when the shadow is on for desktop, for mobile, or for both. */
export const hasActiveShadow = (holder?: ShadowHolder | null): boolean =>
  !!holder &&
  (isBoxShadowActive(holder.boxShadow) ||
    isBoxShadowActive(holder.mobile?.boxShadow));

/** True when at least one column of the row has a shadow of its own. */
export const columnsHaveShadow = (row: any): boolean =>
  Array.isArray(row?.columns) && row.columns.some(hasActiveShadow);

/** True when something inside this row or column has a shadow. */
export const hasShadowInside = (container: any): boolean => {
  if (!container) return false;

  // A row: look at each column, and what it holds.
  if (Array.isArray(container.columns)) {
    return container.columns.some(
      (col: any) => hasActiveShadow(col) || hasShadowInside(col),
    );
  }

  // A column: components, and nested rows.
  const kids: any[] = container.children ?? container.components ?? [];
  return kids.some((kid: any) => {
    if (kid?.type === "row")
      return hasActiveShadow(kid) || hasShadowInside(kid);
    if (kid?.type === "row-spacer") return false;
    return (
      SHADOW_COMPONENT_TYPES.has(kid?.componentType ?? kid?.type) &&
      hasActiveShadow(kid?.props)
    );
  });
};

interface Sides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

const side = (v: unknown): number => (typeof v === "number" && v > 0 ? v : 0);

/**
 * Whether content inside a box can touch the curve of one of its rounded
 * corners. The clip follows the padding edge, so the border width comes off the
 * radius. Content starts at the padding, and a corner of it is clear of the
 * curve when that point is inside the arc: either side's padding is at least
 * the radius, or both are less but the point is still inside the circle.
 */
export const cornersReachContent = (
  radius: number,
  borderWidth: number,
  padding?: Sides | null,
): boolean => {
  const r = Math.max(0, (radius || 0) - (borderWidth || 0));
  if (r === 0) return false;
  const reaches = (x: number, y: number): boolean =>
    x < r && y < r && (r - x) ** 2 + (r - y) ** 2 > r * r;
  const top = side(padding?.top);
  const right = side(padding?.right);
  const bottom = side(padding?.bottom);
  const left = side(padding?.left);
  return (
    reaches(left, top) ||
    reaches(right, top) ||
    reaches(right, bottom) ||
    reaches(left, bottom)
  );
};

/**
 * Whether a row or column keeps `overflow: hidden`. Always, except when a shadow
 * inside it would be cut off and the clip has no rounded corner to protect:
 * the node is square, or its padding keeps everything inside it clear of the
 * curve. The clip is one declaration for both screen sizes, so a corner that
 * the content can reach on desktop or on mobile keeps it.
 */
export const clipsOverflow = (node: any): boolean => {
  if (!hasShadowInside(node)) return true;
  const border = node?.border ?? {};
  const mobile = node?.mobile ?? {};
  const onDesktop = cornersReachContent(
    border.radius ?? 0,
    border.width ?? 0,
    node?.padding,
  );
  const onMobile = cornersReachContent(
    mobile.border?.radius ?? border.radius ?? 0,
    mobile.border?.width ?? border.width ?? 0,
    mobile.padding ? { ...node?.padding, ...mobile.padding } : node?.padding,
  );
  return onDesktop || onMobile;
};
