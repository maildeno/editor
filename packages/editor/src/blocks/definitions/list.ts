import ListRenderer from "@/components/features/emailBuilder/ui/renderers/ListRenderer.vue";
import ListPanel from "@/components/features/emailBuilder/panels/ListPanel.vue";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { normalizeRichTextContent } from "@/composables/emailBuilder/export/helpers/generatorHelpers";

function renderHtml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, resolveBgCss, getResponsiveClasses } = ctx;

  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const listClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";
  const wrapperStyle = `${marginStyle} ${paddingStyle} font-size:${props.fontSize}px; font-family:'${props.fontFamily}', Arial, sans-serif; line-height:${props.lineHeight}; ${letterSpacingStyle} color:${props.color}; ${backgroundCss}`;

  const tmp = document.createElement("div");
  tmp.innerHTML = normalizeRichTextContent(props.content ?? "");

  const rootList = tmp.querySelector("ul, ol");
  if (rootList) {
    rootList.setAttribute("style", wrapperStyle);
    rootList.setAttribute("class", listClasses);
    rootList.querySelectorAll("li").forEach((li: HTMLElement) => {
      li.style.marginBottom = `${props.itemSpacing}px`;
    });
  }

  return `              ${tmp.innerHTML}\n`;
}

function renderMjml(props: any, ctx: BlockRenderContext): string {
  const { marginStyle, paddingStyle, resolveBgCss, getResponsiveClasses } = ctx;

  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const listClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);
  const letterSpacingStyle =
    (props.letterSpacing as number) > 0
      ? `letter-spacing:${props.letterSpacing}px;`
      : "";
  const wrapperStyle = `${marginStyle} ${paddingStyle} font-size:${props.fontSize}px; font-family:'${props.fontFamily}', Arial, sans-serif; line-height:${props.lineHeight}; ${letterSpacingStyle} color:${props.color}; ${backgroundCss}`;

  const tmp = document.createElement("div");
  tmp.innerHTML = normalizeRichTextContent(props.content ?? "");

  const rootList = tmp.querySelector("ul, ol");
  if (rootList) {
    rootList.setAttribute("style", wrapperStyle);
    rootList.setAttribute("class", listClasses);
    rootList.querySelectorAll("li").forEach((li: HTMLElement) => {
      li.style.marginBottom = `${props.itemSpacing}px`;
    });
  }

  return `<mj-text  padding="0" 
      font-size="0" 
      line-height="0" 
      font-family="none">              ${tmp.innerHTML}
</mj-text>`;
}

function renderReactEmail(props: any, ctx: BlockRenderContext): string {
  const { resolveBgCss, getResponsiveClasses, react } = ctx;
  const {
    parseCssString,
    normalizeFontFamily,
    styleObj,
    normalizeInlineStylesToReact,
  } = react;

  const backgroundCss = resolveBgCss(
    props.backgroundGradient,
    props.backgroundColor,
  );
  const listClasses = getResponsiveClasses(props.desktopHide, props.mobileHide);

  const listTag = /^\s*<ol/i.test(props.content ?? "") ? "ol" : "ul";
  const liMatches = [
    ...(props.content ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
  ];

  const liItemsJsx = liMatches
    .map((m) => {
      const inner = normalizeInlineStylesToReact(m[1] ?? "").replace(
        /`/g,
        "\\`",
      );
      return `  <li style={{ marginBottom: "${props.itemSpacing ?? 0}px" }}>${inner}</li>`;
    })
    .join("\n");

  const listStyleRecord: Record<string, any> = {
    fontSize: `${props.fontSize}px`,
    lineHeight: String(props.lineHeight),
    ...((props.letterSpacing as number) > 0 && {
      letterSpacing: `${props.letterSpacing}px`,
    }),
    color: props.color,
    fontFamily: normalizeFontFamily(`'${props.fontFamily}', Arial, sans-serif`),
    ...(backgroundCss ? parseCssString(backgroundCss) : {}),
    marginTop: `${props.margin?.top ?? 0}px`,
    marginRight: `${props.margin?.right ?? 0}px`,
    marginBottom: `${props.margin?.bottom ?? 0}px`,
    marginLeft: `${props.margin?.left ?? 0}px`,
    paddingTop: `${props.padding?.top ?? 0}px`,
    paddingRight: `${props.padding?.right ?? 0}px`,
    paddingBottom: `${props.padding?.bottom ?? 0}px`,
    paddingLeft: `${props.padding?.left ?? 0}px`,
  };

  return `<${listTag}
  className="${listClasses}"
  style={{ ${styleObj(listStyleRecord)} }}
>
${liItemsJsx}
</${listTag}>\n`;
}

export const listBlock: BlockDefinition = {
  name: "List",
  schema: {
    content: { type: "richtext", default: "<ul><li>List item</li></ul>" },
  },
  renderCanvas: ListRenderer,
  renderSettings: ListPanel,
  renderEmail: {
    html: renderHtml,
    mjml: renderMjml,
    reactEmail: renderReactEmail,
  },
};
