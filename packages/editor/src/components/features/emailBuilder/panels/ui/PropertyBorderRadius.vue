<!-- PropertyBorderRadius.vue -->
<!--
  The Border Radius control. Closed, it is the slider the panels have always had:
  one radius for all four corners. The corners button opens four boxes, one per
  corner, for a shape such as a card with a flat bottom or a tab.

  It edits one whole radius and emits the whole value (see core/borderRadius.ts):
  a number while the four corners are equal, and an object with all four once
  they differ. A plain number is what a template saved before 0.4.22 holds, so
  a radius that is left alone saves exactly as it did.

  Four different corners cannot be folded into one slider without losing values,
  so the corners button is switched off while they differ, and a link under the
  boxes sets all four to the top left when that is what you want.

  `isOverridden` is for the Mobile tab: the radius is then an override of the
  desktop one, and "Reset" goes back to it.
-->
<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <label
        class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
      >
        {{ label }}
        <OverrideBadge :show="isOverridden" />
      </label>
      <div class="flex items-center gap-2">
        <button
          v-if="isOverridden"
          type="button"
          @click="$emit('reset')"
          class="text-[11px] text-(--md-selection-fg) hover:opacity-80 transition-colors"
        >
          ↩ Reset
        </button>

        <!-- The negative margin keeps the row as tall as the slider's own header -->
        <div class="relative group/btn -my-0.5">
          <button
            type="button"
            :disabled="mixed"
            :aria-pressed="showCorners"
            :aria-label="toggleLabel"
            @click="toggle"
            class="w-5 h-5 flex items-center justify-center rounded-md transition-colors focus:outline-none"
            :class="
              showCorners
                ? 'bg-(--md-selection-bg) text-(--md-selection-fg)'
                : 'text-(--md-text-subtle) hover:text-(--md-selection) hover:bg-(--md-surface-hover)'
            "
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M2.5 6V5A2.5 2.5 0 0 1 5 2.5h1" />
              <path d="M10 2.5h1A2.5 2.5 0 0 1 13.5 5v1" />
              <path d="M13.5 10v1a2.5 2.5 0 0 1-2.5 2.5h-1" />
              <path d="M6 13.5H5A2.5 2.5 0 0 1 2.5 11v-1" />
            </svg>
          </button>

          <div
            class="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:right-1.5 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg)"
          >
            {{ toggleLabel }}
          </div>
        </div>
      </div>
    </div>

    <!-- One radius for all four corners -->
    <PropertyNumberSlider
      v-if="!showCorners"
      hide-header
      :label="label"
      :model-value="corners.topLeft"
      :min="limits.min"
      :max="limits.max"
      :step="1"
      unit="px"
      @update:model-value="setAll"
    />

    <!-- One radius per corner, laid out like the corners of the box -->
    <template v-else>
      <div class="grid grid-cols-2 gap-2" role="group" :aria-label="label">
        <label
          v-for="corner in layout"
          :key="corner.id"
          class="flex items-center gap-1.5 border border-(--md-border) rounded-md bg-(--md-surface) pl-1.5 pr-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-(--md-selection) transition-colors"
        >
          <svg
            class="w-3 h-3 shrink-0 text-(--md-text-subtle)"
            :style="{ transform: `rotate(${corner.turn}deg)` }"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M1.5 10.5V6A4.5 4.5 0 0 1 6 1.5h4.5" />
          </svg>
          <input
            :value="corners[corner.id]"
            type="text"
            inputmode="numeric"
            :aria-label="`${corner.name} corner radius in pixels`"
            class="min-w-0 flex-1 py-1 text-[12px] text-center border-0 focus:outline-none text-(--md-text-muted) bg-transparent"
            @input="onInput(corner.id, $event)"
            @blur="onBlur(corner.id, $event)"
            @keydown="onKey(corner.id, $event)"
          />
          <span class="text-[11px] text-(--md-text-muted) shrink-0">px</span>
        </label>
      </div>

      <p v-if="mixed" class="text-[11px] leading-snug text-(--md-text-subtle)">
        The corners differ.
        <button
          type="button"
          class="text-(--md-selection-fg) hover:underline focus:outline-none"
          @click="matchTopLeft"
        >
          Use the top left for all four
        </button>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { PropType } from "vue";
import {
  BORDER_RADIUS_LIMITS,
  isUniformBorderRadius,
  normalizeBorderRadius,
  uniformBorderRadius,
  withBorderRadiusCorner,
} from "@/composables/emailBuilder/core/borderRadius";
import type {
  BorderRadius,
  BorderRadiusCorner,
} from "@/composables/emailBuilder/core/borderRadius";
import OverrideBadge from "../shared/OverrideBadge.vue";
import PropertyNumberSlider from "./PropertyNumberSlider.vue";

const props = defineProps({
  label: { type: String, default: "Border Radius (px)" },
  /** A number, or one per corner. Anything else is read as 0. */
  modelValue: { type: [Number, Object] as PropType<unknown>, default: 0 },
  /** Mobile tab: the radius is an override and can be reset. */
  isOverridden: { type: Boolean, default: false },
});

const emit = defineEmits<{
  "update:modelValue": [value: BorderRadius];
  reset: [];
}>();

const limits = BORDER_RADIUS_LIMITS;

/** The boxes in reading order, each with the turn that points its glyph at it. */
const layout: { id: BorderRadiusCorner; name: string; turn: number }[] = [
  { id: "topLeft", name: "Top left", turn: 0 },
  { id: "topRight", name: "Top right", turn: 90 },
  { id: "bottomLeft", name: "Bottom left", turn: 270 },
  { id: "bottomRight", name: "Bottom right", turn: 180 },
];

const corners = computed(() => normalizeBorderRadius(props.modelValue));
const mixed = computed(() => !isUniformBorderRadius(props.modelValue));

// Open for as long as the corners differ, and after you open it or edit a
// corner. An edit that makes the four equal would otherwise close the boxes
// under your cursor.
const expanded = ref(false);
const showCorners = computed(() => expanded.value || mixed.value);

const toggleLabel = computed(() =>
  mixed.value
    ? "Corners differ"
    : showCorners.value
      ? "Same radius on all corners"
      : "Individual corners",
);

const toggle = () => {
  if (!mixed.value) expanded.value = !expanded.value;
};

const clamp = (n: number): number =>
  Math.min(Math.max(n, limits.min), limits.max);

const setAll = (n: number) => emit("update:modelValue", uniformBorderRadius(n));

const matchTopLeft = () =>
  emit("update:modelValue", uniformBorderRadius(corners.value.topLeft));

const commit = (corner: BorderRadiusCorner, value: number) => {
  expanded.value = true;
  const next = clamp(value);
  if (next === corners.value[corner]) return;
  emit(
    "update:modelValue",
    withBorderRadiusCorner(props.modelValue, corner, next),
  );
};

const onInput = (corner: BorderRadiusCorner, e: Event) => {
  const n = parseFloat((e.target as HTMLInputElement).value);
  if (Number.isFinite(n)) commit(corner, n);
};

// Typing has already updated the model one keystroke at a time. What is left in
// the box can still differ from it: "" and "abc" never became a number, and 150
// was held at 100 with nothing to re-render. Put the model's number back.
const onBlur = (corner: BorderRadiusCorner, e: FocusEvent) => {
  (e.target as HTMLInputElement).value = String(corners.value[corner]);
};

const onKey = (corner: BorderRadiusCorner, e: KeyboardEvent) => {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault();
  const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
  commit(corner, corners.value[corner] + step);
};
</script>
