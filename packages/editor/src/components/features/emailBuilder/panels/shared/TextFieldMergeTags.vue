<template>
  <div class="border border-(--md-border)/80 rounded-lg p-3 bg-(--md-surface) space-y-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <label class="text-[10px] font-medium uppercase tracking-[.06em] text-(--md-text-muted)">
        Personalization
      </label>
      <span class="text-[10px] text-(--md-text-subtle) bg-(--md-surface-muted) px-2 py-0.5 rounded-full tabular-nums">
        {{ defaultTags.length }} available
      </span>
    </div>

    <!-- Default tag pills -->
    <div class="flex flex-wrap gap-1.5">
      <div
        v-for="tag in defaultTags"
        :key="tag"
        class="relative group/pill"
      >
        <button
          type="button"
          @click="prefill(tag)"
          class="relative px-2 py-1 text-xs bg-(--md-surface-hover) text-(--md-text-muted) border border-(--md-border) rounded-md hover:border-(--md-selection) hover:bg-(--md-selection-bg) hover:text-(--md-selection-fg) transition-all focus:outline-none"
        >
          <span>&#123;&#123; {{ tag }} &#125;&#125;</span>
          <!-- Default-value dot indicator -->
          <span
            v-if="tagDefaults[tag]"
            class="absolute -top-1 -right-1 w-2 h-2 bg-(--md-selection) rounded-full"
          />
        </button>
        <!-- Tooltip: shows default value when one exists, otherwise just the tag name -->
        <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/pill:opacity-100 translate-y-1 group-hover/pill:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg)">
          <template v-if="tagDefaults[tag]">default: "{{ tagDefaults[tag] }}"</template>
          <template v-else>Insert &#123;&#123; {{ tag }} &#125;&#125;</template>
        </div>
      </div>
    </div>

    <!-- Custom tag form -->
    <div class="space-y-1.5">
      <div class="flex items-center gap-1.5">
        <!-- Tag name -->
        <div class="relative flex-1">
          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-(--md-text-subtle) text-xs pointer-events-none select-none">
            &#123;&#123;
          </span>
          <input
            ref="tagInputRef"
            v-model="customTag"
            type="text"
            placeholder="tag_name"
            class="w-full h-[30px] pl-5 pr-2 text-[13px] text-(--md-text) border border-(--md-border)/80 rounded-md bg-(--md-surface) shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none transition-colors"
            @keydown.enter.prevent="insertCustom"
          />
        </div>
        <button
          type="button"
          :disabled="!customTag.trim()"
          @click="insertCustom"
          class="md-btn-primary h-[30px] px-3 text-[13px] rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus:outline-none"
        >
          Insert
        </button>
      </div>

      <!-- Fallback default -->
      <div v-if="customTag.trim()" class="relative mt-2">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-(--md-text-subtle) pointer-events-none select-none">
          default
        </span>
        <input
          v-model="customDefault"
          type="text"
          placeholder="fallback (optional)"
          class="w-full h-7 pl-14 pr-2 text-xs border border-(--md-border)/80 rounded-md bg-(--md-surface) shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-(--md-selection-fg) placeholder-(--md-text-subtle) focus:outline-none transition-colors"
          @keydown.enter.prevent="insertCustom"
        />
      </div>

      <!-- Token preview — only shown when a tag name is present -->
      <p v-if="customTag.trim()" class="text-[10px] text-(--md-text-subtle) break-all font-mono">
        {{ tokenPreview }}
      </p>
    </div>

    <!-- Helper -->
    <p class="text-[10px] text-(--md-text-subtle)">
      Use underscores: <span class="font-mono">product_name</span>, <span class="font-mono">order_id</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";

// ─── Props ────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    defaultTags?: string[];
    /**
     * Optional default/fallback values keyed by tag name.
     * A filled dot is shown on the pill when a default exists.
     * e.g. { first_name: 'Friend', company: 'Acme' }
     */
    tagDefaults?: Record<string, string>;
  }>(),
  {
    defaultTags: () => [
      "first_name",
      "last_name",
      "email",
      "company",
      "unsubscribe_link",
    ],
    tagDefaults: () => ({}),
  },
);

const emit = defineEmits<{
  insert: [payload: { tag: string; default: string }];
}>();

// ─── State ────────────────────────────────────────────────────────────────────

const tagInputRef = ref<HTMLInputElement | null>(null);
const customTag = ref("");
const customDefault = ref("");

const tokenPreview = computed(() => {
  const tag = customTag.value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!tag) return "";
  return customDefault.value.trim()
    ? `{{ ${tag}|'${customDefault.value.trim()}' }}`
    : `{{ ${tag} }}`;
});

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Click a pill → emit its pre-configured default immediately, no form interaction. */
const prefill = (tag: string) => {
  emit("insert", { tag, default: props.tagDefaults[tag] ?? "" });
};

const insertCustom = () => {
  const tag = customTag.value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!tag) return;
  emit("insert", { tag, default: customDefault.value.trim() });
  customTag.value = "";
  customDefault.value = "";
  nextTick(() => tagInputRef.value?.focus());
};
</script>
