<template>
  <!--
    LayerDropLine
    A thin animated insertion-line that appears between Layers Panel items
    during drag-and-drop. Indented to match the depth of the items around it.

    Props:
      active  — show the line (bound to the computed dropTarget match)
      depth   — indentation level (0 = top-level rows, 1 = children inside
                a single-column row, 2 = deeper nesting, etc.)
  -->
  <div
    class="relative h-0.5 overflow-visible pointer-events-none"
    :class="active ? 'z-20' : ''"
    aria-hidden="true"
  >
    <Transition name="drop-line">
      <div
        v-if="active"
        class="absolute inset-y-0 right-0 flex items-center"
        :style="{ left: indentPx }"
      >
        <!-- Dot -->
        <div
          class="w-1.5 h-1.5 rounded-full bg-(--md-row-selection) shrink-0 -ml-0.75"
        />
        <!-- Line -->
        <div class="flex-1 h-0.5 bg-(--md-row-selection) rounded-full" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  active: boolean;
  /** Tree depth. Used to compute left-offset so the line aligns with the item text. */
  depth?: number;
}>();

// Must stay in sync with INDENT_BASE / INDENT_STEP in LayersPanel.vue —
// the drop line sits *between* tree items and has to match their indent
// exactly, otherwise it drifts right of the item edge as depth increases.
const INDENT_BASE = 12;
const INDENT_STEP = 16;

const indentPx = computed(() => {
  const d = props.depth ?? 0;
  return `${INDENT_BASE + d * INDENT_STEP}px`;
});
</script>

<style scoped>
.drop-line-enter-active {
  transition:
    opacity 80ms ease,
    transform 80ms ease;
}
.drop-line-leave-active {
  transition:
    opacity 60ms ease,
    transform 60ms ease;
}
.drop-line-enter-from,
.drop-line-leave-to {
  opacity: 0;
  transform: scaleX(0.6);
  transform-origin: left center;
}
</style>
