import type { Component } from "vue";

/**
 * Confirmed against the real generators (html.ts/mjml.ts/react-email.ts):
 * each is a switch(type) dispatcher with no default case — an unmapped type
 * renders as an empty string, silently. That's why all three export
 * renderers are required, not optional-with-fallback.
 *
 * Confirmed against CanvasComponent.vue and ContentTab.vue: block dispatch
 * actually happens in five places, not three — canvas rendering and the
 * settings panel are separate v-if chains the original README draft didn't
 * account for. Same "no silent gap" rule applies here for consistency:
 * renderCanvas and renderSettings are required too.
 */

export interface BlockRenderContext {
  uid: string;
  marginStyle: string;
  paddingStyle: string;
  escapeHtml: (s: string) => string;
  escapeAttr: (s: string) => string;
  safeUrl: (s: string) => string;
  resolveBgCss: (gradient: any, fallback: string) => string;
  resolveBgVml: (
    gradient: any,
    fallback: string,
  ) => { vmlOpen: string; vmlClose: string };
  getResponsiveClasses: (
    desktopHide: boolean,
    mobileHide: boolean,
    suffix?: string,
  ) => string;
  /** React Email target only — builds JSX style objects instead of CSS
   * strings (confirmed: hand-rolled, not the real react/mjml packages). */
  react: {
    parseCssString: (css: string) => Record<string, string>;
    parseMarginPaddingDiscrete: (
      margin?: any,
      padding?: any,
    ) => Record<string, string>;
    normalizeFontFamily: (value: string) => string;
    styleObj: (obj: Record<string, any>) => string;
    normalizeInlineStylesToReact: (html: string) => string;
    buildInlineJsx: (
      component: "Text" | "Heading",
      className: string,
      styleRecord: Record<string, any>,
      children: string,
      as?: string,
    ) => string;
  };
}

export interface BlockDefinition {
  name: string;

  /**
   * Shown in the sidebar tooltip and the block's info dialog. Falls back to
   * `name` when omitted.
   */
  label?: string;

  /**
   * Sidebar icon. Either a raw SVG string or a Vue component.
   *
   * A string is the common case — paste the SVG from whatever icon set you
   * use, no import or build step. It is rendered inline so it inherits
   * `currentColor` and the surrounding sizing, which keeps a custom block
   * visually consistent with the built-in ones.
   *
   * Without an icon a registered block still works, but has no sidebar
   * entry — it can only be added programmatically.
   */
  icon?: string | Component;
  /** Drives future tooling (docs, a generic settings fallback for
   * third-party blocks). Built-ins point renderSettings at their existing
   * bespoke panel instead of relying on this to generate one. */
  schema: Record<string, unknown>;

  /** Vue component, receives a single `component` prop — the block's own
   * node from the tree ({ id, componentType, props, ... }). Matches the
   * existing renderer pattern (ImageRenderer, AnchorRenderer, etc). */
  renderCanvas: Component;

  /** Vue component, no props — reads the selected component itself via
   * useEmailBuilder(), same as every existing panel (ButtonPanel, etc). */
  renderSettings: Component;

  renderEmail: {
    html: (props: any, ctx: BlockRenderContext) => string;
    mjml: (props: any, ctx: BlockRenderContext) => string;
    reactEmail: (props: any, ctx: BlockRenderContext) => string;
  };
}
