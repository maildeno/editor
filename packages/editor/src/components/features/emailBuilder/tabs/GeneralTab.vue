<template>
  <div class="h-[calc(100vh-7.5rem)] overflow-y-auto">
    <div class="px-4 pt-3 pb-4">
      <!-- Tabs - Minimal Pill Style -->
      <div class="flex gap-1 p-0.5 bg-(--md-surface-muted) rounded-lg">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
          :class="
            activeTab === tab
              ? 'bg-(--md-surface) text-(--md-text) shadow-sm'
              : 'text-(--md-text-subtle) hover:text-(--md-text-muted) hover:bg-(--md-surface-hover)'
          "
        >
          {{ tab }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="mt-4">
        <StylesTab v-if="activeTab === 'Styles'" />
        <MergeTagsTab v-if="activeTab === 'Tags'" />
        <VisibilityTab v-if="activeTab === 'Visibility'" />
        <VisibilityWrapESPTab v-if="activeTab === 'ESP'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import StylesTab from "./general/StylesTab.vue";
import MergeTagsTab from "./general/MergeTagsTab.vue";
import VisibilityTab from "./general/VisibilityTab.vue";
import VisibilityWrapESPTab from "./general/VisibilityWrapESPTab.vue";

const tabs = ["Styles", "Tags", "Visibility", "ESP"];
const activeTab = ref("Styles");
</script>
