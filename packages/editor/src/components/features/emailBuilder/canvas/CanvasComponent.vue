<template>
  <div
    ref="rootEl"
    @click.stop="selectComponent(component.id)"
    @mouseenter.stop="handleMouseEnter"
    @mouseleave.stop="handleMouseLeave"
    :data-layer-id="component.id"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    :class="[
      'relative mb-0 last:mb-0 cursor-pointer',
      isDragging ? 'opacity-50' : '',
      isSelected ? 'z-20' : 'z-0',
    ]"
  >
    <!-- Drop indicators -->
    <DropZone
      :is-active="isDragOver && dropPosition === 'before'"
      position="before"
      color="#00c950"
    />
    <DropZone
      :is-active="isDragOver && dropPosition === 'after'"
      position="after"
      color="#00c950"
    />

    <!-- Drag Handle moved into the floating action bar below.
         The previous external dot-grid handle has been integrated into the
         action bar to match Canva / Postcards-by-Designmodo style. -->

    <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      v-if="hasVisibility"
      class="fixed -translate-x-full z-60 group/vis"
      :style="{ top: badgePos.top + 'px', left: badgePos.left + 'px' }"
    >
      <div
        class="flex items-center gap-1 bg-linear-to-br from-green-400 to-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg cursor-default select-none ring-2 ring-white"
      >
        <svg
          class="w-2 h-2 shrink-0"
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
        {{ visibilityRuleCount(component.props.visibility) }}
      </div>
      <div
        class="absolute right-0 top-5 w-60 opacity-0 pointer-events-none group-hover/vis:opacity-100 group-hover/vis:pointer-events-auto duration-150 translate-y-1 group-hover/vis:translate-y-0 z-50"
      >
        <VisibilityPopover :visibility="component.props.visibility" />
        <div
          class="absolute -top-1.5 right-4 w-3 h-3 bg-gray-950 border-r border-t border-white/10 rotate-45"
        />
      </div>
    </div>
    </Teleport>

    <!-- Registered blocks render here — takes priority for any type that's
         been ported to the registry. Currently just "button"; the existing
         renderers below still own everything else. -->
    <component
      :is="registeredBlock.renderCanvas"
      v-if="registeredBlock"
      :component="component"
    />

    <!-- Renderers — resolved via compType (new: componentType, legacy: type) -->
    <!-- paragraph, heading, list, anchor, button, image, video all fully
         migrated to the registry — their old hardcoded lines are removed,
         not guarded, since they can no longer be reached. -->

    <!-- paragraph, heading, list, anchor, button, image, video, divider,
         spacer all fully migrated to the registry — their old hardcoded
         markup is removed, not guarded, since it can no longer be reached.
         menu and socials complete the set — all 11 built-ins now route
         through the registry. -->

    <!-- ── Component Action Bar ──────────────────────────────────────────────
         Modern Canva / Postcards-by-Designmodo style:
         • Vertical floating pill, soft multi-layer shadow, rounded-xl
         • Integrated drag handle at the top (replaces external dot handle)
         • Instant show/hide on selection, no enter/leave animation
         • Crisp Lucide-style icons, refined hover states
    -->
    <Teleport v-if="teleportTarget" :to="teleportTarget">
      <div
        v-if="isSelected"
        class="fixed -translate-x-1/2 z-50"
        :style="{ top: toolbarPos.top + 'px', left: toolbarPos.left + 'px' }"
      >
        <div
          class="flex flex-row items-center bg-white/95 backdrop-blur-sm ring-1 ring-green-400/70 rounded-xl px-1.5 py-1 gap-0.5 shadow-[0_2px_8px_-1px_rgba(16,24,40,0.08)]"
        >
          <!-- Drag handle -->
          <div class="relative group/btn">
            <div
              draggable="true"
              @dragstart.stop="handleDragStart"
              @dragend.stop="handleDragEnd"
              @click.stop
              class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 active:cursor-grabbing rounded-lg cursor-grab transition-colors"
              aria-label="Drag to reorder"
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
              class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
            >
              Drag to reorder
            </div>
          </div>

          <div class="w-px h-4 bg-gray-200 mx-1" />

          <!-- Move up -->
          <div class="relative group/btn">
            <button
              @click.stop="handleMoveUp"
              :disabled="isFirst"
              :class="[
                'w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                isFirst
                  ? 'text-gray-200 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
              ]"
              aria-label="Move up"
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
              class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
            >
              Move up
            </div>
          </div>

          <!-- Move down -->
          <div class="relative group/btn">
            <button
              @click.stop="handleMoveDown"
              :disabled="isLast"
              :class="[
                'w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                isLast
                  ? 'text-gray-200 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
              ]"
              aria-label="Move down"
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
              class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
            >
              Move down
            </div>
          </div>

          <div class="w-px h-4 bg-gray-200 mx-1" />

          <!-- Duplicate -->
          <div class="relative group/btn">
            <button
              @click.stop="handleDuplicate"
              class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
              aria-label="Duplicate"
            >
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
              class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
            >
              Duplicate
            </div>
          </div>

          <!-- Delete -->
          <div class="relative group/btn">
            <button
              @click.stop="deleteComponent(component.id)"
              class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Delete"
            >
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
              class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
            >
              Delete
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Hit rings ────────────────────────────────────────────────────────────
         Priority order:
           1. Selected (solid green)                — highest priority
           2. Canvas hover (dashed green, full)     — direct mouse-over this element
           3. Layer-panel hover (dashed green, dim) — hovered from the Layers Panel
         Using canvasHoveredId (written by @mouseenter.stop) means only the
         innermost component under the cursor ever shows ring #2. Parent rows
         are bypassed because stopPropagation prevents them claiming the id.
    -->
    <div
      v-if="isSelected"
      class="absolute inset-0 pointer-events-none border border-green-400 rounded"
    />
    <div
      v-else-if="isCanvasHovered"
      class="absolute inset-0 pointer-events-none border border-dashed border-green-400 rounded"
    />
    <div
      v-else-if="isLayerHovered"
      class="absolute inset-0 pointer-events-none border border-dashed border-green-600/60 rounded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useLayoutDrag } from "@/composables/emailBuilder/core/ui/useLayoutDrag";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";
import { getBlock } from "@/blocks/registry";
import {
  isVisibilityActive,
  visibilityRuleCount,
} from "@/composables/emailBuilder/core/ui/visibilityBadgeHelpers";
import VisibilityPopover from "../ui/visibility/VisibilityPopover.vue";
import DropZone from "../ui/canvas/DropZone.vue";

const props = defineProps({
  component: { type: Object as any, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  rowId: { type: [String, Number], required: true },
  columnId: { type: String, required: true },
  index: { type: [String, Number], required: true },
});
const teleportTarget = useTeleportTarget();

const {
  selectedId,
  deleteComponent,
  moveComponent,
  moveComponentBetweenColumns,
  addComponentAtIndex,
  duplicateComponent,
  previewMode,
  isRowDragActive,
  layerHoveredId,
  selectedRowId,
  selectedColumn,
  canvasHoveredId,
} = useEmailBuilder();

const { isLayoutDragActive } = useLayoutDrag();

// ── Hover isolation ────────────────────────────────────────────────────────────
// canvasHoveredId is set ONLY by direct mouse-over of a canvas element.
// @mouseenter.stop on the root div stops the event bubbling, so parent rows
// never also set canvasHoveredId — only the deepest element under the cursor
// ever holds the id. This eliminates the "5 borders at once" problem entirely.

const handleMouseEnter = () => {
  canvasHoveredId.value = props.component.id;
};

const handleMouseLeave = () => {
  if (canvasHoveredId.value === props.component.id) {
    canvasHoveredId.value = null;
  }
};

// Font loading is centralized in useEmailBuilder — no per-component loader
// needed here. If this component ever needs to force-load a single font
// (e.g. a font-preview hover), uncomment the line below:
// const { loadGoogleFont } = useGoogleFonts();

const isDragging = ref(false);
const isDragOver = ref(false);
const dropPosition = ref("before");

// ─── Per-component selection / hover computeds ───────────────────────────────
// Before: template read `selectedId === component.id` inline in 3 places.
// Each read registers a reactive dependency on the global `selectedId` ref,
// so EVERY CanvasComponent re-renders when selection changes anywhere.
// After: one computed per component. Vue's dependency tracking means only
// the previously-selected and newly-selected components re-render on change
// — the other 60 stay put. Same logic for hover and visibility.
const isSelected = computed(() => selectedId.value === props.component.id);
const isCanvasHovered = computed(
  () => canvasHoveredId.value === props.component.id,
);
const isLayerHovered = computed(
  () => layerHoveredId.value === props.component.id,
);
const hasVisibility = computed(() =>
  isVisibilityActive(props.component.props.visibility),
);

// Resolves the render type: new shape has componentType, legacy uses type directly
const compType = computed(
  () => props.component.componentType ?? props.component.type,
);

const registeredBlock = computed(() => getBlock(compType.value));

// ── Floating action-bar position ────────────────────────────────────────────
// The action bar above is <Teleport>'d to <body> so it isn't clipped by the
// column's/row's `overflow: hidden` (see getColumnStyles / rowStyles). Once
// teleported, it's no longer a child of this element in the DOM, so `absolute`
// positioning relative to this component no longer works — we track this
// element's on-screen position ourselves and feed it in as inline top/left.
const rootEl = ref<HTMLElement | null>(null);
const toolbarPos = ref({ top: 0, left: 0 });
// The visibility badge sits at this component's top-right corner, outside its
// own box — so the row/column overflow:hidden clipped it exactly like the
// toolbar. Teleported out for the same reason, measured from the same rect.
const badgePos = ref({ top: 0, left: 0 });
const BADGE_OFFSET = 8; // matches the old -top-2 / -right-2
const TOOLBAR_GAP = 8; // px between the component's bottom edge and the bar

let rafId: number | null = null;
const updateToolbarPosition = () => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    if (!rootEl.value) return;
    const rect = rootEl.value.getBoundingClientRect();
    toolbarPos.value = {
      top: rect.bottom + TOOLBAR_GAP,
      left: rect.left + rect.width / 2,
    };
    // `left` here is the badge's *right* edge; -translate-x-full pulls it
    // back by its own width, so it sits flush without measuring the badge.
    badgePos.value = {
      top: rect.top - BADGE_OFFSET,
      left: rect.right + BADGE_OFFSET,
    };
  });
};

// A paragraph/heading/list component's own height grows while you type
// (RichTextEditor lives inside it), so watch this element's box too —
// debounced, same as the rich-text toolbar, so it holds still while you're
// actively typing and only settles into place once you pause.
const TOOLBAR_REFLOW_DEBOUNCE_MS = 300;
let toolbarReflowTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedUpdateToolbarPosition = () => {
  if (toolbarReflowTimer !== null) clearTimeout(toolbarReflowTimer);
  toolbarReflowTimer = setTimeout(updateToolbarPosition, TOOLBAR_REFLOW_DEBOUNCE_MS);
};

// Recompute the moment this component becomes selected (nextTick so the DOM
// has updated and rootEl's rect is accurate) — immediately, no debounce,
// since this is a one-off event rather than a keystroke.
watch(isSelected, (selected) => {
  if (selected) nextTick(updateToolbarPosition);
});

// Keep the bar glued to the component on scroll — capture: true catches
// scrolling on the canvas's own scroll container, not just window — on
// viewport resize, and on the component's own size changing.
let componentResizeObserver: ResizeObserver | null = null;
onMounted(() => {
  window.addEventListener("scroll", updateToolbarPosition, true);
  window.addEventListener("resize", updateToolbarPosition);
  if (rootEl.value) {
    componentResizeObserver = new ResizeObserver(debouncedUpdateToolbarPosition);
    componentResizeObserver.observe(rootEl.value);
  }
});
onUnmounted(() => {
  window.removeEventListener("scroll", updateToolbarPosition, true);
  window.removeEventListener("resize", updateToolbarPosition);
  componentResizeObserver?.disconnect();
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (toolbarReflowTimer !== null) clearTimeout(toolbarReflowTimer);
});

const selectComponent = (id: any) => {
  selectedId.value = id;
  selectedRowId.value = null;
  selectedColumn.value = null; // ← clear column selection; a component selection isn't a column selection, so LayoutTab should append rows rather than nest them
};

const handleMoveUp = () => {
  moveComponent(props.component.id, "up");
  nextTick(updateToolbarPosition);
};
const handleMoveDown = () => {
  moveComponent(props.component.id, "down");
  nextTick(updateToolbarPosition);
};
const handleDuplicate = () => {
  duplicateComponent(props.component.id);
  nextTick(updateToolbarPosition);
};

// ── Drag ───────────────────────────────────────────────────────────────────────

const handleDragStart = (e: DragEvent) => {
  isDragging.value = true;
  e.dataTransfer!.effectAllowed = "move";
  e.dataTransfer!.setData("componentId", props.component.id.toString());
  e.dataTransfer!.setData("sourceRowId", props.rowId.toString());
  e.dataTransfer!.setData("sourceColumnId", props.columnId);
  e.dataTransfer!.setData("sourceIndex", props.index.toString());
  e.dataTransfer!.setDragImage(
    e.target as Element,
    (e as any).offsetX,
    (e as any).offsetY,
  );
};

const handleDragEnd = () => {
  isDragging.value = false;
  isDragOver.value = false;
};

const handleDragOver = (e: DragEvent) => {
  // FIX: Do NOT stopPropagation here unconditionally.
  // When the user drags a ROW or a LAYOUT (from the layout tab), the drag
  // needs to bubble to the column so the column can show its "drop here" overlay.
  // stopPropagation is only needed for component-to-component reordering (where
  // CanvasComponent is the real target, not the column).
  if (isRowDragActive.value || isLayoutDragActive.value) {
    // This is a layout or row drag — let it bubble to the column, don't handle here.
    return;
  }

  // From here down: this IS a component drag (new from sidebar or reorder).
  // Now it's safe to stop propagation so the column doesn't also react.
  e.stopPropagation();

  const isNewComponent =
    e.dataTransfer!.getData("isNewComponent") === "true" ||
    e.dataTransfer!.types.includes("text/plain");

  const componentId = e.dataTransfer!.getData("componentId");
  if (!isNewComponent && componentId === props.component.id.toString()) return;

  // Compute intended next state BEFORE writing. dragover fires at ~60hz so
  // unconditional writes trigger ~180 reactive notifications over a 3s drag
  // even when nothing actually changes. Gating the write makes ~170 of them
  // no-ops at the JS level.
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const nextPos: "before" | "after" =
    e.clientY < rect.top + rect.height / 2 ? "before" : "after";

  if (dropPosition.value !== nextPos) dropPosition.value = nextPos;
  if (!isDragOver.value) isDragOver.value = true;

  e.dataTransfer!.dropEffect = isNewComponent ? "copy" : "move";
};

const handleDragLeave = (e: DragEvent) => {
  if (isRowDragActive.value || isLayoutDragActive.value) return;
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
    isDragOver.value = false;
  }
};

const handleDrop = (e: DragEvent) => {
  if (isRowDragActive.value || isLayoutDragActive.value) return;
  e.preventDefault();
  e.stopPropagation();
  isDragOver.value = false;

  const isNewComponent = e.dataTransfer!.getData("isNewComponent") === "true";
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const dropIndex =
    e.clientY < rect.top + rect.height / 2
      ? props.index
      : (props.index as number) + 1;

  if (isNewComponent) {
    const componentType = e.dataTransfer!.getData("componentType");
    if (componentType)
      addComponentAtIndex(
        props.rowId,
        props.columnId,
        componentType,
        dropIndex,
      );
  } else {
    const componentId = e.dataTransfer!.getData("componentId");
    if (componentId && componentId !== props.component.id.toString()) {
      moveComponentBetweenColumns(
        componentId,
        props.rowId,
        props.columnId,
        dropIndex,
      );
    }
  }
};

// ─── Style helpers ────────────────────────────────────────────────────────────
//
// IMPORTANT — performance notes:
//
// Previously these were plain functions called from the template as
// `:style="getParagraphStyles()"`. Vue re-executes template expressions on
// every reactive tick, so each call rebuilt a brand-new style object even
// when nothing changed. With 60+ components on the canvas, a single keystroke
// or hover meant hundreds of redundant object allocations and a style-diff
// cycle for each.
//
// Now every `*Styles` binding is a `computed`. Vue caches the result and
// only recomputes when its specific reactive deps (the component's props,
// previewMode) actually change. Template reads `:style="menuContainerStyles"`
// (no parens) — a plain ref read that Vue knows to cache.
//
// Additionally, `loadGoogleFont` used to run inside the style builders,
// meaning the font loader fired on every render. It's now moved into a
// single `watch` on fontFamily with `immediate: true`, so each unique font
// loads exactly once per component lifecycle.

// ── Google Font loader ────────────────────────────────────────────────────────
// Font loading is now centralized in useEmailBuilder via a single watchEffect
// that scans the entire template and batches all fonts into ONE combined
// Google Fonts request per delta. The per-component watch that used to live
// here has been removed — it fired loadGoogleFont() once per component on
// mount, causing 6+ separate render-blocking <link> requests on a template
// with multiple fonts. See `syncFontsForTemplate` in useGoogleFonts.ts.
//
// If you need to force-load a single font from this component in the future
// (e.g. a font-preview hover), use `loadGoogleFont(family)` directly — still
// exported for that exact one-off use case.

</script>