import type { VisibilityOperator } from "@/composables/emailBuilder/core/useEmailBuilderVisibility";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface VisibilityRule {
  tag: string;                 // ✅ was `type: string`
  operator: VisibilityOperator; // ✅ was plain `string`
  value: string;               // ✅ was `any`
}

export interface VisibilityGroup {
  match: "all" | "any";
  rules: VisibilityRule[];
}

export interface VisibilityConfig {
  enabled: boolean;
  match: "all" | "any";
  rules: VisibilityRule[];
  groups?: VisibilityGroup[];  // ✅ nested group support
}

export interface HideConfig {
  desktopHide: boolean;
  mobileHide: boolean;
}

export interface BaseComponentConfig extends HideConfig {
  visibility: VisibilityConfig;
}

// ─── Factory functions ────────────────────────────────────────────────────────
//
// Always use these when creating rows or components.
// Each call returns a brand new object with its own arrays so no two
// rows/components ever share the same visibility reference.
//
// ❌ NEVER do:  visibility: DEFAULT_VISIBILITY   (shared reference)
// ❌ NEVER do:  ...DEFAULT_BASE_CONFIG           (shallow copy, visibility still shared)
// ✅ ALWAYS do: visibility: createDefaultVisibility()
// ✅ ALWAYS do: ...createDefaultBaseConfig()

export const createDefaultVisibility = (): VisibilityConfig => ({
  enabled: false,
  match: "all",
  rules: [],
  // groups is intentionally omitted — only added when the user creates one
});

export const createDefaultHide = (): HideConfig => ({
  desktopHide: false,
  mobileHide: false,
});

export const createDefaultBaseConfig = (): BaseComponentConfig => ({
  visibility: createDefaultVisibility(), // fresh object every call
  ...createDefaultHide(),
});

// ─── Static reference constants (type checking / comparisons only) ────────────
//
// These are fine to use for reading/comparing but NEVER assign them
// directly to a row or component — use the factory functions above instead.

export const DEFAULT_VISIBILITY: Readonly<VisibilityConfig> = Object.freeze({
  enabled: false,
  match: "all" as const,
  rules: [],
});

export const DEFAULT_HIDE: Readonly<HideConfig> = Object.freeze({
  desktopHide: false,
  mobileHide: false,
});

export const DEFAULT_BASE_CONFIG: Readonly<BaseComponentConfig> = Object.freeze({
  visibility: DEFAULT_VISIBILITY,
  ...DEFAULT_HIDE,
});