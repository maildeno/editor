import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // More specific than the plain "@maildeno/editor" alias below, so it
      // must come first — alias resolution is order-sensitive, and without
      // this ordering "@maildeno/editor/element" would incorrectly match
      // the general alias first and resolve to ".../index.ts/element".
      "@maildeno/editor/element": fileURLToPath(
        new URL("../../packages/editor/src/element.ts", import.meta.url),
      ),
      // Points straight at the library's source, not its package.json
      // "exports" (which resolves to ./dist and only exists after a build).
      // This is what makes editing a .vue file in packages/editor hot-reload
      // here without a build step in between.
      "@maildeno/editor": fileURLToPath(
        new URL("../../packages/editor/src/index.ts", import.meta.url),
      ),
      // The aliased source above is full of "@/..." imports internally.
      // packages/editor/vite.config.ts defines this same alias, but that
      // config isn't in play here — this playground's Vite instance is the
      // one actually processing those files, so it needs its own copy.
      "@": fileURLToPath(
        new URL("../../packages/editor/src", import.meta.url),
      ),
    },
  },
  plugins: [
    vue(),
    tailwindcss(),
    // Replicates what the framework module provided for free in the
    // original app. Without this, any <Button>/<Dialog>/<InputText>/etc
    // used without an explicit per-file import is an
    // unresolved component — Vue renders it as an inert, unstyled literal
    // tag with no runtime error. Confirmed this was actually happening:
    // Button/Dialog/InputText/DatePicker had zero explicit imports
    // anywhere despite being used across multiple files; Select had an
    // import in only 1 of its 6 usage sites.
    // element-demo.html's whole point is proving zero light-DOM CSS
    // leakage — everything lives in the shadow root via shadowStyles.ts.
    // Vite's default multi-page-HTML behavior auto-injects a <link
    // rel="stylesheet"> for any CSS it discovers in an entry's module
    // graph (here, other components' scoped <style> blocks elsewhere in
    // the tree — not Tailwind's Preflight reset, but still not correct
    // for this specific page). That's the right default for index.html's
    // regular Vue-app demo; it works against the one page meant to prove
    // isolation. This only strips it from element-demo.html's own output.
    {
      name: "strip-element-demo-css-link",
      transformIndexHtml: {
        order: "post",
        handler(html, ctx) {
          if (!ctx.path.includes("element-demo")) return html;
          return html.replace(
            /<link rel="stylesheet"[^>]*>/g,
            "<!-- stylesheet link intentionally stripped — see vite.config.ts -->",
          );
        },
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        // Framework-free custom-element demo — no Vue app mounted, no
        // Tailwind imported on the page itself. Proves the
        // editor brings everything it needs via Shadow DOM.
        elementDemo: fileURLToPath(
          new URL("./element-demo.html", import.meta.url),
        ),
      },
    },
  },
});
