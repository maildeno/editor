<template>
  <div class="flex flex-col h-full bg-(--md-surface)">
    <!-- Search -->
    <div class="px-3 py-2 border-b border-(--md-border)">
      <div class="relative">
        <svg
          class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-(--md-text-subtle) pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          id="searchQuery"
          name="searchQuery"
          v-model="searchQuery"
          type="text"
          placeholder="Search by name or type…"
          class="w-full pl-7 pr-7 py-1.25 text-[13px] text-[var(--md-text)] bg-transparent border border-(--md-border) rounded-md focus:outline-none focus:border-(--md-border-strong) transition-colors placeholder-(--md-text-subtle)"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-text-muted) transition-colors"
          aria-label="Clear search"
        >
          <svg
            class="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Layer tree -->
    <div
      ref="treeRef"
      class="flex-1 overflow-y-auto py-1"
      @mousedown="handleTreeMousedown"
    >
      <div v-if="filteredRows.length === 0" class="px-3 py-8 text-center">
        <p class="text-[11px] text-(--md-text-subtle)">
          {{ searchQuery ? "No layers match" : "No rows yet" }}
        </p>
      </div>

      <!-- ── Top-level drop zone (index 0) ── -->
      <LayerDropLine
        v-if="filteredRows.length > 0"
        :active="isDropLineActive(null, 0, 'top-level')"
        :depth="0"
      />

      <template v-for="(row, rowIdx) in filteredRows" :key="row.id">
        <div
          class="group/row"
          @mouseenter="setHovered(row.id)"
          @mouseleave="setHovered(null)"
        >
          <!-- ── Row / Spacer header ─────────────────────────────────────────── -->
          <div
            draggable="true"
            @dragstart="
              handleDragStart($event, row, 'top-level-row', null, null, rowIdx)
            "
            @dragend="handleDragEnd"
            @dragover.prevent="
              handleDragOver(
                $event,
                row.id,
                'top-level-row',
                null,
                null,
                rowIdx,
              )
            "
            @dragleave="handleDragLeave"
            @drop.stop="
              handleDrop($event, row, 'top-level-row', null, null, rowIdx)
            "
            @click="handleRowClick(row)"
            @dblclick="startRename(row, $event)"
            :style="rowIndentStyle(0)"
            :class="[
              'flex items-center gap-1 pr-3 py-1.5 cursor-pointer transition-colors select-none',
              isRowSelected(row.id)
                ? 'bg-(--md-row-selection-bg) text-(--md-row-selection)'
                : 'text-(--md-text-subtle) hover:bg-(--md-surface-hover) hover:text-(--md-text-muted)',
              isDragSource(row.id) ? 'opacity-40' : '',
            ]"
          >
            <!-- Drag grip -->
            <span
              class="size-3.25 mr-0.5 text-(--md-text-muted) hover:text-(--md-text) shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-100 transition-opacity"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"
                />
              </svg>
            </span>

            <!-- Toggle -->
            <button
              v-if="row.type === 'row'"
              @click.stop="toggleExpanded(row.id)"
              class="w-4.75 h-4.75 flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-text-subtle) transition-transform shrink-0"
              :class="isExpanded(row.id) ? 'rotate-90' : ''"
            >
              <svg
                class="w-full h-full"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M7.293 4.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L11.586 10 7.293 5.707a1 1 0 0 1 0-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <button
              v-else
              @click.stop
              class="w-4.5 h-3.75 flex items-center justify-center text-(--md-text-subtle) shrink-0"
            >
              <svg
                class="w-3.25 h-3.25 text-(--md-text-muted) shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M3 12H3.01M7.5 12H7.51M16.5 12H16.51M12 12H12.01M21 12H21.01M21 21V20.2C21 19.0799 21 19.5198 20.782 19.092C20.5903 18.7157 20.2843 18.4097 19.908 18.218C19.4802 18 18.9201 18 17.8 18H6.2C5.0799 18 4.51984 18 4.09202 18.218C3.7157 18.4097 3.40973 18.7157 3.21799 19.092C3 19.5198 3 20.0799 3 21.2V22M21 2V3.8C21 4.9201 21 5.48016 20.782 5.90798C20.5903 6.28431 20.2843 6.59027 19.908 6.78201C19.4802 7 18.9201 7 17.8 7H6.2C5.0799 7 4.51984 7 4.09202 6.78201C3.71569 6.59027 3.40973 6.28431 3.21799 5.90798C3 5.48016 3 4.92011 3 3.8V2"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </button>

            <!-- Icon -->
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              v-if="row.type === 'row'"
              class="size-3.25 shrink-0"
              :class="
                isRowSelected(row.id)
                  ? 'text-[var(--md-row-selection)]'
                  : 'text-[var(--md-text-subtle)]'
              "
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>

            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-3.25 h-3.25 shrink-0"
              :class="
                isRowSelected(row.id)
                  ? 'text-(--md-row-selection)'
                  : 'text-(--md-text-muted)'
              "
            >
              <polyline points="8 18 12 22 16 18" />
              <polyline points="8 6 12 2 16 6" />
              <line x1="12" x2="12" y1="2" y2="22" />
            </svg>

            <!-- Label / rename input -->
            <template v-if="renamingRowId === row.id">
              <input
                :ref="(el) => mountRenameInput(el as HTMLInputElement | null)"
                :value="pendingRenameValue"
                type="text"
                class="flex-1 min-w-0 px-2 py-0.75 text-sm outline-1 outline-(--md-border) rounded-md shadow-xs focus:outline-none focus:ring-[1px] focus:ring-(--md-row-selection) translate-y-px text-(--md-text-muted)"
                @click.stop
                @mousedown.stop
                @keydown.enter.prevent="commitRename(row)"
                @keydown.esc.prevent="cancelRename"
              />
            </template>
            <template v-else>
              <span
                class="text-sm text-(--md-text-muted) tracking-wider truncate flex-1 min-w-0"
                >{{ getRowLabel(row) }}</span
              >
            </template>

            <!-- Column count badge -->
            <span
              v-if="row.type === 'row' && row.columns?.length > 1"
              class="shrink-0 size-5 grid place-content-center rounded-full bg-(--md-surface-muted) text-(--md-text-subtle) text-[10px]"
            >
              {{ row.columns.length }}
            </span>
            <!-- Visibility badge -->
            <span
              v-if="isVisibilityActive(row.visibility)"
              class="shrink-0 size-3.5"
            >
              <svg
                class="size-3.5 text-(--md-row-selection)"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
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
            </span>
          </div>

          <!-- ── Expanded row: columns → children (recursive, any depth) ─────── -->
          <template v-if="row.type === 'row' && isExpanded(row.id)">
            <LayerColumnChildren
              :columns="row.columns"
              :parent-row="row"
              :ancestor-row="row"
              :depth="1"
              :get-column-children="getColumnChildren"
              :get-direct-components="getDirectComponents"
              :get-component-type="getComponentType"
              :get-component-label="getComponentLabel"
              :get-row-label="getRowLabel"
              :is-expanded="isExpanded"
              :toggle-expanded="toggleExpanded"
              :is-row-selected="isRowSelected"
              :is-column-selected="isColumnSelected"
              :is-component-selected="isComponentSelected"
              :is-visibility-active="isVisibilityActive"
              :is-drag-source="isDragSource"
              :is-drop-line-active="isDropLineActive"
              :renaming-row-id="renamingRowId"
              :pending-rename-value="pendingRenameValue"
              :empty-column-drag-over="emptyColumnDragOver"
              :row-indent-style="rowIndentStyle"
              :handle-drag-start="handleDragStart"
              :handle-drag-end="handleDragEnd"
              :handle-drag-over="handleDragOver"
              :handle-drag-leave="handleDragLeave"
              :handle-drop="handleDrop"
              :handle-row-click="handleRowClick"
              :handle-column-click="handleColumnClick"
              :handle-component-click="handleComponentClick"
              :start-rename="startRename"
              :mount-rename-input="mountRenameInput"
              :commit-rename="commitRename"
              :cancel-rename="cancelRename"
              :set-hovered="setHovered"
              :handle-empty-column-drag-over="handleEmptyColumnDragOver"
              :handle-empty-column-drag-leave="handleEmptyColumnDragLeave"
              :handle-empty-column-drop="handleEmptyColumnDrop"
            />
          </template>
        </div>

        <!-- Drop line after each top-level row -->
        <LayerDropLine
          :active="isDropLineActive(null, rowIdx + 1, 'top-level')"
          :depth="0"
        />
      </template>
    </div>

    <!-- Footer -->
    <div
      class="px-3 py-2 border-t border-(--md-border) flex items-center justify-between"
    >
      <span class="text-[11px] text-(--md-text-subtle)">
        {{ rows.length }} row{{ rows.length !== 1 ? "s" : "" }}
        <template
          v-if="rows.filter((r: any) => r.type === 'row-spacer').length > 0"
        >
          ·
          {{ rows.filter((r: any) => r.type === "row-spacer").length }} spacer{{
            rows.filter((r: any) => r.type === "row-spacer").length !== 1
              ? "s"
              : ""
          }}
        </template>
        <template v-if="totalComponents > 0">
          · {{ totalComponents }} component{{
            totalComponents !== 1 ? "s" : ""
          }}
        </template>
      </span>
      <button
        v-if="expandedRows.size > 0"
        @click="collapseAll"
        class="text-[10px] text-(--md-text-subtle) hover:text-(--md-text-muted) transition-colors"
      >
        Collapse all
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { isVisibilityActive } from "@/composables/emailBuilder/core/ui/visibilityBadgeHelpers";
import { useLayerHoverScroll } from "@/composables/emailBuilder/core/ui/useLayerHoverScroll";
import {
  displayName,
  toRowName,
} from "@/composables/emailBuilder/core/useEmailBuilderOperations";
import LayerDropLine from "../../ui/layers-panel/LayerDropLine.vue";
import LayerColumnChildren from "../../ui/layers-panel/LayerColumnChildren.vue";

// ─── Depth-based indentation ─────────────────────────────────────────────────
// Each depth level adds 24px of left padding on top of the base 12px.
// This drives both top-level rows and all recursively nested children,
// so the tree can go arbitrarily deep without hardcoded pl-[Xpx] classes.
const INDENT_BASE = 12;
const INDENT_STEP = 24;

const rowIndentStyle = (depth: number): Record<string, string> => ({
  paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px`,
});

const emit = defineEmits<{ (e: "select"): void }>();

const {
  rows,
  selectedId,
  selectedRowId,
  selectedColumn,
  sidebarTab,
  layerHoveredId,
  saveToHistory,
  moveRow,
  moveNestedRow,
  moveComponent,
  moveComponentBetweenColumns,
  reorderRows,
} = useEmailBuilder();

useLayerHoverScroll(layerHoveredId);

const searchQuery = ref("");
const expandedRows = reactive(new Set<string>());

// ── Hover debounce ──────────────────────────────────────────────────────────
// Fast mouse-transit across layers (user sweeping from top to bottom of the
// tree) would otherwise flip layerHoveredId 5-10 times in <100ms, triggering
// unnecessary reactive updates across every CanvasRow/CanvasComponent watching
// isLayerHovered.
//
// Asymmetric debounce — delayed SET, instant CLEAR:
//   • 40ms is below the human reaction threshold for deliberate hovers (~100ms),
//     so pausing on a layer still feels "instant" to the user.
//   • Long enough to absorb a mouse sweep across the full tree in one gesture.
//   • Clearing (id === null) fires IMMEDIATELY — a delayed clear would leave
//     a stale highlight on a layer after the cursor has moved away, which
//     looks broken.
//
// Cleanup in onUnmounted (Edit 2 below) prevents the timer from firing into
// a torn-down component after SPA navigation.
let _hoverTimer: ReturnType<typeof setTimeout> | null = null;

const setHovered = (id: string | null) => {
  if (_hoverTimer) {
    clearTimeout(_hoverTimer);
    _hoverTimer = null;
  }
  if (id === null) {
    // Clear immediately — delayed clears feel laggy and cause stale highlights
    layerHoveredId.value = null;
    return;
  }
  _hoverTimer = setTimeout(() => {
    _hoverTimer = null;
    layerHoveredId.value = id;
  }, 40);
};

// ID coercion helper — ensures number/string IDs match in the Set
const toKey = (id: any) => String(id);

watch(
  [selectedRowId, selectedId],
  () => {
    if (selectedRowId.value) expandedRows.add(toKey(selectedRowId.value));
  },
  { immediate: true },
);

// ─── Rename ───────────────────────────────────────────────────────────────────

const renamingRowId = ref<string | null>(null);
const pendingRenameValue = ref("");
const renameInputEl = ref<HTMLInputElement | null>(null);
const treeRef = ref<HTMLElement | null>(null);

const mountRenameInput = (el: HTMLInputElement | null) => {
  renameInputEl.value = el;
  if (el) {
    el.focus();
    el.select();
  }
};
const startRename = (row: any, _event: MouseEvent) => {
  renamingRowId.value = row.id;
  pendingRenameValue.value = displayName(row.name ?? "");
};
const commitRename = (row: any) => {
  if (renamingRowId.value !== row.id) return;
  const trimmed = (renameInputEl.value?.value ?? "").trim();
  if (trimmed) {
    row.name = toRowName(trimmed);
    saveToHistory("row-rename");
  }
  renamingRowId.value = null;
  renameInputEl.value = null;
};
const cancelRename = () => {
  renamingRowId.value = null;
  renameInputEl.value = null;
};

/** Finds a row by id at any nesting depth (top-level or nested inside columns). */
const findRowById = (id: string): any | null => {
  for (const row of rows.value) {
    if (String(row.id) === id) return row;
    for (const col of row.columns ?? []) {
      for (const child of getColumnChildren(col)) {
        if (String(child.id) === id) return child;
      }
    }
  }
  return null;
};

const handleTreeMousedown = (event: MouseEvent) => {
  if (!renamingRowId.value) return;
  if ((event.target as HTMLElement).tagName === "INPUT") return;
  const row = findRowById(renamingRowId.value);
  if (row) commitRename(row);
};
const handleGlobalMousedown = (event: MouseEvent) => {
  if (!renamingRowId.value) return;
  // composedPath(), not event.target: this listener is on document, so any
  // event crossing the shadow boundary has its target retargeted to the
  // host — making this check always false and committing the rename on
  // every click, including clicks inside the tree itself.
  if (treeRef.value && event.composedPath().includes(treeRef.value)) return;
  const row = findRowById(renamingRowId.value);
  if (row) commitRename(row);
};

onMounted(() => document.addEventListener("mousedown", handleGlobalMousedown));
onUnmounted(() => {
  document.removeEventListener("mousedown", handleGlobalMousedown);
  // Cancel any pending hover commit so it doesn't fire into a dead component
  // after SPA navigation.
  if (_hoverTimer) {
    clearTimeout(_hoverTimer);
    _hoverTimer = null;
  }
});

// ─── Column children helpers ──────────────────────────────────────────────────

/** All direct children of a column in insertion order — no grouping. */
const getColumnChildren = (column: any): any[] =>
  column.children ?? column.components ?? [];

/** Leaf components only — used for the count badge on column headers. */
const getDirectComponents = (column: any): any[] => {
  const kids: any[] = column.children ?? column.components ?? [];
  return kids.filter(
    (c: any) =>
      c.type === "component" || (c.type !== "row" && c.type !== "row-spacer"),
  );
};

/** Resolves the render type regardless of new/legacy shape. */
const getComponentType = (comp: any): string => comp.componentType ?? comp.type;

// ─── Filtering ────────────────────────────────────────────────────────────────

/** Recursively checks whether a column child (component or nested row) matches q. */
const childMatchesQuery = (child: any, q: string): boolean => {
  if (child.type === "row" || child.type === "row-spacer") {
    if ("row".includes(q)) return true;
    if (
      displayName(child.name ?? "")
        .toLowerCase()
        .includes(q)
    )
      return true;
    return (
      child.columns?.some((col: any) =>
        getColumnChildren(col).some((c: any) => childMatchesQuery(c, q)),
      ) ?? false
    );
  }
  // Leaf component
  return (
    getComponentType(child).toLowerCase().includes(q) ||
    getComponentLabel(child).toLowerCase().includes(q)
  );
};

const filteredRows = computed(() => {
  if (!searchQuery.value.trim()) return rows.value;
  const q = searchQuery.value.toLowerCase();
  return rows.value.filter((row: any) => {
    if (row.type === "row-spacer") {
      return (
        "spacer".includes(q) ||
        displayName(row.name ?? "spacer")
          .toLowerCase()
          .includes(q)
      );
    }
    return (
      "row".includes(q) ||
      displayName(row.name ?? "")
        .toLowerCase()
        .includes(q) ||
      row.columns?.some((col: any) =>
        getColumnChildren(col).some((child: any) =>
          childMatchesQuery(child, q),
        ),
      )
    );
  });
});

/** Recursively expands nested rows that match the query so they are visible. */
const expandMatchingChildren = (col: any, q: string) => {
  getColumnChildren(col).forEach((child: any) => {
    if (child.type === "row" || child.type === "row-spacer") {
      if (childMatchesQuery(child, q)) expandedRows.add(child.id);
      child.columns?.forEach((nestedCol: any) =>
        expandMatchingChildren(nestedCol, q),
      );
    }
  });
};

watch(searchQuery, (q) => {
  if (!q.trim()) return;
  filteredRows.value.forEach((row: any) => {
    if (row.type === "row") {
      expandedRows.add(row.id);
      row.columns?.forEach((col: any) => expandMatchingChildren(col, q));
    }
  });
});

// ─── Expand / Collapse ────────────────────────────────────────────────────────

const isExpanded = (id: string) => expandedRows.has(id);
const toggleExpanded = (id: string) => {
  if (expandedRows.has(id)) expandedRows.delete(id);
  else expandedRows.add(id);
};
const collapseAll = () => expandedRows.clear();

// ─── Selection ────────────────────────────────────────────────────────────────

const isRowSelected = (rowId: string) =>
  selectedRowId.value === rowId && !selectedId.value;
const isColumnSelected = (columnId: string) =>
  selectedColumn.value?.columnId === columnId && !selectedId.value;
const isComponentSelected = (compId: string) => selectedId.value === compId;

// ─── Click handlers ───────────────────────────────────────────────────────────

const handleRowClick = (row: any) => {
  if (renamingRowId.value === row.id) return;
  selectedRowId.value = row.id;
  selectedId.value = null;
  if (row.type === "row" && row.columns?.length > 0) {
    const alreadyInThisRow = selectedColumn.value?.rowId === row.id;
    if (!alreadyInThisRow) {
      selectedColumn.value = { rowId: row.id, columnId: row.columns[0].id };
    }
    expandedRows.add(row.id);
  } else {
    selectedColumn.value = null;
  }
  sidebarTab.value = "properties";
  emit("select");
};

const handleColumnClick = (row: any, column: any) => {
  selectedRowId.value = row.id;
  selectedColumn.value = { rowId: row.id, columnId: column.id };
  selectedId.value = null;
  sidebarTab.value = "properties";
  emit("select");
};

const handleComponentClick = (row: any, column: any, comp: any) => {
  selectedId.value = comp.id;
  selectedRowId.value = null;
  selectedColumn.value = { rowId: row.id, columnId: column.id };
  sidebarTab.value = "properties";
  emit("select");
};

// ─── Labels ───────────────────────────────────────────────────────────────────

const getRowLabel = (row: any): string => {
  if (row.type === "row-spacer")
    return row.name ? displayName(row.name) : "Spacer";
  if (row.name) return displayName(row.name);
  const colCount = row.columns?.length ?? 1;
  return colCount === 1 ? "Row" : `Row · ${colCount}`;
};

const getComponentLabel = (comp: any): string => {
  const labels: Record<string, string> = {
    paragraph: "Paragraph",
    heading: "Heading",
    image: "Image",
    video: "Video",
    list: "List",
    button: "Button",
    anchor: "Anchor",
    divider: "Divider",
    spacer: "Spacer",
    menu: "Menu",
    socials: "Socials",
  };
  return labels[getComponentType(comp)] ?? getComponentType(comp);
};

// ─── Stats ────────────────────────────────────────────────────────────────────

const countComponents = (children: any[]): number =>
  children.reduce((acc: number, child: any) => {
    if (
      child.type === "component" ||
      (child.type !== "row" && child.type !== "row-spacer")
    )
      return acc + 1;
    if (child.type === "row") {
      return (
        acc +
        (child.columns ?? []).reduce(
          (a: number, col: any) =>
            a + countComponents(col.children ?? col.components ?? []),
          0,
        )
      );
    }
    return acc;
  }, 0);

const totalComponents = computed(() =>
  rows.value.reduce((acc: number, row: any) => {
    if (row.type !== "row") return acc;
    return (
      acc +
      (row.columns ?? []).reduce(
        (a: number, col: any) =>
          a + countComponents(col.children ?? col.components ?? []),
        0,
      )
    );
  }, 0),
);

// ─── Empty column drop zone ───────────────────────────────────────────────────
// When a column has NO children, the per-item dragover/drop handlers never fire
// because there are no items to hover over. These dedicated handlers make the
// "Empty" placeholder itself a valid drop target so components can be moved
// into any column regardless of whether it already contains items.

const emptyColumnDragOver = ref<string | null>(null);

const handleEmptyColumnDragOver = (e: DragEvent, columnId: string) => {
  if (!drag.value || drag.value.kind !== "component") return;
  e.preventDefault();
  emptyColumnDragOver.value = columnId;
};

const handleEmptyColumnDragLeave = (e: DragEvent, columnId: string) => {
  const el = e.currentTarget as HTMLElement;
  const to = e.relatedTarget as Node | null;
  if (to && el.contains(to)) return;
  if (emptyColumnDragOver.value === columnId) {
    emptyColumnDragOver.value = null;
  }
};

const handleEmptyColumnDrop = (
  e: DragEvent,
  parentRowId: string,
  columnId: string,
) => {
  e.preventDefault();
  emptyColumnDragOver.value = null;
  const d = drag.value;
  if (!d || d.kind !== "component") {
    handleDragEnd();
    return;
  }
  // Insert at index 0 — the column is empty so there's only one valid position
  moveComponentBetweenColumns(d.id, parentRowId, columnId, 0);
  handleDragEnd();
};

//
// Architecture:
//   • Every draggable item (row, nested-row, component) stamps its identity
//     into dataTransfer AND into a local `drag` ref so drop targets can read
//     context synchronously (dataTransfer.getData is only available in drop).
//   • Drop targets are the items themselves (reorder before/after) or columns
//     (drop into). We show a thin <LayerDropLine> indicator in the gap between
//     items rather than styling the item itself — cleaner UX, less visual noise.
//   • Type safety rules: components can only land inside columns (not rows),
//     rows can land between top-level rows or inside columns as nested rows.
//     An incompatible drop is silently ignored.

interface DragMeta {
  id: string;
  kind: "top-level-row" | "nested-row" | "component";
  /** For nested-row: the column it currently lives in */
  parentColumnId: string | null;
  /** For nested-row: the row that owns parentColumnId */
  parentRowId: string | null;
  /** For component: the column it currently lives in */
  columnId: string | null;
  /** For component: the row that owns columnId */
  rowId: string | null;
  /** Current index within its parent array */
  index: number;
}

const drag = ref<DragMeta | null>(null);

// dropTarget tracks { containerId, index, scope } for the active drop line
// scope: 'top-level' means rows.value, 'child' means a column's children[]
const dropTarget = ref<{
  containerId: string | null; // null = top-level
  index: number;
  scope: "top-level" | "child";
} | null>(null);

const isDragSource = (id: string) => drag.value?.id === String(id);

const isDropLineActive = (
  containerId: string | null,
  index: number,
  scope: "top-level" | "child",
): boolean => {
  if (!dropTarget.value) return false;
  return (
    dropTarget.value.containerId === containerId &&
    dropTarget.value.index === index &&
    dropTarget.value.scope === scope
  );
};

const handleDragStart = (
  e: DragEvent,
  element: any,
  kind: DragMeta["kind"],
  parentRowId: string | null,
  parentColumnId: string | null,
  index: number,
) => {
  drag.value = {
    id: String(element.id),
    kind,
    parentColumnId,
    parentRowId,
    columnId: parentColumnId, // alias for component context
    rowId: parentRowId,
    index,
  };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("layerDragId", String(element.id));
    e.dataTransfer.setData("layerDragKind", kind);
  }
};

const handleDragEnd = () => {
  drag.value = null;
  dropTarget.value = null;
};

/**
 * Determines which drop line to activate.
 * targetId: the element being hovered over
 * scope / containerId: context for this slot in the tree
 */
const handleDragOver = (
  e: DragEvent,
  targetId: string,
  kind: DragMeta["kind"],
  containerId: string | null,
  _parentRowId: string | null,
  itemIndex: number,
) => {
  if (!drag.value) return;
  if (drag.value.id === String(targetId)) return;

  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const isUpperHalf = e.clientY < rect.top + rect.height / 2;
  const insertIndex = isUpperHalf ? itemIndex : itemIndex + 1;

  // Type guard: components can only move within/between columns, not to top-level
  if (drag.value.kind === "component" && kind === "top-level-row") return;

  // Type guard: top-level rows can only be reordered at top-level
  if (drag.value.kind === "top-level-row" && kind !== "top-level-row") return;

  const scope = kind === "top-level-row" ? "top-level" : "child";
  dropTarget.value = { containerId, index: insertIndex, scope };
};

const handleDragLeave = (e: DragEvent) => {
  const el = e.currentTarget as HTMLElement;
  const to = e.relatedTarget as Node | null;
  // Only clear if we actually left the element (not just moved to a child)
  if (to && el.contains(to)) return;
  dropTarget.value = null;
};

const handleDrop = (
  e: DragEvent,
  _targetElement: any,
  _kind: DragMeta["kind"],
  containerId: string | null,
  parentRowId: string | null,
  itemIndex: number,
) => {
  e.preventDefault();
  const d = drag.value;
  if (!d || !dropTarget.value) {
    handleDragEnd();
    return;
  }

  const { index: targetIndex, scope } = dropTarget.value;

  try {
    if (d.kind === "top-level-row" && scope === "top-level") {
      // Reorder top-level rows
      const fromIndex = rows.value.findIndex((r: any) => String(r.id) === d.id);
      if (fromIndex === -1) return;
      let toIndex = targetIndex;
      // Adjust for removal of source shifting the array
      if (fromIndex < toIndex) toIndex -= 1;
      if (fromIndex !== toIndex) {
        reorderRows(fromIndex, toIndex);
      }
    } else if (d.kind === "nested-row" && scope === "child") {
      // Move nested row to another column (or reorder within same column)
      const targetColId = dropTarget.value.containerId;
      if (!targetColId || !parentRowId) return;
      moveNestedRow(d.id, parentRowId, targetColId, targetIndex);
    } else if (d.kind === "nested-row" && scope === "top-level") {
      // Promote nested row to top-level
      const toIndex = targetIndex;
      moveNestedRow(d.id, null, null, toIndex);
    } else if (d.kind === "component" && scope === "child") {
      // Move component between columns or reorder within a column
      const targetColId = dropTarget.value.containerId;
      if (!targetColId || !parentRowId) return;
      moveComponentBetweenColumns(d.id, parentRowId, targetColId, targetIndex);
    }
  } finally {
    handleDragEnd();
  }
};
</script>
