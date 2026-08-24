<template>
  <div class="h-[calc(100vh-7.5rem)] overflow-y-auto">
    <div class="px-4 pt-3 pb-4">
      <!-- Tabs - Minimal Pill Style -->
      <div class="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
          :class="
            activeTab === tab
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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

<script setup>
import { ref } from "vue";
import StylesTab from "./general/StylesTab.vue";
import MergeTagsTab from "./general/MergeTagsTab.vue";
import VisibilityTab from "./general/VisibilityTab.vue";
import VisibilityWrapESPTab from "./general/VisibilityWrapESPTab.vue";

const tabs = ["Styles", "Tags", "Visibility", "ESP"];
const activeTab = ref("Styles");
</script>
