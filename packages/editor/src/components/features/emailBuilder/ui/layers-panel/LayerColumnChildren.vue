<template>
  <template v-for="(column, colIndex) in columns" :key="column.id">
    <!-- Column header (multi-column rows only) -->
    <div
      v-if="columns.length > 1"
      @click="handleColumnClick(parentRow, column)"
      @mouseenter="setHovered(column.id)"
      @mouseleave="setHovered(null)"
      :style="rowIndentStyle(depth)"
      :class="[
        'flex items-center gap-1 pr-3 py-1 cursor-pointer transition-colors select-none',
        isColumnSelected(column.id)
          ? 'bg-(--md-row-selection-bg) text-(--md-row-selection-fg)'
          : 'text-(--md-text-subtle) hover:bg-(--md-surface-hover)',
      ]"
    >
      <!-- Grip-width spacer: columns aren't draggable, but reserving the slot
           keeps icons/labels visually aligned with sibling rows & components. -->
      <span class="size-3.25 mr-0.5 shrink-0" aria-hidden="true" />

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-3.25 h-3.25 shrink-0"
        :class="
          isColumnSelected(column.id)
            ? 'text-(--md-row-selection)'
            : 'text-(--md-text-muted)'
        "
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>

      <span
        class="text-sm text-(--md-text-muted) tracking-wider truncate flex-1 min-w-0"
      >
        Column {{ colIndex + 1 }}
      </span>
      <span
        v-if="getDirectComponents(column).length > 0"
        class="shrink-0 size-5 grid place-content-center rounded-full bg-(--md-surface-muted) text-(--md-text-subtle) text-[10px]"
      >
        {{ getDirectComponents(column).length }}
      </span>
    </div>

    <!-- Drop line at index 0 inside this column.
         Aligns with the children's indent (column header collapses in single-column rows). -->
    <LayerDropLine
      :active="isDropLineActive(column.id, 0, 'child')"
      :depth="depth + (columns.length > 1 ? 1 : 0)"
    />

    <!-- Children: components and nested rows interleaved -->
    <template
      v-for="(child, childIdx) in getColumnChildren(column)"
      :key="child.id"
    >
      <!-- ── Leaf component ── -->
      <div
        v-if="
          child.type === 'component' ||
          (child.type !== 'row' && child.type !== 'row-spacer')
        "
        draggable="true"
        @dragstart="
          handleDragStart(
            $event,
            child,
            'component',
            parentRow.id,
            column.id,
            childIdx,
          )
        "
        @dragend="handleDragEnd"
        @dragover.prevent="
          handleDragOver(
            $event,
            child.id,
            'component',
            column.id,
            parentRow.id,
            childIdx,
          )
        "
        @dragleave="handleDragLeave"
        @drop.stop="
          handleDrop(
            $event,
            child,
            'component',
            column.id,
            parentRow.id,
            childIdx,
          )
        "
        @click="handleComponentClick(parentRow, column, child)"
        @mouseenter="setHovered(child.id)"
        @mouseleave="setHovered(null)"
        :style="rowIndentStyle(depth + (columns.length > 1 ? 1 : 0))"
        :class="[
          'group/leaf flex items-center gap-1 pr-3 py-1 cursor-pointer transition-colors select-none',
          isComponentSelected(child.id)
            ? 'bg-(--md-selection-bg) text-(--md-selection-fg)'
            : 'text-(--md-text-subtle) hover:bg-(--md-surface-hover) hover:text-(--md-text-subtle)',
          isDragSource(child.id) ? 'opacity-40' : '',
        ]"
      >
        <!-- Drag grip -->
        <span
          class="size-3 mr-0.5 text-(--md-text-muted) hover:text-(--md-text) shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/leaf:opacity-100 transition-opacity"
        >
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"
            />
          </svg>
        </span>
        <div class="size-4 shrink-0 flex items-center justify-center">
          <ComponentIcon
            :type="getComponentType(child)"
            :selected="isComponentSelected(child.id)"
          />
        </div>
        <span
          class="text-(--md-text-muted) text-sm tracking-wider truncate flex-1 min-w-0 capitalize"
        >
          {{ getComponentLabel(child) }}
        </span>
        <span
          v-if="isVisibilityActive(child.props?.visibility)"
          class="shrink-0 size-3.5"
        >
          <svg
            class="size-3.5 text-(--md-selection)"
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

      <!-- ── Nested row or row-spacer ── -->
      <template v-else-if="child.type === 'row' || child.type === 'row-spacer'">
        <div
          draggable="true"
          @dragstart="
            handleDragStart(
              $event,
              child,
              'nested-row',
              parentRow.id,
              column.id,
              childIdx,
            )
          "
          @dragend="handleDragEnd"
          @dragover.prevent="
            handleDragOver(
              $event,
              child.id,
              'nested-row',
              column.id,
              parentRow.id,
              childIdx,
            )
          "
          @dragleave="handleDragLeave"
          @drop.stop="
            handleDrop(
              $event,
              child,
              'nested-row',
              column.id,
              parentRow.id,
              childIdx,
            )
          "
          @click="handleRowClick(child)"
          @dblclick="startRename(child, $event)"
          @mouseenter="setHovered(child.id)"
          @mouseleave="setHovered(null)"
          :style="rowIndentStyle(depth + (columns.length > 1 ? 1 : 0))"
          :class="[
            'group/nestedrow flex items-center gap-1 pr-3 py-1.5 cursor-pointer transition-colors select-none',
            isRowSelected(child.id)
              ? 'bg-(--md-row-selection-bg) text-(--md-row-selection)'
              : 'text-(--md-text-subtle) hover:bg-(--md-surface-hover) hover:text-(--md-text-muted)',
            isDragSource(child.id) ? 'opacity-40' : '',
          ]"
        >
          <!-- Drag grip -->
          <span
            class="size-3 mr-0.5 text-(--md-text-muted) hover:text-(--md-text) shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/nestedrow:opacity-100 transition-opacity"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"
              />
            </svg>
          </span>
          <!-- Expand toggle -->
          <button
            v-if="child.type === 'row'"
            @click.stop="toggleExpanded(child.id)"
            class="w-4.75 h-4.75 flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-text-subtle) transition-transform shrink-0"
            :class="isExpanded(child.id) ? 'rotate-90' : ''"
          >
            <svg class="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M7.293 4.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L11.586 10 7.293 5.707a1 1 0 0 1 0-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <span v-else class="w-4.5 shrink-0" />
          <!-- Row icon -->
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-3.25 shrink-0"
            :class="
              isRowSelected(child.id)
                ? 'text-(--md-row-selection)'
                : 'text-(--md-text-subtle)'
            "
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
          </svg>

          <!-- Label / rename input -->
          <template v-if="renamingRowId === child.id">
            <input
              :ref="(el) => mountRenameInput(el as HTMLInputElement | null)"
              :value="pendingRenameValue"
              type="text"
              class="flex-1 min-w-0 px-2 py-0.75 text-sm outline-1 outline-(--md-border) rounded-md shadow-xs focus:outline-none focus:ring-[1px] focus:ring-(--md-row-selection) translate-y-px text-(--md-text-muted)"
              @click.stop
              @mousedown.stop
              @keydown.enter.prevent="commitRename(child)"
              @keydown.esc.prevent="cancelRename"
            />
          </template>
          <template v-else>
            <span
              class="text-sm text-(--md-text-muted) tracking-wider truncate flex-1 min-w-0"
            >
              {{ getRowLabel(child) }}
            </span>
          </template>
          <!-- Column count badge -->
          <span
            v-if="child.columns?.length > 1"
            class="shrink-0 size-5 grid place-content-center rounded-full bg-(--md-surface-muted) text-(--md-text-subtle) text-[10px]"
          >
            {{ child.columns.length }}
          </span>
          <!-- Visibility badge -->
          <span
            v-if="isVisibilityActive(child.visibility)"
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

        <!-- ── Recursively render this nested row's columns + children ── -->
        <template v-if="child.type === 'row' && isExpanded(child.id)">
          <LayerColumnChildren
            :columns="child.columns"
            :parent-row="child"
            :ancestor-row="ancestorRow"
            :depth="depth + (columns.length > 1 ? 2 : 1)"
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
      </template>

      <!-- Drop line after each child — siblings share the children's indent. -->
      <LayerDropLine
        :active="isDropLineActive(column.id, childIdx + 1, 'child')"
        :depth="depth + (columns.length > 1 ? 1 : 0)"
      />
    </template>

    <!-- Empty column — droppable placeholder -->
    <div
      v-if="getColumnChildren(column).length === 0"
      @dragover.prevent="handleEmptyColumnDragOver($event, column.id)"
      @dragleave="handleEmptyColumnDragLeave($event, column.id)"
      @drop.stop="handleEmptyColumnDrop($event, parentRow.id, column.id)"
      :style="rowIndentStyle(depth + (columns.length > 1 ? 1 : 0))"
      :class="[
        'flex items-center gap-2 pr-3 py-1 select-none transition-colors rounded-sm',
        emptyColumnDragOver === column.id
          ? 'bg-(--md-row-selection-bg) outline outline-1 outline-dashed outline-(--md-row-selection)'
          : '',
      ]"
    >
      <span class="w-4" />
      <span
        class="text-[11px] italic transition-colors"
        :class="
          emptyColumnDragOver === column.id
            ? 'text-(--md-row-selection)'
            : 'text-(--md-text-subtle)'
        "
      >
        {{ emptyColumnDragOver === column.id ? "Drop here" : "Empty" }}
      </span>
    </div>
  </template>
</template>

<script setup lang="ts">
import ComponentIcon from "./ComponentIcon.vue";
import LayerDropLine from "./LayerDropLine.vue";

// Self-reference for recursive rendering
import LayerColumnChildren from "./LayerColumnChildren.vue";

defineProps<{
  columns: any[];
  parentRow: any;
  ancestorRow: any;
  depth: number;
  // helpers
  getColumnChildren: (col: any) => any[];
  getDirectComponents: (col: any) => any[];
  getComponentType: (comp: any) => string;
  getComponentLabel: (comp: any) => string;
  getRowLabel: (row: any) => string;
  rowIndentStyle: (depth: number) => Record<string, string>;
  // state
  isExpanded: (id: string) => boolean;
  toggleExpanded: (id: string) => void;
  isRowSelected: (id: string) => boolean;
  isColumnSelected: (id: string) => boolean;
  isComponentSelected: (id: string) => boolean;
  isVisibilityActive: (v: any) => boolean;
  isDragSource: (id: string) => boolean;
  isDropLineActive: (
    containerId: string | null,
    index: number,
    scope: "top-level" | "child",
  ) => boolean;
  renamingRowId: string | null;
  pendingRenameValue: string;
  emptyColumnDragOver: string | null;
  // event handlers
  handleDragStart: (...args: any[]) => void;
  handleDragEnd: () => void;
  handleDragOver: (...args: any[]) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (...args: any[]) => void;
  handleRowClick: (row: any) => void;
  handleColumnClick: (row: any, col: any) => void;
  handleComponentClick: (row: any, col: any, comp: any) => void;
  startRename: (row: any, e: MouseEvent) => void;
  mountRenameInput: (el: HTMLInputElement | null) => void;
  commitRename: (row: any) => void;
  cancelRename: () => void;
  setHovered: (id: string | null) => void;
  handleEmptyColumnDragOver: (e: DragEvent, columnId: string) => void;
  handleEmptyColumnDragLeave: (e: DragEvent, columnId: string) => void;
  handleEmptyColumnDrop: (
    e: DragEvent,
    parentRowId: string,
    columnId: string,
  ) => void;
}>();
</script>
