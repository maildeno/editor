// export/shared/styles.ts
// Universal style builders used across HTML, React Email, and MJML generators.
// These ensure visual parity between all export formats.

// ─── Gradient CSS builder ─────────────────────────────────────────────────────

export const buildGradientCss = (bg: any): string => {
  const { type, direction, colors } = bg.gradient;
  const stops = colors.map((c: any) => `${c.color} ${c.position}%`).join(", ");
  return type === "radial"
    ? `radial-gradient(circle at center, ${stops})`
    : `linear-gradient(${direction}, ${stops})`;
};

/**
 * Returns the background CSS strings for a row, column, or spacer (HTML format).
 * Handles solid colour, gradient (with Outlook solid fallback), and image.
 */
export const buildBackgroundStyles = (obj: any): string[] => {
  const styles: string[] = [];

  const bg = obj.backgroundGradient;
  const hasGradient =
    bg?.useGradient === true &&
    Array.isArray(bg?.gradient?.colors) &&
    bg.gradient.colors.length >= 2;

  if (hasGradient) {
    const gradientCss = buildGradientCss(bg);
    const solid = bg.solid || obj.backgroundColor || "";
    // Solid first → Outlook reads background-color (ignores `background` shorthand)
    // Gradient second → modern clients override with the gradient
    if (solid && solid !== "transparent")
      styles.push(`background-color:${solid}`);
    styles.push(`background:${gradientCss}`);
  } else if (obj.backgroundColor && obj.backgroundColor !== "transparent") {
    styles.push(`background-color:${obj.backgroundColor}`);
  }

  if (obj.backgroundImage) {
    styles.push(`background-image:url('${obj.backgroundImage}')`);
    styles.push(`background-size:${obj.backgroundSize}`);
    styles.push(`background-position:${obj.backgroundPosition}`);
    styles.push(`background-repeat:${obj.backgroundRepeat}`);
  }

  return styles;
};

/**
 * React-style version of buildBackgroundStyles.
 * Returns a camelCase style object (suitable for JSX style={{ }}).
 */
export const buildBackgroundStylesReact = (
  obj: any,
): Record<string, string> => {
  const styles: Record<string, string> = {};

  const bg = obj.backgroundGradient;
  const hasGradient =
    bg?.useGradient === true &&
    Array.isArray(bg?.gradient?.colors) &&
    bg.gradient.colors.length >= 2;

  if (hasGradient) {
    const gradientCss = buildGradientCss(bg);
    const solid = bg.solid || obj.backgroundColor || "";
    if (solid && solid !== "transparent") styles.backgroundColor = solid;
    styles.background = gradientCss;
  } else if (obj.backgroundColor && obj.backgroundColor !== "transparent") {
    styles.backgroundColor = obj.backgroundColor;
  }

  if (obj.backgroundImage) {
    styles.backgroundImage = `url(${obj.backgroundImage})`;
    styles.backgroundSize = obj.backgroundSize;
    styles.backgroundPosition = obj.backgroundPosition;
    styles.backgroundRepeat = obj.backgroundRepeat;
  }

  return styles;
};

// ─── Mobile stack gap CSS builder ────────────────────────────────────────────
//
// Generates @media-query CSS for every gap value actually used in the rows.
// The HTML / React / MJML exports all call this so the output is consistent
// and not limited to the legacy hard-coded set (12 / 16 / 20 / 24 / 28 / 32).
//
// When `mobileStack` is true and columns are stacked, gap <td>s must become
// vertical spacers instead of horizontal ones. We render:
//   display:block + width:100% (spacer becomes a full-width block element)
//   height + line-height        (gives it the desired vertical gap)
//
// Tree traversal:
//   Rows can be nested inside columns (col.children / col.components may
//   contain child rows). We must walk the entire tree, not just the top
//   level, otherwise nested rows that opt into mobileStack with a gap never
//   get their corresponding media-query CSS emitted.
//
// Backward compat:
//   Columns expose children under either `children` (current) or
//   `components` (legacy) — we read whichever is present, matching the
//   convention used in useEmailExportEngine.walkLeafComponents.
//
// Depth guard:
//   Mirrors the canvas-side MAX_DEPTH so a malformed tree (circular refs
//   or deeper-than-allowed nesting) can't cause unbounded recursion at
//   export time.
//
// Values are de-duplicated and sorted so output is deterministic.

const MAX_GAP_RECURSION_DEPTH = 5;

const collectGapValues = (
  rows: any[],
  gapValues: Set<number>,
  depth: number,
): void => {
  if (depth >= MAX_GAP_RECURSION_DEPTH) return;
  if (!Array.isArray(rows)) return;

  for (const row of rows) {
    if (!row || row.type === "row-spacer") continue;

    if (row.mobileStack && (row.gap ?? 0) > 0) {
      gapValues.add(row.gap);
    }

    // Recurse into nested rows that live inside this row's columns.
    const columns = row.columns;
    if (!Array.isArray(columns)) continue;

    for (const col of columns) {
      const kids = col?.children ?? col?.components;
      if (!Array.isArray(kids) || kids.length === 0) continue;

      // Only child entries that are themselves rows matter here; leaf
      // components don't carry mobileStack/gap. Filtering keeps the call
      // cheap and the recursion shallow.
      const nestedRows = kids.filter((c: any) => c?.type === "row");
      if (nestedRows.length > 0) {
        collectGapValues(nestedRows, gapValues, depth + 1);
      }
    }
  }
};

export const buildMobileStackGapCSS = (rows: any[]): string => {
  const gapValues = new Set<number>();

  collectGapValues(rows, gapValues, 0);

  if (gapValues.size === 0) return "";

  const sorted = [...gapValues].sort((a, b) => a - b);

  const displayBlock =
    sorted.map((g) => `.mobile-stack.gap-${g}`).join(",\n") +
    " { display:block !important; width:100% !important; }";

  const heights = sorted
    .map(
      (g) =>
        `.mobile-stack.gap-${g} { height:${g}px !important; line-height:${g}px !important; }`,
    )
    .join("\n");

  return `${displayBlock}\n${heights}`;
};
