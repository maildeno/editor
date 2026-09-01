import ParagraphRenderer from "@/components/features/emailBuilder/ui/renderers/ParagraphRenderer.vue";
import ParagraphPanel from "@/components/features/emailBuilder/panels/ParagraphPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { normalizeRichTextContent } from "@/composables/emailBuilder/export/helpers/generatorHelpers";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, resolveBgCss, getResponsiveClasses } = ctx;

  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const paragraphClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  return `              <p style="${marginStyle} ${paddingStyle} font-size:${props.fontSize}px; line-height:${props.lineHeight}; ${letterSpacingStyle} color:${props.color}; font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; font-style:${props.fontStyle}; ${backgroundCss} text-transform:${props.textTransform}; text-decoration:${props.textDecoration}; text-align:${props.align};" class="${paragraphClasses}">${normalizeRichTextContent(props.content)}</p>
`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, resolveBgCss, getResponsiveClasses } = ctx;

  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const paragraphClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none"><p style="${marginStyle} ${paddingStyle} font-size:${props.fontSize}px; line-height:${props.lineHeight}; ${letterSpacingStyle} color:${props.color}; font-weight:${props.fontWeight}; font-family:'${props.fontFamily}', Arial, sans-serif; font-style:${props.fontStyle}; ${backgroundCss} text-transform:${props.textTransform}; text-decoration:${props.textDecoration}; text-align:${props.align};" class="${paragraphClasses}">${normalizeRichTextContent(props.content)}</p></mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { resolveBgCss, getResponsiveClasses, react } = ctx;
  const {
    parseMarginPaddingDiscrete,
    parseCssString,
    normalizeFontFamily,
    buildInlineJsx,
    normalizeInlineStylesToReact,
  } = react;

  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const paragraphClasses = getResponsiveClasses(
    props.desktopHide,
    props.mobileHide,
  );

  return buildInlineJsx(
    "Text",
    paragraphClasses,
    {
      ...parseMarginPaddingDiscrete(props.margin, props.padding),
      fontSize: `${props.fontSize}px`,
      lineHeight: String(props.lineHeight),
      ...((props.letterSpacing as number) > 0 && {
        letterSpacing: `${props.letterSpacing}px`,
      }),
      color: props.color,
      fontWeight: String(props.fontWeight),
      fontFamily: normalizeFontFamily(
        `'${props.fontFamily}', Arial, sans-serif`,
      ),
      fontStyle: props.fontStyle,
      ...(backgroundCss ? parseCssString(backgroundCss) : {}),
      textTransform: props.textTransform,
      textDecoration: props.textDecoration,
      textAlign: props.align,
    },
    normalizeInlineStylesToReact(props.content ?? ""),
  );
}

export const paragraphBlock: BlockDefinition = {
  name: "Paragraph",
  schema: {
    content: { type: "richtext", default: "Paragraph text" },
  },
  renderCanvas: ParagraphRenderer,
  renderSettings: ParagraphPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
