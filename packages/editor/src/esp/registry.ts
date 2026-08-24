import type { ESPSyntaxMeta } from "../composables/emailBuilder/export/logic/espLogicWrapper";

/**
 * Confirmed against the real pipeline (buildRuleExpression, joinExpressions,
 * buildOpenTag, buildCloseTag): every one of them already has a graceful
 * `default:` case for an unrecognized syntax string — generic
 * `t == 'value'` expressions, `&&`/`||` joining, `{{#if}}`/`{{/if}}` tags.
 * The one genuine crash risk is `ESP_SYNTAX_META[syntax]`, read
 * unconditionally in buildFullExpression (and in VisibilityWrapESPTab.vue's
 * currentMeta) — `undefined.supportsNesting` throws. That's what this
 * registry actually needs to fix: not build a fallback system from
 * scratch, just make the existing one reachable instead of crashing before
 * it's ever used.
 */

const customMeta = new Map<string, ESPSyntaxMeta>();

export interface ESPWrapperOverrides {
  /** Override the generated boolean expression's open tag. Omit to use the
   * pipeline's existing generic fallback (Handlebars-style {{#if ...}}). */
  wrapOpenTag?: (expression: string) => string;
  wrapCloseTag?: () => string;
  /** Override merge-tag syntax for this ESP. Omit to use the existing
   * generic {{ tag }} fallback already confirmed to work for arbitrary
   * tags (see mergeTagMapper.ts's transformCustomTag). */
  wrapMergeTag?: (key: string, fallback?: string) => string;
}

const customOverrides = new Map<string, ESPWrapperOverrides>();

/**
 * Registers a custom ESP. `meta` is required — without it, the pipeline's
 * one real crash point (`ESP_SYNTAX_META[syntax]` read unconditionally)
 * would throw the moment this syntax is selected. `overrides` are
 * optional — every one you omit falls through to the pipeline's existing
 * generic behavior, which is honest-but-imperfect (works for basic
 * equals/not-equals conditions, less accurate for `contains`/date-comparison
 * operators specifically, since those still resolve through the generic
 * `t == 'value'` fallback rather than an ESP-correct translation).
 */
export function registerESPSyntax(
  id: string,
  meta: ESPSyntaxMeta,
  overrides?: ESPWrapperOverrides,
): void {
  customMeta.set(id, meta);
  if (overrides) customOverrides.set(id, overrides);
}

const DEFAULT_META: ESPSyntaxMeta = {
  label: "Custom",
  group: "custom",
  description: "Registered ESP syntax with no metadata override.",
  supportsNesting: true,
};

/** Safe lookup — built-in record, then custom-registered, then a sane
 * default. Never returns undefined, unlike direct ESP_SYNTAX_META[syntax]
 * access. */
export function getESPMetaSafe(
  syntax: string,
  builtIn: Record<string, ESPSyntaxMeta>,
): ESPSyntaxMeta {
  return builtIn[syntax] ?? customMeta.get(syntax) ?? DEFAULT_META;
}

export function getESPOverrides(syntax: string): ESPWrapperOverrides | undefined {
  return customOverrides.get(syntax);
}

/** For UI pickers (the ESP syntax <select>) to list registered custom
 * entries alongside the 14 built-ins, not just avoid crashing on them. */
export function getRegisteredCustomESPs(): Array<{ id: string; meta: ESPSyntaxMeta }> {
  return [...customMeta.entries()].map(([id, meta]) => ({ id, meta }));
}
