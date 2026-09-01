<template>
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <label
        class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
      >
        {{ label }}
        <OverrideBadge :show="isOverridden" />
      </label>
      <button
        v-if="isOverridden"
        @click="$emit('reset')"
        class="text-xs text-(--md-selection-fg) hover:opacity-80"
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

<script setup lang="ts">
import type { PropType } from "vue";
import Select from "@/components/ui/primitives/Select.vue";
import OverrideBadge from "../shared/OverrideBadge.vue";

defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, required: true },
  // `string | null`, matching the Select primitive this wraps. null is a
  // meaningful value there — it means "options are plain strings, don't look
  // up a key on them" — and six panels pass it deliberately for the font
  // list. Vue only substitutes a default for undefined, so an explicit null
  // still reaches Select, which is exactly what those callers want.
  optionLabel: { type: String as PropType<string | null>, default: "label" },
  optionValue: { type: String as PropType<string | null>, default: "value" },
  placeholder: { type: String, default: undefined },
  isOverridden: { type: Boolean, default: false },
});

defineEmits(["update:modelValue", "reset"]);
</script>
