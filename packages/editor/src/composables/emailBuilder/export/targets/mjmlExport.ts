// export/targets/mjmlExport.ts
// ─────────────────────────────────────────────────────────────────────────────
// Owns: mjmlExport
//
// ── v2.0 MIGRATION ──────────────────────────────────────────────────────────
// Updated to support recursive children[] tree. Columns may now contain
// nested rows and row-spacers alongside leaf components. The old flat
// col.components[] path is preserved via the children ?? components fallback.
//
// NOTE: MJML does NOT use applyComponentTagSubstitution per-component.
// Instead it strips the mj-text wrapper from the generator output and builds
// compHtml directly. applyTagTransform is called once on the full assembled
// document with resolveDocumentLevel:true, which tells it to run
// resolveAllTags when prune+previewON rather than no-op'ing (the no-op is only
// correct for HTML/React exports that substituted tags per-component already).
// ─────────────────────────────────────────────────────────────────────────────

import type { Ref } from "vue";
import { useGoogleFonts } from "../../../system/useGoogleFonts";
import { useEmailExportMobileStyles } from "../useEmailExportMobileStyles";
import { useEmailBuilderVisibility } from "../../core/useEmailBuilderVisibility";
import { mjmlGenerator } from "../generators/mjml";

import {
 buildBackgroundStyles,
 buildMobileStackGapCSS,
} from "../shared/styles";
import { wrapWithContainerDiv } from "../shared/containers";
import { formatMJML } from "../transformers/formatting";
import { applyTagTransform } from "../transformers/tagMapper";
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
}

// ─────────────────────────────────────────────────────────────────────────────

export const mjmlExport = (deps: Deps) => {
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
 } = deps;

 const { evaluateVisibility } = useEmailBuilderVisibility();

 // ── Single source of truth for "is this eligible for ESP wrapping?" ───────
 // A visibility config is ESP-wrap-eligible when it is enabled AND has at
 // least one rule OR at least one group. Previously this check only looked
 // at `rules.length` (or `enabled`), silently dropping wraps for groups-only
 // configs.
 const shouldESPWrap = (vis: any): boolean => {
 if (!vis?.enabled) return false;
 const hasRules = (vis.rules?.length ?? 0) > 0;
 const hasGroups = (vis.groups?.length ?? 0) > 0;
 return hasRules || hasGroups;
 };

 // ── Render children[] recursively (MJML variant) ──────────────────────────
 // Dispatches each child by type:
 // 'component' (or legacy leaf) → strip mj-text wrapper, emit raw HTML
 // 'row' → recurse (nested table inside td)
 // 'row-spacer' → inline spacer div
 const renderChildren = (
 children: any[],
 ctx: Record<string, string>,
 mode: ExportMode,
 depth: number,
 ): string => {
 let html = "";

 for (const child of children) {
 // Visibility pruning
 const vis =
 child.type === "component" ? child.props?.visibility : child.visibility;

 if (mode === "prune" && !evaluateVisibility(vis, ctx)) {
 continue;
 }

 const childType = child.type;

 // ── Nested row ──────────────────────────────────────────────────────
 // NOTE: buildNestedRowHTML does NOT apply ESP wrap internally, so the
 // wrap is applied here at the caller. This is deliberately different
 // from htmlExport (where buildRowHTML wraps internally).
 if (childType === "row") {
 if (depth >= MAX_DEPTH) continue;
 // Nested rows render as a nested table structure inside the parent td
 const nestedRowHtml = buildNestedRowHTML(child, ctx, mode, depth + 1);
 if (nestedRowHtml.trim()) {
 let wrapped = nestedRowHtml;
 if (mode === "wrap" && shouldESPWrap(child.visibility)) {
 wrapped = wrapWithESPLogic(
 wrapped,
 child.visibility,
 espSyntax.value,
 );
 }
 html += wrapped;
 }
 continue;
 }

 // ── Row spacer inside column ────────────────────────────────────────
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

 // ── Leaf component (type === 'component' or legacy flat shape) ──────
 const mjmlFragment = generators.mjml(child);
 const innerContent = mjmlFragment
 .replace(/^<mj-text[^>]*>/i, "")
 .replace(/<\/mj-text>\s*$/i, "");

 let compHtml = `<div style="font-family:none;font-size:0;line-height:0;text-align:left;color:#000000;">${innerContent}</div>`;

 if (mode === "wrap" && shouldESPWrap(child.props?.visibility)) {
 compHtml = wrapWithESPLogic(
 compHtml,
 child.props.visibility,
 espSyntax.value,
 );
 }

 html += compHtml;
 }

 return html;
 };

 // ── Build nested row HTML (table-based, email-safe) ───────────────────────
 // Same structure as a top-level row but rendered inline within a parent <td>.
 const buildNestedRowHTML = (
 row: any,
 ctx: Record<string, string>,
 mode: ExportMode,
 depth: number,
 ): string => {
 if (!row.columns?.length) return "";

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

 let columnsTd = "";
 row.columns.forEach((col: any, index: number) => {
 if (mode === "prune" && !evaluateVisibility(col.props?.visibility, ctx))
 return;

 const colWidthPct = columnPercentages[index];
 const responsiveClass = row.mobileStack ? "mobile-stack" : "";
 const colBgStyles = buildBackgroundStyles(col);
 const colTdStyles = [
 `width:${colWidthPct}%`,
 `box-sizing:border-box`,
 `vertical-align:${col.verticalAlign ?? "middle"}`,
 `border:${col.border.width}px ${col.border.style} ${col.border.color}`,
 `border-radius:${col.border.radius}px`,
 `overflow:hidden`,
 ...colBgStyles,
 ];

 // ── CRITICAL: use children ?? components for backward compat ─────────
 const kids = col.children ?? col.components ?? [];
 // FIX: pass the current depth (not hardcoded 0) so the MAX_DEPTH guard
 // fires correctly and nested rows recurse with an accurate depth counter.
 const componentsHtml = renderChildren(kids, ctx, mode, depth);

 const wrappedContent = wrapWithContainerDiv(
 componentsHtml,
 col.border,
 [],
 col.padding,
 );

 const classAttr = responsiveClass ? ` class="${responsiveClass}"` : "";

 columnsTd += `<td valign="${col.verticalAlign ?? "middle"}"${classAttr} style="${colTdStyles.join(";")}">
${wrappedContent}
</td>\n`;

 if (index < row.columns.length - 1 && gap > 0) {
 const gapClass = responsiveClass
 ? `gap-${gap} ${responsiveClass}`
 : `gap-${gap}`;
 columnsTd += `<td class="${gapClass}" width="${gapPercentage}%" style="width:${gapPercentage}%;max-width:${gapPercentage}%;font-size:0;line-height:0;padding:0;">&nbsp;</td>\n`;
 }
 });

 const rowBorderCss =
 (row.border?.width ?? 0) > 0
 ? `border:${row.border.width}px ${row.border.style} ${row.border.color};${row.border?.radius ?? 0}`
 : `border-radius:${row.border.radius}px;overflow:hidden;`;

 const rowPad = row.padding
 ? `${row.padding.top ?? 0}px ${row.padding.right ?? 0}px ${row.padding.bottom ?? 0}px ${row.padding.left ?? 0}px`
 : "0px";

 const rowBgStyle = rowBackgroundStyles.length
 ? `${rowBackgroundStyles.join(";")};`
 : "";

 const hasColumnRadius = row.columns.some(
 (col: any) => (col.border?.radius ?? 0) > 0,
 );
 const needsSeparate = (row.gap ?? 0) > 0 || hasColumnRadius;

 return `<div style="padding:${rowPad};${rowBorderCss}${rowBgStyle}">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:${needsSeparate ? "separate" : "collapse"};">
<tr>
${columnsTd}</tr>
</table>
</div>`;
 };

 // ── Pipeline (private) ──────────────────────────────────────────────────────
 // Mirrors htmlExport.ts's buildHTML — returns the assembled + transformed
 // MJML string. Does not minify, format, or download; both public wrappers
 // below share this body.
 const buildMJML = (
 mode: ExportMode = "prune",
 templateNameParam?: string,
 ): string => {
 const templateName = templateNameParam
 ? templateNameParam
 : "Untitled Template";
 const { getGoogleFontImports } = useGoogleFonts();
 const { emailMobileStyles } = useEmailExportMobileStyles();
 const { assembleMJML } = mjmlGenerator();

 const ctx = visibilityContext?.value ?? {};

 // 1. Prepare
 const usedFonts = collectFonts(mode, ctx);
 const googleFontUrl = getGoogleFontImports([...usedFonts]);
 const mobileOverrides = collectMobileCSS(mode, ctx, emailMobileStyles);
 const mobileGapCss = buildMobileStackGapCSS(rows.value);

 const mobileOverridesCssBase = [
 `.email-container { max-width:100% !important; width:100% !important; }`,
 `.desktop-hide { display:block !important; }`,
 `.mobile-hide { display:none !important; }`,
 `.mobile-stack { display:block !important; width:100% !important; min-width:100% !important; max-width:100% !important; box-sizing:border-box !important; }`,
 ...(mobileGapCss ? [mobileGapCss] : []),
 ].join("\n\n");

 const mobileOverridesCss =
 mobileOverrides.length > 0
 ? [
 mobileOverridesCssBase,
 `/* Mobile property overrides */`,
 ...mobileOverrides,
 ].join("\n")
 : mobileOverridesCssBase;

 const rowsSections: string[] = [];

 // 2. Generate
 rows.value.forEach((row: any) => {
 if (mode === "prune" && !evaluateVisibility(row.visibility, ctx)) return;

 // ── Row spacer ───────────────────────────────────────────────────────────
 if (row.type === "row-spacer") {
 if (!row.height || row.height <= 0) return;
 const spacerStyles = buildBackgroundStyles(row);
 let spacerRaw = ` <mj-raw>
 <table width="100%" cellpadding="0" cellspacing="0">
 <tr>
 <td>
 <div height="${row.height}" style="height:${row.height}px;line-height:${row.height}px;font-size:1px;mso-line-height-rule:exactly;${spacerStyles.join(";")}">&nbsp;</div>
 </td>
 </tr>
 </table>
 </mj-raw>`;
 if (mode === "wrap" && shouldESPWrap(row.visibility)) {
 spacerRaw = wrapWithESPLogic(
 spacerRaw,
 row.visibility,
 espSyntax.value,
 );
 }
 rowsSections.push(spacerRaw);
 return;
 }

 // ── Column width calculations ────────────────────────────────────────────
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
 const roundingError =
 availableWidthPercentage - totalCalculatedPercentage;
 if (Math.abs(roundingError) > 0.01 && columnPercentages.length > 0) {
 columnPercentages[columnPercentages.length - 1] += roundingError;
 }

 // ── Row background ───────────────────────────────────────────────────────
 const rowBackgroundStyles = buildBackgroundStyles(row);
 const rowBgSolid = (() => {
 const bg = row.backgroundGradient;
 const hasGradient =
 bg?.useGradient === true &&
 Array.isArray(bg?.gradient?.colors) &&
 bg.gradient.colors.length >= 2;
 if (hasGradient) return bg.solid || row.backgroundColor || "";
 return row.backgroundColor || "";
 })();
 const rowBgAttr =
 rowBgSolid && rowBgSolid !== "transparent" ? rowBgSolid : "";

 // ── Row padding ──────────────────────────────────────────────────────────
 const rowPad = row.padding
 ? `${row.padding.top ?? 0}px ${row.padding.right ?? 0}px ${row.padding.bottom ?? 0}px ${row.padding.left ?? 0}px`
 : "0px";

 // ── Row outer td styles ──────────────────────────────────────────────────
 const hasBorderRadius =
 (row.border?.radius ?? 0) > 0;
 const hasSimpleBorder =
 (row.border?.width ?? 0) > 0 && (row.border?.radius ?? 0) === 0;

 const rowTdStyleParts: string[] = [
 ...rowBackgroundStyles,
 `overflow:hidden`,
 ];

 // Simple border — apply directly on <td>, same as columns
 if (hasSimpleBorder) {
 rowTdStyleParts.push(
 `border:${row.border.width}px ${row.border.style} ${row.border.color}`,
 );
 rowTdStyleParts.push(`padding:${rowPad}`);
 }

 // Prevent background bleed when border-radius is present
 if (hasBorderRadius) {
 rowTdStyleParts.push(`border-radius:${row.border.radius + 2}px`);
 }

 if ((row.minHeight ?? 0) > 0) {
 rowTdStyleParts.push(`min-height:${row.minHeight}px`);
 }
 const rowTdStyle = rowTdStyleParts.length
 ? ` style="${rowTdStyleParts.join(";")}"`
 : "";

 // ── Row border for the inner wrapper div ─────────────────────────────────
 let rowBorderCss = "";
 if ((row.border?.width ?? 0) > 0) {
 rowBorderCss = `border:${row.border.width}px ${row.border.style} ${row.border.color};`;
 if ((row.border?.radius ?? 0) > 0) {
 rowBorderCss += `border-radius:${row.border.radius}px;overflow:hidden;`;
 }
 }

 const innerDivStyle = [
 `padding:${rowPad}`,
 `font-size:0`,
 `line-height:0`,
 rowBorderCss,
 ]
 .filter(Boolean)
 .join(";");

 // ── Build column <td>s ───────────────────────────────────────────────────
 let columnsTd = "";
 row.columns.forEach((col: any, index: number) => {
 if (mode === "prune" && !evaluateVisibility(col.props?.visibility, ctx))
 return;

 const colWidthPct = columnPercentages[index];
 const responsiveClass = row.mobileStack ? "mobile-stack" : "";
 const colBgStyles = buildBackgroundStyles(col);
 const colTdStyles = [
 `width:${colWidthPct}%`,
 // `max-width:${colWidthPct}%`,
 `box-sizing:border-box`,
 `vertical-align:${col.verticalAlign ?? "middle"}`,
 ...colBgStyles,
 `border:${col.border?.width ?? 0}px ${col.border?.style ?? "solid"} ${col.border?.color ?? "transparent"}`,
 `border-radius:${col.border?.radius ?? 0}px`,
 `overflow:hidden`,
 `line-height:0`,
 `font-size:0`,
 `padding:${col.padding?.top ?? 0}px ${col.padding?.right ?? 0}px ${col.padding?.bottom ?? 0}px ${col.padding?.left ?? 0}px`,
 ];

 // ── CRITICAL: use children ?? components for backward compat ───────
 const kids = col.children ?? col.components ?? [];
 // FIX: Top-level rows are depth=0; pass 0 explicitly (was already 0,
 // but now named for clarity). Nested rows pass their own depth via
 // buildNestedRowHTML → renderChildren(kids, ctx, mode, depth).
 const componentsHtml = renderChildren(kids, ctx, mode, 0);

 const classAttr = responsiveClass ? ` class="${responsiveClass}"` : "";

 columnsTd += `<td valign="${col.verticalAlign ?? "middle"}"${classAttr} style="${colTdStyles.join(";")}">
${componentsHtml}
</td>\n`;

 // ── Gap <td> ───────────────────────────────────────────────────────────
 if (index < row.columns.length - 1 && gap > 0) {
 const gapClass = responsiveClass
 ? `gap-${gap} ${responsiveClass}`
 : `gap-${gap}`;
 columnsTd += `<td class="${gapClass}" width="${gapPercentage}%" style="width:${gapPercentage}%;max-width:${gapPercentage}%;font-size:0;line-height:0;padding:0;">&nbsp;</td>\n`;
 }
 });

 const hasColumnRadius = row.columns.some(
 (col: any) => (col.border?.radius ?? 0) > 0,
 );
 const needsSeparate = (row.gap ?? 0) > 0 || hasColumnRadius;
 const innerTable = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:${needsSeparate ? "separate" : "collapse"};">
<tr>
${columnsTd}</tr>
</table>`;

 let rowContent = `<div style="${innerDivStyle}">${innerTable}</div>`;

 if (mode === "wrap" && shouldESPWrap(row.visibility)) {
 rowContent = wrapWithESPLogic(
 rowContent,
 row.visibility,
 espSyntax.value,
 );
 }

 const outlookWidth = canvasStyles.value.width ?? 600;

 rowsSections.push(` <mj-raw>
 <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:${outlookWidth}px;" width="${outlookWidth}"${rowBgAttr ? ` bgcolor="${rowBgAttr}"` : ""}><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
 <div style="margin:0px auto;max-width:${outlookWidth}px;">
 <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
 <tbody>
 <tr>
 <td${rowTdStyle}>
 ${rowContent}
 </td>
 </tr>
 </tbody>
 </table>
 </div>
 <!--[if mso | IE]></td></tr></table><![endif]-->
 </mj-raw>`);
 });

 // 3. Assemble + Transform
 let mjml = assembleMJML(
 templateName,
 rowsSections.join("\n"),
 canvasStyles.value,
 googleFontUrl,
 mobileOverridesCss,
 canvasStyles.value.mobileBreakpoint ?? 600,
 "",
 );

 // resolveDocumentLevel:true tells applyTagTransform to run resolveAllTags
 // on the full document when prune+previewON, because MJML skips
 // applyComponentTagSubstitution per-component (unlike HTML/React exports).
 mjml = applyTagTransform(
 mjml,
 mode,
 espSyntax.value,
 tagSubstitution?.value,
 true,
 );

 return mjml;
 };

 // ── Exporter (public) ───────────────────────────────────────────────────────

 const run = async (
 mode: ExportMode = "prune",
 templateNameParam?: string,
 ) => {
 if (!guardEmpty("Export")) return;

 const templateName = templateNameParam
 ? templateNameParam
 : "Untitled Template";
 const mjml = buildMJML(mode, templateName);

 // 4. Execute
 const stem = toFileStem(templateName);
 const { minifyOutput: shouldMinify } = useExportSettings();

 if (shouldMinify.value) {
 downloadFile({
 content: minifyOutput("mjml", mjml),
 filename: `${withModeSuffix(stem, mode)}.mjml`,
 mimeType: "text/plain",
 });
 } else {
 const formatted = await formatMJML(mjml);
 downloadFile({
 content: formatted,
 filename: `${withModeSuffix(stem, mode)}.mjml`,
 mimeType: "text/plain",
 });
 }
 };

 // ── String getter (public) ──────────────────────────────────────────────────
 // Mirrors htmlExport.ts's getHTML — returns the assembled, tag-transformed,
 // minified MJML string with no download. Returns null when there's nothing
 // to export, mirroring run's early return.
 const getMJML = (
 mode: ExportMode = "prune",
 templateNameParam?: string,
 ): string | null => {
 if (!rows.value || rows.value.length === 0) return null;

 const templateName = templateNameParam
 ? templateNameParam
 : "Untitled Template";
 const mjml = buildMJML(mode, templateName);
 return minifyOutput("mjml", mjml);
 };

 return {
 export: run,
 getMJML,
 };
};
