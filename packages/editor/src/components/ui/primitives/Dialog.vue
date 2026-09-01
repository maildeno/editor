<script setup lang="ts">
/**
 * Modal dialog. Custom rather than Reka UI, for a verified reason.
 *
 * Reka's Dialog is not shadow-DOM safe. Two concrete problems, both read
 * from its shipped source:
 *
 *  1. Its accessibility warning does `document.getElementById(titleId)`
 *     (Dialog/utils.js). That cannot see inside a shadow root, so it
 *     warned about a missing DialogTitle on every open even though the
 *     title was present and correctly wired — a false positive that was
 *     impossible to silence from the outside.
 *
 *  2. More importantly, its focus trap relies on `document.activeElement`,
 *     which returns the shadow *host* rather than the focused element.
 *     That one is functional, not cosmetic: focus trapping and focus
 *     restoration cannot work correctly inside a shadow root. Reka uses
 *     `composedPath()` nowhere in its entire distribution.
 *
 * Everything here is therefore shadow-safe by construction: dismissal
 * uses composedPath(), focus logic uses deepActiveElement(), and the
 * dialog teleports to the editor's own in-shadow-root target.
 *
 * Implemented explicitly because dropping the library means dropping what
 * it provided: focus trap with Tab cycling, focus restoration on close,
 * Escape to dismiss, overlay click-through dismissal, body scroll lock,
 * and role/aria-modal/aria-labelledby/aria-describedby wiring.
 */
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import Icon from "@/components/ui/Icon.vue";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";
import { deepActiveElement } from "@/utils/shadowDom";

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    header?: string;
    closable?: boolean;
    /** Accepted for API compatibility; not implemented. */
    draggable?: boolean;
    /** Announced by screen readers when there is no visible header. */
    ariaLabel?: string;
    /** Accepted for API compatibility; this dialog is always modal. */
    modal?: boolean;
  }>(),
  { visible: false, closable: true, draggable: false },
);
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

// The template root is a <Teleport>, which Vue cannot apply fallthrough
// attributes to — so class/style passed by callers (several set a custom
// width, e.g. :style="{ width: '480px' }") would be silently dropped with
// only a console warning. Binding $attrs explicitly onto the dialog box
// below puts them where they were always meant to go.
defineOptions({ inheritAttrs: false });

const teleportTarget = useTeleportTarget();
const contentEl = ref<HTMLElement | null>(null);
const uid = Math.random().toString(36).slice(2, 9);
const titleId = `md-dlg-title-${uid}`;
const descId = `md-dlg-desc-${uid}`;

/** Restored when the dialog closes, so focus returns where the user left it. */
let previouslyFocused: HTMLElement | null = null;

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusables(): HTMLElement[] {
  return contentEl.value
    ? Array.from(contentEl.value.querySelectorAll<HTMLElement>(FOCUSABLE))
    : [];
}

function close() {
  emit("update:visible", false);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    close();
    return;
  }
  if (e.key !== "Tab") return;

  // Focus trap. deepActiveElement(), not document.activeElement — inside a
  // shadow root the latter returns the host, so first/last comparisons
  // would never match and Tab would escape the dialog.
  const items = focusables();
  if (!items.length) {
    e.preventDefault();
    return;
  }
  const active = deepActiveElement();
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/** composedPath(), never event.target — the target is retargeted to the host. */
function onOverlayPointerDown(e: PointerEvent) {
  if (!props.closable) return;
  if (contentEl.value && e.composedPath().includes(contentEl.value)) return;
  close();
}

let scrollLocked = false;
function lockScroll() {
  if (scrollLocked || typeof document === "undefined") return;
  scrollLocked = true;
  document.body.style.overflow = "hidden";
}
function unlockScroll() {
  if (!scrollLocked) return;
  scrollLocked = false;
  document.body.style.overflow = "";
}

watch(
  () => props.visible,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = deepActiveElement() as HTMLElement | null;
      lockScroll();
      // Two ticks, not one: the content renders through a Teleport, so
      // contentEl isn't populated after the first flush and the focus
      // would land nowhere — leaving the trap with no starting point and
      // the dialog unannounced.
      await nextTick();
      await nextTick();
      // Focus the first control, falling back to the dialog itself so the
      // trap has somewhere to start even with no focusable children.
      (focusables()[0] ?? contentEl.value)?.focus();
    } else {
      unlockScroll();
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    }
  },
);

onBeforeUnmount(unlockScroll);
</script>

<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      v-if="props.visible"
      class="md-dialog__overlay"
      @pointerdown="onOverlayPointerDown"
    >
      <div
        ref="contentEl"
        v-bind="$attrs"
        class="md-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="descId"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <div
          v-if="props.header || props.closable"
          class="md-dialog__header"
          :class="{ 'md-dialog__header--noTitle': !props.header }"
        >
          <h2 v-if="props.header" :id="titleId" class="md-dialog__title">
            {{ props.header }}
          </h2>
          <button
            v-if="props.closable"
            type="button"
            class="md-dialog__close"
            aria-label="Close"
            @click="close"
          >
            <Icon name="times" />
          </button>
        </div>

        <!-- A title must always exist for aria-labelledby to resolve; when
             there is no visible header this carries it off-screen instead
             of forcing a heading onto dialogs that don't want one. -->
        <h2 v-if="!props.header" :id="titleId" class="md-dialog__srOnly">
          {{ props.ariaLabel || "Dialog" }}
        </h2>
        <p :id="descId" class="md-dialog__srOnly">
          {{ props.header || props.ariaLabel || "Dialog" }}
        </p>

        <div class="md-dialog__body"><slot /></div>
        <div v-if="$slots.footer" class="md-dialog__footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.md-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.4);
}
.md-dialog {
  width: 420px;
  max-width: 100%;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  background: var(--md-surface);
  border-radius: 0.75rem;
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.25);
  outline: none;
}
.md-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.125rem 1.25rem 0.5rem;
}
.md-dialog__header--noTitle {
  justify-content: flex-end;
}
.md-dialog__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--md-text);
  margin: 0;
}
.md-dialog__close {
  display: inline-flex;
  padding: 0.25rem;
  color: var(--md-text-subtle);
  background: none;
  border: 0;
  border-radius: 0.25rem;
  cursor: pointer;
}
.md-dialog__close:hover {
  color: var(--md-text);
  background: var(--md-surface-muted);
}
.md-dialog__body {
  padding: 0.5rem 1.25rem 1.25rem;
  overflow-y: auto;
  font-size: 14px;
  color: var(--md-text);
}
.md-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0 1.25rem 1.25rem;
}
.md-dialog__srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
