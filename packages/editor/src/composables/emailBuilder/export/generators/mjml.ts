import {
  safeUrl,
  escapeHtml,
  escapeAttr,
  normalizeRichTextContent,
} from "../helpers/generatorHelpers";
import { getBlock } from "@/blocks/registry";

// generators/mjmlGenerator.ts
// Generates MJML markup for each component type.
//
// ── Core rule ─────────────────────────────────────────────────────────────────
// MJML components (<mj-text>, <mj-image>, etc.) are treated as direct
// substitutes for the table/td wrapper that the HTML generator builds around
// each element.  They carry NO visual styles, NO typography, NO padding, NO
// alignment attributes.
//
// Every style, class, margin, padding, font, colour, etc. lives on the actual
// HTML element (<p>, <h1>–<h6>, <div>, <a>, <img>, …) as inline `style` and
// `class` attributes — exactly mirroring HTMLGenerator.
//
// This ensures:
//   • Mobile CSS overrides (useEmailBuilderMobileCSS) target the same selectors
//     they already use in the HTML export.
//   • Consuming code can override any style by class or inline specificity
//     without fighting MJML's compiled attribute-to-inline-style pass.
//
// ── Media-query ordering ──────────────────────────────────────────────────────
// MJML compiles its own @media block into <head>.  Per-component mobile CSS
// overrides must come AFTER that block to win the cascade.  assembleMJML()
// places them in a second <mj-style inline="false"> tag; MJML preserves
// <mj-style> source order in the compiled output.

export const mjmlGenerator = () => {
  // ─── Helpers — identical to HTMLGenerator ────────────────────────────────

  /**
   * resolveBgCss
   * Returns the CSS background declaration(s) string for inline element styles.
   * Solid-only  → `background-color:<solid>;`
   * Gradient    → `background-color:<solid>; background:<gradient>;`
   *               (dual-declaration so Outlook reads background-color and
   *                modern clients read the gradient override)
   */
  const resolveBgCss = (bgGradient: any, bgColorFallback: string): string => {
    const hasGradient =
      bgGradient?.useGradient === true &&
      Array.isArray(bgGradient?.gradient?.colors) &&
      bgGradient.gradient.colors.length >= 2;

    if (!hasGradient) {
      const solid =
        bgGradient && typeof bgGradient === "object" && bgGradient.solid
          ? bgGradient.solid
          : bgColorFallback;
      if (!solid || solid === "transparent") return "";
      return `background-color:${solid};`;
    }

    const { type, direction, colors } = bgGradient.gradient;
    const stops = colors
      .map((c: any) => `${c.color} ${c.position}%`)
      .join(", ");
    const gradientCss =
      type === "radial"
        ? `radial-gradient(circle at center, ${stops})`
        : `linear-gradient(${direction}, ${stops})`;

    const solid = bgGradient.solid || bgColorFallback || "";
    const solidDecl =
      solid && solid !== "transparent" ? `background-color:${solid};` : "";
    return `${solidDecl}background:${gradientCss};`;
  };

  // Not used by any built-in MJML case (MJML doesn't need raw VML the way
  // the HTML target does) but included for BlockRenderContext parity — a
  // registered block's mjml renderer might legitimately want it.
  const resolveBgVml = (
    bgGradient: any,
    bgColorFallback: string,
  ): { vmlOpen: string; vmlClose: string } => {
    const hasGradient =
      bgGradient?.useGradient === true &&
      Array.isArray(bgGradient?.gradient?.colors) &&
      bgGradient.gradient.colors.length >= 2;
    if (!hasGradient) return { vmlOpen: "", vmlClose: "" };
    const solid = bgGradient.solid || bgColorFallback || "#ffffff";
    const vmlOpen = `
<!--[if mso]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="t" stroke="f"
  style="mso-width-percent:1000;">
  <v:fill type="solid" color="${solid}" />
  <v:textbox style="mso-fit-shape-to-text:true;">
<![endif]-->`;
    const vmlClose = `
<!--[if mso]>
  </v:textbox>
</v:rect>
<![endif]-->`;
    return { vmlOpen, vmlClose };
  };

  /**
   * resolveSolidColor
   * Returns only the solid fallback colour string (no CSS property prefix).
   * Used for MJML structural attributes that only accept a colour value
   * (e.g. background-color on mj-section / mj-column).
   */
  const resolveSolidColor = (
    bgGradient: any,
    bgColorFallback: string,
  ): string => {
    if (bgGradient && typeof bgGradient === "object") {
      if (bgGradient.solid && bgGradient.solid !== "transparent")
        return bgGradient.solid;
    }
    if (bgColorFallback && bgColorFallback !== "transparent")
      return bgColorFallback;
    return "";
  };

  /**
   * padAttr
   * Converts a padding object → "top right bottom left" string.
   * Used by the row builder when it needs to pass structural padding to
   * mj-section / mj-column attributes (not to inner elements).
   */
  const padAttr = (padding?: any): string => {
    if (!padding) return "0px";
    return `${padding.top ?? 0}px ${padding.right ?? 0}px ${padding.bottom ?? 0}px ${padding.left ?? 0}px`;
  };

  // ─── Main generator ───────────────────────────────────────────────────────

  const generateMJMLComponent = (comp: any): string => {
    // ── CRITICAL: resolve render variant — new shape uses componentType,
    // legacy shape uses type directly. Both must produce the same output.
    const type = comp.componentType ?? comp.type;
    const { props } = comp;
    const uid = `eb-${comp.id}`;

    // ── Replicate HTMLGenerator's per-component margin/padding strings ───────
    // These go directly on the actual HTML element, not on <mj-text>.
    const marginStyle = props.margin
      ? `margin:${props.margin?.top ?? 0}px ${props.margin?.right ?? 0}px ${props.margin?.bottom ?? 0}px ${props.margin?.left ?? 0}px;`
      : "";
    const paddingStyle = props.padding
      ? `padding:${props.padding?.top ?? 0}px ${props.padding?.right ?? 0}px ${props.padding?.bottom ?? 0}px ${props.padding?.left ?? 0}px;`
      : "";

    // ── Replicate HTMLGenerator's getResponsiveClasses ───────────────────────
    const getResponsiveClasses = (
      desktopHide?: boolean,
      mobileHide?: boolean,
      suffix?: string,
    ): string => {
      const baseClass = suffix ? `${uid}-${suffix}` : uid;
      const classes = [baseClass];
      if (desktopHide) classes.push("desktop-hide");
      if (mobileHide) classes.push("mobile-hide");
      return classes.join(" ");
    };

    // ── Registry check ───────────────────────────────────────────────────────
    const registeredBlock = getBlock(type);
    if (registeredBlock) {
      return registeredBlock.renderEmail.mjml(props, {
        uid,
        marginStyle,
        paddingStyle,
        escapeHtml,
        escapeAttr,
        safeUrl,
        resolveBgCss,
        resolveBgVml,
        getResponsiveClasses,
        react: null as any,
      });
    }

    switch (type) {
      // ── Image ─────────────────────────────────────────────────────────────────
      // All 11 built-in types now route through the registry check above.
      // This switch is the fallback for a genuinely unregistered type.

      default:
        return "";
    }
  };

  // ─── Full MJML document assembler ─────────────────────────────────────────

  /**
   * assembleMJML
   *
   * Builds the complete MJML document string.
   *
   * Style blocks are ordered deliberately so the cascade works correctly:
   *
   *   1. baseStyleTag        — desktop-hide and list resets (non-responsive).
   *   2. backgroundStyleTag  — col-bg-* / row-bg-* class rules that override
   *                            MJML's compiled background-color:transparent on
   *                            <td>. Must be NON-responsive (no @media wrapper)
   *                            so they apply on desktop as well as mobile.
   *   3. overrideStyleTag    — per-component mobile CSS inside @media.
   *                            Second <mj-style> so it follows MJML's own
   *                            compiled @media block in the output.
   * @param templateName        Template name
   * @param rowsMjml            Pre-rendered <mj-section> fragments
   * @param canvasStyles        Canvas config (width, background, padding, …)
   * @param googleFontUrl       Optional Google Fonts stylesheet URL
   * @param mobileOverridesCss  Mobile CSS override block (after MJML @media)
   * @param mobileBreakpoint    Breakpoint px value (default 600)
   * @param backgroundStylesCss Non-responsive background class rules (col-bg-*, row-bg-*)
   */
  const assembleMJML = (
    templateName: string,
    rowsMjml: string,
    canvasStyles: any,
    googleFontUrl: string,
    mobileOverridesCss: string,
    mobileBreakpoint: number = 600,
    backgroundStylesCss: string = "",
  ): string => {
    // Load fonts via CSS @import
    const fontStyleTag = googleFontUrl
      ? `<mj-style inline="false">
      @import url('${googleFontUrl}');
    </mj-style>`
      : "";

    // Base non-responsive styles — mirrors exportHTML's desktop-hide rule.
    const baseStyleTag = `<mj-style inline="false">
.desktop-hide { display: none !important; }
ul li:last-child, ol li:last-child { margin-bottom: 0 !important; }
    </mj-style>`;

    // Background class rules — must live OUTSIDE @media so they apply on
    // desktop. MJML compiles background-color as an inline <td> style which
    // defaults to "transparent"; these rules override that at the class level.
    const backgroundStyleTag = backgroundStylesCss.trim()
      ? `<mj-style inline="false">
${backgroundStylesCss}
    </mj-style>`
      : "";

    // Override block — second <mj-style> so it follows MJML's own @media.
    const overrideStyleTag = mobileOverridesCss.trim()
      ? `<mj-style inline="false">
@media only screen and (max-width:${mobileBreakpoint}px) {
${mobileOverridesCss}
}
    </mj-style>`
      : "";

    const bodyBg = canvasStyles.bodyBackgroundColor || "#ffffff";
    // Build body background image attributes
    const bodyBgImageAttrs = canvasStyles.bodyBackgroundImage
      ? [
          `background-url="${canvasStyles.bodyBackgroundImage}"`,
          `background-size="${canvasStyles.bodyBackgroundSize || "cover"}"`,
          `background-position="${canvasStyles.bodyBackgroundPosition || "center center"}"`,
          `background-repeat="${canvasStyles.bodyBackgroundRepeat || "no-repeat"}"`,
        ].join(" ")
      : "";

    const containerBg = canvasStyles.backgroundColor || "#ffffff";
    const canvasPad = padAttr(canvasStyles.padding);

    return `<mjml lang="${canvasStyles.language}">
  <mj-head>
     ${fontStyleTag}
    <mj-title>${templateName}</mj-title>
    <mj-preview>${canvasStyles.preheaderText} &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp;</mj-preview>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
    <mj-raw>
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
    </mj-raw>
    ${baseStyleTag}
    ${backgroundStyleTag}
    ${overrideStyleTag}
  </mj-head>
  <mj-body background-color="${bodyBg}" width="${canvasStyles.width ?? 600}px">
  <mj-wrapper full-width="full-width" ${bodyBgImageAttrs} padding="0">
    <mj-section background-color="${containerBg}" padding="${canvasPad}">
${rowsMjml}
    </mj-section>
    </mj-wrapper>
  </mj-body>
</mjml>`;
  };

  return {
    generateMJMLComponent,
    assembleMJML,
    // Exposed for the row builder in useEmailBuilderExport
    resolveSolidColor,
    padAttr,
  };
};
