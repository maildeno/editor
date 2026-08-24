// export/targets/htmlExport.ts
// ─────────────────────────────────────────────────────────────────────────────
// Owns: buildRowHTML, renderChildren, htmlExport
//
// ── v2.0 MIGRATION ──────────────────────────────────────────────────────────
// Updated to support recursive children[] tree. Columns may now contain
// nested rows and row-spacers alongside leaf components. The old flat
// col.components[] path is preserved via the children ?? components fallback.
//
// ── v2.1 ────────────────────────────────────────────────────────────────────
// Pipeline split into a private buildHTML() that returns the assembled +
// transformed string, and two public wrappers:
//   run     — original behavior: build + download (respects minify toggle)
//   getHTML — returns the final minified string (no download). Used by
//             the SendEmail modal and any future preview/clipboard/API path.
// ─────────────────────────────────────────────────────────────────────────────

import type { Ref } from "vue";
import { useGoogleFonts } from "../../../system/useGoogleFonts";
import { useEmailExportMobileStyles } from "../useEmailExportMobileStyles";
import { useEmailBuilderVisibility } from "../../core/useEmailBuilderVisibility";

import { buildBackgroundStyles } from "../shared/styles";
import { wrapWithContainerDiv } from "../shared/containers";
import { formatHTML } from "../transformers/formatting";
import {
  applyTagTransform,
  applyComponentTagSubstitution,
} from "../transformers/tagMapper";
import { wrapWithESPLogic, type ESPSyntax } from "../transformers/espWrapper";
import { downloadFile, toFileStem, withModeSuffix } from "../actions/download";
import { minifyOutput } from "../transformers/minify";
import { useExportSettings } from "../useExportSettings";

import type {
  ExportMode,
  TagSubstitutionOptions,
  GeneratorBundle,
} from "../types/export";

// ── Max nesting depth — matches canvas depth guard ──────────────────────────
const MAX_DEPTH = 5;

// ─────────────────────────────────────────────────────────────────────────────

interface Deps {
  rows: Ref<any[]>;
  canvasStyles: Ref<any>;
  generators: GeneratorBundle;
  espSyntax: Ref<ESPSyntax>;
  visibilityContext: Ref<Record<string, string>> | undefined;
  tagSubstitution: Ref<TagSubstitutionOptions> | undefined;
  guardEmpty: (label: string) => boolean;
  collectFonts: (mode: ExportMode, ctx: Record<string, string>) => Set<string>;
  collectMobileCSS: (
    mode: ExportMode,
    ctx: Record<string, string>,
    emailMobileStyles: (comp: any, uid: string) => string,
  ) => string[];
  buildMobileStyleBlock: (
    mobileBreakpoint: number,
    mobileOverrides: string[],
  ) => string;
}

// ─────────────────────────────────────────────────────────────────────────────

export const htmlExport = (deps: Deps) => {
  const {
    rows,
    canvasStyles,
    generators,
    espSyntax,
    visibilityContext,
    tagSubstitution,
    guardEmpty,
    collectFonts,
    collectMobileCSS,
    buildMobileStyleBlock,
  } = deps;

  const { evaluateVisibility } = useEmailBuilderVisibility();

  // ── Resolve component type (handles discriminated union + legacy) ──────────
  const resolveCompType = (child: any): string =>
    child.componentType ?? child.type;

  // ── Determine visibility config location ──────────────────────────────────
  // Components store visibility under props.visibility; rows/spacers use
  // top-level visibility.
  const getVisibility = (child: any): any =>
    child.type === "component" ? child.props?.visibility : child.visibility;

  // ── Single source of truth for "is this eligible for ESP wrapping?" ───────
  // A visibility config is ESP-wrap-eligible when it is enabled AND has at
  // least one rule OR at least one group. Previously this check only looked
  // at `rules.length`, silently dropping wraps for groups-only configs.
  const shouldESPWrap = (vis: any): boolean => {
    if (!vis?.enabled) return false;
    const hasRules = (vis.rules?.length ?? 0) > 0;
    const hasGroups = (vis.groups?.length ?? 0) > 0;
    return hasRules || hasGroups;
  };

  // ── Render children[] recursively ─────────────────────────────────────────
  // Dispatches each child by type:
  //   'component' (or legacy leaf) → call generator
  //   'row'                        → recurse via buildRowHTML
  //   'row-spacer'                 → inline spacer div
  const renderChildren = (
    children: any[],
    ctx: Record<string, string>,
    mode: ExportMode,
    depth: number,
  ): string => {
    let html = "";

    for (const child of children) {
      // Visibility pruning
      if (mode === "prune" && !evaluateVisibility(getVisibility(child), ctx)) {
        continue;
      }

      const childType = child.type;

      // ── Nested row ────────────────────────────────────────────────────────
      // NOTE: buildRowHTML already applies ESP wrap logic internally for the
      // nested row's own visibility. Do NOT wrap again here or the conditional
      // tags will be emitted twice (e.g. {{#if x}}{{#if x}}…{{/if}}{{/if}}).
      if (childType === "row") {
        if (depth >= MAX_DEPTH) continue;
        const nestedHtml = buildRowHTML(child, ctx, mode, depth + 1);
        if (nestedHtml.trim()) {
          // Wrap in a table so the <tr> is valid inside the parent <td>
          html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${nestedHtml}</table>`;
        }
        continue;
      }

      // ── Row spacer inside column ──────────────────────────────────────────
      if (childType === "row-spacer") {
        if (!child.height || child.height <= 0) continue;
        const spacerStyles = buildBackgroundStyles(child);
        let spacerHtml = `<div height="${child.height}" style="height:${child.height}px;line-height:${child.height}px;font-size:1px;mso-line-height-rule:exactly;${spacerStyles.join(";")}">&nbsp;</div>`;
        if (mode === "wrap" && shouldESPWrap(child.visibility)) {
          spacerHtml = wrapWithESPLogic(
            spacerHtml,
            child.visibility,
            espSyntax.value,
          );
        }
        html += spacerHtml;
        continue;
      }

      // ── Leaf component (type === 'component' or legacy flat shape) ────────
      // Legacy data has type = 'paragraph' etc. instead of type = 'component'.
      // The generator uses the full comp object and resolves type internally.
      let compHtml = applyComponentTagSubstitution(
        generators.html(child),
        mode,
        tagSubstitution?.value,
      );

      const vis = child.props?.visibility;
      if (mode === "wrap" && shouldESPWrap(vis)) {
        compHtml = wrapWithESPLogic(compHtml, vis, espSyntax.value);
      }

      html += compHtml;
    }

    return html;
  };

  // ── Row builder ─────────────────────────────────────────────────────────────

  const buildRowHTML = (
    row: any,
    ctx: Record<string, string>,
    mode: ExportMode,
    depth: number = 0,
  ): string => {
    if (row.type === "row-spacer") {
      if (!row.height || row.height <= 0) return "";
      const spacerStyles = buildBackgroundStyles(row);
      let spacerTr = `
<tr>
  <td>
  <div height="${row.height}" style="height:${row.height}px;line-height:${row.height}px;font-size:1px;mso-line-height-rule:exactly;${spacerStyles.join(";")}">&nbsp;
  </div>
  </td>
</tr>
`;
      if (mode === "wrap" && shouldESPWrap(row.visibility)) {
        spacerTr = wrapWithESPLogic(spacerTr, row.visibility, espSyntax.value);
      }
      return spacerTr;
    }

    const rowBackgroundStyles = buildBackgroundStyles(row);
    const canvasWidth = canvasStyles.value.mobileBreakpoint || 600;
    const gap = row.gap || 0;
    const gapPercentage = (gap / canvasWidth) * 100;
    const totalGapPercentage = gapPercentage * (row.columns.length - 1);
    const availableWidthPercentage = 100 - totalGapPercentage;

    const columnPercentages: number[] = [];
    let totalCalculatedPercentage = 0;
    row.columns.forEach((col: any) => {
      const pct = (col.width / 100) * availableWidthPercentage;
      columnPercentages.push(pct);
      totalCalculatedPercentage += pct;
    });
    const roundingError = availableWidthPercentage - totalCalculatedPercentage;
    if (Math.abs(roundingError) > 0.01 && columnPercentages.length > 0) {
      columnPercentages[columnPercentages.length - 1] += roundingError;
    }

    let columnsHtml = "";

    row.columns.forEach((col: any, index: number) => {
      if (mode === "prune" && !evaluateVisibility(col.props?.visibility, ctx))
        return;

      const columnPercentage = columnPercentages[index];
      const responsiveClass = row.mobileStack ? "mobile-stack" : "";
      const colBackgroundStyles = buildBackgroundStyles(col);
      const colTdStyles: string[] = [
        `width:${columnPercentage}%`,
        `max-width:${columnPercentage}%`,
        `vertical-align:${col.verticalAlign ?? "middle"}`,
        `box-sizing:border-box`,
        ...colBackgroundStyles,
        `border:${col.border.width}px ${col.border.style} ${col.border.color}`,
        `border-radius:${col.border.radius}px`,
        `overflow:hidden`,
        `line-height:0`,
        `font-size:0`,
        `padding:${col.padding?.top ?? 0}px ${col.padding?.right ?? 0}px ${col.padding?.bottom ?? 0}px ${col.padding?.left ?? 0}px`,
      ];

      // ── CRITICAL: use children ?? components for backward compat ─────────
      const kids = col.children ?? col.components ?? [];
      const componentsHtml = renderChildren(kids, ctx, mode, depth);

      columnsHtml += `
              <td valign="${col.verticalAlign ?? "middle"}"${responsiveClass ? ` class="${responsiveClass}"` : ""} style="${colTdStyles.join(";")}">
${componentsHtml}
              </td>
`;

      if (index < row.columns.length - 1 && row.gap) {
        columnsHtml += `
              <td 
                class="${responsiveClass ? `gap-${row.gap} ${responsiveClass}` : `gap-${row.gap}`}"
                width="${gapPercentage}%"
                style="width:${gapPercentage}%;max-width:${gapPercentage}%;font-size:0;line-height:0;padding:0;">
                &nbsp;
              </td>
`;
      }
    });

    const hasColumnRadius = row.columns.some(
      (col: any) => (col.border?.radius ?? 0) > 0,
    );
    const needsSeparate = (row.gap ?? 0) > 0 || hasColumnRadius;
    let innerTable = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:${needsSeparate ? "separate" : "collapse"};">
            <tr>
${columnsHtml}
            </tr>
          </table>`;

    // ── Define border flags before building styles ──
    const hasBorderRadius = (row.border?.radius ?? 0) > 0;
    
    const rowTdStyles: string[] = [
      ...rowBackgroundStyles,
      hasBorderRadius ? `border-radius:${row.border.radius + 2}px` : "",
      `overflow:hidden`,
    ].filter(Boolean);

    let rowContent = wrapWithContainerDiv(
      innerTable,
      row.border,
      [],
      row.padding,
    );

    if (mode === "wrap" && shouldESPWrap(row.visibility)) {
      rowContent = wrapWithESPLogic(
        rowContent,
        row.visibility,
        espSyntax.value,
      );
    }

    if ((row.minHeight ?? 0) > 0) {
      rowTdStyles.push(`min-height:${row.minHeight}px`);
    }

    return `
<tr>
  <td${rowTdStyles.length ? ` style="${rowTdStyles.join(";")}"` : ""}>
${rowContent}
  </td>
</tr>
`;
  };

  // ── Pipeline (private) ──────────────────────────────────────────────────────
  // Steps 1–3 of the original `run`: prepare, generate, transform.
  // Returns the fully assembled + tag-transformed HTML string.
  // Does NOT minify, format, or download — those are the wrapper's job.
  //
  // Both `run` (download) and `getHTML` (return-as-string) share this body.
  const buildHTML = (mode: ExportMode, templateName: string): string => {
    const { getGoogleFontImports } = useGoogleFonts();
    const { emailMobileStyles } = useEmailExportMobileStyles();
    const ctx = visibilityContext?.value ?? {};

    // 1. Prepare
    const usedFonts = collectFonts(mode, ctx);
    const googleFontUrl = getGoogleFontImports([...usedFonts]);
    const mobileOverrides = collectMobileCSS(mode, ctx, emailMobileStyles);
    const styles = buildMobileStyleBlock(
      canvasStyles.value.mobileBreakpoint,
      mobileOverrides,
    );

    const bodyStyles = [
      `margin:0`,
      `padding:0`,
      canvasStyles.value.bodyBackgroundColor
        ? `background-color:${canvasStyles.value.bodyBackgroundColor}`
        : "",
      canvasStyles.value.bodyBackgroundImage
        ? [
            `background-image:url('${canvasStyles.value.bodyBackgroundImage}')`,
            `background-size:${canvasStyles.value.bodyBackgroundSize}`,
            `background-position:${canvasStyles.value.bodyBackgroundPosition}`,
            `background-repeat:${canvasStyles.value.bodyBackgroundRepeat}`,
            `min-height:auto`,
          ].join(";")
        : "",
    ]
      .filter(Boolean)
      .join(";");

    // 2. Generate
    let html = `<!DOCTYPE html>
<html lang="${canvasStyles.value.language}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>${templateName}</title>
<!--[if mso]>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
<o:AllowPNG/>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
${googleFontUrl ? `<link href="${googleFontUrl}" rel="stylesheet">` : ""}
<style>
${styles}
</style>
</head>

<body style="${bodyStyles};">
<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
${canvasStyles.value.preheaderText} &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp; &#847; &zwnj; &nbsp;
</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:${canvasStyles.value.padding?.top ?? 0}px ${canvasStyles.value.padding?.right ?? 0}px ${canvasStyles.value.padding?.bottom ?? 0}px ${canvasStyles.value.padding?.left ?? 0}px;">

<table
  width="100%"
  align="center"
  cellpadding="0"
  cellspacing="0"
  class="email-container"
  style="width:100%;max-width:${canvasStyles.value.width}px;background:${canvasStyles.value.backgroundColor};border-collapse:collapse;"
>
`;

    rows.value.forEach((row: any) => {
      if (mode === "prune" && !evaluateVisibility(row.visibility, ctx)) return;
      const rowHtml = buildRowHTML(row, ctx, mode, 0);
      if (rowHtml.trim()) html += rowHtml;
    });

    html += `
</table>
</td>
</tr>
</table>
</body>
</html>
`;

    // 3. Transform
    html = applyTagTransform(
      html,
      mode,
      espSyntax.value,
      tagSubstitution?.value,
    );

    return html;
  };

  // ── Exporter (public) ───────────────────────────────────────────────────────
  // Original behavior: build the HTML, then either minify or prettier-format
  // depending on the user's export setting, then trigger a browser download.

  const run = async (
    mode: ExportMode = "prune",
    templateNameParam?: string,
  ) => {
    if (!guardEmpty("Export")) return;

    const templateName = templateNameParam
      ? templateNameParam
      : "Untitled Template";

    const html = buildHTML(mode, templateName);

    // 4. Execute
    const stem = toFileStem(templateName);
    const { minifyOutput: shouldMinify } = useExportSettings();

    if (shouldMinify.value) {
      downloadFile({
        content: minifyOutput("html", html),
        filename: `${withModeSuffix(stem, mode)}.html`,
        mimeType: "text/html",
      });
    } else {
      const formatted = await formatHTML(html);
      downloadFile({
        content: formatted,
        filename: `${withModeSuffix(stem, mode)}.html`,
        mimeType: "text/html",
      });
    }
  };

  // ── String getter (public) ──────────────────────────────────────────────────
  // Returns the assembled, tag-transformed, minified HTML string.
  // Used by the SendEmail modal — emails always want minified output for
  // wire size, and the export-settings minify toggle should not affect what
  // gets sent (that toggle only controls the on-disk download format).
  //
  // Returns null when guardEmpty fires, mirroring `run`'s early return.

  const getHTML = (
    mode: ExportMode = "prune",
    templateNameParam?: string,
  ): string | null => {
    // if (!guardEmpty("Send")) return null;
    if (!rows.value || rows.value.length === 0) return null;

    const templateName = templateNameParam
      ? templateNameParam
      : "Untitled Template";

    const html = buildHTML(mode, templateName);
    return minifyOutput("html", html);
  };

  return {
    export: run,
    getHTML,
  };
};
