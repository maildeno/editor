// export/transformers/formatting.ts
// Post-processing formatter. Takes a raw generated string and returns a
// prettified version using prettier. Isolates all prettier configuration
// so swapping the formatter later only requires editing this one file.
//
// Prettier is loaded on demand rather than imported at the top level.
// Measured against the real bundle, it was by far the largest thing in
// it — 1,555 kB raw / 376 kB gzipped, roughly 40% of the entire gzipped
// payload, and more than TipTap, Reka, Vue and ProseMirror combined. It
// is also needed only when someone actually exports, which most sessions
// never do, so paying for it on first paint was the single worst trade
// in the bundle.
//
// This costs nothing at the call sites: all three functions were already
// async, so awaiting the import changes no signatures and no callers.
// The parsers are split further by format — exporting HTML or MJML never
// pulls in the TypeScript/babel/estree parsers, which are only needed for
// React Email output.

/**
 * Cached so repeated exports in one session pay the import once. The
 * browser caches the chunk too, but this also avoids re-resolving the
 * module and re-running its top-level initialisation.
 */
let htmlBundle: Promise<{ prettier: any; plugins: any[] }> | null = null;
let tsxBundle: Promise<{ prettier: any; plugins: any[] }> | null = null;

function loadHtmlFormatter() {
  htmlBundle ??= Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/html"),
  ])
    .then(([prettier, parserHtml]) => ({
      prettier: prettier.default ?? prettier,
      plugins: [parserHtml.default ?? parserHtml],
    }))
    .catch((e) => {
      // Don't cache a dead promise — a transient failure (offline, a
      // blocked CDN request) shouldn't permanently disable formatting
      // for the rest of the session. Let the next call try again.
      htmlBundle = null;
      throw e;
    });
  return htmlBundle;
}

function loadTsxFormatter() {
  // Only typescript + estree are needed for parser: "typescript" — babel
  // is a separate parser prettier uses for parser: "babel"/"babel-ts",
  // not a dependency of the typescript parser itself. Verified against
  // prettier 3.9.6 across generics, JSX fragments, decorators, enums,
  // and `satisfies` before dropping it; removing it saves ~90kB gzip
  // from a chunk that's already lazy-loaded.
  tsxBundle ??= Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/typescript"),
    import("prettier/plugins/estree"),
  ])
    .then(([prettier, typescript, estree]) => ({
      prettier: prettier.default ?? prettier,
      plugins: [typescript.default ?? typescript, estree.default ?? estree],
    }))
    .catch((e) => {
      tsxBundle = null;
      throw e;
    });
  return tsxBundle;
}

/**
 * Formatting is cosmetic — it only affects whitespace in the exported
 * file. If the chunk fails to load (offline, blocked CDN, a bundler that
 * mishandles the dynamic import), returning the unformatted source is far
 * better than failing the export outright.
 */
async function safeFormat(
  source: string,
  run: () => Promise<string>,
): Promise<string> {
  try {
    return await run();
  } catch (e) {
    console.warn(
      "[maildeno-editor] formatter unavailable; returning unformatted output",
      e,
    );
    return source;
  }
}

export const formatHTML = async (html: string): Promise<string> =>
  safeFormat(html, async () => {
    const { prettier, plugins } = await loadHtmlFormatter();
    return prettier.format(html, { parser: "html", plugins });
  });

export const formatTSX = async (tsx: string): Promise<string> =>
  safeFormat(tsx, async () => {
    const { prettier, plugins } = await loadTsxFormatter();
    return prettier.format(tsx, { parser: "typescript", plugins });
  });

// MJML source files use the HTML parser since MJML syntax is XML-like.
export const formatMJML = async (mjml: string): Promise<string> =>
  safeFormat(mjml, async () => {
    const { prettier, plugins } = await loadHtmlFormatter();
    return prettier.format(mjml, { parser: "html", plugins });
  });
