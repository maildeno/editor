/**
 * html-import-harness.ts
 *
 * Shared by check-html-import.ts and the groups under scripts/html-import-checks.
 * A small test harness (check, group, summary) and the helpers the checks use to
 * build HTML, find things in an imported template and compare two templates.
 *
 * Import it from a script that is run from packages/editor, so tsx picks up
 * tsconfig.json (see headless-export.ts).
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { importHtml } from "../../src/composables/emailBuilder/import/htmlImport";
import { formatReport } from "../../src/composables/emailBuilder/import/report";
import { selfCheck } from "../../src/composables/emailBuilder/import/selfCheck";
import { normalizeTemplateSnapshot } from "../../src/composables/emailBuilder/export/targets/templateSnapshot";
import {
  HtmlImportError,
  type HtmlImportOptions,
  type HtmlImportResult,
} from "../../src/composables/emailBuilder/import/types";
import {
  hydrateCanvas,
  hydrateRows,
} from "../../src/composables/emailBuilder/transform/pipeline/hydrate";

export { assert, readFileSync, readdirSync, join, hydrateCanvas, hydrateRows, HtmlImportError };
export { importHtml, selfCheck, formatReport, normalizeTemplateSnapshot };
export type { HtmlImportOptions, HtmlImportResult };

// The list block renders through document.createElement, so the exporter needs a
// DOM before it is loaded.
const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  Node: dom.window.Node,
});
const headless = await import("./headless-export");
export const exportTemplate = headless.exportTemplate;

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(here, "..", "fixtures", "html-import");

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

export const check = async (name: string, fn: () => void | Promise<void>): Promise<void> => {
  try {
    await fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    const message = err instanceof Error ? err.message : String(err);
    console.log(`FAIL  ${name}\n      ${message.split("\n").slice(0, 16).join("\n      ")}`);
  }
};

export const group = (title: string): void => {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 72 - title.length))}`);
};

/** Prints the totals and returns the exit code. */
export const summary = (): number => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) console.log(`failed:\n  ${failures.join("\n  ")}`);
  return failed ? 1 : 0;
};

// ─── Importing ────────────────────────────────────────────────────────────────

export const parseHtml = (html: string): Document => new JSDOM(html).window.document;

/** Deterministic ids, so two imports of the same HTML can be compared. */
export const counter = (): (() => string) => {
  let n = 0;
  return () => `n${String(++n).padStart(4, "0")}`;
};

export const imp = (html: string, options: HtmlImportOptions = {}): HtmlImportResult =>
  importHtml(html, { parseHtml, ids: counter(), ...options });

/** A document around a snippet. */
export const page = (inner: string, head = ""): string =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>t</title>${head}</head>` +
  `<body style="margin:0">${inner}</body></html>`;

/** A 600px email, centered on a grey page, around rows of table markup. */
export const email = (rows: string, head = "", width = 600): string =>
  page(
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeeeee"><tr><td>` +
      `<table class="c" align="center" width="${width}" cellpadding="0" cellspacing="0" style="background:#ffffff">${rows}</table>` +
      `</td></tr></table>`,
    head,
  );

export const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

export const throwsImport = (html: unknown, code: string, options: HtmlImportOptions = {}): void => {
  try {
    importHtml(html as string, { parseHtml, ...options });
  } catch (err) {
    assert.ok(err instanceof HtmlImportError, `expected HtmlImportError, got ${String(err)}`);
    assert.equal((err as HtmlImportError).code, code);
    return;
  }
  assert.fail(`expected HtmlImportError(${code}), nothing was thrown`);
};

// ─── Finding things in a snapshot ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Node = any;

export interface Found {
  node: Node;
  type: string;
  props: Record<string, any>;
  row: Node;
  column: Node;
}

/** Every component in document order, with the row and column it sits in. */
export const components = (snapshot: { rows: Node[] }): Found[] => {
  const out: Found[] = [];
  const walkRow = (row: Node): void => {
    for (const column of row.columns ?? []) {
      for (const child of column.children ?? []) {
        if (child.type === "component") {
          out.push({ node: child, type: child.componentType, props: child.props, row, column });
        } else if (child.type === "row") walkRow(child);
      }
    }
  };
  for (const row of snapshot.rows) if (row.type === "row") walkRow(row);
  return out;
};

export const ofType = (r: HtmlImportResult, type: string): Found[] =>
  components(r.snapshot).filter((c) => c.type === type);

export const only = (r: HtmlImportResult, type: string): Found => {
  const found = ofType(r, type);
  assert.equal(
    found.length,
    1,
    `expected one ${type}, found ${found.length} (${components(r.snapshot).map((c) => c.type).join(", ")})`,
  );
  return found[0];
};

export const topRows = (r: HtmlImportResult): Node[] =>
  r.snapshot.rows.filter((n: Node) => n.type === "row");

/** Every row, nested ones included. */
export const allRows = (r: HtmlImportResult): Node[] => {
  const out: Node[] = [];
  const walk = (row: Node): void => {
    out.push(row);
    for (const column of row.columns ?? []) {
      for (const child of column.children ?? []) if (child.type === "row") walk(child);
    }
  };
  for (const row of topRows(r)) walk(row);
  return out;
};

export const depthOf = (row: Node): number =>
  1 +
  Math.max(
    0,
    ...(row.columns ?? []).flatMap((c: Node) =>
      (c.children ?? []).filter((x: Node) => x.type === "row").map(depthOf),
    ),
  );

export const widthsOf = (row: Node): number[] => (row.columns ?? []).map((c: Node) => c.width);

// ─── Report ───────────────────────────────────────────────────────────────────

export const codes = (entries: Array<{ code: string }>): string[] => entries.map((e) => e.code);

export const allCodes = (r: HtmlImportResult): string[] => [
  ...codes(r.report.fallbacks),
  ...codes(r.report.dropped),
  ...codes(r.report.warnings),
  ...codes(r.report.safety),
];

// ─── Text ─────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** The text of an HTML fragment. A line break or the end of a block is a space; an inline tag is nothing. */
export const textOf = (html: string): string =>
  html
    .replace(/<br\s*\/?>|<\/(p|div|li|ul|ol|h[1-6]|tr|td|th|table|blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);

const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}{}%|*$']+/u)
    .filter((w) => w.length > 0);

/** The words a reader sees in the source: no scripts, styles, head or hidden elements. */
export const sourceWords = (html: string): Set<string> => {
  const doc = new JSDOM(html).window.document;
  doc.querySelectorAll("script, style, head, title, noscript, [hidden]").forEach((n) => n.remove());
  doc.querySelectorAll("[style]").forEach((n) => {
    const s = (n.getAttribute("style") ?? "").toLowerCase().replace(/\s+/g, "");
    if (/display:none|mso-hide:all|visibility:hidden|max-height:0|font-size:0[;"]?$/.test(s)) n.remove();
  });
  // conditional comments are comments, so they are not text nodes
  return new Set(wordsOf(textWithBreaks(doc.body)));
};

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "br", "caption", "center", "dd", "div", "dl", "dt", "figure", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

/** textContent, but with a space where a block starts or ends, so two cells never run into one word. */
const textWithBreaks = (node: Node | null): string => {
  if (!node) return "";
  if (node.nodeType === 3) return node.textContent ?? "";
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const inner = Array.from(el.childNodes).map(textWithBreaks).join("");
  return BLOCK_TAGS.has(el.localName) ? ` ${inner} ` : inner;
};

/** The words in the imported template: text blocks, buttons, lists, menu labels. */
export const outputWords = (r: HtmlImportResult): Set<string> => {
  const out: string[] = [];
  for (const c of components(r.snapshot)) {
    const p = c.props;
    for (const key of ["content", "text"]) if (typeof p[key] === "string") out.push(textOf(p[key]));
    for (const item of p.items ?? []) if (item && typeof item.label === "string") out.push(item.label);
  }
  return new Set(wordsOf(out.join(" ")));
};

// ─── Comparing two templates ──────────────────────────────────────────────────

const gradientOff = (g: Node): boolean => !g || !g.useGradient;

/**
 * An unset gradient and `{ useGradient: false, ...unused colours }` both say "no
 * gradient", so neither is kept. A phone override that switches a gradient off is a
 * real override and stays, because the desktop gradient it undoes is on.
 */
const tidyGradient = (holder: Node): void => {
  if (holder.mobile?.backgroundGradient && gradientOff(holder.mobile.backgroundGradient) && gradientOff(holder.backgroundGradient)) {
    delete holder.mobile.backgroundGradient;
  }
  if (gradientOff(holder.backgroundGradient)) delete holder.backgroundGradient;
};

/**
 * What an export and re-import may legitimately change, written out of the way:
 * ids and names, visibility objects, nulls, an unset gradient written as
 * {useGradient:false}, a gap on a row with one column, an image link that is off,
 * a divider's padding, the button weight "medium" (not a CSS value), empty mobile.
 * Anything else is a difference, including padding that moved from a column to its row.
 */
export const normalize = (n: Node, inMobile = false): Node => {
  if (Array.isArray(n)) return n.map((x) => normalize(x, inMobile));
  if (!n || typeof n !== "object") return n;
  const o: Node = {};
  for (const [k, v] of Object.entries(n)) {
    if (["id", "name", "visibility"].includes(k)) continue;
    if (v === null || v === undefined) continue;
    o[k] = normalize(v, inMobile || k === "mobile");
  }
  // a phone override is judged against the desktop value next to it, so it is left to its parent
  if (!inMobile) tidyGradient(o);
  if (o.type === "row" && (o.columns?.length ?? 0) < 2) o.gap = 0;
  if (o.componentType === "image" && !o.props.enabled) o.props.link = "";
  if (o.componentType === "divider") delete o.props.padding;
  if (o.componentType === "button" && o.props.fontWeight === "medium") o.props.fontWeight = "normal";
  if (o.mobile && !Object.keys(o.mobile).length) delete o.mobile;
  if (o.props?.mobile && !Object.keys(o.props.mobile).length) delete o.props.mobile;
  return o;
};

/** Differences between two values, one line each, with the path. Numbers within 0.01 are equal. */
export const diff = (a: Node, b: Node, path = "$"): string[] => {
  if (a === b) return [];
  if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.01) return [];
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: array vs object`];
    const out: string[] = [];
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      out.push(...diff(a[key], b[key], `${path}.${key}`));
    }
    return out;
  }
  return [`${path}: ${JSON.stringify(a)?.slice(0, 160)} -> ${JSON.stringify(b)?.slice(0, 160)}`];
};

// ─── Building Maildeno templates for the round trips ──────────────────────────

export const pad = (t: number, r = t, b = t, l = r) => ({ top: t, right: r, bottom: b, left: l });
export const leaf = (id: string, componentType: string, props: object = {}): Node => ({
  id,
  type: "component",
  componentType,
  props,
});
export const column = (id: string, width: number, children: unknown[], extra: object = {}): Node => ({
  id,
  width,
  children,
  ...extra,
});
export const row = (id: string, columns: unknown[], extra: object = {}): Node => ({
  id,
  type: "row",
  name: id,
  mobileStack: true,
  columns,
  ...extra,
});
export const spacer = (id: string, height: number, extra: object = {}): Node => ({
  id,
  type: "row-spacer",
  name: id,
  height,
  ...extra,
});
export const canvasOf = (extra: object = {}): Node => ({
  width: 600,
  backgroundColor: "#ffffff",
  bodyBackgroundColor: "#eeeeee",
  preheaderText: "",
  padding: pad(0),
  mobileBreakpoint: 600,
  ...extra,
});

/**
 * Hydrates a sparse Maildeno template, exports it with the real engine, imports the
 * HTML and returns both sides in the same normalised, hydrated form.
 */
export const roundTrip = async (
  rows: Node[],
  canvas: Node,
  options: HtmlImportOptions = {},
): Promise<{ html: string; result: HtmlImportResult; before: Node; after: Node; differences: string[] }> => {
  const rowsH = hydrateRows(JSON.parse(JSON.stringify(rows)));
  const canvasH = hydrateCanvas(JSON.parse(JSON.stringify(canvas)));
  const exported = await exportTemplate(rowsH as any, canvasH as any);
  const result = imp(exported.html, options);
  const backRows = hydrateRows(JSON.parse(JSON.stringify(result.snapshot.rows)));
  const backCanvas = hydrateCanvas(JSON.parse(JSON.stringify(result.snapshot.canvas)));
  const before = normalize({ canvas: canvasH, rows: rowsH });
  const after = normalize({ canvas: backCanvas, rows: backRows });
  return { html: exported.html, result, before, after, differences: diff(before, after) };
};

/** Walks a value and returns the paths of anything that is not valid JSON data. */
export const badValues = (value: unknown, path = "$"): string[] => {
  if (value === undefined) return [`${path} is undefined`];
  if (typeof value === "number" && !Number.isFinite(value)) return [`${path} is ${value}`];
  if (typeof value === "function" || typeof value === "symbol") return [`${path} is a ${typeof value}`];
  if (typeof value === "string" && /\bNaN\b|\bundefined\b|\[object /.test(value)) {
    return [`${path} contains a stringified bad value: ${value.slice(0, 80)}`];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => badValues(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => badValues(v, `${path}.${k}`));
  }
  return [];
};

export const valid = (r: HtmlImportResult): void => {
  assert.deepEqual(selfCheck(r.snapshot), [], "the self-check must be clean");
  assert.deepEqual(badValues(r.snapshot), [], "no NaN, undefined or stringified bad values");
};
