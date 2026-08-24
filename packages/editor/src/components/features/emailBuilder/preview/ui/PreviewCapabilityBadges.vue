<template>
  <div
    class="flex flex-wrap gap-1.5"
    :class="{ 'justify-end': align === 'right' }"
  >
    <span
      v-for="cap in displayCapabilities"
      :key="cap.key"
      class="relative group/badge inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium border transition-colors cursor-default"
      :class="
        cap.supported
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-red-50 text-red-700 border-red-200'
      "
    >
      <svg
        v-if="cap.supported"
        class="w-2.5 h-2.5"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path
          d="M2 6.5L5 9L10 3.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <svg v-else class="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
        <path
          d="M3 3L9 9M9 3L3 9"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
      {{ cap.label }}

      <!-- Tooltip: styled to match canvas hover tooltips -->
      <span
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 pointer-events-none group-hover/badge:opacity-100 transition-opacity duration-150 z-50 max-w-[240px]"
      >
        <span
          class="block bg-gray-950 text-white text-[10.5px] font-normal leading-snug px-2 py-1.5 rounded shadow-lg whitespace-normal text-center"
        >
          {{ cap.title }}
        </span>
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-950 rotate-45"
        />
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
// components/preview/PreviewCapabilityBadges.vue
//
// Badge strip tuned for TABLE-BASED email HTML. The capabilities listed are
// the ones that materially affect rendering of your generator's output —
// not generic CSS features like flexbox/grid that aren't in the output at all.

import { computed } from "vue";
import type {
  ClientCapabilities,
  DarkModeStrategy,
} from "@/composables/emailBuilder/preview/useClientPreview";

const props = withDefaults(
  defineProps<{
    capabilities: ClientCapabilities;
    expanded?: boolean;
    align?: "left" | "right";
  }>(),
  { expanded: false, align: "left" },
);

interface CapabilityRow {
  key: string;
  label: string;
  supported: boolean;
  title: string;
}

// Compact view: 4 most-impactful indicators for table-based email.
// These are the ones that, when missing, visibly break a template.
const COMPACT_KEYS: (keyof ClientCapabilities)[] = [
  "webFonts",
  "gradients",
  "embeddedStyles",
  "mediaQueries",
];

// Expanded view: full matrix.
const EXPANDED_KEYS: (keyof ClientCapabilities)[] = [
  "webFonts",
  "gradients",
  "tdBorderRadius",
  "buttonBorderRadius",
  "boxShadow",
  "bgImageOnTd",
  "vml",
  "msoConditionals",
  "animatedGifs",
  "videoTag",
  "svgImg",
  "retinaImages",
  "mediaQueries",
  "embeddedStyles",
];

const LABELS: Record<keyof ClientCapabilities, string> = {
  webFonts: "Web fonts",
  gradients: "Gradients",
  tdBorderRadius: "Rounded TD",
  buttonBorderRadius: "Rounded button",
  boxShadow: "Box shadow",
  bgImageOnTd: "BG image",
  vml: "VML",
  msoConditionals: "MSO if",
  animatedGifs: "Animated GIF",
  videoTag: "HTML video",
  svgImg: "SVG image",
  retinaImages: "Retina",
  mediaQueries: "@media",
  embeddedStyles: "<style>",
  tableAlign: "Table align",
  tdPadding: "TD padding",
  darkModeStrategy: "Dark mode",
};

const TITLES: Record<keyof ClientCapabilities, string> = {
  webFonts: "Google Fonts / @font-face — falls back to system fonts when missing.",
  gradients: "CSS linear/radial gradients on <td>. Falls back to backgroundColor when missing.",
  tdBorderRadius: "border-radius on <td>. Outlook desktop ignores; buttons (on <a>) are fine.",
  buttonBorderRadius: "border-radius on <a> button. Works in Outlook desktop too (since 2016).",
  boxShadow: "box-shadow rendering. Only modern WebKit clients.",
  bgImageOnTd: "background-image on <td>. Outlook desktop needs VML.",
  vml: "Microsoft VML (used as fallback for gradients/bg images in Outlook desktop).",
  msoConditionals: "Honors <!--[if mso]> conditional comments for Outlook-only markup.",
  animatedGifs: "Animated GIFs. Outlook desktop shows only the first frame.",
  videoTag: "Native <video> tag. Only Apple Mail supports this.",
  svgImg: "SVG via <img src=*.svg>. Gmail strips, Outlook desktop refuses.",
  retinaImages: "Retina @2x images via srcset / width attribute.",
  mediaQueries: "@media (max-width: 600px) responsive queries.",
  embeddedStyles: "<style> tag in <head> respected. Outlook desktop ignores entirely.",
  tableAlign: 'Honors align="center" on <table> / <td>.',
  tdPadding: "CSS padding on <td>.",
  darkModeStrategy: "How the client behaves when the OS is in dark mode.",
};

function darkModeRow(strategy: DarkModeStrategy): CapabilityRow {
  const supported = strategy !== "none";
  let label = "Dark mode";
  let title = "";
  switch (strategy) {
    case "respects-meta":
      label = "Dark (native)";
      title = "Respects <meta name=color-scheme>. Your authored colors are preserved.";
      break;
    case "near-black-swap":
      label = "Dark (swap)";
      title = "Swaps near-black ↔ near-white. Brand colors are untouched.";
      break;
    case "partial-transparent":
      label = "Dark (partial)";
      title = "Only transparent backgrounds darken. Opaque cells stay as authored.";
      break;
    case "none":
      label = "No dark mode";
      title = "Client doesn't adapt to OS dark mode — recipients see the light design.";
      break;
  }
  return { key: "darkModeStrategy", label, supported, title };
}

const displayCapabilities = computed<CapabilityRow[]>(() => {
  const keys = props.expanded ? EXPANDED_KEYS : COMPACT_KEYS;
  const rows: CapabilityRow[] = keys.map((k) => ({
    key: k,
    label: LABELS[k],
    supported: Boolean(props.capabilities[k]),
    title: TITLES[k],
  }));
  if (props.expanded) {
    rows.push(darkModeRow(props.capabilities.darkModeStrategy));
  }
  return rows;
});
</script>