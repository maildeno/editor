<template>
  <div class="p-5">
    <!-- Header bar -->
    <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <div class="flex items-baseline gap-2 min-w-0">
        <h2 class="text-[13px] font-semibold text-(--md-text)">
          Preflight clients
        </h2>
        <span class="text-[12px] text-(--md-text-subtle)">
          <template v-if="isHydrated">
            {{ selectedClients.length }}
            {{ selectedClients.length === 1 ? "selected" : "selected" }}
          </template>
          <template v-else>—</template>
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          v-if="canReset"
          type="button"
          class="px-2.5 py-1.5 text-[12px] font-medium rounded-md text-(--md-text-muted) hover:text-(--md-text) hover:bg-(--md-surface-muted) transition"
          @click="$emit('reset')"
        >
          Reset
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium rounded-md bg-(--md-inverse-surface) text-(--md-on-inverse) hover:bg-(--md-inverse-surface) transition shadow-sm"
          @click="$emit('open-picker')"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 2.5v9M2.5 7h9"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg>
          Add client
        </button>

        <!-- Close the entire preview overlay.
             Sits at the far right of the header so it's the visual "exit"
             point — same affordance position as Notion's modal close. The
             8x8 hit target with subtle hover bg matches the chevron-nav
             buttons in PreviewDetailView, so the dismiss UI feels uniform
             across both views. -->
        <button
          type="button"
          aria-label="Close preview"
          class="ml-1 inline-flex items-center justify-center w-8 h-8 rounded-md text-(--md-text-subtle) hover:text-(--md-text) hover:bg-(--md-surface-muted) transition-colors"
          @click="$emit('close')"
        >
          <!-- Lucide: x -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div
      v-if="selectedClients.length > 0"
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <PreviewClientCard
        v-for="client in selectedClients"
        :key="client.id"
        :client="client"
        removable
        @open="$emit('open', $event)"
        @remove="$emit('remove', $event)"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex flex-col items-center justify-center gap-4 py-24 text-center bg-(--md-surface) rounded-xl border border-dashed border-(--md-border)"
    >
      <div
        class="w-14 h-14 rounded-2xl bg-(--md-surface-hover) border border-(--md-border) flex items-center justify-center"
      >
        <svg
          class="w-7 h-7 text-(--md-text-subtle)"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div>
        <p class="text-base font-medium text-(--md-text-muted)">No clients yet</p>
        <p class="text-sm text-(--md-text-subtle) mt-1 max-w-xs">
          Add an email client to preview how your email will render across
          inboxes.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-(--md-accent) text-(--md-on-accent) hover:bg-(--md-accent-hover) transition shadow-sm"
        @click="$emit('open-picker')"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 2.5v9M2.5 7h9"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
        Add your first client
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// components/preview/PreviewClientList.vue
// Grid view container — emits up to the page which owns state.
// `isHydrated` is forwarded from the page so the header text can stay
// SSR-deterministic until localStorage has been read.

import type { EmailClient } from "@/composables/emailBuilder/preview/useClientPreview";
import PreviewClientCard from "./PreviewClientCard.vue";

defineProps<{
  selectedClients: EmailClient[];
  canReset?: boolean;
  isHydrated?: boolean;
}>();

defineEmits<{
  open: [id: string];
  remove: [id: string];
  "open-picker": [];
  reset: [];
  /** Close the entire preview overlay. Wired from the X button at the
   *  far right of the header. PreviewScreen forwards this to Header. */
  close: [];
}>();
</script>
