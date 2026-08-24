<template>
  <div class="border border-gray-200/80 rounded-lg p-3 bg-white space-y-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <label class="text-[10px] font-medium uppercase tracking-[.06em] text-gray-600">
        Personalization
      </label>
      <span class="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
        {{ defaultTags.length }} available
      </span>
    </div>

    <!-- Field target toggle — hidden when only one field is targetable -->
    <div
      v-if="resolvedFields.length > 1"
      class="flex items-center gap-1.5 flex-wrap"
    >
      <span class="text-[10px] text-gray-400 shrink-0">Insert into:</span>
      <button
        v-for="field in resolvedFields"
        :key="field"
        @click="$emit('focus', field)"
        class="text-[10px] px-2 py-0.5 rounded-full border transition-all focus:outline-none"
        :class="
          lastFocusedField === field
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
        "
      >
        {{ label(field) }}
      </button>
    </div>

    <!-- Default tag pills -->
    <div class="flex flex-wrap gap-1.5">
      <div
        v-for="tag in defaultTags"
        :key="tag"
        class="relative group/pill"
      >
        <button
          @click="prefill(tag)"
          class="px-2 py-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-md hover:border-green-200 hover:bg-green-50 hover:text-green-700 transition-all focus:outline-none"
        >
          &#123;&#123; {{ tag }} &#125;&#125;
        </button>
        <!-- Tooltip -->
        <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/pill:opacity-100 translate-y-1 group-hover/pill:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900">
          Insert &#123;&#123; {{ tag }} &#125;&#125;
        </div>
      </div>
    </div>

    <!-- Custom tag form -->
    <div class="space-y-1.5">
      <div class="flex items-center gap-1.5">
        <div class="relative flex-1">
          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none select-none">
            &#123;&#123;
          </span>
          <input
            ref="tagInputRef"
            v-model="customTag"
            type="text"
            placeholder="tag_name"
            class="w-full h-[32px] pl-5 pr-2 text-[13px] border border-gray-200/80 rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none transition-colors"
            @keydown.enter.prevent="insertCustom"
          />
        </div>
        <button
          @click="insertCustom"
          :disabled="!customTag.trim()"
          class="h-[32px] px-3 text-[13px] bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus:outline-none"
        >
          Insert
        </button>
      </div>

      <!-- Fallback default — only shown when a tag name is present -->
      <div v-if="customTag.trim()" class="relative mt-2">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 pointer-events-none select-none">
          default
        </span>
        <input
          v-model="customDefault"
          type="text"
          placeholder="fallback value (optional)"
          class="w-full h-7 pl-14 pr-2 text-xs border border-gray-200/80 rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-green-600 placeholder-gray-300 focus:outline-none transition-colors"
          @keydown.enter.prevent="insertCustom"
        />
      </div>

      <p v-if="customTag.trim()" class="text-[10px] text-gray-500 break-all">
        {{ tokenPreview }}
      </p>
    </div>

    <p class="text-[10px] text-gray-500">
      Use underscores: <span class="font-mono">reset_token</span>, <span class="font-mono">confirm_url</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";

const { saveToHistory } = useEmailBuilder();

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  defaultTags: string[];
  lastFocusedField: string;
  /**
   * Which fields are valid insertion targets.
   * Defaults to ['text', 'link'] to stay backward-compatible with
   * AnchorProperties which passes neither prop.
   */
  availableFields?: string[];
  /**
   * Display label overrides for field keys.
   * e.g. { src: 'Video URL', fallbackLink: 'Fallback Link' }
   * Falls back to built-in labels, then a capitalised version of the key.
   */
  fieldLabels?: Record<string, string>;
}>();

const emit = defineEmits<{
  insert: [payload: { tag: string; default: string }];
  focus: [field: string];
}>();

// ─── Field label resolution ───────────────────────────────────────────────────

const resolvedFields = computed(
  () => props.availableFields ?? ["text", "link"],
);

const BUILT_IN_LABELS: Record<string, string> = {
  text: "Link text",
  link: "URL",
  src: "URL",
  alt: "Alt text",
  fallbackLink: "Fallback link",
  coverImage: "Cover image",
};

const label = (field: string): string =>
  props.fieldLabels?.[field] ??
  BUILT_IN_LABELS[field] ??
  field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());

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

const prefill = (tag: string) => {
  customTag.value = tag;
  customDefault.value = "";
  insertCustom();
};

const insertCustom = () => {
  const tag = customTag.value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!tag) return;
  emit("insert", { tag, default: customDefault.value.trim() });
  customTag.value = "";
  customDefault.value = "";

  // Tracking state for auto save
  saveToHistory("merge-tag-insert-link");
  nextTick(() => tagInputRef.value?.focus());
};
</script>
