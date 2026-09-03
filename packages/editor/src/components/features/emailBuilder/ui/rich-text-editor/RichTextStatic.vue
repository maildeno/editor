<script setup lang="ts">
/**
 * Non-editable stand-in for RichTextEditor, shown for the moment between
 * a text block mounting and the TipTap chunk arriving.
 *
 * TipTap and ProseMirror are ~745kB of the bundle and RichTextEditor is
 * the only thing that pulls them, so they load as a separate chunk. But
 * RichTextEditor is not just the edit surface — it is how heading,
 * paragraph and list blocks render at all, so deferring it with nothing
 * in its place leaves the canvas blank until the chunk lands.
 *
 * The root element and content classes mirror RichTextEditor's exactly,
 * so the swap is invisible: same box, same typography, same wrapping.
 * Fallthrough `style` and `class` land on the same root either way.
 *
 * Merge tags render through a TipTap NodeView, so their raw markup shows
 * here for that one frame. Everything else is identical.
 */
defineProps<{
  component: {
    id: string;
    type: string;
    props: { content: string };
  };
}>();
</script>

<template>
  <div class="relative w-full">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      class="wrap-break-word outline-none tiptap-content"
      v-html="component.props.content || ''"
    />
  </div>
</template>
