<template>
  <!--
    CanvasRowDropZone
    Sits between rows on the canvas. Only becomes interactive when a layout
    item is being dragged from the sidebar (isLayoutDragActive === true).
  -->
  <div
    class="canvas-drop-zone"
    :class="{
      'canvas-drop-zone--receptive': isAcceptingDrag && !isEmpty,
      'canvas-drop-zone--active': isActive,
      'canvas-drop-zone--empty': isEmpty && isAcceptingDrag,
      'canvas-drop-zone--full': fullHeight,
    }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.stop="handleDrop"
  >
    <!-- Invisible hit-area strip — stays within the gap between rows. -->
    <div class="cdz-hit-area" />

    <Transition name="cdz-bar">
      <div v-if="isActive" class="cdz-bar">
        <div class="cdz-line" />
        <div class="cdz-pill">
          <svg class="cdz-icon" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span>Insert here</span>
        </div>
        <div class="cdz-line" />
      </div>
    </Transition>

    <!-- subtle visible divider while receptive but not hovered -->
    <div v-if="!isEmpty && isAcceptingDrag && !isActive" class="cdz-ghost-line" />

    <!-- Empty state content when fullHeight and not dragging -->
    <div v-if="fullHeight && !isAcceptingDrag" class="cdz-empty-state">
      <div class="cdz-empty-content">
        <svg class="cdz-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 12h8M12 8v8" />
        </svg>
        <p class="cdz-empty-title">Start Building Your Email</p>
        <p class="cdz-empty-subtitle">Add rows from the "Layout" tab or drag a layout onto the canvas</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useLayoutDrag } from "@/composables/emailBuilder/core/ui/useLayoutDrag";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";

const props = defineProps<{
  insertIndex: number;
  isEmpty?: boolean;
  fullHeight?: boolean;
}>();

const emit = defineEmits<{
  (e: "drop", insertIndex: number): void;
}>();

const { isLayoutDragActive, layoutDragPayload, endLayoutDrag } = useLayoutDrag();

// Accept nested-row drags too (row being moved to canvas top-level)
const { isTopLevelRowDragActive, isRowDragActive } = useEmailBuilder();

const isAcceptingDrag = computed(() =>
  isLayoutDragActive.value ||
  (isRowDragActive.value && !isTopLevelRowDragActive.value)
);

let enterCount = 0;
const isActive = ref(false);

const handleDragEnter = () => {
  if (!isAcceptingDrag.value) return;
  enterCount++;
  isActive.value = true;
};

const handleDragOver = (e: DragEvent) => {
  if (!isAcceptingDrag.value) return;
  if (e.dataTransfer) {
    const allowed = e.dataTransfer.effectAllowed;
    e.dataTransfer.dropEffect = (allowed === "copy" || allowed === "copyMove") ? "copy" : "move";
  }
};

const handleDragLeave = () => {
  if (!isAcceptingDrag.value) return;
  enterCount--;
  if (enterCount <= 0) {
    enterCount = 0;
    isActive.value = false;
  }
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  enterCount = 0;
  isActive.value = false;
  emit("drop", props.insertIndex);
  if (isLayoutDragActive.value) endLayoutDrag();
};
</script>

<style scoped>
/* ── Base zone ─────────────────────────────────────────────── */
.canvas-drop-zone {
  position: relative;
  height: 0;
  margin: 0;
  z-index: 9;
  overflow: visible;
  transition: height 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Full expansion on hover */
.canvas-drop-zone--active {
  height: 52px;
}

/* Empty-canvas variant — fills the whole empty area */
.canvas-drop-zone--empty {
  height: 100%;
  min-height: 200px;
}

/* Full height variant - takes up entire parent container */
.canvas-drop-zone--full {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: auto;
  min-height: 100%;
}

.canvas-drop-zone--empty .cdz-bar {
  inset: 12px;
  justify-content: center;
  border-radius: 12px;
}

/* ── Empty state styles (when fullHeight is true) ── */
.cdz-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: linear-gradient(135deg, #faf9ff 0%, #f5f3ff 100%);
  border: 2px dashed #e0e7ff;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.canvas-drop-zone--full .cdz-empty-state {
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.cdz-empty-content {
  text-align: center;
  padding: 2rem;
}

.cdz-empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  color: #94a3b8;
  stroke-width: 1.5;
}

.cdz-empty-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: #02bb4c;
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}

.cdz-empty-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
  line-height: 1.4;
}

/* ── Invisible hit-area ─────────────────────────────────────
 * Previously this bled 12px into the rows above and below with pointer-events
 * all during a layout drag. That meant dragging a LayoutTab row would hit this
 * strip when the cursor was merely near a column's top/bottom edge, and
 * insert a top-level row instead of a nested row.
 *
 * FIX: Shrink the bleed to a small value (−4px) so the strip only covers the
 * natural visible gap between rows. Columns retain ownership of their rendered
 * area. Combined with CanvasColumn's new z-index: 1 stacking context, the
 * column reliably wins for pointer hits inside its body, while the thin gap
 * between rows still belongs to this drop zone.
 *
 * When fully expanded (canvas-drop-zone--active: 52px tall) the zone's own
 * height covers the hit area naturally, so bleed here is not needed for the
 * "snap into a big target" UX — that comes from the zone's own expanded size.
 */
.cdz-hit-area {
  position: absolute;
  left: 0;
  right: 0;
  top: -4px;
  bottom: -4px;
  z-index: 1;
  /* Only catchable during a layout drag; invisible + inert otherwise */
  pointer-events: none;
}

.canvas-drop-zone--receptive .cdz-hit-area {
  pointer-events: all;
}

/* Hide empty state when dragging */
.canvas-drop-zone--full.canvas-drop-zone--receptive .cdz-empty-state,
.canvas-drop-zone--full.canvas-drop-zone--active .cdz-empty-state {
  opacity: 0.5;
  background: rgba(139, 92, 246, 0.04);
}

/* ── Ghost line (receptive but not hovered) ─────────────────── */
.cdz-ghost-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  background: repeating-linear-gradient(
    90deg,
    rgba(139, 92, 246, 0.25) 0px,
    rgba(139, 92, 246, 0.25) 6px,
    transparent 6px,
    transparent 12px
  );
  border-radius: 2px;
  pointer-events: none;
  animation: ghost-pulse 2s ease-in-out infinite;
}

@keyframes ghost-pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}

/* ── Active bar ─────────────────────────────────────────────── */
.cdz-bar {
  position: absolute;
  inset: 4px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  background: rgba(139, 92, 246, 0.06);
  border-radius: 8px;
  border: 1.5px dashed rgba(139, 92, 246, 0.35);
  pointer-events: none; /* let drag events fall through to the parent drop zone */
}

.cdz-line {
  flex: 1;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(139, 92, 246, 0.6),
    rgba(139, 92, 246, 0.8),
    rgba(139, 92, 246, 0.6),
    transparent
  );
  border-radius: 2px;
  animation: line-expand 0.2s ease forwards;
  transform-origin: center;
}

@keyframes line-expand {
  from { transform: scaleX(0); opacity: 0; }
  to   { transform: scaleX(1); opacity: 1; }
}

.cdz-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #7c3aed;
  letter-spacing: 0.01em;
  white-space: nowrap;
  padding: 5px 14px;
  background: rgba(139, 92, 246, 0.08);
  border: 1.5px solid rgba(139, 92, 246, 0.35);
  border-radius: 100px;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.15);
  animation: pill-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes pill-pop {
  from { transform: scale(0.75); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

.cdz-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

/* ── Transition ─────────────────────────────────────────────── */
.cdz-bar-enter-active { animation: cdz-in 0.15s ease forwards; }
.cdz-bar-leave-active { transition: opacity 0.1s ease; }
.cdz-bar-leave-to     { opacity: 0; }

@keyframes cdz-in {
  from { opacity: 0; transform: scaleY(0.6); }
  to   { opacity: 1; transform: scaleY(1); }
}
</style>