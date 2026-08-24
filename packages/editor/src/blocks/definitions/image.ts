import ImageRenderer from "@/components/features/emailBuilder/ui/renderers/ImageRenderer.vue";
import ImagePanel from "@/components/features/emailBuilder/panels/ImagePanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const imgAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const imageClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  const imgTag = `<img src="${props.src}" alt="${props.alt}" style="width:${props.width}%; height:${props.height}; border-radius:${props.borderRadius}px; border:${props.border.width}px ${props.border.style} ${props.border.color}; display:inline-block;"/>`;

  const wrappedImage =
    props.enabled && props.link
      ? `<a href="${safeUrl(props.link || "https://example.com")}" target="_blank" rel="noopener noreferrer nofollow" style="text-decoration:none;">${imgTag}</a>`
      : imgTag;

  return `<div style="${marginStyle} ${paddingStyle} ${imgAlign}" class="${imageClasses}">
                 ${wrappedImage}
              </div>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const imgAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const imageClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  const imgTag = `<img src="${props.src}" alt="${props.alt}" style="width:${props.width}%; height:${props.height}; border-radius:${props.borderRadius}px; border:${props.border.width}px ${props.border.style} ${props.border.color}; display:inline-block;"/>`;

  const wrappedImage =
    props.enabled && props.link
      ? `<a href="${safeUrl(props.link || "https://example.com")}" target="_blank" rel="noopener noreferrer nofollow" style="text-decoration:none;">${imgTag}</a>`
      : imgTag;

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none"><div style="${marginStyle} ${paddingStyle} ${imgAlign}" class="${imageClasses}">
                 ${wrappedImage}
              </div></mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { safeUrl, getResponsiveClasses, react } = ctx;
  const { parseMarginPaddingDiscrete, styleObj } = react;

  const imgAlign =
    props.align === "center" ? "center" : props.align === "right" ? "right" : "left";

  const imageClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  const imgJsx = `<Img
    src="${props.src}"
    alt="${props.alt}"
    style={{ width:"${props.width}%", height:"${props.height}", borderRadius:"${props.borderRadius}px", border:"${props.border.width}px ${props.border.style} ${props.border.color}", display:"inline-block" }}
  />`;

  const wrappedImage =
    props.enabled && props.link
      ? `<Link href="${safeUrl(props.link || "https://example.com")}" target="_blank" style={{ textDecoration:"none" }}>\n    ${imgJsx}\n  </Link>`
      : imgJsx;

  return `<div
  className="${imageClasses}"
  style={{ ${styleObj({ ...parseMarginPaddingDiscrete(props.margin, props.padding), textAlign: imgAlign })} }}
>
  ${wrappedImage}
</div>\n`;
}

export const imageBlock: BlockDefinition = {
  name: "Image",
  schema: {
    src: { type: "string", default: "" },
    alt: { type: "string", default: "" },
  },
  renderCanvas: ImageRenderer,
  renderSettings: ImagePanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
