import AnchorRenderer from "@/components/features/emailBuilder/ui/renderers/AnchorRenderer.vue";
import ButtonPanel from "@/components/features/emailBuilder/panels/ButtonPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";

/**
 * Extracted verbatim from the "button" case in each of the three generators
 * (composables/emailBuilder/export/generators/{html,mjml,react-email}.ts).
 * Behavior is unchanged — only the source of uid/marginStyle/paddingStyle/
 * the helper functions moved, from generator-local closures to the ctx
 * parameter passed in here.
 */

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const {
    marginStyle,
    paddingStyle,
    escapeHtml,
    escapeAttr,
    safeUrl,
    resolveBgCss,
    resolveBgVml,
    getResponsiveClasses,
  } = ctx;

  const btnAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const bgInlineStyle = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const { vmlOpen, vmlClose } = resolveBgVml(
    props.backgroundGradient,
    props.backgroundColor,
  );

  const buttonContainerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const buttonLinkClasses = getResponsiveClasses(false, false, "link");
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  const hasIcon = !!props.icon;
  const iconSize = props.iconSize ?? 20;
  const iconGap = props.iconGap ?? 8;
  const iconAlt = props.iconAlt ?? "";
  const iconIsBefore = props.iconPosition !== "after";

  const textStyles =
    `color:${props.color}; font-size:${props.fontSize}px; ` +
    `font-weight:${props.fontWeight}; ` +
    `font-family:'${props.fontFamily}', Arial, sans-serif; ` +
    `${letterSpacingStyle}`;

  const linkShellStyles =
    `${paddingStyle} display:inline-block; ${bgInlineStyle} ` +
    `border-radius:${props.borderRadius}px; ` +
    `border:${props.border.width}px ${props.border.style} ${props.border.color}; ` +
    `text-decoration:none; ` +
    (hasIcon
      ? `line-height:0; font-size:0;`
      : `line-height:normal; ${textStyles}`);

  let innerContent: string;

  if (hasIcon) {
    const iconCell =
      `<td style="padding:0; line-height:0; font-size:0; ` +
      `${iconIsBefore ? `padding-right:${iconGap}px` : `padding-left:${iconGap}px`};">` +
      `<img src="${safeUrl(props.icon)}" alt="${escapeAttr(iconAlt)}" ` +
      `width="${iconSize}" height="${iconSize}" ` +
      `style="display:block; width:${iconSize}px; height:${iconSize}px; ` +
      `border:0; outline:none;" />` +
      `</td>`;

    const buttonTextClasses = getResponsiveClasses(false, false, "text");

    const textCell =
      `<td class="${buttonTextClasses}" style="padding:0; line-height:1; ${textStyles} white-space:nowrap;">` +
      `${escapeHtml(props.text)}</td>`;

    innerContent =
      `<table role="presentation" border="0" cellpadding="0" cellspacing="0" ` +
      `style="border-collapse:collapse; border-spacing:0; line-height:0;"><tr>` +
      `${iconIsBefore ? iconCell + textCell : textCell + iconCell}` +
      `</tr></table>`;
  } else {
    innerContent = escapeHtml(props.text);
  }

  return `              <div style="${marginStyle} ${btnAlign}" class="${buttonContainerClasses}">
${vmlOpen}
                <a href="${safeUrl(props.link)}" style="${linkShellStyles}" target="_blank" rel="noopener noreferrer nofollow" class="${buttonLinkClasses}">${innerContent}</a>
${vmlClose}
              </div>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const {
    marginStyle,
    paddingStyle,
    escapeHtml,
    escapeAttr,
    safeUrl,
    resolveBgCss,
    getResponsiveClasses,
  } = ctx;

  const btnAlign =
    props.align === "center"
      ? "text-align:center;"
      : props.align === "right"
        ? "text-align:right;"
        : "text-align:left;";

  const bgInlineStyle = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const buttonContainerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const buttonLinkClasses = getResponsiveClasses(false, false, "link");
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  const hasIcon = !!props.icon;
  const iconSize = props.iconSize ?? 20;
  const iconGap = props.iconGap ?? 8;
  const iconAlt = props.iconAlt ?? "";
  const iconIsBefore = props.iconPosition !== "after";

  const textStyles =
    `color:${props.color}; font-size:${props.fontSize}px; ` +
    `font-weight:${props.fontWeight}; ` +
    `font-family:'${props.fontFamily}', Arial, sans-serif; ` +
    `${letterSpacingStyle}`;

  const linkShellStyles =
    `${paddingStyle} display:inline-block; ${bgInlineStyle} ` +
    `border-radius:${props.borderRadius}px; ` +
    `border:${props.border.width}px ${props.border.style} ${props.border.color}; ` +
    `text-decoration:none; ` +
    (hasIcon
      ? `line-height:0; font-size:0;`
      : `line-height:normal; ${textStyles}`);

  let innerContent: string;

  if (hasIcon) {
    const iconCell =
      `<td style="padding:0; line-height:0; font-size:0; ` +
      `${iconIsBefore ? `padding-right:${iconGap}px` : `padding-left:${iconGap}px`};">` +
      `<img src="${safeUrl(props.icon)}" alt="${escapeAttr(iconAlt)}" ` +
      `width="${iconSize}" height="${iconSize}" ` +
      `style="display:block; width:${iconSize}px; height:${iconSize}px; ` +
      `border:0; outline:none;" /></td>`;

    const buttonTextClasses = getResponsiveClasses(false, false, "text");

    const textCell =
      `<td class="${buttonTextClasses}" style="padding:0; line-height:1; ${textStyles} white-space:nowrap;">` +
      `${escapeHtml(props.text)}</td>`;

    innerContent =
      `<table role="presentation" border="0" cellpadding="0" cellspacing="0" ` +
      `style="border-collapse:collapse; border-spacing:0; line-height:0;"><tr>` +
      `${iconIsBefore ? iconCell + textCell : textCell + iconCell}` +
      `</tr></table>`;
  } else {
    innerContent = escapeHtml(props.text);
  }

  return `<mj-text padding="0"
    font-size="0"
    line-height="0"
    font-family="none">              <div style="${marginStyle} ${btnAlign}" class="${buttonContainerClasses}">
              <a href="${safeUrl(props.link)}" style="${linkShellStyles}" target="_blank" rel="noopener noreferrer nofollow" class="${buttonLinkClasses}">${innerContent}</a>
            </div>
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { escapeAttr, safeUrl, resolveBgCss, getResponsiveClasses, react } =
    ctx;
  const { parseMarginPaddingDiscrete, styleObj } = react;

  const btnAlign =
    props.align === "center"
      ? "center"
      : props.align === "right"
        ? "right"
        : "left";

  const bgInlineStyle = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const buttonContainerClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const buttonLinkClasses = getResponsiveClasses(false, false, "link");

  const hasIcon = !!props.icon;
  const iconSize = props.iconSize ?? 20;
  const iconGap = props.iconGap ?? 8;
  const iconAlt = props.iconAlt ?? "";
  const iconIsBefore = props.iconPosition !== "after";

  const textStyles: Record<string, any> = {
    color: props.color,
    fontSize: `${props.fontSize}px`,
    fontWeight: String(props.fontWeight),
    fontFamily: react.normalizeFontFamily(
      `'${props.fontFamily}', Arial, sans-serif`,
    ),
    ...((props.letterSpacing as number) > 0 && {
      letterSpacing: `${props.letterSpacing}px`,
    }),
  };

  const linkShellStyle: Record<string, any> = {
    ...parseMarginPaddingDiscrete(undefined, props.padding),
    display: "inline-block",
    ...(bgInlineStyle ? react.parseCssString(bgInlineStyle) : {}),
    borderRadius: `${props.borderRadius}px`,
    border: `${props.border.width}px ${props.border.style} ${props.border.color}`,
    textDecoration: "none",
    ...(hasIcon
      ? { lineHeight: 0, fontSize: 0 }
      : { lineHeight: "normal", ...textStyles }),
  };

  let innerContent: string;

  if (hasIcon) {
    const iconCellStyle: Record<string, any> = {
      padding: 0,
      lineHeight: 0,
      fontSize: 0,
      ...(iconIsBefore
        ? { paddingRight: `${iconGap}px` }
        : { paddingLeft: `${iconGap}px` }),
    };
    const textCellStyle: Record<string, any> = {
      padding: 0,
      lineHeight: 1,
      ...textStyles,
      whiteSpace: "nowrap",
    };
    const imgStyle: Record<string, any> = {
      display: "block",
      width: `${iconSize}px`,
      height: `${iconSize}px`,
      border: 0,
      outline: "none",
    };
    const tableStyle: Record<string, any> = {
      borderCollapse: "collapse",
      borderSpacing: 0,
      lineHeight: 0,
    };

    const iconCell = `<td style={{ ${styleObj(iconCellStyle)} }}><img src="${safeUrl(
      props.icon,
    )}" alt="${escapeAttr(iconAlt)}" width="${iconSize}" height="${iconSize}" style={{ ${styleObj(
      imgStyle,
    )} }} /></td>`;

    const buttonTextClasses = getResponsiveClasses(false, false, "text");
    const textCell = `<td style={{ ${styleObj(textCellStyle)} }} className={"${buttonTextClasses}"}>${props.text}</td>`;

    innerContent = `<table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ ${styleObj(
      tableStyle,
    )} }}><tbody><tr>${
      iconIsBefore ? iconCell + textCell : textCell + iconCell
    }</tr></tbody></table>`;
  } else {
    innerContent = props.text;
  }

  return `<div
  className="${buttonContainerClasses}"
  style={{ ${styleObj({ ...parseMarginPaddingDiscrete(props.margin, undefined), textAlign: btnAlign })} }}
>
  <Link
    href="${safeUrl(props.link)}"
    target="_blank"
    className="${buttonLinkClasses}"
    style={{ ${styleObj(linkShellStyle)} }}
  >
    ${innerContent}
  </Link>
</div>\n`;
}

export const buttonBlock: BlockDefinition = {
  name: "Button",
  schema: {
    text: { type: "string", default: "Click Here" },
    link: { type: "string", default: "https://" },
  },
  renderCanvas: AnchorRenderer,
  renderSettings: ButtonPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
