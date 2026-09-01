<template>
  <div
    class="flex items-center justify-between p-3 bg-(--md-surface-hover) rounded-lg"
  >
    <div class="flex-1">
      <label class="block text-xs font-medium text-(--md-text-muted)">{{
        label
      }}</label>
      <p v-if="description" class="text-xs text-(--md-text-subtle) mt-1">
        {{ description }}
      </p>
    </div>
    <button
      @click="$emit('update:modelValue', !modelValue)"
      :class="[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ml-3',
        modelValue ? activeColor : 'bg-(--md-border-strong)',
      ]"
    >
      <span
        :class="[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-(--md-surface) transition-transform',
          modelValue ? 'translate-x-5' : 'translate-x-0.75',
        ]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps({
  label: { type: String, required: true },
  description: { type: String, default: null },
  modelValue: { type: Boolean, default: false },
  activeColor: { type: String, default: "bg-[var(--md-selection)]" },
});

defineEmits(["update:modelValue"]);
</script>
