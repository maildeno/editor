<script setup lang="ts">
import { computed } from "vue";
import type { SupportLevel } from "@/composables/emailBuilder/export/logic/espLogicWrapper";

const props = defineProps<{
  level: SupportLevel;
  highlight?: boolean;
  espName?: string;
  operatorLabel?: string;
}>();

const map: Record<SupportLevel, { text: string; cls: string }> = {
  native: { text: "✓", cls: "text-emerald-500" },
  helper: { text: "~", cls: "text-amber-500" },
  fallback: { text: "⚠", cls: "text-orange-400" },
  none: { text: "–", cls: "text-gray-300" },
};

const badge = computed(() => map[props.level]);

const title = computed(() => {
  if (!props.highlight) return undefined;

  if (props.level === "none") {
    return `"${props.operatorLabel}" is not supported by ${props.espName}`;
  }
  if (props.level === "fallback") {
    return `"${props.operatorLabel}" uses fallback in ${props.espName}`;
  }
});
</script>

<template>
  <span
    :class="[
      'font-mono font-bold',
      badge.cls,
      highlight
        ? level === 'none'
          ? 'ring-1 ring-(--md-danger) bg-(--md-danger-bg) px-0.5 rounded'
          : 'ring-1 ring-(--md-warning) bg-(--md-warning-bg) px-0.5 rounded'
        : '',
    ]"
    :title="title"
  >
    {{ badge.text }}
  </span>
</template>
