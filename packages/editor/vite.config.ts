import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/**
 * Injects every bit of CSS this build extracts — critically including all
 * the Vue <style scoped> blocks from across the component tree — into
 * document.head at runtime, by prepending a self-executing snippet to the
 * entry chunk.
 *
 * Fixes a real, confirmed bug: those scoped styles are collected by Vite
 * into a separate dist/editor.css asset, which nothing in the consumer's
 * module graph ever imported once styling moved to programmatic injection
 * (that only covered the base layer — Tailwind, icons, fonts — not
 * these). Confirmed via direct inspection: .cdz-empty-icon's rule
 * (width:48px;height:48px) was present in dist/editor.css but completely
 * absent from dist/index.js, so the canvas empty-state icon rendered at
 * full natural size and its surrounding text lost all styling.
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
    // bundle, silently injecting nothing at all (confirmed: the snippet
    // was entirely absent from the built entry chunk).
    enforce: "post" as const,
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      let css = "";
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === "asset" && fileName.endsWith(".css")) {
          css += `\n${asset.source}`;
        }
      }
      if (!css.trim()) return;
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.isEntry) {
          // Guarded by a data attribute so importing this package more
          // than once (or alongside its own dynamic chunks) can't stack
          // duplicate <style> tags.
          chunk.code =
            `(function(){try{if(typeof document<"u"&&!document.querySelector("style[data-maildeno-editor-css]")){` +
            `var s=document.createElement("style");s.setAttribute("data-maildeno-editor-css","");` +
            `s.textContent=${JSON.stringify(css)};document.head.appendChild(s);}}catch(e){` +
            `console.error("[maildeno-editor] style injection failed",e);}})();\n` +
            chunk.code;
        }
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
    vue(),
    tailwindcss(),
    dts({ tsconfigPath: "./tsconfig.json" }),
    injectExtractedCssViaJs(),
  ],
  build: {
    // Pinned explicitly (not left to Vite's default, which has shifted
    // across major versions) — unminified so consumers' own bundlers can
    // tree-shake and minify against their target, and so the injected
    // CSS string above stays readable for debugging.
    minify: false,
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
