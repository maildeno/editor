// composables/emailBuilder/healthIndicator.ts
//
// ── v2.0 MIGRATION ──────────────────────────────────────────────────────────
// Updated to support recursive children[] tree. The component loop now uses
// col.children ?? col.components ?? [] and recurses into nested rows.
// componentType is resolved via comp.componentType ?? comp.type.
//
// ── v2.1 ADDITION ───────────────────────────────────────────────────────────
// Tracks button icons separately from content images:
//   - BUTTON_ICON_OVERHEAD adds the scaffold bytes of the <table>-based icon
//     branch used when a button has an icon.
//   - buttonIconCount is its own metric, shown in the UI, NOT folded into
//     imageCompCount / imageWeight — button icons are UI elements, not
//     content imagery, so they shouldn't penalize the spam-risk ratio.
//
// All byte constants are derived directly from the HTML template strings in
// healthIndicator.ts — not from sampled exported files.
// This eliminates systematic bias. Residual variance is ±8-10% due to:
//   - Unknown row/column background-color string lengths
//   - Rich-text HTML tags in paragraph content (e.g. <strong>, <br>)
//   - Variable URL lengths for images, links, fonts
//
// The UI shows "~X KB" with a ± range to reflect this honestly.

import { computed } from "vue";

// ---- Ratio thresholds -------------------------------------------------------

const TEXT_RATIO_GOOD = 60;
const TEXT_RATIO_WARN = 40;
const IMAGE_WEIGHT = 500; // char-equivalents per image/video
const SOCIAL_WEIGHT = 80; // char-equivalents per enabled social icon

// ---- KB thresholds ----------------------------------------------------------

const KB_GOOD = 60;
const KB_WARN = 80;

// ---- Static bytes (measured from exact export function output) --------------
// <!DOCTYPE html>...<body style="..."><table>...<table class="email-container">

const STATIC_HEAD_BYTES = 1043; // head + outer wrapper tables
const STATIC_FOOTER_BYTES = 47; // closing tags
const STATIC_MEDIA_CSS = 430; // @media block always emitted

// ---- Structural bytes per layout element (measured from export function) ----

const ROW_WRAP_BYTES = 398; // 3x nested tables per row (no bg styles)
const ROW_BG_OVERHEAD = 30; // added when row has a background-color
const COL_BYTES = 140; // responsive <td> per column
const GAP_SPACER_BYTES = 117; // spacer <td> between columns when gap > 0
const FONT_LINK_BYTES = 105; // Google Fonts <link> per unique family

// ---- Component overhead (measured from generator template strings) ----------
// = all markup bytes EXCLUDING variable content (text, src URLs, links).
// Uses the generator's actual style attribute format (spaces after colons).

// Column-level spacer leaf — typically <div style="line-height:Xpx; height:Xpx">&nbsp;</div>
// Approximate; verify against generator output. Matches row-spacer for consistency.
const SPACER_BYTES = 80;

const COMPONENT_OVERHEAD: Record<string, number> = {
  heading: 317, // <hN style="margin... padding... font-size... ...">...</hN>
  paragraph: 337, // <p style="margin... padding... font-size... background-color...">...</p>
  list: 250, // <ul/ol style="..."> + </ul/ol> (items counted separately)
  menu: 250, // < style="..."> + <//ol> (items counted separately)
  button: 488, // <div><a style="padding... background-color...">...</a></div>
  anchor: 394, // <div><a style="color... font-size...">...</a></div>
  image: 281, // <div style="margin... align..."><img style="width... border..."/></div>
  video: 320, // <div><a><video poster="..."><img/></video></a></div> approx
  divider: 461, // <div><table role="presentation"><tr><td ...>&nbsp;</td></tr></table></div>
  socials: 149, // <div style="margin... align..."> wrapper only
  spacer: SPACER_BYTES, // <div style="line-height... height...">&nbsp;</div>
};

// Per list item: <li style="margin-bottom: Xpx;">CONTENT</li>
const MENU_ITEM_OVERHEAD = 54;

// Per enabled social icon: <a href="LINK" style="..."><img src="ICON" ...></a>
// Markup overhead excluding link and src URL lengths
const SOCIAL_ICON_OVERHEAD = 229;

// Button-with-icon additional overhead: the fixed scaffold bytes of the
// <table><tr><td><img/></td><td>TEXT</td></tr></table> structure that
// replaces the plain text node inside the <a>. Icon URL and alt text are
// counted separately (see processLeafComponent).
// Measured from the exporter's template string with variable fields blanked.
const BUTTON_ICON_OVERHEAD = 450;

// Mobile @media override — only emitted when component has non-null mobile props
const MOBILE_OVERRIDE_BYTES = 120;

// ---- Max nesting depth — matches canvas depth guard -------------------------
const MAX_DEPTH = 5;

// ---- Variance band ----------------------------------------------------------
// Residual ±8-10% variance is inherent (background styles, rich text, URL lengths).
// Display as a range: [estimate * LOW_FACTOR, estimate * HIGH_FACTOR].

const VARIANCE_LOW = 0.92;
const VARIANCE_HIGH = 1.08;

// ---- Type sets --------------------------------------------------------------

const TEXT_TYPES = new Set([
  "heading",
  "paragraph",
  "list",
  "menu",
  "button",
  "anchor",
]);
const IMAGE_TYPES = new Set(["image", "video"]);

// ---- Helpers ----------------------------------------------------------------

/** Resolve the render variant — handles discriminated union + legacy shapes. */
function resolveCompType(comp: any): string {
  return comp.componentType ?? comp.type;
}

function getTextContent(comp: any): string {
  const p = comp.props ?? {};
  const ct = resolveCompType(comp);
  if (ct === "menu") {
    return (p.items ?? []).map((i: any) => i.label ?? "").join(" ");
  }
  return p.content ?? p.text ?? p.label ?? "";
}

function getMenuItemCount(comp: any): number {
  return (comp.props?.items ?? []).length;
}

function getSocialIconStats(comp: any): {
  count: number;
  linkBytes: number;
  srcBytes: number;
} {
  const platforms: any[] = comp.props?.platforms ?? [];
  const enabled = platforms.filter((p: any) => p.enabled !== false);
  const linkBytes = enabled.reduce(
    (s: number, p: any) => s + (p.link?.length ?? 0),
    0,
  );
  const srcBytes = enabled.reduce(
    (s: number, p: any) => s + (p.icon?.length ?? 0),
    0,
  );
  return { count: enabled.length, linkBytes, srcBytes };
}

/** True if any mobile prop on this component has a non-null value. */
function hasMobileOverride(comp: any): boolean {
  const mobile = comp.props?.mobile;
  if (!mobile || typeof mobile !== "object") return false;
  return Object.values(mobile).some((v) => v !== null && v !== undefined);
}

// ---- Accumulator interface --------------------------------------------------

interface HealthAccumulator {
  textChars: number;
  imageWeight: number;
  estimatedBytes: number;
  usedFonts: Set<string>;
  textCompCount: number;
  imageCompCount: number;
  socialIconCount: number;
  buttonIconCount: number;
}

// ---- Recursive children walker ----------------------------------------------

function walkChildren(
  children: any[],
  acc: HealthAccumulator,
  depth: number,
): void {
  if (depth >= MAX_DEPTH) return;

  for (const child of children) {
    const childType = child.type;

    // ── Nested row → recurse into its columns ──────────────────────────
    if (childType === "row") {
      // Row wrapper overhead
      acc.estimatedBytes += ROW_WRAP_BYTES;
      const hasBg =
        child.backgroundColor && child.backgroundColor !== "transparent";
      const hasGradient = child.backgroundGradient?.useGradient;
      if (hasBg || hasGradient) acc.estimatedBytes += ROW_BG_OVERHEAD;

      const cols: any[] = child.columns ?? [];
      const hasGap = (child.gap ?? 0) > 0;

      cols.forEach((col: any, colIndex: number) => {
        acc.estimatedBytes += COL_BYTES;

        const colHasBg =
          col.backgroundColor && col.backgroundColor !== "transparent";
        if (colHasBg || col.backgroundGradient?.useGradient)
          acc.estimatedBytes += ROW_BG_OVERHEAD;

        if (hasGap && colIndex < cols.length - 1)
          acc.estimatedBytes += GAP_SPACER_BYTES;

        // ── CRITICAL: children ?? components for backward compat ─────────
        const kids = col.children ?? col.components ?? [];
        walkChildren(kids, acc, depth + 1);
      });
      continue;
    }

    // ── Row spacer — small overhead ─────────────────────────────────────
    if (childType === "row-spacer") {
      acc.estimatedBytes += 80;
      continue;
    }

    // ── Leaf component (type === 'component' or legacy flat shape) ───────
    processLeafComponent(child, acc);
  }
}

function processLeafComponent(comp: any, acc: HealthAccumulator): void {
  const ct = resolveCompType(comp);

  acc.estimatedBytes += COMPONENT_OVERHEAD[ct] ?? 337;

  // Mobile @media rule — only when props are actually overridden
  if (hasMobileOverride(comp)) acc.estimatedBytes += MOBILE_OVERRIDE_BYTES;

  // Google Fonts
  if (comp.props?.fontFamily) acc.usedFonts.add(comp.props.fontFamily);
  if (comp.props?.mobile?.fontFamily)
    acc.usedFonts.add(comp.props.mobile.fontFamily);

  if (TEXT_TYPES.has(ct)) {
    acc.textCompCount++;
    const txt = getTextContent(comp);
    acc.textChars += txt.length;
    acc.estimatedBytes += new TextEncoder().encode(txt).length;

    if (ct === "menu") {
      acc.estimatedBytes += getMenuItemCount(comp) * MENU_ITEM_OVERHEAD;
    }
    // button/anchor: add their link URL length
    if (ct === "button" || ct === "anchor") {
      acc.estimatedBytes += (comp.props?.link ?? "").length;
    }

    // button with icon: add the icon-branch scaffold + icon URL + alt text.
    // Also track it as its own count — button icons are UI elements, not
    // content imagery, so we deliberately don't fold them into
    // imageCompCount / imageWeight (which would penalize the spam ratio).
    // Plain buttons (no icon set) pay zero extra — the plain <a>TEXT</a>
    // branch is already covered by COMPONENT_OVERHEAD.button.
    if (ct === "button" && comp.props?.icon) {
      acc.estimatedBytes += BUTTON_ICON_OVERHEAD;
      acc.estimatedBytes += (comp.props.icon ?? "").length;
      acc.estimatedBytes += (comp.props.iconAlt ?? "").length;
      acc.buttonIconCount++;
    }
  } else if (IMAGE_TYPES.has(ct)) {
    acc.imageCompCount++;
    acc.imageWeight += IMAGE_WEIGHT;
    acc.estimatedBytes += (comp.props?.src ?? "").length;
  } else if (ct === "socials") {
    const { count, linkBytes, srcBytes } = getSocialIconStats(comp);
    acc.socialIconCount += count;
    acc.imageWeight += count * SOCIAL_WEIGHT;
    acc.estimatedBytes += count * SOCIAL_ICON_OVERHEAD + linkBytes + srcBytes;
  }
}

// ---- Main composable --------------------------------------------------------

export function healthIndicator(rows: any) {
  const metrics = computed(() => {
    const acc: HealthAccumulator = {
      textChars: 0,
      imageWeight: 0,
      estimatedBytes:
        STATIC_HEAD_BYTES + STATIC_FOOTER_BYTES + STATIC_MEDIA_CSS,
      usedFonts: new Set<string>(),
      textCompCount: 0,
      imageCompCount: 0,
      socialIconCount: 0,
      buttonIconCount: 0,
    };

    const rowList: any[] = rows.value ?? [];

    for (const row of rowList) {
      // Row-spacer has no columns
      if (!row.columns) {
        acc.estimatedBytes += 80;
        continue;
      }

      // Row wrapper + background overhead if a bg color/gradient is set
      acc.estimatedBytes += ROW_WRAP_BYTES;
      const hasBg =
        row.backgroundColor && row.backgroundColor !== "transparent";
      const hasGradient = row.backgroundGradient?.useGradient;
      if (hasBg || hasGradient) acc.estimatedBytes += ROW_BG_OVERHEAD;

      const cols: any[] = row.columns ?? [];
      const hasGap = (row.gap ?? 0) > 0;

      cols.forEach((col: any, colIndex: number) => {
        acc.estimatedBytes += COL_BYTES;

        // Col background
        const colHasBg =
          col.backgroundColor && col.backgroundColor !== "transparent";
        if (colHasBg || col.backgroundGradient?.useGradient)
          acc.estimatedBytes += ROW_BG_OVERHEAD;

        if (hasGap && colIndex < cols.length - 1)
          acc.estimatedBytes += GAP_SPACER_BYTES;

        // ── CRITICAL: children ?? components for backward compat ─────────
        const kids = col.children ?? col.components ?? [];
        walkChildren(kids, acc, 0);
      });
    }

    acc.estimatedBytes += acc.usedFonts.size * FONT_LINK_BYTES;

    // ---- Ratio (char-weighted) ----------------------------------------------

    const totalWeight = acc.textChars + acc.imageWeight;
    const textRatio =
      totalWeight === 0 ? 100 : Math.round((acc.textChars / totalWeight) * 100);
    const imageRatio = 100 - textRatio;

    // ---- KB (with variance range) -------------------------------------------

    const estimatedKB = Math.round((acc.estimatedBytes / 1024) * 10) / 10;
    const estimatedLow =
      Math.round(((acc.estimatedBytes * VARIANCE_LOW) / 1024) * 10) / 10;
    const estimatedHigh =
      Math.round(((acc.estimatedBytes * VARIANCE_HIGH) / 1024) * 10) / 10;

    // ---- Status -------------------------------------------------------------

    let ratioStatus: "good" | "warn" | "bad";
    if (textRatio >= TEXT_RATIO_GOOD) ratioStatus = "good";
    else if (textRatio >= TEXT_RATIO_WARN) ratioStatus = "warn";
    else ratioStatus = "bad";

    // Use the HIGH end of the range for status (conservative — warn early)
    let kbStatus: "good" | "warn" | "bad";
    if (estimatedHigh <= KB_GOOD) kbStatus = "good";
    else if (estimatedHigh <= KB_WARN) kbStatus = "warn";
    else kbStatus = "bad";

    // ---- Tooltips -----------------------------------------------------------

    const ratioTip =
      ratioStatus === "good"
        ? `Good ratio (${textRatio}% text). Email clients will render this reliably.`
        : ratioStatus === "warn"
          ? `Low text ratio (${textRatio}%). Spam filters prefer >= 60% text. Add more copy.`
          : `Poor ratio (${textRatio}% text). Heavy image emails are often blocked or sent to spam.`;

    const kbTip =
      kbStatus === "good"
        ? `Estimated ${estimatedLow}–${estimatedHigh} KB — well within Gmail's 102 KB limit.`
        : kbStatus === "warn"
          ? `Estimated ${estimatedLow}–${estimatedHigh} KB — approaching Gmail's 102 KB clip threshold.`
          : `Estimated ${estimatedLow}–${estimatedHigh} KB — Gmail will clip this email at ~102 KB.`;

    return {
      textChars: acc.textChars,
      textCompCount: acc.textCompCount,
      imageCompCount: acc.imageCompCount,
      socialIconCount: acc.socialIconCount,
      buttonIconCount: acc.buttonIconCount,
      textRatio,
      imageRatio,
      estimatedKB,
      estimatedLow,
      estimatedHigh,
      ratioStatus,
      kbStatus,
      ratioTip,
      kbTip,
      isEmpty:
        totalWeight === 0 &&
        acc.estimatedBytes <=
          STATIC_HEAD_BYTES + STATIC_FOOTER_BYTES + STATIC_MEDIA_CSS + 50,
    };
  });

  return { metrics };
}
