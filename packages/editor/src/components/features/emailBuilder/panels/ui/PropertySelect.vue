<template>
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <label
        class="flex items-center gap-1.5 text-xs font-medium text-gray-600"
      >
        {{ label }}
        <OverrideBadge :show="isOverridden" />
      </label>
      <button
        v-if="isOverridden"
        @click="$emit('reset')"
        class="text-xs text-green-500 hover:text-green-700"
      >
        ↩ Reset
      </button>
    </div>
    <Select
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      :options="options"
      :option-label="optionLabel"
      :option-value="optionValue"
      :placeholder="placeholder"
      filter
      :filterPlaceholder="placeholder"
      class="w-full text-sm capitalize"
    />
  </div>
</template>

<script setup>
import Select from "@/components/ui/primitives/Select.vue";
import OverrideBadge from "../shared/OverrideBadge.vue";

defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, required: true },
  optionLabel: { type: String, default: "label" },
  optionValue: { type: String, default: "value" },
  placeholder: { type: String, default: undefined },
  isOverridden: { type: Boolean, default: false },
});

defineEmits(["update:modelValue", "reset"]);
</script>
