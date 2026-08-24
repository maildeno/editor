/**
 * Fixes a real, browser-level Shadow DOM limitation that no amount of
 * getting the CSS *into* the shadow root can solve: `@font-face`,
 * `@property`, and `@import` are **document-scoped at-rules**. Declared
 * inside a shadow root, browsers silently ignore them. The rules are
 * present, the CSS is valid, nothing errors — they just do nothing.
 *
 * Two very visible symptoms this causes, both confirmed from real
 * browser behavior rather than automated tests (jsdom checks DOM
 * structure, never font loading or the real CSS cascade, so this class of
 * bug is invisible to it):
 *
 *  1. Icon fonts render blank. A rule like `.icon:before{content:"\ue001"}`
 *     applies correctly, but the `@font-face` defining the family is
 *     dropped — so the glyph has no font to come from, while inline SVG
 *     icons are unaffected. That asymmetry makes it look like "only some
 *     icons broke". The Satoshi brand font, pulled in via `@import`, hits
 *     the same wall.
 *
 *  2. Tailwind v4 looks broken/scattered. It emits `@property` rules
 *     (`--tw-border-style`, `--tw-shadow`, the transform variables, and
 *     so on) purely to give those custom properties their initial
 *     values. Dropped inside a shadow root, every
 *     `var(--tw-border-style)` resolves to nothing, so borders, shadows,
 *     and transforms silently stop applying while plain utilities like
 *     flex/padding keep working.
 *
 * The fix is simply to also place these specific rules in document.head,
 * where they're valid — the rest of the CSS stays in the shadow root,
 * where it still provides the isolation the custom element exists for.
 * Fonts and registered custom properties are global by nature; there's
 * no isolation to lose by hoisting them.
 */

// Neither @font-face nor @property blocks can contain nested braces, so
// matching to the first closing brace is safe here — no real CSS parser
// needed for this narrow case.
const DOCUMENT_SCOPED_BLOCK_RE = /@(?:font-face|property)[^{]*\{[^}]*\}/g;
const IMPORT_RE = /@import[^;]+;/g;

let injected = false;

/**
 * Extracts every document-scoped rule from the given stylesheets and adds
 * them to document.head. Idempotent — safe to call on every mount, and on
 * every element instance if several exist on one page.
 */
export function injectDocumentScopedRules(cssStrings: string[]): void {
  if (injected || typeof document === "undefined") return;
  injected = true;

  const imports: string[] = [];
  const blocks: string[] = [];

  for (const css of cssStrings) {
    if (!css) continue;
    imports.push(...(css.match(IMPORT_RE) ?? []));
    blocks.push(...(css.match(DOCUMENT_SCOPED_BLOCK_RE) ?? []));
  }

  if (!imports.length && !blocks.length) return;

  try {
    const style = document.createElement("style");
    style.setAttribute("data-maildeno-document-scoped", "");
    // @import must precede every other rule in the stylesheet it's part
    // of, hence imports first here rather than in source order.
    style.textContent = `${imports.join("\n")}\n${blocks.join("\n")}`;
    document.head.appendChild(style);
  } catch (e) {
    console.error(
      "[maildeno-editor] failed to inject document-scoped style rules " +
        "(fonts and Tailwind custom properties may not apply):",
      e,
    );
  }
}
