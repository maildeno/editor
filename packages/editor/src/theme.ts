/**
 * Theming via CSS custom properties.
 *
 * Setting variables rather than regenerating a stylesheet is what makes this
 * work in the custom-element build: the bundled shadow-root CSS is static and
 * cannot be re-emitted at runtime, but a custom property set on the host
 * cascades into the shadow tree and updates every rule reading it, live.
 */

/**
 * Every themeable token.
 *
 * Two layers, deliberately. Core tokens (`primary`, `surface`, `text`, …)
 * re-theme the whole editor coherently. Semantic tokens (`headerBg`,
 * `inputBg`, `overlayBg`, …) default to the core ones and exist for hosts
 * that want to change one surface without redefining everything else.
 *
 * Anything left out keeps its default, so a partial theme is always coherent
 * rather than half-applied — setting only `primary` cannot produce unreadable
 * text, and setting only `headerBg` cannot leave the rest inconsistent.
 */
export interface ThemeTokens {
  // ── Core ──────────────────────────────────────────────────────────────
  /** Brand/accent colour. Drives the primary button, focus rings, selection. */
  primary?: string;
  primaryHover?: string;
  /** Text/icon colour on top of `primary`. Set this when using a light brand
   *  colour, or the primary button's label will be unreadable. */
  onPrimary?: string;

  /** Page background behind the canvas. */
  background?: string;
  /** Panels, header, toolbars, popovers. */
  surface?: string;
  /** Subtle fills — inactive tabs, secondary buttons. */
  surfaceMuted?: string;
  surfaceHover?: string;

  text?: string;
  textMuted?: string;
  textSubtle?: string;

  border?: string;
  borderStrong?: string;

  danger?: string;
  onDanger?: string;
  success?: string;
  warning?: string;
  info?: string;

  /** Focus ring colour. Defaults to `primary`. */
  ring?: string;
  /** Box-shadow used by popovers and dialogs. */
  shadow?: string;
  /** Backdrop behind modal dialogs. */
  scrim?: string;

  // ── Semantic surfaces ────────────────────────────────────────────────
  headerBg?: string;
  headerText?: string;
  headerBorder?: string;

  sidebarBg?: string;
  sidebarText?: string;
  sidebarBorder?: string;
  /** Selected tab / segmented-control fill. Defaults to `primary`. */
  accentBg?: string;
  accentText?: string;

  canvasBg?: string;

  inputBg?: string;
  inputText?: string;
  inputBorder?: string;
  inputPlaceholder?: string;

  /** Dialogs, toasts, dropdowns, date picker and floating toolbars. */
  overlayBg?: string;
  overlayText?: string;
  overlayBorder?: string;
  overlayShadow?: string;

  toolbarBg?: string;
  toolbarText?: string;
  toolbarBorder?: string;

  /** Canvas component-selection accent. Drives hover/selected outlines on
   *  canvas components, the floating action bar's ring, and drag/drop
   *  indicators. Kept independent of `primary` so the brand button and the
   *  canvas's own interaction colour can differ — as they do by default
   *  (a dark brand button, a green canvas accent). */
  selection?: string;
  /** Pale fill for `selection` — hover backgrounds on the same controls. */
  selectionBg?: string;
  /** Readable text/icon tone for `selection` when placed on `selectionBg`. */
  selectionFg?: string;

  /** Same role as `selection`, one level up: row outlines, the row's
   *  floating toolbar, and "this is a row" indicators in the Layout tab
   *  and Layers panel. Separate token so components and rows can be told
   *  apart at a glance, as they are by default (green vs purple). */
  rowSelection?: string;
  rowSelectionBg?: string;
  rowSelectionFg?: string;

  /** Small dark tooltips on icon buttons throughout the canvas and
   *  toolbars. Kept distinct from `overlay` because tooltips are
   *  conventionally dark even in an otherwise light theme; set both if you
   *  want them to follow the rest of the theme instead. */
  tooltipBg?: string;
  tooltipText?: string;

  /** The Save / Update button — the most commonly branded control. */
  buttonPrimaryBg?: string;
  buttonPrimaryText?: string;
  buttonPrimaryHoverBg?: string;
  buttonSecondaryBg?: string;
  buttonSecondaryText?: string;
  buttonSecondaryHoverBg?: string;

  // ── Severity tints (toasts, inline messages) ─────────────────────────
  successBg?: string;
  successFg?: string;
  successBorder?: string;
  infoBg?: string;
  infoFg?: string;
  infoBorder?: string;
  warningBg?: string;
  warningFg?: string;
  warningBorder?: string;
  dangerBg?: string;
  dangerFg?: string;
  dangerBorder?: string;
}

export interface ThemeOptions extends ThemeTokens {
  /** Tokens applied only in light mode. */
  light?: ThemeTokens;
  /**
   * Tokens applied only when the editor has the `dark` class.
   *
   * Dark mode has its own complete set of defaults, so overriding a couple of
   * tokens here is enough — you do not have to restate a whole palette.
   */
  dark?: ThemeTokens;

  /** @deprecated Use `primary`. */
  primaryColor?: string;
  /** @deprecated Use `surface`. */
  surfaceColor?: string;
}

/** camelCase token → CSS custom property. */
const VAR_NAMES: Record<keyof ThemeTokens, string> = {
  primary: "--md-primary",
  primaryHover: "--md-primary-hover",
  onPrimary: "--md-on-primary",
  background: "--md-background",
  surface: "--md-surface",
  surfaceMuted: "--md-surface-muted",
  surfaceHover: "--md-surface-hover",
  text: "--md-text",
  textMuted: "--md-text-muted",
  textSubtle: "--md-text-subtle",
  border: "--md-border",
  borderStrong: "--md-border-strong",
  danger: "--md-danger",
  onDanger: "--md-on-danger",
  success: "--md-success",
  warning: "--md-warning",
  info: "--md-info",
  ring: "--md-ring",
  shadow: "--md-shadow",
  scrim: "--md-scrim",
  headerBg: "--md-header-bg",
  headerText: "--md-header-text",
  headerBorder: "--md-header-border",
  sidebarBg: "--md-sidebar-bg",
  sidebarText: "--md-sidebar-text",
  sidebarBorder: "--md-sidebar-border",
  accentBg: "--md-accent-bg",
  accentText: "--md-accent-text",
  canvasBg: "--md-canvas-bg",
  inputBg: "--md-input-bg",
  inputText: "--md-input-text",
  inputBorder: "--md-input-border",
  inputPlaceholder: "--md-input-placeholder",
  overlayBg: "--md-overlay-bg",
  overlayText: "--md-overlay-text",
  overlayBorder: "--md-overlay-border",
  overlayShadow: "--md-overlay-shadow",
  toolbarBg: "--md-toolbar-bg",
  toolbarText: "--md-toolbar-text",
  toolbarBorder: "--md-toolbar-border",
  selection: "--md-selection",
  selectionBg: "--md-selection-bg",
  selectionFg: "--md-selection-fg",
  rowSelection: "--md-row-selection",
  rowSelectionBg: "--md-row-selection-bg",
  rowSelectionFg: "--md-row-selection-fg",
  tooltipBg: "--md-tooltip-bg",
  tooltipText: "--md-tooltip-text",
  buttonPrimaryBg: "--md-button-primary-bg",
  buttonPrimaryText: "--md-button-primary-text",
  buttonPrimaryHoverBg: "--md-button-primary-hover-bg",
  buttonSecondaryBg: "--md-button-secondary-bg",
  buttonSecondaryText: "--md-button-secondary-text",
  buttonSecondaryHoverBg: "--md-button-secondary-hover-bg",
  successBg: "--md-success-bg",
  successFg: "--md-success-fg",
  successBorder: "--md-success-border",
  infoBg: "--md-info-bg",
  infoFg: "--md-info-fg",
  infoBorder: "--md-info-border",
  warningBg: "--md-warning-bg",
  warningFg: "--md-warning-fg",
  warningBorder: "--md-warning-border",
  dangerBg: "--md-danger-bg",
  dangerFg: "--md-danger-fg",
  dangerBorder: "--md-danger-border",
};

/**
 * Dark-mode tokens are written to a second, more specific rule rather than
 * onto the element itself, because an inline style would win over the `.dark`
 * class and leak dark values into light mode. One <style> element per target
 * is reused so repeated calls replace rather than accumulate.
 */
const darkSheets = new WeakMap<HTMLElement, HTMLStyleElement>();
let darkScopeCounter = 0;

function applyTokens(target: HTMLElement, tokens: ThemeTokens): void {
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== "string" || !value) continue;
    const varName = VAR_NAMES[key as keyof ThemeTokens];
    if (varName) target.style.setProperty(varName, value);
  }
}

function applyDarkTokens(target: HTMLElement, tokens: ThemeTokens): void {
  const declarations = Object.entries(tokens)
    .filter(([k, v]) => typeof v === "string" && v && VAR_NAMES[k as keyof ThemeTokens])
    .map(([k, v]) => `  ${VAR_NAMES[k as keyof ThemeTokens]}: ${v};`)
    .join("\n");

  let sheet = darkSheets.get(target);
  if (!declarations) {
    sheet?.remove();
    darkSheets.delete(target);
    return;
  }

  if (!sheet) {
    sheet = document.createElement("style");
    darkSheets.set(target, sheet);
    // A per-target attribute keeps two editors on one page from theming
    // each other.
    target.setAttribute("data-md-theme-scope", String(++darkScopeCounter));
    // Inside a shadow root the sheet goes there so it can see the host;
    // in the light DOM it must go to <head>, since a <style> cannot be
    // appended to the document node itself.
    const root = target.getRootNode();
    const container =
      root instanceof ShadowRoot ? root : (document.head ?? document.body);
    container.appendChild(sheet);
  }

  const scope = target.getAttribute("data-md-theme-scope");
  sheet.textContent =
    `[data-md-theme-scope="${scope}"].dark,\n` +
    `[data-md-theme-scope="${scope}"] .dark {\n${declarations}\n}`;
}

/**
 * Applies theme tokens.
 *
 * ```ts
 * setEditorTheme({
 *   primary: "#6366f1",
 *   buttonPrimaryText: "#ffffff",
 *   dark: { primary: "#818cf8", headerBg: "#0f172a" },
 * });
 * ```
 *
 * @param target For the plain Vue build, omit — defaults to
 *   `document.documentElement`. For the custom-element build, pass the
 *   `<maildeno-editor>` element, so the properties cascade into its shadow
 *   tree. `handle.setTheme()` does this for you.
 */
export function setEditorTheme(
  options: ThemeOptions,
  target: HTMLElement = document.documentElement,
): void {
  const { light, dark, primaryColor, surfaceColor, ...base } = options;

  applyTokens(target, {
    // Legacy names first, so the current ones win if both are given.
    ...(primaryColor ? { primary: primaryColor } : {}),
    ...(surfaceColor ? { surface: surfaceColor } : {}),
    ...base,
    ...(light ?? {}),
  });

  if (dark) applyDarkTokens(target, dark);
}

/**
 * Expands one hex colour into a 50–950 shade scale.
 *
 * The editor's own tokens no longer need this — `primary` and
 * `primaryHover` are set directly — but it stays exported because hosts use
 * it to derive matching shades for their own UI around the editor.
 */
export function palette(hex: string): Record<string, string> {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return {};

  const rgb: [number, number, number] = [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];

  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");

  /** Mixes toward white (amount > 0) or black (amount < 0). */
  const mix = ([r, g, b]: [number, number, number], amount: number) => {
    const t = amount >= 0 ? 255 : 0;
    const w = Math.abs(amount);
    return `#${toHex(r + (t - r) * w)}${toHex(g + (t - g) * w)}${toHex(b + (t - b) * w)}`;
  };

  const amounts: Record<number, number> = {
    50: 0.95, 100: 0.9, 200: 0.75, 300: 0.6, 400: 0.3,
    500: 0, 600: -0.15, 700: -0.3, 800: -0.45, 900: -0.6, 950: -0.75,
  };

  const out: Record<string, string> = {};
  for (const [stop, amount] of Object.entries(amounts)) out[stop] = mix(rgb, amount);
  return out;
}
