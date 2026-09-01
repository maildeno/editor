// composables/emailBuilder/core/useEmailBuilderVisibility.ts

export type VisibilityOperator =
  | "=="
  | "!="
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | ">"
  | "<"
  | ">="
  | "<="
  | "is_empty"
  | "is_not_empty"
  | "date_before" // ✅ NEW — date comparison operators
  | "date_after"
  | "date_on";

export type VisibilityRule = {
  tag: string;
  operator: VisibilityOperator;
  value: string;
};

export type VisibilityGroup = {
  match: "all" | "any";
  rules: VisibilityRule[];
};

export type VisibilityConfig = {
  enabled: boolean;
  match: "all" | "any";
  rules: VisibilityRule[];
  groups?: VisibilityGroup[];
};

// ─── Operator classification sets ────────────────────────────────────────────

export const VALUELESS_OPERATORS: VisibilityOperator[] = [
  "is_empty",
  "is_not_empty",
];

export const LIST_OPERATORS: VisibilityOperator[] = ["in", "not_in"];

export const NUMERIC_OPERATORS: VisibilityOperator[] = [">", "<", ">=", "<="];

export const DATE_OPERATORS: VisibilityOperator[] = [
  // ✅ NEW
  "date_before",
  "date_after",
  "date_on",
];

export const OPERATOR_OPTIONS: { label: string; value: VisibilityOperator }[] =
  [
    // ── Equality ──────────────────────────────────────────────────────────────
    { label: "Equals  ==", value: "==" },
    { label: "Not Equals  !=", value: "!=" },
    // ── String ────────────────────────────────────────────────────────────────
    { label: "Contains", value: "contains" },
    { label: "Not Contains", value: "not_contains" },
    { label: "Starts With", value: "starts_with" },
    { label: "Ends With", value: "ends_with" },
    // ── List ──────────────────────────────────────────────────────────────────
    { label: "In List  (comma-separated)", value: "in" },
    { label: "Not In List  (comma-separated)", value: "not_in" },
    // ── Numeric ───────────────────────────────────────────────────────────────
    { label: "Greater Than  > (numeric)", value: ">" },
    { label: "Less Than  < (numeric)", value: "<" },
    { label: "Greater Than or Equal  >=", value: ">=" },
    { label: "Less Than or Equal  <=", value: "<=" },
    // ── Date ──────────────────────────────────────────────────────────────────
    { label: "Date Before", value: "date_before" }, // ✅ NEW
    { label: "Date After", value: "date_after" }, // ✅ NEW
    { label: "Date On", value: "date_on" }, // ✅ NEW
    // ── Existence ─────────────────────────────────────────────────────────────
    { label: "Is Empty", value: "is_empty" },
    { label: "Is Not Empty", value: "is_not_empty" },
  ];

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Forgiving list splitter.
 *
 * Splits on comma, semicolon, or newline — handles copy-paste from Excel,
 * CSV exports, and multiline inputs without requiring the user to reformat.
 *
 * Examples that all parse correctly:
 *   "pro, enterprise"        → ["pro", "enterprise"]
 *   "pro; enterprise"        → ["pro", "enterprise"]
 *   "pro\nenterprise"        → ["pro", "enterprise"]
 *   "pro,enterprise ,  uk"   → ["pro", "enterprise", "uk"]
 */
const splitList = (value: string): string[] =>
  value
    .split(/[,\n;]+/)
    .map((v) => v.trim())
    .filter(Boolean); // drop empty strings from trailing delimiters

/**
 * Numeric helpers — unchanged from original.
 */
const nums = (a: string | undefined, b: string): [number, number] => [
  parseFloat(a ?? ""),
  parseFloat(b),
];
const ok = (a: number, b: number): boolean => !isNaN(a) && !isNaN(b);

/**
 * Date helpers.
 *
 * Parses ISO 8601 date strings (YYYY-MM-DD) or any string Date() accepts.
 * Returns null when parsing fails so callers can handle it gracefully
 * (same safe-default pattern as the numeric NaN guard).
 *
 * Both sides are normalised to midnight UTC so "date_on" compares calendar
 * dates rather than exact timestamps.
 *
 * Examples:
 *   parseDateUTC("2026-04-02")          → Date (midnight UTC)
 *   parseDateUTC("2026-04-02T10:30:00") → Date (normalised to midnight UTC)
 *   parseDateUTC("not-a-date")          → null
 */
const parseDateUTC = (value: string | undefined): Date | null => {
  if (!value?.trim()) return null;

  // Prefer ISO date-only format (YYYY-MM-DD) — most common in email context
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? new Date(`${value.trim()}T00:00:00Z`)
    : new Date(value.trim());

  return isNaN(isoDate.getTime())
    ? null
    : new Date(
        Date.UTC(
          isoDate.getUTCFullYear(),
          isoDate.getUTCMonth(),
          isoDate.getUTCDate(),
        ),
      );
};

// ─── Core rule evaluator ──────────────────────────────────────────────────────

export const evaluateRule = (
  rule: VisibilityRule,
  context: Record<string, string>,
): boolean => {
  const rawValue = context[rule.tag.toLowerCase()]; // may be undefined
  const contextValue = rawValue?.toLowerCase() ?? "";
  const compareValue = rule.value.toLowerCase();

  switch (rule.operator) {
    // ── Equality ──────────────────────────────────────────────────────────────
    case "==":
      return contextValue === compareValue;
    case "!=":
      return contextValue !== compareValue;

    // ── String ────────────────────────────────────────────────────────────────
    case "contains":
      return contextValue.includes(compareValue);
    case "not_contains":
      return !contextValue.includes(compareValue);
    case "starts_with":
      return contextValue.startsWith(compareValue);
    case "ends_with":
      return contextValue.endsWith(compareValue);

    // ── List membership ───────────────────────────────────────────────────────
    // ✅ Uses splitList() — tolerates comma, semicolon, or newline delimiters
    case "in": {
      const vals = splitList(compareValue);
      return vals.includes(contextValue);
    }
    case "not_in": {
      const vals = splitList(compareValue);
      return !vals.includes(contextValue);
    }

    // ── Numeric ───────────────────────────────────────────────────────────────
    case ">": {
      const [a, b] = nums(rawValue, rule.value);
      return ok(a, b) && a > b;
    }
    case "<": {
      const [a, b] = nums(rawValue, rule.value);
      return ok(a, b) && a < b;
    }
    case ">=": {
      const [a, b] = nums(rawValue, rule.value);
      return ok(a, b) && a >= b;
    }
    case "<=": {
      const [a, b] = nums(rawValue, rule.value);
      return ok(a, b) && a <= b;
    }

    // ── Date ──────────────────────────────────────────────────────────────────
    // ✅ NEW — both sides normalised to midnight UTC for calendar-date comparison.
    // Safe default: if either side fails to parse, returns false (same
    // pattern as numeric NaN guard — never accidentally shows hidden content).
    case "date_before": {
      const a = parseDateUTC(rawValue);
      const b = parseDateUTC(rule.value);
      return a !== null && b !== null && a.getTime() < b.getTime();
    }
    case "date_after": {
      const a = parseDateUTC(rawValue);
      const b = parseDateUTC(rule.value);
      return a !== null && b !== null && a.getTime() > b.getTime();
    }
    case "date_on": {
      const a = parseDateUTC(rawValue);
      const b = parseDateUTC(rule.value);
      return a !== null && b !== null && a.getTime() === b.getTime();
    }

    // ── Existence ─────────────────────────────────────────────────────────────
    case "is_empty":
      return rawValue === undefined || rawValue.trim() === "";
    case "is_not_empty":
      return rawValue !== undefined && rawValue.trim() !== "";

    default:
      return true;
  }
};

// ─── Group evaluator ──────────────────────────────────────────────────────────

export const evaluateGroup = (
  group: VisibilityGroup,
  context: Record<string, string>,
): boolean => {
  if (!group.rules.length) return true;
  const results = group.rules.map((r) => evaluateRule(r, context));
  return group.match === "any" ? results.some(Boolean) : results.every(Boolean);
};

// ─── Main composable ──────────────────────────────────────────────────────────

export const useEmailBuilderVisibility = () => {
  const evaluateVisibility = (
    visibility: VisibilityConfig | undefined,
    context: Record<string, string>,
  ): boolean => {
    if (!visibility?.enabled) return true;

    const hasRules = visibility.rules?.length > 0;
    const hasGroups = (visibility.groups?.length ?? 0) > 0;
    if (!hasRules && !hasGroups) return true;

    const ruleResults = (visibility.rules ?? []).map((r) =>
      evaluateRule(r, context),
    );
    const groupResults = (visibility.groups ?? []).map((g) =>
      evaluateGroup(g, context),
    );

    const allResults = [...ruleResults, ...groupResults];

    return visibility.match === "any"
      ? allResults.some(Boolean)
      : allResults.every(Boolean);
  };

  return { evaluateVisibility, evaluateRule, evaluateGroup };
};
