<script setup lang="ts">
/** Inline status message — info, success, warning or error. */
import { ref } from "vue";
import Icon from "@/components/ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    severity?: "info" | "success" | "warn" | "error";
    closable?: boolean;
  }>(),
  { severity: "info", closable: false },
);
const visible = ref(true);
const ICONS = {
  info: "info-circle",
  success: "check-circle",
  warn: "exclamation-triangle",
  error: "exclamation-triangle",
} as const;
</script>

<template>
  <div
    v-if="visible"
    class="md-msg"
    :class="`md-msg--${props.severity}`"
    role="status"
  >
    <Icon :name="ICONS[props.severity]" class="md-msg__icon" />
    <div class="md-msg__body"><slot /></div>
    <button
      v-if="props.closable"
      type="button"
      class="md-msg__close"
      aria-label="Close"
      @click="visible = false"
    >
      <Icon name="times" />
    </button>
  </div>
</template>

<style scoped>
.md-msg {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  font-size: 13px;
  border: 1px solid;
  border-radius: 0.5rem;
}
.md-msg__icon {
  margin-top: 0.125rem;
  flex-shrink: 0;
  font-size: 14px;
}
.md-msg__body {
  flex: 1;
  min-width: 0;
}
.md-msg__close {
  opacity: 0.6;
  cursor: pointer;
  background: none;
  border: 0;
}
.md-msg__close:hover {
  opacity: 1;
}
.md-msg--info {
  background: var(--md-info-bg);
  border-color: var(--md-info-border);
  color: var(--md-info-fg);
}
.md-msg--success {
  background: var(--md-success-bg);
  border-color: var(--md-success-border);
  color: var(--md-success-fg);
}
.md-msg--warn {
  background: var(--md-surface) beb;
  border-color: var(--md-warning-border);
  color: var(--md-warning-fg);
}
.md-msg--error {
  background: var(--md-danger-bg);
  border-color: var(--md-danger-border);
  color: var(--md-danger-fg);
}
</style>
