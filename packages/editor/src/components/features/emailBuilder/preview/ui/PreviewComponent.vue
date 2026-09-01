<template>
  <!-- ── Nested row ──────────────────────────────────────────────────────── -->
  <div
    v-if="ct === 'row' && depth < MAX_DEPTH"
    :style="nestedRowStyle"
    v-show="isVisible"
  >
    <div
      v-for="col in component.columns || []"
      :key="col.id"
      :style="nestedColumnStyle(col)"
    >
      <PreviewComponent
        v-for="child in col.children ?? col.components ?? []"
        :key="child.id"
        :component="child"
        :force-mobile="forceMobile"
        :depth="depth + 1"
      />
    </div>
  </div>

  <!-- ── Row spacer (when used inside a column) ─────────────────────────── -->
  <div
    v-else-if="ct === 'row-spacer'"
    :style="rowSpacerLeafStyle"
    v-show="isVisible"
  />

  <!-- ── Heading ─────────────────────────────────────────────────────────── -->
  <component
    :is="p?.level || 'h2'"
    v-else-if="ct === 'heading'"
    :style="headingStyle"
    v-html="cleanHtml(p?.content)"
    v-show="isVisible"
  />

  <!-- ── Paragraph ───────────────────────────────────────────────────────── -->
  <p
    v-else-if="ct === 'paragraph'"
    :style="paragraphStyle"
    v-html="cleanHtml(p?.content)"
    v-show="isVisible"
  />

  <!-- ── List ───────────────────────────────────────────────────────────── -->
  <div
    v-else-if="ct === 'list'"
    :style="listStyle"
    v-html="cleanHtml(p?.content)"
    v-show="isVisible"
  />

  <!-- ── Image ──────────────────────────────────────────────────────────── -->
  <div v-else-if="ct === 'image'" :style="imageWrapStyle" v-show="isVisible">
    <img v-if="p?.src" :src="p.src" :alt="p?.alt || ''" :style="imageStyle" />
    <div v-else :style="imagePlaceholderStyle" />
  </div>

  <!-- ── Video ──────────────────────────────────────────────────────────── -->
  <div v-else-if="ct === 'video'" :style="videoWrapStyle" v-show="isVisible">
    <div :style="videoFrameStyle">
      <img
        v-if="p?.coverImage"
        :src="p.coverImage"
        :alt="p?.alt || 'Video'"
        :style="videoImgStyle"
      />
      <div v-else :style="videoPlaceholderStyle">
        <svg
          style="width: 28px; height: 28px; color: #94a3b8"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
  </div>

  <!-- ── Button ──────────────────────────────────────────────────────────── -->
  <div
    v-else-if="ct === 'button'"
    :style="buttonContainerStyle"
    v-show="isVisible"
  >
    <span :style="buttonStyle">
      <img
        v-if="p?.icon && p?.iconPosition !== 'after'"
        :src="p.icon"
        :alt="p?.iconAlt || ''"
        :style="buttonIconStyle"
      />
      {{ p?.text || "Button" }}
      <img
        v-if="p?.icon && p?.iconPosition === 'after'"
        :src="p.icon"
        :alt="p?.iconAlt || ''"
        :style="buttonIconStyle"
      />
    </span>
  </div>

  <!-- ── Anchor ──────────────────────────────────────────────────────────── -->
  <div
    v-else-if="ct === 'anchor'"
    :style="anchorContainerStyle"
    v-show="isVisible"
  >
    <span :style="anchorStyle">{{ p?.text || "Link" }}</span>
  </div>

  <!-- ── Divider ────────────────────────────────────────────────────────── -->
  <div
    v-else-if="ct === 'divider'"
    :style="dividerWrapStyle"
    v-show="isVisible"
  >
    <hr :style="dividerStyle" />
  </div>

  <!-- ── Spacer ─────────────────────────────────────────────────────────── -->
  <div
    v-else-if="ct === 'spacer'"
    :style="spacerCompStyle"
    v-show="isVisible"
  />

  <!-- ── Socials ────────────────────────────────────────────────────────── -->
  <div
    v-else-if="ct === 'socials'"
    :style="socialsWrapStyle"
    v-show="isVisible"
  >
    <template v-if="p?.platforms?.some((pl: any) => pl.enabled && pl.link)">
      <span
        v-for="platform in p.platforms.filter(
          (pl: any) => pl.enabled && pl.link,
        )"
        :key="platform.name"
        :style="socialItemStyle"
      >
        <img
          :src="platform.icon"
          :alt="platform.name"
          :style="{
            width: (p?.iconSize || 24) + 'px',
            height: (p?.iconSize || 24) + 'px',
            display: 'block',
          }"
        />
      </span>
    </template>
  </div>

  <!-- ── Menu ───────────────────────────────────────────────────────────── -->
  <div v-else-if="ct === 'menu'" :style="menuContainerStyle" v-show="isVisible">
    <span
      v-for="(item, i) in p?.items || []"
      :key="i"
      :style="menuItemStyleFor(Number(i), (p?.items || []).length)"
    >
      {{ item.label || "" }}
    </span>
  </div>
</template>

<script setup lang="ts">
// components/preview/PreviewComponent.vue (v2)
//
// Faithful 1:1 re-implementation of CanvasComponent.vue's leaf-rendering
// logic — sans editor chrome. Uses the same resolveProps() pattern so mobile
// overrides apply when forceMobile is on, and the same resolveBackground()
// shape (useGradient + gradient.{type, direction, colors[{color, position}]}).
//
// Defaults below mirror useEmailBuilderDefault.ts so unset values render
// the same way the live canvas does.

import { computed, type CSSProperties } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useEmailBuilderVisibility } from "@/composables/emailBuilder/core/useEmailBuilderVisibility";

const props = defineProps<{
  component: any;
  /** Apply `component.props.mobile.*` overrides where set. */
  forceMobile?: boolean;
  /** Recursion depth for nested rows. Hard-limited at 5. */
  depth?: number;
}>();

const ct = computed(
  () => props.component.componentType ?? props.component.type,
);

const MAX_DEPTH = 5;

// ── Visibility (mirrors CanvasElement.vue) ─────────────────────────────────
//
// CanvasElement gates each rendered branch with
//   v-show="evaluateVisibility(<source>, visibilityPreviewContext)"
// where the source path differs by type:
//   • leaf component → element.props?.visibility
//   • nested row     → element.visibility
//   • row-spacer     → element.visibility
//
// We mirror that exactly. One computed `isVisible` picks the right path
// based on the resolved component type (ct), and the template binds v-show
// to it on every branch — same as CanvasElement, just collapsed into one
// expression because PreviewComponent has more branches than CanvasElement.
const { visibilityPreviewContext } = useEmailBuilder();
const { evaluateVisibility } = useEmailBuilderVisibility();

const isVisible = computed(() => {
  const t = ct.value;
  const source =
    t === "row" || t === "row-spacer"
      ? props.component.visibility
      : props.component.props?.visibility;
  // `visibilityPreviewContext` is a useState ref. Vue auto-unwraps refs in
  // *template* expressions but NOT inside <script setup lang="ts"> — and evaluateVisibility
  // does `context[rule.tag.toLowerCase()]` against the raw arg, so if we pass
  // the Ref itself every rawValue lookup returns undefined and rules silently
  // misbehave (positive operators all fail, negations all pass). Unwrap with
  // .value here so the function sees the actual Record<string, string>.
  return evaluateVisibility(source, visibilityPreviewContext.value);
});

// ── resolveProps: mirrors CanvasComponent's mobile-override logic ─────────

const p = computed(() => {
  const base = props.component.props ?? {};
  if (!props.forceMobile || !base.mobile) return base;
  const merged: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(base.mobile)) {
    if (v !== null && v !== undefined) merged[k] = v;
  }
  return merged;
});

// ── Generic helpers ───────────────────────────────────────────────────────

function spacingStr(s: any, fallback = "0"): string {
  if (!s) return fallback;
  return `${s.top ?? 0}px ${s.right ?? 0}px ${s.bottom ?? 0}px ${s.left ?? 0}px`;
}

function cleanHtml(html: string | undefined): string {
  if (html === undefined || html === null) return "";
  return String(html);
}

function resolveBackground(target: any): string {
  const bg = target?.backgroundGradient;
  const hasGradient =
    bg?.useGradient === true &&
    Array.isArray(bg?.gradient?.colors) &&
    bg.gradient.colors.length >= 2;

  if (hasGradient) {
    const { type, direction, colors } = bg.gradient;
    const stops = colors
      .map((c: any) => `${c.color} ${c.position}%`)
      .join(", ");
    return type === "radial"
      ? `radial-gradient(circle at center, ${stops})`
      : `linear-gradient(${direction}, ${stops})`;
  }
  return target?.backgroundColor ?? "transparent";
}

// ── Nested row & column (re-uses CanvasRow / CanvasColumn semantics) ──────

const nestedRowStyle = computed(() => {
  const row = props.component;
  const isStacked = props.forceMobile && row.mobileStack === true;
  const styles: Record<string, string> = {
    display: "flex",
    flexDirection: isStacked ? "column" : "row",
    background: resolveBackground(row),
    padding: row.padding
      ? `${row.padding.top}px ${row.padding.right}px ${row.padding.bottom}px ${row.padding.left}px`
      : "0",
    minHeight: row.minHeight ? `${row.minHeight}px` : "auto",
    alignItems: "stretch",
    // CRITICAL: nested rows must fill the parent column's width. Without
    // these three, a flex row inside a flex column (parent column has
    // flex-direction: column) sizes to its content, then the percent-width
    // children compute against that smaller width and overflow horizontally
    // — that's the "Heading One/Two cards float outside the parent column"
    // bug from the preview screenshot.
    width: "100%",
    minWidth: "0",
    boxSizing: "border-box",
  };
  if (row.border) {
    styles.border = `${row.border.width ?? 0}px ${row.border.style ?? "solid"} ${row.border.color ?? "transparent"}`;
    styles.borderRadius = `${row.border.radius ?? 0}px`;
  }
  if ((row.gap ?? 0) > 0) styles.gap = `${row.gap}px`;
  if (row.backgroundImage) {
    styles.backgroundImage = `url(${row.backgroundImage})`;
    styles.backgroundSize = row.backgroundSize ?? "cover";
    styles.backgroundPosition = row.backgroundPosition ?? "center center";
    styles.backgroundRepeat = row.backgroundRepeat ?? "no-repeat";
  }
  return styles;
});

const VERTICAL_ALIGN_MAP: Record<string, string> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

function nestedColumnStyle(col: any): Record<string, string> {
  const row = props.component;
  const isStacked = props.forceMobile && row.mobileStack === true;
  const radius = col.border?.radius ?? 0;
  const styles: Record<string, string> = {
    width: isStacked ? "100%" : `${col.width ?? 100}%`,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: VERTICAL_ALIGN_MAP[col.verticalAlign] || "flex-start",
    padding: col.padding
      ? `${col.padding.top}px ${col.padding.right}px ${col.padding.bottom}px ${col.padding.left}px`
      : "10px",
    background: resolveBackground(col),
    minWidth: "0",
    // Apply `overflow: hidden` only when the nested column has rounded
    // corners — there, it's needed to clip children to the rounded shape.
    // For square columns, omit overflow so the flex+radius+overflow quirk
    // (which hides backgrounds in some engines) doesn't apply. Matches real
    // CanvasColumn behavior.
  };
  if (radius > 0) {
    styles.overflow = "hidden";
  }
  if (col.border) {
    styles.border = `${col.border.width ?? 0}px ${col.border.style ?? "solid"} ${col.border.color ?? "transparent"}`;
    styles.borderRadius = `${radius}px`;
  }
  if (col.backgroundImage) {
    styles.backgroundImage = `url(${col.backgroundImage})`;
    styles.backgroundSize = col.backgroundSize ?? "cover";
    styles.backgroundPosition = col.backgroundPosition ?? "center center";
    styles.backgroundRepeat = col.backgroundRepeat ?? "no-repeat";
  }
  return styles;
}

// ── Leaf row-spacer (rare — typically only at row level) ──────────────────

const rowSpacerLeafStyle = computed(() => ({
  width: "100%",
  height: (props.component.height ?? 20) + "px",
  background: resolveBackground(props.component),
}));

// ── Heading ───────────────────────────────────────────────────────────────

const headingStyle = computed(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    fontSize: (x.fontSize ?? 32) + "px",
    lineHeight: String(x.lineHeight ?? 1.2),
    letterSpacing: (x.letterSpacing ?? 0) + "px",
    color: x.color ?? "#111111",
    fontWeight: x.fontWeight ?? "bold",
    fontFamily: x.fontFamily
      ? `'${x.fontFamily}', Arial, sans-serif`
      : "Arial, sans-serif",
    background: resolveBackground(x),
    textTransform: (x.textTransform ?? "none") as string,
    textDecoration: x.textDecoration ?? "none",
    textAlign: (x.align ?? "left") as CSSProperties["textAlign"],
    // Wrap long unbroken strings (URLs, hash-codes) inside narrow columns
    // instead of letting them push the layout wider. Mirrors what real
    // email clients do on small viewports.
    overflowWrap: "break-word" as const,
    wordBreak: "break-word" as const,
  };
});

// ── Paragraph ─────────────────────────────────────────────────────────────

const paragraphStyle = computed<CSSProperties>(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    fontSize: (x.fontSize ?? 16) + "px",
    lineHeight: String(x.lineHeight ?? 1.5),
    letterSpacing: (x.letterSpacing ?? 0) + "px",
    color: x.color ?? "#111111",
    fontWeight: x.fontWeight ?? "normal",
    fontFamily: x.fontFamily
      ? `'${x.fontFamily}', Arial, sans-serif`
      : "Arial, sans-serif",
    fontStyle: x.fontStyle ?? "normal",
    background: resolveBackground(x),
    textTransform: (x.textTransform ?? "none") as string,
    textDecoration: x.textDecoration ?? "none",
    textAlign: (x.align ?? "left") as CSSProperties["textAlign"],
    overflowWrap: "break-word" as const,
    wordBreak: "break-word" as const,
  };
});

// ── List ──────────────────────────────────────────────────────────────────

const listStyle = computed(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding, "0 0 0 20px"),
    fontSize: (x.fontSize ?? 16) + "px",
    lineHeight: String(x.lineHeight ?? 1.5),
    letterSpacing: (x.letterSpacing ?? 0) + "px",
    fontFamily: x.fontFamily
      ? `'${x.fontFamily}', Arial, sans-serif`
      : "Arial, sans-serif",
    color: x.color ?? "#111111",
    background: resolveBackground(x),
    overflowWrap: "break-word" as const,
    wordBreak: "break-word" as const,
  };
});

// ── Image ─────────────────────────────────────────────────────────────────

const imageWrapStyle = computed<CSSProperties>(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    textAlign: (x.align ?? "center") as CSSProperties["textAlign"],
  };
});

const imageStyle = computed(() => {
  const x = p.value;
  return {
    width: typeof x.width === "number" ? x.width + "%" : "100%",
    height: "auto",
    maxWidth: "100%",
    borderRadius: (x.borderRadius ?? 0) + "px",
    border: x.border
      ? `${x.border.width ?? 0}px ${x.border.style ?? "solid"} ${x.border.color ?? "transparent"}`
      : "none",
    display: "inline-block",
  };
});

const imagePlaceholderStyle = computed(() => ({
  width: "100%",
  height: "100px",
  background: "#e2e8f0",
  borderRadius: "4px",
}));

// ── Video ─────────────────────────────────────────────────────────────────

const videoWrapStyle = computed<CSSProperties>(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    textAlign: (x.align ?? "center") as CSSProperties["textAlign"],
  };
});

const videoFrameStyle = computed(() => {
  const x = p.value;
  return {
    position: "relative" as const,
    display: "inline-block",
    width: typeof x.width === "number" ? x.width + "%" : "100%",
    paddingTop: "56.25%",
    overflow: "hidden",
    borderRadius: (x.borderRadius ?? 0) + "px",
  };
});

const videoImgStyle = computed(() => ({
  position: "absolute" as const,
  top: "0",
  left: "0",
  width: "100%",
  height: "100%",
  objectFit: "cover" as const,
}));

const videoPlaceholderStyle = computed(() => ({
  position: "absolute" as const,
  top: "0",
  left: "0",
  width: "100%",
  height: "100%",
  background: "#e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

// ── Button ────────────────────────────────────────────────────────────────

const buttonContainerStyle = computed<CSSProperties>(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    textAlign: (x.align ?? "center") as CSSProperties["textAlign"],
  };
});

const buttonStyle = computed(() => {
  const x = p.value;
  const hasIcon = !!x.icon;
  return {
    background: resolveBackground(x),
    color: x.color ?? "#ffffff",
    fontSize: (x.fontSize ?? 16) + "px",
    fontWeight: x.fontWeight ?? "600",
    fontFamily: x.fontFamily
      ? `'${x.fontFamily}', Arial, sans-serif`
      : "Arial, sans-serif",
    letterSpacing: (x.letterSpacing ?? 0) + "px",
    padding: spacingStr(x.padding, "12px 24px"),
    borderRadius: (x.borderRadius ?? 4) + "px",
    border: x.border
      ? `${x.border.width ?? 0}px ${x.border.style ?? "solid"} ${x.border.color ?? "transparent"}`
      : "none",
    display: hasIcon ? "inline-flex" : "inline-block",
    alignItems: hasIcon ? "center" : undefined,
    verticalAlign: hasIcon ? "middle" : undefined,
    lineHeight: "1.2",
    textDecoration: "none",
    textTransform: (x.textTransform ?? "none") as string,
    whiteSpace: "nowrap",
  };
});

const buttonIconStyle = computed(() => {
  const x = p.value;
  const size = Math.max(4, x.iconSize ?? 20);
  const gap = x.iconGap ?? 8;
  const isBefore = x.iconPosition !== "after";
  return {
    display: "block",
    width: size + "px",
    height: size + "px",
    flexShrink: "0",
    marginRight: isBefore ? gap + "px" : "0",
    marginLeft: isBefore ? "0" : gap + "px",
  };
});

// ── Anchor ────────────────────────────────────────────────────────────────

const anchorContainerStyle = computed(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    textAlign: (x.align ?? "left") as CSSProperties["textAlign"],
  };
});

const anchorStyle = computed(() => {
  const x = p.value;
  return {
    color: x.color ?? "#007bff",
    fontSize: (x.fontSize ?? 16) + "px",
    fontWeight: x.fontWeight ?? "normal",
    fontFamily: x.fontFamily
      ? `'${x.fontFamily}', Arial, sans-serif`
      : "Arial, sans-serif",
    letterSpacing: (x.letterSpacing ?? 0) + "px",
    textDecoration: x.textDecoration ?? "underline",
    overflowWrap: "break-word" as const,
    wordBreak: "break-word" as const,
  };
});

// ── Divider ───────────────────────────────────────────────────────────────

const dividerWrapStyle = computed<CSSProperties>(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    textAlign: (x.align ?? "center") as CSSProperties["textAlign"],
  };
});

const dividerStyle = computed(() => {
  const x = p.value;
  const align = x.align ?? "center";
  return {
    width: (x.width ?? 100) + "%",
    height: (x.height ?? 1) + "px",
    background: resolveBackground(x),
    border: "none",
    display: "block",
    margin:
      align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0",
  };
});

// ── Spacer ────────────────────────────────────────────────────────────────

const spacerCompStyle = computed(() => {
  const x = p.value;
  return {
    width: "100%",
    height: (x.height ?? 20) + "px",
    background: resolveBackground(x),
  };
});

// ── Socials ───────────────────────────────────────────────────────────────
//
// The socials wrapper has no background of its own — by design, the column
// or row it sits inside provides the background. This matches the real
// renderer: `socials` defaults `backgroundColor: 'transparent'` and the
// parent column/row's bg shows through.

const socialsWrapStyle = computed(() => {
  const x = p.value;
  return {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: (x.spacing ?? 8) + "px",
    justifyContent:
      x.align === "center"
        ? "center"
        : x.align === "right"
          ? "flex-end"
          : "flex-start",
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    // No `background` key — wrapper stays transparent so parent column/row
    // bg shows through. This is the documented behavior the user flagged.
  };
});

const socialItemStyle = {
  display: "inline-flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

// ── Menu ──────────────────────────────────────────────────────────────────

const menuContainerStyle = computed<CSSProperties>(() => {
  const x = p.value;
  return {
    margin: spacingStr(x.margin),
    padding: spacingStr(x.padding),
    textAlign: (x.align ?? "left") as CSSProperties["textAlign"],
    lineHeight: "0",
    background: resolveBackground(x),
  };
});

function menuItemStyleFor(index: number, total: number): CSSProperties {
  const x = p.value;
  const isStacked = x.mobileStack === true && props.forceMobile;
  const spacing = x.spacing ?? 8;

  const half = Math.ceil((spacing ?? 0) / 2);

  const isFirst = index === 0;
  const isLast = index === total - 1;

  return {
    display: isStacked ? "block" : "inline-block",
    marginLeft: isStacked ? "0px" : isFirst ? "0px" : half + "px",
    marginRight: isStacked ? "0px" : isLast ? "0px" : half + "px",
    marginBottom: isStacked && !isLast ? spacing + "px" : "0px",
    fontSize: Math.max(6, x.fontSize ?? 14) + "px",
    lineHeight: String(x.lineHeight ?? 1.4),
    letterSpacing: (x.letterSpacing ?? 0) + "px",
    color: x.color ?? "#111111",
    fontWeight: x.fontWeight ?? "normal",
    fontFamily: x.fontFamily
      ? `'${x.fontFamily}', Arial, sans-serif`
      : "Arial, sans-serif",
    fontStyle: x.fontStyle ?? "normal",
    textTransform: (x.textTransform ?? "none") as string,
    textDecoration: x.textDecoration ?? "none",
    whiteSpace: isStacked ? ("normal" as const) : ("nowrap" as const),
  };
}

// Default depth for top-level calls.
const depth = computed(() => props.depth ?? 0);
</script>
