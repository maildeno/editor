import { computed, type Ref } from "vue";

/**
 * The pure part of resolveMobileProps, for callers that already know whether
 * they are in mobile mode (the Preview screen has a boolean, not a ref).
 * A null or undefined override means "no override". Values replace whole
 * values, so a `padding` or `border` override has to be a complete object.
 */
export function applyMobileOverrides(p: any, isMobile: boolean) {
  if (!isMobile || !p?.mobile) return p;
  const resolved = { ...p };
  Object.entries(p.mobile).forEach(([key, val]) => {
    if (val !== null && val !== undefined) resolved[key] = val;
  });
  return resolved;
}

/**
 * Applies mobile prop overrides when in mobile preview mode. Depends on
 * previewMode, not just the component's own props — extracted verbatim
 * from CanvasComponent.vue's local resolveProps.
 */
export function resolveMobileProps(p: any, previewMode: Ref<string>) {
  return applyMobileOverrides(p, previewMode.value === "mobile");
}

/**
 * The keys the exporters honour in a row's, column's or row-spacer's `mobile`
 * (see emailNodeMobileStyles). The canvas reads other fields of these nodes
 * too, such as `width` and the background image, and a stray key in imported
 * JSON must not change those on screen when the email ignores it.
 */
const NODE_MOBILE_KEYS = new Set([
  "backgroundColor",
  "backgroundGradient",
  "padding",
  "border",
  "minHeight",
  "gap",
  "verticalAlign",
  "height",
]);

/**
 * Mobile overrides for a row, a column or a row-spacer. They keep their
 * overrides on `node.mobile` instead of `props.mobile`. The merge is the same
 * as for components, limited to the keys above, with one more rule: a row's
 * `gap` override only applies while the row is stacked and has a gap on
 * desktop. The email draws a row's gap as cells between the columns, which
 * exist only when the desktop gap is above zero, and turns them into vertical
 * spacers when the row is stacked (`.mobile-stack.eb-<id>-gap`). The exporters
 * make the same choice.
 */
export function applyNodeMobileOverrides(node: any, isMobile: boolean) {
  if (!isMobile || !node?.mobile) return node;
  const resolved = { ...node };
  Object.entries(node.mobile).forEach(([key, val]) => {
    if (val === null || val === undefined || !NODE_MOBILE_KEYS.has(key)) return;
    if (key === "gap" && !(node.mobileStack && node.gap > 0)) return;
    resolved[key] = val;
  });
  return resolved;
}

/** Extracted verbatim from CanvasComponent.vue's local resolveBackground. */
export function resolveBackground(p: any): string {
  const bg = p.backgroundGradient;
  if (
    bg?.useGradient &&
    Array.isArray(bg.gradient?.colors) &&
    bg.gradient.colors.length >= 2
  ) {
    const stops = bg.gradient.colors
      .map((c: any) => `${c.color} ${c.position}%`)
      .join(", ");
    return bg.gradient.type === "radial"
      ? `radial-gradient(circle at center, ${stops})`
      : `linear-gradient(${bg.gradient.direction}, ${stops})`;
  }
  return p.backgroundColor;
}

/**
 * Desktop/mobile-hide opacity class — extracted verbatim from
 * CanvasComponent.vue's local hideClass computed.
 */
export function useHideClass(
  componentProps: Ref<{ mobileHide?: boolean; desktopHide?: boolean }>,
  previewMode: Ref<string>,
) {
  return computed(() => [
    previewMode.value === "mobile" && componentProps.value.mobileHide
      ? "opacity-30"
      : "",
    previewMode.value === "desktop" && componentProps.value.desktopHide
      ? "opacity-30"
      : "",
  ]);
}
