<script setup lang="ts">
/**
 * What heading, paragraph and list renderers mount instead of importing
 * RichTextEditor directly.
 *
 * Renders RichTextStatic first, then swaps in the real editor once its
 * chunk resolves. This keeps TipTap and ProseMirror — ~745kB, a quarter
 * of the bundle — out of the entry chunk, so the browser paints the
 * editor shell without parsing them first.
 *
 * The import is shared and started once: every text block on the canvas
 * awaits the same promise and swaps together, rather than each firing
 * its own request.
 *
 * Note this defers *parsing*, not downloading — the chunk is still
 * fetched on mount, so a session transfers the same bytes. The win is
 * time to first paint and time to interactive, which is what the weight
 * was actually costing.
 *
 * defineAsyncComponent's own loadingComponent cannot do this: Vue
 * renders it with no props, so it has no way to know what text to show.
 */
import { shallowRef, onMounted, type Component } from "vue";
import RichTextStatic from "./RichTextStatic.vue";

defineProps<{
  component: {
    id: string;
    type: string;
    props: { content: string };
  };
}>();

let pending: Promise<Component> | null = null;
const loadRichTextEditor = () =>
  (pending ??= import("./RichTextEditor.vue").then((m) => m.default));

const impl = shallowRef<Component>(RichTextStatic);

onMounted(() => {
  loadRichTextEditor().then((c) => {
    impl.value = c;
  });
});
</script>

<template>
  <component :is="impl" :component="component" />
</template>
