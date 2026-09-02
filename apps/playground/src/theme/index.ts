/**
 * App-level theme for the Maildeno email editor.
 *
 * A modern SaaS/editor palette built around indigo and violet:
 * - Indigo = primary actions and editor controls
 * - Violet = row/layout selection
 * - Blue   = component selection
 * - Cool neutrals = surfaces and canvas
 *
 * The goal is a polished "developer SaaS" interface that keeps the email
 * canvas visually dominant without making the surrounding UI feel flat.
 *
 * ── Complete on purpose ─────────────────────────────────────────────────────
 * Every token in ThemeTokens is set here, in both halves. A partial theme is
 * supported — anything omitted falls back to a coherent default — but this
 * file doubles as the playground's reference sheet, so leaving gaps would mean
 * the demo silently exercises package defaults for the tokens nobody wrote
 * down. That is exactly how a broken dark palette went unnoticed: the
 * playground had no dark mode at all, so nothing here was ever evaluated
 * against `.dark`.
 *
 * ── Reading the dark half ───────────────────────────────────────────────────
 * Three pairs behave in ways that are easy to get wrong:
 *
 *   inverseSurface   INVERTS. Near-black in light, near-white in dark. It is
 *                    the dark pill (primary CTA, active tab). Do not reach for
 *                    `text` here — a text token cannot flip that way without
 *                    making body copy invisible.
 *   tooltipBg        Also inverts, and for the opposite reason: a near-black
 *                    tooltip on an already-dark canvas has nothing to sit
 *                    against.
 *   canvasBg         Goes DEEPER than `background`, not lighter. The email
 *                    itself stays a light document because that is what it
 *                    will be in an inbox, so the workspace has to read as a
 *                    dark room the sheet is lit against.
 */
import type { ThemeOptions } from "@maildeno/editor";

// ── Brand ────────────────────────────────────────────────────────────────
const brand = "#6366f1";
const brandHover = "#4f46e5";

const brandDark = "#818cf8";
const brandDarkHover = "#a5b4fc";

export const theme: ThemeOptions = {
  // ── Core ──────────────────────────────────────────────────────────────
  primary: brand,
  primaryHover: brandHover,
  onPrimary: "#ffffff",

  background: "#f8fafc",
  surface: "#ffffff",
  surfaceMuted: "#f1f5f9",
  surfaceHover: "#f9fafb",

  text: "#111827",
  textMuted: "#4b5563",
  textSubtle: "#9ca3af",

  border: "#e5e7eb",
  borderStrong: "#d1d5db",

  danger: "#ef4444",
  onDanger: "#ffffff",
  success: "#10b981",
  warning: "#f59e0b",
  info: "#3b82f6",

  shadow:
    "0 8px 20px -6px rgba(15, 23, 42, 0.10), 0 3px 8px -4px rgba(15, 23, 42, 0.08)",

  scrim: "rgba(15, 23, 42, 0.45)",

  // ── Semantic surfaces ────────────────────────────────────────────────
  headerBg: "#ffffff",
  headerText: "#111827",
  headerBorder: "#e5e7eb",

  sidebarBg: "#ffffff",
  sidebarText: "#111827",
  sidebarBorder: "#e5e7eb",

  // Selected tabs / segmented controls.
  accentBg: "#eef2ff",
  accentText: "#4f46e5",

  // The workspace behind the email. Not white — the email is white and needs
  // something to sit against.
  canvasBg: "#f1f5f9",

  // ── Overlays ─────────────────────────────────────────────────────────
  overlayBg: "#ffffff",
  overlayText: "#111827",
  overlayBorder: "#e5e7eb",
  overlayShadow:
    "0 24px 48px -12px rgba(15, 23, 42, 0.16), 0 8px 20px -8px rgba(15, 23, 42, 0.10)",

  // ── Toolbar ──────────────────────────────────────────────────────────
  toolbarBg: "#ffffff",
  toolbarText: "#374151",
  toolbarBorder: "#e5e7eb",

  // ── Canvas selection ─────────────────────────────────────────────────
  // Component selection is blue; row selection is violet. Two families on
  // purpose — a row outline and a component outline should never be confused
  // at a glance. (These were both blue before, which made the distinction the
  // package documents impossible to see.)
  selection: "#3b82f6",
  selectionBg: "#eff6ff",
  selectionFg: "#1d4ed8",

  rowSelection: "#8b5cf6",
  rowSelectionBg: "#f5f3ff",
  rowSelectionFg: "#6d28d9",

  // ── Tooltips ─────────────────────────────────────────────────────────
  tooltipBg: "#111827",
  tooltipText: "#f9fafb",

  // ── Buttons ──────────────────────────────────────────────────────────
  buttonPrimaryBg: brand,
  buttonPrimaryText: "#ffffff",
  buttonPrimaryHoverBg: brandHover,

  buttonSecondaryBg: "#f1f5f9",
  buttonSecondaryText: "#374151",
  buttonSecondaryHoverBg: "#e2e8f0",

  // ── Severity tints ───────────────────────────────────────────────────
  successBg: "#ecfdf5",
  successFg: "#047857",
  successBorder: "#a7f3d0",

  infoBg: "#eff6ff",
  infoFg: "#1d4ed8",
  infoBorder: "#bfdbfe",

  warningBg: "#fffbeb",
  warningFg: "#b45309",
  warningBorder: "#fde68a",

  dangerBg: "#fef2f2",
  dangerFg: "#b91c1c",
  dangerBorder: "#fecaca",

  // ── Inverse surface ──────────────────────────────────────────────────
  // The dark pill. See the docblock: this one inverts.
  inverseSurface: "#111827",
  onInverse: "#f9fafb",
  onInverseMuted: "#9ca3af",

  // ── Accent (AI surfaces, secondary signal) ───────────────────────────
  accent: "#7c3aed",
  accentHover: "#6d28d9",
  onAccent: "#ffffff",
  accentSoft: "#f5f3ff",
  accentBorder: "rgba(124, 58, 237, 0.24)",

  // ── Dark mode ────────────────────────────────────────────────────────
  // Applies when the editor root carries `.dark`, which the package mirrors
  // from the host page — see App.vue's switcher, which does nothing more than
  // toggle the class on <html>.
  dark: {
    // Brand
    primary: brandDark,
    primaryHover: brandDarkHover,
    // Dark ink on a light indigo fill, not white: #818cf8 is too light to
    // carry white text.
    onPrimary: "#1e1b4b",

    // Core
    background: "#0b1120",
    surface: "#111827",
    surfaceMuted: "#1f2937",
    surfaceHover: "#374151",

    text: "#f9fafb",
    textMuted: "#9ca3af",
    textSubtle: "#6b7280",

    border: "#1f2937",
    borderStrong: "#374151",

    danger: "#f87171",
    onDanger: "#450a0a",
    success: "#34d399",
    warning: "#fbbf24",
    info: "#60a5fa",

    shadow:
      "0 12px 30px -8px rgba(0, 0, 0, 0.45), 0 4px 10px -6px rgba(0, 0, 0, 0.35)",

    scrim: "rgba(0, 0, 0, 0.65)",

    // Header
    headerBg: "#111827",
    headerText: "#f9fafb",
    headerBorder: "#1f2937",

    // Sidebar
    sidebarBg: "#0f172a",
    sidebarText: "#f9fafb",
    sidebarBorder: "#1f2937",

    // Selected tabs / controls
    accentBg: "rgba(99, 102, 241, 0.16)",
    accentText: "#a5b4fc",

    // Deeper than `background`, deliberately.
    canvasBg: "#020617",

    // Overlays
    overlayBg: "#111827",
    overlayText: "#f9fafb",
    overlayBorder: "#1f2937",
    overlayShadow:
      "0 24px 48px -12px rgba(0, 0, 0, 0.55), 0 10px 24px -8px rgba(0, 0, 0, 0.40)",

    // Toolbar
    toolbarBg: "#111827",
    toolbarText: "#d1d5db",
    toolbarBorder: "#1f2937",

    // Canvas selection — same two families, lifted for a dark ground.
    selection: "#60a5fa",
    selectionBg: "rgba(96, 165, 250, 0.14)",
    selectionFg: "#bfdbfe",

    rowSelection: "#a78bfa",
    rowSelectionBg: "rgba(167, 139, 250, 0.14)",
    rowSelectionFg: "#ddd6fe",

    // Inverts — a near-black tooltip has nothing to sit against here.
    tooltipBg: "#f9fafb",
    tooltipText: "#111827",

    // Buttons
    buttonPrimaryBg: "#6366f1",
    buttonPrimaryText: "#ffffff",
    buttonPrimaryHoverBg: "#818cf8",

    buttonSecondaryBg: "#1f2937",
    buttonSecondaryText: "#f9fafb",
    buttonSecondaryHoverBg: "#374151",

    // Severity tints — kept dark and desaturated so a toast reads as a
    // surface in the UI rather than a bright rectangle punched through it.
    successBg: "rgba(52, 211, 153, 0.12)",
    successFg: "#6ee7b7",
    successBorder: "rgba(52, 211, 153, 0.30)",

    infoBg: "rgba(96, 165, 250, 0.12)",
    infoFg: "#93c5fd",
    infoBorder: "rgba(96, 165, 250, 0.30)",

    warningBg: "rgba(251, 191, 36, 0.12)",
    warningFg: "#fde68a",
    warningBorder: "rgba(251, 191, 36, 0.30)",

    dangerBg: "rgba(248, 113, 113, 0.12)",
    dangerFg: "#fca5a5",
    dangerBorder: "rgba(248, 113, 113, 0.30)",

    // Flipped, as promised on the light side.
    inverseSurface: "#f9fafb",
    onInverse: "#111827",
    onInverseMuted: "#4b5563",

    // Accent
    accent: "#a78bfa",
    accentHover: "#c4b5fd",
    onAccent: "#1e1b4b",
    accentSoft: "rgba(167, 139, 250, 0.14)",
    accentBorder: "rgba(167, 139, 250, 0.32)",
  },
};

export default theme;
