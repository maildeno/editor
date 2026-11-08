<template>
  <div class="w-85 p-3 flex flex-col sticky top-13 h-fit">
    <!-- Tabs - Segmented Control -->
    <div class="md-segmented flex rounded-md overflow-hidden mb-2">
      <button
        v-for="(tab, index) in tabs"
        :key="tab"
        @click="activeTab = tab"
        class="flex-1 px-3 py-1.5 text-sm font-medium transition-colors"
        :class="[
          activeTab === tab ? 'md-segment-active' : 'md-segment-idle',
          index < tabs.length - 1 ? 'md-segment-divider' : '',
        ]"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 md-surface-sidebar rounded-lg overflow-y-auto">
      <ContentTab v-if="activeTab === 'Content'" />
      <LayoutTab v-if="activeTab === 'Layout'" />
      <GeneralTab v-if="activeTab === 'General'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import ContentTab from "../tabs/content/ContentTab.vue";
import LayoutTab from "../tabs/LayoutTab.vue";
import GeneralTab from "../tabs/GeneralTab.vue";

const tabs = ["Content", "Layout", "General"];
// Kept in the editor instance, so the open tab is still there if this sidebar
// is removed and re-created.
const { sidebarUi } = useEmailBuilder();
const activeTab = toRef(sidebarUi, "leftTab");
</script>
