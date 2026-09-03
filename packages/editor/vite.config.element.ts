import { defineConfig } from "vite";
import { scopeInjectedCssPlugin } from "./scopeInjectedCss";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// NOTE: no `dts()` plugin here on purpose. vite-plugin-dts generates
// declarations for every file matched by tsconfigPath's `include`
// ("src", the whole tree) — not just the files reachable from this
// config's own entry. vite.config.ts's dts() call already produces
// dist/element.d.ts and dist/init.d.ts (and everything else under src)
// during the first build pass, since it points at the same tsconfig.
// Calling dts() again here just regenerates identical output from
// scratch — confirmed via a minimal repro: an entry pointing only at
// a.ts still emitted b.d.ts/c.d.ts for unreachable sibling files. That
// redundant pass was ~8s of this build's ~13.8s total.

/**
 * Same underlying bug as vite.config.ts's injectExtractedCssViaJs (see
 * that file's comment) — every Vue <style scoped> block across the
 * component tree gets extracted by Vite into a separate CSS asset
 * (element-scoped-styles.css here) that nothing ever loads. Confirmed:
 * .cdz-empty-icon's width/height rule was extracted out and never
 * reached the shadow root at all, so the canvas empty-state icon
 * rendered at full natural size.
 *
 * This path can't just append to document.head like the other one does —
 * these styles have to go INSIDE the shadow root to apply at all. So
 * rather than injecting directly, this stashes the CSS on a global that
 * shadowStyles.ts reads and includes in the array it hands to
 * defineCustomElement. The snippet is prepended to the entry chunk, so
 * it's set well before buildShadowStyles() is first called (which only
 * happens lazily, at element definition time).
 */
function captureExtractedCssForShadowRoot() {
  return {
    name: "maildeno-capture-extracted-css",
    apply: "build" as const,
    // Vite emits the extracted CSS asset during generateBundle itself —
    // without enforce:"post" this hook runs first and sees an empty
    // bundle, silently injecting nothing at all (confirmed: the snippet
    // was entirely absent from the built entry chunk).
    enforce: "post" as const,
    generateBundle(this: any, _options: unknown, bundle: Record<string, any>) {
      let css = "";
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === "asset" && fileName.endsWith(".css")) {
          css += `\n${asset.source}`;
        }
      }
      if (!css.trim()) return;
      // Build-time string substitution, not a prepended runtime global:
      // ESM hoists imports, so the shared chunk containing shadowStyles.ts
      // (and element.ts, which calls buildShadowStyles() at module eval
      // time) finishes evaluating before any statement prepended to an
      // entry chunk could run — confirmed empirically that a global set
      // that way was still undefined at the point it's read. Replacing
      // the placeholder directly in the emitted code sidesteps ordering
      // entirely.
      const placeholder = '"__MAILDENO_EXTRACTED_CSS_PLACEHOLDER__"';
      let replaced = false;
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code.includes(placeholder)) {
          chunk.code = chunk.code.replace(placeholder, JSON.stringify(css));
          replaced = true;
        }
      }
      // Fails the build rather than warning, for the same reason
      // vite.config.ts's equivalent does: a missing substitution ships an
      // element with no component styling, and a warning in a build log
      // is not enough to catch that before publishing.
      if (!replaced) {
        this.error(
          "[maildeno] scoped-style placeholder not found — component " +
            "<style scoped> blocks would be missing from the shadow root.",
        );
      }
    },
  };
}

/**
 * The "element" build pass — custom-element usage (element.ts, init.ts).
 * See vite.config.ts for why this is a separate file/invocation rather
 * than a second entry in that same config: Rollup's `external` can't
 * differ per entry within one build pass, and this entry needs the
 * opposite decision from index.ts's — vue bundled IN, not left
 * external, since a React/Angular/plain-HTML host has neither on the page.
 *
 * emptyOutDir: false is deliberate — this pass runs second (see
 * package.json's build script) and must not delete vite.config.ts's
 * dist/index.js output, which already landed in the same dist/ folder.
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
    scopeInjectedCssPlugin(),vue(), tailwindcss(), captureExtractedCssForShadowRoot()],
  build: {
    // Kept in sync with vite.config.ts — see that file's comment.
    minify: false,
    emptyOutDir: false,
    lib: {
      entry: {
        element: "./src/element.ts",
        init: "./src/init.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      // Deliberately NOT external — see file-level comment above.
      external: [],
      output: {
        // The real fix for a genuine, previously-undiscovered bug:
        // without this, Vite's library-mode CSS extraction names this
        // pass's own CSS output "editor.css" too — identical to what
        // vite.config.ts's pass already correctly produced — and since
        // this pass runs second (package.json's build script), it
        // silently overwrote that correct, complete file with this
        // pass's much smaller one (only the Vue scoped <style> blocks
        // collected during this specific pass; this build's real CSS
        // goes through the separate ?inline mechanism in
        // shadowStyles.ts instead, which was always correct and
        // unaffected — bundled directly into element.js/init.js, never
        // extracted as its own file at all). emptyOutDir: false above
        // only ever protected against the directory being cleared
        // between passes, never against this — a same-filename
        // overwrite within an already-preserved directory.
        assetFileNames: "element-scoped-styles[extname]",
      },
    },
  },
});
