// composables/emailBuilder/export/shared/tagIdentifier.ts
//
// Single source of truth for turning a free-form visibility/merge tag into a
// valid JavaScript identifier for React Email output.
//
// Both sides of the React export MUST derive the identifier the same way or the
// generated component breaks:
//
//   • reactMergeTagMapper.extractVisibilityTags → buildReactEmailConsts
//       emit the declaration:   const <id> = "";
//   • reactLogicWrapper.buildRuleExpression
//       emit the reference:     String(<id>).toLowerCase() === "..."
//
// If those two disagree (e.g. `const ispremium` vs `String(isPremium)`), the
// reference points at an undeclared variable and the conditional can never be
// true. Routing both through this one function guarantees they match.
//
// Rules:
//   • Case is PRESERVED — `isPremium` stays `isPremium`.
//   • Characters illegal in a JS identifier (spaces, dots, hyphens, …) are
//     collapsed to a single underscore.
//   • A leading digit is prefixed with `_` (identifiers can't start with one).
//   • A tag that reduces to nothing falls back to `_tag`.
//
// Examples:
//   "isPremium"   → "isPremium"
//   "plan"        → "plan"
//   "order count" → "order_count"
//   "user.plan"   → "user_plan"
//   "2plan"       → "_2plan"
//   ""            → "_tag"

export const tagToIdentifier = (tag: string): string => {
  const trimmed = (tag ?? "").trim();

  // Collapse any run of non-identifier characters into a single underscore.
  let id = trimmed.replace(/[^A-Za-z0-9_$]+/g, "_");

  // JS identifiers cannot begin with a digit.
  if (/^[0-9]/.test(id)) id = `_${id}`;

  // Guard against an empty result (tag was only whitespace/punctuation).
  return id || "_tag";
};
