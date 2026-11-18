// import/apply.ts
// ─────────────────────────────────────────────────────────────────────────────
// HTML in, canvas replaced
//
// The editor's two entry points for an import (the header dialog and
// EditorHandle.importHtml) do the same thing: convert, then write the result
// through setJson, which is what keeps hydration, the id registry and the undo
// history correct. This is that one thing, so the two cannot drift.
//
// The converter is loaded on demand. It is the largest piece of the import
// feature (a CSS cascade and the structure readers), and most editor sessions
// never import anything.
// ─────────────────────────────────────────────────────────────────────────────

import type { HtmlImportOptions, ImportReport } from "./types";

export interface ImportHtmlIntoOptions extends HtmlImportOptions {
  /**
   * How the replacement lands in the undo history.
   *   "undoable" (default)  one step; Ctrl+Z brings the previous canvas back
   *   "reset"               a new baseline, with nothing to undo into
   */
  history?: "undoable" | "reset";
}

type SetJson = (data: unknown, opts?: { history?: "undoable" | "reset" }) => void;

/**
 * Converts `html` and replaces the canvas with the result.
 *
 * Rejects with HtmlImportError, before anything on the canvas is touched, when
 * the HTML cannot be imported at all (empty, too large, MJML source, nothing
 * visible). Everything the importer could not represent is in the report it
 * resolves with.
 */
export const importHtmlInto = async (
  setJson: SetJson,
  html: string,
  options: ImportHtmlIntoOptions = {},
): Promise<ImportReport> => {
  const { history, ...importOptions } = options;
  const { importHtml } = await import("./htmlImport");
  const { snapshot, report } = importHtml(html, importOptions);
  setJson(snapshot, { history: history ?? "undoable" });
  return report;
};
