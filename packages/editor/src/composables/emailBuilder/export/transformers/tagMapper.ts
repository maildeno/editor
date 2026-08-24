// export/transformers/tagMapper.ts
// Post-processing integration logic for merge tags and link tags.
//
// Responsible for:
//   - resolveAllTags:  literal value substitution (prune + preview ON)
//   - transformHTML:   ESP token conversion (wrap mode / preview OFF)
//   - transformHTMLForReact: JSX expression conversion for React Email

export { resolveAllTags } from "../../core/merge-tags/resolveMergeTags";
export { transformHTML } from "../merge-tags/mergeTagMapper";
export {
  transformHTMLForReact,
  extractReactTags,
  buildReactEmailProps,
  extractVisibilityTags,
  buildReactEmailConsts,
} from "../merge-tags/reactMergeTagMapper";

import type { ExportMode, TagSubstitutionOptions } from "../types/export";
import type { ESPSyntax } from "../logic/espLogicWrapper";
import { resolveAllTags } from "../../core/merge-tags/resolveMergeTags";
import { transformHTML } from "../merge-tags/mergeTagMapper";

/**
 * Applies the correct tag transformation strategy to a finalised output string.
 *
 * ┌─────────┬──────────────┬──────────────────────┬────────────────────────────────────────────────┐
 * │ mode    │ preview      │ resolveDocumentLevel │ action                                         │
 * ├─────────┼──────────────┼──────────────────────┼────────────────────────────────────────────────┤
 * │ wrap    │ any          │ any                  │ transformHTML → ESP tokens (file goes to ESP)  │
 * │ prune   │ preview OFF  │ any                  │ transformHTML → ESP tokens (no literal values) │
 * │ prune   │ preview ON   │ false (default)      │ no-op → literals substituted per-component    │
 * │ prune   │ preview ON   │ true                 │ resolveAllTags → document-level substitution  │
 * └─────────┴──────────────┴──────────────────────┴────────────────────────────────────────────────┘
 *
 * @param resolveDocumentLevel  Pass `true` for exporters that skip
 *   applyComponentTagSubstitution per-component (currently: MJML). HTML and
 *   React exports leave this as the default `false` because they already
 *   substituted tags per-component and the prune+previewON branch is a no-op
 *   for them.
 */
export const applyTagTransform = (
  output: string,
  mode: ExportMode,
  espSyntax: ESPSyntax,
  tagSubstitution?: TagSubstitutionOptions,
  resolveDocumentLevel = false,
): string => {
  const previewIsActive =
    tagSubstitution?.mergeTagActive || tagSubstitution?.linkTagActive;

  if (mode === "wrap" || !previewIsActive) {
    return transformHTML(output, espSyntax);
  }

  // prune + preview ON
  if (resolveDocumentLevel) {
    // Exporter skipped per-component substitution (e.g. MJML) — resolve now
    // on the full assembled document.
    const { mergeTagContext, mergeTagActive, linkTagContext, linkTagActive } =
      tagSubstitution!;
    return resolveAllTags(
      output,
      mergeTagContext ?? {},
      mergeTagActive ?? false,
      linkTagContext ?? {},
      linkTagActive ?? false,
    );
  }

  // Literals were already substituted per-component; nothing left to do.
  return output;
};

/**
 * Applies tag substitution at the component level (during generation).
 * Only active in prune mode when a preview context is live.
 */
export const applyComponentTagSubstitution = (
  raw: string,
  mode: ExportMode,
  tagSubstitution?: TagSubstitutionOptions,
): string => {
  if (mode === "wrap" || !tagSubstitution) return raw;

  const { mergeTagContext, mergeTagActive, linkTagContext, linkTagActive } =
    tagSubstitution;

  if (!mergeTagActive && !linkTagActive) return raw;

  return resolveAllTags(
    raw,
    mergeTagContext,
    mergeTagActive,
    linkTagContext,
    linkTagActive,
  );
};
