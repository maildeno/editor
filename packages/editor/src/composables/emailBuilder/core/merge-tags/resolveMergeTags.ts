// composables/emailBuilder/core/merge-tags/resolveMergeTags.ts
//
// Pure, side-effect-free utility that substitutes {{ tag }} placeholders in a
// string with values from a context map.
//
// Rules:
//   • Matching is case-insensitive and whitespace-tolerant ("{{ First Name }}"
//     matches key "first_name" if the caller normalises keys the same way).
//   • When `active` is false (or context is empty) the original string is
//     returned unchanged — zero cost for the common case.
//   • An unmatched tag is left as-is so the raw template tag remains visible in
//     the exported HTML rather than silently disappearing.
//   • Works on any string — plain text, TipTap-serialised HTML, href values, etc.
//
// Usage:
//   import { resolveTags } from "@/composables/emailBuilder/core/merge-tags/resolveMergeTags";
//
//   const html = resolveTags(rawHtml, mergeTagContext, mergeTagPreviewActive);

/**
 * Normalises a tag name the same way the tab components do when building the
 * context map: lowercase, collapse whitespace to underscores.
 */
const normaliseKey = (raw: string): string =>
  raw.trim().toLowerCase().replace(/\s+/g, "_");

/**
 * Parses the inner content of a {{ … }} placeholder into its tag name and an
 * optional pipe-default value.
 *
 * Supported syntaxes:
 *   {{ first_name }}              → key: "first_name",  pipeDefault: undefined
 *   {{ first_name|'Friend' }}     → key: "first_name",  pipeDefault: "Friend"
 *   {{ first_name | "Friend" }}   → key: "first_name",  pipeDefault: "Friend"
 *   {{ first_name|Friend }}       → key: "first_name",  pipeDefault: "Friend"
 *
 * The pipe character splits the tag name from its fallback. Surrounding quotes
 * (single or double) on the fallback value are stripped.
 */
const parseTagInner = (
  inner: string,
): { key: string; pipeDefault?: string } => {
  const pipeIdx = inner.indexOf("|");

  if (pipeIdx === -1) {
    return { key: normaliseKey(inner) };
  }

  const rawKey = inner.slice(0, pipeIdx);
  const rawDefault = inner.slice(pipeIdx + 1).trim();

  // Strip surrounding single or double quotes from the default value
  const pipeDefault = rawDefault.replace(/^['"]|['"]$/g, "");

  return { key: normaliseKey(rawKey), pipeDefault };
};

/**
 * Substitutes every {{ tag }} placeholder found in `source` with the
 * corresponding value from `context`.
 *
 * Resolution order for each placeholder:
 *   1. Use the context value when the tag key is present and non-empty.
 *   2. Fall back to the pipe-default when defined: {{ tag|'Fallback' }}
 *   3. Leave the raw placeholder as-is so it stays visible in the output.
 *
 * @param source   - The raw string that may contain {{ tag }} placeholders.
 * @param context  - Key→value map built by the tab component (keys already
 *                   normalised with `normaliseKey`).
 * @param active   - When false the function is a no-op and returns `source`
 *                   unchanged. Pass `mergeTagPreviewActive.value` /
 *                   `linkTagPreviewActive.value` directly.
 */
export const resolveTags = (
  source: string,
  context: Record<string, string>,
  active: boolean,
): string => {
  // Fast-path: nothing to do
  if (!active || !source) return source;

  // Matches {{ anything }} including whitespace and pipe-default syntax.
  return source.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (_match, rawInner: string) => {
      const { key, pipeDefault } = parseTagInner(rawInner);

      // 1. Explicit preview value from context
      if (
        Object.prototype.hasOwnProperty.call(context, key) &&
        context[key] !== ""
      ) {
        return context[key];
      }

      // 2. Pipe-default fallback: {{ first_name|'Friend' }} → "Friend"
      if (pipeDefault !== undefined) {
        return pipeDefault;
      }

      // 3. No match and no default — leave the placeholder untouched
      return _match;
    },
  );
};

/**
 * Convenience overload that accepts the full context object and both active
 * flags, applying merge tags first and link tags second.
 *
 * This ordering matters because merge tags appear inside rich-text HTML
 * (paragraph / heading content) while link tags typically live in href
 * attributes and anchor text — there is no semantic overlap, but doing
 * merge → link keeps the substitution deterministic.
 */
export const resolveAllTags = (
  source: string,
  mergeContext: Record<string, string>,
  mergeActive: boolean,
  linkContext: Record<string, string>,
  linkActive: boolean,
): string => {
  let result = resolveTags(source, mergeContext, mergeActive);
  result = resolveTags(result, linkContext, linkActive);
  return result;
};
