/**
 * optimize.ts
 * Strips default/noise values from rows, columns, components, and canvas before
 * JSON export. Pairs with hydrate.ts — everything stripped here is restored on import.
 *
 * Supports both new `children` shape and legacy `components` shape per column.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** New discriminated shape uses "component"; legacy uses the componentType directly */
  type: string;
  /** Present when type === "component" */
  componentType?: string;
  props: Record<string, unknown>;
}

type CanvasChild = Component | NestedRow | RowSpacer;

interface Column {
  id: string;
  width: number;
  /** New shape */
  children?: CanvasChild[];
  /** Legacy shape — kept for backward compat */
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

export interface NestedRow {
  id: string;
  type: "row";
  name?: string;
  columns?: Column[];
  visibility?: VisibilityConfig;
  border?: BorderConfig;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  padding?: Record<string, number>;
  backgroundGradient?: GradientConfig;
  minHeight?: number;
  [key: string]: unknown;
}

export interface RowSpacer {
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

export interface Canvas {
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

// ─── Predicates ───────────────────────────────────────────────────────────────

const isNullOrUndefined = (v: unknown): v is null | undefined =>
  v === null || v === undefined;

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

const isDefaultHideFlag = (value?: boolean): boolean => value === false;

const isAllZeroMargin = (margin: unknown): boolean => {
  if (!margin || typeof margin !== "object") return true;
  const m = margin as Record<string, number>;
  return m.top === 0 && m.right === 0 && m.bottom === 0 && m.left === 0;
};

const isAllZeroPadding = (padding: unknown): boolean => {
  if (!padding || typeof padding !== "object") return true;
  const p = padding as Record<string, number>;
  return p.top === 0 && p.right === 0 && p.bottom === 0 && p.left === 0;
};

const isDefaultLetterSpacing = (value: unknown): boolean => value === 0;

/** True when no icon is set — all icon-related props can be stripped. */
const isNoIcon = (value: unknown): boolean =>
  value === null || value === undefined || value === "";

// ─── Socials platform optimizer ───────────────────────────────────────────────

interface SocialPlatform {
  name: string;
  link: string;
  enabled: boolean;
  icon: string;
}

/**
 * Strips socials platforms that are in their default state:
 *   - enabled === true  (the out-of-the-box value)
 *   - link === ""       (no URL has been set by the user)
 *
 * A platform is kept as-is when either:
 *   - enabled === false  (user explicitly disabled it), or
 *   - link is non-empty  (user has configured a URL)
 *
 * hydrate.ts restores the full default platform list on import,
 * so platforms omitted here are automatically recovered.
 */
const optimizeSocialsPlatforms = (
  platforms: unknown,
): SocialPlatform[] | undefined => {
  if (!Array.isArray(platforms)) return undefined;

  const kept = (platforms as SocialPlatform[]).filter(
    (p) => !(p.enabled === true && p.link === ""),
  );

  // All platforms are in default state — strip the whole array
  if (kept.length === 0) return undefined;

  return kept;
};

// ─── Mobile override stripper ─────────────────────────────────────────────────

const stripMobileOverrides = (
  mobile: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mobile)) {
    if (isNullOrUndefined(value)) continue;
    if (key === "backgroundGradient" && isDefaultGradient(value)) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

// ─── Component optimizer ──────────────────────────────────────────────────────

const optimizeComponent = (comp: Component): Component => {
  const optimized: Record<string, unknown> = { ...comp.props };

  if (comp.props.mobile && typeof comp.props.mobile === "object") {
    const strippedMobile = stripMobileOverrides(
      comp.props.mobile as Record<string, unknown>,
    );
    if (strippedMobile) {
      optimized.mobile = strippedMobile;
    } else {
      delete optimized.mobile;
    }
  }

  if (isDefaultVisibility(comp.props.visibility)) delete optimized.visibility;
  if (isDefaultHideFlag(comp.props.desktopHide as boolean))
    delete optimized.desktopHide;
  if (isDefaultHideFlag(comp.props.mobileHide as boolean))
    delete optimized.mobileHide;
  if (isAllZeroMargin(comp.props.margin)) delete optimized.margin;
  if (isAllZeroPadding(comp.props.padding)) delete optimized.padding;
  if (isDefaultGradient(comp.props.backgroundGradient))
    delete optimized.backgroundGradient;
  if (isDefaultLetterSpacing(comp.props.letterSpacing))
    delete optimized.letterSpacing;

  if (!comp.props.backgroundImage) {
    delete optimized.backgroundImage;
    delete optimized.backgroundSize;
    delete optimized.backgroundPosition;
    delete optimized.backgroundRepeat;
  }

  // Strip icon-related props when no icon is set — hydrate.ts restores defaults on import.
  // Only applies to components that carry a top-level `icon` prop (e.g. button).
  // Guards against falsely stripping unrelated `iconSize` props on other components (e.g. socials).
  if ("icon" in comp.props && isNoIcon(comp.props.icon)) {
    delete optimized.icon;
    delete optimized.iconAlt;
    delete optimized.iconPosition;
    delete optimized.iconSize;
    delete optimized.iconGap;
  }

  // Socials: strip platforms that are still in their default state
  // (enabled=true, link=""). Only platforms the user has actually
  // configured (non-empty link) or explicitly disabled are kept.
  // hydrate.ts restores the full default list on import.
  if ("platforms" in comp.props) {
    const optimizedPlatforms = optimizeSocialsPlatforms(comp.props.platforms);
    if (optimizedPlatforms === undefined) {
      delete optimized.platforms;
    } else {
      optimized.platforms = optimizedPlatforms;
    }
  }

  // Key order: id → type → componentType → props
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

/**
 * Optimizes a single child element.
 * Components are leaf-optimized; nested rows recurse through optimizeRow.
 */
const optimizeChild = (child: CanvasChild): CanvasChild => {
  if (child.type === "component") return optimizeComponent(child as Component);
  // Nested row or spacer — recurse
  return optimizeRow(child as Row) as unknown as CanvasChild;
};

// ─── Column optimizer ─────────────────────────────────────────────────────────

const optimizeColumn = (col: Column): Partial<Column> => {
  const { id, width, children, components, ...rest } = col;
  const optimized: Record<string, unknown> = { ...rest };

  if (isDefaultBorder(col.border)) delete optimized.border;
  if (isDefaultGradient(col.backgroundGradient))
    delete optimized.backgroundGradient;
  if (isAllZeroPadding(col.padding)) delete optimized.padding;

  if (!col.backgroundImage) {
    delete optimized.backgroundImage;
    delete optimized.backgroundSize;
    delete optimized.backgroundPosition;
    delete optimized.backgroundRepeat;
  }

  // Prefer `children`; fall back to `components` for legacy data
  const rawKids = children ?? components ?? [];
  const optimizedKids = rawKids.map(optimizeChild);

  return {
    id,
    width,
    ...optimized,
    // Always write as `children` going forward
    children: optimizedKids,
  };
};

// ─── Row-spacer optimizer ─────────────────────────────────────────────────────

const optimizeRowSpacer = (row: Row): Partial<Row> => {
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

const optimizeRow = (row: Row): Partial<Row> => {
  if (row.type === "row-spacer") return optimizeRowSpacer(row);

  const { id, type, name, columns, ...rest } = row as any;
  const optimized: Record<string, unknown> = { ...rest };

  if (isDefaultVisibility((row as NestedRow).visibility))
    delete optimized.visibility;
  if (isDefaultBorder((row as NestedRow).border)) delete optimized.border;
  if (isDefaultGradient((row as NestedRow).backgroundGradient))
    delete optimized.backgroundGradient;
  if (isAllZeroPadding((row as NestedRow).padding)) delete optimized.padding;

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
    columns: columns?.map(optimizeColumn),
  };
};

// ─── Canvas optimizer ─────────────────────────────────────────────────────────

export const optimizeCanvas = (canvas: Canvas): Partial<Canvas> => {
  const optimized: Record<string, unknown> = { ...canvas };

  if (!canvas.bodyBackgroundImage) {
    delete optimized.bodyBackgroundImage;
    delete optimized.bodyBackgroundSize;
    delete optimized.bodyBackgroundPosition;
    delete optimized.bodyBackgroundRepeat;
  }

  if (isAllZeroPadding(canvas.padding)) delete optimized.padding;

  return optimized;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const optimizeRows = (rows: Row[]): Partial<Row>[] =>
  rows.map(optimizeRow);
