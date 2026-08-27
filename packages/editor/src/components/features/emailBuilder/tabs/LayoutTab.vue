<template>
  <div class="h-[calc(100vh-7.5rem)] overflow-y-auto">
    <div class="p-4 space-y-5">
      <!-- Header -->
      <div>
        <h3 class="text-sm font-medium text-[var(--md-text-muted)]">Add Layouts</h3>
        <p class="text-xs text-[var(--md-text-subtle)] mt-0.5">
          Click to append · Drag to position
        </p>
      </div>

      <!-- ========== Equal Layouts ========== -->
      <div class="space-y-3">
        <button
          @click="equalOpen = !equalOpen"
          class="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--md-text-subtle)] group-hover:text-[var(--md-text-muted)] transition-colors"
        >
          <span>Equal columns</span>

          <svg
            class="w-3.5 h-3.5 text-[var(--md-text-subtle)] group-hover:text-[var(--md-text-muted)] transition-all duration-200"
            :class="{ '-rotate-90': !equalOpen }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <transition name="slide">
          <div v-if="equalOpen" class="grid grid-cols-2 gap-2">
            <div
              v-for="layout in equalLayouts"
              :key="layout.label"
              class="relative group/btn"
            >
              <button
                draggable="true"
                @click="handleLayoutClick(layout.columns)"
                @dragstart="
                  onDragStart($event, { type: 'row', columns: layout.columns })
                "
                @dragend="onDragEnd"
                class="group w-full relative p-3 border border-[var(--md-border)]/65 rounded-lg hover:border-[var(--md-row-selection)] hover:shadow-sm transition-all cursor-grab active:cursor-grabbing select-none"
              >
                <span
                  class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-[var(--md-text-subtle)] leading-none"
                  >⠿</span
                >
                <div class="flex gap-1 h-6">
                  <div
                    v-for="(col, i) in layout.preview"
                    :key="i"
                    class="bg-[var(--md-surface-muted)] rounded group-hover:bg-[var(--md-row-selection-bg)] transition-colors flex-1"
                  />
                </div>
              </button>
              <div
                class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
              >
                Click · Drag to position
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- ========== Asymmetric Layouts ========== -->
      <div class="space-y-3">
        <button
          @click="asymmetricOpen = !asymmetricOpen"
          class="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--md-text-subtle)] group-hover:text-[var(--md-text-muted)] transition-colors"
        >
          <span>Asymmetric</span>
          <svg
            class="w-3.5 h-3.5 text-[var(--md-text-subtle)] group-hover:text-[var(--md-text-muted)] transition-all duration-200"
            :class="{ '-rotate-90': !asymmetricOpen }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <transition name="slide">
          <div v-if="asymmetricOpen" class="grid grid-cols-2 gap-2">
            <div
              v-for="layout in asymmetricLayouts"
              :key="layout.label"
              class="relative group/btn"
            >
              <button
                draggable="true"
                @click="handleLayoutClick(layout.widths)"
                @dragstart="
                  onDragStart($event, { type: 'row', columns: layout.widths })
                "
                @dragend="onDragEnd"
                class="group w-full relative p-3 border border-[var(--md-border)]/65 rounded-lg hover:border-[var(--md-row-selection)] hover:shadow-sm transition-all cursor-grab active:cursor-grabbing select-none"
              >
                <span
                  class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-[var(--md-text-subtle)] leading-none"
                  >⠿</span
                >
                <div class="flex gap-1 h-6">
                  <div
                    v-for="(width, i) in layout.widths"
                    :key="i"
                    class="bg-[var(--md-surface-muted)] rounded group-hover:bg-[var(--md-row-selection-bg)] transition-colors flex items-center justify-center text-[8px] text-[var(--md-text-subtle)]"
                    :style="{ flex: width }"
                  >
                    {{ width }}%
                  </div>
                </div>
              </button>
              <div
                class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
              >
                Click · Drag to position
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- ========== Custom Layout ========== -->
      <div class="space-y-3">
        <button
          @click="customOpen = !customOpen"
          class="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--md-text-subtle)] group-hover:text-[var(--md-text-muted)] transition-colors"
        >
          <span>Custom</span>
          <svg
            class="w-3.5 h-3.5 text-[var(--md-text-subtle)] group-hover:text-[var(--md-text-muted)] transition-all duration-200"
            :class="{ '-rotate-90': !customOpen }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <transition name="slide">
          <div v-if="customOpen" class="space-y-4">
            <div>
              <label class="block text-xs text-[var(--md-text-subtle)] mb-1.5"
                >Number of columns</label
              >
              <div class="flex gap-2">
                <input
                  v-model.number="columnLimit"
                  type="number"
                  min="1"
                  max="6"
                  class="flex-1 px-3 py-2 text-xs text-[var(--md-text)] outline-1 outline-[var(--md-border)] rounded-md shadow-xs focus:outline-none focus:ring-[1px] focus:ring-[var(--md-selection)]"
                />
                <div class="relative group/btn">
                  <button
                    draggable="true"
                    @click="handleLayoutClick(customColumns)"
                    @dragstart="
                      onDragStart($event, {
                        type: 'row',
                        columns: customColumns,
                      })
                    "
                    @dragend="onDragEnd"
                    class="md-btn-primary px-3 py-2 text-xs rounded-lg transition-colors cursor-grab active:cursor-grabbing"
                  >
                    Add
                  </button>
                  <div
                    class="pointer-events-none absolute bottom-full left-2/2 -translate-x-2/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:right-2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
                  >
                    Click · Drag to position
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs text-[var(--md-text-subtle)] mb-1.5">
                Custom widths
                <span class="text-[var(--md-text-subtle)] text-[9px]">(sum to 100)</span>
              </label>
              <div class="flex gap-2">
                <div class="flex-1 relative">
                  <input
                    v-model="customWidthsInput"
                    type="text"
                    placeholder="e.g. 30, 70"
                    class="w-full px-3 py-2 text-xs text-[var(--md-text)] outline-1 outline-[var(--md-border)] rounded-md shadow-xs focus:outline-none focus:ring-[1px] focus:ring-[var(--md-selection)]"
                    :class="
                      customWidthsError
                        ? 'focus:ring-[var(--md-danger)] bg-[var(--md-danger-bg)]'
                        : 'border-[var(--md-border)] focus:border-[var(--md-border-strong)]'
                    "
                    @input="validateCustomWidths"
                    @keyup.enter="addCustomWidths"
                  />
                  <span
                    v-if="customWidthsInput && !customWidthsError"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--md-selection-fg)]"
                    >✓</span
                  >
                </div>
                <div class="relative group/btn">
                  <button
                    :draggable="!customWidthsError && !!customWidthsInput"
                    @click="addCustomWidths"
                    @dragstart="onDragStartCustomWidths"
                    @dragend="onDragEnd"
                    :disabled="!!customWidthsError || !customWidthsInput"
                    class="px-3 py-2 text-xs rounded-lg transition-colors disabled:opacity-40"
                    :class="[
                      !customWidthsError && customWidthsInput
                        ? 'md-btn-primary cursor-grab active:cursor-grabbing'
                        : 'bg-[var(--md-surface-muted)] text-[var(--md-text-subtle)]',
                    ]"
                  >
                    Add
                  </button>
                  <div
                    class="pointer-events-none absolute bottom-full left-2/2 -translate-x-2/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:right-2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
                  >
                    Click · Drag to position
                  </div>
                </div>
              </div>
              <p v-if="customWidthsError" class="text-[9px] text-[var(--md-danger)] mt-1">
                {{ customWidthsError }}
              </p>

              <div v-if="parsedCustomWidths.length" class="flex gap-1 mt-3 h-6">
                <div
                  v-for="(w, i) in parsedCustomWidths"
                  :key="i"
                  class="bg-[var(--md-surface-muted)] rounded flex items-center justify-center text-[8px] text-[var(--md-text-subtle)]"
                  :style="{ flex: w }"
                >
                  {{ w }}%
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- ========== Actions ========== -->
      <div class="grid grid-cols-2 gap-2 pt-2">
        <div class="relative group/btn">
          <button
            draggable="true"
            @click="addSpacer()"
            @dragstart="onDragStart($event, { type: 'spacer' })"
            @dragend="onDragEnd"
            class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[var(--md-border)] rounded-lg hover:border-[var(--md-row-selection)] hover:bg-[var(--md-row-selection-bg)]/40 transition-all text-xs text-[var(--md-text-muted)] cursor-grab active:cursor-grabbing select-none"
          >
            <div class="w-4 h-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                class="w-4 h-4"
              >
                <path
                  d="M3 12H3.01M7.5 12H7.51M16.5 12H16.51M12 12H12.01M21 12H21.01M21 21V20.2C21 19.0799 21 18.5198 20.782 18.092C20.5903 17.7157 20.2843 17.4097 19.908 17.218C19.4802 17 18.9201 17 17.8 17H6.2C5.0799 17 4.51984 17 4.09202 17.218C3.7157 17.4097 3.40973 17.7157 3.21799 18.092C3 18.5198 3 19.0799 3 20.2V21M21 3V3.8C21 4.9201 21 5.48016 20.782 5.90798C20.5903 6.28431 20.2843 6.59027 19.908 6.78201C19.4802 7 18.9201 7 17.8 7H6.2C5.0799 7 4.51984 7 4.09202 6.78201C3.71569 6.59027 3.40973 6.28431 3.21799 5.90798C3 5.48016 3 4.92011 3 3.8V3"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <span>Spacer</span>
          </button>
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
          >
            Click · Drag to position
          </div>
        </div>

        <!--
          Single unified "Saved Rows" entry point.
          Replaces the previous separate "Products" and "System Saved Rows"
          buttons. The panel itself owns tab switching between user-saved and
          system-saved rows, so the LayoutTab no longer needs to know about
          the two sources independently.
        -->
        <button
          @click="toggleSavedRowsPanel()"
          class="flex items-center justify-center gap-2 px-3 py-2 border border-[var(--md-border)] rounded-lg hover:border-[var(--md-border-strong)] hover:bg-[var(--md-surface-hover)] transition-all text-xs text-[var(--md-text-muted)]"
          :class="{ 'border-[var(--md-text)] bg-[var(--md-surface-hover)]': savedRowsPanelOpen }"
        >
          <div class="size-4">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="w-full h-full"
            >
              <path
                d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="stroke-[var(--md-text-muted)]"
              />
            </svg>
          </div>
          <span>Saved Rows</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useSavedRowsPanel } from "@/composables/system/useSavedRowsPanel";
import {
  useLayoutDrag,
  type LayoutDragPayload,
} from "@/composables/emailBuilder/core/ui/useLayoutDrag";

const { addRow, addNestedRow, addSpacer, selectedColumn } = useEmailBuilder();
// Single unified panel state — replaces the legacy `productPanelOpen` /
// `systemProductPanelOpen` pair. The two old composables are still imported
// inside SavedRowsPanel.vue itself (where they actually own the data), so
// no other code needs to change.
const { isOpen: savedRowsPanelOpen, toggle: toggleSavedRowsPanel } =
  useSavedRowsPanel();
const { startLayoutDrag, endLayoutDrag } = useLayoutDrag();

// ── Shared selected column state ──────────────────────────────────────────────
// When a column is selected on the canvas, clicking a layout in this panel
// inserts a nested row INTO that column instead of appending a top-level row.

/**
 * Handle layout click:
 *  - If a column is selected → add a nested row inside that column
 *  - Otherwise → append a top-level row
 */
const handleLayoutClick = (columns: number | number[]) => {
  const col = selectedColumn.value as {
    rowId: string;
    columnId: string;
  } | null;
  if (col?.rowId && col?.columnId) {
    addNestedRow(col.rowId, col.columnId, columns);
  } else {
    addRow(columns);
  }
};

const onDragStart = (e: DragEvent, payload: LayoutDragPayload) => {
  startLayoutDrag(e, payload);
};

const onDragStartCustomWidths = (e: DragEvent) => {
  if (customWidthsError.value || !parsedCustomWidths.value.length) {
    e.preventDefault();
    return;
  }
  startLayoutDrag(e, { type: "row", columns: parsedCustomWidths.value });
};

const onDragEnd = () => endLayoutDrag();

const equalOpen = ref(true);
const asymmetricOpen = ref(false);
const customOpen = ref(false);

const equalLayouts = [
  { label: "1 Column", columns: 1, preview: [1] },
  { label: "2 Columns", columns: 2, preview: [1, 1] },
  { label: "3 Columns", columns: 3, preview: [1, 1, 1] },
  { label: "4 Columns", columns: 4, preview: [1, 1, 1, 1] },
];

const asymmetricLayouts = [
  { label: "30/70", widths: [30, 70] },
  { label: "70/30", widths: [70, 30] },
  { label: "25/75", widths: [25, 75] },
  { label: "75/25", widths: [75, 25] },
  { label: "33/67", widths: [33, 67] },
  { label: "67/33", widths: [67, 33] },
  { label: "25/50/25", widths: [25, 50, 25] },
  { label: "50/25/25", widths: [50, 25, 25] },
];

const customColumns = ref(4);
const columnLimit = computed({
  get: () => customColumns.value,
  set: (val: number) => {
    customColumns.value = Math.min(6, Math.max(1, val));
  },
});

const customWidthsInput = ref("");
const customWidthsError = ref("");
const parsedCustomWidths = ref<number[]>([]);

const validateCustomWidths = () => {
  const raw = customWidthsInput.value.trim();
  if (!raw) {
    customWidthsError.value = "";
    parsedCustomWidths.value = [];
    return;
  }
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.some(isNaN)) {
    customWidthsError.value = "Must be numbers";
    parsedCustomWidths.value = [];
    return;
  }
  if (parts.some((n) => n <= 0)) {
    customWidthsError.value = "Must be > 0";
    parsedCustomWidths.value = [];
    return;
  }
  const total = parts.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 0.01) {
    customWidthsError.value = `Sum is ${total}% (needs 100%)`;
    parsedCustomWidths.value = parts;
    return;
  }
  customWidthsError.value = "";
  parsedCustomWidths.value = parts;
};

const addCustomWidths = () => {
  if (customWidthsError.value || !parsedCustomWidths.value.length) return;
  handleLayoutClick(parsedCustomWidths.value);
  customWidthsInput.value = "";
  parsedCustomWidths.value = [];
};
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  max-height: 500px;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}
</style>
