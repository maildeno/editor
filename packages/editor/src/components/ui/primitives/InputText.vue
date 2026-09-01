<script setup lang="ts">
/**
 * Text input.
 *
 * defineExpose is deliberate: several call sites do
 * `inputRef.value?.focus()` / `.select()` directly on the component ref,
 * so those methods are exposed explicitly as a real, typed contract
 * rather than relying on internals.
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    invalid?: boolean;
    disabled?: boolean;
  }>(),
  { modelValue: "", invalid: false, disabled: false },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

import { ref } from "vue";
const el = ref<HTMLInputElement | null>(null);
defineExpose({
  focus: () => el.value?.focus(),
  select: () => el.value?.select(),
  blur: () => el.value?.blur(),
  get input() {
    return el.value;
  },
});
</script>

<template>
  <input
    ref="el"
    :value="props.modelValue ?? ''"
    :disabled="props.disabled"
    :aria-invalid="props.invalid || undefined"
    class="md-input"
    :class="{ 'md-input--invalid': props.invalid }"
    @input="
      emit('update:modelValue', ($event.target as HTMLInputElement).value)
    "
  />
</template>

<style scoped>
.md-input {
  width: 100%;
  padding: 0.325rem 0.625rem;
  font-size: 13px;
  line-height: 1.25rem;
  color: var(--md-text);
  background: var(--md-surface);
  border: 1px solid var(--md-border);
  border-radius: 0.375rem;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.md-input::placeholder {
  color: var(--md-text-subtle);
}
.md-input:focus {
  border-color: var(--md-primary);
}
.md-input:disabled {
  background: var(--md-surface-hover);
  color: var(--md-text-subtle);
  cursor: not-allowed;
}
.md-input--invalid {
  border-color: var(--md-danger);
}
.md-input--invalid:focus {
  border-color: var(--md-danger);
  box-shadow: 0 0 0 1px var(--md-danger);
}
</style>
