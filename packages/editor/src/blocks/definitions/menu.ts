import MenuRenderer from "@/components/features/emailBuilder/ui/renderers/MenuRenderer.vue";
import MenuPanel from "@/components/features/emailBuilder/panels/MenuPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const {
    uid,
    marginStyle,
    paddingStyle,
    safeUrl,
    resolveBgCss,
    getResponsiveClasses,
  } = ctx;

  const menuClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const halfSpacing = Math.ceil((props.spacing ?? 0) / 2);
  const menuAlign = props.align ?? "center";
  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const isSolid = !backgroundCss.includes("gradient(");
  const bgColorAttr =
    isSolid && props.backgroundColor && props.backgroundColor !== "transparent"
      ? `bgcolor="${props.backgroundColor}"`
      : "";
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  const enabledItems = (props.items ?? []).filter(
    (item: any) => item.enabled && item.label,
  );
  const responsiveClass = props.mobileStack ? "mobile-stack" : "";
  const lastIdx = enabledItems.length - 1;

  const itemSpans = enabledItems
    .map((item: any, i: number) => {
      const ml = i === 0 ? 0 : halfSpacing;
      const mr = i === lastIdx ? 0 : halfSpacing;
      return `<span class="${uid}-menu-item${responsiveClass ? ` ${responsiveClass}` : ""}"><a href="${safeUrl(item.link || "https://example.com")}" target="_blank" rel="noopener noreferrer nofollow"
   style="display: inline-block; text-decoration:${props.textDecoration}; color:${props.color}; font-size:${props.fontSize}px; line-height:${props.lineHeight}; ${letterSpacingStyle} font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; font-style:${props.fontStyle}; text-transform:${props.textTransform}; margin-left:${ml}px; margin-right:${mr}px;white-space:nowrap;"
>${item.label}</a></span>`;
    })
    .join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="${menuClasses}" style="${marginStyle}">
  <tr>
    <td ${bgColorAttr} class="${uid}-menu-td" style="${paddingStyle} ${backgroundCss} text-align:${menuAlign};">
      ${itemSpans}
    </td>
  </tr>
</table>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const {
    uid,
    marginStyle,
    paddingStyle,
    safeUrl,
    resolveBgCss,
    getResponsiveClasses,
  } = ctx;

  const menuClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const halfSpacing = Math.ceil((props.spacing ?? 0) / 2);
  const menuAlign = props.align ?? "center";
  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const isSolid = !backgroundCss.includes("gradient(");
  const bgColorAttr =
    isSolid && props.backgroundColor && props.backgroundColor !== "transparent"
      ? `bgcolor="${props.backgroundColor}"`
      : "";
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  const enabledItems = (props.items ?? []).filter(
    (item: any) => item.enabled && item.label,
  );
  const responsiveClass = props.mobileStack ? "mobile-stack" : "";
  const lastIdx = enabledItems.length - 1;

  const itemSpans = enabledItems
    .map((item: any, i: number) => {
      const ml = i === 0 ? 0 : halfSpacing;
      const mr = i === lastIdx ? 0 : halfSpacing;
      return `<span class="${uid}-menu-item${responsiveClass ? ` ${responsiveClass}` : ""}"><a href="${safeUrl(item.link || "https://example.com")}" target="_blank" rel="noopener noreferrer nofollow"
   style="display: inline-block; text-decoration:${props.textDecoration}; color:${props.color}; font-size:${props.fontSize}px; line-height:${props.lineHeight}; ${letterSpacingStyle} font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; font-style:${props.fontStyle}; text-transform:${props.textTransform}; margin-left:${ml}px; margin-right:${mr}px;white-space:nowrap;"
>${item.label}</a></span>`;
    })
    .join("");

  return `<mj-text  padding="0" 
font-size="0" 
line-height="0" 
font-family="none">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="${menuClasses}" style="${marginStyle}">
<tr>
  <td ${bgColorAttr} class="${uid}-menu-td" style="${paddingStyle} ${backgroundCss} text-align:${menuAlign};">
    ${itemSpans}
  </td>
</tr>
</table>
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { uid, safeUrl, resolveBgCss, getResponsiveClasses, react } = ctx;
  const {
    parseMarginPaddingDiscrete,
    parseCssString,
    normalizeFontFamily,
    styleObj,
  } = react;

  const menuClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const halfSpacing = Math.ceil((props.spacing ?? 0) / 2);
  const menuAlign = props.align ?? "center";
  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );

  const enabledItems = (props.items ?? []).filter(
    (item: any) => item.enabled && item.label,
  );
  const responsiveClass = props.mobileStack ? "mobile-stack" : "";
  const lastIdx = enabledItems.length - 1;

  const itemLinks = enabledItems
    .map((item: any, i: number) => {
      const isFirst = i === 0;
      const isLast = i === lastIdx;
      const itemStyle: Record<string, any> = {
        display: "inline-block",
        textDecoration: props.textDecoration,
        color: props.color,
        fontSize: `${props.fontSize}px`,
        lineHeight: String(props.lineHeight),
        ...((props.letterSpacing as number) > 0 && {
          letterSpacing: `${props.letterSpacing}px`,
        }),
        fontWeight: String(props.fontWeight),
        fontFamily: normalizeFontFamily(
          `'${props.fontFamily}', Arial, sans-serif`,
        ),
        fontStyle: props.fontStyle,
        textTransform: props.textTransform,
        marginLeft: `${isFirst ? 0 : halfSpacing}px`,
        marginRight: `${isLast ? 0 : halfSpacing}px`,
        whiteSpace: "nowrap",
      };
      return ` <span className="${uid}-menu-item${responsiveClass ? ` ${responsiveClass}` : ""}"><Link
  href="${safeUrl(item.link || "https://example.com")}"
  target="_blank"
  style={{ ${styleObj(itemStyle)} }}
>
  ${item.label}
</Link></span>`;
    })
    .join("\n");

  return `<div
className="${menuClasses} ${uid}-menu-td"
style={{ ${styleObj({ ...parseMarginPaddingDiscrete(props.margin, props.padding), textAlign: menuAlign, ...(backgroundCss ? parseCssString(backgroundCss) : {}) })} }}
>
${itemLinks}
</div>\n`;
}

export const menuBlock: BlockDefinition = {
  name: "Menu",
  schema: {
    items: { type: "array", default: [] },
  },
  renderCanvas: MenuRenderer,
  renderSettings: MenuPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
