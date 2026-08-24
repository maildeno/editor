/**
 * hydrate.ts
 * Restores stripped defaults when importing an optimized JSON template.
 *
 * Strategy: deepMerge(DEFAULTS, saved) — saved value always wins;
 * stripped keys fall back to current defaults automatically.
 *
 * Now supports both new `children` shape and legacy `components` shape per column.
 * On hydration, columns are always written with `children` going forward.
 */

import { useEmailBuilderDefaults } from "../../core/useEmailBuilderDefault";
import {
  createDefaultVisibility,
  createDefaultHide,
} from "../../core/config/componentConfig";

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
  [key: string]: unknown;
}

interface NestedRow {
  id: string;
  type: "row";
  columns?: Column[];
  [key: string]: unknown;
}

interface RowSpacer {
  id: string;
  type: "row-spacer";
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

// ─── Structural defaults ──────────────────────────────────────────────────────

const ROW_DEFAULTS = {
  backgroundColor: "#ffffff",
  backgroundGradient: {
    useGradient: false,
    solid: "#ffffff",
    gradient: {
      type: "linear" as const,
      direction: "to right",
      colors: [
        { color: "#ffffff", position: 0 },
        { color: "#eeeeee", position: 100 },
      ],
    },
  },
  backgroundImage: "",
  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  border: { width: 0, style: "solid", color: "#000000", radius: 0 },
  minHeight: 0,
  gap: 12,
  mobileStack: true,
  visibility: createDefaultVisibility(),
} as const;

const ROW_SPACER_DEFAULTS = {
  backgroundColor: "transparent",
  backgroundGradient: {
    useGradient: false,
    solid: "transparent",
    gradient: {
      type: "linear" as const,
      direction: "to right",
      colors: [
        { color: "#ffffff", position: 0 },
        { color: "#eeeeee", position: 100 },
      ],
    },
  },
  visibility: createDefaultVisibility(),
} as const;

const COLUMN_DEFAULTS = {
  backgroundColor: "transparent",
  backgroundGradient: {
    useGradient: false,
    solid: "transparent",
    gradient: {
      type: "linear" as const,
      direction: "to right",
      colors: [
        { color: "#ffffff", position: 0 },
        { color: "#eeeeee", position: 100 },
      ],
    },
  },
  backgroundImage: "",
  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  border: { width: 0, style: "solid", color: "#000000", radius: 0 },
  verticalAlign: "top",
} as const;

const CANVAS_DEFAULTS = {
  language: "en-US",
  preheaderText: "View this email in your browser",
  bodyBackgroundColor: "#f9fafb",
  bodyBackgroundImage: "",
  bodyBackgroundSize: "cover",
  bodyBackgroundPosition: "center center",
  bodyBackgroundRepeat: "no-repeat",
  backgroundColor: "#ffffff",
  width: 600,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  mobileBreakpoint: 600,
} as const;

// ─── Deep merge ───────────────────────────────────────────────────────────────

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const deepMerge = <T extends Record<string, unknown>>(
  defaults: T,
  saved: Partial<T>,
): T => {
  const result = deepClone(defaults) as Record<string, unknown>;

  for (const key of Object.keys(saved)) {
    const savedVal = saved[key as keyof T];
    const defaultVal = defaults[key as keyof T];

    if (savedVal === null || savedVal === undefined) continue;

    if (
      typeof savedVal === "object" &&
      !Array.isArray(savedVal) &&
      typeof defaultVal === "object" &&
      defaultVal !== null &&
      !Array.isArray(defaultVal)
    ) {
      result[key] = deepMerge(
        defaultVal as Record<string, unknown>,
        savedVal as Record<string, unknown>,
      );
    } else {
      result[key] = savedVal;
    }
  }

  return result as T;
};

// ─── Component hydrator ───────────────────────────────────────────────────────

export const hydrateComponent = (comp: Component): Component => {
  const { defaultProps } = useEmailBuilderDefaults();

  // Resolve the component type key — new shape uses `componentType`, legacy uses `type`
  const typeKey = (comp.componentType ??
    comp.type) as keyof typeof defaultProps;
  const typeDefaults = defaultProps[typeKey] as any;

  if (!typeDefaults) {
    console.warn(
      `[Hydrator] Unknown component type "${typeKey}" — skipping hydration.`,
    );
    return comp;
  }

  const hydratedProps = deepMerge(
    typeDefaults as unknown as Record<string, unknown>,
    comp.props,
  );

  // Mobile overrides — ensure all keys exist with null baseline
  if (typeDefaults.mobile && typeof typeDefaults.mobile === "object") {
    hydratedProps.mobile = {
      ...typeDefaults.mobile,
      ...((hydratedProps.mobile as Record<string, unknown>) ?? {}),
    };
    if (
      hydratedProps.mobile &&
      !(hydratedProps.mobile as Record<string, unknown>).backgroundGradient
    ) {
      (hydratedProps.mobile as Record<string, unknown>).backgroundGradient =
        typeDefaults.mobile.backgroundGradient;
    }
  }

  // Visibility
  hydratedProps.visibility =
    (hydratedProps.visibility as VisibilityConfig | undefined) ??
    createDefaultVisibility();

  // Hide flags
  hydratedProps.desktopHide =
    (hydratedProps.desktopHide as boolean | undefined) ??
    createDefaultHide().desktopHide;
  hydratedProps.mobileHide =
    (hydratedProps.mobileHide as boolean | undefined) ??
    createDefaultHide().mobileHide;

  // Margin
  if (hydratedProps.margin === undefined && typeDefaults.margin) {
    hydratedProps.margin = { ...typeDefaults.margin };
  }

  // Padding
  if (hydratedProps.padding === undefined && typeDefaults.padding) {
    hydratedProps.padding = { ...typeDefaults.padding };
  }

  // Letter spacing
  if (
    hydratedProps.letterSpacing === undefined &&
    typeDefaults.letterSpacing !== undefined
  ) {
    hydratedProps.letterSpacing = typeDefaults.letterSpacing;
  }

  // Gradient — sync solid with backgroundColor
  if (hydratedProps.backgroundGradient) {
    const bg = hydratedProps.backgroundColor;
    if (bg) {
      (hydratedProps.backgroundGradient as { solid?: typeof bg }).solid = bg;
    }
  }

  // Background image props
  if (
    !hydratedProps.backgroundImage &&
    typeDefaults.backgroundImage !== undefined
  ) {
    hydratedProps.backgroundImage = typeDefaults.backgroundImage;
    hydratedProps.backgroundSize = typeDefaults.backgroundSize;
    hydratedProps.backgroundPosition = typeDefaults.backgroundPosition;
    hydratedProps.backgroundRepeat = typeDefaults.backgroundRepeat;
  }

  // Icon props — restore defaults only when the component type supports icons.
  // When icon is absent (stripped by optimizer), we restore the empty-string default
  // so the runtime never encounters undefined. When icon is present, we leave it
  // untouched and fill any missing companion props from defaults.
  if ("icon" in typeDefaults) {
    hydratedProps.icon =
      (hydratedProps.icon as string | undefined) ?? typeDefaults.icon;
    hydratedProps.iconAlt =
      (hydratedProps.iconAlt as string | undefined) ??
      typeDefaults.iconAlt ??
      "";
    hydratedProps.iconPosition =
      (hydratedProps.iconPosition as string | undefined) ??
      typeDefaults.iconPosition ??
      "before";
    hydratedProps.iconSize =
      (hydratedProps.iconSize as number | undefined) ??
      typeDefaults.iconSize ??
      20;
    hydratedProps.iconGap =
      (hydratedProps.iconGap as number | undefined) ??
      typeDefaults.iconGap ??
      8;
  }

  return {
    ...comp,
    // Ensure discriminated shape on output
    type: "component",
    componentType: typeKey as string,
    props: hydratedProps,
  };
};

// ─── Child hydrator (recursive) ───────────────────────────────────────────────

const hydrateChild = (child: CanvasChild): CanvasChild => {
  if (child.type === "component") return hydrateComponent(child as Component);
  // Legacy flat shape: type is the componentType string (e.g. "text", "heading")
  // Detect by checking whether a defaultProps entry exists for this type key.
  const { defaultProps } = useEmailBuilderDefaults();
  if ((child.type as string) in defaultProps) {
    // Normalize to discriminated shape then hydrate
    return hydrateComponent({
      ...(child as any),
      type: "component",
      componentType: child.type,
    } as Component);
  }
  // Nested row or spacer — recurse
  return hydrateRow(child as Row) as unknown as CanvasChild;
};

// ─── Column hydrator ──────────────────────────────────────────────────────────

const hydrateColumn = (col: Column): Column => {
  const rawKids: CanvasChild[] =
    col.children ?? (col.components as CanvasChild[]) ?? [];

  const { components: _c, children: _ch, ...colWithoutKids } = col;

  const hasExplicitBackground =
    col.backgroundColor !== undefined ||
    col.backgroundGradient !== undefined ||
    col.backgroundImage !== undefined;

  const { backgroundColor, backgroundGradient, ...defaultsWithoutBg } =
    COLUMN_DEFAULTS;

  let base = deepMerge(
    defaultsWithoutBg as unknown as Record<string, unknown>,
    colWithoutKids as Record<string, unknown>,
  );

  if (!hasExplicitBackground) {
    base.backgroundColor = backgroundColor;
    base.backgroundGradient = backgroundGradient;
  } else {
    base.backgroundColor = col.backgroundColor;
    base.backgroundGradient = col.backgroundGradient;
  }

  if (!col.backgroundImage) {
    base.backgroundImage = "";
    base.backgroundSize = "cover";
    base.backgroundPosition = "center center";
    base.backgroundRepeat = "no-repeat";
  }

  return {
    ...base,
    // Always write `children` on output; legacy `components` key is dropped
    children: rawKids.map(hydrateChild),
  } as unknown as Column;
};

// ─── Row-spacer hydrator ──────────────────────────────────────────────────────

const hydrateRowSpacer = (row: Row): Row => {
  const base = deepMerge(
    ROW_SPACER_DEFAULTS as unknown as Record<string, unknown>,
    row as unknown as Record<string, unknown>,
  );
  if (base.backgroundColor === undefined) base.backgroundColor = "transparent";
  return base as unknown as Row;
};

// ─── Row hydrator ─────────────────────────────────────────────────────────────

const hydrateRow = (row: Row): Row => {
  if (row.type === "row-spacer") return hydrateRowSpacer(row);

  const { columns, ...rowWithoutColumns } = row as NestedRow;

  const hasExplicitBackground =
    (row as NestedRow).backgroundColor !== undefined ||
    (row as NestedRow).backgroundGradient !== undefined ||
    (row as NestedRow).backgroundImage !== undefined;

  const { backgroundColor, backgroundGradient, ...defaultsWithoutBg } =
    ROW_DEFAULTS;

  let base = deepMerge(
    defaultsWithoutBg as unknown as Record<string, unknown>,
    rowWithoutColumns as unknown as Record<string, unknown>,
  );

  if (!hasExplicitBackground) {
    base.backgroundColor = backgroundColor;
    base.backgroundGradient = backgroundGradient;
  } else {
    base.backgroundColor = (row as NestedRow).backgroundColor;
    base.backgroundGradient = (row as NestedRow).backgroundGradient;
  }

  if (!(row as NestedRow).backgroundImage) {
    base.backgroundImage = "";
    base.backgroundSize = "cover";
    base.backgroundPosition = "center center";
    base.backgroundRepeat = "no-repeat";
  }

  if (base.minHeight === undefined) base.minHeight = 0;

  if (Array.isArray(columns)) {
    base.columns = columns.map(hydrateColumn);
  }

  return base as unknown as Row;
};

// ─── Canvas hydrator ──────────────────────────────────────────────────────────

export const hydrateCanvas = (canvas: Canvas): Canvas => {
  const base = deepMerge(
    CANVAS_DEFAULTS as unknown as Record<string, unknown>,
    canvas as unknown as Record<string, unknown>,
  );

  if (!canvas.bodyBackgroundImage) {
    base.bodyBackgroundImage = "";
    base.bodyBackgroundSize = "cover";
    base.bodyBackgroundPosition = "center center";
    base.bodyBackgroundRepeat = "no-repeat";
  }

  return base as unknown as Canvas;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const hydrateRows = (rows: Row[]): Row[] => rows.map(hydrateRow);
