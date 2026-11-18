// import/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Public types of the HTML importer
//
// What goes in (options), what comes out (a snapshot and a report), and the
// shape of the report. The report is data, not prose: the editor renders it in
// its own dialog, a host can log it or fail a build on it, and the tests assert
// on it. Every entry has a stable `code`, so a host can react to one kind of
// finding without parsing a sentence.
// ─────────────────────────────────────────────────────────────────────────────

import type { TemplateSnapshotJson } from "../export/targets/templateSnapshot";

/** Which reader handled the document. */
export type ImportLane = "maildeno" | "generic";

/** What produced the HTML, as far as the markup says. */
export type ImportFlavour = "maildeno" | "mjml" | "generic";

export interface HtmlImportOptions {
  /**
   * The template name. Defaults to the document's <title>, then to
   * "Imported template".
   */
  templateName?: string;
  /**
   * "auto" (default) lets a Maildeno export take the fast lane, which reads its
   * hook classes. "generic" forces the general reader even for a Maildeno
   * export, which is how the two readers are compared in the tests.
   */
  lane?: "auto" | "generic";
  /**
   * How to turn the text into a Document. Defaults to the global DOMParser,
   * which gives an inert document: scripts do not run and nothing is fetched.
   * Pass your own in Node (jsdom) when DOMParser is not a global.
   */
  parseHtml?: (html: string) => Document;
  /** Soft limit on the input, in bytes. Default 5 MB. Over it, the import stops. */
  maxBytes?: number;
  /**
   * Where node ids come from. Defaults to random ids like the editor's own.
   * Tests pass a counter so two imports of the same HTML are identical.
   */
  ids?: () => string;
}

/** One finding. `count` is how many times it was seen, when it was seen more than once. */
export interface ReportEntry {
  code: string;
  message: string;
  count?: number;
}

export interface ImportReport {
  lane: ImportLane;
  flavour: ImportFlavour;
  summary: {
    rows: number;
    columns: number;
    nestedRows: number;
    components: Record<string, number>;
  };
  layout: {
    canvasWidth: number;
    /** The width the template's media queries switch at, after clamping. */
    breakpoint: number;
    breakpointSource: "media-query" | "maildeno" | "default";
    /** Phone and desktop widths the two views were read at. */
    views: { desktop: number; phone: number };
  };
  mobile: {
    /** Nodes that got at least one `mobile` override. */
    nodesWithOverrides: number;
    /** Rows set to stack their columns on mobile. */
    stackedRows: number;
    mobileHidden: number;
    desktopHidden: number;
    /** Which keys were overridden, how often. */
    keys: Record<string, number>;
  };
  /** Content that was kept in another form: a table read as a button, a stack flattened. */
  fallbacks: ReportEntry[];
  /** Things the source had that Maildeno has no place for. */
  dropped: ReportEntry[];
  /** Things that import but may look different. */
  warnings: ReportEntry[];
  /** What was removed for safety. */
  safety: ReportEntry[];
}

export interface HtmlImportResult {
  snapshot: TemplateSnapshotJson;
  report: ImportReport;
}

/** Thrown when the input cannot be imported at all. The message is user-facing. */
export class HtmlImportError extends Error {
  constructor(
    message: string,
    readonly code: "empty" | "too-large" | "no-dom" | "no-content" | "mjml-source",
  ) {
    super(message);
    this.name = "HtmlImportError";
  }
}
