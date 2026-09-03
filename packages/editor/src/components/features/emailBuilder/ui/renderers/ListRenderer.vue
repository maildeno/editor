<script setup lang="ts">
import { computed } from "vue";
import RichTextBlock from "@/components/features/emailBuilder/ui/rich-text-editor/RichTextBlock.vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import {
  resolveMobileProps,
  resolveBackground,
  useHideClass,
} from "@/blocks/canvasStyleHelpers";

const props = defineProps<{
  component: { id: string; type: string; props: any };
}>();

const { previewMode } = useEmailBuilder();

const componentProps = computed(() => props.component.props);
const hideClass = useHideClass(componentProps, previewMode);

// Extracted verbatim from CanvasComponent.vue's listStyles computed.
const styles = computed(() => {
  const p = resolveMobileProps(props.component.props, previewMode);
  return {
    margin: `${p.margin.top}px ${p.margin.right}px ${p.margin.bottom}px ${p.margin.left}px`,
    padding: `${p.padding.top}px ${p.padding.right}px ${p.padding.bottom}px ${p.padding.left}px`,
    fontSize: p.fontSize + "px",
    letterSpacing: p.letterSpacing + "px",
    fontFamily: p.fontFamily,
    lineHeight: p.lineHeight,
    color: p.color,
    background: resolveBackground(p),
    "--list-item-spacing": p.itemSpacing + "px",
  };
});
</script>

<template>
  <RichTextBlock :component="component" :style="styles" :class="hideClass" />
</template>
