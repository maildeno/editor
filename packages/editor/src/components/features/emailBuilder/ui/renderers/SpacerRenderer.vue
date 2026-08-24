<script setup lang="ts">
import { computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import {
  resolveMobileProps,
  resolveBackground,
} from "@/blocks/canvasStyleHelpers";

const props = defineProps<{
  component: { id: string; type: string; props: any };
}>();

const { previewMode } = useEmailBuilder();

// Spacer uses its own distinct hide-indicator (bg-black/35 overlay), not the
// shared opacity-30 hideClass every other block uses — preserved exactly as
// CanvasComponent.vue originally had it, not assumed to match the pattern.
const hideClass = computed(() => [
  previewMode.value === "mobile" && props.component.props.mobileHide
    ? "bg-black/35"
    : "",
  previewMode.value === "desktop" && props.component.props.desktopHide
    ? "bg-black/35"
    : "",
]);

// Extracted verbatim from CanvasComponent.vue's spacerStyles.
const innerStyles = computed(() => {
  const p = resolveMobileProps(props.component.props, previewMode);
  return {
    width: "100%",
    height: p.height + "px",
    background: resolveBackground(p),
  };
});
</script>

<template>
  <div :class="hideClass">
    <div :style="innerStyles" />
  </div>
</template>
