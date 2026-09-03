// Shared between shadowStyles.ts (injects into the shadow root, for the
// custom-element path) and EmailEditor.vue (injects into document.head
// directly, for the plain Vue-component path — see that file's own
// onMounted comment for why). Extracted here so neither duplicates these
// three imports.
//
// Covers three things: Tailwind's compiled utility classes, the editor's
// own CSS, and the Satoshi brand font. Component styling lives in each
// component's own scoped <style> block and is collected separately.

// ?inline gives the fully Vite/Tailwind-compiled CSS as a plain string,
// not auto-injected into the page. Handles Tailwind's whole-project
// utility-class scan correctly; no manual work needed here.
// @ts-expect-error -- Vite's ?inline query suffix has no type declaration
import mainCss from "./assets/css/main.css?inline";
// Icons are inline SVG (components/ui/Icon.vue) rather than an icon
// font — no @font-face to load, and no font to go missing inside a
// shadow root, where browsers ignore @font-face entirely.
// @ts-expect-error -- Vite's ?inline query suffix has no type declaration
import fontsCss from "./assets/css/fonts.css?inline";

/**
 * Every Vue <style scoped> block across the component tree, substituted in
 * at build time by vite.config.ts's plugin. Mirrors what
 * shadowStyles.ts does for the custom-element path.
 *
 * It has to be a value this module *returns*, not a statement that runs
 * for its effect. package.json's `sideEffects` list covers CSS files
 * only, which declares every .js file in the package pure — a promise
 * consumers'
 * bundlers act on: a top-level statement whose result nothing reads is
 * legal to delete. 0.4.2 delivered this CSS as exactly such a statement,
 * prepended to the entry chunk, and Rollup emitted that entry as a thin
 * facade holding nothing but the statement and some re-exports — so
 * consumer builds dropped the whole file and every scoped style with it.
 * Reachable from EmailEditor.vue through getBaseStyles(), it cannot be
 * dropped without dropping the component.
 *
 * Left as the raw placeholder when the substitution never ran (running
 * from source, as the playground does), and treated as empty then rather
 * than emitted as junk CSS.
 */
function extractedScopedCss(): string {
  const raw = "__MAILDENO_INDEX_SCOPED_CSS__";
  return raw.startsWith("__MAILDENO_INDEX") ? "" : raw;
}

let cached: string[] | null = null;

/** Tailwind, the editor's own CSS and the Satoshi font, as independent CSS
 *  strings — each becomes its own <style> tag wherever the caller injects them. */
export function getBaseStyles(): string[] {
  if (cached) return cached;
  cached = [fontsCss as string, mainCss as string, extractedScopedCss()];
  return cached;
}

let injectedIntoHead = false;

/**
 * Injects getBaseStyles() directly into document.head, exactly once no
 * matter how many times it's called — called from EmailEditor.vue on
 * every mount, so multiple <EmailEditor> instances on one page (or one
 * instance unmounting and remounting) don't each inject a duplicate copy.
 * Genuinely module-level, not per-component-instance state: this file is
 * only ever evaluated once, the first time anything imports it, regardless
 * of how many EmailEditor instances get created afterward.
 */
export function injectBaseStylesIntoHead(): void {
  if (injectedIntoHead) return;
  injectedIntoHead = true;
  for (const css of getBaseStyles()) {
    if (!css) continue;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }
}
