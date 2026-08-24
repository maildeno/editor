<template>
  <SidebarBlockButton label="Link" component-type="anchor">
    <!-- Lucide: Link2 -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-full">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  </SidebarBlockButton>
</template>

<script setup>
import SidebarBlockButton from "../sidebar/SidebarBlockButton.vue";
</script>