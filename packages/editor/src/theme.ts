/**
 * Theming via CSS custom properties.
 *
 * Setting variables rather than regenerating a stylesheet is what makes this
 * work in the custom-element build: the bundled shadow-root CSS is static and
 * cannot be re-emitted at runtime, but a custom property set on the editor
 * root cascades into the whole subtree and updates every rule reading it,
 * live.
 */

/**
 * Every themeable token.
 *
 * Two layers, deliberately. Core tokens (`primary`, `surface`, `text`, …)
 * re-theme the whole editor coherently. Semantic tokens (`headerBg`,
 * `overlayBg`, `toolbarBg`, …) default to the core ones and exist for hosts
 * that want to change one surface without redefining everything else.
 *
 * Anything left out keeps its default, so a partial theme is always coherent
 * rather than half-applied — setting only `primary` cannot produce unreadable
 * text, and setting only `headerBg` cannot leave the rest inconsistent.
 *
 * ── Every token here is read by something ───────────────────────────────────
 * Twenty-one used to be listed that nothing in the package consumed:
 * `ring`, the four `input*` tokens, `primarySoft*`, `primaryBorder`,
 * `onPrimarySoft`, `onAccentSoft`, `inverseSurfaceHover`, `borderSubtle`,
 * `surfaceSunken`, `shadowSm`, `shadowLg`, the four `code*` tokens and the two
 * `skeleton*` tokens. They had CSS defaults, they type-checked, they appeared
 * in the docs — and setting any of them did nothing, because no rule ever read
 * the variable.
 *
 * The `input*` four are the ones worth knowing about: inputs are styled from
 * `surface` / `border` / `text` / `textSubtle` directly, in the scoped CSS of
 * InputText.vue, Select.vue and DatePicker.vue. The dark palette's "a field
 * darker than its panel reads as an input" intent was never realised. Removing
 * them changes nothing on screen — they were already inert — but it stops the
 * type surface promising a control the editor does not offer. Wiring them up
 * instead is three small scoped-CSS edits, if that look is wanted.
 *
 * `codeBg` and friends belong to the host dashboard's own CodeBlock component,
 * never to the editor, which renders no code panels at all.
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
  /** Panels, header, toolbars, popovers — and, because inputs read it
   *  directly, field backgrounds. */
  surface?: string;
  /** Subtle fills — inactive tabs, secondary buttons. */
  surfaceMuted?: string;
  /** Hover fill, and the background of a disabled input. */
  surfaceHover?: string;

  text?: string;
  textMuted?: string;
  /** Also the input placeholder colour. */
  textSubtle?: string;

  border?: string;
  borderStrong?: string;

  danger?: string;
  onDanger?: string;
  success?: string;
  warning?: string;
  info?: string;

  /** Box-shadow used by popovers and dialogs. Feeds `overlayShadow`. */
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
   *  apart at a glance. */
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

  // ── Shared with the Maildeno dashboard ───────────────────────────────
  // Same names on both sides, so a host can hand one object to each and a
  // component can move between them unchanged.

  /** The dark pill — primary CTA, active tab. FLIPS to a light fill in dark
   *  mode. Use this, not `text`, for any dark-filled control: a text token
   *  cannot invert that way without making body copy invisible. */
  inverseSurface?: string;
  onInverse?: string;
  onInverseMuted?: string;

  /** Secondary signal, distinct from `primary`. Used for AI surfaces and the
   *  row-selection family. */
  accent?: string;
  accentHover?: string;
  onAccent?: string;
  accentSoft?: string;
  accentBorder?: string;
}

export interface ThemeOptions extends ThemeTokens {
  /** Tokens applied only in light mode. */
  light?: ThemeTokens;
  /**
   * Tokens applied only when the editor is in dark mode.
   *
   * Dark mode has its own complete set of defaults, so overriding a couple of
   * tokens here is enough — you do not have to restate a whole palette.
   *
   * "In dark mode" means the editor root carries the `dark` class, which
   * useColorScheme.ts puts there by mirroring the host page's own `.dark` on
   * <html> or <body>. A host with a working theme switcher needs no wiring;
   * one whose switcher works some other way passes `colorMode` to
   * <EmailEditor> instead.
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
  inverseSurface: "--md-inverse-surface",
  onInverse: "--md-on-inverse",
  onInverseMuted: "--md-on-inverse-muted",
  accent: "--md-accent",
  accentHover: "--md-accent-hover",
  onAccent: "--md-on-accent",
  accentSoft: "--md-accent-soft",
  accentBorder: "--md-accent-border",
};

/**
 * Both light and dark tokens are written as stylesheet rules into one <style>
 * element per target, rather than light going inline and dark going to a rule.
 *
 * That split was a bug. Custom properties set with `style.setProperty` are
 * element-attached declarations, and CSS Cascade L5 §6.4 sorts those above all
 * style rules *before* it ever looks at specificity. So for any token named in
 * both `base` and `dark`, the inline light value won on the dark element and
 * the dark value never applied.
 *
 * Emitting both as rules puts them back on the same footing, where the
 * intended specificity ordering decides:
 *
 *   [data-md-theme-scope="1"]        (0,1,0)   light
 *   [data-md-theme-scope="1"].dark   (0,2,0)   dark  <- wins, as intended
 *
 * Both also beat the package's bundled defaults. This matters more than it
 * looks, and only works because of where the sheet is targeted — see
 * setEditorTheme's `target` docs below.
 *
 * One <style> per target is reused, so repeated calls replace rather than
 * accumulate.
 */
const themeSheets = new WeakMap<HTMLElement, HTMLStyleElement>();
let themeScopeCounter = 0;

function declarationsFor(tokens: ThemeTokens): string {
  return Object.entries(tokens)
    .filter(
      ([k, v]) =>
        typeof v === "string" && v && VAR_NAMES[k as keyof ThemeTokens],
    )
    .map(([k, v]) => `  ${VAR_NAMES[k as keyof ThemeTokens]}: ${v};`)
    .join("\n");
}

function applyThemeTokens(
  target: HTMLElement,
  light: ThemeTokens,
  dark: ThemeTokens,
): void {
  const lightDecls = declarationsFor(light);
  const darkDecls = declarationsFor(dark);

  let sheet = themeSheets.get(target);

  if (!lightDecls && !darkDecls) {
    sheet?.remove();
    themeSheets.delete(target);
    target.removeAttribute("data-md-theme-scope");
    return;
  }

  if (!sheet) {
    sheet = document.createElement("style");
    themeSheets.set(target, sheet);
    // A per-target attribute keeps two editors on one page from theming
    // each other.
    target.setAttribute("data-md-theme-scope", String(++themeScopeCounter));
    // Inside a shadow root the sheet goes there so it can see the target;
    // in the light DOM it must go to <head>, since a <style> cannot be
    // appended to the document node itself.
    const root = target.getRootNode();
    const container =
      root instanceof ShadowRoot ? root : (document.head ?? document.body);
    container.appendChild(sheet);
  }

  const scope = target.getAttribute("data-md-theme-scope");
  const sel = `[data-md-theme-scope="${scope}"]`;

  // No descendant `*` on either rule: custom properties inherit, so setting
  // them on the scope root reaches the whole subtree, and a `.dark` descendant
  // overriding them re-inherits down from itself. Matching every element would
  // be pure selector cost for the same result.
  const blocks: string[] = [];
  if (lightDecls) blocks.push(`${sel} {\n${lightDecls}\n}`);
  // Three selectors because `.dark` can sit in three places relative to the
  // scope element:
  //
  //   ${sel}.dark    both on the same element — the normal case now that
  //                  useColorScheme.ts mirrors the page's class onto the
  //                  editor root, which is also the theme target
  //   ${sel} .dark   .dark inside the editor — a host theming one subtree
  //   .dark ${sel}   .dark on an ANCESTOR — covers the frame before the
  //                  mirror lands, and any host that targets <html> manually
  if (darkDecls)
    blocks.push(
      `${sel}.dark,\n${sel} .dark,\n.dark ${sel} {\n${darkDecls}\n}`,
    );

  sheet.textContent = blocks.join("\n\n");
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
 * @param target Where the tokens are declared. **This must be the editor's own
 *   root element**, and <EmailEditor> passes it for you — the default below is
 *   only for callers driving the CSS variables by hand, with no editor
 *   mounted.
 *
 *   Why it matters: the library build runs every injected stylesheet through
 *   scopeInjectedCss.ts, which rewrites `:root`/`:host` to `.md-editor-scope`
 *   so the editor's CSS cannot restyle the host page. That puts the package's
 *   default tokens *directly on the editor root div*. A custom property
 *   declared on an element beats any value inherited from an ancestor,
 *   whatever the specificity — so a theme written to <html> is shadowed by the
 *   defaults and never reaches the editor at all. Writing to the same element
 *   the defaults land on puts the two in the same cascade, where the runtime
 *   sheet wins on source order.
 *
 *   This is also why theming appeared to work when running from source (the
 *   playground aliases straight to `src` and never runs the scoper, so `:root`
 *   stays `:root`) and silently did nothing in a consuming app.
 */
export function setEditorTheme(
  options: ThemeOptions,
  target: HTMLElement = document.documentElement,
): void {
  const { light, dark, primaryColor, surfaceColor, ...base } = options;

  applyThemeTokens(
    target,
    {
      // Legacy names first, so the current ones win if both are given.
      ...(primaryColor ? { primary: primaryColor } : {}),
      ...(surfaceColor ? { surface: surfaceColor } : {}),
      ...base,
      ...(light ?? {}),
    },
    dark ?? {},
  );
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
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return {};

  const rgb: [number, number, number] = [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];

  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");

  /** Mixes toward white (amount > 0) or black (amount < 0). */
  const mix = ([r, g, b]: [number, number, number], amount: number) => {
    const t = amount >= 0 ? 255 : 0;
    const w = Math.abs(amount);
    return `#${toHex(r + (t - r) * w)}${toHex(g + (t - g) * w)}${toHex(b + (t - b) * w)}`;
  };

  const amounts: Record<number, number> = {
    50: 0.95,
    100: 0.9,
    200: 0.75,
    300: 0.6,
    400: 0.3,
    500: 0,
    600: -0.15,
    700: -0.3,
    800: -0.45,
    900: -0.6,
    950: -0.75,
  };

  const out: Record<string, string> = {};
  for (const [stop, amount] of Object.entries(amounts))
    out[stop] = mix(rgb, amount);
  return out;
}
