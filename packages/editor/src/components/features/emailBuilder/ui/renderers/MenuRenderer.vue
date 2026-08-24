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

const { previewMode, linksActive } = useEmailBuilder();

const componentProps = computed(() => props.component.props);
const hideClass = useHideClass(componentProps, previewMode);

// Extracted verbatim from CanvasComponent.vue's menuContainerStyles.
const containerStyles = computed(() => {
  const p = resolveMobileProps(props.component.props, previewMode);
  return {
    margin: `${p.margin.top}px ${p.margin.right}px ${p.margin.bottom}px ${p.margin.left}px`,
    padding: `${p.padding.top}px ${p.padding.right}px ${p.padding.bottom}px ${p.padding.left}px`,
    background: resolveBackground(p),
    textAlign: p.align,
    lineHeight: "0",
  };
});

// Extracted verbatim from CanvasComponent.vue's enabledMenuItems.
const enabledMenuItems = computed(() =>
  (props.component.props.items ?? []).filter((i: any) => i.enabled && i.label),
);

// Extracted verbatim from CanvasComponent.vue's getMenuItemStyles.
function getMenuItemStyles(index: number, total: number) {
  const p = resolveMobileProps(props.component.props, previewMode);
  const isStacked = previewMode.value === "mobile" && p.mobileStack;
  const half = Math.ceil((p.spacing ?? 0) / 2);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return {
    display: isStacked ? "block" : "inline-block",
    marginLeft: isStacked ? "0px" : isFirst ? "0px" : half + "px",
    marginRight: isStacked ? "0px" : isLast ? "0px" : half + "px",
    marginBottom: isStacked && !isLast ? p.spacing + "px" : "0px",
    fontSize: p.fontSize + "px",
    lineHeight: String(p.lineHeight),
    letterSpacing: p.letterSpacing + "px",
    color: p.color,
    fontWeight: p.fontWeight,
    fontFamily: `'${p.fontFamily}', Arial, sans-serif`,
    fontStyle: p.fontStyle,
    textTransform: p.textTransform,
    textDecoration: p.textDecoration,
    whiteSpace: isStacked ? "normal" : "nowrap",
  };
}

// Extracted verbatim from CanvasComponent.vue's handleLinkClick.
function handleLinkClick(event: MouseEvent) {
  if (!linksActive.value) {
    event.preventDefault();
  }
}
</script>

<template>
  <div :style="containerStyles" :class="hideClass">
    <div
      v-if="!component.props.items.some((i: any) => i.enabled && i.label)"
      class="text-gray-400 text-sm italic py-4 text-center"
    >
      Add menu items from panel
    </div>
    <a
      v-for="(item, index) in enabledMenuItems"
      :key="item._id"
      :href="item.link || '#'"
      :style="getMenuItemStyles(Number(index), Number(enabledMenuItems.length))"
      target="_blank"
      rel="noopener noreferrer nofollow"
      @click="handleLinkClick"
    >
      {{ item.label }}
    </a>
  </div>
</template>
