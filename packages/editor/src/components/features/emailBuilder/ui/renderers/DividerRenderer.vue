<script setup lang="ts">
import { computed } from "vue";
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

// Extracted verbatim from CanvasComponent.vue's dividerContainerStyles.
const containerStyles = computed(() => {
  const p = resolveMobileProps(props.component.props, previewMode);
  return {
    margin: `${p.margin.top}px ${p.margin.right}px ${p.margin.bottom}px ${p.margin.left}px`,
    padding: `${p.padding.top}px ${p.padding.right}px ${p.padding.bottom}px ${p.padding.left}px`,
    textAlign: p.align,
  };
});

// Extracted verbatim from CanvasComponent.vue's dividerStyles.
const hrStyles = computed(() => {
  const p = resolveMobileProps(props.component.props, previewMode);
  return {
    margin:
      p.align === "center"
        ? "0 auto"
        : p.align === "right"
          ? "0 0 0 auto"
          : "0",
    width: p.width + "%",
    height: p.height + "px",
    background: resolveBackground(p),
    border: "none",
  };
});
</script>

<template>
  <div :style="containerStyles" :class="hideClass">
    <hr :style="hrStyles" />
  </div>
</template>
