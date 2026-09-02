// composables/system/useColorScheme.ts
//
// Puts the page's dark-mode class onto the editor's own root element.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Every dark rule this package ships is keyed on `.dark` — the token block in
// main.css, and every `dark:` utility via the @custom-variant at the top of
// that file. Hosts put that class on <html>. In neither shipped build does it
// reach the editor:
//
//   Light DOM   The library build scopes the injected stylesheet
//               (scopeInjectedCss.ts), so `:root` is rewritten to
//               `.md-editor-scope` — the editor's own root div. A custom
//               property declared DIRECTLY on that element beats any value
//               inherited from an ancestor, whatever the specificity, so a
//               dark value sitting on <html> never arrives. This is why
//               theming worked in the playground (which aliases straight to
//               source and never runs the scoper) and did nothing at all in a
//               consuming app.
//
//   Shadow DOM  `.dark` on <html> is outside the shadow tree entirely.
//               Descendant combinators do not cross the boundary, and
//               :host-context() is still unimplemented in Safari and Firefox.
//
// Mirroring the class onto the editor root fixes both at once, and fixes them
// without any selector in the package changing shape: the root matches
// `.dark`, everything inside it matches `.dark *`, and `:host(.dark)` matches
// once the same class is reflected onto the custom-element host.
//
// ── Why a MutationObserver and not a prop ───────────────────────────────────
// A prop would work, but it makes every host wire their switcher into the
// editor by hand and puts the editor one render behind the rest of the page
// on every flip. Reading the class the host already sets means an existing
// theme switcher drives the editor with no integration at all. `colorMode` is
// there for the cases that need to be explicit — a light editor deliberately
// embedded in a dark page, or a host whose switcher uses some other signal.

import { computed, onUnmounted, ref, watch, type Ref } from "vue";

/**
 * `auto` follows the host page. `light` and `dark` pin the editor regardless
 * of what the page is doing — useful when the editor is embedded in a shell
 * whose theme it should not inherit.
 */
export type ColorMode = "light" | "dark" | "auto";

const DARK_CLASS = "dark";

/**
 * True when the host page is in dark mode.
 *
 * Checks <html> and <body>, because both are common places to put the class
 * and neither is wrong. Anything else — a data attribute, a class on some
 * inner wrapper, a store — is what `colorMode` is for.
 */
function readPageDark(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains(DARK_CLASS) ||
    document.body?.classList.contains(DARK_CLASS) === true
  );
}

/**
 * @param mode    The `colorMode` prop, as a ref.
 * @param host    The custom-element host when running under element.ts, else
 *                null. Reflected onto as well, so `:host(.dark)` matches in an
 *                unscoped shadow build.
 */
export function useColorScheme(
  mode: Ref<ColorMode | undefined>,
  host: HTMLElement | null = null,
) {
  const pageIsDark = ref(readPageDark());

  const isDark = computed(() => {
    const m = mode.value ?? "auto";
    return m === "auto" ? pageIsDark.value : m === "dark";
  });

  if (
    typeof document !== "undefined" &&
    typeof MutationObserver !== "undefined"
  ) {
    const sync = () => {
      pageIsDark.value = readPageDark();
    };

    // Attribute-filtered rather than a subtree observer: this fires only when
    // `class` changes on the two elements that can carry the flag, which is a
    // handful of callbacks per session rather than one per DOM mutation
    // anywhere on the page.
    const observer = new MutationObserver(sync);
    const opts = { attributes: true, attributeFilter: ["class"] };

    observer.observe(document.documentElement, opts);
    if (document.body) observer.observe(document.body, opts);

    // The class can also land between setup() and mount — the no-flash boot
    // scripts most SSR apps inline in <head> run before Vue, but a client-only
    // switcher may not. One re-read on the next frame costs nothing and closes
    // that window.
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(sync);

    onUnmounted(() => observer.disconnect());
  }

  // The root div gets the class declaratively, via :class in the template —
  // applied during the same patch as first render, so there is no frame where
  // the editor is light inside a dark page. The custom-element host is outside
  // this component's template, so it is toggled here instead.
  watch(isDark, (dark) => host?.classList.toggle(DARK_CLASS, dark), {
    immediate: true,
  });

  onUnmounted(() => host?.classList.remove(DARK_CLASS));

  return { isDark };
}
