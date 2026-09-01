// export/useEmailExportEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Export Engine — Coordinator Composable
//
// This file is the single source of truth that coordinates the export pipeline.
// It does NOT know how to build a table, format JSX, or style a column.
// It only owns:
//   - Argument resolution (new object form vs legacy positional)
//   - Shared prepare helpers (guardEmpty, collectFonts, collectMobileCSS,
//     buildMobileStyleBlock) passed into each logic composable
//   - espConfig state shared with VisibilityWrapESP component

import type { Ref } from "vue";
import { ref, computed } from "vue";

import { useInfoDialog } from "../../ui/useInfoDialog";
import { useEmailBuilderVisibility } from "../core/useEmailBuilderVisibility";

import { buildMobileStackGapCSS } from "./shared/styles";
import { type ESPSyntax } from "./transformers/espWrapper";

import { htmlExport } from "./targets/htmlExport";
import { reactEmailExport } from "./targets/reactEmailExport";
import { mjmlExport } from "./targets/mjmlExport";
import { jsonExport } from "./targets/jsonExport";

import type {
  ExportMode,
  TagSubstitutionOptions,
  GeneratorBundle,
} from "./types/export";

export type { ExportMode };

// ── Max nesting depth — matches canvas depth guard ──────────────────────────
const MAX_DEPTH = 5;

// ── Rich-text font extraction ───────────────────────────────────────────────
//
// The rich text editor inlines per-selection font overrides as:
//   <span style="font-family: 'Inter';">…</span>
//   <span style="font-family:&quot;Lora&quot;, serif;">…</span>
//   <span style="color:#000; font-family: Merriweather, serif;">…</span>
//
// These overrides aren't reflected in `comp.props.fontFamily` (that's only
// the component-level default), so without parsing the HTML we'd miss them
// and the exported email would render system fonts where Google Fonts were
// intended.
//
// Regex over DOM:
//   • collectFonts is SSR-safe — it runs during export and must not assume
//     `document` exists. DOMParser is browser-only.
//   • A regex sweep is O(n) over the content string and dramatically cheaper
//     than constructing a throwaway DOM per leaf component.
//
// Capture strategy:
//   We decode entity-encoded quotes up-front so `&quot;` doesn't introduce
//   a spurious `;` mid-value. We then capture from `font-family:` up to the
//   next `;` (end of declaration) or end of decoded input. After capture, we
//   take only the substring up to the next quote that closes the value, then
//   the first comma-separated family. This handles every form the editor
//   emits in practice:
//     font-family: 'Inter';
//     font-family: "Inter", Arial, sans-serif;
//     font-family: &quot;Comic Sans MS&quot;            ← no trailing `;`
//     font-family: Roboto
const FONT_FAMILY_RE = /font-family\s*:\s*([^;<]+)/gi;

const decodeQuotesForParsing = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

const extractFontFamiliesFromHtml = (html: string): string[] => {
  if (!html || typeof html !== "string") return [];
  // Cheap early-out: skip the regex entirely if the substring isn't present.
  if (html.indexOf("font-family") === -1) return [];

  // Decode entity-encoded quotes up-front so a `;` inside `&quot;` doesn't
  // terminate the capture prematurely and yield `&quot` as the family name.
  const decoded = decodeQuotesForParsing(html);

  const families: string[] = [];
  let match: RegExpExecArray | null;
  FONT_FAMILY_RE.lastIndex = 0;
  while ((match = FONT_FAMILY_RE.exec(decoded)) !== null) {
    const raw = match[1];
    if (!raw) continue;

    // After decoding, the captured value looks like one of:
    //   "Inter", Arial, sans-serif
    //   "Comic Sans MS"">                         ← editor without trailing `;`
    //   "Comic Sans MS"" data-x="y                ← editor with more attrs
    // The value's real end is the FIRST quote that closes the family name.
    // If the value is quoted, find the closing quote; if not, comma or end.
    let valueSlice = raw;
    const firstChar = valueSlice.trimStart()[0];
    if (firstChar === '"' || firstChar === "'") {
      const startQuote = valueSlice.indexOf(firstChar);
      const endQuote = valueSlice.indexOf(firstChar, startQuote + 1);
      if (endQuote !== -1) {
        // Keep through the closing quote AND any following comma-separated
        // fallbacks before the attribute terminator (a stray `"` from the
        // attribute boundary).
        const afterClose = valueSlice.slice(endQuote + 1);
        const stop = afterClose.search(/["<]/);
        valueSlice =
          stop === -1 ? valueSlice : valueSlice.slice(0, endQuote + 1 + stop);
      }
    } else {
      // Unquoted: stop at the first `"` or `<` (attribute / tag boundary).
      const stop = valueSlice.search(/["<]/);
      if (stop !== -1) valueSlice = valueSlice.slice(0, stop);
    }

    // Take the first family in the stack — the rest are fallbacks.
    const first = valueSlice.split(",")[0] ?? "";

    // Strip surrounding quote pair and stray whitespace.
    const cleaned = first
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .trim();

    if (cleaned) families.push(cleaned);
  }
  return families;
};

// ─────────────────────────────────────────────────────────────────────────────

export const useEmailExportEngine = (
  rows: any,
  canvasStyles: any,
  /**
   * Generator bundle injected by useEmailBuilder.
   * Accepts both the new object form and the legacy positional signatures
   * so existing call-sites do not break during the migration period.
   *
   * New (preferred):
   *   useEmailExportEngine(rows, canvas, { html, react, mjml }, ...)
   *
   * Legacy (still supported):
   *   useEmailExportEngine(rows, canvas, htmlFn, reactFn, mjmlFn, ...)
   */
  generatorsOrHtmlFn: GeneratorBundle | ((comp: any) => string),
  reactFnOrSaveHistory?: ((comp: any) => string) | ((action: string) => void),
  mjmlFnOrVisibilityContext?:
    ((comp: any) => string) | Ref<Record<string, string>>,
  saveToHistoryFnOrTagSub?:
    ((action: string) => void) | Ref<TagSubstitutionOptions>,
  visibilityContextOrUndefined?: Ref<Record<string, string>>,
  tagSubstitutionOrUndefined?: Ref<TagSubstitutionOptions>,
  /**
   * Shared espConfig ref, created once by createEmailBuilderInstance() in
   * useEmailBuilder.ts. Read unconditionally below, regardless of which of
   * the two calling conventions above was used — this parameter isn't part
   * of that legacy/new-form migration, it's new. Falls back to a fresh
   * local ref if omitted, so this still works if called any other way.
   */
  espConfigRef?: Ref<{ syntax: ESPSyntax }>,
  /**
   * Same reasoning as espConfigRef above, and for a more fundamental
   * reason than convenience: inject() never looks at a component's own
   * provides — only its parent's (or app context, for the root). A
   * component can never inject what it itself just provided, in any Vue
   * app, by design. createEmailBuilderInstance() runs inside
   * EmailEditor.vue's own setup(), the same instance that calls
   * provideInfoDialog() — so useInfoDialog() called from anywhere in that
   * call chain would always fail, regardless of ordering. Passing the
   * already-created instance directly sidesteps inject() for this case
   * entirely. Falls back to useInfoDialog() if omitted, for any future
   * caller with a genuine parent-child relationship to the provider.
   */
  infoDialogInstance?: ReturnType<typeof useInfoDialog>,
) => {
  // ── Resolve arguments (supports both call signatures) ─────────────────────
  let generators: GeneratorBundle;
  let saveToHistoryFn: (action: string) => void;
  let visibilityContext: Ref<Record<string, string>> | undefined;
  let tagSubstitution: Ref<TagSubstitutionOptions> | undefined;

  if (
    typeof generatorsOrHtmlFn === "object" &&
    !("value" in generatorsOrHtmlFn)
  ) {
    // New object form: { html, react, mjml }
    generators = generatorsOrHtmlFn as GeneratorBundle;
    saveToHistoryFn = reactFnOrSaveHistory as (action: string) => void;
    visibilityContext = mjmlFnOrVisibilityContext as
      Ref<Record<string, string>> | undefined;
    tagSubstitution = saveToHistoryFnOrTagSub as
      Ref<TagSubstitutionOptions> | undefined;
  } else {
    // Legacy positional form
    generators = {
      html: generatorsOrHtmlFn as (comp: any) => string,
      react: reactFnOrSaveHistory as (comp: any) => string,
      mjml: mjmlFnOrVisibilityContext as (comp: any) => string,
    };
    saveToHistoryFn = saveToHistoryFnOrTagSub as (action: string) => void;
    visibilityContext = visibilityContextOrUndefined;
    tagSubstitution = tagSubstitutionOrUndefined;
  }

  // ── Services ───────────────────────────────────────────────────────────────
  const { evaluateVisibility } = useEmailBuilderVisibility();
  const { open } = infoDialogInstance ?? useInfoDialog();

  // ── ESP config state (shared with VisibilityWrapESP component) ────────────
  const espConfig =
    espConfigRef ??
    ref<{ syntax: ESPSyntax }>({
      syntax: "handlebars",
    });

  // ─────────────────────────────────────────────────────────────────────────
  // RECURSIVE TREE WALKER
  // Walks the children[] tree and calls a callback for every leaf component.
  // Handles nested rows, row-spacers, and legacy col.components[].
  // ─────────────────────────────────────────────────────────────────────────

  const walkLeafComponents = (
    children: any[],
    mode: ExportMode,
    ctx: Record<string, string>,
    callback: (comp: any) => void,
    depth: number = 0,
  ): void => {
    if (depth >= MAX_DEPTH) return;

    for (const child of children) {
      const childType = child.type;

      // ── Nested row → recurse into its columns ──────────────────────────
      if (childType === "row") {
        if (mode === "prune" && !evaluateVisibility(child.visibility, ctx))
          continue;
        for (const col of child.columns ?? []) {
          const kids = col.children ?? col.components ?? [];
          walkLeafComponents(kids, mode, ctx, callback, depth + 1);
        }
        continue;
      }

      // ── Row spacer — no leaf components ────────────────────────────────
      if (childType === "row-spacer") continue;

      // ── Leaf component (type === 'component' or legacy flat shape) ─────
      if (mode === "prune" && !evaluateVisibility(child.props?.visibility, ctx))
        continue;

      callback(child);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PREPARE helpers
  // Shared across all three export functions. Passed into each logic
  // composable via the sharedDeps object so they don't re-implement them.
  // ─────────────────────────────────────────────────────────────────────────

  const guardEmpty = (label: string): boolean => {
    if (!rows.value || rows.value.length === 0) {
      open(
        "Your template is empty. Please add at least one row before exporting.",
        label,
      );
      return false;
    }
    return true;
  };

  const collectFonts = (
    mode: ExportMode,
    ctx: Record<string, string>,
  ): Set<string> => {
    const usedFonts = new Set<string>();
    rows.value.forEach((row: any) => {
      if (mode === "prune" && !evaluateVisibility(row.visibility, ctx)) return;
      if (!row.columns) return;
      row.columns.forEach((col: any) => {
        // ── CRITICAL: use children ?? components for backward compat ─────
        const kids = col.children ?? col.components ?? [];
        walkLeafComponents(kids, mode, ctx, (comp: any) => {
          // ── Component-level font (paragraph/heading/list/button/menu/anchor)
          if (comp.props?.fontFamily) usedFonts.add(comp.props.fontFamily);
          if (comp.props?.mobile?.fontFamily)
            usedFonts.add(comp.props.mobile.fontFamily);

          // ── Inline rich-text overrides ──────────────────────────────────
          // Rich text editors (paragraph, heading, list) store HTML in
          // props.content where the user can apply per-selection font
          // changes as <span style="font-family: '…'">. Those fonts aren't
          // in props.fontFamily, so we sweep the content string for them.
          if (typeof comp.props?.content === "string") {
            const inlineFonts = extractFontFamiliesFromHtml(comp.props.content);
            for (const f of inlineFonts) usedFonts.add(f);
          }
        });
      });
    });
    return usedFonts;
  };

  const collectMobileCSS = (
    mode: ExportMode,
    ctx: Record<string, string>,
    emailMobileStyles: (comp: any, uid: string) => string,
  ): string[] => {
    const overrides: string[] = [];
    rows.value.forEach((row: any) => {
      if (mode === "prune" && !evaluateVisibility(row.visibility, ctx)) return;
      if (!row.columns) return;
      row.columns.forEach((col: any) => {
        // ── CRITICAL: use children ?? components for backward compat ─────
        const kids = col.children ?? col.components ?? [];
        walkLeafComponents(kids, mode, ctx, (comp: any) => {
          const css = emailMobileStyles(comp, `eb-${comp.id}`);
          if (css) overrides.push(css);
        });
      });
    });
    return overrides;
  };

  // buildMobileStyleBlock closes over rows.value (via buildMobileStackGapCSS)
  // so it lives here in the coordinator rather than in shared/styles.
  const buildMobileStyleBlock = (
    mobileBreakpoint: number,
    mobileOverrides: string[],
  ): string => {
    const mobileGapCss = buildMobileStackGapCSS(rows.value);
    const overridesBlock =
      mobileOverrides.length > 0
        ? `\n\n/* Mobile property overrides */\n${mobileOverrides.join("\n\n")}`
        : "";

    const baseStyles = `
.desktop-hide { display: none !important; }
ul li:last-child, ol li:last-child { margin-bottom: 0 !important; }`;

    const mobileStyles = `
.email-container { max-width:100% !important; width:100% !important; }

.desktop-hide { display:block !important; }

.mobile-hide { display:none !important; }

.mobile-stack { display:block !important; width:100% !important; min-width:100% !important; max-width:100% !important; box-sizing:border-box !important; }
${mobileGapCss ? `\n${mobileGapCss}` : ""}${overridesBlock}
`;

    return `${baseStyles}
@media only screen and (max-width:${mobileBreakpoint}px) {
${mobileStyles}
}`;
  };

  // ── Shared deps passed into format composables ─────────────────────────────
  // espSyntax is projected from espConfig so each composable only gets what
  // it actually needs — the syntax string — rather than the full state ref.
  const espSyntax = computed(() => espConfig.value.syntax) as Ref<ESPSyntax>;

  const sharedDeps = {
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
  };

  // ── Wire up logic composables ──────────────────────────────────────────────
  const html = htmlExport(sharedDeps);
  const react = reactEmailExport(sharedDeps);
  const mjml = mjmlExport(sharedDeps);

  const json = jsonExport({
    rows,
    canvasStyles,
    saveToHistoryFn,
    guardEmpty,
    // Import failures surface in the editor's own dialog rather than a
    // browser alert(), which cannot be styled and blocks the page.
    notify: (message, header) => open(message, header ?? "Import failed"),
  });

  // ── Public API — identical to original, plus the three getters that HTML
  // already had (getExportedHTML) but MJML/React/JSON didn't. A host can
  // now get any of the four formats as data without a browser download
  // being the only option. ─────────────────────────────────────────────────
  return {
    exportHTML: html.export,
    getExportedHTML: html.getHTML,
    exportReactEmail: react.export,
    getExportedReactEmail: react.getReactEmail,
    exportMJML: mjml.export,
    getExportedMJML: mjml.getMJML,
    exportJSON: json.export,
    getExportedJSON: json.getJSON,
    importJSON: json.import,
    espConfig,
  };
};
