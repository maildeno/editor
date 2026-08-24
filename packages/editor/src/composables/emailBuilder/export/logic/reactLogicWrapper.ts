// composables/emailBuilder/export/logic/reactLogicWrapper.ts
//
// Converts a VisibilityConfig into React JSX conditional wrapping.
//
// ── Why not wrapWithESPLogic? ─────────────────────────────────────────────────
//
// wrapWithESPLogic emits string-based ESP tags (e.g. {% if … %}…{% endif %})
// which are not valid JSX. React Email output is compiled TypeScript — it needs
// real JavaScript/JSX conditionals, not template engine tags.
//
// ── Strategy ─────────────────────────────────────────────────────────────────
//
// The VisibilityConfig rules reference merge tag IDs (e.g. "plan", "country").
// In React Email these become props on the component. This wrapper generates
// JSX conditionals that reference those same prop names directly.
//
// Single rule example:
//   rule: { tag: "plan", operator: "==", value: "pro" }
//   → {plan === "pro" && (
//       <Row>…</Row>
//     )}
//
// Multiple rules with match:"all":
//   → {(plan === "pro" && country === "US") && (
//       <Row>…</Row>
//     )}
//
// Multiple rules with match:"any":
//   → {(plan === "pro" || country === "US") && (
//       <Row>…</Row>
//     )}
//
// Groups are parenthesised sub-expressions joined to flat rules with the
// top-level match operator.
//
// ── Unsupported operators ─────────────────────────────────────────────────────
//
// Some visibility operators have no direct JS equivalent and are approximated:
//
//   contains        → String(prop).includes("value")
//   not_contains    → !String(prop).includes("value")
//   starts_with     → String(prop).startsWith("value")
//   ends_with       → String(prop).endsWith("value")
//   in              → ["a","b"].includes(String(prop))
//   not_in          → !["a","b"].includes(String(prop))
//   > < >= <=       → Number(prop) > value  (etc.)
//   is_empty        → !prop || prop.trim() === ""
//   is_not_empty    → !!prop && prop.trim() !== ""
//   date_before/after/on → new Date(prop) < new Date("value")  (etc.)
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//
//   import { wrapWithReactLogic } from "./reactLogicWrapper";
//
//   const jsx = wrapWithReactLogic(rowJsx, row.visibility);
//   // → "{(plan === "pro") && (\n  <Row>…</Row>\n)}"

import type {
  VisibilityConfig,
  VisibilityGroup,
  VisibilityRule,
  VisibilityOperator,
} from "../../core/useEmailBuilderVisibility";

import { tagToIdentifier } from "../shared/tagIdentifier";

// ─── Operator → JS expression ─────────────────────────────────────────────────

/**
 * Converts a single VisibilityRule into a JavaScript boolean expression string.
 *
 * The left-hand side is always `String(propName)` (or `Number(propName)` for
 * numeric operators) so the expression is safe even when the prop is undefined.
 *
 * For valueless operators (is_empty / is_not_empty) the prop is referenced
 * directly without coercion.
 *
 * @param rule  The visibility rule to convert.
 * @returns     A JS boolean expression string, e.g. `String(plan) === "pro"`.
 */
const buildRuleExpression = (rule: VisibilityRule): string => {
  // Route the tag through the shared identifier mapper so the reference emitted
  // here (e.g. `String(isPremium)`) matches the `const` declaration produced by
  // reactMergeTagMapper. Preserves case and turns tags with spaces/dots
  // ("order count", "user.plan") into valid identifiers.
  const prop = tagToIdentifier(rule.tag);
  // Coerce to a string up front: a boolean/number rule value would otherwise
  // throw on `.toLowerCase()` / `.split()` in the branches below.
  const val = String(rule.value ?? "");

  switch (rule.operator as VisibilityOperator) {
    // ── Equality ──────────────────────────────────────────────────────────────
    case "==":
      return `String(${prop}).toLowerCase() === ${JSON.stringify(val.toLowerCase())}`;
    case "!=":
      return `String(${prop}).toLowerCase() !== ${JSON.stringify(val.toLowerCase())}`;

    // ── String ────────────────────────────────────────────────────────────────
    case "contains":
      return `String(${prop}).toLowerCase().includes(${JSON.stringify(val.toLowerCase())})`;
    case "not_contains":
      return `!String(${prop}).toLowerCase().includes(${JSON.stringify(val.toLowerCase())})`;
    case "starts_with":
      return `String(${prop}).toLowerCase().startsWith(${JSON.stringify(val.toLowerCase())})`;
    case "ends_with":
      return `String(${prop}).toLowerCase().endsWith(${JSON.stringify(val.toLowerCase())})`;

    // ── List membership ───────────────────────────────────────────────────────
    // Values are split on comma/semicolon/newline, matching the evaluateRule()
    // behaviour in useEmailBuilderVisibility.
    case "in": {
      const items = val
        .split(/[,\n;]+/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      return `${JSON.stringify(items)}.includes(String(${prop}).toLowerCase())`;
    }
    case "not_in": {
      const items = val
        .split(/[,\n;]+/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      return `!${JSON.stringify(items)}.includes(String(${prop}).toLowerCase())`;
    }

    // ── Numeric ───────────────────────────────────────────────────────────────
    case ">":
      return `Number(${prop}) > ${Number(val)}`;
    case "<":
      return `Number(${prop}) < ${Number(val)}`;
    case ">=":
      return `Number(${prop}) >= ${Number(val)}`;
    case "<=":
      return `Number(${prop}) <= ${Number(val)}`;

    // ── Date ──────────────────────────────────────────────────────────────────
    // Normalised to midnight UTC, matching parseDateUTC() in useEmailBuilderVisibility.
    case "date_before":
      return `(${prop} ? new Date(${prop}).setHours(0,0,0,0) : NaN) < new Date(${JSON.stringify(val)}).setHours(0,0,0,0)`;
    case "date_after":
      return `(${prop} ? new Date(${prop}).setHours(0,0,0,0) : NaN) > new Date(${JSON.stringify(val)}).setHours(0,0,0,0)`;
    case "date_on":
      return `(${prop} ? new Date(${prop}).setHours(0,0,0,0) : NaN) === new Date(${JSON.stringify(val)}).setHours(0,0,0,0)`;

    // ── Existence ─────────────────────────────────────────────────────────────
    case "is_empty":
      return `(!${prop} || String(${prop}).trim() === "")`;
    case "is_not_empty":
      return `(!!${prop} && String(${prop}).trim() !== "")`;

    default:
      return "true";
  }
};

// ─── Group expression builder ──────────────────────────────────────────────────

/**
 * Converts a VisibilityGroup into a single parenthesised JS expression string.
 * Returns null when the group has no valid rules.
 */
const buildGroupExpression = (group: VisibilityGroup): string | null => {
  if (!group.rules.length) return null;

  const parts = group.rules.map(buildRuleExpression);
  const joined =
    parts.length === 1
      ? parts[0]
      : `(${parts.join(group.match === "any" ? " || " : " && ")})`;

  return joined;
};

// ─── Full condition builder ───────────────────────────────────────────────────

/**
 * Builds the complete JS condition expression from a VisibilityConfig.
 *
 * Flat rules and groups are combined with the top-level `match` operator.
 * Groups are parenthesised sub-expressions. Returns null when there is nothing
 * to evaluate (no rules, no groups).
 *
 * @param config  The VisibilityConfig from the row/column/component.
 */
const buildCondition = (config: VisibilityConfig): string | null => {
  const flatExprs = (config.rules ?? []).map(buildRuleExpression);

  const groupExprs = (config.groups ?? [])
    .map(buildGroupExpression)
    .filter((e): e is string => e !== null);

  const all = [...flatExprs, ...groupExprs];
  if (all.length === 0) return null;

  if (all.length === 1) return all[0];

  const joiner = config.match === "any" ? " || " : " && ";
  return `(${all.join(joiner)})`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Wraps `content` (a JSX string) in a React logical AND conditional expression
 * derived from `config`.
 *
 * Returns `content` unchanged when:
 *   • config is undefined / null
 *   • config.enabled is false
 *   • config has no rules and no groups
 *
 * Output format:
 *   {condition && (
 *     <original content>
 *   )}
 *
 * The outer `{ }` makes it a valid JSX expression. The inner parentheses
 * group multi-line content so the logical AND binds correctly.
 *
 * @param content  JSX string to conditionally render (e.g. a <Row>…</Row>).
 * @param config   VisibilityConfig from the row/column/component.
 */
export const wrapWithReactLogic = (
  content: string,
  config: VisibilityConfig | undefined | null,
): string => {
  if (!config?.enabled) return content;

  const hasRules = (config.rules?.length ?? 0) > 0;
  const hasGroups = (config.groups?.length ?? 0) > 0;
  if (!hasRules && !hasGroups) return content;

  const condition = buildCondition(config);
  if (!condition) return content;

  // Indent the content block by 2 spaces for readability inside the expression
  const indented = content
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

  return `{${condition} && (\n${indented}\n)}`;
};

/**
 * Preview the generated condition expression without actual content.
 * Useful for rendering a live preview in the VisibilityWrapESP component
 * when the selected syntax is "react".
 *
 * @param config  VisibilityConfig to preview.
 * @returns       The JS condition string, or null if config is empty/disabled.
 */
export const previewReactCondition = (
  config: VisibilityConfig | undefined | null,
): string | null => {
  if (!config?.enabled) return null;

  const hasRules = (config.rules?.length ?? 0) > 0;
  const hasGroups = (config.groups?.length ?? 0) > 0;
  if (!hasRules && !hasGroups) return null;

  return buildCondition(config);
};
