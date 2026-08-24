import {
  safeUrl,
  escapeHtml,
  escapeAttr,
  normalizeRichTextContent,
} from "../helpers/generatorHelpers";
import { getBlock } from "@/blocks/registry";

// generators/html.ts
// Generates export HTML for each component type.
// Components that have a backgroundColor also support backgroundGradient.

export const htmlGenerator = () => {
  // ─── Shared gradient resolver ──────────────────────────────────────────────
  //
  // Returns a CSS `background` value string from a BackgroundValue object.
  // Falls back to the raw `backgroundColor` prop when no gradient object exists
  // (backwards-compat with templates saved before the gradient feature).
  //
  // For Outlook, every gradient block is also wrapped in a VML conditional
  // comment.  Pass `vml: true` to get back { css, vmlOpen, vmlClose } instead
  // of a plain string — useful for block-level elements (button, divider).
  // Inline elements (paragraph, heading, list) receive a plain CSS string
  // because VML wrapping makes no sense for inline-style backgrounds.

  // resolveBgCss — emits both declarations when gradient is active:
  //   background-color:<solid>;   Outlook ignores `background` shorthand, reads this
  //   background:<gradient>;      Gmail/modern clients read this, overrides above
  // Solid colour is always BackgroundValue.solid — the designer's chosen fallback.
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

  // resolveBgVml — VML open/close for block elements (button, divider).
  // Uses BackgroundValue.solid as Outlook's fill colour.
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

  // ─── Main generator ────────────────────────────────────────────────────────

  const generateHTMLComponent = (comp: any): string => {
    // ── CRITICAL: resolve render variant — new shape uses componentType,
    // legacy shape uses type directly. Both must produce the same output.
    const type = comp.componentType ?? comp.type;
    const { props } = comp;
    let html = "";

    const uid = `eb-${comp.id}`;

    const marginStyle = props.margin
      ? `margin:${props.margin?.top ?? 0}px ${props.margin?.right ?? 0}px ${props.margin?.bottom ?? 0}px ${props.margin?.left ?? 0}px;`
      : "";
    const paddingStyle = props.padding
      ? `padding:${props.padding?.top ?? 0}px ${props.padding?.right ?? 0}px ${props.padding?.bottom ?? 0}px ${props.padding?.left ?? 0}px;`
      : "";

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

    // ── Registry check — registered blocks take priority over the switch
    // below. Anything not registered falls through unchanged. ──────────────
    const registeredBlock = getBlock(type);
    if (registeredBlock) {
      return registeredBlock.renderEmail.html(props, {
        uid,
        marginStyle,
        paddingStyle,
        escapeHtml,
        escapeAttr,
        safeUrl,
        resolveBgCss,
        resolveBgVml,
        getResponsiveClasses,
        react: null as any, // html target — react-only helpers unused here
      });
    }

    switch (type) {
      // All 11 built-in types now route through the registry check above.
      // This switch is the fallback for a genuinely unregistered type —
      // currently empty, so an unknown type renders as an empty string
      // rather than throwing.
    }

    return html;
  };

  return { generateHTMLComponent };
};
