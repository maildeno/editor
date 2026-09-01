<template>
  <div
    class="flex items-center bg-(--md-surface-muted)/80 border border-(--md-border)/60 rounded-xl p-0.5 gap-0.5 -translate-y-0.5"
    role="group"
    aria-label="Preview mode"
  >
    <button
      @click="setMode('desktop')"
      :class="buttonClass('desktop')"
      :aria-pressed="modelValue === 'desktop'"
      class="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-120"
    >
      <!-- Lucide: Monitor -->
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
      Desktop
    </button>

    <button
      @click="setMode('mobile')"
      :class="buttonClass('mobile')"
      :aria-pressed="modelValue === 'mobile'"
      class="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-120"
    >
      <!-- Lucide: Smartphone -->
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
      Mobile
    </button>
  </div>
</template>

<script setup lang="ts">
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";

const { previewMode } = useEmailBuilder();

const props = defineProps({
  modelValue: {
    type: String,
    default: "desktop",
  },
});

const emit = defineEmits(["update:modelValue"]);

const setMode = (mode: string) => {
  previewMode.value = mode;
  emit("update:modelValue", mode);
};

const buttonClass = (mode: string) =>
  props.modelValue === mode
    ? "bg-(--md-surface) text-(--md-text) shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.08)]"
    : "text-(--md-text-subtle) hover:text-(--md-text-muted)";
</script>
