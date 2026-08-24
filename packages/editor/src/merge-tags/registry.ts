/**
 * Confirmed against the real pipeline (mergeTagMapper.ts's transformToken):
 * any tag ID not in the hardcoded SYSTEM_TAG_MAP already falls through to
 * transformCustomTag, which handles arbitrary tag names generically for
 * all known ESP syntaxes — this was already true before this registry
 * existed (see the "Zero Vendor Lock-in" note in mergeTagMapper.ts).
 *
 * So registering a merge tag isn't fixing a correctness gap the way the
 * ESP registry was. It solves a narrower, real problem: getSystemTagIds()
 * only returns SYSTEM_TAG_MAP's hardcoded keys, so a host's own fields
 * (order_total, loyalty_points, ...) never show up in the "Common tags"
 * picker UI — a user would have to already know to type {{ order_total }}
 * by hand. This registry makes registered tags discoverable there.
 *
 * Optional per-ESP token overrides exist for the rare case a custom tag
 * needs something other than the generic transform (e.g. a genuinely
 * ESP-specific system-level token) — most registrations won't need them.
 */

export interface MergeTagRegistration {
  key: string;
  /** Optional — omit to use the existing generic transformCustomTag path
   * for every ESP syntax, which is already correct for ordinary data
   * fields. Only provide this for a tag that needs ESP-specific hardcoded
   * tokens, the same category SYSTEM_TAG_MAP covers for built-ins. */
  tokens?: Partial<Record<string, string>>;
}

const registered = new Map<string, MergeTagRegistration>();

export function registerMergeTags(tags: MergeTagRegistration[]): void {
  for (const tag of tags) {
    registered.set(tag.key, tag);
  }
}

/** Custom-registered IDs, appended after the built-ins for the picker UI. */
export function getRegisteredMergeTagIds(): string[] {
  return [...registered.keys()];
}

/** Only returns a value for tags that were registered WITH explicit token
 * overrides — most registered tags return undefined here on purpose, so
 * transformToken's existing transformCustomTag fallback handles them. */
export function getRegisteredMergeTagToken(
  tagId: string,
  syntax: string,
): string | undefined {
  return registered.get(tagId)?.tokens?.[syntax];
}
