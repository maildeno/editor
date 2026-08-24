<script setup lang="ts">
/**
 * Slide-over list of saved templates. Selecting one hydrates the canvas with
 * it.
 *
 * Works against whatever storage the host configured — the default
 * localStorage adapter or a cloud backend — because it only talks to the
 * adapter interface, never to storage directly.
 *
 * `listTemplates` is optional on that interface, so this handles three
 * distinct states rather than assuming success: the adapter can't list at all
 * (older or custom adapters that predate the method), it can but has nothing
 * saved yet, and it can but the request failed. Collapsing those into one
 * empty list would make a missing capability look like an empty account.
 */
import { ref, watch } from "vue";
import Icon from "@/components/ui/Icon.vue";
import { useStorageAdapter } from "@/adapters";
import type { TemplateSummary } from "@/adapters/types";

const props = defineProps<{ open: boolean; currentTemplateId?: string | null }>();
const emit = defineEmits<{
  close: [];
  select: [templateId: string];
}>();

const adapter = useStorageAdapter();

const templates = ref<TemplateSummary[]>([]);
const loading = ref(false);
const errored = ref(false);
/** Distinguishes "this adapter can't list" from "nothing saved yet". */
const supported = ref(true);

async function load() {
  if (typeof adapter.listTemplates !== "function") {
    supported.value = false;
    return;
  }
  supported.value = true;
  loading.value = true;
  errored.value = false;
  try {
    templates.value = await adapter.listTemplates();
  } catch (e) {
    errored.value = true;
    console.error("[maildeno-editor] failed to list saved templates:", e);
  } finally {
    loading.value = false;
  }
}

// Refetch each time it opens rather than caching: a template may have been
// saved (or removed elsewhere) since the last look, and a stale list here is
// worse than a brief spinner.
watch(() => props.open, (isOpen) => { if (isOpen) load(); }, { immediate: true });

async function remove(id: string, event: Event) {
  event.stopPropagation(); // don't also select the row being deleted
  if (typeof adapter.deleteTemplate !== "function") return;
  try {
    await adapter.deleteTemplate(id);
    templates.value = templates.value.filter((t) => t.templateId !== id);
  } catch (e) {
    console.error("[maildeno-editor] failed to delete template:", e);
  }
}

/** Absolute dates age badly in a list; relative ones read at a glance. */
function relativeDate(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
</script>

<template>
  <!-- Structure, animation and z-index all follow SavedRowsPanel deliberately,
       so the two panels are indistinguishable in behaviour:

         outer  → sticky positioning + height bound, NO overflow here
           inner card → flex column, h-full, NO overflow here
             header  → shrink-0
             body    → flex-1 + overflow-y-auto  ← THE ONLY scroll container

       Putting overflow on more than one level is what caused the legacy
       panels to visually clip their last items while scrolling. -->
  <Transition name="panel-slide">
    <div
      v-if="props.open"
      class="w-65 sticky top-16 h-[calc(100vh-5.25rem)] z-80"
    >
      <div class="bg-white flex flex-col h-full border-r border-gray-200/80">
        <div class="flex items-center justify-between px-3.5 py-3 shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
            <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-[.08em]">
              Saved Templates
            </span>
          </div>

          <div class="relative group/close">
            <button
              @click="emit('close')"
              class="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
              aria-label="Close saved templates"
            >
              <Icon name="times" style="font-size: 12px" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <p v-if="!supported" class="px-2 py-6 text-[11px] text-gray-400 text-center leading-relaxed">
            This editor's storage adapter doesn't support listing templates.
          </p>

          <p v-else-if="loading" class="px-2 py-6 text-[11px] text-gray-400 text-center">
            Loading…
          </p>

          <p v-else-if="errored" class="px-2 py-6 text-[11px] text-red-500 text-center leading-relaxed">
            Couldn't load saved templates.<br />
            <button class="underline hover:no-underline mt-1" @click="load">Retry</button>
          </p>

          <p v-else-if="!templates.length" class="px-2 py-6 text-[11px] text-gray-400 text-center leading-relaxed">
            No saved templates yet.<br />Save one and it'll appear here.
          </p>

          <TransitionGroup v-else name="row-list" tag="div" class="space-y-1">
            <div
              v-for="t in templates"
              :key="t.templateId"
              class="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              :class="t.templateId === props.currentTemplateId ? 'bg-violet-50/70' : ''"
              @click="emit('select', t.templateId)"
            >
              <div class="min-w-0 flex-1">
                <div class="text-[12px] font-medium text-gray-800 truncate">
                  {{ t.name || "Untitled template" }}
                </div>
                <div class="text-[10px] text-gray-400 truncate">
                  {{ t.templateId }}
                </div>
              </div>

              <span class="text-[10px] text-gray-400 shrink-0 tabular-nums">
                {{ relativeDate(t.updatedAt) }}
              </span>

              <button
                v-if="typeof adapter.deleteTemplate === 'function'"
                class="hidden group-hover:flex items-center justify-center w-5 h-5 shrink-0 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none"
                aria-label="Delete template"
                @click="remove(t.templateId, $event)"
              >
                <Icon name="trash" style="font-size: 11px" />
              </button>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.row-list-enter-active,
.row-list-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.row-list-enter-from,
.row-list-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
.row-list-move {
  transition: transform 0.2s ease;
}

/* Scrollbar — thin, unobtrusive. Matches SavedRowsPanel. */
.overflow-y-auto::-webkit-scrollbar { width: 6px; }
.overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
.overflow-y-auto::-webkit-scrollbar-thumb { background: #6a7282; border-radius: 9999px; }
.overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #364153; }
</style>
