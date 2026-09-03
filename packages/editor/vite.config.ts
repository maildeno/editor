import { defineConfig } from "vite";
import { scopeInjectedCssPlugin } from "./scopeInjectedCss";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/**
 * Substitutes every bit of CSS this build extracts — critically including
 * all the Vue <style scoped> blocks from across the component tree — into
 * baseStyles.ts's placeholder, so EmailEditor.vue injects it on mount
 * alongside Tailwind and the fonts.
 *
 * Those scoped styles are collected by Vite into a separate
 * dist/editor.css asset that nothing in the consumer's module graph ever
 * imports, since styling moved to programmatic injection (which only
 * covered the base layer — Tailwind, icons, fonts — not these).
 *
 * 0.4.2 delivered them by prepending a self-executing snippet to the
 * entry chunk. That worked in this repo and broke for anyone installing
 * from npm: package.json declares `sideEffects: ["**\/*.css"]`, marking
 * every .js file pure, and Rollup emitted dist/index.js as a thin facade
 * containing only that snippet and a set of re-exports. A consumer's
 * bundler is entitled to delete a pure module whose exports it can reach
 * directly — so it dropped the facade, the snippet went with it, and
 * every scoped style vanished. Confirmed by building a consumer against
 * the published 0.4.2 tarball: zero of the 32 scoped selectors survived.
 *
 * Whether Rollup emits that facade depends on chunking, which is why the
 * same source built fine here. Substitution into a value the component
 * actually reads removes the dependence on tree-shaking entirely — the
 * same reasoning vite.config.element.ts already documents for the shadow
 * root.
 *
 * The CSS asset is deliberately left in place as well, not deleted — it
 * costs nothing, and a consumer who'd rather control load order manually
 * can still import "@maildeno/editor/style.css" themselves.
 */
function injectExtractedCssViaJs() {
  return {
    name: "maildeno-inject-extracted-css",
    apply: "build" as const,
    // Vite emits the extracted CSS asset during generateBundle itself —
    // without enforce:"post" this hook runs first and sees an empty
    // bundle, silently substituting nothing at all.
    enforce: "post" as const,
    generateBundle(this: any, _options: unknown, bundle: Record<string, any>) {
      let css = "";
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === "asset" && fileName.endsWith(".css")) {
          css += `\n${asset.source}`;
        }
      }
      if (!css.trim()) return;
      const placeholder = '"__MAILDENO_INDEX_SCOPED_CSS__"';
      let replaced = false;
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code.includes(placeholder)) {
          chunk.code = chunk.code.replace(placeholder, JSON.stringify(css));
          replaced = true;
        }
      }
      // Fails the build rather than warning. A missing substitution ships
      // an editor with no component styling at all, and 0.4.2 proved that
      // is not obvious enough in a build log to catch before publishing.
      if (!replaced) {
        this.error(
          "[maildeno] scoped-style placeholder not found in any chunk — " +
            "component <style scoped> blocks would be missing from the " +
            "Vue-component build. Check baseStyles.ts still contains " +
            "__MAILDENO_INDEX_SCOPED_CSS__.",
        );
      }
    },
  };
}

/**
 * The "index" build pass — Vue-component usage (EmailEditor + adapters +
 * registries + theme). vue stays external since the consumer's
 * own Vue app already provides them.
 *
 * See vite.config.element.ts for the second pass — element.ts/init.ts
 * (custom-element usage) need those bundled IN instead, since a
 * React/Angular/plain-HTML host has neither on the page at all. Rollup's
 * `external` is a whole-build decision, not per-entry, so this genuinely
 * needs to be two separate config files/invocations, not one config
 * trying to serve both — plain `vite build` doesn't support an array of
 * configs the way some other Vite-based tools (e.g. Vitest) do; confirmed
 * by actually trying it and reading the real error.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    // Scopes the injected stylesheet to the editor subtree so it can't
    // restyle the host page. Must run before the ?inline import is frozen.
    scopeInjectedCssPlugin(),
    vue(),
    tailwindcss(),
    dts({
      tsconfigPath: "./tsconfig.json",
      // Required for SFC declarations. Defaults to "ts", under which
      // unplugin-dts skips .vue entirely and emits nothing for them —
      // silently, because its own warning only fires when the entry or
      // an include glob literally contains ".vue", and neither does
      // here (entry is index.ts, include is "src"). That silence is why
      // dist/index.d.ts shipped re-exporting EmailEditor.vue from a
      // path that was never emitted.
      processor: "vue",
    }),
    injectExtractedCssViaJs(),
  ],
  build: {
    // Pinned explicitly (not left to Vite's default, which has shifted
    // across major versions) — unminified so consumers' own bundlers can
    // tree-shake and minify against their target, and so the injected
    // CSS string above stays readable for debugging.
    minify: "esbuild",
    cssMinify: true,
    lib: {
      entry: { index: "./src/index.ts" },
      formats: ["es"],
    },
    rollupOptions: {
      // Function form, not a plain string array — confirmed via direct
      // diagnostic evidence (a Symbol() identity mismatch between what
      // ConfirmationService provided and what useConfirm() injected) that
      // A bare-string external only matches the exact specifier, never
      // subpaths — so a function is used to cover both.
      // Every one of those got bundled directly into this output instead
      // of externalized, creating a second, separately-evaluated copy of
      // each subpath module — with its own distinct Symbol() for every
      // provide/inject key those modules define, breaking injection
      // between the real consumer app and anything from this package
      // that used one of those symbols. Confirmed this exact gap already
      // once this session, for the *other* build pass (vite.config.element.ts,
      // fixed via configureApp there) — never checked whether this file
      // had the identical issue. It did.
      // Covers subpaths too (e.g. "vue/server-renderer"), not just the
      // bare "vue" specifier — a plain === check silently rebundles those
      // and reintroduces the exact Symbol-identity split this comment
      // block describes.
      external: (id) => id === "vue" || id.startsWith("vue/"),
    },
  },
});
