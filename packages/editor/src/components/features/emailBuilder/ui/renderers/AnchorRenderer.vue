<template>
  <!--
    Shared renderer for both "anchor" and "button" component types.
    Both share the same text/link props and merge tag resolution logic.
    Only their container and inner <a> styles differ, driven by `component.type`.
  -->
  <div :style="containerStyles" :class="visibilityClass">
    <a
      :href="resolvedLink"
      :style="innerStyles"
      target="_blank"
      rel="noopener noreferrer nofollow"
      @click="handleLinkClick"
    >
      <!-- No icon: plain text -->
      <template v-if="!hasIcon">{{ resolvedText }}</template>

      <!--
        With icon: the <a> itself is inline-flex (see innerStyles). That means
        the icon and text are direct flex children — no wrapper span needed.

        Why this matters: the previous "before looks taller than after" bug
        was NOT about internal layout symmetry. It was about the OUTER <a>'s
        baseline. When a wrapper was inline-flex inside an inline-block <a>,
        the <a> computed its line-box using the flex container's baseline —
        which is "first baseline-participating child":
          - after:  text is first → baseline = text baseline (normal)
          - before: img is first  → baseline = img's bottom edge (falls lower)
        That asymmetry forced the <a> to grow taller in "before" mode.

        By making the <a> ITSELF the flex container, we remove its own inline
        baseline box entirely — height now equals padding + max(child heights),
        identical regardless of child order.
      -->
      <template v-else>
        <img
          v-if="iconBefore"
          :src="p.icon"
          :alt="p.iconAlt || ''"
          :style="iconImgStyles"
          :aria-hidden="p.iconAlt ? undefined : 'true'"
        />
        <span :style="textSpanStyles">{{ resolvedText }}</span>
        <img
          v-if="!iconBefore"
          :src="p.icon"
          :alt="p.iconAlt || ''"
          :style="iconImgStyles"
          :aria-hidden="p.iconAlt ? undefined : 'true'"
        />
      </template>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useGoogleFonts } from "@/composables/system/useGoogleFonts";
import { resolveString } from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  component: {
    id: string;
    componentType: "anchor" | "button";
    props: Record<string, any>;
  };
}>();

// ─── Store ────────────────────────────────────────────────────────────────────

const {
  linkTagPreviewContext,
  linkTagPreviewActive,
  previewMode,
  linksActive,
} = useEmailBuilder();

const { loadGoogleFont } = useGoogleFonts();

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

// ─── Background resolver ──────────────────────────────────────────────────────

const resolveBackground = (props: Record<string, any>): string => {
  const bg = props.backgroundGradient;
  if (
    bg?.useGradient &&
    Array.isArray(bg.gradient?.colors) &&
    bg.gradient.colors.length >= 2
  ) {
    const stops = bg.gradient.colors
      .map((c: any) => `${c.color} ${c.position}%`)
      .join(", ");
    return bg.gradient.type === "radial"
      ? `radial-gradient(circle at center, ${stops})`
      : `linear-gradient(${bg.gradient.direction}, ${stops})`;
  }
  return props.backgroundColor;
};

// ─── Link tag resolution ──────────────────────────────────────────────────────

const resolvedText = computed(() =>
  resolveString(
    props.component.props.text ?? "",
    linkTagPreviewContext.value,
    linkTagPreviewActive.value,
  ),
);

const resolvedLink = computed(() =>
  resolveString(
    props.component.props.link ?? "",
    linkTagPreviewContext.value,
    linkTagPreviewActive.value,
  ),
);

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const hasIcon = computed(
  () => !!p.value.icon && props.component.componentType === "button",
);

// "before" is the default; anything other than "after" renders before.
const iconBefore = computed(() => p.value.iconPosition !== "after");

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// anchor: container has margin + padding; inner <a> has text styles only.
// button: container has margin only; inner <a> carries padding + background +
//         border + borderRadius (the full visual button shape).

const containerStyles = computed(() => {
  if (props.component.componentType === "button") {
    return {
      margin: `${p.value.margin.top}px ${p.value.margin.right}px ${p.value.margin.bottom}px ${p.value.margin.left}px`,
      textAlign: p.value.align,
    };
  }

  // anchor
  return {
    margin: `${p.value.margin.top}px ${p.value.margin.right}px ${p.value.margin.bottom}px ${p.value.margin.left}px`,
    padding: `${p.value.padding.top}px ${p.value.padding.right}px ${p.value.padding.bottom}px ${p.value.padding.left}px`,
    textAlign: p.value.align,
  };
});

const innerStyles = computed(() => {
  loadGoogleFont(p.value.fontFamily);

  const base = {
    color: p.value.color,
    fontSize: p.value.fontSize + "px",
    letterSpacing: p.value.letterSpacing + "px",
    fontWeight: p.value.fontWeight,
    fontFamily: p.value.fontFamily,
    textDecoration: "none",
    lineHeight: "1",
  };

  if (props.component.componentType === "button") {
    // Display mode depends on whether we have an icon:
    // - No icon: inline-block, text inside the <a> flows normally.
    // - With icon: inline-flex on the <a> itself — removes the inline
    //   baseline box that was causing the "before" height asymmetry.
    //   `align-items: center` vertically centres the icon with the text.
    const displayBlock = hasIcon.value
      ? {
          display: "inline-flex",
          alignItems: "center",
          // Keeps the button sitting on the same baseline as surrounding
          // inline content — matches inline-block's default behaviour.
          verticalAlign: "middle",
        }
      : { display: "inline-block" };

    return {
      ...base,
      ...displayBlock,
      padding: `${p.value.padding.top}px ${p.value.padding.right}px ${p.value.padding.bottom}px ${p.value.padding.left}px`,
      background: resolveBackground(p.value),
      borderRadius: p.value.borderRadius + "px",
      border: `${p.value.border.width}px ${p.value.border.style} ${p.value.border.color}`,
    };
  }

  // anchor
  return {
    ...base,
    textDecoration: p.value.textDecoration,
  };
});

// ─── Visibility class ─────────────────────────────────────────────────────────

const visibilityClass = computed(() => {
  const { mobileHide, desktopHide } = props.component.props;
  if (previewMode.value === "mobile" && mobileHide) return "opacity-30";
  if (previewMode.value === "desktop" && desktopHide) return "opacity-30";
  return "";
});

// ─── Icon / text child styles ────────────────────────────────────────────────

const iconImgStyles = computed(() => {
  if (!hasIcon.value) return {};
  const size = (p.value.iconSize ?? 20) + "px";
  const gap = (p.value.iconGap ?? 8) + "px";
  return {
    display: "block",
    width: size,
    height: size,
    flexShrink: "0",
    // Gap lives on the image (not the text) so changing iconPosition
    // can't drift — the "active" side of the image always owns the gap.
    marginRight: iconBefore.value ? gap : "0",
    marginLeft: iconBefore.value ? "0" : gap,
  };
});

// The text sibling: line-height:1 so it matches the <a>'s own line-height
// and doesn't drag extra vertical space into the flex row.
const textSpanStyles = computed(() => ({
  lineHeight: "1",
}));
</script>
