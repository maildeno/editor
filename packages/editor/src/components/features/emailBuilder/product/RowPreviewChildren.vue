<template>
  <template v-for="(child, _) in children" :key="child.id">
    <!-- ── Depth guard ──────────────────────────────────────────────────── -->
    <template v-if="(depth ?? 0) < 5">

      <!-- ── Nested row ─────────────────────────────────────────────────── -->
      <RowPreviewRow
        v-if="child.type === 'row'"
        :row="child"
        :scale="scale"
        :depth="(depth ?? 0) + 1"
      />

      <!-- ── Row spacer ─────────────────────────────────────────────────── -->
      <div
        v-else-if="child.type === 'row-spacer'"
        :style="{
          width: '100%',
          height: spacerHeight(child) + 'px',
          background: resolveBackground(child),
          flexShrink: '0',
        }"
      />

      <!-- ── New-shape leaf component (type === 'component') ────────────── -->
      <RowPreviewLegacyComponent
        v-else-if="child.type === 'component'"
        :comp="{ ...child, type: child.componentType ?? child.type }"
        :scale="scale"
      />

      <!-- ── Legacy-shape leaf (type IS the componentType e.g. 'paragraph') -->
      <RowPreviewLegacyComponent
        v-else
        :comp="child"
        :scale="scale"
      />

    </template>

    <!-- Depth exceeded — silent gap to preserve layout -->
    <div v-else style="height: 4px; width: 100%;" />
  </template>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from "vue";

// Break circular cycle: RowPreviewRow → RowPreviewChildren → RowPreviewRow
const RowPreviewRow = defineAsyncComponent(() => import("./RowPreviewRow.vue"));
const RowPreviewLegacyComponent = defineAsyncComponent(
  () => import("./RowPreviewLegacyComponent.vue"),
);

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /**
   * The children[] (or legacy components[]) array from a column.
   * Always use:  col.children ?? col.components ?? []
   */
  children: any[];
  /** Preview scale factor forwarded from RowsPanel */
  scale?: number;
  /** Recursion depth — blocked at 5 */
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
    const stops = colors.map((c: any) => `${c.color} ${c.position}%`).join(", ");
    return type === "radial"
      ? `radial-gradient(circle at center, ${stops})`
      : `linear-gradient(${direction}, ${stops})`;
  }

  return item?.backgroundColor ?? item?.props?.backgroundColor ?? "transparent";
}

function spacerHeight(spacer: any): number {
  // row-spacer height lives directly on the node (not inside props)
  return spacer.height ?? spacer.props?.height ?? 8;
}
</script>
