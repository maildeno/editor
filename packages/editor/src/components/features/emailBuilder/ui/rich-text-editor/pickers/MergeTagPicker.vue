<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      v-if="visible"
      ref="pickerRef"
      data-merge-picker
      role="listbox"
      aria-label="Merge tag picker"
      class="fixed z-50 w-56 bg-(--md-overlay-bg) border border-(--md-overlay-border) rounded-xl shadow-(--md-overlay-shadow) overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
      @mousedown.prevent
    >
      <!-- Search input -->
      <div class="px-2 pt-2 pb-1">
        <div class="relative">
          <span
            class="absolute left-2 top-1/2 -translate-y-1/2 text-(--md-text-subtle) text-xs pointer-events-none"
          >
            &#123;&#123;
          </span>
          <input
            ref="searchRef"
            v-model="query"
            type="text"
            placeholder="tag_name"
            aria-autocomplete="list"
            class="w-full pl-6 pr-2 py-1.5 text-xs bg-(--md-surface-hover) text-(--md-text) rounded-md outline-none focus:ring-1 focus:ring-(--md-selection) placeholder-(--md-text-subtle)"
            @keydown="handleInputKeydown"
          />
        </div>
      </div>

      <!-- Filtered tag list -->
      <ul class="max-h-44 overflow-y-auto py-1">
        <!-- Matching known tags -->
        <li
          v-for="(tag, i) in filteredTags"
          :key="tag"
          role="option"
          :aria-selected="i === activeIndex"
          class="flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer transition-colors"
          :class="
            i === activeIndex
              ? 'bg-(--md-selection-bg) text-(--md-selection-fg)'
              : 'text-(--md-text-muted) hover:bg-(--md-surface-hover)'
          "
          @mouseenter="activeIndex = i"
          @click="commitTag(tag)"
        >
          <span>&#123;&#123; {{ tag }} &#125;&#125;</span>
          <span v-if="i === activeIndex" class="text-[9px] text-(--md-text-subtle)"
            >↵ insert</span
          >
        </li>

        <!-- Custom entry when query doesn't exactly match any tag -->
        <li
          v-if="showCustomEntry"
          role="option"
          :aria-selected="activeIndex === filteredTags.length"
          class="flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer transition-colors border-t border-(--md-border)"
          :class="
            activeIndex === filteredTags.length
              ? 'bg-(--md-selection-bg) text-(--md-selection-fg)'
              : 'text-(--md-text-subtle) hover:bg-(--md-surface-hover)'
          "
          @mouseenter="activeIndex = filteredTags.length"
          @click="commitCustom"
        >
          <span>&#123;&#123; {{ normalizedQuery }} &#125;&#125;</span>
          <span class="text-[9px] text-(--md-text-subtle) ml-1 shrink-0">custom</span>
        </li>

        <!-- Empty state -->
        <li
          v-if="filteredTags.length === 0 && !showCustomEntry"
          class="px-3 py-2 text-xs text-(--md-text-subtle) text-center"
        >
          Type a tag name
        </li>
      </ul>

      <!-- Footer hint -->
      <div
        class="px-3 py-1.5 border-t border-(--md-border) flex items-center justify-between"
      >
        <span class="text-[9px] text-(--md-text-subtle)"
          >↑↓ navigate · ↵ insert · Esc cancel</span
        >
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";

// ─── Props & emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean;
  position: { top: number; left: number };
  /** All known tag names the user can pick from */
  defaultTags: string[];
}>();
const teleportTarget = useTeleportTarget();

const emit = defineEmits<{
  /** User confirmed a tag — parent replaces the raw {{ with a mergeTag node */
  commit: [tag: string];
  /** User cancelled (Esc or click-outside) — parent deletes the raw {{ */
  cancel: [];
}>();

// ─── State ────────────────────────────────────────────────────────────────────

const pickerRef = ref<HTMLElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const activeIndex = ref(0);

const normalizedQuery = computed(() =>
  query.value.trim().toLowerCase().replace(/\s+/g, "_"),
);

const filteredTags = computed(() => {
  const q = normalizedQuery.value;
  if (!q) return props.defaultTags;
  return props.defaultTags.filter((t) => t.includes(q));
});

const showCustomEntry = computed(() => {
  const q = normalizedQuery.value;
  return q.length > 0 && !filteredTags.value.includes(q);
});

// Total selectable rows (known tags + optional custom row)
const totalItems = computed(
  () => filteredTags.value.length + (showCustomEntry.value ? 1 : 0),
);

// ─── Reset when picker opens ──────────────────────────────────────────────────

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    query.value = "";
    activeIndex.value = 0;
    nextTick(() => searchRef.value?.focus());
  },
);

// Keep activeIndex in bounds when the list changes
watch(filteredTags, () => {
  activeIndex.value = Math.min(activeIndex.value, totalItems.value - 1);
  if (activeIndex.value < 0) activeIndex.value = 0;
});

// ─── Keyboard navigation ──────────────────────────────────────────────────────

const handleInputKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      activeIndex.value = (activeIndex.value + 1) % totalItems.value;
      break;
    case "ArrowUp":
      e.preventDefault();
      activeIndex.value =
        (activeIndex.value - 1 + totalItems.value) % totalItems.value;
      break;
    case "Enter":
    case "Tab":
      e.preventDefault();
      confirmActive();
      break;
    case "Escape":
      e.preventDefault();
      emit("cancel");
      break;
  }
};

// ─── Commit helpers ───────────────────────────────────────────────────────────

const confirmActive = () => {
  if (activeIndex.value < filteredTags.value.length) {
    commitTag(filteredTags.value[activeIndex.value]);
  } else if (showCustomEntry.value) {
    commitCustom();
  }
};

const commitTag = (tag: string) => {
  emit("commit", tag);
  query.value = "";
};

const commitCustom = () => {
  const q = normalizedQuery.value;
  if (!q) return;
  emit("commit", q);
  query.value = "";
};
</script>
