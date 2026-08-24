/**
 * mergeTagDefinitions.ts
 * Shared utilities for merge tag resolution, detection, and export flattening.
 *
 * Used by:
 *   - EmailBuilderCanvasComponent.vue  (preview resolution)
 *   - LinkTagTab.vue                   (auto-detection)
 *   - MergeTagTab.vue                  (auto-detection)
 *   - mergeTagMapper.ts                (export transformation)
 *   - Build / export pipeline          (flattening)
 */

/**
 * Matches:
 *   {{ tag }}
 *   {{ tag|'default' }}
 *   {{ tag | 'default' }}
 *   {{ tag | "default" }}
 *   {{ tag|default }}         (no quotes)
 *   {{ 'any text'|'default' }} (quoted tag name — dynamic/literal label)
 *   {{ "any text"|'default' }} (double-quoted tag name)
 *
 * Capture groups:
 *   [1] tag name — either a bare word (\w+) or a quoted string (quotes stripped)
 *   [2] fallback value (optional, quotes stripped by caller)
 *
 * The tag name alternation tries quoted form first so that the pipe inside
 * a quoted name is never mistaken for the fallback separator.
 */
const MERGE_TAG_RE =
  /\{\{\s*(?:'([^']*)'|"([^"]*)"|(\w+))(?:\s*\|\s*(?:'([^']*)'|"([^"]*)"|([^'"\}\s][^'"\}]*?)))?\s*\}\}/g;

/**
 * Normalise a MERGE_TAG_RE match into { name, fallback }.
 * Groups:  1=sq-name  2=dq-name  3=bare-name
 *          4=sq-fb    5=dq-fb    6=bare-fb
 */
const parseMatch = (
  m: RegExpExecArray,
): { name: string; fallback: string } => ({
  name: (m[1] ?? m[2] ?? m[3] ?? "").trim(),
  fallback: (m[4] ?? m[5] ?? m[6] ?? "").trim(),
});

/**
 * Extract all unique merge tag names from a string.
 * Safe to call on both rich-text HTML strings and plain strings.
 */
export const extractMergeTags = (text: string): string[] => {
  const found = new Set<string>();
  MERGE_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MERGE_TAG_RE.exec(text)) !== null) {
    found.add(parseMatch(m).name);
  }
  return [...found];
};

/**
 * Extract all unique merge tags along with their inline defaults.
 *
 * Returns a map of tagName → fallback (empty string when no default is
 * specified). When the same tag appears multiple times with different
 * defaults the first-seen default wins.
 *
 * Used by the export pipeline to carry fallback values through to
 * mergeTagMapper.transformToken().
 */
export const extractMergeTagsWithDefaults = (
  text: string,
): Map<string, string> => {
  const found = new Map<string, string>();
  MERGE_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MERGE_TAG_RE.exec(text)) !== null) {
    const { name, fallback } = parseMatch(m);
    if (!found.has(name)) {
      found.set(name, fallback);
    }
  }
  return found;
};

/**
 * Resolve merge tags in a plain string using the preview context.
 *
 * Resolution priority (mirrors RichTextEditor.vue buildPreviewHTML):
 *   1. Explicit value in context          → "Philip"
 *   2. Inline default in tag syntax       → {{ name|'Friend' }} → "Friend"
 *   3. Neither set                        → "{{ name }}" (visually unresolved)
 *
 * When previewActive is false the original string is returned unchanged,
 * so callers can bind this unconditionally without a v-if guard.
 */
export const resolveString = (
  str: string,
  context: Record<string, string>,
  previewActive: boolean,
): string => {
  if (!previewActive || !str) return str ?? "";
  MERGE_TAG_RE.lastIndex = 0;
  return str.replace(MERGE_TAG_RE, (match, ...groups) => {
    // Reconstruct a fake match array compatible with parseMatch
    const fakeMatch = [match, ...groups] as unknown as RegExpExecArray;
    const { name, fallback } = parseMatch(fakeMatch);
    const val = context[name];
    if (val !== undefined && val !== "") return val;
    if (fallback) return fallback;
    return `{{ ${name} }}`;
  });
};

/**
 * Flatten a plain string for canonical storage — normalises {{ tag }} tokens
 * to a clean, consistent `{{ tag }}` format, stripping any accidental extras.
 *
 * For rich-text HTML (paragraph / heading) use flattenRichTextContent()
 * instead — that one handles span[data-merge] nodes produced by TipTap.
 */
export const flattenPlainString = (str: string): string => {
  if (!str) return "";
  MERGE_TAG_RE.lastIndex = 0;
  return str.replace(MERGE_TAG_RE, (match, ...groups) => {
    const fakeMatch = [match, ...groups] as unknown as RegExpExecArray;
    const { name } = parseMatch(fakeMatch);
    return `{{ ${name} }}`;
  });
};

/**
 * Flatten TipTap-produced HTML into the canonical {{ tag }} / {{ tag|'default' }}
 * format for storage. Replaces every <span data-merge="name"> with {{ name }},
 * and preserves the data-merge-default attribute as the inline default so the
 * fallback survives the storage round-trip and reaches transformHTML() at
 * export time.
 *
 * Examples:
 *   <span data-merge="name" data-merge-default="Tony">…</span>  → {{ name|'Tony' }}
 *   <span data-merge="name">…</span>                             → {{ name }}
 *
 * This is the STORAGE flattener — it produces canonical {{ }} tokens.
 * For ESP-specific export use mergeTagMapper.transformHTML() instead.
 *
 * Safe to call in SSR — uses a plain regex, no DOMParser.
 */
export const flattenRichTextContent = (html: string): string => {
  if (!html) return "";
  return html.replace(
    /<span[^>]*\bdata-merge="([^"]+)"(?:[^>]*\bdata-merge-default="([^"]*)")?[^>]*>.*?<\/span>/gs,
    (_, name, fallback) =>
      fallback?.trim()
        ? `{{ ${name.trim()}|'${fallback.trim()}' }}`
        : `{{ ${name.trim()} }}`,
  );
};
