/**
 * optimizeAI.ts
 * AI-facing counterpart to optimize.ts. Strips default/noise values from
 * rows, columns, components, and canvas before building the snapshot sent
 * to the AI model — separate pipeline so it can strip more aggressively
 * than the JSON-export pipeline without the two compromising each other.
 *
 * optimize.ts / hydrate.ts are NOT modified by this file and are unaffected.
 *
 * Two different kinds of "default" are handled differently, on purpose:
 *
 *   - STATELESS style props (margin, padding, border, letterSpacing, ...):
 *     no "user chose to remove this" meaning attached — just set vs. unset.
 *     Diffed against each component TYPE's real default via
 *     useEmailBuilderDefaults(), so this never drifts out of sync the way a
 *     hardcoded universal check (e.g. "is it all-zero") can for component
 *     types whose real default isn't zero. The AI doesn't lose anything by
 *     these being stripped: schemaBlock() in useEmailAIPrompts.ts already
 *     tells it every prop + its default, independent of what's in the
 *     snapshot. Snapshot = the diff; schema = the full menu.
 *
 *   - SELECTION-style fields (socials platforms, mobile overrides, the icon
 *     cluster): reflect a deliberate choice, not just set-vs-unset. Mirrored
 *     EXACTLY from optimize.ts's existing logic, unchanged, so this pipeline
 *     respects the same choices the export pipeline already does.
 *
 * Restoring what gets stripped here needs no new hydrate-side code: hydrate.ts's
 * hydrateComponent() already deep-merges against each type's real defaults
 * (via the same useEmailBuilderDefaults()), so it already restores anything
 * this file strips. See useEmailAISnapshot.ts's existing hydrateAIRows /
 * hydrateAIRow / hydrateAIComponent — those remain the AI hydration path,
 * unchanged.
 */

import { useEmailBuilderDefaults } from "../../core/useEmailBuilderDefault";

// ─── Types (same shapes as optimize.ts) ──────────────────────────────────────

interface VisibilityConfig {
  enabled: boolean;
  match: "all" | "any";
  rules: unknown[];
}

interface BorderConfig {
  width: number;
  style: string;
  color: string;
  radius?: number;
}

interface GradientConfig {
  useGradient: boolean;
  solid: string;
  gradient: {
    type: "linear" | "radial";
    direction: string;
    colors: Array<{ color: string; position: number }>;
  };
}

interface Component {
  id: string;
  type: string;
  componentType?: string;
  props: Record<string, unknown>;
}

type CanvasChild = Component | NestedRow | RowSpacer;

interface Column {
  id: string;
  width: number;
  children?: CanvasChild[];
  components?: Component[];
  backgroundColor?: string;
  backgroundGradient?: GradientConfig;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  padding?: Record<string, number>;
  border?: BorderConfig;
  verticalAlign?: string;
  [key: string]: unknown;
}

interface NestedRow {
  id: string;
  type: "row";
  name?: string;
  columns?: Column[];
  visibility?: VisibilityConfig;
  border?: BorderConfig;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  padding?: Record<string, number>;
  backgroundGradient?: GradientConfig;
  minHeight?: number;
  gap?: number;
  [key: string]: unknown;
}

interface RowSpacer {
  id: string;
  type: "row-spacer";
  name?: string;
  height?: number;
  backgroundColor?: string;
  backgroundGradient?: GradientConfig;
  visibility?: VisibilityConfig;
  [key: string]: unknown;
}

type Row = NestedRow | RowSpacer;

interface Canvas {
  language?: string;
  preheaderText?: string;
  bodyBackgroundColor?: string;
  bodyBackgroundImage?: string;
  bodyBackgroundSize?: string;
  bodyBackgroundPosition?: string;
  bodyBackgroundRepeat?: string;
  backgroundColor?: string;
  width?: number;
  padding?: Record<string, number>;
  mobileBreakpoint?: number;
  [key: string]: unknown;
}

interface SocialPlatform {
  name: string;
  link: string;
  enabled: boolean;
  icon: string;
}

// ─── Deep equality (drives the defaults-aware component diff below) ────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray && bIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    return arrA.every((v, i) => deepEqual(v, arrB[i]));
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => deepEqual(objA[k], objB[k]));
}

// ─── Structural-level predicates — mirrored EXACTLY from optimize.ts ────────
// Row/column/canvas-level stripping in optimize.ts already checks values
// (not references) and already matches hydrate.ts's ROW_DEFAULTS /
// COLUMN_DEFAULTS / CANVAS_DEFAULTS at these levels, so these are unchanged,
// not "fixed" — only the component level gets the new defaults-aware diff.

const isDefaultVisibility = (v: unknown): boolean => {
  if (!v || typeof v !== "object") return true;
  const vis = v as VisibilityConfig;
  if (Array.isArray(vis.rules) && vis.rules.length > 0) return false;
  return vis.enabled === false && vis.match === "all" && vis.rules.length === 0;
};

const isDefaultBorder = (b: unknown): boolean => {
  if (!b || typeof b !== "object") return true;
  const border = b as BorderConfig;
  return (
    border.width === 0 &&
    border.style === "solid" &&
    border.color === "#000000" &&
    (border.radius === undefined || border.radius === 0)
  );
};

const isDefaultGradient = (g: unknown): boolean => {
  if (!g || typeof g !== "object") return true;
  return (g as GradientConfig).useGradient === false;
};

const isAllZeroPadding = (padding: unknown): boolean => {
  if (!padding || typeof padding !== "object") return true;
  const p = padding as Record<string, number>;
  return p.top === 0 && p.right === 0 && p.bottom === 0 && p.left === 0;
};

const isNoIcon = (value: unknown): boolean =>
  value === null || value === undefined || value === "";

/**
 * Selection-style: mirrored EXACTLY from optimize.ts's optimizeSocialsPlatforms.
 * Strips platforms still in their default state (enabled=true, link=""), i.e.
 * never touched by the user. Platforms the user explicitly disabled, or gave
 * a real link, are kept as-is — same rule, same behavior, unchanged.
 */
const optimizeSocialsPlatforms = (
  platforms: unknown,
): SocialPlatform[] | undefined => {
  if (!Array.isArray(platforms)) return undefined;
  const kept = (platforms as SocialPlatform[]).filter(
    (p) => !(p.enabled === true && p.link === ""),
  );
  if (kept.length === 0) return undefined;
  return kept;
};

/** Selection-style: mirrored EXACTLY from optimize.ts's stripMobileOverrides. */
const stripMobileOverrides = (
  mobile: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mobile)) {
    if (value === null || value === undefined) continue;
    if (key === "backgroundGradient" && isDefaultGradient(value)) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

// ─── Scalar structural defaults ──────────────────────────────────────────────
// Mirrors hydrate.ts's ROW_DEFAULTS / COLUMN_DEFAULTS / CANVAS_DEFAULTS scalar
// values, kept local since hydrate.ts doesn't export them. These are plain
// stateless scalars (no selection semantics) that optimize.ts doesn't
// currently check at this level — new, additive stripping for the AI path
// only. Keep in sync if hydrate.ts's structural defaults ever change.

const ROW_SCALAR_DEFAULTS = { backgroundColor: "#ffffff", gap: 12 } as const;
const COLUMN_SCALAR_DEFAULTS = {
  backgroundColor: "transparent",
  verticalAlign: "top",
} as const;
const CANVAS_SCALAR_DEFAULTS = {
  language: "en-US",
  preheaderText: "View this email in your browser",
  bodyBackgroundColor: "#f9fafb",
  backgroundColor: "#ffffff",
  width: 600,
  mobileBreakpoint: 600,
} as const;

// ─── Component optimizer — defaults-aware, replaces hardcoded checks ───────

const optimizeComponentForAI = (comp: Component): Component => {
  const { defaultProps } = useEmailBuilderDefaults();
  const typeKey = (comp.componentType ?? comp.type) as string;
  const typeDefaults = (defaultProps as Record<string, any>)[typeKey];

  // Unknown/unregistered type — return untouched rather than guess.
  if (!typeDefaults) return comp;

  const optimized: Record<string, unknown> = {};
  const hasIcon = "icon" in comp.props;
  const iconIsUnset = hasIcon && isNoIcon(comp.props.icon);

  for (const [key, value] of Object.entries(comp.props)) {
    // Selection-style — mirrored exactly, not diffed against defaults.
    if (key === "mobile" && value && typeof value === "object") {
      const stripped = stripMobileOverrides(value as Record<string, unknown>);
      if (stripped) optimized.mobile = stripped;
      continue;
    }
    if (key === "platforms") {
      const kept = optimizeSocialsPlatforms(value);
      if (kept !== undefined) optimized.platforms = kept;
      continue;
    }
    // Icon cluster: same rule as optimize.ts — no icon set means the rest
    // of the cluster (size/gap/position/alt) has no visible effect either,
    // so it's dropped as a unit, regardless of individual override values.
    if (
      iconIsUnset &&
      ["icon", "iconAlt", "iconPosition", "iconSize", "iconGap"].includes(key)
    ) {
      continue;
    }

    // Everything else: stateless — strip when it matches THIS type's real
    // default (not a universal hardcoded rule).
    if (deepEqual(value, typeDefaults[key])) continue;

    optimized[key] = value;
  }

  return {
    id: comp.id,
    type: comp.type,
    ...(comp.componentType !== undefined && {
      componentType: comp.componentType,
    }),
    props: optimized,
  };
};

// ─── Child optimizer (recursive) ─────────────────────────────────────────────

const optimizeChildForAI = (child: CanvasChild): CanvasChild => {
  if (child.type === "component")
    return optimizeComponentForAI(child as Component);
  return optimizeRowForAI(child as Row) as unknown as CanvasChild;
};

// ─── Column optimizer — structural checks mirrored, scalars newly stripped ──

const optimizeColumnForAI = (col: Column): Partial<Column> => {
  const { id, width, children, components, ...rest } = col;
  const optimized: Record<string, unknown> = { ...rest };

  if (isDefaultBorder(col.border)) delete optimized.border;
  if (isDefaultGradient(col.backgroundGradient))
    delete optimized.backgroundGradient;
  if (isAllZeroPadding(col.padding)) delete optimized.padding;
  if (col.backgroundColor === COLUMN_SCALAR_DEFAULTS.backgroundColor)
    delete optimized.backgroundColor;
  if (col.verticalAlign === COLUMN_SCALAR_DEFAULTS.verticalAlign)
    delete optimized.verticalAlign;

  if (!col.backgroundImage) {
    delete optimized.backgroundImage;
    delete optimized.backgroundSize;
    delete optimized.backgroundPosition;
    delete optimized.backgroundRepeat;
  }

  const rawKids = children ?? components ?? [];
  const optimizedKids = rawKids.map(optimizeChildForAI);

  return { id, width, ...optimized, children: optimizedKids };
};

// ─── Row-spacer optimizer ─────────────────────────────────────────────────────

const optimizeRowSpacerForAI = (row: Row): Partial<Row> => {
  const { id, type, ...rest } = row as any;
  const optimized: Record<string, unknown> = { ...rest };

  if (isDefaultVisibility(row.visibility)) delete optimized.visibility;
  if (isDefaultGradient((row as RowSpacer).backgroundGradient))
    delete optimized.backgroundGradient;

  const { height, ...remainingOptimized } = optimized;
  return {
    id,
    type,
    height: height as number | undefined,
    ...remainingOptimized,
  };
};

// ─── Row optimizer ────────────────────────────────────────────────────────────

const optimizeRowForAI = (row: Row): Partial<Row> => {
  if (row.type === "row-spacer") return optimizeRowSpacerForAI(row);

  const { id, type, name, columns, ...rest } = row as any;
  const optimized: Record<string, unknown> = { ...rest };

  if (isDefaultVisibility((row as NestedRow).visibility))
    delete optimized.visibility;
  if (isDefaultBorder((row as NestedRow).border)) delete optimized.border;
  if (isDefaultGradient((row as NestedRow).backgroundGradient))
    delete optimized.backgroundGradient;
  if (isAllZeroPadding((row as NestedRow).padding)) delete optimized.padding;
  if (
    (row as NestedRow).backgroundColor === ROW_SCALAR_DEFAULTS.backgroundColor
  )
    delete optimized.backgroundColor;
  if ((row as NestedRow).gap === ROW_SCALAR_DEFAULTS.gap) delete optimized.gap;

  if (!(row as NestedRow).backgroundImage) {
    delete optimized.backgroundImage;
    delete optimized.backgroundSize;
    delete optimized.backgroundPosition;
    delete optimized.backgroundRepeat;
  }
  if ((row as NestedRow).minHeight === 0) delete optimized.minHeight;

  return {
    id,
    type,
    ...(name !== undefined && { name }),
    ...optimized,
    columns: columns?.map(optimizeColumnForAI),
  };
};

// ─── Canvas optimizer ─────────────────────────────────────────────────────────

export const optimizeCanvasForAI = (canvas: Canvas): Partial<Canvas> => {
  const optimized: Record<string, unknown> = { ...canvas };

  if (!canvas.bodyBackgroundImage) {
    delete optimized.bodyBackgroundImage;
    delete optimized.bodyBackgroundSize;
    delete optimized.bodyBackgroundPosition;
    delete optimized.bodyBackgroundRepeat;
  }
  if (isAllZeroPadding(canvas.padding)) delete optimized.padding;

  for (const [key, defaultValue] of Object.entries(CANVAS_SCALAR_DEFAULTS)) {
    if (canvas[key] === defaultValue) delete optimized[key];
  }

  return optimized;
};

// ─── Public API — same shape as optimize.ts, drop-in for buildAISnapshot ────

export const optimizeRowsForAI = (rows: Row[]): Partial<Row>[] =>
  rows.map(optimizeRowForAI);
