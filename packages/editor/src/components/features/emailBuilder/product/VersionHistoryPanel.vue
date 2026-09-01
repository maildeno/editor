<script setup lang="ts">
/**
 * Slide-over list of a template's version history. Selecting one restores it
 * into the canvas.
 *
 * Occupies the same slot as SavedTemplatesPanel and is deliberately its
 * structural twin — same widths, same sticky bounds, same single scroll
 * container, same transitions. The two are mutually exclusive (EmailEditor
 * renders one or the other based on `versions`), so any divergence would
 * read as a layout bug when a host toggles between them.
 *
 * Every adapter method behind this is optional, and each control is gated on
 * its own method existing rather than on one blanket "supported" flag. An
 * adapter that can list and restore but not delete gets exactly that: a
 * working history with no delete buttons, instead of dead controls that
 * throw when clicked.
 */
import { ref, computed, watch } from "vue";
import { useStorageAdapter } from "@/adapters";
import type { TemplateVersionSummary } from "@/adapters/types";
import { useConfirm } from "@/composables/ui/useConfirm";
import { useToast } from "@/composables/ui/useToast";
import Icon from "@/components/ui/Icon.vue";

const props = defineProps<{
  open: boolean;
  /** Null in create mode — there is no history until the template exists. */
  templateId?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  /** The parent owns the actual canvas write, so this panel never touches
   *  builder state directly — same split as SavedTemplatesPanel's `select`. */
  restore: [versionId: string];
}>();

const adapter = useStorageAdapter();
const confirm = useConfirm();
const toast = useToast();

const versions = ref<TemplateVersionSummary[]>([]);
const loading = ref(false);
const errored = ref(false);
/** "This adapter can't list versions" — distinct from "no versions yet". */
const supported = ref(true);
/** Ids with an in-flight mutation, so a row can disable just itself rather
 *  than the panel locking up globally on one slow request. */
const busy = ref<Set<string>>(new Set());

const canDelete = computed(
  () => typeof adapter.deleteTemplateVersion === "function",
);
const canDeleteAll = computed(
  () => typeof adapter.deleteAllTemplateVersions === "function",
);
const canKeep = computed(
  () => typeof adapter.setTemplateVersionKept === "function",
);
const canRestore = computed(
  () => typeof adapter.getTemplateVersion === "function",
);

async function load() {
  if (!props.templateId) {
    // Create mode: nothing saved yet, so nothing to have a history of. Not
    // an error and not an unsupported adapter — its own empty state below.
    versions.value = [];
    supported.value = true;
    return;
  }
  if (typeof adapter.listTemplateVersions !== "function") {
    supported.value = false;
    return;
  }
  supported.value = true;
  loading.value = true;
  errored.value = false;
  try {
    versions.value = await adapter.listTemplateVersions(props.templateId);
  } catch (e) {
    errored.value = true;
    console.error("[maildeno-editor] failed to list template versions:", e);
  } finally {
    loading.value = false;
  }
}

// Refetch on open, and whenever the open template changes — a stale list
// from the previously-open template would offer to restore another
// document's content into this one.
watch(
  () => [props.open, props.templateId],
  ([isOpen]) => {
    if (isOpen) load();
  },
  { immediate: true },
);

async function toggleKept(v: TemplateVersionSummary, event: Event) {
  event.stopPropagation();
  if (!props.templateId || !canKeep.value || busy.value.has(v.versionId))
    return;

  const next = !v.kept;
  busy.value = new Set(busy.value).add(v.versionId);
  try {
    await adapter.setTemplateVersionKept(props.templateId, v.versionId, next);
    // Patch in place rather than refetching: the list order is unchanged by
    // a keep toggle, and a refetch would visibly re-render the whole panel
    // for a one-icon change.
    versions.value = versions.value.map((x) =>
      x.versionId === v.versionId ? { ...x, kept: next } : x,
    );
  } catch (e) {
    console.error("[maildeno-editor] failed to update kept state:", e);
    toast.add({
      severity: "error",
      summary: "Couldn't update",
      detail: "That version's kept state didn't change.",
      life: 4000,
    });
  } finally {
    const s = new Set(busy.value);
    s.delete(v.versionId);
    busy.value = s;
  }
}

function removeOne(v: TemplateVersionSummary, event: Event) {
  event.stopPropagation();
  if (!props.templateId || !canDelete.value) return;

  confirm.require({
    header: "Delete version?",
    message: "This version will be permanently removed. This can't be undone.",
    acceptLabel: "Delete",
    rejectLabel: "Cancel",
    acceptClass: "md-btn-danger",
    accept: async () => {
      try {
        await adapter.deleteTemplateVersion(props.templateId!, v.versionId);
        versions.value = versions.value.filter(
          (x) => x.versionId !== v.versionId,
        );
      } catch (e) {
        console.error("[maildeno-editor] failed to delete version:", e);
        toast.add({
          severity: "error",
          summary: "Delete failed",
          detail: "That version couldn't be deleted.",
          life: 4000,
        });
      }
    },
  });
}

function removeAll() {
  if (!props.templateId || !canDeleteAll.value) return;

  const keptCount = versions.value.filter((v) => v.kept).length;
  confirm.require({
    header: "Delete all versions?",
    // States the kept exemption explicitly, because the adapter contract
    // guarantees it and a user clicking "delete all" deserves to know what
    // survives before they click rather than after.
    message: keptCount
      ? `Every version except the ${keptCount} you've kept will be permanently removed. This can't be undone.`
      : "Every version of this template will be permanently removed. This can't be undone.",
    acceptLabel: "Delete all",
    rejectLabel: "Cancel",
    acceptClass: "md-btn-danger",
    accept: async () => {
      try {
        await adapter.deleteAllTemplateVersions(props.templateId!);
        versions.value = versions.value.filter((v) => v.kept);
      } catch (e) {
        console.error("[maildeno-editor] failed to delete versions:", e);
        toast.add({
          severity: "error",
          summary: "Delete failed",
          detail: "Those versions couldn't be deleted.",
          life: 4000,
        });
      }
    },
  });
}

function restore(v: TemplateVersionSummary) {
  if (!canRestore.value) return;
  confirm.require({
    header: "Restore this version?",
    // "Undo" is the honest reassurance here: the restore goes through
    // setJson's undoable path, so Ctrl+Z genuinely returns the canvas.
    message:
      "The canvas will be replaced with this version. You can undo it afterwards.",
    acceptLabel: "Restore",
    rejectLabel: "Cancel",
    accept: () => emit("restore", v.versionId),
  });
}

/** Absolute dates age badly in a list; relative ones read at a glance.
 *  Matches SavedTemplatesPanel so the two panels format time identically. */
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
  <!-- Structure mirrors SavedTemplatesPanel exactly — see its comment for why
       overflow lives on one level only. -->
  <Transition name="panel-slide">
    <div
      v-if="props.open"
      class="w-65 sticky top-16 h-[calc(100vh-5.25rem)] z-80"
    >
      <div
        class="bg-(--md-surface) flex flex-col h-full border-r border-(--md-border)/80"
      >
        <div class="flex items-center justify-between px-3.5 py-3 shrink-0">
          <div class="flex items-center gap-2">
            <svg
              class="w-3.5 h-3.5 text-(--md-text-subtle)"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 3v5h5" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              <path d="M12 7v5l4 2" />
            </svg>
            <span
              class="text-[11px] font-semibold text-(--md-text-subtle) uppercase tracking-[.08em]"
            >
              Version History
            </span>
          </div>

          <div class="flex items-center gap-0.5">
            <button
              v-if="canDeleteAll && versions.length"
              @click="removeAll"
              class="w-6 h-6 flex items-center justify-center rounded-md text-(--md-text-subtle) hover:text-(--md-danger) hover:bg-(--md-danger-bg) transition-colors focus:outline-none"
              aria-label="Delete all versions"
              title="Delete all versions"
            >
              <Icon name="trash" style="font-size: 11px" />
            </button>
            <button
              @click="emit('close')"
              class="w-6 h-6 flex items-center justify-center rounded-md text-(--md-text-subtle) hover:text-(--md-text-muted) hover:bg-(--md-surface-muted) transition-colors focus:outline-none"
              aria-label="Close version history"
            >
              <Icon name="times" style="font-size: 12px" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <p
            v-if="!supported"
            class="px-2 py-6 text-[11px] text-(--md-text-subtle) text-center leading-relaxed"
          >
            This editor's storage adapter doesn't support version history.
          </p>

          <p
            v-else-if="!props.templateId"
            class="px-2 py-6 text-[11px] text-(--md-text-subtle) text-center leading-relaxed"
          >
            Save this template first.<br />Versions appear here after each save.
          </p>

          <p
            v-else-if="loading"
            class="px-2 py-6 text-[11px] text-(--md-text-subtle) text-center"
          >
            Loading…
          </p>

          <p
            v-else-if="errored"
            class="px-2 py-6 text-[11px] text-(--md-danger) text-center leading-relaxed"
          >
            Couldn't load version history.<br />
            <button class="underline hover:no-underline mt-1" @click="load">
              Retry
            </button>
          </p>

          <p
            v-else-if="!versions.length"
            class="px-2 py-6 text-[11px] text-(--md-text-subtle) text-center leading-relaxed"
          >
            No versions yet.<br />Save again and the previous state is kept
            here.
          </p>

          <TransitionGroup v-else name="row-list" tag="div" class="space-y-1">
            <div
              v-for="v in versions"
              :key="v.versionId"
              class="group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
              :class="[
                canRestore
                  ? 'hover:bg-(--md-surface-hover) cursor-pointer'
                  : '',
                busy.has(v.versionId) ? 'opacity-50 pointer-events-none' : '',
              ]"
              @click="canRestore && restore(v)"
            >
              <div class="min-w-0 flex-1">
                <div
                  class="text-[12px] font-medium text-(--md-text) truncate flex items-center gap-1.5"
                >
                  <Icon
                    v-if="v.kept"
                    name="bookmark-filled"
                    style="font-size: 9px"
                    class="text-(--md-primary) shrink-0"
                  />
                  {{ v.label || relativeDate(v.createdAt) || "Version" }}
                </div>
                <div class="text-[10px] text-(--md-text-subtle) truncate">
                  {{ v.author || new Date(v.createdAt).toLocaleString() }}
                </div>
              </div>

              <button
                v-if="canKeep"
                class="items-center justify-center w-5 h-5 shrink-0 rounded-md transition-colors focus:outline-none"
                :class="
                  v.kept
                    ? 'flex text-(--md-primary) hover:bg-(--md-surface-muted)'
                    : 'hidden group-hover:flex text-(--md-text-subtle) hover:text-(--md-text-muted) hover:bg-(--md-surface-muted)'
                "
                :aria-label="
                  v.kept ? 'Stop keeping this version' : 'Keep this version'
                "
                :title="
                  v.kept
                    ? 'Kept — excluded from Delete all'
                    : 'Keep this version'
                "
                @click="toggleKept(v, $event)"
              >
                <Icon
                  :name="v.kept ? 'bookmark-filled' : 'bookmark'"
                  style="font-size: 11px"
                />
              </button>

              <button
                v-if="canDelete"
                class="hidden group-hover:flex items-center justify-center w-5 h-5 shrink-0 rounded-md text-(--md-text-subtle) hover:text-(--md-danger) hover:bg-(--md-danger-bg) transition-colors focus:outline-none"
                aria-label="Delete version"
                @click="removeOne(v, $event)"
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

/* Scrollbar — thin, unobtrusive. Matches SavedTemplatesPanel. */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: var(--md-border-strong);
  border-radius: 9999px;
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: var(--md-text-subtle);
}
</style>
