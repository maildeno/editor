<template>
  <SidebarBlockButton label="Spacer" component-type="spacer">
    <!-- Lucide: MoveVertical -->
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-full"
    >
      <polyline points="8 18 12 22 16 18" />
      <polyline points="8 6 12 2 16 6" />
      <line x1="12" x2="12" y1="2" y2="22" />
    </svg>
  </SidebarBlockButton>
</template>

<script setup lang="ts">
import SidebarBlockButton from "../sidebar/SidebarBlockButton.vue";
</script>
