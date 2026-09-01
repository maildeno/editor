<template>
  <div
    class="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden"
  >
    <!-- ── Header (window chrome) ────────────────────────────────────────── -->
    <div
      class="flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 bg-gray-50/70 shrink-0"
    >
      <!-- Traffic-light dots — decorative window indicator. -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span
          class="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"
          aria-hidden="true"
        />
        <span
          class="w-2.5 h-2.5 rounded-full bg-[#febc2e]"
          aria-hidden="true"
        />
        <span
          class="w-2.5 h-2.5 rounded-full bg-[#28c840]"
          aria-hidden="true"
        />
      </div>

      <!-- "Address bar" style label -->
      <div
        class="flex-1 min-w-0 flex items-center gap-2 rounded-md px-2.5 py-1.5 border bg-white border-gray-200"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span class="text-[12px] font-medium text-gray-800 truncate">
          Source
        </span>
        <span class="text-[10.5px] text-gray-400 truncate">
          · Live canvas data
        </span>
        <span class="ml-auto text-[10.5px] text-gray-400 font-mono shrink-0">
          {{ effectiveWidth }}px
        </span>
      </div>

      <!-- Mobile / Desktop indicator -->
      <span
        class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-1 rounded shrink-0"
        :class="
          forceMobile
            ? 'bg-amber-50 text-amber-700'
            : 'bg-emerald-50 text-emerald-700'
        "
      >
        {{ forceMobile ? "Mobile" : "Desktop" }}
      </span>
    </div>

    <!-- ── Scrollable viewport ────────────────────────────────────────────── -->
    <div
      class="flex-1 overflow-y-auto overflow-x-hidden"
      :style="{ backgroundColor: bodyBg }"
    >
      <div class="p-6">
        <!-- Empty state -->
        <div
          v-if="!hasContent"
          class="flex flex-col items-center justify-center h-[60vh] text-center gap-3"
        >
          <div
            class="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-gray-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-700">No content yet</p>
            <p class="text-[12px] text-gray-400 mt-1">
              Add components in the builder to see them here.
            </p>
          </div>
        </div>

        <!-- Email container -->
        <div
          v-else
          class="mx-auto shadow-sm rounded-md overflow-hidden"
          :style="{
            width: effectiveWidth + 'px',
            maxWidth: '100%',
            backgroundColor: canvas?.backgroundColor ?? '#ffffff',
          }"
        >
          <div
            :style="{
              padding: canvasPadding,
            }"
          >
            <template v-for="row in rows" :key="row.id">
              <!-- Row spacer -->
              <div
                v-if="row.type === 'row-spacer'"
                :style="rowSpacerStyle(row)"
                v-show="
                  evaluateVisibility(row.visibility, visibilityPreviewContext)
                "
              />

              <!-- Row -->
              <div
                v-else-if="row.type === 'row'"
                :style="rowStyles(row)"
                v-show="
                  evaluateVisibility(row.visibility, visibilityPreviewContext)
                "
              >
                <div
                  v-for="col in row.columns || []"
                  :key="col.id"
                  :style="columnStyles(col, row)"
                >
                  <PreviewComponent
                    v-for="child in col.children ?? col.components ?? []"
                    :key="child.id"
                    :component="child"
                    :force-mobile="forceMobile"
                    :depth="1"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// components/preview/PreviewCanvas.vue
//
// Mirrors the real canvas renderer (CanvasRow.vue, CanvasColumn.vue,
// CanvasComponent.vue) but stripped of editor chrome: no drop zones, no
// selection rings, no drag handles.
//
// Fidelity points:
//   1. Column widths are PERCENTAGES (`col.width` is a percent, not a flex
//      share). Renderer uses `width: ${col.width}%`.
//   2. mobileStack is per-ROW, gated on the active client's `forcesMobile`
//      capability — Apple Mail desktop is NOT mobile, Gmail Android IS,
//      regardless of viewport pixel width.
//   3. Gradient shape: backgroundGradient.gradient.{type, direction, colors}
//      where colors is [{color, position}]. Source pane ALWAYS renders the
//      gradient — client-specific downgrades happen only in the right pane.
//   4. Row & column carry background-image with size/position/repeat.
//   5. Column `padding` defaults to "10px" when missing (matches CanvasColumn).
//   6. `verticalAlign = "top" | "middle" | "bottom"` on column maps to flex
//      justify-content via verticalAlignMap (same as CanvasColumn).
//
// Column overflow handling:
//   The previous version set `overflow: hidden` on EVERY column. Paired with
//   `border-radius` + `display: flex; flex-direction: column`, that triggers
//   a rendering quirk in some engines where the column's BACKGROUND paints
//   with square corners — so rounded white cards (like _four.json's columns
//   with border-radius:10) looked square in the source pane even though the
//   real builder canvas rendered them rounded.
//
//   Fix: only apply `overflow: hidden` when the column actually has
//   `border-radius > 0`. There, we genuinely need to clip child content to
//   the rounded shape (matching the generated HTML's <td style="border-
//   radius:Npx;overflow:hidden"> pattern). For columns without radius, omit
//   overflow entirely — same as the real CanvasColumn.

import { computed } from "vue";
import PreviewComponent from "./PreviewComponent.vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useEmailBuilderVisibility } from "@/composables/emailBuilder/core/useEmailBuilderVisibility";

const props = defineProps<{
  rows: any[];
  canvas: any;
  /** When true, render as if viewing on a mobile breakpoint —
   *  triggers mobileStack and mobile prop overrides. */
  forceMobile?: boolean;
}>();

// ── Visibility (mirrors Canvas.vue) ────────────────────────────────────────
//
// Rows and row-spacers can be conditionally hidden via the visibility builder
// (e.g. "only show on mobile", "only show for clients with dark-mode support",
// etc). The real Canvas.vue gates each row/row-spacer with
//   v-show="evaluateVisibility(item.visibility, visibilityPreviewContext)"
// — we mirror that here so the source pane matches the live canvas exactly.
// Without this, a hidden row in the builder would still appear in the source
// preview, which is the bug being fixed.
const { visibilityPreviewContext } = useEmailBuilder();
const { evaluateVisibility } = useEmailBuilderVisibility();

const bodyBg = computed(() => props.canvas?.bodyBackgroundColor ?? "#f9fafb");

const hasContent = computed(() => (props.rows ?? []).length > 0);

// Effective rendered width. Mirrors Canvas.vue:previewWidth — desktop uses
// canvas.width, mobile uses min(360, mobileBreakpoint).
const effectiveWidth = computed(() => {
  const desktopW = props.canvas?.width ?? 600;
  if (!props.forceMobile) return desktopW;
  const mb = props.canvas?.mobileBreakpoint ?? 600;
  return mb === 600 ? 360 : mb;
});

const canvasPadding = computed(() => {
  const p = props.canvas?.padding;
  if (!p) return "0";
  return `${p.top ?? 0}px ${p.right ?? 0}px ${p.bottom ?? 0}px ${p.left ?? 0}px`;
});

// ── Background resolver (matches CanvasRow / CanvasColumn exactly) ─────────
//
// The source pane is the SOURCE OF TRUTH — it always renders the authored
// design as-is, including gradients. Client-specific downgrades happen only
// in the right pane (PreviewRendered) via transformForClient.

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

// ── Row spacer ─────────────────────────────────────────────────────────────

function rowSpacerStyle(spacer: any): Record<string, string> {
  // Mirror CanvasRowSpacer.vue:spacerStyles — gradient when useGradient is
  // true, otherwise the solid backgroundColor (fallback "transparent").
  return {
    width: "100%",
    height: (spacer.height ?? 20) + "px",
    background: resolveBackground(spacer),
  };
}

// ── Row styles (mirrors CanvasRow.vue:rowStyles) ──────────────────────────

function rowStyles(row: any): Record<string, string> {
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
    width: "100%",
    boxSizing: "border-box",
  };

  // Border is optional on the row but CanvasRow always reads it.
  if (row.border) {
    styles.border = `${row.border.width ?? 0}px ${row.border.style ?? "solid"} ${row.border.color ?? "transparent"}`;
    styles.borderRadius = `${row.border.radius ?? 0}px`;
  }

  if ((row.gap ?? 0) > 0) {
    styles.gap = `${row.gap}px`;
  }

  if (row.backgroundImage) {
    styles.backgroundImage = `url(${row.backgroundImage})`;
    styles.backgroundSize = row.backgroundSize ?? "cover";
    styles.backgroundPosition = row.backgroundPosition ?? "center center";
    styles.backgroundRepeat = row.backgroundRepeat ?? "no-repeat";
  }

  return styles;
}

// ── Column styles (mirrors CanvasColumn.vue:columnStyles) ─────────────────

const VERTICAL_ALIGN_MAP: Record<string, string> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

function columnStyles(col: any, row: any): Record<string, string> {
  const isStacked = props.forceMobile && row.mobileStack === true;
  const radius = col.border?.radius ?? 0;

  const styles: Record<string, string> = {
    width: isStacked ? "100%" : `${col.width ?? 100}%`,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: VERTICAL_ALIGN_MAP[col.verticalAlign] || "flex-start",
    padding: col.padding
      ? `${col.padding.top ?? 0}px ${col.padding.right ?? 0}px ${col.padding.bottom ?? 0}px ${col.padding.left ?? 0}px`
      : "10px",
    background: resolveBackground(col),
    // minWidth:0 lets flex columns shrink below their content's intrinsic
    // width — required for word-wrap to actually take effect inside flex.
    minWidth: "0",
  };

  // overflow:hidden ONLY when the column has rounded corners. There, we
  // need it to clip child content to the rounded shape (matches the
  // generated HTML's <td style="border-radius:Npx;overflow:hidden">). For
  // square columns, we omit `overflow` so the flex+radius+overflow rendering
  // quirk that hides backgrounds doesn't apply. Same behavior as the real
  // CanvasColumn (which never sets overflow).
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
</script>
