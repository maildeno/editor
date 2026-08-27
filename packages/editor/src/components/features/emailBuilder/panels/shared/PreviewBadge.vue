<template>
  <!--
    Shows the resolved merge tag value beneath an input when preview is active
    and the resolved string differs from the raw prop value.
    Keeps this repeated pattern in one place instead of copy-pasting it across
    every Properties component.
  -->
  <div
    v-if="active && resolved !== raw && resolved !== ''"
    class="mt-1.5 text-[11px] text-[var(--md-selection-fg)] bg-[var(--md-selection-bg)] px-1.5 py-0.5 rounded pointer-events-none truncate inline-block max-w-full"
    :title="resolved"
  >
    {{ resolved }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** Whether link tag preview mode is currently active */
  active: boolean;
  /** The merge-tag-resolved value */
  resolved: string;
  /** The raw prop value as stored (may contain {{ tags }}) */
  raw: string;
}>();
</script>
