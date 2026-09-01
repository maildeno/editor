<script setup lang="ts">
import { computed } from "vue";
import ParagraphBlock from "../blocks/ParagraphBlock.vue";
import HeadingBlock from "../blocks/HeadingBlock.vue";
import ImageBlock from "../blocks/ImageBlock.vue";
import VideoBlock from "../blocks/VideoBlock.vue";
import ListBlock from "../blocks/ListBlock.vue";
import ButtonBlock from "../blocks/ButtonBlock.vue";
import AnchorBlock from "../blocks/AnchorBlock.vue";
import DividerBlock from "../blocks/DividerBlock.vue";
import SpacerBlock from "../blocks/SpacerBlock.vue";
import MenuBlock from "../blocks/MenuBlock.vue";
import SocialsBlock from "../blocks/SocialsBlock.vue";
import SidebarBlockButton from "../sidebar/SidebarBlockButton.vue";
import { getAllBlocks } from "@/blocks/registry";

const BUILT_IN = new Set([
  "paragraph",
  "heading",
  "image",
  "video",
  "list",
  "button",
  "anchor",
  "divider",
  "spacer",
  "menu",
  "socials",
]);

/**
 * The built-ins above are listed explicitly to keep their order stable and
 * intentional; registered blocks append after them, in registration order.
 * Declared before the computed that reads it — a `const` referenced from a
 * lazily-evaluated closure still has to exist by the time it runs.
 */
const customBlocks = computed(() =>
  [...getAllBlocks().values()].filter(
    (b) => Boolean(b.icon) && !BUILT_IN.has(b.name),
  ),
);
</script>

<template>
  <div class="p-2 space-y-3 sticky top-13 h-fit z-40">
    <div
      class="w-15 py-2 flex flex-col items-center justify-center md-surface-sidebar rounded-xl space-y-2"
    >
      <ParagraphBlock />
      <HeadingBlock />
      <ImageBlock />
      <VideoBlock />
      <ListBlock />
      <ButtonBlock />
      <AnchorBlock />
      <DividerBlock />
      <SpacerBlock />
      <MenuBlock />
      <SocialsBlock />

      <!-- Blocks added via registerBlock(). Only those with an icon appear:
           without one there is nothing to render, and a blank button would be
           worse than no button. -->
      <SidebarBlockButton
        v-for="block in customBlocks"
        :key="block.name"
        :label="block.label ?? block.name"
        :component-type="block.name"
      >
        <component :is="block.icon" v-if="typeof block.icon !== 'string'" />
        <span v-else class="contents" v-html="block.icon" />
      </SidebarBlockButton>
    </div>
  </div>
</template>
