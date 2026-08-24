/**
 * useLayerHoverScroll
 * Watches layerHoveredId and scrolls the canvas so the matching element is
 * centred vertically. Debounced to avoid spamming scroll during fast hover.
 *
 * this file had zero import statements — it relied entirely
 * on Nuxt's auto-import for watch/onUnmounted (and previously useState).
 * That's the quiet-failure category: a bare unimported identifier doesn't
 * break the build, it throws ReferenceError only once this code actually
 * runs, which the build has no way to catch.
 *
 * Convention: every canvas row / component root must carry data-layer-id="<id>".
 * Usage: call once, e.g. in LayersPanel.vue setup.
 *
 * ── Why the tuning changed ──────────────────────────────────────────────────
 * Previous version: 80 ms debounce + `behavior: "smooth"` unconditionally.
 *
 * The problem:
 * 1. 80 ms is short enough that hovering through 5 layers at normal mouse
 * speed triggers 5 scrolls back-to-back.
 * 2. "smooth" scrolls SERIALIZE — the browser starts animating scroll #1,
 * then scroll #2 interrupts it, then #3 interrupts #2, and so on.
 * The canvas visibly "chases the cursor", never settling. This reads
 * as lag even though no JS is slow.
 *
 * The fix (three levers):
 * 1. Debounce bumped to 150 ms — long enough that mouse-transit across
 * layers coalesces into one scroll, short enough that a deliberate
 * hover still feels instant.
 * 2. If the target is already comfortably inside the viewport, skip the
 * scroll entirely. No visible change means no wasted animation frame
 * and no interruption of any ongoing smooth scroll.
 * 3. If the target is far away (> half a viewport out of view), use
 * `behavior: "auto"` (instant jump). Smooth-scrolling hundreds of
 * pixels takes ~400 ms and nobody wants to watch it. Use smooth only
 * for small nearby corrections where the animation aids orientation.
 */

import { watch, onUnmounted, type Ref, getCurrentInstance } from "vue";

function getScrollParent(el: HTMLElement): HTMLElement {
 let node: HTMLElement | null = el.parentElement;
 while (node && node !== document.documentElement) {
 const { overflowY, overflow } = window.getComputedStyle(node);
 if (
 /(auto|scroll)/.test(overflowY + overflow) &&
 node.scrollHeight > node.clientHeight
 ) {
 return node;
 }
 node = node.parentElement;
 }
 return document.documentElement;
}

function scrollContainerTo(
 container: HTMLElement,
 top: number,
 behavior: ScrollBehavior,
) {
 if (container === document.documentElement) {
 window.scrollTo({ top, behavior });
 } else {
 container.scrollTo({ top, behavior });
 }
}

export function useLayerHoverScroll(
 layerHoveredId: Ref<string | null>,
 options?: {
 canvasSelector?: string;
 behavior?: ScrollBehavior;
 delay?: number;
 /**
 * Margin (in px) from the viewport edges within which the target is
 * considered "comfortably visible" and no scroll is needed. Default 80 px
 * gives breathing room on both sides without being so generous that
 * elements land right against an edge.
 */
 inViewMargin?: number;
 /**
 * If the target is more than this many pixels from the current scroll
 * position, use instant jump instead of smooth scroll. Default 600 px
 * covers roughly half a typical viewport — anything farther than that
 * should teleport, not animate.
 */
 instantThreshold?: number;
}) {
 const instance = getCurrentInstance();
 const {
 canvasSelector = "[data-canvas-scroll]",
 behavior = "smooth",
 // Bumped from 80 → 150 ms. See header comment for rationale.
 delay = 150,
 inViewMargin = 80,
 instantThreshold = 600,
 } = options ?? {};

 let timer: ReturnType<typeof setTimeout> | null = null;

 const scrollToId = (id: string | null) => {
 if (!id) return;
 // Rooted at the calling component's own node rather than document:
 // document.querySelector cannot see into a shadow root, so this
 // returned null for the entire custom-element build and silently
 // disabled layer hover-scroll there while working fine in the plain
 // Vue path. Resolved lazily (not at setup time) because the root
 // element does not exist until after mount.
 const hostEl = instance?.proxy?.$el as Element | undefined;
 const searchRoot = (hostEl?.getRootNode() ?? document) as
 | Document
 | ShadowRoot;
 const scope =
 searchRoot.querySelector<HTMLElement>(canvasSelector) ?? searchRoot;
 const el = scope.querySelector<HTMLElement>(`[data-layer-id="${id}"]`);
 if (!el) return;

 const scrollContainer = getScrollParent(el);
 const currentScrollTop =
 scrollContainer === document.documentElement
 ? window.pageYOffset
 : scrollContainer.scrollTop;
 const viewportHeight =
 scrollContainer === document.documentElement
 ? window.innerHeight
 : scrollContainer.clientHeight;
 const containerRect =
 scrollContainer === document.documentElement
 ? { top: 0 }
 : scrollContainer.getBoundingClientRect();

 const elOffsetTop =
 el.getBoundingClientRect().top - containerRect.top + currentScrollTop;
 const elHeight = el.offsetHeight;
 const elOffsetBottom = elOffsetTop + elHeight;

 // ── Skip if already comfortably in view ──────────────────────────────────
 // Visible region in content-space: [currentScrollTop, currentScrollTop + viewportHeight]
 // With margin, the "comfortable" window shrinks on both ends.
 const viewTop = currentScrollTop + inViewMargin;
 const viewBottom = currentScrollTop + viewportHeight - inViewMargin;

 if (elOffsetTop >= viewTop && elOffsetBottom <= viewBottom) {
 // Fully inside the comfortable window — no scroll needed.
 return;
 }

 // ── Compute target scroll (centre element vertically) ────────────────────
 const targetScrollTop = elOffsetTop - viewportHeight / 2 + elHeight / 2;

 // ── Choose behaviour based on distance ──────────────────────────────────
 // Large jumps use "auto" to avoid the "slowly chasing" feeling.
 // Small corrections use the caller-preferred behaviour (default smooth).
 const distance = Math.abs(targetScrollTop - currentScrollTop);
 const chosenBehavior: ScrollBehavior =
 distance > instantThreshold ? "auto" : behavior;

 scrollContainerTo(scrollContainer, targetScrollTop, chosenBehavior);
 };

 watch(layerHoveredId, (id) => {
 if (timer) clearTimeout(timer);
 if (!id) return;
 timer = setTimeout(() => scrollToId(id), delay);
 });

 onUnmounted(() => {
 if (timer) clearTimeout(timer);
 });
}
