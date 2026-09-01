<template>
  <div :style="containerStyles" :class="visibilityClass">
    <!--
      Email clients can't play video. The rendered output is always a linked
      cover image. In the canvas we show the real <video> element so the
      builder can verify the clip — but we still resolve all four fields
      so merge tags are visible during preview.
    -->
    <a
      v-if="resolvedFallbackLink || resolvedSrc"
      :href="resolvedFallbackLink || resolvedSrc"
      target="_blank"
      rel="noopener noreferrer nofollow"
      style="text-decoration: none; display: inline-block; width: 100%"
      @click="handleLinkClick"
    >
      <video
        :src="resolvedSrc || undefined"
        :poster="resolvedCoverImage || undefined"
        :style="videoStyles"
        controls
        preload="metadata"
      >
        {{ resolvedAlt }}
      </video>
    </a>

    <video
      v-else
      :src="resolvedSrc || undefined"
      :poster="resolvedCoverImage || undefined"
      :style="videoStyles"
      controls
      preload="metadata"
    >
      {{ resolvedAlt }}
    </video>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { resolveString } from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";

const props = defineProps<{
  component: {
    id: string;
    type: "video";
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

// ─── Merge tag resolution — all four personalisation targets ──────────────────

const resolve = (val: string) =>
  resolveString(
    val ?? "",
    linkTagPreviewContext.value,
    linkTagPreviewActive.value,
  );

const resolvedSrc = computed(() => resolve(props.component.props.src));
const resolvedAlt = computed(() => resolve(props.component.props.alt));
const resolvedFallbackLink = computed(() =>
  resolve(props.component.props.fallbackLink),
);
const resolvedCoverImage = computed(() =>
  resolve(props.component.props.coverImage),
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyles = computed(() => ({
  margin: `${p.value.margin.top}px ${p.value.margin.right}px ${p.value.margin.bottom}px ${p.value.margin.left}px`,
  padding: `${p.value.padding.top}px ${p.value.padding.right}px ${p.value.padding.bottom}px ${p.value.padding.left}px`,
  textAlign: p.value.align,
}));

const videoStyles = computed(() => ({
  width: "100%",
  height: p.value.height === "auto" ? "auto" : `${p.value.height}px`,
  borderRadius: `${p.value.borderRadius}px`,
  border: `${p.value.border.width}px ${p.value.border.style} ${p.value.border.color}`,
  display: "inline-block",
}));

// ─── Visibility ───────────────────────────────────────────────────────────────

const visibilityClass = computed(() => {
  const { mobileHide, desktopHide } = props.component.props;
  if (previewMode.value === "mobile" && mobileHide) return "opacity-30";
  if (previewMode.value === "desktop" && desktopHide) return "opacity-30";
  return "";
});
</script>
