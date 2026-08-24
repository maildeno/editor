<template>
  <div>
    <!-- Tabs - Ghost Style -->
    <div class="flex gap-4">
      <button
        v-for="tab in tabs"
        :key="tab"
        @click="activeTab = tab"
        class="text-xs font-medium transition-colors pb-1"
        :class="
          activeTab === tab
            ? 'text-gray-900 border-b-2 border-gray-900'
            : 'text-gray-300 hover:text-gray-500 border-b-2 border-transparent'
        "
      >
        {{ tab }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="mt-4">
      <MergeTagTab v-if="activeTab === 'Merge Tag'" />
      <LinkTagTab v-if="activeTab === 'Link Tag'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import MergeTagTab from "./merge-tags/MergeTagTab.vue";
import LinkTagTab from "./merge-tags/LinkTagTab.vue";

const tabs = ["Merge Tag", "Link Tag"];
const activeTab = ref("Merge Tag");
</script>
