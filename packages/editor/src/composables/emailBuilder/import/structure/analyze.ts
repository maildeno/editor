// import/structure/analyze.ts
// ─────────────────────────────────────────────────────────────────────────────
// DOM → Items
//
// Walks the content container top to bottom and returns a vertical list of
// Items (see ir.ts): leaves, boxes and column groups. It records structure
// only. Every item keeps the elements its styles come from, and the emitter
// reads those once for the desktop view and once for the phone view.
//
// The walk is the same for every kind of source, because it asks what the
// markup does, not which tool wrote it:
//
//   table          a row of cells is columns, a single cell is a wrapper
//   inline-block   consecutive column-like siblings (hybrid, MJML, floated
//                  tables) are columns
//   flex           children of a row flex container are columns
//   anything else  a wrapper: its children are items, and its own padding or
//                  paint is carried by a Box, or pushed onto a lone leaf
//
// Wrappers with neither padding nor paint disappear. Content that is hidden in
// both views is left out; content hidden in one view keeps a flag for it.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReportBuilder } from "../report";
import { parseLen } from "../css/values";
import {
  SKIP_TAGS,
  INLINE_TAGS,
  hasVisibleContent,
  isBlankText,
  isElement,
  isText,
  normText,
  rowCells,
  tableRows,
} from "./dom";
import type { Box, Cell, Cols, GapInfo, Hide, Item, WidthSpec, WrapPad } from "./ir";
import { flatFill, hasPaint, hasSpacing, isInvisible } from "./leaves";
import { classifyRun, leafFromElement, listLeaf, textLeaf, wrapOf, type RecCtx } from "./recognize";

export interface AnalyzeCtx extends RecCtx {
  /** Elements to pass over silently, such as the preheader. */
  skip: Set<Element>;
}

const NOHIDE: Hide = { d: false, p: false };

const orHide = (a: Hide, b: Hide): Hide => ({ d: a.d || b.d, p: a.p || b.p });

const ownHide = (ctx: AnalyzeCtx, el: Element): Hide => ({
  d: isInvisible(ctx.v.cascade.styleOf(el, ctx.v.desktop)),
  p: isInvisible(ctx.v.cascade.styleOf(el, ctx.v.phone)),
});

const sd = (ctx: AnalyzeCtx, el: Element) => ctx.v.cascade.styleOf(el, ctx.v.desktop);

// ─── Block or inline ──────────────────────────────────────────────────────────

const BLOCKISH = new Set([
  "block",
  "table",
  "list-item",
  "table-row",
  "table-cell",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
  "table-caption",
  "flex",
  "grid",
  "flow-root",
]);

/**
 * An element's display, in the view where it shows. One that is hidden on desktop and
 * visible on a phone (display:none, then display:block in a media query) is classified
 * by what it is on the phone, or it would be mistaken for inline text.
 */
const displayOf = (el: Element, ctx: AnalyzeCtx): string => {
  const d = sd(ctx, el).display();
  return d !== "none" ? d : ctx.v.cascade.styleOf(el, ctx.v.phone).display();
};

const isBlockLevel = (el: Element, ctx: AnalyzeCtx): boolean => {
  const d = displayOf(el, ctx);
  if (BLOCKISH.has(d)) return true;
  if (d === "inline-block" || d === "inline-table" || d === "inline-flex") return !INLINE_TAGS.has(el.localName);
  return false;
};

const blockInside = new WeakMap<Element, boolean>();

/** Whether an inline element has block-level content, such as <font><table>…. */
const containsBlock = (el: Element, ctx: AnalyzeCtx): boolean => {
  const cached = blockInside.get(el);
  if (cached !== undefined) return cached;
  let found = false;
  for (const child of Array.from(el.children)) {
    if (SKIP_TAGS.has(child.localName)) continue;
    if (isBlockLevel(child, ctx) || containsBlock(child, ctx)) {
      found = true;
      break;
    }
  }
  blockInside.set(el, found);
  return found;
};

/** An image or video, or a link that holds nothing but one. */
const isImageLike = (el: Element): boolean => {
  if (el.localName === "img" || el.localName === "video") return true;
  return el.localName === "a" && !!el.querySelector("img") && normText(el.textContent ?? "") === "";
};

const isInlineNode = (n: Node, ctx: AnalyzeCtx): boolean => {
  if (isText(n)) return true;
  if (!isElement(n)) return false;
  if (SKIP_TAGS.has(n.localName)) return true; // carried along, never shown
  if (n.localName === "br") return true;
  return !isBlockLevel(n, ctx) && !containsBlock(n, ctx);
};

/** Whether everything in `el` is text and inline elements. */
const isInlineOnly = (el: Element, ctx: AnalyzeCtx): boolean =>
  Array.from(el.childNodes).every((n) => isInlineNode(n, ctx));

// ─── Wrapping ─────────────────────────────────────────────────────────────────

/**
 * What a wrapper element becomes around the items found inside it:
 *   nothing       no padding and no paint
 *   a wrap entry  padding only, around one leaf: the leaf carries it
 *   the leaf      a flat fill around a text leaf that has no element of its own
 *   a Box         anything else
 */
const absorb = (el: Element, items: Item[], ctx: AnalyzeCtx, hide: Hide): Item[] => {
  if (!items.length) return [];
  const paint = hasPaint(ctx.v, el);
  const spacing = hasSpacing(ctx.v, el);
  if (!paint && !spacing) return items;
  const only = items.length === 1 ? items[0] : null;
  if (!paint && only && only.kind === "leaf") {
    only.wrap.push(...wrapOf(el, ctx));
    return items;
  }
  if (paint && only && only.kind === "leaf" && only.own === null && flatFill(ctx.v, el)) {
    if (only.type === "paragraph" || only.type === "heading" || only.type === "list") {
      only.own = el;
      only.ownWrapper = true;
      return items;
    }
  }
  const box: Box = { kind: "box", el, inner: items, hide, wrap: [] };
  return [box];
};

// ─── Widths and gaps ──────────────────────────────────────────────────────────

const cellWidth = (el: Element, ctx: AnalyzeCtx): WidthSpec => {
  const cs = sd(ctx, el);
  const width = cs.len("width");
  const maxLen = cs.len("max-width");
  if (width && width.unit === "%" && width.n < 100) return { kind: "pct", n: width.n };
  if (width && width.unit !== "%" && width.unit !== "") {
    const px = cs.px("width");
    if (px !== null && px > 0) return { kind: "px", n: px };
  }
  if (width && width.unit === "" && width.n > 0) return { kind: "px", n: width.n };
  // a block that is 100% wide up to a maximum: a hybrid column
  if (maxLen) {
    if (maxLen.unit === "%") return { kind: "pct", n: maxLen.n };
    const px = cs.px("max-width");
    if (px !== null && px > 0) return { kind: "px", n: px };
  }
  if (width && width.unit === "%") return { kind: "pct", n: width.n };
  return { kind: "auto", n: 0 };
};

const gapClassPx = (el: Element): number | null => {
  for (const token of Array.from(el.classList)) {
    const m = /^gap-(\d{1,3})$/.exec(token);
    if (m) return Number(m[1]);
  }
  return null;
};

const averageGap = (sizes: GapInfo[], ctx: AnalyzeCtx): GapInfo | null => {
  if (!sizes.length) return null;
  const els = sizes.flatMap((s) => s.els);
  const px = sizes.map((s) => s.px).filter((n): n is number => n !== null && n > 0);
  const pct = sizes.map((s) => s.pct).filter((n): n is number => n !== null && n > 0);
  const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  if (px.length) {
    if (Math.max(...px) - Math.min(...px) > 2) ctx.report.warn("gap-uneven", "The gaps between columns in one row differ; their average was used.");
    return { px: avg(px), pct: null, els };
  }
  if (pct.length) {
    if (Math.max(...pct) - Math.min(...pct) > 1) ctx.report.warn("gap-uneven", "The gaps between columns in one row differ; their average was used.");
    return { px: null, pct: avg(pct), els };
  }
  return null;
};

interface CellPlan {
  contents: Element[];
  edges: WrapPad[];
  gap: GapInfo | null;
}

/** Splits a row's cells into content cells, gap cells between them, and empty edge cells. */
const classifyCells = (cells: Element[], ctx: AnalyzeCtx): CellPlan => {
  const info = cells.map((c) => ({
    c,
    shows: hasVisibleContent(c) || hasPaint(ctx.v, c),
    w: cellWidth(c, ctx),
    gapPx: gapClassPx(c),
  }));
  const first = info.findIndex((i) => i.shows);
  let last = -1;
  info.forEach((i, idx) => {
    if (i.shows) last = idx;
  });
  if (first === -1) return { contents: [], edges: [], gap: null };

  const edges: WrapPad[] = [];
  const edge = (el: Element, side: "left" | "right"): WrapPad => ({
    el,
    kind: "width",
    top: false,
    bottom: false,
    left: side === "left",
    right: side === "right",
  });
  for (let i = 0; i < first; i++) if (info[i].w.kind !== "auto") edges.push(edge(info[i].c, "left"));
  for (let i = last + 1; i < info.length; i++) if (info[i].w.kind !== "auto") edges.push(edge(info[i].c, "right"));

  const contents: Element[] = [];
  const gaps: GapInfo[] = [];
  // a holder, not a local: `settle` writes it, and TypeScript does not follow that through a closure
  const run: { gap: GapInfo | null } = { gap: null };
  const settle = (): void => {
    if (run.gap) gaps.push(run.gap);
    run.gap = null;
  };
  for (let i = first; i <= last; i++) {
    const cell = info[i];
    if (cell.shows) {
      settle();
      contents.push(cell.c);
      continue;
    }
    const small =
      cell.gapPx !== null || (cell.w.kind === "px" && cell.w.n <= 40) || (cell.w.kind === "pct" && cell.w.n <= 8);
    if (small) {
      const px: number | null = cell.gapPx ?? (cell.w.kind === "px" ? cell.w.n : null);
      const pct: number | null = cell.w.kind === "pct" ? cell.w.n : null;
      const prev = run.gap;
      run.gap = {
        px: px === null && prev?.px == null ? null : (px ?? 0) + (prev?.px ?? 0),
        pct: pct === null && prev?.pct == null ? null : (pct ?? 0) + (prev?.pct ?? 0),
        els: [...(prev?.els ?? []), cell.c],
      };
    } else if (cell.w.kind === "auto") {
      // an empty cell with no width takes no room
    } else {
      settle();
      contents.push(cell.c); // a wide empty cell is an empty column
    }
  }
  settle();
  return { contents, edges, gap: averageGap(gaps, ctx) };
};

// ─── Columns ──────────────────────────────────────────────────────────────────

const cellOf = (el: Element, ctx: AnalyzeCtx, inh: Hide): Cell => {
  const hide = orHide(inh, ownHide(ctx, el));
  return {
    el,
    body: analyzeChildren(el, ctx, hide),
    hide,
    width: cellWidth(el, ctx),
  };
};

// ─── Hybrid and flex columns ──────────────────────────────────────────────────

const COLUMN_TAGS = new Set(["div", "table", "section", "article", "aside", "header", "footer", "main", "td", "ul", "form", "center"]);

const isColumnCandidate = (el: Element, ctx: AnalyzeCtx): boolean => {
  if (!COLUMN_TAGS.has(el.localName)) return false;
  const cs = sd(ctx, el);
  const d = cs.display();
  const float = (cs.get("float") ?? "none").trim().toLowerCase();
  return d === "inline-block" || d === "inline-table" || float === "left" || float === "right";
};

/** Index range of consecutive column-like siblings starting at `from`, or null. */
const columnGroupAt = (kids: Node[], from: number, ctx: AnalyzeCtx): { els: Element[]; end: number } | null => {
  const first = kids[from];
  if (!isElement(first) || !isColumnCandidate(first, ctx)) return null;
  const els: Element[] = [first];
  let end = from;
  for (let i = from + 1; i < kids.length; i++) {
    const n = kids[i];
    if (isText(n)) {
      if (isBlankText(n.data)) continue;
      break;
    }
    if (!isElement(n)) continue; // comments, including the conditional ones
    if (SKIP_TAGS.has(n.localName)) continue;
    if (isColumnCandidate(n, ctx)) {
      els.push(n);
      end = i;
      continue;
    }
    break;
  }
  return els.length >= 2 ? { els, end } : null;
};

const makeInlineCols = (els: Element[], parent: Element, ctx: AnalyzeCtx, inh: Hide): Cols => {
  const live = els.filter((e) => {
    const h = orHide(inh, ownHide(ctx, e));
    return !(h.d && h.p);
  });
  return {
    kind: "cols",
    el: parent,
    cells: live.map((e) => cellOf(e, ctx, inh)),
    gap: null,
    hide: inh,
    layout: "inline",
    wrap: [],
  };
};

const flexColumns = (el: Element, ctx: AnalyzeCtx, inh: Hide): Cols | null => {
  const cs = sd(ctx, el);
  const d = cs.display();
  if (d !== "flex" && d !== "inline-flex") return null;
  const dir = (cs.get("flex-direction") ?? "row").trim().toLowerCase();
  const wrap = (cs.get("flex-wrap") ?? "nowrap").trim().toLowerCase();
  if (dir.startsWith("column") || wrap !== "nowrap") return null;
  const kids = Array.from(el.children).filter((c) => !SKIP_TAGS.has(c.localName) && hasVisibleContent(c));
  if (kids.length < 2) return null;
  const gapPx = cs.px("column-gap") ?? cs.px("gap");
  ctx.report.warn("flex-layout", "Flexbox rows were turned into columns. Flexbox has weak email-client support.");
  return {
    kind: "cols",
    el,
    cells: kids.map((k) => cellOf(k, ctx, inh)),
    gap: gapPx ? { px: gapPx, pct: null, els: [] } : null,
    hide: inh,
    layout: "flex",
    wrap: [],
  };
};

// ─── Tables ───────────────────────────────────────────────────────────────────

const hiddenBoth = (el: Element, ctx: AnalyzeCtx, inh: Hide): boolean => {
  const h = orHide(inh, ownHide(ctx, el));
  return h.d && h.p;
};

const analyzeTr = (tr: Element, ctx: AnalyzeCtx, inh: Hide): Item[] => {
  if (ctx.skip.has(tr)) return [];
  const h = orHide(inh, ownHide(ctx, tr));
  if (h.d && h.p) return [];
  const cells = rowCells(tr).filter((c) => !ctx.skip.has(c) && !hiddenBoth(c, ctx, h));
  if (!cells.length) return [];
  if (cells.length === 1) return absorb(tr, analyzeBlock(cells[0], ctx, h), ctx, h);

  const plan = classifyCells(cells, ctx);
  if (!plan.contents.length) return [];

  if (plan.contents.length === 1 && !plan.gap) {
    const inner = analyzeBlock(plan.contents[0], ctx, h);
    if (!inner.length) return [];
    if (!plan.edges.length) return absorb(tr, inner, ctx, h);
    const box: Box = { kind: "box", el: tr, inner, hide: h, wrap: plan.edges };
    return absorb(tr, [box], ctx, h);
  }

  const cols: Cols = {
    kind: "cols",
    el: tr,
    cells: plan.contents.map((c) => cellOf(c, ctx, h)),
    gap: plan.gap,
    hide: h,
    layout: "table",
    wrap: plan.edges,
  };
  if (rowCells(tr).some((c) => (parseLen(c.getAttribute("colspan"))?.n ?? 1) > 1)) {
    ctx.report.warn("colspan", "Cells that span several columns were treated as single columns.");
  }
  return absorb(tr, [cols], ctx, h);
};

const analyzeTableBody = (table: Element, ctx: AnalyzeCtx, inh: Hide): Item[] => {
  const out: Item[] = [];
  for (const tr of tableRows(table)) out.push(...analyzeTr(tr, ctx, inh));
  return out;
};

const analyzeTable = (table: Element, ctx: AnalyzeCtx, inh: Hide): Item[] => {
  const header =
    Array.from(table.children).some((c) => c.localName === "thead" || c.localName === "caption") ||
    tableRows(table).some((tr) => Array.from(tr.children).some((c) => c.localName === "th"));
  if (header) {
    ctx.report.fallback(
      "data-table",
      "A table with header cells was converted to rows and columns. Check that it still reads as a table.",
    );
  }
  return absorb(table, analyzeTableBody(table, ctx, inh), ctx, inh);
};

// ─── Blocks ───────────────────────────────────────────────────────────────────

const TEXT_TAGS = new Set(["p", "blockquote", "pre", "address"]);
const HEADING = /^h[1-6]$/;

const analyzeBlock = (el: Element, ctx: AnalyzeCtx, inh: Hide): Item[] => {
  if (SKIP_TAGS.has(el.localName) || ctx.skip.has(el)) return [];
  const h = orHide(inh, ownHide(ctx, el));
  if (h.d && h.p) {
    if (hasVisibleContent(el)) ctx.report.drop("hidden", "Content that is hidden on both desktop and phone was left out.");
    return [];
  }
  const tag = el.localName;

  // 1. a block on its own: image, button, link row, spacer…
  const leaf = leafFromElement(el, ctx, h);
  if (leaf === "skip") return [];
  if (leaf) return [leaf];

  // 2. tables
  if (tag === "table") return analyzeTable(el, ctx, h);

  // 3. text blocks
  if (HEADING.test(tag)) {
    const heading = textLeaf("heading", el, Array.from(el.childNodes), el, ctx, h, tag);
    return heading ? [heading] : [];
  }
  if (tag === "ul" || tag === "ol") {
    const list = listLeaf(el, ctx, h);
    return list ? [list] : [];
  }
  if (TEXT_TAGS.has(tag) && isInlineOnly(el, ctx)) {
    if (tag === "pre") ctx.report.warn("pre", "Pre-formatted text was converted to a normal paragraph; its line breaks and spacing were not kept.");
    const para = textLeaf("paragraph", el, Array.from(el.childNodes), el, ctx, h);
    return para ? [para] : [];
  }

  // 4. a block-level link with more text than a button holds
  if (tag === "a" && el.hasAttribute("href")) {
    const parent = el.parentElement ?? el;
    return absorb(el, classifyRun([el], parent, ctx, h, false), ctx, h);
  }

  // 5. a flex row
  const flex = flexColumns(el, ctx, h);
  if (flex) return absorb(el, [flex], ctx, h);

  // 6. a wrapper with only inline content is one text block
  if (isInlineOnly(el, ctx)) {
    const nodes = Array.from(el.childNodes).filter((n) => !(isElement(n) && ctx.skip.has(n)));
    return absorb(el, classifyRun(nodes, el, ctx, h, true), ctx, h);
  }

  // 7. any other wrapper
  return absorb(el, analyzeChildren(el, ctx, h), ctx, h);
};

/** The items in the children of `parent`, top to bottom. */
export const analyzeChildren = (parent: Element, ctx: AnalyzeCtx, inh: Hide = NOHIDE): Item[] => {
  const items: Item[] = [];
  const kids = Array.from(parent.childNodes);
  let run: Node[] = [];
  const hasBlock = kids.some((n) => isElement(n) && !SKIP_TAGS.has(n.localName) && !ctx.skip.has(n) && !isInlineNode(n, ctx));

  const flush = (): void => {
    if (!run.length) return;
    items.push(...classifyRun(run, parent, ctx, inh, !hasBlock));
    run = [];
  };

  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (isText(n)) {
      run.push(n);
      continue;
    }
    if (!isElement(n) || SKIP_TAGS.has(n.localName) || ctx.skip.has(n)) continue;

    if (isInlineNode(n, ctx)) {
      const h = orHide(inh, ownHide(ctx, n));
      if (h.d && h.p) {
        if (hasVisibleContent(n)) ctx.report.drop("hidden", "Content that is hidden on both desktop and phone was left out.");
        continue;
      }
      // An image (or a link around one) that only one view shows is a block of its own, so
      // the hide flag has something to sit on. Inside a line of text there is nothing to flag.
      if ((h.d || h.p) && !(inh.d || inh.p) && isImageLike(n)) {
        flush();
        items.push(...analyzeBlock(n, ctx, inh));
        continue;
      }
      run.push(n);
      continue;
    }

    flush();

    const group = columnGroupAt(kids, i, ctx);
    if (group) {
      const cols = makeInlineCols(group.els, parent, ctx, inh);
      if (cols.cells.length >= 2) items.push(cols);
      else for (const cell of cols.cells) items.push(...cell.body);
      i = group.end;
      continue;
    }

    items.push(...analyzeBlock(n, ctx, inh));
  }
  flush();
  return items;
};

/**
 * The items in a content container. A table container contributes its rows;
 * its own padding and fill belong to the canvas, not to a Box.
 */
export const analyzeContainer = (container: Element, ctx: AnalyzeCtx): Item[] => {
  if (container.localName === "table") return analyzeTableBody(container, ctx, NOHIDE);
  return analyzeChildren(container, ctx, NOHIDE);
};
