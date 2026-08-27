<template>
  <Transition name="drop-bar">
    <div
      v-if="isActive"
      class="row-drop-bar"
      :class="`row-drop-bar--${position}`"
      :style="{ '--drop-color': color }"
    >
      <div class="row-drop-bar-line" />
      <div class="row-drop-bar-label">
        <svg class="row-drop-bar-icon" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        Drop here
      </div>
      <div class="row-drop-bar-line" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    isActive: boolean;
    position: "before" | "after";
    color?: string;
  }>(),
  {
    // Row/spacer default — matches the row-selection accent. Any valid CSS
    // colour works here (hex or var()): the alpha tints below are derived
    // with color-mix() rather than hex-string concatenation, which is what
    // makes a var(--md-*) reference work exactly like a literal hex value.
    color: "var(--md-row-selection)",
  },
);
</script>

<style scoped>
.row-drop-bar {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: color-mix(in srgb, var(--drop-color) 5%, transparent);
  border-radius: 6px;
  z-index: 20;
  pointer-events: none;
}

.row-drop-bar--before {
  top: -14px;
}

.row-drop-bar--after {
  bottom: -14px;
}

.row-drop-bar-line {
  flex: 1;
  height: 2px;
  background: color-mix(in srgb, var(--drop-color) 50%, transparent);
  border-radius: 2px;
  /* animation: bar-expand 0.18s ease forwards; */
}

/* @keyframes bar-expand {
  from {
    transform: scaleX(0);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
} */

.row-drop-bar-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--drop-color);
  white-space: nowrap;
  padding: 4px 12px;
  background: color-mix(in srgb, var(--drop-color) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--drop-color) 30%, transparent);
  border-radius: 24px;
  /* animation: label-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; */
}

/* @keyframes label-pop {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
} */

.row-drop-bar-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

/* Transition */
/* .drop-bar-enter-active {
  animation: bar-in 0.15s ease forwards;
}
.drop-bar-leave-active {
  transition: opacity 0.12s ease;
}
.drop-bar-leave-to {
  opacity: 0;
} */

/* @keyframes bar-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
} */
</style>