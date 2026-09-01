<template>
  <div
    @click.stop="selectColumn(rowId, column.id)"
    @mouseenter.stop="handleMouseEnter"
    @mouseleave.stop="handleMouseLeave"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.stop="handleDrop"
    :style="getColumnStyles()"
    :class="[
      'canvas-column last:border-r-0 min-h-auto cursor-pointer relative outline outline-offset-0 rounded-sm',
      selectedColumn?.columnId === column.id
        ? 'outline-(--md-row-selection)/50'
        : canvasHoveredId === column.id && !isAnyChildHovered
          ? 'outline-(--md-border)/80'
          : isColumnLayerHovered
            ? 'outline-(--md-row-selection-fg) outline-dashed'
            : 'outline-transparent',
      hasSelectedChild ? 'has-selected-child' : '',
    ]"
  >
    <!-- ── Empty column placeholder ─────────────────────────────────────────
         Always shown when column is empty — keeps the column at full height
         so the drop overlay (absolute positioned on top) has space to render.
    -->
    <div
      v-if="children.length === 0"
      class="h-full flex items-center justify-center text-(--md-text-subtle) text-xs text-center pb-3"
      style="min-height: 120px"
    >
      <div :class="{ 'opacity-0': isOver }">
        <svg
          class="w-7 h-7 mx-auto mb-1.5 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        <p>Click to select <br />Or Drag and Drop</p>
      </div>
    </div>

    <!-- ── Children ──────────────────────────────────────────────────────────
         Each child is dispatched by CanvasElement.
         CanvasComponent has its own before/after DropZone line indicators —
         the column-level overlay ONLY shows for empty columns.
    -->
    <CanvasElement
      v-for="(child, index) in children"
      :key="child.id"
      :element="child"
      :row-id="String(rowId)"
      :column-id="column.id"
      :index="Number(index)"
      :is-first="index === 0"
      :is-last="index === children.length - 1"
      :depth="depth"
    />

    <!-- ── Drop overlay ────────────────────────────────────────────────────────
         Shown when:
           • Column is EMPTY + any compatible drag is active
           • Column is NON-EMPTY but a layout-tab drag (row / nested-row /
             product-row) is active — insertion happens as a nested row
         Never shown during top-level row reorders.
    -->
    <Transition name="fade">
      <div
        v-if="isOver && (children.length === 0 || isLayoutDragForColumn)"
        class="absolute inset-0 flex items-center justify-center pointer-events-none text-(--md-text-subtle) bg-opacity-70 border-2 border-dashed border-(--md-selection) rounded z-10"
      >
        <div class="bg-(--md-surface) px-3 py-1.5 rounded-lg shadow-md">
          <span
            class="text-(--md-selection-fg) text-xs font-medium flex items-center gap-1.5"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Drop here
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useLayoutDrag } from "@/composables/emailBuilder/core/ui/useLayoutDrag";
import { useProductRows } from "@/composables/emailBuilder/components/useProductRows";
import CanvasElement from "./CanvasElement.vue";

const props = defineProps({
  row: { type: Object, required: true },
  column: { type: Object, required: true },
  rowId: { type: [String, Number], required: true },
  /**
   * Depth forwarded from the parent CanvasRow.
   * CanvasElement increments this when it renders a nested row so the
   * depth guard fires correctly at level 5.
   */
  depth: { type: Number, default: 0 },
});

// ── CRITICAL: addNestedRow lives on useEmailBuilder, not useLayoutDrag ────────
const {
  previewMode,
  moveComponentBetweenColumns,
  moveNestedRow,
  addComponent,
  addNestedRow,
  saveToHistoryImmediate,
  selectedColumn,
  selectedRowId,
  selectedId,
  isRowDragActive,
  isTopLevelRowDragActive,
  canvasHoveredId,
  layerHoveredId,
} = useEmailBuilder();
const { endLayoutDrag, isLayoutDragActive, layoutDragPayload } =
  useLayoutDrag();
const { cloneRowForCanvas } = useProductRows();

// ── Children ─────────────────────────────────────────────────────────────────
// CRITICAL: always use children ?? components for backward compat
const children = computed(
  () => props.column.children ?? props.column.components ?? [],
);

// ── Selected-child detection ──────────────────────────────────────────────────
// When a direct child component is selected we lift the column out of its own
// stacking context (z-index: auto) so the selected component's z-8 elevation
// can paint its action bar and visibility badge above sibling columns.
const hasSelectedChild = computed(() =>
  children.value.some((c: any) => c.id === selectedId.value),
);

// ── Hover isolation ───────────────────────────────────────────────────────────
const isColumnLayerHovered = computed(
  () => layerHoveredId.value === String(props.column.id),
);

const isAnyChildHovered = computed(() => {
  if (!canvasHoveredId.value) return false;
  const isChild = (items: any[]): boolean =>
    items.some(
      (c) =>
        String(c.id) === canvasHoveredId.value ||
        (c.type === "row" &&
          isChild(
            c.columns?.flatMap(
              (col: any) => col.children ?? col.components ?? [],
            ) ?? [],
          )),
    );
  return isChild(children.value);
});

const handleMouseEnter = () => {
  canvasHoveredId.value = props.column.id;
};

const handleMouseLeave = () => {
  if (canvasHoveredId.value === props.column.id) {
    canvasHoveredId.value = null;
  }
};

// ── Drag state ───────────────────────────────────────────────────────────────
const hoveredColumnId = ref<string | null>(null);
const isOver = computed(() => hoveredColumnId.value === props.column.id);

const resetDrag = () => {
  if (hoveredColumnId.value === props.column.id) {
    hoveredColumnId.value = null;
  }
};
onMounted(() => document.addEventListener("dragend", resetDrag));
onUnmounted(() => document.removeEventListener("dragend", resetDrag));

// ─── Selection ────────────────────────────────────────────────────────────────
const selectColumn = (rowId: any, columnId: any) => {
  selectedColumn.value = { rowId, columnId };
  selectedRowId.value = rowId;
  selectedId.value = null;
};

// ─── Drag block logic ─────────────────────────────────────────────────────────
// Layout payloads accepted by a column:
//   "row"         → LayoutTab equal/asymmetric/custom layout
//   "nested-row"  → explicit nested-row path (sidebar column selection future)
//   "product-row" → saved row from RowsPanel — dropped as a nested row
// "spacer" remains blocked (top-level canvas only).
const isLayoutDragForColumn = computed(
  () =>
    isLayoutDragActive.value &&
    (layoutDragPayload.value?.type === "row" ||
      layoutDragPayload.value?.type === "nested-row" ||
      layoutDragPayload.value?.type === "product-row"),
);

const isBlocked = () =>
  isTopLevelRowDragActive.value ||
  (isLayoutDragActive.value && !isLayoutDragForColumn.value);

const handleDragEnter = (e: DragEvent) => {
  if (isBlocked()) return;
  e.preventDefault();
  e.stopPropagation();
  hoveredColumnId.value = props.column.id;
};

const handleDragOver = (e: DragEvent) => {
  if (isBlocked()) return;
  e.preventDefault();
  e.stopPropagation();
  if (hoveredColumnId.value !== props.column.id) {
    hoveredColumnId.value = props.column.id;
  }
  if (e.dataTransfer) {
    const allowed = e.dataTransfer.effectAllowed;
    e.dataTransfer.dropEffect =
      allowed === "copy" || allowed === "copyMove" ? "copy" : "move";
  }
};

const handleDragLeave = (e: DragEvent) => {
  if (isBlocked()) return;
  const el = e.currentTarget as HTMLElement;
  const to = e.relatedTarget as Node | null;
  if (to && el.contains(to)) return;
  if (hoveredColumnId.value === props.column.id) {
    hoveredColumnId.value = null;
  }
};

// ─── Column styles ─────────────────────────────────────────────────────────────
const getColumnStyles = (): Record<string, string> => {
  const c = props.column;

  const bg = c.backgroundGradient;
  const hasGradient =
    bg?.useGradient === true &&
    Array.isArray(bg?.gradient?.colors) &&
    bg.gradient.colors.length >= 2;

  let backgroundValue: string;
  if (hasGradient) {
    const { type, direction, colors } = bg.gradient;
    const stops = colors
      .map((s: any) => `${s.color} ${s.position}%`)
      .join(", ");
    backgroundValue =
      type === "radial"
        ? `radial-gradient(circle at center, ${stops})`
        : `linear-gradient(${direction}, ${stops})`;
  } else {
    backgroundValue = c.backgroundColor ?? "transparent";
  }

  const verticalAlignMap: Record<string, string> = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end",
  };

  const styles: Record<string, string> = {
    width:
      previewMode.value === "mobile" && props.row.mobileStack
        ? "100%"
        : `${c.width}%`,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: verticalAlignMap[c.verticalAlign] || "flex-start",
    padding: c.padding
      ? `${c.padding.top}px ${c.padding.right}px ${c.padding.bottom}px ${c.padding.left}px`
      : "10px",
    background: backgroundValue,
    border: `${c.border.width}px ${c.border.style} ${c.border.color}`,
    borderRadius: `${c.border.radius}px`,
    overflow: "hidden",
  };

  if (c.backgroundImage) {
    styles.backgroundImage = `url(${c.backgroundImage})`;
    styles.backgroundSize = c.backgroundSize;
    styles.backgroundPosition = c.backgroundPosition;
    styles.backgroundRepeat = c.backgroundRepeat;
  }

  return styles;
};

// ─── Drop ──────────────────────────────────────────────────────────────────────
const handleDrop = (e: DragEvent) => {
  if (isBlocked()) return;
  e.preventDefault();
  e.stopPropagation();
  hoveredColumnId.value = null;

  const layoutDragType = e.dataTransfer?.getData("layoutDragType");

  // ── LayoutTab row / nested-row dropped onto column → nested-row insertion ─
  if (layoutDragType === "row" || layoutDragType === "nested-row") {
    const rawColumns = e.dataTransfer?.getData("layoutDragColumns");
    let columns: number | number[] = 1;
    try {
      if (rawColumns) columns = JSON.parse(rawColumns);
    } catch {
      columns = 1;
    }
    addNestedRow(props.rowId, props.column.id, columns, children.value.length);
    endLayoutDrag();
    return;
  }

  // ── Saved product row dropped onto column → insert as nested row ─────────
  // The saved row is a full row tree. cloneRowForCanvas deep-clones it and
  // reassigns fresh IDs throughout (row, nested rows, columns, children). We
  // push the cloned tree directly into this column's children so it becomes
  // a nested row inside the column — the canonical shape already matches
  // what CanvasElement expects for a nested row (type === "row").
  if (layoutDragType === "product-row") {
    const entryId = e.dataTransfer?.getData("layoutDragEntryId");
    if (!entryId) {
      endLayoutDrag();
      return;
    }
    const cloned = cloneRowForCanvas(entryId);
    if (!cloned) {
      endLayoutDrag();
      return;
    }

    // Mutate the column's children array in place. findRow returns the
    // reactive parent row, so props.column (a ref to its own column object)
    // is already the live reactive node — we can push onto its children
    // directly. ensureChildren-style fallback: prefer children, fall back
    // to components for legacy columns, then push.
    const targetColumn = props.column as any;
    if (!targetColumn.children) {
      targetColumn.children = targetColumn.components ?? [];
    }
    targetColumn.children.push(cloned);

    saveToHistoryImmediate("add-product-row-nested");
    endLayoutDrag();
    return;
  }

  // ── Nested row dragged from another column → move into this column ───────
  const dragType = e.dataTransfer?.getData("dragType");
  if (dragType === "nested-row") {
    const rowId = e.dataTransfer?.getData("rowId");
    if (rowId) {
      moveNestedRow(rowId, props.rowId, props.column.id, children.value.length);
      isRowDragActive.value = false;
    }
    return;
  }

  // ── New component from sidebar block list ────────────────────────────────
  const isNewComponent = e.dataTransfer?.getData("isNewComponent") === "true";
  const componentType = e.dataTransfer?.getData("componentType");

  if (isNewComponent && componentType) {
    addComponent(props.rowId, props.column.id, componentType);
    return;
  }

  // ── Existing component moved from another column ─────────────────────────
  const componentId = e.dataTransfer?.getData("componentId");
  if (componentId) {
    moveComponentBetweenColumns(
      componentId,
      props.rowId,
      props.column.id,
      children.value.length,
    );
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/*
 * Stacking fix: CanvasRowDropZone has z-index: 9 and extends its hit-area
 * strip into adjacent rows when a layout drag is active. Without an explicit
 * stacking context on the column, that strip would catch pointer events for
 * the edges of the column — the row drop zone would win and the drop would
 * become a top-level row instead of a nested row.
 *
 * z-index: 1 creates a stacking context ABOVE the drop zone's hit strip.
 *
 * CRITICAL: When a child component is selected, we must set z-index: auto on
 * this column AND on its ancestor CanvasRow (via hasSelectedDescendant).
 * z-index: auto removes the column from the stacking context chain entirely,
 * letting the selected component's z-50 bubble up to compete at the canvas
 * root level — which is what allows the action bar and RichText toolbar to
 * paint above sibling rows. If z-index: 1 stays active, ANY z-index on a
 * child is capped within this column's own stacking context and can never
 * exceed a sibling row painted at z-index: 0 in normal flow.
 */
.canvas-column {
  position: relative;
  z-index: 1;
}
.canvas-column.has-selected-child {
  z-index: auto;
}
</style>
