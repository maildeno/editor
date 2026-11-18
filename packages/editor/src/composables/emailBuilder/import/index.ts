// import/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// The HTML importer's public surface.
//
//   importHtml(html, options)   HTML text to { snapshot, report }. Pure: it needs
//                               a DOM parser and nothing else, so it runs in the
//                               browser, in Node with jsdom, and in a build script.
//   formatReport(report)        the report as plain text, for logs and CI
//   HtmlImportError             thrown when there is nothing to import; its message
//                               is written for the person who pasted the HTML
//
// Loading the result into the editor is `setJson(snapshot)`, or `importHtmlInto`,
// which does both and leaves one undo step.
// ─────────────────────────────────────────────────────────────────────────────

export { importHtml } from "./htmlImport";
export { importHtmlInto } from "./apply";
export { formatReport } from "./report";
export { HtmlImportError } from "./types";
export type {
  HtmlImportOptions,
  HtmlImportResult,
  ImportFlavour,
  ImportLane,
  ImportReport,
  ReportEntry,
} from "./types";
export type { ImportHtmlIntoOptions } from "./apply";
