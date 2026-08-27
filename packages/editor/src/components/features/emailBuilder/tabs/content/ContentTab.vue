<template>
  <div class="w-full md-surface-sidebar-inner flex flex-col h-[calc(100vh-7.5rem)]">
    <!-- Tab bar -->
    <div class="md-tabstrip flex gap-4 px-2 pt-2 shrink-0">
      <button
        @click="sidebarTab = 'layers'"
        :class="[
          'relative pb-2 text-xs font-medium transition-colors',
          sidebarTab === 'layers'
            ? 'md-tab-active'
            : 'md-tab-idle',
        ]"
      >
        <span class="flex items-center gap-1.5 text-sm">
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"
            />
          </svg>
          Layers
          <span
            v-if="rows.length > 0"
            class="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-medium rounded-full bg-[var(--md-surface-muted)] text-[var(--md-text-subtle)]"
          >
            {{ rows.length }}
          </span>
        </span>
        <span
          v-if="sidebarTab === 'layers'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--md-text)] rounded-full"
        />
      </button>

      <button
        @click="sidebarTab = 'properties'"
        :class="[
          'relative pb-2 text-xs font-medium transition-colors',
          sidebarTab === 'properties'
            ? 'md-tab-active'
            : 'md-tab-idle',
        ]"
      >
        <span class="flex items-center gap-1.5 text-sm">
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 6V4m0 2a2 2 0 1 0 0 4m0-4a2 2 0 1 1 0 4m-6 8a2 2 0 1 0 0-4m0 4a2 2 0 1 1 0-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 1 0 0-4m0 4a2 2 0 1 1 0-4m0 4v2m0-6V4"
            />
          </svg>
          Properties
          <span
            v-if="hasSelection && sidebarTab !== 'properties'"
            class="w-1.5 h-1.5 rounded-full bg-[var(--md-text-subtle)]"
          />
        </span>
        <span
          v-if="sidebarTab === 'properties'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--md-text)] rounded-full"
        />
      </button>
    </div>

    <!-- Layers panel -->
    <div v-show="sidebarTab === 'layers'" class="flex-1 overflow-hidden">
      <LayersPanel @select="sidebarTab = 'properties'" />
    </div>

    <!-- Properties panel -->
    <div
      v-show="sidebarTab === 'properties'"
      class="flex-1 overflow-y-auto p-4"
    >
      <!-- Nothing selected -->
      <div
        v-if="!selectedId && !selectedRowId && !selectedColumn"
        class="flex flex-col items-center justify-start h-full text-center py-8"
      >
        <div
          class="w-10 h-10 rounded-xl bg-[var(--md-surface-muted)] flex items-center justify-center mb-3"
        >
          <svg
            class="w-5 h-5 text-[var(--md-text-subtle)] -translate-x-0.5 -translate-y-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
            />
          </svg>
        </div>
        <p class="text-sm font-medium text-[var(--md-text-subtle)] mb-1">Nothing selected</p>
        <p class="text-xs text-[var(--md-text-subtle)]">
          Click a row or component on the canvas, or browse via the Layers tab
        </p>
      </div>

      <!-- Row / Spacer Properties -->
      <div
        v-else-if="selectedRowId && selectedRow && !selectedId"
        class="space-y-2.5"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-bold text-[var(--md-text-muted)]">
            {{
              selectedRow.type === "row-spacer"
                ? "Row Spacer Properties"
                : "Row Properties"
            }}
          </p>
        </div>

        <div class="flex items-center justify-between gap-2 mb-4">
          <div
            class="flex items-center gap-1 p-0.5 bg-[var(--md-surface-muted)] rounded-lg flex-1"
          >
            <button
              @click="activeTab = 'row'"
              class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all relative"
              :class="
                activeTab === 'row'
                  ? 'bg-[var(--md-surface)] text-[var(--md-text)] shadow-sm'
                  : 'text-[var(--md-text-subtle)] hover:text-[var(--md-text-muted)]'
              "
            >
              {{ selectedRow.type === "row-spacer" ? "Spacer" : "Row" }}
            </button>
            <button
              v-if="selectedRow.type !== 'row-spacer'"
              @click="activeTab = 'column'"
              class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 relative"
              :class="
                activeTab === 'column'
                  ? 'bg-[var(--md-surface)] text-[var(--md-text)] shadow-sm'
                  : 'text-[var(--md-text-subtle)] hover:text-[var(--md-text-muted)]'
              "
            >
              <span>Column</span>
              <span
                v-if="selectedColumn"
                class="inline-flex items-center justify-center min-w-4.5 h-4 px-1 text-[9px] font-medium bg-[var(--md-border)] text-[var(--md-text-muted)] rounded-full"
              >
                {{ selectedColumnIndex + 1 }}/{{ selectedRow.columns.length }}
              </span>
            </button>
          </div>
          <div class="relative group/btn">
            <button
              @click="handleDeleteRow"
              class="p-1.5 text-[var(--md-text-subtle)] hover:text-[var(--md-danger)] rounded-md hover:bg-[var(--md-danger-bg)] transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current"
              >
                <path
                  d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <div
              class="pointer-events-none absolute bottom-full left-2/2 -translate-x-2/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:right-2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
            >
              Delete row
            </div>
          </div>
        </div>

        <!-- Row / Spacer sub-panels -->
        <RowPanel
          v-if="activeTab === 'row' && selectedRow.type === 'row'"
          :row="selectedRow"
        />
        <RowSpacerPanel
          v-if="activeTab === 'row' && selectedRow.type === 'row-spacer'"
          :spacer="selectedRow"
        />

        <!-- Column sub-panel -->
        <div v-else-if="activeTab === 'column'">
          <p
            v-if="selectedRow.type === 'row-spacer'"
            class="text-sm text-[var(--md-text-subtle)]"
          >
            Row spacers do not have columns.
          </p>
          <template v-else>
            <div
              v-if="selectedRow.columns.length > 1"
              class="flex flex-wrap gap-3 mb-4 border-b border-[var(--md-border)]"
            >
              <button
                v-for="(col, i) in selectedRow.columns"
                :key="col.id"
                @click="selectColumnById(col.id)"
                class="text-xs font-medium transition-colors pb-1.5"
                :class="
                  selectedColumn?.columnId === col.id
                    ? 'text-[var(--md-text)] border-b-2 border-[var(--md-text)]'
                    : 'text-[var(--md-text-subtle)] hover:text-[var(--md-text-muted)] border-b-2 border-transparent'
                "
              >
                Column {{ Number(i) + 1 }}
              </button>
            </div>
            <RowColumnPanel
              v-if="activeColumnObject"
              :column="activeColumnObject"
            />
            <p v-else class="text-sm text-[var(--md-text-subtle)]">
              Select a column to edit its properties
            </p>
          </template>
        </div>
      </div>

      <!-- Component Properties -->
      <div v-else-if="selectedComponent" class="space-y-4">
        <div
          class="flex items-center justify-between mb-4 pb-4 border-b border-[var(--md-border)]"
        >
          <div>
            <!-- Use componentType (new shape) falling back to type (legacy) -->
            <p class="text-sm font-medium text-[var(--md-text-muted)] capitalize">
              {{ selectedComponent.componentType ?? selectedComponent.type }}
            </p>
            <p class="text-xs text-[var(--md-text-subtle)]">Component Properties</p>
          </div>
          <div class="relative group/btn">
            <button
              @click="handleDelete"
              class="p-1.5 text-[var(--md-text-subtle)] hover:text-[var(--md-danger)] rounded-md hover:bg-[var(--md-danger-bg)] transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current"
              >
                <path
                  d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <div
              class="pointer-events-none absolute -bottom-[125%] left-2/2 -translate-x-2/2 mb-2 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:bottom-full after:right-2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)] after:rotate-180"
            >
              Delete block
            </div>
          </div>
        </div>

        <!-- Registered blocks render their settings here — takes priority.
             Currently just "button". -->
        <component
          :is="registeredBlock.renderSettings"
          v-if="registeredBlock"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useConfirm } from "@/composables/ui/useConfirm";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { getBlock } from "@/blocks/registry";
import LayersPanel from "./LayersPanel.vue";
import RowPanel from "../../panels/RowPanel.vue";
import RowSpacerPanel from "../../panels/RowSpacerPanel.vue";
import RowColumnPanel from "../../panels/RowColumnPanel.vue";

const confirm = useConfirm();
const {
  selectedId,
  findComponent,
  findRow,
  deleteComponent,
  rows,
  deleteRow,
  selectedRowId,
  selectedColumn,
  sidebarTab,
} = useEmailBuilder();

const activeTab = ref("row");

const hasSelection = computed(
  () => !!(selectedId.value || selectedRowId.value || selectedColumn.value),
);

watch(
  selectedRowId,
  (newRowId, oldRowId) => {
    activeTab.value = "row";
    if (newRowId !== oldRowId) {
      const incomingRow = findRow(newRowId);
      if (!incomingRow || incomingRow.type === "row-spacer")
        selectedColumn.value = null;
    }
  },
  { flush: "sync" },
);

watch(
  selectedColumn,
  (newCol) => {
    if (newCol && selectedRow.value?.type !== "row-spacer")
      activeTab.value = "column";
  },
  { flush: "sync" },
);

watch(selectedId, (val) => {
  if (val) sidebarTab.value = "properties";
});
watch(selectedRowId, (val) => {
  if (val) sidebarTab.value = "properties";
});

// ── Row ───────────────────────────────────────────────────────────────────────

const selectedRow = computed(() => {
  void rows.value;
  if (!selectedRowId.value) return null;
  return findRow(selectedRowId.value);
});

const handleDeleteRow = () => {
  if (!selectedRowId.value) return;
  confirm.require({
    message:
      selectedRow.value?.type === "row-spacer"
        ? "Delete this spacer?"
        : "Delete this row and all its contents?",
    header: "Confirm Delete",
    acceptLabel: "Delete",
    rejectLabel: "Cancel",
    acceptClass: "!bg-[var(--md-danger)] !hover:opacity-90 !border-[var(--md-danger)] !px-6 !py-2",
    rejectClass:
      "!bg-[var(--md-border)] !hover:bg-[var(--md-border-strong)] !text-[var(--md-text)] !border-[var(--md-border)] !px-6 !py-2",
    accept: () => {
      deleteRow(selectedRowId.value!);
      selectedRowId.value = null;
    },
  });
};

// ── Column ────────────────────────────────────────────────────────────────────

const activeColumnObject = computed(() => {
  if (!selectedRow.value || !selectedColumn.value) return null;
  return (
    selectedRow.value.columns.find(
      (c: any) => c.id === selectedColumn.value!.columnId,
    ) ?? null
  );
});

const selectedColumnIndex = computed(() => {
  if (!selectedRow.value || !selectedColumn.value) return -1;
  return selectedRow.value.columns.findIndex(
    (c: any) => c.id === selectedColumn.value!.columnId,
  );
});

const selectColumnById = (columnId: string) => {
  if (!selectedRowId.value) return;
  selectedColumn.value = { rowId: selectedRowId.value, columnId };
};

// ── Component ─────────────────────────────────────────────────────────────────

const selectedComponent = computed(() => {
  void rows.value;
  if (!selectedId.value) return null;
  return findComponent(selectedId.value);
});

/** Resolves the display/routing type: new shape uses componentType, legacy uses type. */
const resolvedType = computed(
  () =>
    selectedComponent.value?.componentType ??
    selectedComponent.value?.type ??
    null,
);

const registeredBlock = computed(() =>
  resolvedType.value ? getBlock(resolvedType.value) : undefined,
);

const handleDelete = () => {
  if (selectedId.value) deleteComponent(selectedId.value);
};
</script>
