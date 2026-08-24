/**
 * useComponentStyleEditor
 *
 * Centralises the repeated desktop/mobile prop logic found in every
 * properties panel (Heading, Image, Button, Socials, …).
 * v3 — typed, null-guarded, single-commit background writes.
 *
 * Usage:
 *   const { displayValue, setProp, canReset, resetProp, incrementProp, decrementProp } =
 *     useComponentStyleEditor(component, editMode)
 */

import { computed } from "vue";
import type { Ref, ComputedRef } from "vue";
import { useEmailBuilder } from "../core/useEmailBuilder";

// ─── Gradient types (mirrors GradientPicker.vue) ──────────────────────────────

export interface GradientStop {
  color: string;
  position: number;
}

export interface GradientConfig {
  type: "linear" | "radial";
  direction: string;
  colors: GradientStop[];
}

export interface BackgroundValue {
  useGradient: boolean;
  solid: string;
  gradient: GradientConfig;
}

// ─── Component types ──────────────────────────────────────────────────────────

export type EditMode = "desktop" | "mobile";

export interface BorderProps {
  width: number;
  color: string;
  style: "solid" | "dashed" | "dotted";
  radius?: number;
}

/**
 * Loose-but-honest shape for any component the style editor touches.
 * Every key is optional because different component types carry different
 * subsets (Image has no backgroundGradient, Anchor has no border, etc.).
 *
 * `mobile` is typed as required-but-nullable-fields because
 * useEmailBuilderDefaults always seeds it on instantiation. Index signature
 * preserves access to any key without enumerating every prop per component.
 */
export interface StyledComponentProps {
  mobile: Record<string, any> | null;
  border?: BorderProps;
  backgroundColor?: string;
  backgroundGradient?: BackgroundValue | null;
  desktopHide?: boolean;
  mobileHide?: boolean;
  [key: string]: any;
}

export interface StyledComponent {
  id: string;
  type: string;
  props: StyledComponentProps;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Factory, not a frozen constant — every caller gets its own fresh `colors`
 * array. Prevents accidental shared-mutation if a future feature edits a
 * gradient stop in place.
 */
const makeDefaultGradientConfig = (): GradientConfig => ({
  type: "linear",
  direction: "to right",
  colors: [
    { color: "#007bff", position: 0 },
    { color: "#00ff88", position: 100 },
  ],
});

/**
 * Safe universal fallback. `transparent` cannot visually break any component
 * if it ever leaks through — unlike a coloured default that would paint
 * components that should have no background.
 */
const makeDefaultBackground = (): BackgroundValue => ({
  useGradient: false,
  solid: "transparent",
  gradient: makeDefaultGradientConfig(),
});

// Float-precision helper for `step < 1` slider increments. Replaces the
// fragile `step === 0.1 ? +next.toFixed(1) : next` check from v2.
const roundForStep = (value: number, step: number): number => {
  if (step >= 1) return value;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  return +value.toFixed(decimals);
};

// ─── Composable ───────────────────────────────────────────────────────────────

export function useComponentStyleEditor(
  component: Ref<StyledComponent | null> | ComputedRef<StyledComponent | null>,
  editMode: Ref<EditMode> | ComputedRef<EditMode>,
) {
  const { saveToHistory } = useEmailBuilder();

  // ── Core helpers ────────────────────────────────────────────────────────────

  const displayValue = (key: string) => {
    const c = component.value;
    if (!c) return undefined;
    if (editMode.value === "desktop") return c.props[key];
    const mv = c.props.mobile?.[key];
    return mv !== null && mv !== undefined ? mv : c.props[key];
  };

  const isOverridden = (key: string) =>
    editMode.value === "mobile" &&
    component.value?.props.mobile?.[key] !== null &&
    component.value?.props.mobile?.[key] !== undefined;

  const canReset = isOverridden;

  const setProp = (key: string, value: any) => {
    const c = component.value;
    if (!c) return;
    if (editMode.value === "desktop") {
      c.props[key] = value;
    } else {
      if (!c.props.mobile) c.props.mobile = {};
      c.props.mobile[key] = value;
    }
    saveToHistory(`set-${key}`);
  };

  const resetProp = (key: string) => {
    const c = component.value;
    if (!c || editMode.value !== "mobile" || !c.props.mobile) return;
    c.props.mobile[key] = null;
    saveToHistory(`reset-${key}`);
  };

  const incrementProp = (key: string, step = 1) => {
    const cur = displayValue(key);
    const next = typeof cur === "number" ? cur + step : step;
    setProp(key, roundForStep(next, step));
  };

  const decrementProp = (key: string, step = 1, min = 0) => {
    const cur = displayValue(key);
    const next = typeof cur === "number" ? Math.max(min, cur - step) : min;
    setProp(key, roundForStep(next, step));
  };

  // ── Border helpers ──────────────────────────────────────────────────────────

  const displayBorderValue = (key: keyof BorderProps) => {
    const c = component.value;
    if (!c) return undefined;
    if (editMode.value === "desktop") return c.props.border?.[key];
    const mb = c.props.mobile?.border;
    if (!mb) return c.props.border?.[key];
    return mb[key] !== null && mb[key] !== undefined
      ? mb[key]
      : c.props.border?.[key];
  };

  const setBorderProp = (key: keyof BorderProps, value: any) => {
    const c = component.value;
    if (!c) return;
    if (editMode.value === "desktop") {
      if (!c.props.border) {
        c.props.border = { width: 0, color: "#111111", style: "solid" };
      }
      (c.props.border as any)[key] = value;
    } else {
      if (!c.props.mobile) c.props.mobile = {};
      if (!c.props.mobile.border) {
        c.props.mobile.border = { ...(c.props.border ?? {}) };
      }
      c.props.mobile.border[key] = value;
    }
    saveToHistory(`set-border-${key}`);
  };

  const incrementBorderProp = (key: keyof BorderProps) =>
    setBorderProp(key, ((displayBorderValue(key) as number) || 0) + 1);

  const decrementBorderProp = (key: keyof BorderProps) =>
    setBorderProp(
      key,
      Math.max(0, ((displayBorderValue(key) as number) || 0) - 1),
    );

  /**
   * Field-by-field check — returns true only if the mobile border actually
   * differs from the desktop border, not just "the object exists". Prevents
   * a phantom Reset button on an unchanged border.
   */
  const isBorderOverridden = (): boolean => {
    if (editMode.value !== "mobile") return false;
    const mb = component.value?.props.mobile?.border;
    if (!mb) return false;
    const db = component.value?.props.border;
    const keys: (keyof BorderProps)[] = ["width", "color", "style", "radius"];
    return keys.some(
      (k) => mb[k] !== undefined && mb[k] !== null && mb[k] !== db?.[k],
    );
  };

  const resetBorder = () => {
    const c = component.value;
    if (!c || editMode.value !== "mobile" || !c.props.mobile) return;
    c.props.mobile.border = null;
    saveToHistory("reset-border");
  };

  // ── Background helpers (gradient-aware) ─────────────────────────────────────

  /**
   * Returns the effective BackgroundValue for the current edit mode.
   * Always fully shaped — never null/undefined.
   */
  const displayBackground = (): BackgroundValue => {
    const solidColor: string =
      displayValue("backgroundColor") || makeDefaultBackground().solid;
    const bgGradient: BackgroundValue | null | undefined =
      displayValue("backgroundGradient");

    if (bgGradient && typeof bgGradient === "object") {
      return {
        ...makeDefaultBackground(),
        ...bgGradient,
        gradient: {
          ...makeDefaultGradientConfig(),
          ...(bgGradient.gradient ?? {}),
        },
        solid: bgGradient.useGradient
          ? (bgGradient.gradient?.colors[0]?.color ?? solidColor)
          : solidColor,
      };
    }

    return {
      ...makeDefaultBackground(),
      useGradient: false,
      solid: solidColor,
    };
  };

  /**
   * Persist a BackgroundValue to the correct layer in ONE write, with ONE
   * history commit. v2 went through setProp twice — which usually collapsed
   * via the 600 ms history debounce but could split into two history entries
   * if a structural op landed between them.
   *
   * Also keeps `backgroundColor` in sync as a CSS-safe fallback for export.
   */
  const setBackground = (value: BackgroundValue) => {
    const c = component.value;
    if (!c) return;

    const bg: BackgroundValue = {
      ...makeDefaultBackground(),
      ...value,
      gradient: {
        ...makeDefaultGradientConfig(),
        ...(value.gradient ?? {}),
      },
    };

    const fallbackColor = bg.useGradient
      ? (bg.gradient.colors[0]?.color ?? bg.solid)
      : bg.solid;

    if (editMode.value === "desktop") {
      c.props.backgroundColor = fallbackColor;
      c.props.backgroundGradient = bg;
    } else {
      if (!c.props.mobile) c.props.mobile = {};
      c.props.mobile.backgroundColor = fallbackColor;
      c.props.mobile.backgroundGradient = bg;
    }
    saveToHistory("set-background");
  };

  /**
   * True only if the mobile background actually carries an override.
   * Checks both backgroundColor and backgroundGradient — either being
   * non-null counts as an override.
   */
  const isBackgroundOverridden = (): boolean => {
    if (editMode.value !== "mobile") return false;
    const mobile = component.value?.props.mobile;
    if (!mobile) return false;
    return (
      (mobile.backgroundGradient !== null &&
        mobile.backgroundGradient !== undefined) ||
      (mobile.backgroundColor !== null && mobile.backgroundColor !== undefined)
    );
  };

  const resetBackground = () => {
    const c = component.value;
    if (!c || editMode.value !== "mobile" || !c.props.mobile) return;
    c.props.mobile.backgroundGradient = null;
    c.props.mobile.backgroundColor = null;
    saveToHistory("reset-background");
  };

  const toggleGradient = (useGradient: boolean) => {
    setBackground({ ...displayBackground(), useGradient });
  };

  const setGradientColors = (colors: GradientStop[]) => {
    const current = displayBackground();
    setBackground({
      ...current,
      useGradient: true,
      gradient: { ...current.gradient, colors },
    });
  };

  const setGradientConfig = (config: Partial<GradientConfig>) => {
    const current = displayBackground();
    setBackground({
      ...current,
      useGradient: true,
      gradient: { ...current.gradient, ...config },
    });
  };

  // ── Legacy background shorthands ────────────────────────────────────────────
  // @deprecated Prefer displayBackground / setBackground for gradient-aware UI.
  // Retained for any panel still on the v1 API. Safe to delete once every
  // panel migrates to PropertyGradientColor.

  const useTransparentBg = computed({
    get: () => displayValue("backgroundColor") === "transparent",
    set: (val: boolean) =>
      setProp("backgroundColor", val ? "transparent" : "#ffffff"),
  });

  const bgColor = computed(() => {
    const bg = displayValue("backgroundColor");
    return bg === "transparent" ? "#ffffff" : bg;
  });

  const setBgColor = (value: string) => setProp("backgroundColor", value);

  // ── Device visibility toggles ───────────────────────────────────────────────

  const toggleDesktopHide = () => {
    const c = component.value;
    if (!c) return;
    c.props.desktopHide = !c.props.desktopHide;
    saveToHistory("toggle-desktop-hide");
  };

  const toggleMobileHide = () => {
    const c = component.value;
    if (!c) return;
    c.props.mobileHide = !c.props.mobileHide;
    saveToHistory("toggle-mobile-hide");
  };

  return {
    // core
    displayValue,
    isOverridden,
    canReset,
    setProp,
    resetProp,
    incrementProp,
    decrementProp,
    // border
    displayBorderValue,
    setBorderProp,
    incrementBorderProp,
    decrementBorderProp,
    isBorderOverridden,
    resetBorder,
    // background – gradient-aware
    displayBackground,
    setBackground,
    isBackgroundOverridden,
    resetBackground,
    toggleGradient,
    setGradientColors,
    setGradientConfig,
    // background – legacy (deprecated)
    useTransparentBg,
    bgColor,
    setBgColor,
    // device visibility
    toggleDesktopHide,
    toggleMobileHide,
  };
}
