<template>
  <div>
    <div class="flex items-center justify-between mb-1">
      <label class="flex items-center gap-1.5 text-sm font-medium text-[var(--md-text-muted)]">
        {{ label }}
        <OverrideBadge :show="isOverridden" />
      </label>
      <button
        v-if="isOverridden"
        @click="$emit('reset')"
        class="text-xs text-[var(--md-selection-fg)] hover:opacity-80"
      >
        ↩ Reset
      </button>
    </div>
    <div class="flex items-center border border-[var(--md-border-strong)] hover:border-[var(--md-text-subtle)] rounded">
      <button
        @click="$emit('update:modelValue', clamp(modelValue - step))"
        type="button"
        class="px-3 py-1.5 hover:bg-[var(--md-surface-hover)]"
      >
        <Icon name="minus" class="text-[var(--md-text-subtle)]" style="font-size: 13px" />
      </button>
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', parse($event.target.value))"
        type="number"
        :step="step"
        :min="min"
        :max="max"
        class="flex-1 w-6 px-2 py-1.5 text-sm text-[var(--md-text)] border-[var(--md-border-strong)] border-l border-r text-center focus:outline-none"
      />
      <button
        @click="$emit('update:modelValue', clamp(modelValue + step))"
        type="button"
        class="px-3 py-1.5 hover:bg-[var(--md-selection-bg)]"
      >
        <Icon name="plus" class="text-[var(--md-text-subtle)]" style="font-size: 13px" />
      </button>
    </div>
  </div>
</template>

<script setup>
import Icon from "@/components/ui/Icon.vue";
import OverrideBadge from "../shared/OverrideBadge.vue"

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, default: 0 },
  step: { type: Number, default: 1 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: Infinity },
  isOverridden: { type: Boolean, default: false },
})

defineEmits(['update:modelValue', 'reset'])

const parse = (v) => {
  const n = props.step === 1 ? parseInt(v, 10) : parseFloat(v)
  return isNaN(n) ? props.min : n
}

const clamp = (v) => {
  const rounded = props.step === 1 ? Math.round(v) : +v.toFixed(1)
  return Math.min(props.max, Math.max(props.min, rounded))
}
</script>