// export/targets/reactEmailExport.ts
// ─────────────────────────────────────────────────────────────────────────────
// Owns: buildRowJSX, renderChildrenJSX, reactEmailExport
//
// ── v2.0 MIGRATION ──────────────────────────────────────────────────────────
// Updated to support recursive children[] tree. Columns may now contain
// nested rows and row-spacers alongside leaf components. The old flat
// col.components[] path is preserved via the children ?? components fallback.
// ─────────────────────────────────────────────────────────────────────────────

import type { Ref } from "vue";
import { useGoogleFonts } from "../../../system/useGoogleFonts";
import { useEmailExportMobileStyles } from "../useEmailExportMobileStyles";
import { useEmailBuilderVisibility } from "../../core/useEmailBuilderVisibility";

import { buildBackgroundStylesReact } from "../shared/styles";
import { wrapWithContainerDivReact } from "../shared/containers";
import { formatTSX } from "../transformers/formatting";
import {
  applyComponentTagSubstitution,
  extractReactTags,
  buildReactEmailProps,
  extractVisibilityTags,
  buildReactEmailConsts,
  transformHTMLForReact,
} from "../transformers/tagMapper";
import { wrapWithReactLogic, type ESPSyntax } from "../transformers/espWrapper";
import { downloadFile, toFileStem, withModeSuffix } from "../actions/download";
import {
  normalizeBrTags,
  normalizeFontFamily,
} from "../generators/react-email";
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

export const reactEmailExport = (deps: Deps) => {
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

  // ── Single source of truth for "is this eligible for React wrapping?" ─────
  // A visibility config is React-wrap-eligible when it is enabled AND has at
  // least one rule OR at least one group. Previously this check only looked
  // at `rules.length`, silently dropping wraps for groups-only configs.
  const shouldReactWrap = (vis: any): boolean => {
    if (!vis?.enabled) return false;
    const hasRules = (vis.rules?.length ?? 0) > 0;
    const hasGroups = (vis.groups?.length ?? 0) > 0;
    return hasRules || hasGroups;
  };

  // ── Render children[] recursively (React Email variant) ───────────────────
  // Dispatches each child by type:
  //   'component' (or legacy leaf) → call generator
  //   'row'                        → recurse via buildRowJSX
  //   'row-spacer'                 → inline spacer Section
  const renderChildrenJSX = (
    children: any[],
    ctx: Record<string, string>,
    mode: ExportMode,
    row: any,
    depth: number,
  ): string => {
    let jsx = "";

    for (const child of children) {
      // Visibility pruning
      const vis =
        child.type === "component" ? child.props?.visibility : child.visibility;

      if (mode === "prune" && !evaluateVisibility(vis, ctx)) {
        continue;
      }

      const childType = child.type;

      // ── Nested row ──────────────────────────────────────────────────────
      if (childType === "row") {
        if (depth >= MAX_DEPTH) continue;
        const nestedJsx = buildRowJSX(child, ctx, mode, depth + 1);
        if (nestedJsx.trim()) {
          jsx += `          ${nestedJsx.trim()}\n`;
        }
        continue;
      }

      // ── Row spacer inside column ────────────────────────────────────────
      if (childType === "row-spacer") {
        if (!child.height || child.height <= 0) continue;
        const spacerBgStyles = buildBackgroundStylesReact(child);
        const spacerStyleObj =
          Object.keys(spacerBgStyles).length > 0
            ? `, ${Object.entries(spacerBgStyles)
                .map(([k, v]) => `${k}:"${v}"`)
                .join(", ")}`
            : "";
        let spacerJsx = `<div style={{ display: "block", height: "${child.height}px", lineHeight: "${child.height}px", fontSize: "1px"${spacerStyleObj} }}>&nbsp;</div>`;
        if (mode === "wrap" && shouldReactWrap(child.visibility)) {
          spacerJsx = wrapWithReactLogic(spacerJsx, child.visibility);
        }
        jsx += `          ${spacerJsx}\n`;
        continue;
      }

      // ── Leaf component (type === 'component' or legacy flat shape) ──────
      let compJsx = applyComponentTagSubstitution(
        generators.react(child),
        mode,
        tagSubstitution?.value,
      );

      if (mode === "wrap" && shouldReactWrap(child.props?.visibility)) {
        compJsx = wrapWithReactLogic(compJsx, child.props.visibility);
      }

      jsx += `          ${compJsx.trim()}\n`;
    }

    return jsx;
  };

  // ── Row builder ─────────────────────────────────────────────────────────────

  const buildRowJSX = (
    row: any,
    ctx: Record<string, string>,
    mode: ExportMode,
    depth: number = 0,
  ): string => {
    if (mode === "prune" && !evaluateVisibility(row.visibility, ctx)) return "";

    if (row.type === "row-spacer") {
      if (!row.height || row.height <= 0) return "";
      const spacerBgStyles = buildBackgroundStylesReact(row);
      const spacerStyleObj =
        Object.keys(spacerBgStyles).length > 0
          ? `, ${Object.entries(spacerBgStyles)
              .map(([k, v]) => `${k}:"${v}"`)
              .join(", ")}`
          : "";
      let spacerJsx = `
        {/* Row Spacer */}
        <Section>
            <div style={{ display: "block", height: "${row.height}px", lineHeight: "${row.height}px", fontSize: "1px"${spacerStyleObj} }}>&nbsp;</div>
        </Section>`;
      if (mode === "wrap" && shouldReactWrap(row.visibility)) {
        spacerJsx = wrapWithReactLogic(spacerJsx, row.visibility);
      }
      return spacerJsx;
    }

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

    let columnsJsx = "";

    row.columns.forEach((col: any, index: number) => {
      if (mode === "prune" && !evaluateVisibility(col.props?.visibility, ctx))
        return;

      const colWidthPercentage = columnPercentages[index];
      const responsiveClass = row.mobileStack ? "mobile-stack" : "";
      const colBackgroundStylesReact = buildBackgroundStylesReact(col);

      const colStyleObj: Record<string, string> = {
        width: `${colWidthPercentage}%`,
        boxSizing: "border-box",
        verticalAlign: col.verticalAlign ?? "middle",
        border: `${col.border?.width ?? 0}px ${col.border?.style ?? "solid"} ${col.border?.color ?? "transparent"}`,
        borderRadius: `${col.border?.radius ?? 0}px`,
        overflow: "hidden",
        lineHeight: "0",
        fontSize: "0",
        padding: `${col.padding?.top ?? 0}px ${col.padding?.right ?? 0}px ${col.padding?.bottom ?? 0}px ${col.padding?.left ?? 0}px`,
        ...colBackgroundStylesReact,
      };

      const colStyleEntries = Object.entries(colStyleObj)
        .map(([k, v]) => `${k}:"${v}"`)
        .join(", ");

      // ── CRITICAL: use children ?? components for backward compat ─────────
      const kids = col.children ?? col.components ?? [];
      const componentsJsx = renderChildrenJSX(kids, ctx, mode, row, depth);

      // Remove wrapWithContainerDivReact for col (styles are inline now)
      columnsJsx += `<Column
          className="${responsiveClass}"
          style={{ ${colStyleEntries} }}
        >
${componentsJsx}
        </Column>\n`;

      if (index < row.columns.length - 1 && row.gap) {
        columnsJsx += `<Column
          className="${responsiveClass ? `gap-${row.gap} ${responsiveClass}` : `gap-${row.gap}`}"
          style={{ width:"${gapPercentage}%", maxWidth:"${gapPercentage}%", fontSize:"0", lineHeight:"0" }}
        >&nbsp;</Column>\n`;
      }
    });

    const rowBackgroundStylesReact = buildBackgroundStylesReact(row);

    const hasBorderRadius = (row.border?.radius ?? 0) > 0;

    const rowSectionStyle: Record<string, string> = {
      ...rowBackgroundStylesReact,
      // Only add radius to <Section> when needed — prevents background bleed
      ...(hasBorderRadius
        ? { borderRadius: `${row.border.radius + 2}px` }
        : {}),
      overflow: "hidden",
    };

    const rowStyleEntries = Object.entries(rowSectionStyle)
      .filter(([_, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}:"${v}"`)
      .join(", ");

    const rowStyleAttr = rowStyleEntries
      ? ` style={{ ${rowStyleEntries} }}`
      : "";

    const rowInnerContent = `<Row>${columnsJsx}</Row>`;

    const rowWrappedContent = wrapWithContainerDivReact(
      rowInnerContent,
      row.border,
      {},
      row.padding,
      true,
    );

    let rowJsx = `      <Section${rowStyleAttr}>
${rowWrappedContent}
      </Section>`;

    if (mode === "wrap" && shouldReactWrap(row.visibility)) {
      rowJsx = wrapWithReactLogic(rowJsx, row.visibility);
    }

    return rowJsx;
  };

  // ── Pipeline (private) ──────────────────────────────────────────────────────
  // Mirrors htmlExport.ts's buildHTML — returns the assembled + transformed
  // TSX string. Does not minify, format, or download.
  const buildReactEmail = (
    mode: ExportMode = "prune",
    templateNameParam?: string,
  ): string => {
    const templateName = templateNameParam
      ? templateNameParam
      : "Untitled Template";
    const componentName = templateName
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(" ")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");

    const { getGoogleFontImports } = useGoogleFonts();
    const { emailMobileStyles } = useEmailExportMobileStyles();
    const ctx = visibilityContext?.value ?? {};

    // 1. Prepare
    const usedFonts = collectFonts(mode, ctx);
    const googleFontUrl = getGoogleFontImports([...usedFonts]);
    const mobileOverrides = collectMobileCSS(mode, ctx, emailMobileStyles);
    const allStyles = buildMobileStyleBlock(
      canvasStyles.value.mobileBreakpoint,
      mobileOverrides,
    );

    // 2. Generate
    const rowsJsx = rows.value
      .map((row: any) => buildRowJSX(row, ctx, mode, 0))
      .filter(Boolean)
      .join("\n");

    const isGoogleFont = googleFontUrl?.includes("fonts.googleapis.com");
    const fontHeadJsx = (() => {
      if (!googleFontUrl) return "";
      if (isGoogleFont) {
        return (
          `        {/* Google Fonts via <link> — all families in one request */}\n` +
          `        <link href="${googleFontUrl}" rel="stylesheet" />`
        );
      }
      return [...usedFonts]
        .map(
          (f) =>
            `        <Font\n` +
            `          fontFamily="${normalizeFontFamily(f)}"\n` +
            `          fallbackFontFamily="Arial"\n` +
            `          webFont={{ url: "${googleFontUrl}", format: "woff2" }}\n` +
            `          fontWeight={400}\n` +
            `          fontStyle="normal"\n` +
            `        />`,
        )
        .join("\n");
    })();

    const fontComment = googleFontUrl
      ? isGoogleFont
        ? "// Google Fonts loaded via <link> (email-safe fallback strategy)"
        : `// Custom web font${usedFonts.size > 1 ? "s" : ""} loaded via <Font> — one instance per family`
      : "// No custom fonts used";

    let tsx = `import React from "react";
import {
  Preview,
  Body,
  Container,
  Button,
  Column,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";

${fontComment}

const styles = \`
${allStyles}
\`;

export default function ${componentName}() {
  return (
    <Html lang="${canvasStyles.value.language}">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
        <title>${templateName}</title>
        <style>{styles}</style>
${fontHeadJsx}
      </Head>
      <Preview>${canvasStyles.value.preheaderText}</Preview>
      <Body style={{ margin:0, padding:0, backgroundColor:"${canvasStyles.value.bodyBackgroundColor}" }}>
      <Container  style={{
    margin: 0,
    padding: 0,
    maxWidth: "100%",
    ${
      canvasStyles.value.bodyBackgroundImage
        ? `
    backgroundImage: "url('${canvasStyles.value.bodyBackgroundImage}')",
    backgroundSize: "${canvasStyles.value.bodyBackgroundSize}",
    backgroundPosition: "${canvasStyles.value.bodyBackgroundPosition}",
    backgroundRepeat: "${canvasStyles.value.bodyBackgroundRepeat}",
    `
        : ""
    }
  }}>
      <Container
          className="email-container"
          style={{
            width:"100%",
            maxWidth:"${canvasStyles.value.width}px",
            backgroundColor:"${canvasStyles.value.backgroundColor}",
            padding:"${canvasStyles.value.padding?.top ?? 0}px ${canvasStyles.value.padding?.right ?? 0}px ${canvasStyles.value.padding?.bottom ?? 0}px ${canvasStyles.value.padding?.left ?? 0}px"
          }}
        >
${rowsJsx}
        </Container>
      </Container>  
      </Body>
    </Html>
  );
}
`;

    // 3. Transform
    const previewIsActive =
      tagSubstitution?.value?.mergeTagActive ||
      tagSubstitution?.value?.linkTagActive;

    if (mode === "wrap" || !previewIsActive) {
      const mergeTags = extractReactTags(tsx);
      const propTagIds = new Set(mergeTags.map((t) => t.tagId));
      const visTagIds = extractVisibilityTags(rows.value);
      const constTagIds = visTagIds.filter((id) => !propTagIds.has(id));
      const { propsInterface, propsDestructure } =
        buildReactEmailProps(mergeTags);
      const constsBlock = buildReactEmailConsts(constTagIds);

      if (propsInterface || constsBlock) {
        tsx = tsx.replace(
          /^(export default function (\w+))\(\)\s*\{/m,
          [
            propsInterface ? `${propsInterface}\n\n` : "",
            `$1(${propsDestructure || ""}) {`,
            constsBlock ? `\n${constsBlock}\n` : "",
          ].join(""),
        );
      }

      tsx = transformHTMLForReact(tsx);
    }

    tsx = normalizeBrTags(tsx);

    return tsx;
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
    const tsx = buildReactEmail(mode, templateName);

    // 4. Execute
    const stem = toFileStem(templateName);
    const { minifyOutput: shouldMinify } = useExportSettings();

    if (shouldMinify.value) {
      downloadFile({
        content: minifyOutput("react-email", tsx),
        filename: `${withModeSuffix(stem, mode)}.tsx`,
        mimeType: "text/plain",
      });
    } else {
      const formatted = await formatTSX(tsx);
      downloadFile({
        content: formatted,
        filename: `${withModeSuffix(stem, mode)}.tsx`,
        mimeType: "text/plain",
      });
    }
  };

  // ── String getter (public) ──────────────────────────────────────────────────
  const getReactEmail = (
    mode: ExportMode = "prune",
    templateNameParam?: string,
  ): string | null => {
    if (!rows.value || rows.value.length === 0) return null;

    const templateName = templateNameParam
      ? templateNameParam
      : "Untitled Template";
    const tsx = buildReactEmail(mode, templateName);
    return minifyOutput("react-email", tsx);
  };

  return {
    export: run,
    getReactEmail,
  };
};
