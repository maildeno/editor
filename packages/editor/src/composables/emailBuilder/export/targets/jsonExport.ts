// export/targets/jsonExport.ts
// ─────────────────────────────────────────────────────────────────────────────
// Owns: exportFn, importFn, getJSON
// Snapshot normalization lives in ./templateSnapshot so setJson() shares it.
// ─────────────────────────────────────────────────────────────────────────────

import type { Ref } from "vue";
import {
  optimizeCanvas,
  optimizeRows,
} from "../../transform/pipeline/optimize";
import { hydrateCanvas, hydrateRows } from "../../transform/pipeline/hydrate";
import { downloadFile, toFileStem } from "../actions/download";
import {
  CURRENT_SCHEMA_VERSION,
  toTemplateId,
  normalizeTemplateSnapshot,
} from "./templateSnapshot";

// ─────────────────────────────────────────────────────────────────────────────

interface Deps {
  rows: Ref<any[]>;
  canvasStyles: Ref<any>;
  saveToHistoryFn: (action: string) => void;
  guardEmpty: (label: string) => boolean;
  /**
   * Reports an import failure to the user.
   *
   * Passed in rather than imported so this module stays free of UI concerns
   * and remains testable without a component tree. Falls back to console
   * output if a host wires the export engine up without one, so a failure is
   * never silent.
   */
  notify?: (message: string, header?: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export const jsonExport = (deps: Deps) => {
  const { rows, canvasStyles, saveToHistoryFn, guardEmpty } = deps;

  const report =
    deps.notify ??
    ((message: string, header = "Import failed") =>
      console.error(`[maildeno-editor] ${header}: ${message}`));

  // ── Pipeline (private) ──────────────────────────────────────────────────────
  // JSON's natural getter returns the parsed object itself, not a string.
  const buildTemplateData = (templateNameParam?: string) => {
    const templateName = templateNameParam
      ? templateNameParam
      : "Untitled Template";

    // NOTE: JSON export intentionally does NOT apply tag substitution.
    // Raw {{ tag }} placeholders are preserved so the file remains a
    // reusable template rather than a one-time snapshot.
    return {
      template_id: toTemplateId(templateName),
      template_name: templateName,
      canvas: optimizeCanvas(JSON.parse(JSON.stringify(canvasStyles.value))),
      rows: optimizeRows(JSON.parse(JSON.stringify(rows.value))),
      schema_version: CURRENT_SCHEMA_VERSION,
    };
  };

  // ── Exporter (public) ───────────────────────────────────────────────────────

  const exportFn = (templateNameParam?: string) => {
    if (!guardEmpty("Export")) return;

    const templateData = buildTemplateData(templateNameParam);

    downloadFile({
      content: JSON.stringify(templateData, null, 2),
      filename: `${toFileStem(templateData.template_name)}.json`,
      mimeType: "application/json",
    });
  };

  // ── Object getter (public) ──────────────────────────────────────────────────

  const getJSON = (templateNameParam?: string) => {
    if (!rows.value || rows.value.length === 0) return null;
    return buildTemplateData(templateNameParam);
  };

  // ── Importer ────────────────────────────────────────────────────────────────

  const importFn = (file: File, selectedId: any) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let templateData = JSON.parse(e.target?.result as string);
        templateData = normalizeTemplateSnapshot(templateData);

        if (templateData.canvas && templateData.rows) {
          canvasStyles.value = hydrateCanvas(templateData.canvas);
          rows.value = hydrateRows(templateData.rows);
          selectedId.value = null;

          saveToHistoryFn("import");
        } else {
          report(
            "That file isn't a Maildeno template. Export one from the editor " +
              "(Export → JSON) and try again.",
            "Invalid template file",
          );
        }
      } catch (error: any) {
        // The parser's own message is the useful part — it names the
        // offending field or the byte offset of malformed JSON.
        report(error.message, "Couldn't load template");
      }
    };

    reader.readAsText(file);
  };

  return {
    export: exportFn,
    import: importFn,
    getJSON,
  };
};
