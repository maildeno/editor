import VideoRenderer from "@/components/features/emailBuilder/ui/renderers/VideoRenderer.vue";
import VideoPanel from "@/components/features/emailBuilder/panels/VideoPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { uid, marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const videoAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const videoClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const videoSrc = props.src || "";
  const linkHref = props.fallbackLink || props.src || "#";
  const coverSrc = props.coverImage || "";
  const altText = props.alt || "Watch Video";
  const videoStyle = `width:${props.width}%; height:${props.height}; border-radius:${props.borderRadius}px; border:${props.border.width}px ${props.border.style} ${props.border.color}; display:inline-block;`;

  return `              <div style="${marginStyle} ${paddingStyle} ${videoAlign}" class="${videoClasses}">
                <a href="${safeUrl(linkHref)}" target="_blank" style="display:inline-block; text-decoration:none;">
                  <video
                    ${videoSrc ? `src="${videoSrc}"` : ""}
                    ${coverSrc ? `poster="${coverSrc}"` : ""}
                    width="${props.width}%"
                    controls
                    preload="none"
                    style="${videoStyle}"
                    class="${uid}"
                  >
                    ${
                      coverSrc
                        ? `<img src="${coverSrc}" alt="${altText}" style="${videoStyle}"/>`
                        : `<span style="display:inline-block;padding:12px 24px;background:#222222;color:#ffffff;font-family:sans-serif;font-size:15px;border-radius:${props.borderRadius}px;">&#9654; ${altText}</span>`
                    }
                  </video>
                </a>
              </div>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { uid, marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const videoAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const videoClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const videoSrc = props.src || "";
  const linkHref = props.fallbackLink || props.src || "#";
  const coverSrc = props.coverImage || "";
  const altText = props.alt || "Watch Video";
  const videoStyle = `width:${props.width}%; height:${props.height}; border-radius:${props.borderRadius}px; border:${props.border.width}px ${props.border.style} ${props.border.color}; display:inline-block;`;

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none">              <div style="${marginStyle} ${paddingStyle} ${videoAlign}" class="${videoClasses}">
                <a href="${safeUrl(linkHref)}" target="_blank" style="display:inline-block; text-decoration:none;">
                  <video
                    ${videoSrc ? `src="${videoSrc}"` : ""}
                    ${coverSrc ? `poster="${coverSrc}"` : ""}
                    width="${props.width}%"
                    controls
                    preload="none"
                    style="${videoStyle}"
                    class="${uid}"
                  >
                    ${
                      coverSrc
                        ? `<img src="${coverSrc}" alt="${altText}" style="${videoStyle}"/>`
                        : `<span style="display:inline-block;padding:12px 24px;background:#222222;color:#ffffff;font-family:sans-serif;font-size:15px;border-radius:${props.borderRadius}px;">&#9654; ${altText}</span>`
                    }
                  </video>
                </a>
              </div>
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { safeUrl, getResponsiveClasses, react } = ctx;
  const { parseMarginPaddingDiscrete, styleObj } = react;

  const videoAlign =
    props.align === "center"
      ? "center"
      : props.align === "right"
        ? "right"
        : "left";

  const videoClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const linkHref = props.fallbackLink || props.src || "#";
  const coverSrc = props.coverImage || "";
  const altText = props.alt || "Watch Video";

  // React Email does not support <video> — render fallback image / CTA
  const fallbackContent = coverSrc
    ? `<Img src="${coverSrc}" alt="${altText}" style={{ width:"${props.width}%", height:"${props.height}", borderRadius:"${props.borderRadius}px", border:"${props.border.width}px ${props.border.style} ${props.border.color}", display:"inline-block" }} />`
    : `<span style={{ display:"inline-block", padding:"12px 24px", backgroundColor:"#222222", color:"#ffffff", fontFamily:"sans-serif", fontSize:"15px", borderRadius:"${props.borderRadius}px" }}>&#9654; ${altText}</span>`;

  return `<div
  className="${videoClasses}"
  style={{ ${styleObj({ ...parseMarginPaddingDiscrete(props.margin, props.padding), textAlign: videoAlign })} }}
>
  <Link href="${safeUrl(linkHref)}" target="_blank" style={{ display:"inline-block", textDecoration:"none" }}>
    ${fallbackContent}
  </Link>
</div>\n`;
}

export const videoBlock: BlockDefinition = {
  name: "Video",
  schema: {
    src: { type: "string", default: "" },
    coverImage: { type: "string", default: "" },
  },
  renderCanvas: VideoRenderer,
  renderSettings: VideoPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
