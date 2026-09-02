<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { DEFAULT_BRAND_NAME } from "@/brand";

interface Props {
  /**
   * Name shown under the spinner. Forwarded from EmailEditor's own
   * `brandName`, so a host sets it once and it reaches this overlay, the
   * desktop-only notice, and anywhere else the package signs its name.
   *
   * Same three-way contract as DesktopOnlyNotice: omit it for the package
   * default, pass a name to replace it, pass an empty string to render no
   * wordmark at all. An absent prop and a deliberately blank one are
   * different intents, which is why the empty case is a `v-if` below rather
   * than something folded into the default.
   */
  brandName?: string;
}

withDefaults(defineProps<Props>(), {
  brandName: DEFAULT_BRAND_NAME,
});

onMounted(() => {
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});
</script>

<template>
  <div
    class="fixed inset-0 z-9000 flex flex-col items-center justify-center bg-(--md-surface) backdrop-blur-sm overflow-hidden"
  >
    <!-- Animated Logo -->
    <div class="relative mb-6">
      <div class="w-16 h-16 flex items-center justify-center">
        <div
          class="absolute w-16 h-16 rounded-full border-2 border-(--md-border) animate-ping opacity-75"
        />
        <div
          class="absolute w-12 h-12 rounded-full border-2 border-t-(--md-primary) border-r-(--md-primary-hover) border-b-transparent border-l-transparent animate-spin"
        />
        <div
          class="w-8 h-8 rounded-full bg-linear-to-br from-(--md-primary) to-(--md-primary-hover) animate-pulse"
        />
      </div>
    </div>

    <!-- Wordmark + loading dots.
      The name renders in one colour rather than the two-tone "mail"+"deno"
      this used to hardcode. That split only ever worked for one specific
      word: there is no general rule for where to break an arbitrary host's
      brand, and guessing at one produces something worse than plain text.
      The accent still carries — the spinner ring above and the dots beside
      it are both --md-primary, so a themed editor still reads as themed. -->
    <div class="flex items-center gap-1 mb-2">
      <p v-if="brandName" class="text-lg font-medium text-(--md-text)">
        {{ brandName }}
      </p>
      <span class="flex gap-0.5 translate-y-0.5">
        <span
          class="w-1 h-1 bg-(--md-primary) rounded-full animate-bounce"
          style="animation-delay: 0ms"
        />
        <span
          class="w-1 h-1 bg-(--md-primary) rounded-full animate-bounce"
          style="animation-delay: 150ms"
        />
        <span
          class="w-1 h-1 bg-(--md-primary) rounded-full animate-bounce"
          style="animation-delay: 300ms"
        />
      </span>
    </div>

    <!-- Subtle hint -->
    <p class="text-sm text-(--md-text-subtle) mt-1 select-none">
      This may take a few seconds
    </p>
  </div>
</template>
