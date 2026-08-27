<template>
  <div
    ref="rootEl"
    @click.stop="selectRow(row.id)"
    @mouseenter.stop="handleMouseEnter"
    @mouseleave.stop="handleMouseLeave"
    :data-layer-id="row.id"
    :class="[
      'relative group',
      depth === 0 ? '-mx-20 px-20' : '',
      isDragging ? 'opacity-50' : '',
      selectedRowId === row.id || hasSelectedDescendant ? 'z-20' : 'z-0',
    ]"
  >
    <!-- Hit ring — only renders when this specific row is hovered or selected -->
    <div
      class="pointer-events-none absolute -left-3 -right-3 top-0 bottom-0 border rounded transition-colors"
      :class="[
        selectedRowId === row.id
          ? 'border-[var(--md-row-selection)]'
          : canvasHoveredId === row.id
            ? 'border-[var(--md-row-selection)] border-dashed'
            : isLayerHovered
              ? 'border-[var(--md-row-selection-fg)] border-dashed opacity-60'
              : 'border-transparent',
      ]"
    />

    <!-- Drop indicators -->
    <DropZone
      :is-active="isDragOver && dropPosition === 'before'"
      position="before"
    />
    <DropZone
      :is-active="isDragOver && dropPosition === 'after'"
      position="after"
    />

    <!-- Drag handle moved into the action bar below for the new
         Canva / Postcards-by-Designmodo style. -->

    <!-- Visibility Badge -->
    <!-- Teleported: the row clips overflow, so the badge (which hangs off the
         left edge) and its hover popover were both cut off. The whole wrapper
         moves together so the group-hover relationship still works. -->
    <Teleport v-if="teleportTarget" :to="teleportTarget">
      <div
        v-if="isVisibilityActive(row.visibility)"
        class="fixed z-60 group/vis -translate-y-1/2"
        :style="{ top: badgePos.top + 'px', left: badgePos.left + 'px' }"
      >
        <div
          class="flex items-center gap-1 bg-linear-to-r from-[var(--md-row-selection)] to-[var(--md-row-selection-fg)] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md cursor-default select-none tracking-wide"
        >
          <svg
            class="w-2.5 h-2.5 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          IF {{ visibilityRuleCount(row.visibility) }}
        </div>
        <div
          class="absolute left-0 top-5 w-60 opacity-0 pointer-events-none group-hover/vis:opacity-100 group-hover/vis:pointer-events-auto duration-150 translate-y-1 group-hover/vis:translate-y-0 z-50"
        >
          <VisibilityPopover :visibility="row.visibility" />
          <div
            class="absolute -top-1.5 left-4 w-3 h-3 bg-gray-950 border-l border-t border-white/10 rotate-45"
          />
        </div>
      </div>
    </Teleport>

    <!-- Row columns -->
    <div :style="rowStyles">
      <CanvasColumn
        v-for="column in row.columns"
        :key="column.id"
        :row="row"
        :column="column"
        :row-id="row.id"
        :depth="depth"
      />
    </div>

    <!-- Row drag overlay (top-level row reorder only — NOT during nested-row drags) -->
    <div
      v-if="isTopLevelRowDragActive && depth === 0"
      class="absolute inset-0 z-30"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.stop="handleDrop"
    />

    <!-- ── Row Action Bar ────────────────────────────────────────────────────
         Modern Canva / Postcards-by-Designmodo style:
         • Horizontal floating pill above the row, soft multi-layer shadow
         • Integrated drag handle on the left (replaces external dot handle)
         • Smooth fade-in on selection, dims while scrolling
    -->
    <!-- Teleported for the same reason as the badge: the toolbar sits above
         the row's top edge, which the row's own overflow:hidden clipped off. -->
    <Teleport v-if="teleportTarget" :to="teleportTarget">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="selectedRowId === row.id"
          class="fixed -translate-x-1/2 z-50"
          :style="{ top: toolbarPos.top + 'px', left: toolbarPos.left + 'px' }"
        >
          <div
            class="flex items-center bg-[var(--md-toolbar-bg)]/95 backdrop-blur-sm ring-1 ring-[var(--md-row-selection)]/70 rounded-xl p-1 shadow-[0_4px_12px_-2px_rgba(16,24,40,0.08),0_2px_4px_-1px_rgba(16,24,40,0.04)]"
          >
            <!-- Integrated drag handle -->
            <div class="relative group/btn">
              <div
                draggable="true"
                @dragstart.stop="handleDragStart"
                @dragend.stop="handleDragEnd"
                @click.stop
                class="w-7 h-7 flex items-center justify-center text-[var(--md-text-subtle)] hover:text-[var(--md-text)] hover:bg-[var(--md-surface-hover)] active:bg-[var(--md-border)] active:cursor-grabbing rounded-lg cursor-grab transition-colors"
              >
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="5" cy="3" r="1.4" />
                  <circle cx="11" cy="3" r="1.4" />
                  <circle cx="5" cy="8" r="1.4" />
                  <circle cx="11" cy="8" r="1.4" />
                  <circle cx="5" cy="13" r="1.4" />
                  <circle cx="11" cy="13" r="1.4" />
                </svg>
              </div>
              <div
                class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
              >
                Drag to reorder rows
              </div>
            </div>

            <div class="w-px h-4 bg-[var(--md-border)]/80 mx-0.5" />

            <div class="relative group/btn">
              <button
                @click.stop="handleMoveUp"
                :disabled="isFirst"
                class="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                :class="
                  isFirst
                    ? 'text-[var(--md-text-subtle)] opacity-40 cursor-not-allowed'
                    : 'text-[var(--md-text-subtle)] hover:text-[var(--md-text)] hover:bg-[var(--md-surface-hover)]'
                "
              >
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.25"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </button>
              <div
                class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
              >
                Move row up
              </div>
            </div>

            <div class="relative group/btn">
              <button
                @click.stop="handleMoveDown"
                :disabled="isLast"
                class="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                :class="
                  isLast
                    ? 'text-[var(--md-text-subtle)] opacity-40 cursor-not-allowed'
                    : 'text-[var(--md-text-subtle)] hover:text-[var(--md-text)] hover:bg-[var(--md-surface-hover)]'
                "
              >
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.25"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
              >
                Move row down
              </div>
            </div>

            <div class="w-px h-4 bg-[var(--md-border)]/80 mx-0.5" />

            <!-- Label chip -->
            <span
              class="px-2 text-[11px] font-semibold text-[var(--md-row-selection-fg)] tracking-wide uppercase select-none"
            >
              Row
            </span>

            <!-- Save as product row (saved_row:create) -->
            <template v-if="!showSaveInput">
              <div class="w-px h-4 bg-[var(--md-border)]/80 mx-0.5" />

              <div class="relative group/btn">
                <button
                  @click.stop="openSaveInput"
                  class="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--md-text-subtle)] hover:text-[var(--md-row-selection-fg)] hover:bg-[var(--md-row-selection-bg)] transition-colors"
                >
                  <!-- Lucide: bookmark -->
                  <svg
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
                    />
                  </svg>
                </button>
                <div
                  class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
                >
                  Save as product row
                </div>
              </div>
            </template>

            <template v-else>
              <input
                v-model="saveName"
                @keyup.enter.stop="confirmSave"
                @keyup.escape.stop="cancelSave"
                @click.stop
                :placeholder="row.name ? displayName(row.name) : 'Name'"
                class="w-30 h-7 px-2 text-[11px] bg-[var(--md-surface-hover)] rounded-md border-0 focus:outline-none focus:ring-1 focus:ring-[var(--md-row-selection)] transition-colors"
                ref="saveInputRef"
              />
              <button
                @click.stop="confirmSave"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--md-success)] hover:text-[var(--md-success-fg)] hover:bg-[var(--md-success-bg)] transition-colors"
              >
                <!-- Lucide: check -->
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
              <button
                @click.stop="cancelSave"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--md-text-subtle)] hover:text-[var(--md-text)] hover:bg-[var(--md-surface-hover)] transition-colors"
              >
                <!-- Lucide: x -->
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </template>

            <div class="w-px h-4 bg-[var(--md-border)]/80 mx-0.5" />

            <div class="relative group/btn">
              <button
                @click.stop="handleDuplicate"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--md-text-subtle)] hover:text-[var(--md-row-selection-fg)] hover:bg-[var(--md-row-selection-bg)] transition-colors"
              >
                <!-- Lucide: copy -->
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path
                    d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                  />
                </svg>
              </button>
              <div
                class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
              >
                Duplicate row
              </div>
            </div>

            <div class="relative group/btn">
              <button
                @click.stop="handleDelete"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--md-text-subtle)] hover:text-[var(--md-danger)] hover:bg-[var(--md-danger-bg)] transition-colors"
              >
                <!-- Lucide: trash-2 -->
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              </button>

              <div
                class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
              >
                Delete row
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from "vue";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";

// ── Floating overlays: toolbar + visibility badge ────────────────────────────
// Both are <Teleport>'d out of this row, for the same reason CanvasComponent's
// action bar is: the row (and its columns) set `overflow: hidden`, so anything
// positioned outside the row's box — the toolbar sits above its top edge, the
// badge hangs off its left — gets clipped. Teleporting escapes the clip, but
// also means `absolute` positioning relative to this row no longer applies, so
// we measure the row ourselves and feed in fixed top/left.
const teleportTarget = useTeleportTarget();
const rootEl = ref<HTMLElement | null>(null);
const toolbarPos = ref({ top: 0, left: 0 });
const badgePos = ref({ top: 0, left: 0 });

const TOOLBAR_OFFSET = 16; // matches the old -top-4
const BADGE_OFFSET = 8; // matches the old -left-2

let overlayRaf: number | null = null;
const updateOverlayPositions = () => {
  if (overlayRaf !== null) return;
  overlayRaf = requestAnimationFrame(() => {
    overlayRaf = null;
    if (!rootEl.value) return;
    const rect = rootEl.value.getBoundingClientRect();
    toolbarPos.value = {
      top: rect.top - TOOLBAR_OFFSET,
      left: rect.left + rect.width / 2,
    };
    badgePos.value = { top: rect.top, left: rect.left - BADGE_OFFSET };
  });
};

let rowResizeObserver: ResizeObserver | null = null;
onMounted(() => {
  // Capture phase: the canvas scrolls in its own container, not the window,
  // so a bubbling listener would never see it.
  window.addEventListener("scroll", updateOverlayPositions, true);
  window.addEventListener("resize", updateOverlayPositions);
  if (rootEl.value && typeof ResizeObserver !== "undefined") {
    rowResizeObserver = new ResizeObserver(updateOverlayPositions);
    rowResizeObserver.observe(rootEl.value);
  }
  updateOverlayPositions();
});
onUnmounted(() => {
  window.removeEventListener("scroll", updateOverlayPositions, true);
  window.removeEventListener("resize", updateOverlayPositions);
  rowResizeObserver?.disconnect();
  if (overlayRaf !== null) cancelAnimationFrame(overlayRaf);
});
import { useConfirm } from "@/composables/ui/useConfirm";

import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";

import { useProductRowActions } from "@/composables/emailBuilder/components/useProductRowActions";
import { displayName } from "@/composables/emailBuilder/core/useEmailBuilderOperations";
import CanvasColumn from "./CanvasColumn.vue";
import DropZone from "../ui/canvas/DropZone.vue";
import {
  isVisibilityActive,
  visibilityRuleCount,
} from "@/composables/emailBuilder/core/ui/visibilityBadgeHelpers";
import VisibilityPopover from "../ui/visibility/VisibilityPopover.vue";

const props = defineProps({
  row: { type: Object, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  index: { type: [String, Number], required: true },
  depth: { type: Number, default: 0 },
});

const confirm = useConfirm();

const {
  deleteRow,
  moveRow,
  reorderRows,
  duplicateRow,
  previewMode,
  selectedRowId,
  selectedId,
  selectedColumn,
  isRowDragActive,
  isTopLevelRowDragActive,
  layerHoveredId,
  canvasHoveredId,
  nestedRowDragId,
} = useEmailBuilder();

// ── Descendant selection elevation ────────────────────────────────────────────
// When a component INSIDE this row is selected, this row must also elevate its
// own z-index so the component's action bar / RichText toolbar can paint above
// sibling rows. Without this, CanvasColumn's z-index:1 stacking context is
// bounded by this row's own stacking level and can never exceed a sibling row.
const hasSelectedDescendant = computed(() => {
  if (!selectedId.value) return false;
  const searchColumns = (cols: any[]): boolean =>
    cols.some((col) => {
      const children = col.children ?? col.components ?? [];
      return children.some(
        (child: any) =>
          child.id === selectedId.value ||
          (child.type === "row" && searchColumns(child.columns ?? [])),
      );
    });
  return searchColumns(props.row.columns ?? []);
});

// ── Canvas-only hover isolation ────────────────────────────────────────────────
// canvasHoveredId is separate from layerHoveredId.
// layerHoveredId is set from the Layers Panel (hover there → highlight here).
// canvasHoveredId is set by direct mouse-over of the canvas, using
// stopPropagation so only the innermost element under the cursor glows.
const isLayerHovered = computed(
  () => layerHoveredId.value === String(props.row.id),
);

const handleMouseEnter = (e: MouseEvent) => {
  // stopPropagation is called by Vue's .stop modifier on the element.
  // We still need to prevent the parent CanvasRow from also claiming hover.
  canvasHoveredId.value = props.row.id;
};

const handleMouseLeave = (e: MouseEvent) => {
  if (canvasHoveredId.value === props.row.id) {
    canvasHoveredId.value = null;
  }
};

const isDragging = ref(false);
const isDragOver = ref(false);
const dropPosition = ref("after");

// ── Selection ──────────────────────────────────────────────────────────────────

const selectRow = (id: any) => {
  selectedRowId.value = id;
  selectedId.value = null;
  if (props.row.columns?.length > 0) {
    const alreadyInThisRow = selectedColumn.value?.rowId === props.row.id;
    if (!alreadyInThisRow) {
      selectedColumn.value = {
        rowId: props.row.id,
        columnId: props.row.columns[0].id,
      };
    }
  }
};

// ── Move / Delete / Duplicate ──────────────────────────────────────────────────

const handleMoveUp = () => moveRow(props.row.id, "up");
const handleMoveDown = () => moveRow(props.row.id, "down");
const handleDuplicate = () => duplicateRow(props.row.id);

const handleDelete = () => {
  confirm.require({
    message: "Delete this row and all its contents?",
    header: "Confirm Delete",
    acceptLabel: "Delete",
    rejectLabel: "Cancel",
    acceptClass: "!bg-[var(--md-danger)] !hover:opacity-90 !border-[var(--md-danger)] !px-6 !py-2",
    rejectClass:
      "!bg-[var(--md-border)] !hover:bg-[var(--md-border-strong)] !text-[var(--md-text)] !border-[var(--md-border)] !px-6 !py-2",
    accept: () => deleteRow(props.row.id),
    reject: () => {},
  });
};

// ── Save as product row ──────────────────────────────────────────────────────

const { saveProductRowWithToast } = useProductRowActions();

const showSaveInput = ref(false);
const saveName = ref("");
const saveInputRef = ref<HTMLInputElement | null>(null);

function openSaveInput() {
  showSaveInput.value = true;
  saveName.value = props.row.name ? displayName(props.row.name) : "";
  nextTick(() => {
    saveInputRef.value?.focus();
    saveInputRef.value?.select();
  });
}

function cancelSave() {
  showSaveInput.value = false;
  saveName.value = "";
}

async function confirmSave() {
  if (!saveName.value.trim()) {
    saveInputRef.value?.focus();
    return;
  }

  const success = await saveProductRowWithToast(props.row, saveName.value);

  if (success) cancelSave();
}

// ── Drag ───────────────────────────────────────────────────────────────────────

const handleDragStart = (e: DragEvent) => {
  isDragging.value = true;
  isRowDragActive.value = true;
  e.dataTransfer!.effectAllowed = "move";
  if (props.depth === 0) {
    isTopLevelRowDragActive.value = true;
    nestedRowDragId.value = null;
    e.dataTransfer!.setData("dragType", "row");
    e.dataTransfer!.setData("rowIndex", props.index.toString());
  } else {
    nestedRowDragId.value = String(props.row.id);
    e.dataTransfer!.setData("dragType", "nested-row");
    e.dataTransfer!.setData("rowId", props.row.id.toString());
  }
};

const handleDragEnd = () => {
  isDragging.value = false;
  isRowDragActive.value = false;
  isTopLevelRowDragActive.value = false;
  nestedRowDragId.value = null;
  isDragOver.value = false;
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = "move";

  // Compute intended next state BEFORE writing. dragover fires at ~60hz so
  // unconditional writes trigger ~180 reactive notifications over a 3s drag
  // even when nothing actually changes. Gating the write makes ~170 of them
  // no-ops at the JS level, before Vue's dep graph wakes up.
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const nextPos: "before" | "after" =
    e.clientY < rect.top + rect.height / 2 ? "before" : "after";

  if (!isDragOver.value) isDragOver.value = true;
  if (dropPosition.value !== nextPos) dropPosition.value = nextPos;
};

const handleDragLeave = (e: DragEvent) => {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
    isDragOver.value = false;
  }
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDragOver.value = false;
  isRowDragActive.value = false;
  isTopLevelRowDragActive.value = false;
  if (e.dataTransfer!.getData("dragType") !== "row") return;
  const fromIndex = parseInt(e.dataTransfer!.getData("rowIndex"));
  if (isNaN(fromIndex) || fromIndex === props.index) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  let toIndex =
    e.clientY < rect.top + rect.height / 2
      ? props.index
      : (props.index as number) + 1;
  if (fromIndex < (props.index as number)) (toIndex as number)--;
  reorderRows(fromIndex, toIndex);
};

// ── Row styles ─────────────────────────────────────────────────────────────────

const isStacked = computed(
  () => previewMode.value === "mobile" && props.row.mobileStack,
);

const rowStyles = computed(() => {
  const r = props.row;

  const bg = r.backgroundGradient;
  const hasGradient =
    bg?.useGradient === true &&
    Array.isArray(bg?.gradient?.colors) &&
    bg.gradient.colors.length >= 2;

  let backgroundValue: string;
  if (hasGradient) {
    const { type, direction, colors } = bg.gradient;
    const stops = colors
      .map((c: any) => `${c.color} ${c.position}%`)
      .join(", ");
    backgroundValue =
      type === "radial"
        ? `radial-gradient(circle at center, ${stops})`
        : `linear-gradient(${direction}, ${stops})`;
  } else {
    backgroundValue = r.backgroundColor ?? "transparent";
  }

  const styles: Record<string, string> = {
    display: "flex",
    flexDirection: isStacked.value ? "column" : "row",
    background: backgroundValue,
    padding: `${r.padding.top}px ${r.padding.right}px ${r.padding.bottom}px ${r.padding.left}px`,
    minHeight: r.minHeight ? `${r.minHeight}px` : "auto",
    alignItems: "stretch",
    border: `${r.border.width}px ${r.border.style} ${r.border.color}`,
    borderRadius: `${r.border.radius}px`,
    overflow: "hidden",
  };

  if (r.gap > 0) styles.gap = `${r.gap}px`;

  if (r.backgroundImage) {
    styles.backgroundImage = `url(${r.backgroundImage})`;
    styles.backgroundSize = r.backgroundSize;
    styles.backgroundPosition = r.backgroundPosition;
    styles.backgroundRepeat = r.backgroundRepeat;
  }

  return styles;
});

// Recompute the moment this row becomes selected — nextTick so the DOM has
// settled and the measured rect is accurate. Declared here, at the end of the
// script, because it reads props/selectedRowId which are defined further down.
watch(
  () => selectedRowId.value === props.row.id,
  (selected) => {
    if (selected) nextTick(updateOverlayPositions);
  },
);
</script>
