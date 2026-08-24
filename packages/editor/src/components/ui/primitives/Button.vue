<script setup lang="ts">
/** Button, with severity styling and a loading state. */
import Icon from "@/components/ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    label?: string;
    severity?: "primary" | "secondary" | "danger" | "success";
    disabled?: boolean;
    loading?: boolean;
  }>(),
  { severity: "primary", disabled: false, loading: false },
);
</script>

<template>
  <button
    type="button"
    class="md-btn"
    :class="`md-btn--${props.severity}`"
    :disabled="props.disabled || props.loading"
  >
    <Icon v-if="props.loading" name="spinner" class="animate-spin" />
    <slot>{{ props.label }}</slot>
  </button>
</template>

<style scoped>
.md-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  font-size: 13px;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}
.md-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.md-btn--primary {
  background: var(--md-button-primary-bg);
  color: var(--md-button-primary-text);
}
.md-btn--primary:not(:disabled):hover { background: var(--md-button-primary-hover-bg); }
.md-btn--secondary {
  background: var(--md-button-secondary-bg);
  color: var(--md-button-secondary-text);
  border-color: var(--md-border);
}
.md-btn--secondary:not(:disabled):hover { background: var(--md-button-secondary-hover-bg); }
.md-btn--danger { background: var(--md-danger); color: var(--md-on-danger); }
.md-btn--danger:not(:disabled):hover { filter: brightness(0.94); }
.md-btn--success { background: var(--md-success); color: var(--md-surface); }
</style>
