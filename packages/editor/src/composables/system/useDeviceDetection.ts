// composables/system/useDeviceDetection.ts
//
// Gates the entire editor behind a desktop check.
//
// Why this is a composable driving `v-if`, rather than Tailwind's `hidden
// lg:block` — the two are not interchangeable here:
//
//   `v-if` unmounts. A CSS class only hides. With `hidden`, the whole editor
//   would still mount and run on a phone: every TipTap instance, drag-and-drop
//   listener, autosave timer and adapter call, all doing real work for a UI
//   nobody can see. It would also break measurement — floating toolbars and
//   pickers position themselves from getBoundingClientRect(), which returns
//   zeroes for a `display: none` subtree.
//
// So the branch is behavioural, not presentational, and CSS is the wrong tool.
// Tailwind's approach is right for the ordinary case — showing or hiding a
// button, stacking a layout — and this is worth spending a composable on
// precisely because it isn't that.
import { computed, ref, type Ref } from "vue";

/**
 * Matches Tailwind's `lg` breakpoint, so this gate and any `lg:` utility
 * agree on where "desktop" starts. Changing it here without changing the
 * Tailwind theme would let the two drift apart silently.
 */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * One MediaQueryList for the whole app, created on first use.
 *
 * The previous version created independent refs and a separate `resize`
 * listener per caller. With two callers gating on opposite conditions
 * (EmailEditor renders when desktop, DesktopOnlyNotice when not), two
 * independently-updated sources of truth could disagree for a frame and show
 * both or neither.
 */
let shared: Ref<boolean> | null = null;

function createDesktopRef(): Ref<boolean> {
  // Guarded for SSR and for any environment without matchMedia. Defaulting to
  // desktop is the safer failure: the editor renders rather than showing a
  // "desktop only" notice to someone who is on a desktop.
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return ref(true);
  }

  const mql = window.matchMedia(DESKTOP_QUERY);

  // Read synchronously rather than in onMounted. The old version initialised
  // to `false` and only measured after mount, so on a phone the editor
  // mounted, ran, and then unmounted a tick later — a visible flash and a
  // pile of wasted setup.
  const isDesktop = ref(mql.matches);

  // `change` fires once when the boundary is crossed. The old `resize`
  // listener fired continuously through a window drag and re-ran a
  // user-agent regex each time.
  mql.addEventListener("change", (e) => {
    isDesktop.value = e.matches;
  });

  // Deliberately never removed: it is one listener for the lifetime of the
  // page, shared by every caller. Tearing it down would mean refcounting
  // callers, and getting that wrong breaks the gate.
  return isDesktop;
}

export const useDeviceDetection = () => {
  shared ??= createDesktopRef();
  const isDesktop = shared;

  return {
    isDesktop,
    isMobile: computed(() => !isDesktop.value),
  };
};
