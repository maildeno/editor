<template>
  <div :style="rowStyle" class="flex w-full pointer-events-none select-none">
    <div
      v-for="col in row.columns"
      :key="col.id"
      :style="colStyle(col, row)"
      class="overflow-hidden shrink-0"
    >
      <!-- Delegate to RowPreviewChildren — handles component, nested row, spacer -->
      <RowPreviewChildren
        :children="col.children ?? col.components ?? []"
        :scale="scale"
        :depth="0"
      />

      <!-- Empty column placeholder -->
      <div
        v-if="(col.children ?? col.components ?? []).length === 0"
        class="w-full border border-dashed border-[var(--md-border)] rounded"
        style="min-height: 10px"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import RowPreviewChildren from "./RowPreviewChildren.vue";
import { useGoogleFonts } from "@/composables/system/useGoogleFonts";

const props = defineProps<{
  row: Record<string, any>;
  /** Optional scale factor forwarded from RowsPanel */
  scale?: number;
}>();

const { WEB_SAFE_FONTS, FONTS_WITH_ITALICS, DEFAULT_WEIGHTS } =
  useGoogleFonts();


// ── Background helper ─────────────────────────────────────────────────────────

const resolveBackground = (item: any): string => {
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

  return item?.backgroundColor || "transparent";
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Builds the Google Fonts v2 weight parameter for a font.
 *
 * Fonts WITH italics → ital,wght@0,300;0,400;...;1,300;1,400;...
 * Fonts WITHOUT italics → wght@300;400;500;600;700;800
 *
 * Axes must be alphabetical (ital before wght) per the API spec.
 */
const buildWeightParam = (fontFamily: string): string => {
  if (FONTS_WITH_ITALICS.has(fontFamily)) {
    const normal = DEFAULT_WEIGHTS.map((w) => `0,${w}`);
    const italic = DEFAULT_WEIGHTS.map((w) => `1,${w}`);
    return `ital,wght@${[...normal, ...italic].join(";")}`;
  }
  return `wght@${DEFAULT_WEIGHTS.join(";")}`;
};

// ─── Main function ────────────────────────────────────────────────────────────

const loadGoogleFont = (fontFamily?: string): void => {
  if (!fontFamily) return;
  if (typeof document === "undefined") return; // SSR guard
  if (WEB_SAFE_FONTS.has(fontFamily)) return; // no request needed

  const formattedFamily = fontFamily.trim().replace(/\s+/g, "+");
  const href = `https://fonts.googleapis.com/css2?family=${formattedFamily}:${buildWeightParam(fontFamily)}&display=swap`;

  // Deduplicate — don't inject the same <link> twice
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
};

// Walk the full recursive tree to load all fonts used in this row
const loadAllFontsInRow = () => {
  function walkChildren(children: any[]) {
    for (const child of children) {
      if (child.type === "row") {
        // Recurse into nested row columns
        for (const col of child.columns ?? []) {
          walkChildren(col.children ?? col.components ?? []);
        }
      } else {
        const p = child.props;
        if (!p?.fontFamily) continue;
        const compType = child.componentType ?? child.type;
        if (
          ["heading", "paragraph", "list", "menu", "button", "anchor"].includes(
            compType,
          )
        ) {
          loadGoogleFont(p.fontFamily);
        }
      }
    }
  }

  for (const col of props.row.columns ?? []) {
    walkChildren(col.children ?? col.components ?? []);
  }
};

watch(
  () => props.row,
  () => loadAllFontsInRow(),
  { deep: true, immediate: true },
);

onMounted(() => loadAllFontsInRow());

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
    borderRadius: `${r.border?.radius ?? 0}px`,
    gap: `${r.gap ?? 0}px`,
  };

  if (r.backgroundImage) {
    style.backgroundImage = `url(${r.backgroundImage})`;
    style.backgroundSize = r.backgroundSize || "cover";
    style.backgroundPosition = r.backgroundPosition || "center center";
  }

  return style;
});

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
  const widthPct = col.width ?? 100;
  const siblingCount = parentRow?.columns?.length || 1;
  const gapPx = parentRow?.gap ?? 0;
  const gapShare = siblingCount > 1 ? (gapPx * (siblingCount - 1)) / siblingCount : 0;
  const widthValue =
    gapShare > 0
      ? `calc(${widthPct}% - ${gapShare}px)`
      : `${widthPct}%`;

  const style: Record<string, string> = {
    flex: `0 0 ${widthValue}`,
    width: widthValue,
    maxWidth: widthValue,
    boxSizing: "border-box",
    background: resolveBackground(col),
    padding: `${col.padding?.top ?? 10}px ${col.padding?.right ?? 10}px ${col.padding?.bottom ?? 10}px ${col.padding?.left ?? 10}px`,
    border: `${col.border?.width ?? 0}px ${col.border?.style ?? "solid"} ${col.border?.color ?? "transparent"}`,
    borderRadius: `${col.border?.radius ?? 0}px`,
    overflow: "hidden",
    minWidth: "0",
    display: "flex",
    flexDirection: "column",
    justifyContent: verticalAlignMap[col.verticalAlign] || "flex-start",
  };

  if (col.backgroundImage) {
    style.backgroundImage = `url(${col.backgroundImage})`;
    style.backgroundSize = col.backgroundSize || "cover";
    style.backgroundPosition = col.backgroundPosition || "center center";
    style.minHeight = "14px";
  }

  return style;
}
</script>