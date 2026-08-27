<template>
  <div class="border-t border-[var(--md-border)] py-3">
    <button
      @click="open = !open"
      class="w-full flex items-center justify-between text-left group focus:outline-none"
    >
      <h3 class="text-[11px] font-semibold uppercase tracking-[.06em] text-[var(--md-text-muted)] group-hover:text-[var(--md-text-subtle)] transition-colors">
        {{ title }}
      </h3>
      <svg
        class="w-3.5 h-3.5 text-[var(--md-text-muted)] group-hover:text-[var(--md-text-subtle)] transition-all duration-200"
        :class="{ '-rotate-90': !open }"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"
        stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>

    <Transition name="section-fade">
      <div v-if="open" class="mt-2.5 space-y-3">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({ title: String })
const open = ref(true)
</script>

<style scoped>
.section-fade-enter-active,
.section-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.section-fade-enter-from,
.section-fade-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>