<template>
  <!--
    PreviewScreen — formerly pages/preview.vue.
    Now a component rendered as a full-screen overlay from Header.vue (via
    <Teleport to="body">). Because the host uses v-show (not v-if), this
    component stays MOUNTED across close/open cycles. That preserves:
      • selectedClients hydration state (no re-read from localStorage)
      • activeClient selection (returns to the same client when reopened)
      • the computed exportedHtml cache (no re-render burst)
      • scroll position inside the panes
    The previous /preview route caused a full page transition + remount each
    time, which forced template re-fetch on the builder side. This overlay
    pattern eliminates that round-trip entirely.

    Layout (unchanged from the original page):
      • DETAIL mode → viewport-locked, only inner panes scroll
      • GRID mode   → page-internal scroll (cards may overflow)
    The outer container is `absolute inset-0` and lives inside a fixed
    teleport host in Header.vue, so it fills the viewport above the builder.
  -->
  <div
    class="absolute inset-0 bg-gray-50 flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label="Email preview"
  >
    <!-- ── Body (former <main> from preview.vue) ─────────────────────────── -->
    <!-- Close affordances now live INSIDE the children, not on this wrapper:
         • PreviewClientList → X button at the right of its header bar
         • PreviewDetailView → "md" logo in the top-left (replaces goBack)
                              + Esc anywhere in the view
         Both emit `close` which this component forwards to Header. The
         additional `back-to-grid` emit from PreviewDetailView is consumed
         locally (clears activeClient) so it never reaches Header.
         This keeps PreviewScreen visually transparent — no header chrome of
         its own — per the request. -->
    <div
      class="flex-1 min-h-0 flex flex-col"
      :class="activeClient ? 'overflow-hidden' : 'overflow-y-auto'"
    >
      <main
        class="max-w-[1600px] mx-auto w-full pt-0 pb-5 flex-1 min-h-0 flex flex-col"
      >
        <!-- DETAIL VIEW -->
        <div v-if="activeClient" class="flex-1 min-h-0 flex flex-col">
          <PreviewDetailView
            :is-hydrated="isHydrated"
            :selected-clients="selectedClients"
            :has-content="hasContent"
            :client="activeClient"
            :rows="rows"
            :canvas="canvasStyles"
            :html="exportedHtml"
            :index="activeIndex"
            :total="selectedClients.length"
            :has-next="hasNext"
            :has-prev="hasPrev"
            :prev-name="prevName"
            :next-name="nextName"
            @close="$emit('close')"
            @back-to-grid="setActiveClient(null)"
            @next="goToNextClient"
            @prev="goToPrevClient"
            @remove="handleRemoveActive"
          />
        </div>

        <!-- GRID VIEW -->
        <PreviewClientList
          v-else
          :selected-clients="selectedClients"
          :can-reset="canReset"
          :is-hydrated="isHydrated"
          @open="setActiveClient($event)"
          @remove="removeClient($event)"
          @open-picker="pickerOpen = true"
          @reset="resetToDefaults"
          @close="$emit('close')"
        />
      </main>

      <!-- Add-client drawer -->
      <PreviewClientPicker
        v-model:open="pickerOpen"
        :available-clients="availableClients"
        @add="handleAdd"
        @reset="resetToDefaults"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// components/preview/PreviewScreen.vue
//
// Migrated from pages/preview.vue. Behavioural diffs vs the page version:
//   • useHead({ title: "Preview" }) removed — overlays don't own the
//     document title. The builder page keeps whatever title it set.
//   • Outer chrome wraps the content (close button, Esc hint, top bar). The
//     content layout/data flow is byte-for-byte identical to the original.
//   • Cross-tab storage listeners stay. They're still useful: if the user
//     has /builder open in another tab, edits there propagate via
//     localStorage and we want this overlay to reflect them on focus.
//
// SSR-safe state hydration (unchanged from the original):
//   • Module-level state in useClientPreview starts with DEFAULT_SELECTED_IDS
//     on BOTH server and client.
//   • onMounted() calls hydrateFromStorage() which reads the user's saved
//     selection from localStorage AFTER hydration completes. Vue tolerates
//     post-mount state changes; it only flags mismatches DURING the initial
//     render pass.
//   • The text "X clients selected" uses isHydrated to swap between a
//     deterministic SSR string and the actual count after hydrate. This
//     avoids the "rendered on server: 4 clients" hydration warning.
//
// Live updates from /builder:
//   `rows` and `canvasStyles` are reactive refs from useEmailBuilder().
//   Since Nuxt's useState shares state across pages/components in the same
//   tab, edits made on the builder route propagate here. `exportedHtml` is
//   a computed that re-runs whenever rows/canvasStyles change, so the
//   iframe srcdoc updates live.

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useClientPreview } from "@/composables/emailBuilder/preview/useClientPreview";
import PreviewClientList from "./ui/PreviewClientList.vue";
import PreviewClientPicker from "./ui/PreviewClientPicker.vue";
import PreviewDetailView from "./ui/PreviewDetailView.vue";

defineEmits<{
  /** Emitted when the user clicks the X button. The host (Header.vue)
   *  binds this to flip its open flag — keeping all open/close logic in
   *  one place. */
  close: [];
}>();

const builder = useEmailBuilder();
const { rows, canvasStyles, getExportedHTML, initFromStorage, isBuilderReady } = builder;

const {
  selectedClients,
  availableClients,
  activeClient,
  activeClientIndex,
  hasNext,
  hasPrev,
  isHydrated,
  addClient,
  removeClient,
  setActiveClient,
  goToNextClient,
  goToPrevClient,
  resetToDefaults,
  hydrateFromStorage,
} = useClientPreview();

const pickerOpen = ref(false);

// Cross-tab / cross-window sync.
//
// If the user has /builder open in one tab and another tab with this overlay
// open, edits on either side write to localStorage. We listen for `storage`
// events so the overlay re-reads and refreshes its view immediately.
// `visibilitychange` covers the case where the user edits in one tab, then
// switches to the tab with this overlay open — we re-hydrate on focus so
// the preview catches up.
//
// Within the same tab, Nuxt's useState shares the reactive state directly,
// so no listener is needed there.

function syncFromStorage() {
  if (typeof initFromStorage !== "function") return;
  // Don't re-hydrate while the builder is mid-init (initForCreate sets
  // rows = [] before repopulating; restoring here would race the reset
  // and cause guardEmpty to fire its dialog on an empty canvas).
  if (!isBuilderReady.value) return;
  try {
    initFromStorage();
  } catch {
    // ignore
  }
}

function onStorageEvent(e: StorageEvent) {
  // Only resync when the builder state key changes. We don't know the exact
  // key name (depends on useEmailBuilder internals) but we conservatively
  // resync on any same-origin localStorage write whose key contains "email"
  // — the cost is just re-reading a JSON blob, negligible compared to user-
  // perceived staleness.
  if (e.key === null || e.key.toLowerCase().includes("email")) {
    syncFromStorage();
  }
}

function onVisibilityChange() {
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  ) {
    syncFromStorage();
  }
}

onMounted(() => {
  // Hydrate preview-client selection from localStorage POST-mount so SSR/CSR
  // render the same defaults on the first paint.
  hydrateFromStorage();

  // Make sure the email builder state is hydrated too — opening the overlay
  // as a fresh page load shouldn't show an empty canvas.
  syncFromStorage();

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorageEvent);
    window.addEventListener("visibilitychange", onVisibilityChange);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("storage", onStorageEvent);
    window.removeEventListener("visibilitychange", onVisibilityChange);
  }
});

const hasContent = computed(() => (rows.value ?? []).length > 0);
const activeIndex = computed(() => activeClientIndex.value);

const prevName = computed(() => {
  const i = activeClientIndex.value;
  return i > 0 ? (selectedClients.value[i - 1]?.name ?? null) : null;
});

const nextName = computed(() => {
  const i = activeClientIndex.value;
  return i >= 0 && i < selectedClients.value.length - 1
    ? (selectedClients.value[i + 1]?.name ?? null)
    : null;
});

// Make exportedHtml reactive by READING the reactive refs that drive the
// export. Without these reads, Vue's computed dep-tracker has no reason to
// re-run getExportedHTML() when the user edits in /builder.
//
// We pass `"prune"` mode so the iframe shows prune version component
// based on visibility rules. The preview is for QA across all audience segments;
// pruning by the default visibility context would hide plan-gated rows,
// audience-gated columns, etc. — defeating the purpose. (For per-audience
// previews later, we'd add a context selector and switch mode at that
// point.)
const exportedHtml = computed(() => {
  // Short-circuit before invoking the export engine when the canvas is
  // empty — prevents guardEmpty from firing its dialog during
  // initForCreate resets (rows briefly becomes [] mid-reset while this
  // computed is still live because PreviewScreen stays mounted via v-show).
  const currentRows = rows.value;
  if (!currentRows || currentRows.length === 0) return "";
  // Touch canvasStyles so this computed also re-runs on canvas changes.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  canvasStyles.value;
  try {
    return getExportedHTML?.("prune", "Maildeno Preview") ?? "";
  } catch {
    return "";
  }
});

// canReset only meaningful after hydration — before hydrate, SSR and CSR
// would disagree on selectedClients.length, causing a hydration warning.
const canReset = computed(
  () => isHydrated.value && selectedClients.value.length !== 4,
);

function handleAdd(id: string) {
  addClient(id);
}

function handleRemoveActive(id: string) {
  removeClient(id);
}
</script>