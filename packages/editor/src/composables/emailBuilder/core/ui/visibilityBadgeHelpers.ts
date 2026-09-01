// composables/emailBuilder/core/ui/visibilityBadgeHelpers.ts
//
// Shared helpers used by both the Row and Component canvas badge v-if guards.
// Import these into whatever canvas component renders the badges.

export interface VisibilityLike {
  enabled?: boolean;
  rules?: { tag: string; operator: string; value: string }[];
  groups?: { match: "all" | "any"; rules: any[] }[];
}

/**
 * Returns true when the visibility config should show a badge.
 * A badge is shown when enabled AND has at least one flat rule OR one group.
 */
export const isVisibilityActive = (
  vis: VisibilityLike | undefined | null,
): boolean => {
  if (!vis?.enabled) return false;
  return (vis.rules?.length ?? 0) > 0 || (vis.groups?.length ?? 0) > 0;
};

/**
 * Returns the total number of rules across flat rules + all group rules.
 * Used as the count shown on the badge pill.
 */
export const visibilityRuleCount = (
  vis: VisibilityLike | undefined | null,
): number => {
  if (!vis) return 0;
  const flatCount = vis.rules?.length ?? 0;
  const groupCount = (vis.groups ?? []).reduce(
    (sum, g) => sum + (g.rules?.length ?? 0),
    0,
  );
  return flatCount + groupCount;
};
