<template>
  <div
    class="flex flex-col h-full rounded-xl border overflow-hidden transition-colors"
    :class="
      isDark ? 'bg-[#0b0b0c] border-(--md-border)' : 'bg-(--md-surface) border-(--md-border)'
    "
  >
    <!-- ── Header (window chrome) ────────────────────────────────────────── -->
    <div
      class="flex items-center gap-3 px-3 py-2.5 border-b shrink-0 transition-colors"
      :class="
        isDark
          ? 'border-(--md-border) bg-[#101012]'
          : 'border-(--md-border) bg-(--md-surface-hover)/70'
      "
    >
      <!-- Traffic-light dots — decorative window indicator. -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span
          class="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"
          aria-hidden="true"
        />
        <span
          class="w-2.5 h-2.5 rounded-full bg-[#febc2e]"
          aria-hidden="true"
        />
        <span
          class="w-2.5 h-2.5 rounded-full bg-[#28c840]"
          aria-hidden="true"
        />
      </div>

      <!-- Address-bar–style client identifier -->
      <div
        class="flex-1 min-w-0 flex items-center gap-2 rounded-md px-2.5 py-1.5 border transition-colors"
        :class="
          isDark ? 'bg-[#1a1a1d] border-(--md-border)' : 'bg-(--md-surface) border-(--md-border)'
        "
      >
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :style="{ backgroundColor: client.accentColor }"
        />
        <span
          class="text-[12px] font-medium truncate"
          :class="isDark ? 'text-(--md-text-subtle)' : 'text-(--md-text)'"
        >
          {{ client.name }}
        </span>
        <span
          class="text-[10.5px] truncate"
          :class="isDark ? 'text-(--md-text-subtle)' : 'text-(--md-text-subtle)'"
        >
          · {{ client.engine }} · {{ client.viewportWidth }}px
        </span>
        <span
          v-if="client.forcesMobile"
          class="ml-auto inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
          :class="
            isDark
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-(--md-warning-bg) text-(--md-warning-fg)'
          "
        >
          <svg class="w-2 h-2.5" viewBox="0 0 8 10" fill="none">
            <rect
              x="0.5"
              y="0.5"
              width="7"
              height="9"
              rx="1"
              stroke="currentColor"
              stroke-width="1"
            />
            <circle cx="4" cy="7.5" r="0.6" fill="currentColor" />
          </svg>
          Mobile
        </span>
      </div>

      <!-- Light / Dark toggle -->
      <div
        class="inline-flex items-center rounded-md p-0.5 shrink-0 border transition-colors"
        :class="
          isDark ? 'bg-[#1a1a1d] border-(--md-border)' : 'bg-(--md-surface) border-(--md-border)'
        "
        role="radiogroup"
        aria-label="Color mode"
      >
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-all"
          :class="
            !isDark
              ? 'bg-(--md-inverse-surface) text-(--md-on-inverse)'
              : 'text-(--md-text-subtle) hover:text-(--md-on-inverse-muted)'
          "
          role="radio"
          :aria-checked="!isDark"
          @click="setMode(false)"
        >
          <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="2.5" fill="currentColor" />
            <path
              d="M6 1V2M6 10V11M1 6H2M10 6H11M2.5 2.5L3.2 3.2M8.8 8.8L9.5 9.5M2.5 9.5L3.2 8.8M8.8 3.2L9.5 2.5"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          Light
        </button>
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-all"
          :class="
            isDark
              ? 'bg-(--md-surface-muted) text-(--md-text)'
              : 'text-(--md-text-subtle) hover:text-(--md-text-muted)'
          "
          role="radio"
          :aria-checked="isDark"
          @click="setMode(true)"
        >
          <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M9.5 7.5A4 4 0 014.5 2.5a4 4 0 105 5z"
              fill="currentColor"
            />
          </svg>
          Dark
        </button>
      </div>
    </div>

    <!-- ── Dark-mode strategy note ────────────────────────────────────────── -->
    <Transition name="note">
      <div
        v-if="isDark && darkNote"
        class="px-4 py-2 text-[11.5px] border-b flex items-start gap-2 transition-colors"
        :class="
          darkNoteSeverity === 'info'
            ? isDark
              ? 'bg-blue-500/10 text-blue-200 border-(--md-border)'
              : 'bg-(--md-info-bg) text-(--md-info-fg) border-(--md-border)'
            : isDark
              ? 'bg-amber-500/10 text-(--md-warning-fg) border-(--md-border)'
              : 'bg-(--md-warning-bg)/80 text-(--md-warning-fg) border-(--md-border)'
        "
      >
        <svg
          class="w-3.5 h-3.5 mt-0.5 shrink-0"
          viewBox="0 0 14 14"
          fill="none"
        >
          <circle
            cx="7"
            cy="7"
            r="5.5"
            stroke="currentColor"
            stroke-width="1.2"
          />
          <path
            d="M7 4.5v3M7 9.5v.01"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
        <span class="leading-snug">
          <span class="font-semibold">{{ darkStrategyLabel }}:</span>
          {{ darkNote }}
        </span>
      </div>
    </Transition>

    <!-- ── Iframe viewport ────────────────────────────────────────────────── -->
    <!--
        We render the iframe at the CLIENT's natural viewport width, not the
        pane's width. If the pane is narrower than the client's viewport, the
        outer scroller handles horizontal overflow. This keeps the email's
        @media (max-width:600px) firing only when the TARGET CLIENT would
        fire it for a real recipient (e.g. Gmail Android: yes; Apple Mail
        desktop: no).

        LAYOUT NOTE (subtle but important):
        The previous structure used `flex items-start justify-center` to center
        the iframe wrapper. That looked fine at first, but when the iframe is
        WIDER than the flex container, `justify-content: center` centers the
        oversized child such that overflow happens equally on left AND right.
        The horizontal scrollbar then either doesn't appear (because flex
        containers don't always report negative-offset overflow) or appears
        but can't scroll to the left edge — content gets clipped and the
        scrollbar is missing. Confirmed by the screenshot at Outlook 365
        (680px) inside a ~640px pane.

        The fix: don't flex-center. Use a plain block child with
        `min-width: max-content` and `padding: 24px`. That makes the outer
        div's scrollWidth equal to (iframe width + padding), so the horizontal
        scrollbar appears reliably and you can scroll from edge to edge.
        The iframe wrapper still centers visually via `margin: 0 auto` when
        it fits within the pane.
    -->
    <div
      class="flex-1 overflow-auto transition-colors"
      :style="{ backgroundColor: chromeBg }"
    >
      <div
        class="p-6"
        :style="{
          minWidth: 'max-content',
          minHeight: '100%',
        }"
      >
        <div
          class="rounded-lg shadow-md overflow-hidden transition-colors"
          :class="isDark ? 'ring-1 ring-(--md-surface)/5' : ''"
          :style="{
            width: client.viewportWidth + 'px',
            maxWidth: 'none',
            margin: '0 auto',
            backgroundColor: emailSurfaceBg,
          }"
        >
          <iframe
            ref="iframeRef"
            :srcdoc="iframeSrcdoc"
            class="block border-0 transition-colors"
            :style="{
              width: client.viewportWidth + 'px',
              height: iframeHeight + 'px',
              backgroundColor: emailSurfaceBg,
            }"
            :title="`${client.name} preview`"
            sandbox="allow-same-origin allow-scripts"
            @load="onIframeLoad"
          />
        </div>
      </div>
    </div>

    <!-- ── Footer: capability snapshot ────────────────────────────────────── -->
    <!-- <div
      class="px-4 py-2.5 border-t transition-colors"
      :class="
        isDark
          ? 'bg-[#101012] border-(--md-border)'
          : 'bg-(--md-surface-hover)/70 border-(--md-border)'
      "
    >
      <PreviewCapabilityBadges :capabilities="client.capabilities" expanded />
    </div> -->
  </div>
</template>

<script setup lang="ts">
// components/preview/PreviewRendered.vue (v2)
//
// Right pane of the detail view. Loads the exported email HTML into a
// sandboxed iframe, then applies client-specific capability downgrades and
// honest dark-mode simulation:
//
// • Capability downgrades strip features the client can't render
// (web fonts, <style> in <head> for Outlook desktop, etc.)
// • Dark-mode strategy is per-client:
// - Apple Mail (respects-meta): nothing changes inside the email,
// only the surrounding "inbox chrome" goes dark. Author's authored
// colors are preserved exactly. This matches what the meta tag
// <meta name="color-scheme" content="light dark"> instructs.
// - Outlook web / 365 (near-black-swap): CSS targets near-black text
// and near-white backgrounds and swaps them. Brand colors are
// untouched. This is the FAMOUS "white logo on white becomes
// black on black" pitfall.
// - Gmail mobile (partial-transparent): body darkens, opaque cells
// stay as authored.
// - "none" clients: body stays light even in dark mode.
//
// We never apply a blanket `* { color/bg !important }` — that's what v1 did
// and it lies about what the recipient sees.

import { computed, nextTick, ref, watch } from "vue";
import {
  useClientPreview,
  type EmailClient,
} from "@/composables/emailBuilder/preview/useClientPreview";
// import PreviewCapabilityBadges from "./PreviewCapabilityBadges.vue";

const props = defineProps<{
  client: EmailClient;
  html: string;
}>();

const isDark = ref(false);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeHeight = ref(800);

const { transformForClient, darkModeCss, darkChromeBg, applyDarkModeDom } =
  useClientPreview();

function setMode(dark: boolean) {
  isDark.value = dark;
}

const chromeBg = computed(() => darkChromeBg(isDark.value));

// Background color for the iframe + its wrapper. This used to be a
// hardcoded `bg-(--md-surface)`, which was correct for opaque emails but lied
// when the email body had a transparent background — the white surface
// would show through. We now match the simulated body color so that, in
// dark mode, a transparent-bodied email sees the dark surface that the
// real client would have rendered.
//
// Clients that don't touch colors at all ("none") always show white; the
// email is what it is. Clients with dark-mode behavior get #1f1f1f under
// the iframe so the body's `background-color: #1f1f1f` injection meshes
// seamlessly with the surrounding ring/shadow.
const emailSurfaceBg = computed(() => {
  if (!isDark.value) return "#ffffff";
  const strategy = props.client.capabilities.darkModeStrategy;
  if (strategy === "none" || strategy === "respects-meta") return "#ffffff";
  return "#1f1f1f";
});

// Re-run the per-element dark-mode pass whenever isDark or the active
// client changes. The iframe srcdoc itself is bound to `iframeSrcdoc`
// (which closes over isDark via the injected `darkCss`), so any change
// here triggers a fresh iframe load → onIframeLoad → applyDarkModeDom.
// This watcher catches the case where isDark flips but the srcdoc is
// stable (e.g. tab loses focus then regains it). Cheap to run.
watch(
  () => [isDark.value, props.client.id],
  () => {
    const iframe = iframeRef.value;
    if (!iframe?.contentDocument) return;
    applyDarkModeDom(iframe.contentDocument, props.client, isDark.value);
  },
);

// ── Dark strategy presentation ────────────────────────────────────────────

const darkStrategyLabel = computed(() => {
  switch (props.client.capabilities.darkModeStrategy) {
    case "respects-meta":
      return "Native dark mode";
    case "near-black-swap":
      return "Near-black/white swap";
    case "partial-transparent":
      return "Luminance-based dark mode";
    case "none":
      return "No dark-mode handling";
    default:
      return "";
  }
});

interface DarkNote {
  text: string;
  severity: "info" | "warn";
}
const darkNoteData = computed<DarkNote | null>(() => {
  switch (props.client.capabilities.darkModeStrategy) {
    case "respects-meta":
      return {
        severity: "info",
        text: 'This client honors your <meta name="color-scheme"> declaration, so your authored colors render unchanged. Only the surrounding inbox chrome goes dark.',
      };
    case "near-black-swap":
      return {
        severity: "warn",
        text: "Outlook only swaps colors close to pure black and pure white. Brand colors are untouched — but white logos can flip black, and #111 body text becomes near-white. Test your logos and dividers.",
      };
    case "partial-transparent":
      return {
        severity: "warn",
        text: "Gmail applies a luminance-based color swap: near-white backgrounds darken and near-black text (including dark brand colors like #1C4534) lifts toward light. Mid-luminance brand colors are preserved. To opt out, ship a `prefers-color-scheme: dark` block.",
      };
    case "none":
      return null;
    default:
      return null;
  }
});

const darkNote = computed(() => darkNoteData.value?.text ?? "");
const darkNoteSeverity = computed(() => darkNoteData.value?.severity ?? "info");

// ── Build the iframe srcdoc ───────────────────────────────────────────────

const iframeSrcdoc = computed(() => {
  // client-aware HTML downgrades (strip web fonts, etc).
  const transformed = transformForClient(props.html, props.client);

  // build any styles we need to inject:
  // • Word-wrap defense — long URLs inside narrow <td> cells would
  // otherwise overflow the email container width. Real clients all do
  // this; we just make sure the iframe preview matches.
  // • Dark-mode simulation — client-specific.
  //
  // Word-wrap is only injected when the client honors <style> in <head>.
  // For Outlook desktop, the cell widths are anchored via VML and the
  // table-layout is fixed at the row level — overflow is unlikely.
  const supportsStyle = props.client.capabilities.embeddedStyles;

  const wrapCss = supportsStyle
    ? `
 td, p, h1, h2, h3, h4, h5, h6, li, a, span, div {
 overflow-wrap: break-word;
 word-wrap: break-word;
 }
 img { max-width: 100%; height: auto; }
 `
    : "";

  const darkCss = darkModeCss(props.client, isDark.value);

  const injected = [
    wrapCss && `<style id="__preview_wrap__">${wrapCss}</style>`,
    darkCss && `<style id="__preview_dark__">${darkCss}</style>`,
  ]
    .filter(Boolean)
    .join("");

  if (!injected) return transformed;

  if (/<\/head>/i.test(transformed)) {
    return transformed.replace(/<\/head>/i, `${injected}</head>`);
  }
  return `${injected}${transformed}`;
});

// Measure the iframe document height and resize the iframe element to fit,
// so the OUTER pane scroller owns vertical overflow (no nested scrollbars).
//
// We re-measure on every event that could change the layout:
// 1. After srcdoc loads (onIframeLoad → first measure).
// 2. After every image inside the iframe loads (height grows once each
// image's natural size kicks in). Without this, the iframe locks at
// the initial measurement and the bottom of the email is cut off.
// 3. After web fonts finish loading (text reflows, height changes).
// 4. ResizeObserver on the document body — catches anything else.
//
// `measureSoon()` debounces all these triggers so we measure once per
// animation frame instead of thrashing.

let measureRaf: number | null = null;
function measure() {
  measureRaf = null;
  const iframe = iframeRef.value;
  if (!iframe?.contentDocument) return;
  const doc = iframe.contentDocument;
  const body = doc.body;
  if (!body) return;

  // The naive `Math.max(body.scrollHeight, html.scrollHeight, ...)` creates a
  // FEEDBACK LOOP: once we set iframe.height to N, body.scrollHeight becomes
  // max(content, N), so the iframe never shrinks back down even when the
  // content gets smaller. The trailing empty space at the bottom is this bug.
  //
  // Reliable approach: measure the actual bottom edge of the last visible
  // descendant via getBoundingClientRect — that ignores the iframe's own
  // height and reports only where the content ends.
  let measured = 0;

  // Walk last child chain to find the deepest visible bottom edge.
  // Falls back to body.scrollHeight if the chain is empty (e.g. empty doc).
  if (body.lastElementChild) {
    const bodyRect = body.getBoundingClientRect();
    const bodyTop = bodyRect.top;
    // Find the maximum bottom across direct children — handles cases where
    // the last DOM child is shorter than an earlier sibling.
    let maxBottom = 0;
    for (const child of Array.from(body.children) as HTMLElement[]) {
      const r = child.getBoundingClientRect();
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    }
    measured = Math.ceil(maxBottom - bodyTop);
  } else {
    measured = body.scrollHeight;
  }

  iframeHeight.value = Math.max(200, measured);
}

function measureSoon() {
  if (measureRaf !== null) return;
  if (typeof window === "undefined") return;
  measureRaf = window.requestAnimationFrame(measure);
}

function onIframeLoad() {
  const iframe = iframeRef.value;
  if (!iframe?.contentDocument) return;

  const doc = iframe.contentDocument;

  // Apply the per-element dark-mode pass FIRST, before the first measure.
  // Doing this before nextTick(measure) prevents a one-frame flash where
  // the email shows its authored colors against the simulated dark body
  // surround. applyDarkModeDom is a no-op for clients that don't touch
  // colors ("none" / "respects-meta") and for isDark === false.
  applyDarkModeDom(doc, props.client, isDark.value);

  // First measure on next tick to give the parser a beat to finish.
  nextTick(measure);

  // Re-measure when each image loads.
  const imgs = Array.from(doc.images || []);
  for (const img of imgs) {
    if (!img.complete) {
      img.addEventListener("load", measureSoon, { once: true });
      img.addEventListener("error", measureSoon, { once: true });
    }
  }

  // Re-measure when web fonts finish loading.
  const fonts = (doc as any).fonts;
  if (fonts && typeof fonts.ready?.then === "function") {
    fonts.ready.then(() => measureSoon()).catch(() => {});
  }

  // Catch-all: ResizeObserver on body.
  if (typeof ResizeObserver !== "undefined" && doc.body) {
    const ro = new ResizeObserver(() => measureSoon());
    ro.observe(doc.body);
    // No disconnect needed — observer dies with the iframe doc on srcdoc change.
  }
}
</script>

<style scoped>
.note-enter-active,
.note-leave-active {
  transition:
    opacity 0.2s ease,
    max-height 0.25s ease;
  max-height: 60px;
  overflow: hidden;
}
.note-enter-from,
.note-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
