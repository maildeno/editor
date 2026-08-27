/**
 * App-level theme for the Maildeno email editor.
 *
 * A modern SaaS/editor palette built around indigo and violet:
 * - Indigo = primary actions and editor controls
 * - Violet = row/layout selection
 * - Blue = component selection
 * - Cool neutrals = surfaces and canvas
 *
 * The goal is a polished "developer SaaS" interface that keeps the
 * email canvas visually dominant without making the surrounding UI feel flat.
 */
import type { ThemeOptions } from "@maildeno/editor";

// ── Brand ────────────────────────────────────────────────────────────────
const brand = "#6366f1";
const brandHover = "#4f46e5";

export const theme: ThemeOptions = {
  // ── Core ──────────────────────────────────────────────────────────────
  primary: brand,
  primaryHover: brandHover,
  onPrimary: "#ffffff",

  background: "#f8fafc",
  surface: "#ffffff",
  surfaceMuted: "#f1f5f9",
  surfaceHover: "#e2e8f0",

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

  ring: brand,

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

  // Email editor workspace.
  canvasBg: "#f1f5f9",

  inputBg: "#ffffff",
  inputText: "#111827",
  inputBorder: "#d1d5db",
  inputPlaceholder: "#9ca3af",

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

  // Component selection: blue.
  selection: "#3b82f6",
  selectionBg: "#eff6ff",
  selectionFg: "#1d4ed8",

  // Row selection: violet.
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

  // ── Severity tints ──────────────────────────────────────────────────

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

  // ── Dark mode ────────────────────────────────────────────────────────

  dark: {
    // Brand
    primary: "#818cf8",
    primaryHover: "#a5b4fc",
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

    ring: "#818cf8",

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

    // Editor workspace
    canvasBg: "#020617",

    // Inputs
    inputBg: "#111827",
    inputText: "#f9fafb",
    inputBorder: "#374151",
    inputPlaceholder: "#6b7280",

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

    // Component selection
    selection: "#60a5fa",
    selectionBg: "rgba(96, 165, 250, 0.14)",
    selectionFg: "#bfdbfe",

    // Row selection
    rowSelection: "#a78bfa",
    rowSelectionBg: "rgba(167, 139, 250, 0.14)",
    rowSelectionFg: "#ddd6fe",

    // Tooltip
    tooltipBg: "#f9fafb",
    tooltipText: "#111827",

    // Buttons
    buttonPrimaryBg: "#6366f1",
    buttonPrimaryText: "#ffffff",
    buttonPrimaryHoverBg: "#818cf8",

    buttonSecondaryBg: "#1f2937",
    buttonSecondaryText: "#f9fafb",
    buttonSecondaryHoverBg: "#374151",

    // Severity tints
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
  },
};

export default theme;
