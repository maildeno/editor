<template>
  <div :style="rowStyle" class="w-full">
    <div
      v-for="col in row.columns ?? []"
      :key="col.id"
      :style="colStyle(col, row)"
      class="shrink-0"
    >
      <!--
        Recurse into children via the RowPreviewChildren dispatcher. The depth
        handed on is this row's own: RowPreviewChildren adds one when it makes
        a nested row, so adding one here too would count every level twice and
        cut the thumbnail off at the third nested row.
      -->
      <RowPreviewChildren
        :children="col.children ?? col.components ?? []"
        :scale="scale"
        :depth="depth ?? 0"
      />

      <!-- Empty column placeholder -->
      <div
        v-if="(col.children ?? col.components ?? []).length === 0"
        class="w-full border border-dashed border-(--md-border) rounded"
        style="min-height: 10px"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { borderRadiusValue } from "@/composables/emailBuilder/core/borderRadius";
import {
  boxShadowValue,
  clipsOverflow,
} from "@/composables/emailBuilder/core/boxShadow";

// Break circular cycle: RowPreviewChildren → RowPreviewRow → RowPreviewChildren
const RowPreviewChildren = defineAsyncComponent(
  () => import("./RowPreviewChildren.vue"),
);

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  row: Record<string, any>;
  scale?: number;
  /**
   * How deep this row is: 1 for a row in a top-level row's column, 2 for one
   * in that row's column, and so on. A row at 5 is drawn, and what it holds is
   * left out (RowPreviewChildren), as on the canvas.
   */
  depth?: number;
}>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveBackground(item: any): string {
  const bg = item?.backgroundGradient;
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

  return item?.backgroundColor ?? "transparent";
}

// ── Row styles ────────────────────────────────────────────────────────────────

const rowStyle = computed(() => {
  const r = props.row;
  const style: Record<string, string> = {
    display: "flex",
    flexDirection: "row",
    background: resolveBackground(r),
    padding: `${r.padding?.top ?? 0}px ${r.padding?.right ?? 0}px ${r.padding?.bottom ?? 0}px ${r.padding?.left ?? 0}px`,
    alignItems: "stretch",
    border: `${r.border?.width ?? 0}px ${r.border?.style ?? "solid"} ${r.border?.color ?? "transparent"}`,
    borderRadius: borderRadiusValue(r.border?.radius),
    gap: `${r.gap ?? 0}px`,
  };

  // The canvas's rule: the row clips what it holds, unless a shadow inside it
  // would be cut off and no rounded corner needs the clip (see clipsOverflow).
  // Its own shadow is never clipped by it.
  if (clipsOverflow(r)) style.overflow = "hidden";
  const shadow = boxShadowValue(r.boxShadow);
  if (shadow) style.boxShadow = shadow;

  if (r.backgroundImage) {
    style.backgroundImage = `url(${r.backgroundImage})`;
    style.backgroundSize = r.backgroundSize ?? "cover";
    style.backgroundPosition = r.backgroundPosition ?? "center center";
  }

  return style;
});

// ── Column styles ─────────────────────────────────────────────────────────────

function colStyle(col: any, parentRow?: any) {
  const verticalAlignMap: Record<string, string> = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end",
  };

  // Gap-compensated flex-basis.
  // When a flex parent uses `gap`, the gap is added ON TOP of each child's
  // declared width, so raw `width: 50%` on two columns + any gap > 0
  // overflows the parent and shifts the last column.
  // Industry-standard fix (Bootstrap 5 gutter system, CSS Grid behaviour):
  // subtract this column's share of the total gap space from its width.
  //   width = width% - (gap * (siblingCount - 1) / siblingCount)
  const widthPct = col.width ?? 50;
  const siblingCount = parentRow?.columns?.length || 1;
  const gapPx = parentRow?.gap ?? 0;
  const gapShare =
    siblingCount > 1 ? (gapPx * (siblingCount - 1)) / siblingCount : 0;
  const widthValue =
    gapShare > 0 ? `calc(${widthPct}% - ${gapShare}px)` : `${widthPct}%`;

  const style: Record<string, string> = {
    flex: `0 0 ${widthValue}`,
    width: widthValue,
    maxWidth: widthValue,
    boxSizing: "border-box",
    background: resolveBackground(col),
    padding: `${col.padding?.top ?? 10}px ${col.padding?.right ?? 10}px ${col.padding?.bottom ?? 10}px ${col.padding?.left ?? 10}px`,
    border: `${col.border?.width ?? 0}px ${col.border?.style ?? "solid"} ${col.border?.color ?? "transparent"}`,
    borderRadius: borderRadiusValue(col.border?.radius),
    minWidth: "0",
    display: "flex",
    flexDirection: "column",
    justifyContent: verticalAlignMap[col.verticalAlign] ?? "flex-start",
  };

  // Same rule as the row.
  if (clipsOverflow(col)) style.overflow = "hidden";
  const shadow = boxShadowValue(col.boxShadow);
  if (shadow) style.boxShadow = shadow;

  if (col.backgroundImage) {
    style.backgroundImage = `url(${col.backgroundImage})`;
    style.backgroundSize = col.backgroundSize ?? "cover";
    style.backgroundPosition = col.backgroundPosition ?? "center center";
    style.minHeight = "14px";
  }

  return style;
}
</script>
