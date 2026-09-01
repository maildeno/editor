<template>
  <!-- Depth guard — never render beyond 5 levels of nesting -->
  <template v-if="(depth ?? 0) < 5">
    <!-- ── Leaf component ───────────────────────────────────────────────── -->
    <CanvasComponent
      v-if="element.type === 'component'"
      :component="element"
      :row-id="rowId"
      :column-id="columnId"
      :index="index"
      :is-first="isFirst"
      :is-last="isLast"
      v-show="
        evaluateVisibility(element.props?.visibility, visibilityPreviewContext)
      "
    />

    <!-- ── Nested row ───────────────────────────────────────────────────── -->
    <CanvasRow
      v-else-if="element.type === 'row'"
      :row="element"
      :index="index"
      :is-first="isFirst"
      :is-last="isLast"
      :depth="(depth ?? 0) + 1"
      v-show="evaluateVisibility(element.visibility, visibilityPreviewContext)"
    />

    <!-- ── Row spacer ────────────────────────────────────────────────────── -->
    <CanvasRowSpacer
      v-else-if="element.type === 'row-spacer'"
      :spacer="element"
      :index="index"
      :is-first="isFirst"
      :is-last="isLast"
      v-show="evaluateVisibility(element.visibility, visibilityPreviewContext)"
    />

    <!-- ── Unknown type fallback ─────────────────────────────────────────── -->
    <div
      v-else
      class="text-xs text-(--md-text-subtle) italic px-2 py-1 bg-(--md-surface-hover) rounded border border-dashed border-(--md-border)"
    >
      Unknown element type: {{ element.type }}
    </div>
  </template>

  <!-- Depth exceeded warning -->
  <div
    v-else
    class="text-xs text-(--md-warning) italic px-2 py-1 bg-(--md-warning-bg) rounded border border-dashed border-(--md-warning-border)"
  >
    Max nesting depth reached (5)
  </div>
</template>

<script setup lang="ts">
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useEmailBuilderVisibility } from "@/composables/emailBuilder/core/useEmailBuilderVisibility";

// ── Synchronous imports ──────────────────────────────────────────────────────
//
// The previous version used defineAsyncComponent() here with a comment about
// "breaking a circular import cycle". That wasn't needed — ES modules handle
// the cycle CanvasColumn → CanvasElement → CanvasRow → CanvasColumn correctly
// as long as the imports are only READ from inside component render functions
// (which is always true in <script setup lang="ts">, since the template uses them only
// when Vue calls render()). Module evaluation order doesn't matter because
// by the time any render() fires, all modules have finished loading.
//
// Why the async wrappers hurt: on an initial render of a template with 60+
// components, each defineAsyncComponent mount triggered a separate Promise
// microtask and, depending on your bundler's chunking, a separate module
// fetch. That's 60+ sequential async resolutions before the canvas could
// paint — a dominant contributor to LCP > 9 s.
//
// Direct imports compile into one synchronous mount path. The three imports
// below are in the same module graph the top-level Canvas.vue already pulls
// in, so they're already in the initial bundle: no extra network cost.
import CanvasComponent from "./CanvasComponent.vue";
import CanvasRow from "./CanvasRow.vue";
import CanvasRowSpacer from "./CanvasRowSpacer.vue";

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /** The CanvasChild node to render (component | row | row-spacer) */
  element: Record<string, any>;
  /** Forwarded to CanvasComponent for operation lookups */
  rowId: string;
  /** Forwarded to CanvasComponent for column-scoped operations */
  columnId: string;
  /** Position within the parent children[] array */
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /**
   * Recursion depth — incremented each time CanvasElement renders a nested row.
   * Rendering is blocked at depth >= 5 to prevent infinite loops from bad data.
   * Default: 0 (top-level, inside a root row).
   */
  depth?: number;
}>();

// ── Composables ───────────────────────────────────────────────────────────────

const { visibilityPreviewContext } = useEmailBuilder();
const { evaluateVisibility } = useEmailBuilderVisibility();
</script>
