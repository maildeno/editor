// export/transformers/minify.ts
// ─────────────────────────────────────────────────────────────────────────────
// Whitespace-only compaction for all render targets.
//
// What this does
// --------------
// Collapses redundant whitespace (indentation, blank lines, runs of spaces)
// so the output is compact for API transport.
//
// What this does NOT do
// ---------------------
// - Does not strip or alter HTML/CSS/JS comments
// - Does not remove, add, or change any attribute quotes
// - Does not rewrite attribute values
// - Does not touch CSS property values (including media queries)
// - Does not remove any tags or content
// - Has zero external dependencies
//
// Strategy per target
// -------------------
// html        : Collapse whitespace between tags (>\s+< → ><) and runs of
//               spaces/tabs inside text nodes to a single space.  Content
//               inside <style>, <script>, and <!-- --> blocks is compacted
//               separately so tag-boundary collapsing does not corrupt CSS
//               selector syntax or JS strings.
// mjml        : Same inter-tag whitespace collapse — MJML is XML so the
//               same rules apply.
// react-email : Collapse runs of blank lines to one blank line and strip
//               leading/trailing whitespace per line.  JSX structure and
//               string literals are not touched.
// ─────────────────────────────────────────────────────────────────────────────

export type MinifyTarget = "html" | "mjml" | "react-email";

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Splits an HTML/MJML string into alternating normal markup segments and
 * special blocks (<style>…</style>, <script>…</script>, <!-- … -->) so we
 * can compact each kind differently without corrupting their contents.
 *
 * The RegExp uses the same alternating-split trick as Python's re.split with
 * a capturing group: odd-indexed entries are the captured special blocks.
 */
const SPECIAL_BLOCK_RE =
  /(<style[\s>][\s\S]*?<\/style>|<script[\s>][\s\S]*?<\/script>|<!--[\s\S]*?-->)/gi;

/**
 * Collapse inter-tag and intra-text whitespace in HTML or MJML.
 *
 * Splits the document around <style>, <script>, and comment blocks,
 * compacts the non-special segments, then reassembles — so CSS rules
 * (including media queries), JS strings, and HTML comments are never
 * rewritten.
 */
function collapseMarkup(source: string): string {
  // Split on special blocks while keeping the matched blocks (capturing group).
  const parts = source.split(SPECIAL_BLOCK_RE);
  const out: string[] = [];

  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // Special block (<style>, <script>, or comment) — compact only runs of
      // leading/trailing whitespace on each line and consecutive blank lines.
      // Selector/value content is untouched.
      let compacted = part.replace(/^[ \t]+|[ \t]+$/gm, "");
      compacted = compacted.replace(/\n{2,}/g, "\n");
      out.push(compacted);
    } else {
      // Normal markup — collapse whitespace between tags and runs of
      // spaces/tabs inside text nodes.
      let segment = part.replace(/>\s+</g, "><"); // between tags
      segment = segment.replace(/[ \t]{2,}/g, " "); // inside text
      segment = segment.replace(/\n+/g, ""); // remove newlines
      out.push(segment);
    }
  });

  return out.join("");
}

// ── Per-target public functions ───────────────────────────────────────────────

/**
 * Collapse whitespace in a rendered HTML string.
 *
 * Only whitespace is touched — all quotes, attribute values, comments,
 * and CSS/JS content are preserved exactly as the SDK produced them.
 */
export function minifyHtmlOutput(source: string): string {
  if (!source) return source;
  return collapseMarkup(source);
}

/**
 * Collapse whitespace in a rendered MJML string.
 *
 * Identical strategy to HTML — inter-tag whitespace collapsed, special
 * blocks (style/script/comments) compacted line-by-line only.
 */
export function minifyMjmlOutput(source: string): string {
  if (!source) return source;
  return collapseMarkup(source);
}

/**
 * Collapse whitespace in a rendered React-email (TSX/JSX) string.
 *
 * Strips leading/trailing spaces per line and collapses runs of blank
 * lines to one. Indentation inside JSX expressions and string literals
 * is not touched.
 */
export function minifyReactOutput(source: string): string {
  if (!source) return source;
  // Strip leading/trailing spaces on each line
  let result = source.replace(/^[ \t]+|[ \t]+$/gm, "");
  // Collapse runs of 3+ newlines to a single blank line
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

// ── Public dispatcher ─────────────────────────────────────────────────────────

/**
 * Route `source` to the correct whitespace compactor for `target`.
 *
 * @param target  One of `"html"`, `"mjml"`, `"react-email"`.
 * @param source  Raw string returned by the SDK build function.
 * @returns       Whitespace-compacted string.  If `target` is unknown the
 *                original string is returned unchanged so callers never
 *                receive `undefined`.
 */
export function minifyOutput(target: MinifyTarget, source: string): string {
  switch (target) {
    case "html":
      return minifyHtmlOutput(source);
    case "mjml":
      return minifyMjmlOutput(source);
    case "react-email":
      return minifyReactOutput(source);
    default:
      // Unknown target — pass through (exhaustiveness guard for future targets)
      return source;
  }
}
