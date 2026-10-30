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
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                  width="24"
                  height="24"
                  fill="currentColor"
                  stroke-width="1.5"
                  class="w-full h-full shrink-0"
                >
                  <g>
                    <path
                      d="M175.365,0c-4.564,0-8.264,3.699-8.264,8.264V41.32c0,4.565,3.7,8.264,8.264,8.264c4.564,0,8.264-3.699,8.264-8.264V8.264C183.629,3.699,179.929,0,175.365,0z"
                    />
                  </g>
                  <g>
                    <path
                      d="M134.46,59.076L111.087,35.7c-3.227-3.226-8.46-3.226-11.686,0c-3.227,3.229-3.227,8.46,0,11.688l23.374,23.375c1.613,1.614,3.729,2.421,5.843,2.421c2.115,0,4.23-0.807,5.843-2.42C137.688,67.535,137.688,62.304,134.46,59.076z"
                    />
                  </g>
                  <g>
                    <path
                      d="M251.331,35.701c-3.227-3.226-8.46-3.226-11.686,0l-23.374,23.375c-3.227,3.228-3.227,8.46,0,11.687c1.613,1.613,3.728,2.42,5.843,2.42c2.114,0,4.23-0.807,5.843-2.42l23.374-23.375C254.558,44.161,254.558,38.929,251.331,35.701z"
                    />
                  </g>
                  <g>
                    <path
                      d="M373.701,215.414c-10.495,0-20.083,3.939-27.378,10.409c-5.854-15.714-21.006-26.937-38.734-26.937c-10.495,0-20.083,3.939-27.378,10.409c-5.854-15.714-21.006-26.937-38.734-26.937c-9.295,0-17.881,3.086-24.792,8.287v-83.214c0-22.784-18.536-41.32-41.32-41.32c-22.784,0-41.32,18.536-41.32,41.32V265.83c-18.837,3.839-33.056,20.533-33.056,40.488v49.584c0,80.163,60.006,147.249,139.58,156.046c0.308,0.034,0.615,0.052,0.918,0.052c4.156,0,7.736-3.129,8.203-7.357c0.501-4.536-2.769-8.62-7.305-9.121c-71.186-7.872-124.868-67.894-124.868-139.619v-49.584c0-10.773,6.91-19.959,16.528-23.371v56.426c0,4.565,3.7,8.264,8.264,8.264s8.264-3.699,8.264-8.264V107.432c0-13.67,11.121-24.792,24.792-24.792c13.671,0,24.792,11.122,24.792,24.792v165.831c0,4.565,3.7,8.264,8.264,8.264c4.564,0,8.264-3.699,8.264-8.264v-49.584c0-13.67,11.121-24.792,24.792-24.792s24.792,11.122,24.792,24.792v49.584c0,4.565,3.7,8.264,8.264,8.264c4.564,0,8.264-3.699,8.264-8.264v-33.056c0-13.67,11.121-24.792,24.792-24.792s24.792,11.122,24.792,24.792v33.056c0,4.565,3.7,8.264,8.264,8.264c4.564,0,8.264-3.699,8.264-8.264v-16.528c0-13.67,11.121-24.792,24.792-24.792s24.792,11.122,24.792,24.792v99.168c0,71.726-53.682,131.748-124.868,139.619c-4.536,0.501-7.807,4.585-7.305,9.121c0.467,4.228,4.046,7.357,8.203,7.357c0.303,0,0.61-0.018,0.918-0.051c79.573-8.798,139.58-75.884,139.58-156.047v-99.168C415.02,233.95,396.485,215.414,373.701,215.414z"
                    />
                  </g>
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
  if (
    isRowDragActive.value &&
    !isTopLevelRowDragActive.value &&
    nestedRowDragId.value
  ) {
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
