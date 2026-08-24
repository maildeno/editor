<script setup lang="ts">
import { computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { resolveMobileProps, useHideClass } from "@/blocks/canvasStyleHelpers";

const props = defineProps<{
  component: { id: string; type: string; props: any };
}>();

const { previewMode, linksActive } = useEmailBuilder();

const componentProps = computed(() => props.component.props);
const hideClass = useHideClass(componentProps, previewMode);

// Extracted verbatim from CanvasComponent.vue's socialsContainerStyles.
const containerStyles = computed(() => {
  const p = resolveMobileProps(props.component.props, previewMode);
  return {
    margin: `${p.margin.top}px ${p.margin.right}px ${p.margin.bottom}px ${p.margin.left}px`,
    padding: `${p.padding.top}px ${p.padding.right}px ${p.padding.bottom}px ${p.padding.left}px`,
    textAlign: p.align,
  };
});

// Extracted verbatim from CanvasComponent.vue's enabledSocials.
const enabledSocials = computed(() =>
  (props.component.props.platforms ?? []).filter((p: any) => p.enabled && p.link),
);

// Extracted verbatim from CanvasComponent.vue's socialsAnchorStyles.
function socialsAnchorStyles(index: number, total: number) {
  const p = resolveMobileProps(props.component.props, previewMode);
  const halfSpacing = Math.ceil((p.spacing ?? 0) / 2);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return {
    display: "inline-block",
    marginLeft: isFirst ? "0px" : halfSpacing + "px",
    marginRight: isLast ? "0px" : halfSpacing + "px",
  };
}

// Extracted verbatim from CanvasComponent.vue's socialIconStyles.
const socialIconStyles = computed(() => {
  const p = resolveMobileProps(props.component.props, previewMode);
  return {
    width: p.iconSize + "px",
    height: p.iconSize + "px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
});

function handleLinkClick(event: MouseEvent) {
  if (!linksActive.value) {
    event.preventDefault();
  }
}
</script>

<template>
  <div :style="containerStyles" :class="hideClass">
    <div
      v-if="!component.props.platforms.some((p: any) => p.enabled && p.link)"
      class="text-gray-400 text-sm italic py-4"
    >
      Add social link from panel
    </div>
    <a
      v-for="(platform, index) in enabledSocials"
      :key="platform.name"
      :href="platform.link"
      :style="socialsAnchorStyles(Number(index), enabledSocials.length)"
      target="_blank"
      rel="noopener noreferrer nofollow"
      @click="handleLinkClick"
    >
      <div :style="socialIconStyles">
        <img
          :src="platform.icon"
          :alt="platform.name"
          :width="component.props.iconSize"
          :height="component.props.iconSize"
          :style="{ display: 'block' }"
        />
      </div>
    </a>
  </div>
</template>
