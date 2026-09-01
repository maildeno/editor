<script setup lang="ts">
/**
 * The shell an AI assistant (or any host-supplied side panel) lives in.
 *
 * Deliberately contains no assistant logic — no prompts, no model calls, no
 * diff rendering. The package owns the chrome: where the trigger button
 * sits, how the drawer animates, the open/close state, focus return, and
 * making all of that work identically inside a shadow root. The host owns
 * everything inside the drawer.
 *
 * That split is the point. An AI assistant is product, not editor
 * infrastructure — it needs prompts, an authenticated endpoint, and a diff
 * strategy that belong to whoever is building the product. Shipping one
 * here would mean an MIT package carrying somebody's proprietary logic, and
 * a host wanting different behaviour forking the package to get it. Shipping
 * the shell instead means the host writes their own panel and the editor
 * still handles the fiddly parts (shadow DOM, teleporting, z-index, escape
 * handling) that are genuinely the editor's job.
 *
 * Two ways to fill it, because the package has two consumption paths:
 *   • Vue:    <template #assistant="{ editor }"> — slot presence is the toggle
 *   • init(): assistant: { mount(el, editor), unmount(el) } — framework-free
 * Neither is required; with neither supplied, nothing renders at all.
 */
import { ref, watch, onBeforeUnmount, nextTick } from "vue";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";
import Icon from "@/components/ui/Icon.vue";
import type { EditorWriteApi } from "@/types/assistant";

const props = defineProps<{
  /** Imperative filler for the init()/custom-element path. */
  assistant?: {
    mount: (el: HTMLElement, editor: EditorWriteApi) => void;
    unmount?: (el: HTMLElement) => void;
  };
  /** True when the host passed a #assistant slot. Computed by the parent
   *  rather than read from $slots here, because a parent forwarding its own
   *  slot down always produces a truthy $slots entry in this child even when
   *  the host supplied nothing — which would render an assistant button that
   *  opens an empty drawer. */
  hasSlot?: boolean;
  /** Handed to the host so its panel can drive the canvas. */
  editor: EditorWriteApi;
}>();

const teleportTarget = useTeleportTarget();
const open = ref(false);
const bodyEl = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;
/** The element currently handed to assistant.mount, so unmount gets the same
 *  one back even if the ref has since changed or cleared. */
let mountedEl: HTMLElement | null = null;

function close() {
  open.value = false;
}

function toggle() {
  open.value = !open.value;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.stopPropagation();
    close();
  }
}

// Mount the host's panel on first open rather than at editor startup: the
// assistant is opt-in UI, and running a host's mount callback (which may
// bootstrap a whole second framework) for a drawer the user never opens is
// work nobody asked for. Unmounted on close so the host can tear down
// listeners rather than leaking one panel per open.
watch(open, async (isOpen) => {
  if (isOpen) {
    previouslyFocused = (document.activeElement as HTMLElement | null) ?? null;
    await nextTick();
    if (props.assistant && bodyEl.value && !mountedEl) {
      mountedEl = bodyEl.value;
      try {
        props.assistant.mount(mountedEl, props.editor);
      } catch (e) {
        // A throwing host callback must not take the editor down with it.
        console.error("[maildeno-editor] assistant.mount() threw:", e);
      }
    }
  } else {
    if (props.assistant && mountedEl) {
      try {
        props.assistant.unmount?.(mountedEl);
      } catch (e) {
        console.error("[maildeno-editor] assistant.unmount() threw:", e);
      }
      mountedEl = null;
    }
    previouslyFocused?.focus?.();
    previouslyFocused = null;
  }
});

onBeforeUnmount(() => {
  if (props.assistant && mountedEl) {
    try {
      props.assistant.unmount?.(mountedEl);
    } catch {
      /* already tearing down; nothing useful left to do */
    }
    mountedEl = null;
  }
});

defineExpose({ open: () => (open.value = true), close, toggle });
</script>

<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <!-- Trigger. Bottom-right, clear of the right sidebar's own controls.
         Hidden while open so it doesn't sit on top of the drawer it opened. -->
    <button
      v-show="!open"
      type="button"
      class="md-assistant-fab"
      aria-label="Open assistant"
      :aria-expanded="open"
      @click="toggle"
    >
      <Icon name="sparkles" style="font-size: 16px" />
    </button>

    <Transition name="assistant-slide">
      <aside
        v-if="open"
        class="md-assistant-drawer"
        role="dialog"
        aria-label="Assistant"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <header class="md-assistant-head">
          <span class="md-assistant-title">Assistant</span>
          <button
            type="button"
            class="md-assistant-close"
            aria-label="Close assistant"
            @click="close"
          >
            <Icon name="times" style="font-size: 12px" />
          </button>
        </header>

        <!-- One body element serving both paths: the slot renders into it for
             Vue hosts, and it IS the element handed to assistant.mount() for
             init() hosts. A host supplying both gets the slot, since Vue has
             already rendered it by the time mount() would run. -->
        <div ref="bodyEl" class="md-assistant-body">
          <slot name="assistant" :editor="props.editor" />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.md-assistant-fab {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  /* Above the panels (z-80) and the header (z-100), below dialogs (9998) —
     a modal dialog must still cover this. */
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 9999px;
  border: 1px solid var(--md-border);
  background: var(--md-button-primary-bg, var(--md-primary));
  color: var(--md-button-primary-text, #fff);
  box-shadow: 0 2px 10px rgb(0 0 0 / 18%);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.md-assistant-fab:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgb(0 0 0 / 22%);
}
.md-assistant-fab:focus-visible {
  outline: 2px solid var(--md-primary);
  outline-offset: 2px;
}

.md-assistant-drawer {
  position: fixed;
  top: 4rem; /* clears the header */
  right: 0;
  bottom: 0;
  z-index: 120;
  width: 22rem;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  background: var(--md-surface);
  border-left: 1px solid var(--md-border);
  box-shadow: -8px 0 24px rgb(0 0 0 / 10%);
}

.md-assistant-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid color-mix(in srgb, var(--md-border) 80%, transparent);
}
.md-assistant-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--md-text-subtle);
}
.md-assistant-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.375rem;
  color: var(--md-text-subtle);
  background: transparent;
  border: 0;
  cursor: pointer;
}
.md-assistant-close:hover {
  color: var(--md-text-muted);
  background: var(--md-surface-muted);
}

/* The only scroll container, matching the side panels' single-overflow rule. */
.md-assistant-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.75rem;
}
.md-assistant-body::-webkit-scrollbar {
  width: 6px;
}
.md-assistant-body::-webkit-scrollbar-track {
  background: transparent;
}
.md-assistant-body::-webkit-scrollbar-thumb {
  background: var(--md-border-strong);
  border-radius: 9999px;
}

.assistant-slide-enter-active,
.assistant-slide-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.assistant-slide-enter-from,
.assistant-slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
