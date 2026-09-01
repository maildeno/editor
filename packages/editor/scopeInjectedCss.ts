// scopeInjectedCss.ts
//
// Scopes the editor's global stylesheet so it cannot touch the host page.
//
// ── The problem ─────────────────────────────────────────────────────────────
// The Vue-component path injects the compiled Tailwind + editor CSS into
// document.head (the custom-element path puts it in a shadow root instead,
// where isolation is free). Measured on a real mount, that is ~183KB
// containing bare `.grid`, `.flex`, `.hidden`, `.block` utilities plus `html`,
// `body` and `h1`–`h6` element rules.
//
// In an app that also uses Tailwind, the editor's copy is injected later and
// wins on source order, so the host's own `.grid` starts behaving like the
// editor's. Element rules are worse: they apply to the host's `<body>` and
// headings regardless of whether the host uses Tailwind at all.
//
// ── The fix ─────────────────────────────────────────────────────────────────
// Prefix every rule with `:where(.md-editor-scope)`, which the editor root
// carries. `:where()` contributes zero specificity, so inside the editor the
// cascade is exactly as before — no rule suddenly outranks another because of
// this pass. Outside, nothing matches.
//
// Three categories need different handling, which is why this is a real
// PostCSS pass rather than a string replace:
//
//   • `@font-face`, `@property`, `@keyframes`, `@import` — document-scoped by
//     nature. Left global; scoping them would break them (and @property in
//     particular is what makes Tailwind's `--tw-*` variables resolve at all).
//   • `:root` — retargeted to the scope class, since the editor's design
//     tokens must live on the editor root rather than the document root.
//   • `html` / `body` — these style the page, which an embedded component has
//     no business doing. Rewritten to the scope root so they style the
//     editor's own container instead.

import type { Plugin } from "vite";
import postcss from "postcss";

export const SCOPE_CLASS = "md-editor-scope";

/** At-rules whose children are declarations, not selectors, or which must stay
 *  document-level to work at all. */
const SKIP_AT_RULES = new Set([
  "font-face",
  "property",
  "keyframes",
  "-webkit-keyframes",
  "import",
  "charset",
  "namespace",
  "counter-style",
  "font-feature-values",
  "page",
]);

function scopeSelector(sel: string, scope: string): string {
  const s = sel.trim();
  if (!s) return s;

  // Already scoped (idempotent — the pass can run twice in watch mode).
  if (s.includes(`.${scope}`)) return s;

  // Tokens on :root belong on the editor root, not the document root.
  if (s === ":root" || s === ":host" || s === ":host(.dark)") {
    return s === ":host(.dark)" ? `.${scope}.dark` : `.${scope}`;
  }
  if (s.startsWith(":root")) return `.${scope}${s.slice(5)}`;

  // Page-level element selectors: retarget to the container rather than
  // dropping them, because some carry the editor's own background and font
  // stack, which it does need.
  if (/^(html|body)$/.test(s)) return `.${scope}`;
  if (/^(html|body)[\s.:[]/.test(s)) {
    return `.${scope}${s.replace(/^(html|body)/, "")}`;
  }

  // `::backdrop` and top-layer pseudo-elements aren't inside the subtree, so
  // a descendant combinator would stop them matching.
  if (s.startsWith("::backdrop")) return s;

  return `:where(.${scope}) ${s}`;
}

export function scopeCss(css: string, scope = SCOPE_CLASS): string {
  const root = postcss.parse(css);

  root.walkRules((rule) => {
    // Rules inside @keyframes have percentage/from/to "selectors".
    const parent = rule.parent as { type?: string; name?: string } | undefined;
    if (
      parent?.type === "atrule" &&
      SKIP_AT_RULES.has(String(parent.name).toLowerCase())
    ) {
      return;
    }
    rule.selectors = rule.selectors.map((s) => scopeSelector(s, scope));
  });

  return root.toString();
}

/**
 * Applies scopeCss to the stylesheets imported with `?inline` — the ones that
 * get injected at runtime. Component `<style scoped>` blocks are untouched:
 * Vue's data-v attributes already isolate them.
 */
export function scopeInjectedCssPlugin(): Plugin {
  return {
    name: "maildeno:scope-injected-css",
    enforce: "post",
    transform(code, id) {
      if (!id.includes("assets/css/") || !id.includes("?inline")) return null;

      // ?inline modules arrive as `export default "…css…"`. Pull the literal,
      // transform, and re-emit rather than trying to regex the CSS in place.
      const m = code.match(/export\s+default\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
      if (!m) {
        this.warn(
          `[maildeno] could not scope ${id} — unexpected ?inline output shape. ` +
            `The editor's CSS will leak into the host page.`,
        );
        return null;
      }

      const original = JSON.parse(
        m[1][0] === "'" ? `"${m[1].slice(1, -1).replace(/"/g, '\\"')}"` : m[1],
      ) as string;

      return {
        code: `export default ${JSON.stringify(scopeCss(original))}`,
        map: null,
      };
    },
  };
}
