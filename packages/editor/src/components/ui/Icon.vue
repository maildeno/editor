<script setup lang="ts">
/**
 * Every icon in the editor, as hardcoded inline SVG. Zero dependencies —
 * no icon font, no `@font-face`, and no package to keep in sync.
 *
 * Two deliberate design choices:
 *
 * 1. **Sized at 1em, not fixed px.** Callers size icons with `font-size`
 *    (~15 places use `style="font-size: 9px"` and similar). Rendering at
 *    1em means those work unchanged, and `currentColor` inherits text
 *    colour the same way.
 *
 * 2. **Short, stable names** (`plus`, `times`, `exclamation-triangle`),
 *    used as the `name` prop.
 *
 * Inline SVG also avoids a real bug class: `@font-face` is a
 * document-scoped at-rule that browsers ignore inside a shadow root, so
 * icon fonts render blank in the custom-element build unless separately
 * hoisted into the document. SVG works identically in both.
 *
 * Paths follow the Lucide geometry (24x24 viewBox, 2px round-capped
 * strokes, ISC licensed).
 */

const props = withDefaults(
  defineProps<{
    /** Icon name — see the ICONS map below for the full set. */
    name: string;
    /** Overrides the default 2px stroke — useful for very small sizes. */
    strokeWidth?: number | string;
  }>(),
  { strokeWidth: 2 },
);

// Raw inner SVG per icon. Static, hardcoded constants only — never user
// input — so v-html below carries no injection risk.
const ICONS: Record<string, string> = {
  "arrow-down": '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  "arrows-alt":
    '<path d="M12 2v20"/><path d="M2 12h20"/><path d="m15 5-3-3-3 3"/><path d="m15 19-3 3-3-3"/><path d="m5 9-3 3 3 3"/><path d="m19 9 3 3-3 3"/>',
  // Two variants because the version panel's "kept" toggle needs an
  // unambiguous on/off read at 11px, where a colour change alone is too
  // weak a signal — same reason eye/eye-slash and lock/lock-open both
  // exist here rather than one icon recoloured. The filled path overrides
  // the wrapper's fill="none" at the element level, as `tag` already does.
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  "bookmark-filled":
    '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "chevron-up": '<path d="m18 15-6-6-6 6"/>',
  circle: '<circle cx="12" cy="12" r="10"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  "exclamation-triangle":
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  "external-link":
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  "eye-slash":
    '<path d="m15 18-.72-3.25"/><path d="M2 8a10.65 10.65 0 0 0 20 0"/><path d="m20 15-1.73-2.05"/><path d="m4 15 1.73-2.05"/><path d="m9 18 .72-3.25"/>',
  // Same glyph the version panel's own header uses, so the button and the
  // panel it opens read as the same thing.
  history:
    '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
  image:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  "info-circle":
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "lock-open":
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  send: '<path d="M14.54 21.69a.5.5 0 0 0 .93-.03l6.5-19a.5.5 0 0 0-.63-.63l-19 6.5a.5.5 0 0 0-.03.93l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>',
  sparkles:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
  tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  "th-large":
    '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  times: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
};
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="props.strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    style="display: inline-block; vertical-align: -0.125em; flex-shrink: 0"
    v-html="ICONS[props.name] ?? ''"
  />
</template>
