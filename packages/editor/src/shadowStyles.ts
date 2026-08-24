import { getBaseStyles } from "./baseStyles";

/**
 * Builds the stylesheet set handed to defineCustomElement for the shadow
 * root.
 *
 * The UI is built from local components styled with Tailwind and scoped
 * CSS, so the whole stylesheet is already part of the bundle — this only
 * has to assemble it in the right order.
 */

/**
 * Every Vue <style scoped> block across the component tree, substituted in
 * at build time by vite.config.element.ts's plugin. Vite extracts these
 * into a separate CSS asset that nothing would otherwise load, and they
 * have to be inside the shadow root to apply at all.
 *
 * A build-time string replacement rather than a runtime global: ESM
 * hoists imports, so the shared chunk holding this file finishes
 * evaluating before any statement prepended to an entry chunk could run.
 * Left as the raw placeholder when unreplaced (running from source, as
 * the playground does), and treated as empty in that case rather than
 * emitted as junk CSS.
 */
function extractedScopedCss(): string {
  const raw = "__MAILDENO_EXTRACTED_CSS_PLACEHOLDER__";
  return raw.startsWith("__MAILDENO_EXTRACTED") ? "" : raw;
}

/**
 * False when running from source, where the build-time substitution above
 * never ran and the shadow root therefore has no component CSS. Used to
 * decide whether the dev style mirror is needed — a capability check rather
 * than an environment guess, so it self-corrects in either direction.
 */
export function hasExtractedScopedCss(): boolean {
  return extractedScopedCss() !== "";
}

let cachedStyles: string[] | null = null;

export function buildShadowStyles(): string[] {
  if (cachedStyles) return cachedStyles;
  // Base styles (Tailwind + the editor's own CSS + fonts) first, then
  // component-level scoped styles last so they win the cascade, exactly
  // as they would in a normal non-shadow-DOM build.
  cachedStyles = [...getBaseStyles(), extractedScopedCss()];
  return cachedStyles;
}
