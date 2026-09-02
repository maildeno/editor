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
 * down.
 *
 * ── Reading the dark half ───────────────────────────────────────────────────
 * The dark neutrals (background/surface/border/sidebar/etc.) are true grays —
 * zero hue, R=G=B — not the navy-tinted slate the light half's grays lean on.
 * That's deliberate: at low luminance, even a small blue channel bias reads
 * as "everything is midnight blue" and competes with the indigo/violet brand
 * colors instead of setting them off. Brand, selection, and semantic tokens
 * keep their hue in the dark half; only the chrome went neutral.
 *
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
 *                    dark room the sheet is lit against. In dark mode this
 *                    bottoms out at true black.
 *
 * One consistency fix from the previous pass: `buttonPrimaryBg` had drifted
 * to the light-mode indigo (#6366f1) while `primary`/`primaryHover` used the
 * dark-adjusted indigo (#818cf8) — two different "primary" shades on screen
 * at once. Both now use the same dark-adjusted indigo, with dark ink text
 * instead of white, since #818cf8 is too light to carry white text.
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

    // Core — true neutral gray (R=G=B), not navy-tinted slate. This is the
    // fix: the previous dark half built background/surface/border off blue
    // hex values, so the whole UI read as tinted midnight-blue.
    background: "#0a0a0a",
    surface: "#171717",
    surfaceMuted: "#212121",
    surfaceHover: "#2b2b2b",

    text: "#fafafa",
    textMuted: "#a3a3a3",
    textSubtle: "#6b6b6b",

    border: "#262626",
    borderStrong: "#3a3a3a",

    danger: "#f87171",
    onDanger: "#450a0a",
    success: "#34d399",
    warning: "#fbbf24",
    info: "#60a5fa",

    shadow:
      "0 12px 30px -8px rgba(0, 0, 0, 0.45), 0 4px 10px -6px rgba(0, 0, 0, 0.35)",

    scrim: "rgba(0, 0, 0, 0.65)",

    // Header
    headerBg: "#171717",
    headerText: "#fafafa",
    headerBorder: "#262626",

    // Sidebar — a touch darker than the header so the two chrome bands stay
    // legible against each other without reaching for a hue.
    sidebarBg: "#111111",
    sidebarText: "#fafafa",
    sidebarBorder: "#262626",

    // Selected tabs / controls — brand-tinted on purpose, unlike the neutral
    // chrome around it.
    accentBg: "#222d47",
    accentText: "#fefefe",

    // Deeper than `background`, deliberately: true black, so the light email
    // document reads as lit from within a dark room rather than just another
    // gray panel.
    canvasBg: "#000000",

    // Overlays
    overlayBg: "#171717",
    overlayText: "#fafafa",
    overlayBorder: "#262626",
    overlayShadow:
      "0 24px 48px -12px rgba(0, 0, 0, 0.55), 0 10px 24px -8px rgba(0, 0, 0, 0.40)",

    // Toolbar
    toolbarBg: "#171717",
    toolbarText: "#d1d1d1",
    toolbarBorder: "#262626",

    // Canvas selection — same two families, lifted for a dark ground.
    selection: "#60a5fa",
    selectionBg: "rgba(96, 165, 250, 0.14)",
    selectionFg: "#bfdbfe",

    rowSelection: "#a78bfa",
    rowSelectionBg: "rgba(167, 139, 250, 0.14)",
    rowSelectionFg: "#ddd6fe",

    // Inverts — a near-black tooltip has nothing to sit against here.
    tooltipBg: "#fafafa",
    tooltipText: "#171717",

    // Buttons — now consistent with `primary`/`primaryHover` above instead
    // of quietly using the light-mode indigo. Text switches to dark ink to
    // stay readable on the lighter fill (see onPrimary note).
    buttonPrimaryBg: brandDark,
    buttonPrimaryText: "#1e1b4b",
    buttonPrimaryHoverBg: brandDarkHover,

    buttonSecondaryBg: "#262626",
    buttonSecondaryText: "#fafafa",
    buttonSecondaryHoverBg: "#3a3a3a",

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

    // Not Flipped
    inverseSurface: "#111827",
    onInverse: "#f9fafb",
    onInverseMuted: "#6b6b6b",

    // Accent
    accent: "#a78bfa",
    accentHover: "#c4b5fd",
    onAccent: "#1e1b4b",
    accentSoft: "rgba(167, 139, 250, 0.14)",
    accentBorder: "rgba(167, 139, 250, 0.32)",
  },
};

export default theme;
