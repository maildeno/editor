/**
 * useBoxShadowEditor
 *
 * The desktop/mobile editing logic for the Shadow control, for any node that
 * keeps a `boxShadow` and a `mobile.boxShadow`: a component's `props` (image,
 * button) or a row or column node itself.
 *
 * It does not go through useComponentStyleEditor's setProp, for two reasons.
 *
 *   1. A shadow is one object, and a mobile override replaces all of it, as
 *      `padding` and `border` do. Writing it in one step keeps the desktop and
 *      mobile shadows independent: turning the shadow off on mobile must not
 *      touch the desktop one.
 *
 *   2. A mobile shadow that draws what the desktop shadow draws is not an
 *      override. Left in place it would show an "overridden" badge and add a
 *      rule to the email's mobile CSS for no visible reason, so it is dropped
 *      (the same thing useNodeStyleEditor does for a mobile border). Two
 *      shadows that are both switched off count as the same, whatever values
 *      they keep, and a switched-on shadow that has sized down to nothing is
 *      still switched on, so dragging the sliders to zero never makes the
 *      override vanish under the user's hand.
 */

import { computed } from "vue";
import type { ComputedRef, Ref } from "vue";
import { useEmailBuilder } from "../core/useEmailBuilder";
import { boxShadowEquals, normalizeBoxShadow } from "../core/boxShadow";
import type { BoxShadow } from "../core/boxShadow";
import type { EditMode } from "./useComponentStyleEditor";

/** A component's `props`, or a row or column node: anything with these keys. */
export type ShadowHolder = Record<string, any>;

export interface BoxShadowEditorOptions {
  /** False for an image: `inset` has no effect there, so it is not compared. */
  allowInset?: boolean;
}

export function useBoxShadowEditor(
  holder: Ref<ShadowHolder | null> | ComputedRef<ShadowHolder | null>,
  editMode: Ref<EditMode> | ComputedRef<EditMode>,
  { allowInset = true }: BoxShadowEditorOptions = {},
) {
  const { saveToHistory } = useEmailBuilder();

  const clean = (value: unknown): BoxShadow => {
    const s = normalizeBoxShadow(value);
    return allowInset ? s : { ...s, inset: false };
  };

  /** True when the two shadows draw the same thing. */
  const sameShadow = (a: BoxShadow, b: BoxShadow): boolean =>
    (!a.enabled && !b.enabled) ||
    (a.enabled && b.enabled && boxShadowEquals(a, b));

  const desktop = computed<BoxShadow>(() => clean(holder.value?.boxShadow));

  /** The mobile override as stored, or null when there is none. */
  const mobileOverride = (): BoxShadow | null => {
    const m = holder.value?.mobile?.boxShadow;
    return m && typeof m === "object" ? clean(m) : null;
  };

  /**
   * What the control shows. In Mobile that is the override when there is one,
   * and the desktop shadow otherwise, as for every other overridable value.
   */
  const shadow = computed<BoxShadow>(() => {
    if (editMode.value === "mobile") return mobileOverride() ?? desktop.value;
    return desktop.value;
  });

  /** Mobile only: the override differs from the desktop shadow. */
  const isOverridden = computed<boolean>(() => {
    if (editMode.value !== "mobile") return false;
    const m = mobileOverride();
    return !!m && !sameShadow(m, desktop.value);
  });

  /** Writes the whole shadow to the layer being edited, in one history step. */
  const setShadow = (next: BoxShadow): void => {
    const h = holder.value;
    if (!h) return;
    const value = clean(next);

    if (editMode.value === "desktop") {
      h.boxShadow = value;
    } else {
      if (!h.mobile) h.mobile = {};
      h.mobile.boxShadow = sameShadow(value, desktop.value) ? null : value;
    }
    saveToHistory("set-boxShadow");
  };

  /** Mobile only: goes back to the desktop shadow. */
  const resetShadow = (): void => {
    const h = holder.value;
    if (!h || editMode.value !== "mobile" || !h.mobile) return;
    h.mobile.boxShadow = null;
    saveToHistory("reset-boxShadow");
  };

  return { shadow, isOverridden, setShadow, resetShadow };
}
