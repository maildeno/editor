<template>
  <div
    class="group relative bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 hover:border-purple-400 hover:shadow-[0_8px_24px_-12px_rgba(67,56,202,0.25)] focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/15 cursor-pointer flex flex-col"
    role="button"
    tabindex="0"
    :aria-label="`Open ${client.name} preview`"
    @click="$emit('open', client.id)"
    @keydown.enter="$emit('open', client.id)"
    @keydown.space.prevent="$emit('open', client.id)"
  >
    <!-- Header: logo, name, remove/add affordance -->
    <div class="flex items-start gap-3 px-4 pt-4 pb-3">
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-[15px] shrink-0 shadow-sm"
        :style="{ backgroundColor: client.accentColor }"
        aria-hidden="true"
      >
        {{ client.logoText }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <p
            class="text-[13.5px] font-semibold text-gray-900 truncate leading-tight"
          >
            {{ client.name }}
          </p>
          <span
            v-if="client.forcesMobile"
            class="inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-1 py-px rounded bg-amber-50 text-amber-700 ring-1 ring-amber-100 shrink-0"
          >
            Mobile
          </span>
        </div>
        <p class="text-[11px] text-gray-500 truncate mt-0.5">
          {{ client.vendor }} · {{ platformLabel }} · {{ client.engine }}
        </p>
      </div>

      <button
        v-if="removable"
        type="button"
        class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all w-7 h-7 rounded-md hover:bg-red-50 hover:text-red-600 text-gray-400 flex items-center justify-center shrink-0"
        :aria-label="`Remove ${client.name}`"
        @click.stop="$emit('remove', client.id)"
      >
        <svg
          class="w-3.5 h-3.5 text-red-600"
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
      </button>

      <button
        v-else-if="addable"
        type="button"
        class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all w-7 h-7 rounded-md bg-[#42389E]/10 hover:bg-[#42389E] hover:text-white text-[#42389E] flex items-center justify-center shrink-0"
        :aria-label="`Add ${client.name}`"
        @click.stop="$emit('add', client.id)"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 2.5v9M2.5 7h9"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <!-- Visual preview placeholder — looks like an actual mini inbox -->
    <div
      class="mx-4 mb-3 rounded-md border overflow-hidden relative"
      :class="'border-gray-200 bg-gray-50'"
      :style="{ height: PREVIEW_HEIGHT + 'px' }"
    >
      <!-- Mini chrome bar -->
      <div
        class="h-3 border-b border-gray-200 flex items-center gap-0.5 px-1.5"
        :style="{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,245,247,1))',
        }"
      >
        <span class="w-1 h-1 rounded-full bg-gray-300" />
        <span class="w-1 h-1 rounded-full bg-gray-300" />
        <span class="w-1 h-1 rounded-full bg-gray-300" />
      </div>
      <div class="p-2.5 flex flex-col gap-1.5">
        <div
          class="h-1.5 rounded-sm"
          :style="{
            backgroundColor: client.accentColor,
            opacity: 0.55,
            width: '60%',
          }"
        />
        <div class="h-1 bg-gray-200 rounded-sm w-3/4" />
        <div class="h-1 bg-gray-200 rounded-sm w-1/2" />
        <div class="h-1 bg-gray-200 rounded-sm w-2/3" />
      </div>
    </div>

    <!-- Capability badges -->
    <div class="px-4 pb-3">
      <PreviewCapabilityBadges :capabilities="client.capabilities" />
    </div>

    <!-- Footer -->
    <div
      class="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between text-[11px] mt-auto"
    >
      <span class="text-gray-500 truncate flex items-center gap-1.5">
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :class="
            darkModeStrategy === 'none'
              ? 'bg-gray-300'
              : darkModeStrategy === 'respects-meta'
                ? 'bg-emerald-400'
                : 'bg-amber-400'
          "
        />
        {{ darkModeLabel }}
      </span>
      <span
        class="inline-flex items-center gap-0.5 text-[#42389E] font-medium opacity-60 group-hover:opacity-100 group-hover:gap-1 transition-all shrink-0"
      >
        Open
        <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M4 2.5L7.5 6L4 9.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// components/preview/PreviewClientCard.vue (v2)
//
// Updated labels for the new dark-mode strategy taxonomy:
//   respects-meta → "Native dark mode"
//   near-black-swap → "Dark (color swap)"
//   partial-transparent → "Dark (partial)"
//   none → "No dark mode"

import { computed } from "vue";
import type { EmailClient } from "@/composables/emailBuilder/preview/useClientPreview";
import PreviewCapabilityBadges from "./PreviewCapabilityBadges.vue";

const props = withDefaults(
  defineProps<{
    client: EmailClient;
    removable?: boolean;
    addable?: boolean;
  }>(),
  { removable: false, addable: false },
);

defineEmits<{
  open: [id: string];
  remove: [id: string];
  add: [id: string];
}>();

const PREVIEW_HEIGHT = 92;

const platformLabel = computed(() => {
  switch (props.client.platform) {
    case "web":
      return "Web";
    case "desktop":
      return "Desktop";
    case "mobile":
      return "Mobile";
    default:
      return "";
  }
});

const darkModeStrategy = computed(
  () => props.client.capabilities.darkModeStrategy,
);

const darkModeLabel = computed(() => {
  switch (props.client.capabilities.darkModeStrategy) {
    case "respects-meta":
      return "Native dark mode";
    case "near-black-swap":
      return "Dark (color swap)";
    case "partial-transparent":
      return "Dark (partial)";
    case "none":
      return "No dark mode";
    default:
      return "";
  }
});
</script>
