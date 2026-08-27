<template>
  <div class="flex-1 pt-3 pb-20 px-8" data-canvas-scroll>
    <div class="max-w-4xl mx-auto">
      <div
        :style="{
          padding: `${canvasStyles.padding.top}px ${canvasStyles.padding.right}px ${canvasStyles.padding.bottom}px ${canvasStyles.padding.left}px`,
        }"
      >
        <div
          :style="{
            width: previewWidth,
            backgroundColor: canvasStyles.backgroundColor,
            // transition: 'width 0.3s ease',
          }"
          class="mx-auto"
        >
          <!-- Empty state -->
          <div v-if="rows.length === 0" class="relative min-h-87.5">
            <CanvasRowDropZone
              :insert-index="0"
              :is-empty="true"
              :full-height="true"
              @drop="handleLayoutDrop"
            />
            <div
              class="flex flex-col items-center justify-center min-h-87.5 px-6 text-(--md-text-muted) pointer-events-none"
            >
              <div class="w-12 h-12 mx-auto mb-3">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M8 12h8M12 8v8" />
                </svg>
              </div>
              <p class="text-lg font-medium mb-2">Start Building Your Email</p>
              <p class="text-sm text-center">
                Add rows from the "Layout" tab or drag a layout onto the canvas
              </p>
            </div>
          </div>

          <!-- Rows with drop zones woven between them -->
          <template v-else>
            <!-- Drop zone BEFORE the first row -->
            <CanvasRowDropZone :insert-index="0" @drop="handleLayoutDrop" />

            <template v-for="(item, index) in rows" :key="item.id">
              <CanvasRow
                v-if="item.type === 'row'"
                :row="item"
                :is-first="index === 0"
                :is-last="index === rows.length - 1"
                :index="index"
                v-show="
                  evaluateVisibility(item.visibility, visibilityPreviewContext)
                "
              />
              <CanvasRowSpacer
                v-else-if="item.type === 'row-spacer'"
                :spacer="item"
                :is-first="index === 0"
                :is-last="index === rows.length - 1"
                :index="index"
                v-show="
                  evaluateVisibility(item.visibility, visibilityPreviewContext)
                "
              />

              <!-- Drop zone AFTER every row -->
              <CanvasRowDropZone
                :insert-index="index + 1"
                @drop="handleLayoutDrop"
              />
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useEmailBuilderVisibility } from "@/composables/emailBuilder/core/useEmailBuilderVisibility";
import { useProductRows } from "@/composables/emailBuilder/components/useProductRows";
import CanvasRow from "./CanvasRow.vue";
import CanvasRowSpacer from "./CanvasRowSpacer.vue";
import { useLayoutDrag } from "@/composables/emailBuilder/core/ui/useLayoutDrag";
import CanvasRowDropZone from "../ui/canvas/CanvasRowDropZone.vue";

const {
  rows,
  canvasStyles,
  previewMode,
  visibilityPreviewContext,
  addRowSilent,
  addSpacerSilent,
  reorderRowsSilent,
  moveNestedRow,
  saveToHistoryImmediate,
  nestedRowDragId,
  isRowDragActive,
  isTopLevelRowDragActive,
} = useEmailBuilder();
const { evaluateVisibility } = useEmailBuilderVisibility();
const { layoutDragPayload } = useLayoutDrag();
const { cloneRowForCanvas } = useProductRows();

const previewWidth = computed(() => {
  if (previewMode.value !== "mobile") {
    return canvasStyles.value.width + "px";
  }
  return canvasStyles.value.mobileBreakpoint === 600
    ? "360px"
    : canvasStyles.value.mobileBreakpoint + "px";
});

/**
 * Called when a CanvasRowDropZone fires its "drop" event.
 *
 * FIX: previously addRow/addSpacer each called saveToHistory internally, and
 * reorderRows called it again — meaning a single drag-drop created TWO history
 * entries and the user had to press Undo twice to fully reverse the action.
 *
 * Now:
 *  • addRowSilent / addSpacerSilent mutate rows WITHOUT saving history.
 *  • reorderRowsSilent moves the item WITHOUT saving history.
 *  • A single saveToHistory("add-row-at-position") commits the final state as
 *    one atomic entry — one Undo reverses the whole drag-drop cleanly.
 *
 * For product-rows the push+saveToHistory pattern is unchanged because they
 * don't go through the reorder step.
 */
const handleLayoutDrop = async (insertIndex: number) => {
  // ── Nested row promoted to top-level canvas ──────────────────────────────────
  if (isRowDragActive.value && !isTopLevelRowDragActive.value && nestedRowDragId.value) {
    moveNestedRow(nestedRowDragId.value, null, null, insertIndex);
    isRowDragActive.value = false;
    nestedRowDragId.value = null;
    return;
  }

  // ── Layout-tab drag ─────────────────────────────────────────────────────────
  const payload = layoutDragPayload.value;
  if (!payload) return;

  // Capture the index where the new item will land (end of the array)
  // BEFORE the silent mutation appends it.
  const appendedIndex = rows.value.length;

  if (payload.type === "spacer") {
    // Mutate silently — no history entry yet
    addSpacerSilent();
  } else if (payload.type === "row") {
    addRowSilent(payload.columns);
  } else if (payload.type === "product-row") {
    const cloned = cloneRowForCanvas(payload.entryId);
    if (!cloned) return;
    // Push silently — reorder + single atomic history commit happens below,
    // exactly like "row" and "spacer" types. This ensures:
    //  1. The row lands at insertIndex, not always the bottom.
    //  2. A single Undo press fully reverses the entire drag-drop.
    rows.value.push(cloned);
  } else {
    return;
  }

  // Wait for Vue to flush the reactive push before reordering
  await nextTick();

  if (insertIndex < appendedIndex) {
    // Move to the intended drop position — still silent
    reorderRowsSilent(appendedIndex, insertIndex);
  }

  // ── Single atomic immediate history commit ────────────────────────────────
  // Both the add and the optional reorder are baked into one snapshot.
  // One Undo press fully reverses the entire drag-drop.
  saveToHistoryImmediate("add-row-at-position");
};
</script>