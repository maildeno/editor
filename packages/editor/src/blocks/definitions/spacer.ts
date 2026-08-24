import SpacerRenderer from "@/components/features/emailBuilder/ui/renderers/SpacerRenderer.vue";
import SpacerPanel from "@/components/features/emailBuilder/panels/SpacerPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { uid, resolveBgCss, getResponsiveClasses } = ctx;
  const backgroundCss = resolveBgCss(props.backgroundGradient, props.backgroundColor);
  const spacerClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  return `<div class="${spacerClasses}"><div class="${uid}-spacer-td" height="${props.height}" style="height:${props.height}px;line-height:${props.height}px;font-size:1px;mso-line-height-rule:exactly;${backgroundCss}">&nbsp;</div></div>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { uid, resolveBgCss, getResponsiveClasses } = ctx;
  const backgroundCss = resolveBgCss(props.backgroundGradient, props.backgroundColor);
  const spacerClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none"><div class="${spacerClasses}"><div class="${uid}-spacer-td" height="${props.height}" style="height:${props.height}px;line-height:${props.height}px;font-size:1px;mso-line-height-rule:exactly;${backgroundCss}">&nbsp;</div></div>
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { uid, resolveBgCss, getResponsiveClasses, react } = ctx;
  const { parseCssString, styleObj } = react;
  const backgroundCss = resolveBgCss(props.backgroundGradient, props.backgroundColor);
  const spacerClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  return `<div
  className="${spacerClasses}"
>
  <div
    className="${uid}-spacer-td"
    style={{ ${styleObj({ height: `${props.height}px`, lineHeight: `${props.height}px`, fontSize: "1px", ...(backgroundCss ? parseCssString(backgroundCss) : {}) })} }}
  >&nbsp;</div>
</div>\n`;
}

export const spacerBlock: BlockDefinition = {
  name: "Spacer",
  schema: {
    height: { type: "number", default: 20 },
  },
  renderCanvas: SpacerRenderer,
  renderSettings: SpacerPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
