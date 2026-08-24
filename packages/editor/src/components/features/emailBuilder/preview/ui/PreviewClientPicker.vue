<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <!-- Single wrapper for both overlay and drawer. Mount/unmount together. -->
    <div
      v-if="open"
      class="preview-picker fixed inset-0 z-[9000]"
      role="dialog"
      aria-modal="true"
      aria-label="Add email client"
    >
      <!-- Overlay: closes on click, but the drawer itself sits ABOVE it
           and stops propagation, so clicks inside the drawer don't close
           the modal. -->
      <Transition name="picker-overlay" appear>
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="$emit('update:open', false)"
        />
      </Transition>

      <!-- Drawer: positioned ABOVE overlay via z-index inside the wrapper. -->
      <Transition name="picker-drawer" appear>
        <div
          class="absolute top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col"
          @click.stop
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-gray-200"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-8 h-8 rounded-md bg-gray-900 flex items-center justify-center"
                aria-hidden="true"
              >
                <svg
                  class="w-3.5 h-3.5 text-white"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M7 2.5v9M2.5 7h9"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <div>
                <h3
                  class="text-[14px] font-semibold text-gray-900 leading-tight"
                >
                  Add email client
                </h3>
                <p class="text-[11px] text-gray-500 leading-tight mt-0.5">
                  {{ availableClients.length }} available
                </p>
              </div>
            </div>
            <button
              type="button"
              class="w-8 h-8 rounded-md hover:bg-gray-100 text-gray-500 flex items-center justify-center transition"
              aria-label="Close"
              @click="$emit('update:open', false)"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>

          <!-- Search -->
          <div class="px-4 py-3 border-b border-gray-100">
            <div class="relative">
              <svg
                class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                viewBox="0 0 14 14"
                fill="none"
              >
                <circle
                  cx="6"
                  cy="6"
                  r="4.5"
                  stroke="currentColor"
                  stroke-width="1.3"
                />
                <path
                  d="M9.5 9.5L12 12"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                />
              </svg>
              <input
                ref="searchRef"
                v-model="search"
                type="text"
                placeholder="Search clients…"
                class="w-full pl-9 pr-3 py-2 text-[13px] rounded-md bg-gray-50 border border-transparent focus:bg-white focus:border-[#42389E] focus:ring-2 focus:ring-[#42389E]/15 outline-none transition placeholder:text-gray-400"
              />
            </div>
          </div>

          <!-- List -->
          <div class="flex-1 overflow-y-auto px-2 py-2">
            <div v-if="filtered.length === 0" class="py-16 text-center">
              <p class="text-[13px] text-gray-500">
                {{
                  availableClients.length === 0
                    ? "All available clients are already added."
                    : "No clients match your search."
                }}
              </p>
            </div>

            <ul v-else class="space-y-0.5">
              <li v-for="c in filtered" :key="c.id">
                <button
                  type="button"
                  class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-gray-50 focus:bg-gray-50 transition text-left group"
                  @click="handleAdd(c.id)"
                >
                  <div
                    class="w-8 h-8 rounded-md flex items-center justify-center text-white font-semibold text-[13px] shrink-0 shadow-sm"
                    :style="{ backgroundColor: c.accentColor }"
                    aria-hidden="true"
                  >
                    {{ c.logoText }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <p class="text-[13px] font-medium text-gray-900 truncate">
                        {{ c.name }}
                      </p>
                      <span
                        v-if="c.forcesMobile"
                        class="inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-1 py-px rounded bg-amber-50 text-amber-700 ring-1 ring-amber-100 shrink-0"
                      >
                        Mobile
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 truncate">
                      {{ c.vendor }} · {{ platformLabelOf(c.platform) }} ·
                      {{ c.engine }}
                    </p>
                  </div>
                  <div
                    class="w-6 h-6 rounded-md bg-gray-100 group-hover:bg-gray-900 group-hover:text-white text-gray-500 flex items-center justify-center transition-colors shrink-0"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 2.5v9M2.5 7h9"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                      />
                    </svg>
                  </div>
                </button>
              </li>
            </ul>
          </div>

          <!-- Footer -->
          <div
            class="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50/50"
          >
            <button
              type="button"
              class="text-[11.5px] font-medium text-gray-500 hover:text-gray-900 transition"
              @click="$emit('reset')"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              class="px-3.5 py-1.5 text-[12.5px] font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition shadow-sm"
              @click="$emit('update:open', false)"
            >
              Done
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// components/preview/PreviewClientPicker.vue
//
// Right-side drawer for picking new clients to add.
//
// v2 fix — overlay click-through bug:
//   v1 mounted the overlay and drawer as siblings of <body> via two separate
//   <Teleport> calls. Each had its own <Transition>. Because they shared the
//   same stacking context (body), the drawer could end up beneath the overlay
//   depending on mount order — clicks landed on the overlay (closing the
//   drawer) instead of the inputs.
//
//   v2 mounts a single wrapper with z-[200]; overlay is `absolute inset-0`
//   inside it, drawer is positioned-absolute inside it with @click.stop. The
//   drawer is later in DOM order so it naturally paints on top, and the
//   click.stop makes sure interactions inside don't bubble to the overlay.

import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";
import type {
  ClientPlatform,
  EmailClient,
} from "@/composables/emailBuilder/preview/useClientPreview";

const props = defineProps<{
  open: boolean;
  availableClients: EmailClient[];
}>();
const teleportTarget = useTeleportTarget();

const emit = defineEmits<{
  "update:open": [open: boolean];
  add: [id: string];
  reset: [];
}>();

const search = ref("");
const searchRef = ref<HTMLInputElement | null>(null);

// Reset search + autofocus whenever the drawer opens.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      search.value = "";
      nextTick(() => searchRef.value?.focus());
    }
  },
);

// Esc closes the picker — global keydown listener, attached only while the
// picker is open. One watcher, one handler, easy to reason about.
let escHandler: ((e: KeyboardEvent) => void) | null = null;

watch(
  () => props.open,
  (isOpen) => {
    if (typeof window === "undefined") return;
    if (isOpen && !escHandler) {
      escHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") emit("update:open", false);
      };
      window.addEventListener("keydown", escHandler);
    } else if (!isOpen && escHandler) {
      window.removeEventListener("keydown", escHandler);
      escHandler = null;
    }
  },
);

// Safety net: if the component unmounts while open, detach the listener.
onBeforeUnmount(() => {
  if (typeof window !== "undefined" && escHandler) {
    window.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.availableClients;
  return props.availableClients.filter((c) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.vendor.toLowerCase().includes(q) ||
      c.engine.toLowerCase().includes(q) ||
      c.platform.toLowerCase().includes(q)
    );
  });
});

function platformLabelOf(p: ClientPlatform): string {
  return p === "web" ? "Web" : p === "desktop" ? "Desktop" : "Mobile";
}

function handleAdd(id: string) {
  emit("add", id);
}
</script>

<style scoped>
.picker-overlay-enter-active,
.picker-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.picker-overlay-enter-from,
.picker-overlay-leave-to {
  opacity: 0;
}

.picker-drawer-enter-active,
.picker-drawer-leave-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.picker-drawer-enter-from,
.picker-drawer-leave-to {
  transform: translateX(100%);
}
</style>
