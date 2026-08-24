<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

onMounted(() => {
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});
</script>

<template>
  <div
    class="fixed inset-0 z-110 flex flex-col items-center justify-center bg-white backdrop-blur-sm overflow-hidden"
  >
    <!-- Animated Logo -->
    <div class="relative mb-6">
      <div class="w-16 h-16 flex items-center justify-center">
        <div
          class="absolute w-16 h-16 rounded-full border-2 border-gray-100 animate-ping opacity-75"
        />
        <div
          class="absolute w-12 h-12 rounded-full border-2 border-t-[#42389E] border-r-[#42389E] border-b-transparent border-l-transparent animate-spin"
        />
        <div
          class="w-8 h-8 rounded-full bg-gradient-to-br from-[#42389E] to-[#6B5BC9] animate-pulse"
        />
      </div>
    </div>

    <!-- Loading Text with Dots Animation -->
    <div class="flex items-center gap-1 mb-2">
      <p class="text-lg font-medium">
        <span class="text-[#42389E]">mail</span>deno
      </p>
      <span class="flex gap-0.5 translate-y-0.5">
        <span
          class="w-1 h-1 bg-[#42389E] rounded-full animate-bounce"
          style="animation-delay: 0ms"
        />
        <span
          class="w-1 h-1 bg-[#42389E] rounded-full animate-bounce"
          style="animation-delay: 150ms"
        />
        <span
          class="w-1 h-1 bg-[#42389E] rounded-full animate-bounce"
          style="animation-delay: 300ms"
        />
      </span>
    </div>

    <!-- Subtle hint -->
    <p class="text-sm text-gray-400 mt-1 select-none">
      This may take a few seconds
    </p>
  </div>
</template>
