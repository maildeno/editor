import AnchorRenderer from "@/components/features/emailBuilder/ui/renderers/AnchorRenderer.vue";
import AnchorPanel from "@/components/features/emailBuilder/panels/AnchorPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

/**
 * Extracted verbatim from the "anchor" case in each of the three generators.
 * Simpler than button — no icon, no background, no VML.
 */

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const anchorAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const anchorContainerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const anchorLinkClasses = getResponsiveClasses(false, false, "link");
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  return `              <div style="${marginStyle} ${paddingStyle} ${anchorAlign}" class="${anchorContainerClasses}">
                <a href="${safeUrl(props.link)}" style="color:${props.color}; font-size:${props.fontSize}px; font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; line-height: normal; ${letterSpacingStyle} text-decoration:${props.textDecoration};" target="_blank" rel="noopener noreferrer nofollow" class="${anchorLinkClasses}">${props.text}</a>
              </div>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const anchorAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const anchorContainerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const anchorLinkClasses = getResponsiveClasses(false, false, "link");
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none">              <div style="${marginStyle} ${paddingStyle} ${anchorAlign}" class="${anchorContainerClasses}">
                <a href="${safeUrl(props.link)}" style="color:${props.color}; font-size:${props.fontSize}px; ${letterSpacingStyle} font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; line-height: normal; text-decoration:${props.textDecoration};" target="_blank" rel="noopener noreferrer nofollow" class="${anchorLinkClasses}">${props.text}</a>
              </div>
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { safeUrl, getResponsiveClasses, react } = ctx;
  const { parseMarginPaddingDiscrete, styleObj, normalizeFontFamily } = react;

  const anchorAlign =
    props.align === "center"
      ? "center"
      : props.align === "right"
        ? "right"
        : "left";

  const anchorContainerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const anchorLinkClasses = getResponsiveClasses(false, false, "link");

  const anchorLinkStyle: Record<string, any> = {
    color: props.color,
    fontSize: `${props.fontSize}px`,
    fontWeight: String(props.fontWeight),
    fontFamily: normalizeFontFamily(`'${props.fontFamily}', Arial, sans-serif`),
    lineHeight: "normal",
    ...((props.letterSpacing as number) > 0 && {
      letterSpacing: `${props.letterSpacing}px`,
    }),
    textDecoration: props.textDecoration,
  };

  return `<div
  className="${anchorContainerClasses}"
  style={{ ${styleObj({ ...parseMarginPaddingDiscrete(props.margin, props.padding), textAlign: anchorAlign })} }}
>
  <Link
    href="${safeUrl(props.link)}"
    target="_blank"
    className="${anchorLinkClasses}"
    style={{ ${styleObj(anchorLinkStyle)} }}
  >
    ${props.text}
  </Link>
</div>\n`;
}

export const anchorBlock: BlockDefinition = {
  name: "Anchor",
  schema: {
    text: { type: "string", default: "Link text" },
    link: { type: "string", default: "https://" },
  },
  renderCanvas: AnchorRenderer,
  renderSettings: AnchorPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
