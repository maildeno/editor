// Safe URL
// Note: Skipping merge tags {{ }} because it will be resolved at build time
export const safeUrl = (url: string) => {
  if (!url) return url;
  if (/\{\{.*?\}\}/.test(url)) return url; // contains merge tag, let it resolve at build time
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
};

/**
 * Escape a string for safe insertion into HTML text content.
 * Handles: & < > " '
 *
 * Use for anything going between tags, e.g. `<td>${escapeHtml(props.text)}</td>`.
 */
export const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * Escape a string for safe insertion into an HTML attribute value.
 * The attribute delimiter in your templates is `"`, so at minimum we must
 * escape `&` and `"`. We escape `<` and `>` too as a belt-and-braces measure
 * against parser quirks in older email clients.
 *
 * Use for user-supplied values going into attributes, e.g.
 *   `<img alt="${escapeAttr(iconAlt)}" />`
 */
export const escapeAttr = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

/**
 * Normalize rich-text HTML coming out of the editor before it's interpolated
 * into the exported email body (paragraph, heading, list `props.content`).
 *
 * Why this exists
 * ───────────────
 * The editor lives inside an `<x contenteditable>` and serializes inline
 * styles via the browser's `Element.outerHTML`. Because the resulting markup
 * is itself placed inside a `style="…"` attribute downstream, the browser
 * escapes every embedded double-quote as `&quot;`. So a font pick of
 * `Comic Sans MS` round-trips as:
 *
 *   <span style="font-family: &quot;Comic Sans MS&quot;;">…</span>
 *
 * That's *valid* — email clients will decode it — but it's noisy in the
 * exported source and looks broken to anyone inspecting the output. We
 * rewrite those entity-encoded double quotes inside `style="…"` blocks to
 * single quotes:
 *
 *   <span style="font-family: 'Comic Sans MS';">…</span>
 *
 * Design constraints
 * ──────────────────
 *   1. ONLY touch `style="…"` attribute values. We must not rewrite
 *      `&quot;` that legitimately appears in visible text content
 *      (escaped quotes the user typed) or in non-style attributes.
 *   2. ONLY touch the inner contents of the attribute, not its delimiter.
 *      The surrounding `style="…"` keeps its double-quote delimiters so
 *      the HTML stays well-formed.
 *   3. Idempotent — running it twice produces the same output.
 *   4. SSR-safe — pure string transformation, no DOM access. This runs
 *      from generator code that may execute during export pipelines
 *      where `document` is not guaranteed.
 */
export const normalizeRichTextContent = (html: unknown): string => {
  if (html === null || html === undefined) return "";
  const str = String(html);

  // Cheap early-out: nothing to normalize if there's no entity-encoded quote.
  if (str.indexOf("&quot;") === -1) return str;

  // Match `style="…"` and rewrite &quot; → ' inside the captured value only.
  // The `[^"]*` body is safe because attribute values are themselves
  // double-quote-delimited, so a literal `"` inside would already be invalid
  // HTML — anything quote-like in there is necessarily entity-encoded.
  return str.replace(
    /style="([^"]*)"/g,
    (_match, body: string) => `style="${body.replace(/&quot;/g, "'")}"`,
  );
};
