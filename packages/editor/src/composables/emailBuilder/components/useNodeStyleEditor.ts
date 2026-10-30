/**
 * useNodeStyleEditor
 *
 * The desktop/mobile style editor for rows, columns and row-spacers.
 *
 * Components keep their mobile overrides in `props.mobile`. Rows, columns and
 * row-spacers have no `props`: their style lives on the node itself and their
 * overrides on `node.mobile`. useComponentStyleEditor only ever touches
 * `component.props` and `component.props.mobile`, so a shim whose `props` IS
 * the node gives these nodes the same logic (null-safe reads, lazy `mobile`,
 * one history commit per write) without changing a composable that every
 * component panel depends on.
 *
 * This file adds three things on top of it, all of which the row panels need:
 *
 *   1. displayBackground keeps the panels' own defaults. The base composable
 *      falls back to a blue-to-green gradient; the row, column and spacer
 *      panels have always used the white-to-grey one that hydrate.ts seeds, so
 *      clicking "Gradient" in Mobile mode must start from the same colours as
 *      it does in Desktop mode.
 *
 *   2. A mobile border that equals the desktop border is dropped. The base
 *      composable copies the whole desktop border on the first mobile edit,
 *      and "resetting" one field writes the desktop value back, so a border
 *      override can end up identical to the desktop border. On a component
 *      that is invisible. On a row it is not: any `mobile.border` makes the
 *      exporters emit the outer border element (export/shared/nodeBox.ts), so
 *      the exported DOM would change for no visible reason.
 *
 *   3. resetBorderProp / isBorderPropOverridden, so a panel can show a badge
 *      and a Reset button per border field the way the Image panel does.
 *
 * It does not expose the hide toggles or the increment helpers: toggleMobileHide
 * would write `mobileHide` onto a row, which nothing reads, and the sliders
 * already emit absolute values.
 */

import { computed } from "vue";
import type { ComputedRef, Ref } from "vue";
import { useComponentStyleEditor } from "./useComponentStyleEditor";
import type {
  BackgroundValue,
  BorderProps,
  EditMode,
  StyledComponent,
  StyledComponentProps,
} from "./useComponentStyleEditor";

/** A row, a column or a row-spacer: any node that keeps overrides on `mobile`. */
export type StyledNode = Record<string, any>;

const BORDER_KEYS: (keyof BorderProps)[] = [
  "width",
  "style",
  "color",
  "radius",
];

/** Fresh stops on every call: the white-to-grey pair hydrate.ts seeds. */
const defaultStops = () => [
  { color: "#ffffff", position: 0 },
  { color: "#eeeeee", position: 100 },
];

const isColor = (c: unknown): c is string => !!c && c !== "transparent";

export function useNodeStyleEditor(
  node: Ref<StyledNode | null> | ComputedRef<StyledNode | null>,
  editMode: Ref<EditMode> | ComputedRef<EditMode>,
) {
  // `props` is the node itself, not a copy: every write lands on the live node.
  const shim = computed<StyledComponent | null>(() =>
    node.value
      ? {
          id: String(node.value.id ?? ""),
          type: String(node.value.type ?? "column"),
          props: node.value as StyledComponentProps,
        }
      : null,
  );

  const base = useComponentStyleEditor(shim, editMode);
  const { displayValue } = base;

  // ── Background ──────────────────────────────────────────────────────────────

  /**
   * The BackgroundValue the picker shows for the current edit mode. In Mobile
   * mode each key falls back to the desktop value on its own, as for every
   * other override. The solid colour is read the way the panels always read it:
   * the gradient object's `solid` first, then `backgroundColor`.
   */
  const displayBackground = (): BackgroundValue => {
    const bg = displayValue("backgroundGradient") as
      Partial<BackgroundValue> | null | undefined;
    const color = displayValue("backgroundColor") as string | null | undefined;

    const solid = isColor(bg?.solid)
      ? bg.solid
      : isColor(color)
        ? color
        : "transparent";

    return {
      useGradient: bg?.useGradient ?? false,
      solid,
      gradient: {
        type: "linear",
        direction: "to right",
        colors: defaultStops(),
        ...(bg?.gradient ?? {}),
      },
    };
  };

  // ── Border ──────────────────────────────────────────────────────────────────

  /**
   * Clears `mobile.border` when it no longer differs from the desktop border.
   * A field that is null or undefined on mobile does not override anything.
   *
   * Runs right after a write, in the same tick: the history snapshot is cloned
   * when it commits (600 ms later, or at the next structural change), so it
   * records the cleaned node.
   */
  const dropBorderOverrideIfRedundant = (): void => {
    const n = node.value;
    const mb = n?.mobile?.border;
    if (!n || !mb) return;
    const db = n.border;
    const redundant = BORDER_KEYS.every(
      (k) => mb[k] === null || mb[k] === undefined || mb[k] === db?.[k],
    );
    if (redundant) n.mobile.border = null;
  };

  const setBorderProp = (key: keyof BorderProps, value: unknown): void => {
    base.setBorderProp(key, value);
    if (editMode.value === "mobile") dropBorderOverrideIfRedundant();
  };

  /** True when this one border field differs from the desktop border. */
  const isBorderPropOverridden = (key: keyof BorderProps): boolean => {
    if (editMode.value !== "mobile") return false;
    const n = node.value;
    const v = n?.mobile?.border?.[key];
    return v !== null && v !== undefined && v !== n?.border?.[key];
  };

  /** Puts one border field back to the desktop value; the rest stay as set. */
  const resetBorderProp = (key: keyof BorderProps): void => {
    const n = node.value;
    if (!n || editMode.value !== "mobile" || !n.mobile?.border) return;
    setBorderProp(key, n.border?.[key]);
  };

  return {
    // plain keys: minHeight, gap, padding, verticalAlign, height
    displayValue,
    isOverridden: base.isOverridden,
    setProp: base.setProp,
    resetProp: base.resetProp,
    // border
    displayBorderValue: base.displayBorderValue,
    setBorderProp,
    isBorderPropOverridden,
    resetBorderProp,
    isBorderOverridden: base.isBorderOverridden,
    resetBorder: base.resetBorder,
    // background
    displayBackground,
    setBackground: base.setBackground,
    isBackgroundOverridden: base.isBackgroundOverridden,
    resetBackground: base.resetBackground,
  };
}
