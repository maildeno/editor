import HeadingRenderer from "@/components/features/emailBuilder/ui/renderers/HeadingRenderer.vue";
import HeadingPanel from "@/components/features/emailBuilder/panels/HeadingPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { normalizeRichTextContent } from "@/composables/emailBuilder/export/helpers/generatorHelpers";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, resolveBgCss, getResponsiveClasses } = ctx;

  const backgroundCss = resolveBgCss(props.backgroundGradient, props.backgroundColor);
  const headingClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0 ? `letter-spacing:${props.letterSpacing}px;` : "";

  return `              <${props.level} style="${marginStyle} ${paddingStyle} font-size:${props.fontSize}px; line-height:${props.lineHeight}; ${letterSpacingStyle} color:${props.color}; font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; ${backgroundCss} text-transform:${props.textTransform}; text-decoration:${props.textDecoration}; text-align:${props.align};" class="${headingClasses}">${normalizeRichTextContent(props.content)}</${props.level}>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, resolveBgCss, getResponsiveClasses } = ctx;

  const backgroundCss = resolveBgCss(props.backgroundGradient, props.backgroundColor);
  const headingClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0 ? `letter-spacing:${props.letterSpacing}px;` : "";

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none"><${props.level} style="${marginStyle} ${paddingStyle} font-size:${props.fontSize}px; line-height:${props.lineHeight}; ${letterSpacingStyle} color:${props.color}; font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; ${backgroundCss} text-transform:${props.textTransform}; text-decoration:${props.textDecoration}; text-align:${props.align};" class="${headingClasses}">${normalizeRichTextContent(props.content)}</${props.level}></mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { resolveBgCss, getResponsiveClasses, react } = ctx;
  const { parseMarginPaddingDiscrete, parseCssString, normalizeFontFamily, buildInlineJsx, normalizeInlineStylesToReact } = react;

  const backgroundCss = resolveBgCss(props.backgroundGradient, props.backgroundColor);
  const headingClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  return buildInlineJsx(
    "Heading",
    headingClasses,
    {
      ...parseMarginPaddingDiscrete(props.margin, props.padding),
      fontSize: `${props.fontSize}px`,
      lineHeight: String(props.lineHeight),
      ...((props.letterSpacing as number) > 0 && {
        letterSpacing: `${props.letterSpacing}px`,
      }),
      color: props.color,
      fontWeight: String(props.fontWeight),
      fontFamily: normalizeFontFamily(`'${props.fontFamily}', Arial, sans-serif`),
      ...(backgroundCss ? parseCssString(backgroundCss) : {}),
      textTransform: props.textTransform,
      textDecoration: props.textDecoration,
      textAlign: props.align,
    },
    normalizeInlineStylesToReact(props.content ?? ""),
    props.level ?? "h2",
  );
}

export const headingBlock: BlockDefinition = {
  name: "Heading",
  schema: {
    content: { type: "richtext", default: "Heading text" },
    level: { type: "string", default: "h2" },
  },
  renderCanvas: HeadingRenderer,
  renderSettings: HeadingPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
