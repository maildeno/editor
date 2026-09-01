<!-- PropertyNumberSlider.vue -->
<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <label
        class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
      >
        {{ label }}
        <OverrideBadge :show="isOverridden" />
      </label>
      <button
        v-if="isOverridden"
        @click="$emit('reset')"
        class="text-[11px] text-(--md-selection-fg) hover:opacity-80 transition-colors"
      >
        ↩ Reset
      </button>
    </div>

    <div class="flex items-center gap-2">
      <!-- Slider -->
      <input
        :value="modelValue"
        @input="handleSlider"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        class="flex-1 h-0.75 bg-(--md-border) rounded-full appearance-none cursor-pointer accent-(--md-selection) focus:outline-none"
      />

      <!-- Number input + chevrons -->
      <div
        class="flex items-center border border-(--md-border) rounded-md bg-(--md-surface) overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <input
          :value="modelValue"
          @input="handleInput"
          @blur="clampValue"
          type="text"
          :inputmode="step === 1 ? 'numeric' : 'decimal'"
          class="w-10 py-1 text-[12px] text-center border-0 focus:outline-none text-(--md-text-muted) bg-transparent"
        />
        <div class="flex flex-col border-l border-(--md-border)">
          <button
            @click="increment"
            type="button"
            class="w-4 h-3.25 flex items-center justify-center hover:bg-(--md-surface-hover) transition-colors focus:outline-none"
            :class="{ 'opacity-25 cursor-not-allowed': modelValue >= max }"
            :disabled="modelValue >= max"
          >
            <svg
              class="w-2 h-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          <div class="h-px bg-(--md-border)" />
          <button
            @click="decrement"
            type="button"
            class="w-4 h-3.25 flex items-center justify-center hover:bg-(--md-surface-hover) transition-colors focus:outline-none"
            :class="{ 'opacity-25 cursor-not-allowed': modelValue <= min }"
            :disabled="modelValue <= min"
          >
            <svg
              class="w-2 h-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <span
        v-if="unit"
        class="text-[11px] text-(--md-text-muted) w-4 shrink-0"
        >{{ unit }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import OverrideBadge from "../shared/OverrideBadge.vue";

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, default: 0 },
  step: { type: Number, default: 1 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  unit: { type: String, default: "" },
  isOverridden: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "reset"]);

const handleInput = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (!isNaN(val)) emit("update:modelValue", val);
};

const clampValue = () => {
  let val = props.modelValue;
  if (val < props.min) val = props.min;
  if (val > props.max) val = props.max;
  if (props.step < 1)
    val = parseFloat((Math.round(val / props.step) * props.step).toFixed(1));
  emit("update:modelValue", val);
};

const handleSlider = (e: Event) => {
  let val = parseFloat((e.target as HTMLInputElement).value);
  if (props.step < 1) val = parseFloat(val.toFixed(1));
  emit("update:modelValue", val);
};

const increment = () => {
  if (props.modelValue >= props.max) return;
  let v = props.modelValue + props.step;
  if (v > props.max) v = props.max;
  if (props.step < 1) v = parseFloat(v.toFixed(1));
  emit("update:modelValue", v);
};

const decrement = () => {
  if (props.modelValue <= props.min) return;
  let v = props.modelValue - props.step;
  if (v < props.min) v = props.min;
  if (props.step < 1) v = parseFloat(v.toFixed(1));
  emit("update:modelValue", v);
};
</script>
