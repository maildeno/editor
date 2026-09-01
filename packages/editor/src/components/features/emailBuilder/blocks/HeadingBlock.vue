<template>
  <SidebarBlockButton label="Heading" component-type="heading">
    <!-- Lucide: Heading -->
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-full"
    >
      <path d="M6 12h12" />
      <path d="M6 4v16" />
      <path d="M18 4v16" />
    </svg>
  </SidebarBlockButton>
</template>

<script setup lang="ts">
import SidebarBlockButton from "../sidebar/SidebarBlockButton.vue";
</script>
