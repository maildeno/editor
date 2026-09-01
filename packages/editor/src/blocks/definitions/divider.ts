import DividerRenderer from "@/components/features/emailBuilder/ui/renderers/DividerRenderer.vue";
import DividerPanel from "@/components/features/emailBuilder/panels/DividerPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { uid, marginStyle, resolveBgCss, getResponsiveClasses } = ctx;
  const align = props.align ?? "center";

  const tdBgStyle = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const isSolid = !tdBgStyle.includes("gradient(");
  const bgColorAttr =
    isSolid && props.backgroundColor && props.backgroundColor !== "transparent"
      ? `bgcolor="${props.backgroundColor}"`
      : "";

  const dividerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );

  const tableStyle =
    align === "center"
      ? "margin:0 auto;"
      : align === "right"
        ? "margin-left:auto; margin-right:0;"
        : "margin-left:0; margin-right:auto;";

  return `
<div style="${marginStyle}" class="${dividerClasses}">
  <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td>

        <!--[if mso]>
        <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
          <tr><td>
        <![endif]-->

        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          class="${uid}-divider-table"
          style="width:${props.width}%; ${tableStyle}"
        >
          <tr>
            <td
              ${bgColorAttr}
              class="${uid}-divider-td"
              style="height:${props.height}px; line-height:${props.height}px; font-size:0; ${tdBgStyle}"
            >&nbsp;</td>
          </tr>
        </table>

        <!--[if mso]>
          </td></tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>
</div>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { uid, marginStyle, resolveBgCss, getResponsiveClasses } = ctx;
  const align = props.align ?? "center";

  const tdBgStyle = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const isSolid = !tdBgStyle.includes("gradient(");
  const bgColorAttr =
    isSolid && props.backgroundColor && props.backgroundColor !== "transparent"
      ? `bgcolor="${props.backgroundColor}"`
      : "";

  const dividerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );

  const tableStyle =
    align === "center"
      ? "margin:0 auto;"
      : align === "right"
        ? "margin-left:auto; margin-right:0;"
        : "margin-left:0; margin-right:auto;";

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none">
<div style="${marginStyle}" class="${dividerClasses}">
  <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          class="${uid}-divider-table"
          style="width:${props.width}%; ${tableStyle}"
        >
          <tr>
            <td
              ${bgColorAttr}
              class="${uid}-divider-td"
              style="height:${props.height}px; line-height:${props.height}px; font-size:0; ${tdBgStyle}"
            >&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { uid, react } = ctx;
  const { parseMarginPaddingDiscrete, parseCssString, styleObj } = react;
  const align = props.align ?? "center";

  const tdBgStyle = ctx.resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const dividerClasses = ctx.getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );

  const tableMargin =
    align === "center"
      ? "0 auto"
      : align === "right"
        ? "0 0 0 auto"
        : "0 auto 0 0";

  return `<div className="${dividerClasses}" style={{ ${styleObj(parseMarginPaddingDiscrete(props.margin, undefined))} }}>
  <Hr
    className="${uid}-divider-td"
    style={{ ${styleObj({ width: `${props.width}%`, height: `${props.height}px`, margin: tableMargin, border: "none", borderTop: "none", ...(tdBgStyle ? parseCssString(tdBgStyle) : {}) })} }}
  />
</div>\n`;
}

export const dividerBlock: BlockDefinition = {
  name: "Divider",
  schema: {
    width: { type: "number", default: 100 },
    height: { type: "number", default: 1 },
  },
  renderCanvas: DividerRenderer,
  renderSettings: DividerPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
