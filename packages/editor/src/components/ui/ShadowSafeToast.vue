<script setup lang="ts">
/**
 * Renders toasts queued via useToast(). Mounted once at the EmailEditor
 * root.
 *
 * Deliberately renders in place with no Teleport at all — fixed
 * positioning handles placement without needing to escape anywhere. That
 * is what makes it work identically in light DOM and inside a shadow
 * root. A component that portals to document.body cannot work here,
 * because that lands outside the shadow boundary where none of this
 * package's CSS applies.
 */
import { toasts, removeToast } from "@/composables/ui/useToast";
import Icon from "./Icon.vue";

const SEVERITY_CLASS: Record<string, string> = {
  success: "md-toast--success",
  info: "md-toast--info",
  warn: "md-toast--warn",
  error: "md-toast--error",
};
const SEVERITY_ICON: Record<string, string> = {
  success: "check-circle",
  info: "info-circle",
  warn: "exclamation-triangle",
  error: "exclamation-triangle",
};
</script>

<template>
  <div class="md-toast__region" role="status" aria-live="polite">
    <TransitionGroup name="md-toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="md-toast"
        :class="SEVERITY_CLASS[t.severity ?? 'info'] ?? 'md-toast--info'"
      >
        <Icon
          :name="SEVERITY_ICON[t.severity ?? 'info'] ?? 'info-circle'"
          class="md-toast__icon"
        />
        <div class="md-toast__body">
          <div v-if="t.summary" class="md-toast__summary">{{ t.summary }}</div>
          <div v-if="t.detail" class="md-toast__detail">{{ t.detail }}</div>
        </div>
        <button
          type="button"
          class="md-toast__close"
          aria-label="Dismiss"
          @click="removeToast(t.id)"
        >
          <Icon name="times" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.md-toast__region {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}
.md-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  min-width: 280px;
  max-width: 380px;
  padding: 0.75rem 0.875rem;
  font-size: 13px;
  border: 1px solid;
  border-radius: 0.75rem;
  box-shadow: 0 8px 30px rgb(0 0 0 / 0.12);
}
.md-toast__icon {
  font-size: 15px;
  flex-shrink: 0;
  margin-top: 0.0625rem;
}
.md-toast__body {
  flex: 1;
  min-width: 0;
}
.md-toast__summary {
  font-weight: 500;
}
.md-toast__detail {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 0.125rem;
}
.md-toast__close {
  flex-shrink: 0;
  opacity: 0.5;
  background: none;
  border: 0;
  cursor: pointer;
  color: inherit;
}
.md-toast__close:hover {
  opacity: 1;
}
.md-toast--success {
  background: var(--md-success-bg);
  border-color: var(--md-success-border);
  color: var(--md-success-fg);
}
.md-toast--info {
  background: var(--md-info-bg);
  border-color: var(--md-info-border);
  color: var(--md-info-fg);
}
.md-toast--warn {
  background: var(--md-surface);
  border-color: var(--md-warning-border);
  color: var(--md-warning-fg);
}
.md-toast--error {
  background: var(--md-danger-bg);
  border-color: var(--md-danger-border);
  color: var(--md-danger-fg);
}
.md-toast-enter-active,
.md-toast-leave-active {
  transition: all 0.2s ease;
}
.md-toast-enter-from,
.md-toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
