<template>
 <Transition name="panel-slide">
 <!--
 Layout structure (fixes the clip-on-scroll bug from the legacy panels):

 outer → sticky positioning + height bound, NO overflow here
 inner card → flex column, h-full, NO overflow here
 header → shrink-0
 tabs → shrink-0
 filter → shrink-0 (only on system tab)
 body → flex-1 + overflow-y-auto ← THE ONLY scroll container

 The legacy panels had `overflow-y-auto` on BOTH the outer wrapper AND the
 card list, so previews near the bottom would get visually clipped when
 the inner list scrolled past the outer list's bounds. With a single
 scroll container all previews render and scroll cleanly.
 -->
 <div
 v-if="isOpen"
 class="w-65 sticky top-16 h-[calc(100vh-5.25rem)] z-80"
 >
 <div class="bg-white flex flex-col h-full border-r border-gray-200/80">

 <!-- ─────────────────────────────────────────────────────────────────
 Header
 ───────────────────────────────────────────────────────────────────── -->
 <div class="flex items-center justify-between px-3.5 py-3 shrink-0">
 <div class="flex items-center gap-2">
 <!-- Bookmark icon -->
 <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
 <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
 </svg>
 <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-[.08em]">
 Saved Rows
 </span>
 </div>

 <!-- Close button + tooltip -->
 <div class="relative group/close">
 <button
 @click="close"
 class="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
 >
 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
 <path d="M18 6 6 18M6 6l12 12"/>
 </svg>
 </button>
 <div class="pointer-events-none absolute right-0 top-full mt-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/close:opacity-100 -translate-y-0.5 group-hover/close:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:bottom-full after:right-2 after:border-4 after:border-transparent after:border-b-gray-900">
 Close panel
 </div>
 </div>
 </div>

 <!-- ─────────────────────────────────────────────────────────────────
 Header label (was a two-tab selector — system tab removed)
 ───────────────────────────────────────────────────────────────────── -->
 <div class="px-3.5 pb-2 shrink-0">
 <span class="text-[11px] font-medium text-gray-500">My Rows</span>
 </div>


 <!-- ─────────────────────────────────────────────────────────────────
 Body — THE ONLY scroll container.
 min-h-0 is critical: without it, flex-1 inside a flex parent
 with overflow-y-auto can ignore overflow (min-height: auto).
 ───────────────────────────────────────────────────────────────────── -->
 <div class="flex-1 min-h-0 overflow-y-auto">

 <!-- Skeleton -->
 <div v-if="current.isFetching.value" class="p-2 flex flex-col gap-2">
 <div
 v-for="n in 3"
 :key="n"
 class="rounded-lg border border-gray-100 overflow-hidden"
 >
 <div class="bg-gray-100 animate-pulse" :style="{ height: (80 + n * 20) + 'px' }" />
 <div class="flex items-center gap-2 px-2.5 py-2">
 <div class="h-2 flex-1 rounded-full bg-gray-100 animate-pulse" />
 <div class="h-2 w-7 rounded-full bg-gray-100 animate-pulse" />
 </div>
 </div>
 </div>

 <!-- Empty state — no rows at all -->
 <div
 v-else-if="current.rows.value.length === 0"
 class="flex flex-col items-center gap-3 px-5 py-12 text-center"
 >
 <div class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-center">
 <svg class="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
 <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
 </svg>
 </div>
 <div class="space-y-1">
 <p class="text-xs font-medium text-gray-500">No saved rows yet</p>
 <p class="text-[11px] text-gray-400 leading-relaxed">
 Select a row on the canvas,<br>then click
 <span class="text-[#42389E] font-medium">Save</span> in the toolbar.
 </p>
 </div>
 </div>

 <!-- ── Card list ── -->
 <div v-else class="p-2 flex flex-col gap-1.5">
 <TransitionGroup name="row-list">
 <div
 v-for="entry in filteredRows"
 :key="entry.id"
 draggable="true"
 class="group relative rounded-lg border bg-white overflow-hidden transition-all duration-150 select-none cursor-grab active:cursor-grabbing"
 :class="[
 draggingId === entry.id
 ? 'ring-2 ring-purple-400 ring-offset-1 opacity-60 border-purple-300'
 : 'border-gray-200/80 hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.07)]'
 ]"
 @click="handleInsertRow(entry.id)"
 @dragstart="onDragStart($event, entry.id)"
 @dragend="onDragEnd"
 >
 <!-- ── Preview area ── -->
 <div
 :ref="(el) => observeContainerEl(el as Element | null, entry.id)"
 class="relative overflow-hidden border-b border-gray-100"
 :style="{
 height: previewHeight(entry.id) + 'px',
 backgroundColor: entry.row.backgroundColor || '#f9fafb',
 }"
 >
 <div
 :ref="(el) => observePreviewEl(el as Element | null, entry.id)"
 class="absolute top-0 left-0 pointer-events-none"
 :style="{
 width: '600px',
 transformOrigin: 'top left',
 transform: `scale(${previewScale(entry.id)})`,
 }"
 >
 <RowPreview :row="entry.row" />
 </div>

 <!-- Hover overlay: drag hint + insert hint -->
 <div class="absolute inset-0 bg-gray-900/0 group-hover:bg-gray-900/[0.03] transition-colors duration-150 flex items-center justify-center">
 <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-2.5 py-1 shadow-sm">
 <svg class="w-3 h-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
 <path d="M12 5v14M5 12l7-7 7 7"/>
 </svg>
 <span class="text-[10px] font-medium text-gray-600">Click to insert</span>
 </div>
 </div>
 </div>

 <!-- ── Name + meta row (editable) ── -->
 <div
 v-if="canEdit"
 @click.stop
 class="flex items-center gap-1.5 px-2 py-1.5"
 >
 <!-- Drag handle -->
 <div class="shrink-0 text-gray-300 group-hover:text-gray-400 transition-colors cursor-grab active:cursor-grabbing">
 <svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
 <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
 <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
 <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
 </svg>
 </div>

 <!-- Name — dblclick to rename -->
 <span
 v-if="editingId !== entry.id"
 @dblclick.stop="startRename(entry)"
 @click.stop
 class="flex-1 text-[11px] font-medium text-gray-700 truncate cursor-text"
 >{{ entry.name }}</span>

 <input
 v-else
 v-model="editingName"
 @blur="commitRename(entry.id)"
 @keyup.enter="commitRename(entry.id)"
 @keyup.escape="editingId = null"
 @click.stop
 class="flex-1 text-[11px] border border-purple-300 bg-purple-50/40 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-purple-400"
 ref="renameInputRef"
 />

 <span class="text-[10px] text-gray-400 shrink-0 tabular-nums">
 {{ formatDate(entry.createdAt) }}
 </span>

 <!-- Delete button + tooltip (delete is admin-only for org rows) -->
 <div v-if="canDeleteEntry" class="relative group/del">
 <button
 @click.stop="handleDelete(entry.id)"
 class="hidden group-hover:flex items-center justify-center w-5 h-5 shrink-0 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none"
 >
 <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
 <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
 <path d="M10 11v6M14 11v6"/>
 </svg>
 </button>
 <div class="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/del:opacity-100 translate-y-0.5 group-hover/del:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:right-2 after:border-4 after:border-transparent after:border-t-gray-900">
 Remove
 </div>
 </div>
 </div>

 <!-- ── Name + meta row (read-only) ── -->
 <div v-else class="flex items-center gap-1.5 px-2 py-1.5">
 <span class="flex-1 text-[11px] font-medium text-gray-700 truncate">
 {{ entry.name }}
 </span>
 <span class="text-[10px] text-gray-400 shrink-0 tabular-nums">
 {{ formatDate(entry.createdAt) }}
 </span>
 </div>
 </div>
 </TransitionGroup>
 </div>

 </div>
 </div>
 </div>
 </Transition>
</template>

<script setup lang="ts">
import {
 ref,
 computed,
 nextTick,
 onMounted,
 onBeforeUnmount,
 watch,
} from "vue";
import { useConfirm } from "@/composables/ui/useConfirm";
import { useToast } from "@/composables/ui/useToast";
import { useProductRows } from "@/composables/emailBuilder/components/useProductRows";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useLayoutDrag } from "@/composables/emailBuilder/core/ui/useLayoutDrag";
import { useSavedRowsPanel } from "@/composables/system/useSavedRowsPanel";
import RowPreview from "./RowPreview.vue";

// ─── Composables ──────────────────────────────────────────────────────────────
//
// this panel used to have a "system" tab backed by
// useSystemSavedRows — a composable that was never part of the uploaded
// source — showing Maildeno's shared row library alongside the user's own
// rows. That's product content curation, not editor functionality, so it's
// removed rather than stubbed. Only the user/local rows source remains.
// usePermissions and the auth-based save-target messaging are gone for the
// same Batch-0 reason as everywhere else in this pass.

const { isOpen, close } = useSavedRowsPanel();

const userRowsApi = useProductRows();

const confirm = useConfirm();
const toast = useToast();
const { rows, saveToHistoryImmediate } = useEmailBuilder();
const { startLayoutDrag, endLayoutDrag } = useLayoutDrag();

// Always true for now — no plan/tier concept in the editor. See README
// "Capabilities" for the host-controlled replacement, wired.
const canEdit = computed(() => true);
const canDeleteEntry = computed(() => true);

interface RowSource {
 rows: { value: Array<{ id: string; name: string; createdAt: string; row: Record<string, any> }> };
 isFetching: { value: boolean };
 ensureFetched: () => Promise<void> | void;
 rename: (id: string, name: string) => Promise<unknown> | unknown;
 remove: (id: string) => Promise<unknown> | unknown;
 cloneForCanvas: (id: string) => Record<string, any> | null;
}

const userSource: RowSource = {
 rows: userRowsApi.productRows,
 isFetching: userRowsApi.isFetching,
 // Idempotent — guarded internally by `hasFetched` (DB) or `hasHydrated`
 // (localStorage). Safe to call every time the user activates the tab.
 ensureFetched: () => userRowsApi.fetchRows(),
 rename: (id, name) => userRowsApi.renameProductRow(id, name),
 remove: (id) => userRowsApi.deleteProductRow(id),
 cloneForCanvas: (id) => userRowsApi.cloneRowForCanvas(id),
};

const current = computed<RowSource>(() => userSource);

// ─── First-fetch trigger ──────────────────────────────────────────────────────
//
// Whenever the panel opens or the active tab changes, ensure the corresponding
// source has been fetched at least once. Both `fetchRows` implementations are
// idempotent (guarded by an internal `hasFetched` / `hasHydrated` flag), so
// this is safe to call freely — no duplicate network requests, no duplicate
// localStorage reads.

watch(
 isOpen,
 async (open) => {
 if (!open) return;
 await userRowsApi.fetchRows();
 },
 { immediate: true },
);

// ─── Category filter (system tab only) ────────────────────────────────────────

// filteredRows kept as a name (rather than renaming every template usage)
// but there's no filter anymore — single source, no category system.
const filteredRows = computed(() => current.value.rows.value);

// ─── Drag ─────────────────────────────────────────────────────────────────────

const draggingId = ref<string | null>(null);

function onDragStart(e: DragEvent, entryId: string) {
 draggingId.value = entryId;
 startLayoutDrag(e, { type: "product-row", entryId });
}

function onDragEnd() {
 draggingId.value = null;
 endLayoutDrag();
}

// ─── Preview scaling (ResizeObserver pattern — preserved verbatim) ────────────

const FULL_WIDTH = 600;
const containerWidths = ref<Record<string, number>>({});
const measuredHeights = ref<Record<string, number>>({});
const MIN_PREVIEW_HEIGHT = 25;

function previewScale(entryId: string): number {
 const w = containerWidths.value[entryId];
 return w && w > 0 ? w / FULL_WIDTH : 0;
}

function previewHeight(entryId: string): number {
 const natural = measuredHeights.value[entryId];
 if (!natural) return MIN_PREVIEW_HEIGHT;
 return Math.max(
 MIN_PREVIEW_HEIGHT,
 Math.round(natural * previewScale(entryId)),
 );
}

const containerObserver = ref<ResizeObserver | null>(null);
const resizeObserver = ref<ResizeObserver | null>(null);

function observeContainerEl(el: Element | null, entryId: string) {
 if (!el || !containerObserver.value) return;
 (el as HTMLElement).dataset.entryId = entryId;
 containerObserver.value.observe(el);
}

function observePreviewEl(el: Element | null, entryId: string) {
 if (!el || !resizeObserver.value) return;
 (el as HTMLElement).dataset.entryId = entryId;
 resizeObserver.value.observe(el);
}

onMounted(() => {
 containerObserver.value = new ResizeObserver((entries) => {
 for (const entry of entries) {
 const id = (entry.target as HTMLElement).dataset.entryId;
 if (id) {
 const w = entry.contentRect.width;
 if (w > 0) containerWidths.value[id] = w;
 }
 }
 });
 resizeObserver.value = new ResizeObserver((entries) => {
 for (const entry of entries) {
 const id = (entry.target as HTMLElement).dataset.entryId;
 if (id) {
 const h =
 entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
 if (h > 0) measuredHeights.value[id] = h;
 }
 }
 });
});

onBeforeUnmount(() => {
 containerObserver.value?.disconnect();
 resizeObserver.value?.disconnect();
});

// ─── Insert into canvas ───────────────────────────────────────────────────────

function handleInsertRow(entryId: string) {
 if (editingId.value === entryId) return;
 const cloned = current.value.cloneForCanvas(entryId);
 if (!cloned) return;
 rows.value.push(cloned);
 saveToHistoryImmediate("add-product-row");
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function handleDelete(entryId: string) {
 confirm.require({
 message: "Remove this product row from the library?",
 header: "Clear product",
 acceptLabel: "Yes",
 rejectLabel: "Cancel",
 acceptClass:
 "!bg-red-600 !hover:bg-red-700 !border-red-600 !px-6 !py-2",
 rejectClass:
 "!bg-gray-200 !hover:bg-gray-300 !text-gray-800 !border-gray-200 !px-6 !py-2",
 accept: () => current.value.remove(entryId),
 reject: () => {},
 });
}

// ─── Rename ───────────────────────────────────────────────────────────────────

const editingId = ref<string | null>(null);
const editingName = ref("");
const renameInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(
 null,
);

function startRename(entry: { id: string; name: string }) {
 editingId.value = entry.id;
 editingName.value = entry.name;
 nextTick(() => {
 const el = Array.isArray(renameInputRef.value)
 ? renameInputRef.value[0]
 : renameInputRef.value;
 el?.focus();
 });
}

async function commitRename(entryId: string) {
 // Previously hardcoded "Saved to localstorage" regardless of which
 // adapter is actually active — misleading for any host using a custom,
 // DB-backed adapter (exactly what the adapter pattern was
 // built to support). Generic message, since the editor doesn't know or
 // care where the active adapter actually persists to.
 const saveMsg = "Saved";

 if (editingId.value === entryId) {
 const formattedName = editingName.value
 .trim()
 .toLowerCase()
 .replace(/\s+/g, "_")
 .replace(/[^a-z0-9_]/g, "");

 const res = await current.value.rename(entryId, formattedName);
 editingId.value = null;
 toast.add({
 severity: res ? "success" : "error",
 summary: res ? "Rename successful" : "Save failed",
 detail: res ? saveMsg : "Please try again",
 life: 3000,
 });
 }
}

function formatDate(iso: string): string {
 return new Date(iso).toLocaleDateString(undefined, {
 month: "short",
 day: "numeric",
 });
}
</script>

<style scoped>
.panel-slide-enter-active,
.panel-slide-leave-active {
 transition:
 opacity 0.18s ease,
 transform 0.18s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
 opacity: 0;
 transform: translateX(-10px);
}

/* Filter pill fade */
.fade-enter-active,
.fade-leave-active {
 transition:
 opacity 0.15s ease,
 transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
 opacity: 0;
 transform: translateY(-4px);
}

/* Smooth row list reorder/filter transitions */
.row-list-enter-active,
.row-list-leave-active {
 transition:
 opacity 0.2s ease,
 transform 0.2s ease;
}
.row-list-enter-from,
.row-list-leave-to {
 opacity: 0;
 transform: translateY(6px);
}
.row-list-move {
 transition: transform 0.2s ease;
}

/* Scrollbar — thin, unobtrusive */
.overflow-y-auto::-webkit-scrollbar {
 width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-track {
 background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
 background: #6a7282;
 border-radius: 9999px;
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
 background: #364153;
}
</style>