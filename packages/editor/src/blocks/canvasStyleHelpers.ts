import { computed, type Ref } from "vue";

/**
 * Applies mobile prop overrides when in mobile preview mode. Depends on
 * previewMode, not just the component's own props — extracted verbatim
 * from CanvasComponent.vue's local resolveProps.
 */
export function resolveMobileProps(p: any, previewMode: Ref<string>) {
  if (previewMode.value !== "mobile" || !p.mobile) return p;
  const resolved = { ...p };
  Object.entries(p.mobile).forEach(([key, val]) => {
    if (val !== null && val !== undefined) resolved[key] = val;
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
