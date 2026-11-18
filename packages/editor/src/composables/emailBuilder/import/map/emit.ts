// import/map/emit.ts
// ─────────────────────────────────────────────────────────────────────────────
// Plan → Maildeno nodes
//
// Walks the plan tree and writes rows, columns, row-spacers and components.
// Each node is read twice, once in the desktop view and once in the phone view,
// and the phone values that differ become its `mobile` overrides. Along the way
// it keeps track of how much room each node has in each view, because widths of
// images and columns are stored as percentages and every percentage needs a
// basis.
//
//   room(canvas)   = canvas width on desktop; the phone viewport minus the
//                    canvas padding on a phone
//   room(row)      = room - the row's padding and border
//   room(column)   = (row room - gaps) × the column's share, or the whole row
//                    room on a phone when the row stacks
//
// Nothing here guesses at defaults: every node carries every visual property.
// ─────────────────────────────────────────────────────────────────────────────

import { createDefaultVisibility } from "../../core/config/componentConfig";
import { normalizeWidths } from "../../core/columnWidths";
import type { CanvasChild, CanvasColumn, CanvasComponentNode, CanvasRowNode, CanvasSpacerNode } from "../../types/emailBuilder";
import type { View } from "../css/cascade";
import { ReportBuilder } from "../report";
import type { WidthSpec } from "../structure/ir";
import { measureChain } from "../structure/leaves";
import type { PChild, PCol, PRow, PSpacerRow, PTop } from "../structure/plan";
import { type Dim, type MapCtx, type Which, readLeafProps } from "./blocks";
import { type LayerRead, readLayer } from "./box";
import { COLUMN_MOBILE_KEYS, MOBILE_KEYS, ROW_MOBILE_KEYS, SPACER_MOBILE_KEYS, diffKeys } from "./diff";
import { verticalAlignOf, wholePx } from "./values";

export interface EmitStats {
  rows: number;
  columns: number;
  nestedRows: number;
  components: number;
  byType: Record<string, number>;
  nodesWithOverrides: number;
  stackedRows: number;
  mobileHidden: number;
  desktopHidden: number;
  /** Mobile keys written, by name. */
  keys: Record<string, number>;
}

export const newStats = (): EmitStats => ({
  rows: 0,
  columns: 0,
  nestedRows: 0,
  components: 0,
  byType: {},
  nodesWithOverrides: 0,
  stackedRows: 0,
  mobileHidden: 0,
  desktopHidden: 0,
  keys: {},
});

export interface EmitCtx extends MapCtx {
  newId: () => string;
  stats: EmitStats;
  /**
   * What a gap cell's percentage is a percentage of. Maildeno's exporter writes
   * a gap as gap / mobileBreakpoint, not as a share of the row, so reading its
   * own output back needs the same basis. Null reads a share of the row.
   */
  gapBasis: number | null;
}

/** Four characters for a row name. The end of an id, which is where a counter changes. */
const hex4 = (ctx: EmitCtx): string => ctx.newId().slice(-4);

const room = (n: number): number => Math.max(0, n);

const noteOverrides = (ctx: EmitCtx, mobile: Record<string, unknown>): void => {
  const keys = Object.keys(mobile);
  if (!keys.length) return;
  ctx.stats.nodesWithOverrides++;
  for (const k of keys) ctx.stats.keys[k] = (ctx.stats.keys[k] ?? 0) + 1;
};

const rangeOf = (read: LayerRead) => read.padding.left + read.padding.right + 2 * read.border.width;

const reportLoss = (read: LayerRead, ctx: EmitCtx): void => {
  if (read.lost.partialBorder) {
    ctx.report.drop("border-partial", "Borders on only some sides (or with different sides) cannot be reproduced and were left out.");
  }
  if (read.lost.gradient) ctx.report.drop("gradient", "A gradient that could not be read was replaced by its solid colour.");
  if (read.lost.extraLayers) ctx.report.drop("bg-layers", "Only the first background image or gradient of an element was kept.");
  if (read.lost.extraShadow) ctx.report.drop("shadow-layers", "Only the first layer of a multi-layer shadow was kept.");
};

// ─── Components ───────────────────────────────────────────────────────────────

/** Differences between the views that no `mobile` key can hold, for the report. */
const noteUnsupported = (leaf: Extract<PChild, { kind: "leaf" }>, ctx: EmitCtx): void => {
  if (leaf.type === "button") {
    // a button that fills the width of a phone: Maildeno buttons are as wide as their text and padding
    const fullWidth = (el: Element, view: View): boolean => {
      const cs = ctx.v.cascade.styleOf(el, view);
      const w = cs.len("width");
      return cs.display() === "block" || (!!w && w.unit === "%" && w.n >= 90);
    };
    const parts = [...(leaf.shell ?? []), ...(leaf.link ? [leaf.link] : [])];
    if (parts.some((e) => fullWidth(e, ctx.v.phone)) && !parts.some((e) => fullWidth(e, ctx.v.desktop))) {
      ctx.report.drop(
        "mobile-unsupported-button-width",
        "A button that becomes full width on a phone keeps its normal width: Maildeno buttons have no full-width setting.",
      );
    }
  }
  const el = leaf.own ?? leaf.link ?? leaf.text;
  if (!el) return;
  const d = ctx.v.cascade.styleOf(el, ctx.v.desktop);
  const p = ctx.v.cascade.styleOf(el, ctx.v.phone);
  for (const prop of ["float", "position", "text-indent"]) {
    const a = (d.get(prop) ?? "").trim().toLowerCase();
    const b = (p.get(prop) ?? "").trim().toLowerCase();
    if (a !== b) {
      ctx.report.drop(`mobile-unsupported-${prop}`, `A phone-only change of ${prop} has no Maildeno equivalent and was left out.`);
    }
  }
};

/** The same context with a report nobody reads, for the second read of a node, so nothing is counted twice. */
const muted = (ctx: EmitCtx): EmitCtx => ({ ...ctx, report: new ReportBuilder() });

const emitComponent = (leaf: Extract<PChild, { kind: "leaf" }>, avail: Dim, ctx: EmitCtx): CanvasComponentNode => {
  const base: Which = leaf.hide.d && !leaf.hide.p ? "p" : "d";
  const props = readLeafProps(leaf, ctx, base, avail, true);
  let mobile: Record<string, unknown> = {};
  if (!leaf.hide.d && !leaf.hide.p) {
    const phone = readLeafProps(leaf, muted(ctx), "p", avail, false);
    mobile = diffKeys(MOBILE_KEYS[leaf.type], props, phone);
    noteUnsupported(leaf, ctx);
  }
  noteOverrides(ctx, mobile);
  ctx.stats.components++;
  ctx.stats.byType[leaf.type] = (ctx.stats.byType[leaf.type] ?? 0) + 1;
  if (leaf.hide.p) ctx.stats.mobileHidden++;
  if (leaf.hide.d) ctx.stats.desktopHidden++;
  return {
    id: ctx.newId(),
    type: "component",
    componentType: leaf.type,
    props: {
      ...props,
      visibility: createDefaultVisibility(),
      desktopHide: leaf.hide.d,
      mobileHide: leaf.hide.p,
      ...(Object.keys(mobile).length ? { mobile } : {}),
    },
  };
};

// ─── Columns ──────────────────────────────────────────────────────────────────

const weightsOf = (specs: WidthSpec[], rowW: number, gapTotal: number): number[] => {
  const known = specs.map((s) => (s.kind === "pct" ? (s.n * rowW) / 100 : s.kind === "px" ? s.n : null));
  const sum = known.reduce<number>((a, b) => a + (b ?? 0), 0);
  const autos = known.filter((k) => k === null).length;
  let each = 0;
  if (autos) {
    const remaining = rowW - gapTotal - sum;
    each = remaining > 1 ? remaining / autos : sum > 0 ? sum / Math.max(1, specs.length - autos) : 1;
  }
  return normalizeWidths(known.map((k) => k ?? each));
};

/** The elements a layer is made of: what it paints, what gives it padding, what gives it height. */
const layerElements = (layer: PCol["layer"]): Element[] => {
  const out: Element[] = [];
  if (layer.paint) out.push(layer.paint);
  if (layer.frame) out.push(layer.frame);
  for (const w of layer.spacing) out.push(w.el);
  out.push(...layer.sizeEls);
  return out;
};

const emitColumn = (
  col: PCol,
  index: number,
  width: number,
  colRoom: Dim,
  depth: number,
  ctx: EmitCtx,
  idBase: string,
  rowStop: readonly Element[],
): CanvasColumn => {
  const d = readLayer(ctx.v, col.layer, ctx.v.desktop, colRoom.d);
  const p = readLayer(ctx.v, col.layer, ctx.v.phone, colRoom.p);
  reportLoss(d, ctx);
  const inner: Dim = { d: room(colRoom.d - rangeOf(d)), p: room(colRoom.p - rangeOf(p)) };

  const vaD = col.cell ? verticalAlignOf(ctx.v.cascade.styleOf(col.cell, ctx.v.desktop)) : "top";
  const vaP = col.cell ? verticalAlignOf(ctx.v.cascade.styleOf(col.cell, ctx.v.phone)) : "top";
  const fields = (r: LayerRead, va: string) => ({
    backgroundColor: r.fill.backgroundColor,
    backgroundGradient: r.fill.backgroundGradient,
    padding: r.padding,
    border: r.border,
    boxShadow: r.boxShadow,
    verticalAlign: va,
  });
  const mobile = diffKeys(COLUMN_MOBILE_KEYS, fields(d, vaD), fields(p, vaP));
  noteOverrides(ctx, mobile);

  const stop = new Set<Element>([...rowStop, ...layerElements(col.layer), ...(col.cell ? [col.cell] : [])]);
  const inside: EmitCtx = { ...ctx, stop };
  const children: CanvasChild[] = col.children.map((child) =>
    child.kind === "leaf" ? emitComponent(child, inner, inside) : emitRow(child, inner, depth + 1, inside),
  );
  ctx.stats.columns++;
  return {
    id: `${idBase}-${index}`,
    width,
    children,
    backgroundColor: d.fill.backgroundColor,
    backgroundGradient: d.fill.backgroundGradient,
    backgroundImage: d.fill.backgroundImage,
    backgroundSize: d.fill.backgroundSize,
    backgroundPosition: d.fill.backgroundPosition,
    backgroundRepeat: d.fill.backgroundRepeat,
    padding: d.padding,
    border: d.border,
    boxShadow: d.boxShadow,
    verticalAlign: vaD as CanvasColumn["verticalAlign"],
    ...(Object.keys(mobile).length ? { mobile } : {}),
  };
};

// ─── Stacking and gaps ────────────────────────────────────────────────────────

/** Whether one cell ends up full width on its own line in the phone view. */
const widthOf = (el: Element, ctx: EmitCtx, roomW: number): number | null => {
  const cs = ctx.v.cascade.styleOf(el, ctx.v.phone);
  let eff = Number.POSITIVE_INFINITY;
  const w = cs.len("width");
  if (w) eff = w.unit === "%" ? (w.n * roomW) / 100 : (cs.px("width") ?? Number.POSITIVE_INFINITY);
  const mw = cs.len("max-width");
  if (mw) {
    const m = mw.unit === "%" ? (mw.n * roomW) / 100 : cs.px("max-width");
    if (m !== null) eff = Math.min(eff, m);
  }
  return Number.isFinite(eff) ? eff : null;
};

interface Verdict {
  stack: boolean;
  mixed: boolean;
}

const stackVerdict = (row: PRow, phoneRoom: number, ctx: EmitCtx): Verdict => {
  if (row.cols.length < 2) return { stack: true, mixed: false };
  const cells = row.cols.map((c) => c.cell).filter((c): c is Element => c !== null);
  if (!cells.length) return { stack: true, mixed: false };

  const verdicts: boolean[] = [];
  let inlineSum = 0;
  let inlineCount = 0;
  for (const el of cells) {
    // a flex row stays a row on a phone unless it wraps or turns into a column
    const parent = el.parentElement ? ctx.v.cascade.styleOf(el.parentElement, ctx.v.phone) : null;
    if (parent && (parent.display() === "flex" || parent.display() === "inline-flex")) {
      const dir = (parent.get("flex-direction") ?? "row").trim().toLowerCase();
      const wrap = (parent.get("flex-wrap") ?? "nowrap").trim().toLowerCase();
      verdicts.push(dir.startsWith("column") || wrap !== "nowrap");
      continue;
    }
    const cs = ctx.v.cascade.styleOf(el, ctx.v.phone);
    const d = cs.display();
    const float = (cs.get("float") ?? "none").trim().toLowerCase();
    const w = widthOf(el, ctx, phoneRoom);
    const full = w === null ? null : w >= phoneRoom - 4;
    if (d === "table-cell") verdicts.push(false);
    else if (float === "left" || float === "right") verdicts.push(full === true);
    else if (d === "inline-block" || d === "inline-table") {
      inlineCount++;
      inlineSum += w ?? phoneRoom;
      verdicts.push(false); // decided by the sum below
    } else verdicts.push(full === null ? true : full);
  }
  if (inlineCount > 0) {
    const wraps = inlineSum > phoneRoom + 1;
    cells.forEach((el, i) => {
      const d = ctx.v.cascade.styleOf(el, ctx.v.phone).display();
      if (d === "inline-block" || d === "inline-table") verdicts[i] = wraps;
    });
  }
  const n = verdicts.filter(Boolean).length;
  return { stack: n * 2 >= verdicts.length && n > 0, mixed: n > 0 && n < verdicts.length };
};

const desktopGap = (row: PRow, rowW: number, ctx: EmitCtx): number => {
  if (!row.gap || row.cols.length < 2) return 0;
  const basis = ctx.gapBasis ?? rowW;
  const px = row.gap.px ?? (row.gap.pct !== null ? (row.gap.pct * basis) / 100 : 0);
  return Math.min(200, wholePx(px));
};

/** The vertical gap between stacked columns on a phone, from what the gap cells do there. */
const phoneGap = (row: PRow, ctx: EmitCtx): number | null => {
  if (!row.gap || !row.gap.els.length) return null;
  const el = row.gap.els[0];
  const cs = ctx.v.cascade.styleOf(el, ctx.v.phone);
  if (cs.isHidden()) return 0;
  if (cs.display() !== "block") return 0;
  const m = measureChain(ctx.v, [el], ctx.v.phone);
  return wholePx(m.inner + m.vertical);
};

// ─── Rows ─────────────────────────────────────────────────────────────────────

const emitRow = (row: PRow, avail: Dim, depth: number, ctx: EmitCtx): CanvasRowNode => {
  const d = readLayer(ctx.v, row.layer, ctx.v.desktop, avail.d);
  const p = readLayer(ctx.v, row.layer, ctx.v.phone, avail.p);
  reportLoss(d, ctx);
  const inner: Dim = { d: room(avail.d - rangeOf(d)), p: room(avail.p - rangeOf(p)) };

  const n = row.cols.length;
  const gapD = desktopGap(row, inner.d, ctx);
  const verdict = stackVerdict(row, inner.p, ctx);
  const stack = n < 2 ? true : verdict.stack;
  if (n >= 2 && verdict.mixed) {
    ctx.report.warn("stack-mixed", "In some rows only some of the columns stack on a phone. The majority decided whether the row stacks.");
  }
  if (n >= 2) {
    if (stack) ctx.stats.stackedRows++;
    else if (row.layout !== "single") {
      ctx.report.warn(
        "no-stack",
        "Some rows keep their columns side by side on a phone, the way the source does. Turn on Stack on mobile if you want them stacked.",
      );
    }
  }
  const gapP = stack ? (phoneGap(row, ctx) ?? gapD) : gapD;

  const widths = n === 1 ? [100] : weightsOf(row.cols.map((c) => c.width), inner.d, gapD * (n - 1));
  const idBase = ctx.newId();
  const columns = row.cols.map((col, i) => {
    const share = widths[i] / 100;
    const colRoom: Dim = {
      d: room((inner.d - gapD * (n - 1)) * share),
      p: stack ? inner.p : room((inner.p - gapD * (n - 1)) * share),
    };
    return emitColumn(col, i, widths[i], colRoom, depth, ctx, idBase, layerElements(row.layer));
  });

  // a column with nothing left to show keeps its width
  const goneOn = (c: CanvasColumn, flag: "desktopHide" | "mobileHide"): boolean =>
    c.children.length > 0 && c.children.every((k) => k.type === "component" && (k.props as Record<string, unknown>)[flag] === true);
  if (n >= 2 && columns.some((c) => goneOn(c, "desktopHide"))) {
    ctx.report.warn("column-hidden", "A column whose blocks are all hidden on desktop keeps its width there.");
  }
  if (n >= 2 && !stack && columns.some((c) => goneOn(c, "mobileHide"))) {
    ctx.report.warn(
      "column-hidden",
      "A column whose blocks are all hidden on a phone keeps its width when the row does not stack. Turn on Stack on mobile to let the other columns fill the row.",
    );
  }

  const fields = (r: LayerRead, gap: number) => ({
    backgroundColor: r.fill.backgroundColor,
    backgroundGradient: r.fill.backgroundGradient,
    padding: r.padding,
    border: r.border,
    boxShadow: r.boxShadow,
    minHeight: r.minHeight,
    gap,
  });
  const mobile = diffKeys(ROW_MOBILE_KEYS, fields(d, gapD), fields(p, gapP));
  noteOverrides(ctx, mobile);

  // what is left of a hidden row: its own paint, padding or height
  const leftover = (r: LayerRead): boolean =>
    r.padding.top + r.padding.right + r.padding.bottom + r.padding.left > 0 ||
    r.minHeight > 0 ||
    r.border.width > 0 ||
    r.fill.backgroundColor !== "transparent" ||
    r.fill.backgroundGradient.useGradient ||
    r.fill.backgroundImage !== "";
  if ((row.hide.d && leftover(d)) || (row.hide.p && leftover(p))) {
    ctx.report.warn(
      "row-hidden",
      "A row that is hidden on desktop or on a phone has its blocks hidden, but its background and padding stay: rows have no hide switch.",
    );
  }

  if (depth === 0) ctx.stats.rows++;
  else ctx.stats.nestedRows++;
  return {
    id: idBase,
    type: "row",
    name: depth === 0 ? `row_${hex4(ctx)}` : `nested_row_${hex4(ctx)}`,
    columns,
    backgroundColor: d.fill.backgroundColor,
    backgroundGradient: d.fill.backgroundGradient,
    backgroundImage: d.fill.backgroundImage,
    backgroundSize: d.fill.backgroundSize,
    backgroundPosition: d.fill.backgroundPosition,
    backgroundRepeat: d.fill.backgroundRepeat,
    padding: d.padding,
    border: d.border,
    boxShadow: d.boxShadow,
    minHeight: d.minHeight,
    gap: gapD,
    mobileStack: stack,
    visibility: createDefaultVisibility(),
    ...(Object.keys(mobile).length ? { mobile } : {}),
  };
};

const emitSpacerRow = (row: PSpacerRow, avail: Dim, ctx: EmitCtx): CanvasSpacerNode => {
  const d = readLeafProps(row.leaf, ctx, "d", avail, true);
  const p = readLeafProps(row.leaf, muted(ctx), "p", avail, false);
  const mobile = diffKeys(SPACER_MOBILE_KEYS, d, p);
  noteOverrides(ctx, mobile);
  ctx.stats.rows++;
  return {
    id: ctx.newId(),
    type: "row-spacer",
    name: `spacer_${hex4(ctx)}`,
    height: d.height as number,
    backgroundColor: d.backgroundColor as string,
    backgroundGradient: d.backgroundGradient as CanvasSpacerNode["backgroundGradient"],
    visibility: createDefaultVisibility(),
    ...(Object.keys(mobile).length ? { mobile } : {}),
  };
};

/** The top-level rows of the canvas. `avail` is the room inside the canvas in each view. */
export const emitRows = (plan: PTop[], avail: Dim, ctx: EmitCtx): Array<CanvasRowNode | CanvasSpacerNode> =>
  plan.map((top) => (top.kind === "spacer-row" ? emitSpacerRow(top, avail, ctx) : emitRow(top, avail, 0, ctx)));

