<!-- PropertyNumberSlider.vue -->
<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600">
        {{ label }}
        <OverrideBadge :show="isOverridden" />
      </label>
      <button
        v-if="isOverridden"
        @click="$emit('reset')"
        class="text-[11px] text-green-500 hover:text-green-700 transition-colors"
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
        class="flex-1 h-[3px] bg-gray-200 rounded-full appearance-none cursor-pointer accent-green-500 focus:outline-none"
      />

      <!-- Number input + chevrons -->
      <div class="flex items-center border border-gray-200/80 rounded-md bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <input
          :value="modelValue"
          @input="handleInput"
          @blur="clampValue"
          type="text"
          :inputmode="step === 1 ? 'numeric' : 'decimal'"
          class="w-10 py-1 text-[12px] text-center border-0 focus:outline-none text-gray-700 bg-transparent"
        />
        <div class="flex flex-col border-l border-gray-200/80">
          <button
            @click="increment"
            type="button"
            class="w-4 h-[13px] flex items-center justify-center hover:bg-gray-50 transition-colors focus:outline-none"
            :class="{ 'opacity-25 cursor-not-allowed': modelValue >= max }"
            :disabled="modelValue >= max"
          >
            <svg class="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m18 15-6-6-6 6"/>
            </svg>
          </button>
          <div class="h-px bg-gray-200/80" />
          <button
            @click="decrement"
            type="button"
            class="w-4 h-[13px] flex items-center justify-center hover:bg-gray-50 transition-colors focus:outline-none"
            :class="{ 'opacity-25 cursor-not-allowed': modelValue <= min }"
            :disabled="modelValue <= min"
          >
            <svg class="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      <span v-if="unit" class="text-[11px] text-gray-600 w-4 shrink-0">{{ unit }}</span>
    </div>
  </div>
</template>

<script setup>
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

const handleInput = (e) => {
  const val = parseFloat(e.target.value);
  if (!isNaN(val)) emit("update:modelValue", val);
};

const clampValue = () => {
  let val = props.modelValue;
  if (val < props.min) val = props.min;
  if (val > props.max) val = props.max;
  if (props.step < 1) val = parseFloat((Math.round(val / props.step) * props.step).toFixed(1));
  emit("update:modelValue", val);
};

const handleSlider = (e) => {
  let val = parseFloat(e.target.value);
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