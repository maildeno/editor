<template>
  <div
    ref="rootEl"
    @click.stop="selectSpacer"
    :data-layer-id="spacer.id"
    :class="[
      isDragging ? 'opacity-50' : '',
      selectedRowId === spacer.id ? 'z-20' : 'z-0',
      'relative group -mx-20 px-20',
    ]"
  >
    <!-- Hit ring -->
    <div
      class="pointer-events-none absolute -left-3 -right-3 top-0 bottom-0 border rounded transition-colors"
      :class="[
        selectedRowId === spacer.id
          ? 'border-(--md-row-selection)'
          : layerHoveredId === spacer.id
            ? 'border-(--md-row-selection) border-dashed'
            : isLayerHovered
              ? 'border-(--md-row-selection-fg) border-dashed opacity-60'
              : 'border-transparent group-hover:border-(--md-border-strong)',
      ]"
    />

    <!-- Drop indicator ABOVE -->
    <DropZone
      :is-active="isDragOver && dropPosition === 'before'"
      position="before"
    />

    <!-- Drop indicator BELOW -->
    <DropZone
      :is-active="isDragOver && dropPosition === 'after'"
      position="after"
    />

    <!-- Drag handle moved into the action bar below for the new
         Canva / Postcards-by-Designmodo style. -->

    <!-- Spacer Visual -->
    <div :style="spacerStyles" class="relative group">
      <div
        class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <span
          class="text-xs text-white bg-(--md-row-selection-fg) px-1.5 py-px rounded shadow-sm"
        >
          {{ spacer.height }}px
        </span>
      </div>
    </div>

    <!-- Visibility Rules Badge -->
    <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      v-if="isVisibilityActive(spacer.visibility)"
      class="fixed z-60 group/vis -translate-y-1/2"
      :style="{ top: badgePos.top + 'px', left: badgePos.left + 'px' }"
    >
      <!-- Pill trigger -->
      <div
        class="flex items-center gap-1 bg-gradient-to-r from-(--md-row-selection) to-(--md-row-selection-fg) text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md cursor-default select-none tracking-wide"
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
        IF {{ visibilityRuleCount(spacer.visibility) }}
      </div>

      <!-- Hover popover — opens RIGHT -->
      <div
        class="absolute left-0 top-5 w-60 opacity-0 pointer-events-none group-hover/vis:opacity-100 group-hover/vis:pointer-events-auto duration-150 translate-y-1 group-hover/vis:translate-y-0 z-50"
      >
        <VisibilityPopover :visibility="spacer.visibility" />
        <div
          class="absolute -top-1.5 left-4 w-3 h-3 bg-gray-950 border-l border-t border-white/10 rotate-45"
        />
      </div>
    </div>
    </Teleport>

    <!-- Drop overlay -->
    <div
      v-if="isTopLevelRowDragActive"
      class="absolute inset-0 z-30"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.stop="handleDrop"
    />

    <!-- ── Spacer Action Bar ─────────────────────────────────────────────────
         Modern Canva / Postcards-by-Designmodo style:
         • Horizontal floating pill above the spacer, soft shadow
         • Integrated drag handle on the left
         • Smooth fade-in on selection, dims while scrolling
    -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="selectedRowId === spacer.id"
        class="absolute -top-4 left-1/2 -translate-x-1/2 z-50"
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
              Drag to reorder
            </div>
          </div>

          <div class="w-px h-4 bg-[var(--md-border)]/80 mx-0.5" />

          <!-- Move up button -->
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
              Move spacer up
            </div>
          </div>

          <!-- Move down button -->
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
              Move spacer down
            </div>
          </div>

          <div class="w-px h-4 bg-[var(--md-border)]/80 mx-0.5" />

          <!-- Spacer label chip -->
          <span
            class="px-2 text-[11px] font-semibold text-[var(--md-row-selection-fg)] tracking-wide uppercase select-none"
          >
            Spacer
          </span>

          <div class="w-px h-4 bg-[var(--md-border)]/80 mx-0.5" />

          <!-- Duplicate spacer button -->
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
              Duplicate spacer
            </div>
          </div>

          <!-- Delete button -->
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
              Delete spacer
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";
import { useConfirm } from "@/composables/ui/useConfirm";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import {
  isVisibilityActive,
  visibilityRuleCount,
} from "@/composables/emailBuilder/core/ui/visibilityBadgeHelpers";
import VisibilityPopover from "../ui/visibility/VisibilityPopover.vue";
import DropZone from "../ui/canvas/DropZone.vue";

const teleportTarget = useTeleportTarget();
const rootEl = ref<HTMLElement | null>(null);

const props = defineProps({
  spacer: { type: Object, required: true },
  index: { type: Number, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
});

const confirm = useConfirm();

const {
  moveRow,
  deleteRow,
  reorderRows,
  duplicateRowSpacer,
  selectedId,
  selectedRowId,
  selectedColumn,
  isRowDragActive,
  isTopLevelRowDragActive,
  layerHoveredId,
} = useEmailBuilder();

const isLayerHovered = computed(
  () => layerHoveredId.value === String(props.spacer.id),
);

const isDragging = ref(false);
const isDragOver = ref(false);
const dropPosition = ref("after");

/* selection */

const selectSpacer = () => {
  selectedRowId.value = props.spacer.id;
  selectedId.value = null; // ← clear component selection
  selectedColumn.value = null; // ← clear column selection; spacers have no columns
};

/* move */

const handleMoveUp = () => moveRow(props.spacer.id, "up");
const handleMoveDown = () => moveRow(props.spacer.id, "down");
const handleDuplicate = () => duplicateRowSpacer(props.spacer.id);

/* delete */

const handleDelete = () => {
  confirm.require({
    message: "Delete this spacer?",
    header: "Confirm Delete",
    acceptLabel: "Delete",
    rejectLabel: "Cancel",
    acceptClass: "!bg-[var(--md-danger)] !hover:opacity-90 !border-[var(--md-danger)] !px-6 !py-2",
    rejectClass:
      "!bg-[var(--md-border)] !hover:bg-[var(--md-border-strong)] !text-[var(--md-text)] !border-[var(--md-border)] !px-6 !py-2",
    accept: () => deleteRow(props.spacer.id),
  });
};

/* drag */

const handleDragStart = (e: DragEvent) => {
  isDragging.value = true;
  isRowDragActive.value = true;
  isTopLevelRowDragActive.value = true;

  e.dataTransfer!.effectAllowed = "move";
  e.dataTransfer!.setData("dragType", "row");
  e.dataTransfer!.setData("rowIndex", props.index.toString());
};

const handleDragEnd = () => {
  isDragging.value = false;
  isRowDragActive.value = false;
  isDragOver.value = false;
  isTopLevelRowDragActive.value = false;
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = "move";

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const mouseY = e.clientY;
  const elementTop = rect.top;
  const elementBottom = rect.bottom;

  // Compute intended next position BEFORE writing. Same rationale as CanvasRow —
  // the 60hz firing rate of dragover makes unconditional writes expensive even
  // though Vue short-circuits the re-render.
  let nextPos: "before" | "after";
  if (mouseY > elementBottom - 20) {
    // Near bottom edge
    nextPos = "after";
  } else if (mouseY < elementTop + 20) {
    // Near top edge
    nextPos = "before";
  } else {
    // Use midpoint for middle
    nextPos = mouseY < elementTop + rect.height / 2 ? "before" : "after";
  }

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
  const mouseY = e.clientY;
  const elementTop = rect.top;
  const elementBottom = rect.bottom;

  let toIndex;

  // Determine target index with edge thresholds
  if (mouseY > elementBottom - 20) {
    // Drop after current spacer
    toIndex = props.index + 1;
  } else if (mouseY < elementTop + 20) {
    // Drop before current spacer
    toIndex = props.index;
  } else {
    // Use midpoint for middle
    toIndex =
      mouseY < elementTop + rect.height / 2 ? props.index : props.index + 1;
  }

  // Adjust index if moving down (because the array changes)
  if (fromIndex < props.index) toIndex--;

  reorderRows(fromIndex, toIndex);
};

const spacerStyles = computed(() => {
  const s = props.spacer;

  // ── Resolve background ──────────────────────────────────────────────────────
  // Prefer gradient when useGradient is true, fall back to solid backgroundColor.
  const bg = s.backgroundGradient;
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
    backgroundValue = s.backgroundColor ?? "transparent";
  }

  // ── Base styles ─────────────────────────────────────────────────────────────
  const styles: Record<string, string> = {
    width: "100%",
    height: s.height + "px",
    // Use `background` shorthand so CSS gradients render correctly in the
    // browser preview. For solid colours this is equivalent to backgroundColor.
    background: backgroundValue,
  };

  return styles;
});

// ── Floating visibility badge ────────────────────────────────────────────────
// Teleported out of this spacer: the badge hangs off the left edge, outside the
// spacer's box, and the row/column overflow:hidden clipped it (and its hover
// popover) off. The whole wrapper moves together so group-hover still works.
// Once teleported, `absolute` no longer resolves against this element, so we
// measure it and feed in fixed coordinates — same approach as CanvasRow and
// CanvasComponent.
const badgePos = ref({ top: 0, left: 0 });
const BADGE_OFFSET = 8; // matches the old -left-2

let badgeRaf: number | null = null;
const updateBadgePosition = () => {
  if (badgeRaf !== null) return;
  badgeRaf = requestAnimationFrame(() => {
    badgeRaf = null;
    if (!rootEl.value) return;
    const rect = rootEl.value.getBoundingClientRect();
    badgePos.value = { top: rect.top, left: rect.left - BADGE_OFFSET };
  });
};

watch(
  () => isVisibilityActive(props.spacer.visibility),
  (active) => {
    if (active) nextTick(updateBadgePosition);
  },
);

let spacerResizeObserver: ResizeObserver | null = null;
onMounted(() => {
  // Capture phase: the canvas scrolls in its own container, so a bubbling
  // listener would never see it.
  window.addEventListener("scroll", updateBadgePosition, true);
  window.addEventListener("resize", updateBadgePosition);
  if (rootEl.value && typeof ResizeObserver !== "undefined") {
    spacerResizeObserver = new ResizeObserver(updateBadgePosition);
    spacerResizeObserver.observe(rootEl.value);
  }
  updateBadgePosition();
});
onUnmounted(() => {
  window.removeEventListener("scroll", updateBadgePosition, true);
  window.removeEventListener("resize", updateBadgePosition);
  spacerResizeObserver?.disconnect();
  if (badgeRaf !== null) cancelAnimationFrame(badgeRaf);
});

</script>