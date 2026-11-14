<template>
  <div :style="containerStyles" :class="visibilityClass">
    <a
      v-if="component.props.enabled && resolvedLink"
      :href="resolvedLink"
      target="_blank"
      rel="noopener noreferrer nofollow"
      :style="{
        display: 'inline-block',
        width: `${p.width}%`,
        textDecoration: 'none',
        lineHeight: 0,
      }"
      @click="handleLinkClick"
    >
      <img :src="resolvedSrc" :alt="resolvedAlt" :style="linkedImageStyles" />
    </a>

    <img v-else :src="resolvedSrc" :alt="resolvedAlt" :style="imageStyles" />
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { resolveString } from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";
import { boxShadowValue } from "@/composables/emailBuilder/core/boxShadow";

const props = defineProps<{
  component: {
    id: string;
    type: "image";
    props: Record<string, any>;
  };
}>();

const {
  linkTagPreviewContext,
  linkTagPreviewActive,
  previewMode,
  linksActive,
} = useEmailBuilder();

/**
 * Prevents navigation if links are toggled off.
 * This allows right-clicking to work normally.
 */
const handleLinkClick = (event: MouseEvent) => {
  if (!linksActive.value) {
    event.preventDefault();
    // Optional: You could trigger a small toast notification here
    // to remind yourself why the link didn't open.
  }
};

// ─── Mobile prop resolution ───────────────────────────────────────────────────

const p = computed(() => {
  const raw = props.component.props;
  if (previewMode.value !== "mobile" || !raw.mobile) return raw;
  const out = { ...raw };
  Object.entries(raw.mobile).forEach(([key, val]) => {
    if (val !== null && val !== undefined) out[key] = val;
  });
  return out;
});

// ─── Merge tag resolution ─────────────────────────────────────────────────────

const resolve = (val: string) =>
  resolveString(
    val ?? "",
    linkTagPreviewContext.value,
    linkTagPreviewActive.value,
  );

const resolvedSrc = computed(() => resolve(props.component.props.src));
const resolvedAlt = computed(() => resolve(props.component.props.alt));
const resolvedLink = computed(() => resolve(props.component.props.link));

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyles = computed(() => ({
  margin: `${p.value.margin.top}px ${p.value.margin.right}px ${p.value.margin.bottom}px ${p.value.margin.left}px`,
  padding: `${p.value.padding.top}px ${p.value.padding.right}px ${p.value.padding.bottom}px ${p.value.padding.left}px`,
  textAlign: p.value.align,
  lineHeight: 0,
  fontSize: 0,
}));

const imageStyles = computed<CSSProperties>(() => ({
  width: `${p.value.width}%`,
  height: p.value.height === "auto" ? "auto" : `${p.value.height}px`,
  objectFit: "cover",
  borderRadius: `${p.value.borderRadius}px`,
  border: `${p.value.border.width}px ${p.value.border.style} ${p.value.border.color}`,
  // An <img> has no inside to draw an inset shadow in, so it is drawn outside.
  boxShadow:
    boxShadowValue(p.value.boxShadow, { allowInset: false }) || undefined,
  display: "inline-block",
  verticalAlign: "top", // or "middle" / "bottom"
}));

const linkedImageStyles = computed<CSSProperties>(() => ({
  ...imageStyles.value,
  width: "100%",
}));

// ─── Visibility ───────────────────────────────────────────────────────────────

const visibilityClass = computed(() => {
  const { mobileHide, desktopHide } = props.component.props;
  if (previewMode.value === "mobile" && mobileHide) return "opacity-30";
  if (previewMode.value === "desktop" && desktopHide) return "opacity-30";
  return "";
});
</script>
