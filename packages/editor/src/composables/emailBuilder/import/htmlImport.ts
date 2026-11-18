// import/htmlImport.ts
// ─────────────────────────────────────────────────────────────────────────────
// importHtml(): HTML text in, a Maildeno snapshot and a report out
//
// A pure function. It reads no editor state, touches no DOM it did not parse
// itself, makes no network request and writes nothing; the host decides what
// to do with the result (setJson, a preview, a diff). That is what makes it
// testable without the editor and safe to call from a server or a worker, as
// long as a DOM parser is available.
//
//   Stage 0  intake      parse into an inert document, sanitise, say what it is
//   Stage 1  cascade     harvest every style source; answer "what is this
//                        element's style at this viewport?" for two viewports
//   Stage 2  canvas      find the content container and the page around it
//   Stage 3  structure   analyze the DOM into items, plan rows and columns
//   Stage 4  map         read each item at both viewports; the phone values
//                        that differ become the `mobile` overrides
//   Stage 5  assemble    canvas, snapshot, self-check, report
//
// A Maildeno export goes through the same stages. Its hook classes only
// sharpen two readings: the breakpoint comes from its own media query, and a
// gap cell's percentage is read the way its exporter wrote it.
// ─────────────────────────────────────────────────────────────────────────────

import {
  CURRENT_SCHEMA_VERSION,
  normalizeTemplateSnapshot,
  toTemplateId,
  type TemplateSnapshotJson,
} from "../export/targets/templateSnapshot";
import { Cascade, DESKTOP_VIEW, phoneViewFor } from "./css/cascade";
import { intake } from "./intake";
import { type EmitCtx, emitRows, newStats } from "./map/emit";
import { mediaUrl } from "./map/urls";
import { ReportBuilder } from "./report";
import { selfCheck } from "./selfCheck";
import { analyzeContainer } from "./structure/analyze";
import { findCanvas } from "./structure/canvas";
import type { Box, Item } from "./structure/ir";
import { type Views, spacingIn } from "./structure/leaves";
import { planRows } from "./structure/plan";
import { HtmlImportError, type HtmlImportOptions, type HtmlImportResult, type ImportReport } from "./types";

const MIN_BREAKPOINT = 360;
const MAX_BREAKPOINT = 600;
const DEFAULT_BREAKPOINT = 600;
const MAX_NAME_LENGTH = 120;

// ─── Ids ──────────────────────────────────────────────────────────────────────

const randomId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 16);
  let s = "";
  while (s.length < 16) s += Math.floor(Math.random() * 16).toString(16);
  return s;
};

/** An id source that never hands out the same id twice, whatever `next` does. */
const uniqueIds = (next: () => string): (() => string) => {
  const used = new Set<string>();
  return () => {
    let id = next();
    for (let n = 1; used.has(id); n++) id = `${next()}${n}`;
    used.add(id);
    return id;
  };
};

// ─── Breakpoint ───────────────────────────────────────────────────────────────

interface Breakpoint {
  /** What the source's media queries switch at, before clamping. Sets the phone width. */
  threshold: number;
  /** The `mobileBreakpoint` for the canvas. */
  value: number;
  source: ImportReport["layout"]["breakpointSource"];
}

/** "600px", "600 and 480px", "600, 480 and 360px". */
const widthList = (widths: number[]): string => {
  const list = widths.map(String);
  const last = list.pop() as string;
  return `${list.length ? `${list.join(", ")} and ` : ""}${last}px`;
};

/**
 * The width the template becomes "mobile" at. Every media query that looks at
 * the width offers a candidate, weighted by how much it changes; the heaviest
 * wins, and the larger one when they tie. The editor accepts 360 to 600.
 *
 * Maildeno has one phone layout. A template with queries at several widths is
 * still read once, at a phone width, so every query that holds there lands in
 * the `mobile` overrides; the report says so, because screens between those
 * widths can look different from the original.
 */
const chooseBreakpoint = (cascade: Cascade, report: ReportBuilder, maildeno: boolean): Breakpoint => {
  const candidates = cascade.breakpointCandidates();
  let best: { t: number; w: number } | null = null;
  for (const [t, w] of candidates) {
    if (!best || w > best.w || (w === best.w && t > best.t)) best = { t, w };
  }
  if (!best) return { threshold: DEFAULT_BREAKPOINT, value: DEFAULT_BREAKPOINT, source: "default" };
  const threshold = Math.round(best.t);
  const value = Math.min(MAX_BREAKPOINT, Math.max(MIN_BREAKPOINT, threshold));
  if (value !== threshold) {
    report.warn(
      "breakpoint",
      `The template switches to its mobile layout at ${threshold}px; the editor allows ${MIN_BREAKPOINT} to ${MAX_BREAKPOINT}px, so ${value}px was used.`,
    );
  }
  const widths = Array.from(new Set(Array.from(candidates.keys(), Math.round))).sort((a, b) => b - a);
  if (widths.length > 1) {
    report.warn(
      "breakpoints-merged",
      `The HTML has media queries at ${widthList(widths)}. Maildeno has one phone layout, so everything that applies at ${phoneViewFor(threshold).viewport.width}px wide was combined into it; screens between those widths may look different from the original.`,
    );
  }
  return { threshold, value, source: maildeno ? "maildeno" : "media-query" };
};

// ─── The container's own spacing ──────────────────────────────────────────────

const hasAnySpacing = (v: Views, el: Element): boolean =>
  [v.desktop, v.phone].some((view) => {
    const s = spacingIn(v.cascade.styleOf(el, view));
    return s.top + s.right + s.bottom + s.left > 0.01;
  });

/**
 * A container that is not a table can carry padding of its own. The canvas
 * padding is taken from the wrappers above the container, so this padding is
 * kept as a box that only counts for spacing; the planner turns it into
 * padding on the blocks inside.
 */
const withContainerSpacing = (items: Item[], container: Element, v: Views): Item[] => {
  if (container.localName === "table" || !hasAnySpacing(v, container)) return items;
  const box: Box = {
    kind: "box",
    el: container,
    inner: items,
    hide: { d: false, p: false },
    wrap: [],
    plain: true,
  };
  return [box];
};

// ─── Report ───────────────────────────────────────────────────────────────────

const reportCascade = (cascade: Cascade, fonts: Set<string>, report: ReportBuilder): void => {
  const s = cascade.stats;
  if (s.interactiveRules) {
    report.drop("css-interactive", "Hover, focus and active styles were ignored; an email cannot rely on them.", s.interactiveRules);
  }
  if (s.pseudoElementRules) report.drop("css-pseudo", "Styles for ::before and ::after were ignored.", s.pseudoElementRules);
  if (s.ignoredMediaRules) {
    report.drop(
      "css-media-other",
      "Styles inside media queries that are not about the screen width (dark mode, print, high resolution) were ignored.",
      s.ignoredMediaRules,
    );
  }
  if (s.unsupportedSelectors) {
    report.warn("css-selector", "Some CSS selectors could not be evaluated, so their rules were skipped.", s.unsupportedSelectors);
  }
  if (s.unresolvedVars) {
    report.warn("css-var", "Some CSS variables could not be resolved, so the declarations that used them were skipped.", s.unresolvedVars);
  }
  if (s.skipped.import) {
    report.warn("css-import", "An @import of external CSS could not be loaded; its rules are not applied.", s.skipped.import);
  }
  if (s.skipped["font-face"]) {
    report.warn(
      "css-font-face",
      "@font-face declarations were not carried over. The font names were kept; clients without the font show their fallback.",
      s.skipped["font-face"],
    );
  }
  if (fonts.size) {
    report.warn(
      "fonts",
      `Fonts that many email clients do not have were kept by name: ${Array.from(fonts).slice(0, 8).join(", ")}${fonts.size > 8 ? ", …" : ""}.`,
    );
  }
};

// ─── The import ───────────────────────────────────────────────────────────────

/**
 * Turns HTML into a Maildeno template.
 *
 * Throws HtmlImportError when there is nothing to import (empty input, too
 * large, MJML source, no DOM parser, no visible content). Everything else the
 * importer cannot represent is left out and listed in the report.
 */
export const importHtml = (html: string, options: HtmlImportOptions = {}): HtmlImportResult => {
  const report = new ReportBuilder();
  const taken = intake(html, options, report);

  const maildeno = taken.flavour === "maildeno" && options.lane !== "generic";
  report.lane = maildeno ? "maildeno" : "generic";

  const cascade = new Cascade(taken.doc);
  const bp = chooseBreakpoint(cascade, report, maildeno);
  const views: Views = { cascade, desktop: DESKTOP_VIEW, phone: phoneViewFor(bp.threshold) };

  // the canvas and the content inside it
  const draft = findCanvas(taken.doc, views, report);
  const fonts = new Set<string>();
  const skip = new Set<Element>(draft.preheaderEl ? [draft.preheaderEl] : []);
  const items = withContainerSpacing(analyzeContainer(draft.container, { v: views, report, skip }), draft.container, views);
  const plan = planRows(items, { v: views, report });
  if (!plan.length) {
    throw new HtmlImportError("The HTML has no visible content that could be imported.", "no-content");
  }

  // rows, columns and blocks, read at both viewports
  const stats = newStats();
  const ctx: EmitCtx = {
    v: views,
    report,
    fonts,
    newId: uniqueIds(options.ids ?? randomId),
    stats,
    gapBasis: maildeno ? bp.value : null,
  };
  const phoneRoom = views.phone.viewport.width - draft.padding.left - draft.padding.right;
  const rows = emitRows(plan, { d: draft.width, p: Math.max(0, Math.min(draft.width, phoneRoom)) }, ctx);

  // the canvas
  const canvas = {
    language: taken.lang ?? "en-US",
    preheaderText: draft.preheaderText,
    bodyBackgroundColor: draft.bodyBackgroundColor,
    bodyBackgroundImage: mediaUrl(draft.bodyBackgroundImage, report),
    bodyBackgroundSize: draft.bodyBackgroundSize,
    bodyBackgroundPosition: draft.bodyBackgroundPosition,
    bodyBackgroundRepeat: draft.bodyBackgroundRepeat,
    backgroundColor: draft.backgroundColor,
    width: draft.width,
    padding: draft.padding,
    mobileBreakpoint: bp.value,
  };

  const name = (options.templateName?.trim() || taken.title).slice(0, MAX_NAME_LENGTH).trim() || "Imported template";
  const snapshot: TemplateSnapshotJson = normalizeTemplateSnapshot({
    template_id: toTemplateId(name),
    template_name: name,
    canvas,
    rows,
    schema_version: CURRENT_SCHEMA_VERSION,
  });

  reportCascade(cascade, fonts, report);
  const problems = selfCheck(snapshot);
  if (problems.length) {
    report.warn(
      "self-check",
      `The importer's own consistency check found ${problems.length} issue${problems.length === 1 ? "" : "s"}; the first is: ${problems[0]}`,
    );
  }

  const result: ImportReport = {
    lane: report.lane,
    flavour: report.flavour,
    summary: {
      rows: stats.rows,
      columns: stats.columns,
      nestedRows: stats.nestedRows,
      components: stats.byType,
    },
    layout: {
      canvasWidth: draft.width,
      breakpoint: bp.value,
      breakpointSource: bp.source,
      views: { desktop: views.desktop.viewport.width, phone: views.phone.viewport.width },
    },
    mobile: {
      nodesWithOverrides: stats.nodesWithOverrides,
      stackedRows: stats.stackedRows,
      mobileHidden: stats.mobileHidden,
      desktopHidden: stats.desktopHidden,
      keys: stats.keys,
    },
    ...report.lists(),
  };
  return { snapshot, report: result };
};
