import SocialsRenderer from "@/components/features/emailBuilder/ui/renderers/SocialsRenderer.vue";
import SocialsPanel from "@/components/features/emailBuilder/panels/SocialsPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { uid, marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const socialClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const halfSpacing = Math.ceil((props.spacing ?? 0) / 2);
  const iconSize = props.iconSize ?? 32;
  const socialAlign = props.align ?? "center";

  const innerStyle =
    socialAlign === "center"
      ? "margin:0 auto;"
      : socialAlign === "right"
        ? "margin-left:auto; margin-right:0;"
        : "margin-left:0; margin-right:auto;";

  const socialPlatforms = (props.platforms ?? []).filter((p: any) => p.enabled && p.link);
  const lastIdx = socialPlatforms.length - 1;

  const socialCells = socialPlatforms
    .map((platform: any, i: number) => {
      const ml = i === 0 ? 0 : halfSpacing;
      const mr = i === lastIdx ? 0 : halfSpacing;
      return `
<td class="${uid}-socials-item">
<a href="${safeUrl(platform.link)}" target="_blank" rel="noopener noreferrer nofollow"
 style="display:block; text-decoration:none; margin-left:${ml}px; margin-right:${mr}px;">
<img src="${platform.icon}" alt="${platform.name}" width="${iconSize}" height="${iconSize}" border="0"
     style="display:block; border:0; width:${iconSize}px; height:${iconSize}px;">
</a>
</td>`;
    })
    .join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="${socialClasses}" style="${marginStyle}">
<tr>
  <td class="${uid}-socials-td" style="${paddingStyle} text-align:${socialAlign};">

    <!--[if mso]>
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
      <tr><td>
    <![endif]-->

    <table cellpadding="0" cellspacing="0" role="presentation"
      class="${uid}-socials-inner"
      style="${innerStyle} display:inline-table;">
      <tr>
        ${socialCells}
      </tr>
    </table>

    <!--[if mso]>
      </td></tr>
    </table>
    <![endif]-->

  </td>
</tr>
</table>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { uid, marginStyle, paddingStyle, safeUrl, getResponsiveClasses } = ctx;

  const socialClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const halfSpacing = Math.ceil((props.spacing ?? 0) / 2);
  const iconSize = props.iconSize ?? 32;
  const socialAlign = props.align ?? "center";

  const innerStyle =
    socialAlign === "center"
      ? "margin:0 auto;"
      : socialAlign === "right"
        ? "margin-left:auto; margin-right:0;"
        : "margin-left:0; margin-right:auto;";

  const socialPlatforms = (props.platforms ?? []).filter((p: any) => p.enabled && p.link);
  const lastIdx = socialPlatforms.length - 1;

  const socialCells = socialPlatforms
    .map((platform: any, i: number) => {
      const ml = i === 0 ? 0 : halfSpacing;
      const mr = i === lastIdx ? 0 : halfSpacing;
      return `
<td class="${uid}-socials-item">
<a href="${safeUrl(platform.link)}" target="_blank" rel="noopener noreferrer nofollow"
 style="display:block; text-decoration:none; margin-left:${ml}px; margin-right:${mr}px;">
<img src="${platform.icon}" alt="${platform.name}" width="${iconSize}" height="${iconSize}" border="0"
     style="display:block; border:0; width:${iconSize}px; height:${iconSize}px;">
</a>
</td>`;
    })
    .join("");

  return `<mj-text  padding="0" 
    font-size="0" 
    line-height="0" 
    font-family="none">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="${socialClasses}" style="${marginStyle}">
<tr>
  <td class="${uid}-socials-td" style="${paddingStyle} text-align:${socialAlign};">
    <table cellpadding="0" cellspacing="0" role="presentation"
      class="${uid}-socials-inner"
      style="${innerStyle} display:inline-table;">
      <tr>
        ${socialCells}
      </tr>
    </table>
  </td>
</tr>
</table>
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { uid, safeUrl, getResponsiveClasses, react } = ctx;
  const { parseMarginPaddingDiscrete, styleObj } = react;

  const socialClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const halfSpacing = Math.ceil((props.spacing ?? 0) / 2);
  const iconSize = props.iconSize ?? 32;
  const socialAlign = props.align ?? "center";

  const innerStyle =
    socialAlign === "center"
      ? { margin: "0 auto" }
      : socialAlign === "right"
        ? { marginLeft: "auto", marginRight: "0" }
        : { marginLeft: "0", marginRight: "auto" };

  const socialPlatforms = (props.platforms ?? []).filter((p: any) => p.enabled && p.link);
  const lastIdx = socialPlatforms.length - 1;

  const socialCells = socialPlatforms
    .map((platform: any, i: number) => {
      const ml = i === 0 ? 0 : halfSpacing;
      const mr = i === lastIdx ? 0 : halfSpacing;
      return `    <td className="${uid}-socials-item">
    <Link
      href="${safeUrl(platform.link)}"
      target="_blank"
      rel="noopener noreferrer nofollow"
      style={{ display:"block", textDecoration:"none", marginLeft:${ml}, marginRight:${mr} }}
    >
      <Img
        src="${platform.icon}"
        alt="${platform.name}"
        width={${iconSize}}
        height={${iconSize}}
        style={{ display:"block", border:"0", width:${iconSize}, height:${iconSize} }}
      />
    </Link>
  </td>`;
    })
    .join("\n");

  return `<div
className="${socialClasses}"
style={{ ${styleObj({ ...parseMarginPaddingDiscrete(props.margin, props.padding) })} }}
>
<table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
  <tr>
    <td
      className="${uid}-socials-td"
      style={{ textAlign:"${socialAlign}" }}
    >
      <table
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        className="${uid}-socials-inner"
        style={{ ${styleObj(innerStyle)}, display:"inline-table" }}
      >
        <tr>
${socialCells}
        </tr>
      </table>
    </td>
  </tr>
</table>
</div>\n`;
}

export const socialsBlock: BlockDefinition = {
  name: "Socials",
  schema: {
    platforms: { type: "array", default: [] },
  },
  renderCanvas: SocialsRenderer,
  renderSettings: SocialsPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
