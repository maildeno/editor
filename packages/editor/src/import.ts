// The HTML importer on its own: "@maildeno/editor/import".
//
// A pure function from HTML text to { snapshot, report }. It needs a DOM parser
// (the browser's DOMParser, or jsdom in Node) and no editor, so it serves batch
// migrations and CI as much as the browser:
//
//   import { importHtml, formatReport } from "@maildeno/editor/import";
//   import { JSDOM } from "jsdom";
//
//   const { snapshot, report } = importHtml(html, {
//     parseHtml: (text) => new JSDOM(text).window.document,
//   });
//   console.log(formatReport(report));
//   editor.setJson(snapshot);           // or write JSON.stringify(snapshot) to disk
//
// Its own entry rather than part of the package root so that the editor, which
// only loads the converter when someone imports, does not carry it for everyone.
//
// HtmlImportError is thrown when there is nothing to import (empty, over the
// size limit, MJML source, no visible content). When the error crosses from
// the editor's own bundle, as it does out of handle.importHtml(), compare
// `error.name === "HtmlImportError"` rather than using instanceof: the custom
// element build carries its own copy of the class.

export {
  importHtml,
  formatReport,
  HtmlImportError,
} from "./composables/emailBuilder/import";
export type {
  HtmlImportOptions,
  HtmlImportResult,
  ImportFlavour,
  ImportLane,
  ImportReport,
  ReportEntry,
} from "./composables/emailBuilder/import";
