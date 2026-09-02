<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- ── Top nav bar ────────────────────────────────────────────────────── -->
    <div
      class="flex items-center justify-between gap-3 py-3 mb-3 shrink-0 flex-wrap bg-(--md-surface)/95 backdrop-blur border-b border-(--md-border) z-30 px-5"
    >
      <!-- Back to grid -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <button
            type="button"
            class="flex items-center justify-center w-10 h-10 shrink-0 rounded-full hover:bg-(--md-surface-muted) transition-colors"
            aria-label="Back"
            @click="goBack"
          >
            <slot name="back-icon">
              <svg
                class="w-5 h-5 text-(--md-text-muted)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </slot>
          </button>
          <div class="min-w-0">
            <h1 class="text-[13.5px] font-semibold text-(--md-text) leading-tight">
              Inbox preview
            </h1>
            <p class="text-[11px] text-(--md-text-subtle) truncate leading-tight">
              <template v-if="isHydrated">
                Across {{ selectedClients.length }}
                {{ selectedClients.length === 1 ? "client" : "clients" }} ·
                light and dark mode
              </template>
              <template v-else> Loading preflight set… </template>
            </p>
          </div>
        </div>
      </div>

      <!-- Client identity with chevron nav -->
      <div class="flex items-center gap-3 min-w-0">
        <div class="relative group/prev shrink-0">
          <button
            type="button"
            class="w-9 h-9 rounded-md flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-text) hover:bg-(--md-surface-muted) transition disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="!hasPrev"
            :aria-label="
              prevName ? `Previous: ${prevName}` : 'No previous client'
            "
            @click="$emit('prev')"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 4L6 8L10 12"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <!-- Custom tooltip (mirrors canvas hover style: gray-950 bg, white text) -->
          <div
            v-if="hasPrev && prevName"
            class="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 opacity-0 pointer-events-none group-hover/prev:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap"
          >
            <div
              class="bg-(--md-inverse-surface) text-(--md-on-inverse) text-[11px] font-medium px-2 py-1 rounded shadow-lg flex items-center gap-1"
            >
              <span class="opacity-50">←</span> {{ prevName }}
            </div>
            <div
              class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-(--md-inverse-surface) rotate-45"
            />
          </div>
        </div>

        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center text-(--md-on-inverse) font-semibold text-sm shrink-0"
            :style="{ backgroundColor: client.accentColor }"
            aria-hidden="true"
          >
            {{ client.logoText }}
          </div>
          <div class="min-w-0 text-center">
            <p class="text-sm font-semibold text-(--md-text) truncate">
              {{ client.name }}
            </p>
            <p class="text-[11px] text-(--md-text-subtle) truncate">
              {{ position }} · {{ client.vendor }}
            </p>
          </div>
        </div>

        <div class="relative group/next shrink-0">
          <button
            type="button"
            class="w-9 h-9 rounded-md flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-text) hover:bg-(--md-surface-muted) transition disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="!hasNext"
            :aria-label="nextName ? `Next: ${nextName}` : 'No next client'"
            @click="$emit('next')"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <div
            v-if="hasNext && nextName"
            class="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 opacity-0 pointer-events-none group-hover/next:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap"
          >
            <div
              class="bg-(--md-inverse-surface) text-(--md-on-inverse) text-[11px] font-medium px-2 py-1 rounded shadow-lg flex items-center gap-1"
            >
              {{ nextName }} <span class="opacity-50">→</span>
            </div>
            <div
              class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-(--md-inverse-surface) rotate-45"
            />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div
          v-if="hasContent"
          class="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-(--md-success-bg) text-(--md-success-fg) text-[11px] font-medium ring-1 ring-(--md-success-border)"
        >
          <span class="relative flex w-1.5 h-1.5">
            <span
              class="animate-ping absolute inline-flex w-full h-full rounded-full bg-(--md-success) opacity-75"
            />
            <span
              class="relative inline-flex w-1.5 h-1.5 rounded-full bg-(--md-success)"
            />
          </span>
          Live
        </div>

        <button
          class="flex items-center gap-1.5 text-xs border border-(--md-border) px-2 py-1.25 rounded-lg hover:bg-(--md-surface-hover) text-(--md-text-muted) transition-colors"
          @click="$emit('back-to-grid')"
        >
          <Icon name="plus" class="text-(--md-text-subtle)" style="font-size: 10px" />
          Email clients
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md text-(--md-danger) hover:bg-(--md-danger-bg) transition"
          :aria-label="`Remove ${client.name}`"
          @click="$emit('remove', client.id)"
        >
          <svg
            class="w-3.5 h-3.5 text-(--md-danger)"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" x2="10" y1="11" y2="17" />
            <line x1="14" x2="14" y1="11" y2="17" />
          </svg>
          Remove
        </button>
      </div>
    </div>

    <!-- Split panes -->
    <div class="flex-1 grid gap-3 min-h-0 grid-cols-1 lg:grid-cols-2 px-5">
      <!--
        forceMobile is the CLIENT's responsibility, not the user's. Apple Mail
        on macOS is desktop → don't stack. Gmail Android is mobile → stack and
        apply mobile prop overrides. This matches what your real builder does
        when previewMode === 'mobile' is toggled.

        The source pane (PreviewCanvas) always renders the authored design
        as-is — including gradients. Client-specific downgrades happen only
        in the right pane (PreviewRendered's iframe), via transformForClient.
      -->
      <PreviewCanvas
        :rows="rows"
        :canvas="canvas"
        :force-mobile="client.forcesMobile"
      />
      <PreviewRendered :client="client" :html="html" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/ui/Icon.vue";
// components/preview/PreviewDetailView.vue (v2)
// - Forwards client.forcesMobile → PreviewCanvas so the source pane matches
//   the perspective of the active client.
// - Keyboard: ←/→ navigate, Esc closes.

import { computed, onMounted, onUnmounted } from "vue";
import type { EmailClient } from "@/composables/emailBuilder/preview/useClientPreview";
import PreviewCanvas from "./PreviewCanvas.vue";
import PreviewRendered from "./PreviewRendered.vue";

const props = defineProps<{
  isHydrated: boolean;
  selectedClients: any;
  hasContent: boolean | any;
  client: EmailClient;
  rows: any[];
  canvas: any;
  html: string;
  index: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  prevName?: string | null;
  nextName?: string | null;
}>();

const emit = defineEmits<{
  /** Close the entire preview overlay (md logo, Esc key). */
  close: [];
  /**
   * Return from the detail view to the grid view WITHOUT closing the overlay.
   * Wired to PreviewScreen's setActiveClient(null). The "Email clients"
   * button at the top-right of the nav bar uses this.
   *
   * Why separate from `close`: previously `close` did double duty here (the
   * page-level handler interpreted it as "clear activeClient" → back to grid).
   * Now that the overlay is host-controlled, `close` means "dismiss the
   * whole overlay", and stepping back to grid needs its own channel.
   */
  "back-to-grid": [];
  next: [];
  prev: [];
  remove: [id: string];
}>();

const position = computed(() => `${props.index + 1} of ${props.total}`);

const goBack = () => {
  // Closes the entire preview overlay. Previously called window.history.back()
  // when this lived at /preview as a route — that's a no-op now that the
  // overlay isn't pushed onto history. The "md" logo in the top-left of this
  // view is the click target.
  emit("close");
};

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (target) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
      return;
    }
  }
  if (e.key === "ArrowRight" && props.hasNext) {
    e.preventDefault();
    emit("next");
  } else if (e.key === "ArrowLeft" && props.hasPrev) {
    e.preventDefault();
    emit("prev");
  } else if (e.key === "Escape") {
    emit("close");
  }
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKeydown);
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeydown);
  }
});
</script>
