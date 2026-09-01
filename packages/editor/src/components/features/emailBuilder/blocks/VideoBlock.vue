<template>
  <SidebarBlockButton label="Video" component-type="video">
    <!-- Lucide: Film -->
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-full"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M3 7h4" />
      <path d="M3 12h18" />
      <path d="M3 17h4" />
      <path d="M17 7h4" />
      <path d="M17 17h4" />
    </svg>
  </SidebarBlockButton>
</template>

<script setup lang="ts">
import SidebarBlockButton from "../sidebar/SidebarBlockButton.vue";
</script>
