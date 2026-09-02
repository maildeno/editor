/**
 * The package's own name, shown wherever a host hasn't supplied its own.
 *
 * Extracted to a constant because two components now render it — the
 * desktop-only notice and the loading overlay — and DesktopOnlyNotice.vue's
 * prop comment already promised there would be exactly one place to change
 * it. A second `withDefaults(..., { brandName: "Maildeno" })` written inline
 * would quietly make that false, and the two would drift the first time
 * someone renamed one of them.
 *
 * Not a theme token: `theme` carries colours, and this is text, so it has no
 * sensible home in the token map — see the `brandName` prop on EmailEditor
 * for the longer version of that reasoning.
 */
export const DEFAULT_BRAND_NAME = "Maildeno";
