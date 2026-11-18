// import/structure/plan.ts
// ─────────────────────────────────────────────────────────────────────────────
// Items → rows, columns and nested rows
//
// The analyzer found wrappers, column groups and blocks. This module decides
// which of those become Maildeno rows and columns, and which are merged or taken
// apart so that the result stays small and editable.
//
// Three rules do most of the work.
//
//   Merge       A wrapper that is the only thing in a row or column joins it:
//               its padding is added, and its fill is taken over when the
//               row or column has none and no padding of its own. The classic
//               padded <td> inside a padded <table> inside a <td> becomes one row.
//
//   Push down   A wrapper with padding but no fill, inside a column, is taken
//               apart. Its padding goes onto the blocks it held (left and right
//               on all of them, top on the first, bottom on the last). A
//               wrapper that is the only thing on the canvas is taken apart the
//               same way, so a template wrapped in one padded cell still
//               becomes a list of separate rows.
//
//   Nest        A wrapper with a fill that cannot be merged becomes a nested
//               row, as does a column group inside a column. Depth is capped
//               below what the exporters render.
//
// The result is a plan tree. Nothing here reads a style value: layers keep the
// elements to read from, and map/ reads them once for each view.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReportBuilder } from "../report";
import type { Box, Cell, Cols, GapInfo, Hide, Item, Leaf, WidthSpec, WrapPad } from "./ir";
import { type Views, flatFill, frameOnly, hasBorder, hasImage, hasPaint, sameFill, samePaint, spacingIn } from "./leaves";

/** The exporters stop at 5 levels of nested rows; stay under that. */
export const MAX_NESTED_DEPTH = 4;

export interface PlanCtx {
  v: Views;
  report: ReportBuilder;
}

/** The box of a row or column: what it paints, and what adds up to its padding. */
export interface Layer {
  /** The element whose fill, border, radius and shadow this layer draws. */
  paint: Element | null;
  spacing: WrapPad[];
  /** Elements whose declared height gives the layer's minimum height. */
  sizeEls: Element[];
  /**
   * An element inside `paint` that draws only the border. Maildeno writes a row's border on
   * a div within the cell that has the fill and the shadow, so the shadow is not clipped.
   */
  frame?: Element | null;
}

export interface PCol {
  layer: Layer;
  width: WidthSpec;
  /** The cell or block the column came from, for vertical alignment. Null for a lone column. */
  cell: Element | null;
  children: PChild[];
}

export interface PRow {
  kind: "row";
  layer: Layer;
  cols: PCol[];
  gap: GapInfo | null;
  layout: "table" | "inline" | "flex" | "single";
  hide: Hide;
}

/** A block of height that is a row of its own. */
export interface PSpacerRow {
  kind: "spacer-row";
  leaf: Leaf;
}

export type PChild = Leaf | PRow;
export type PTop = PRow | PSpacerRow;

const ALL = { top: true, right: true, bottom: true, left: true } as const;

const ownPad = (el: Element): WrapPad => ({ el, kind: "spacing", ...ALL });

const emptyLayer = (): Layer => ({ paint: null, spacing: [], sizeEls: [] });

const boxPaint = (box: Box, ctx: PlanCtx): Element | null => (!box.plain && hasPaint(ctx.v, box.el) ? box.el : null);

const layerOfBox = (box: Box, ctx: PlanCtx): Layer => ({
  paint: boxPaint(box, ctx),
  spacing: [ownPad(box.el), ...box.wrap],
  sizeEls: [box.el],
});

const withExtra = (layer: Layer, extra: WrapPad[]): Layer =>
  extra.length ? { ...layer, spacing: [...layer.spacing, ...extra] } : layer;

/** Whether a layer adds no spacing at all, in either view. */
const spacingIsZero = (layer: Layer, ctx: PlanCtx): boolean => {
  for (const view of [ctx.v.desktop, ctx.v.phone]) {
    for (const w of layer.spacing) {
      if (w.kind === "width") return false;
      const s = spacingIn(ctx.v.cascade.styleOf(w.el, view));
      const sum = (w.top ? s.top : 0) + (w.right ? s.right : 0) + (w.bottom ? s.bottom : 0) + (w.left ? s.left : 0);
      if (sum > 0.01) return false;
    }
  }
  return true;
};

// ─── Merge ────────────────────────────────────────────────────────────────────

/** A fill (and shadow) with a bare border inside it, nothing between them: one bordered, filled layer. */
const isFrame = (layer: Layer, inner: Box, ctx: PlanCtx): boolean => {
  const innerPaint = boxPaint(inner, ctx);
  return (
    !!layer.paint &&
    !!innerPaint &&
    !layer.frame &&
    frameOnly(ctx.v, innerPaint) &&
    !hasBorder(ctx.v, layer.paint) &&
    spacingIsZero(layer, ctx)
  );
};

const canMerge = (layer: Layer, inner: Box, ctx: PlanCtx): boolean => {
  const innerPaint = boxPaint(inner, ctx);
  if (!innerPaint) return true;
  if (layer.paint === null) return spacingIsZero(layer, ctx);
  if (isFrame(layer, inner, ctx)) return true;
  // Two layers that paint the same thing are one layer drawn twice. MJML does this on every
  // section: the same background on the outer div and on the table inside it. A plain fill
  // can take any spacing between them; a border, radius, image or shadow only sits right
  // when the outer layer adds no spacing of its own.
  if (samePaint(ctx.v, layer.paint, innerPaint) && (flatFill(ctx.v, layer.paint) || spacingIsZero(layer, ctx))) return true;
  // A plain fill of the colour the outer layer already paints under it adds nothing. MJML's
  // wrapper (a rounded, filled div around a filled table) is this: the radius stays with the outer.
  return flatFill(ctx.v, innerPaint) && sameFill(ctx.v, layer.paint, innerPaint) && !hasImage(ctx.v, layer.paint);
};

const mergeBox = (layer: Layer, inner: Box, ctx: PlanCtx): Layer => {
  const next = layerOfBox(inner, ctx);
  const frame = isFrame(layer, inner, ctx);
  return {
    paint: layer.paint ?? next.paint,
    spacing: [...layer.spacing, ...next.spacing],
    sizeEls: [...layer.sizeEls, ...next.sizeEls],
    frame: frame ? next.paint : layer.frame ?? null,
  };
};

/** Merges the single wrapper inside `items`, again and again. Returns the layer and what is left. */
const mergeChain = (layer: Layer, items: Item[], ctx: PlanCtx): { layer: Layer; items: Item[] } => {
  let cur = layer;
  let rest = items;
  for (let i = 0; i < 16; i++) {
    const only = rest.length === 1 ? rest[0] : null;
    if (only && only.kind === "box" && canMerge(cur, only, ctx)) {
      cur = mergeBox(cur, only, ctx);
      rest = only.inner;
      continue;
    }
    break;
  }
  return { layer: cur, items: rest };
};

// ─── Push down ────────────────────────────────────────────────────────────────

/**
 * Takes a wrapper apart: its spacing goes onto the items it held. A wrapper
 * with a fill keeps no fill (the caller has already decided that is acceptable).
 */
const pushDown = (box: Box, ctx: PlanCtx, keepOwn = true): Item[] => {
  const pads: WrapPad[] = [...(keepOwn ? [ownPad(box.el)] : []), ...box.wrap];
  const inner = box.inner;
  inner.forEach((item, i) => {
    const first = i === 0;
    const last = i === inner.length - 1;
    const mine = pads.map((p) => ({ ...p, top: p.top && first, bottom: p.bottom && last }));
    item.wrap.push(...mine);
  });
  void ctx;
  return inner;
};

const unwrapTop = (items: Item[], ctx: PlanCtx): Item[] => {
  let cur = items;
  for (let i = 0; i < 16; i++) {
    const only = cur.length === 1 ? cur[0] : null;
    if (!only || only.kind !== "box" || boxPaint(only, ctx)) break;
    cur = pushDown(only, ctx);
  }
  return cur;
};

// ─── Rows, columns and children ───────────────────────────────────────────────

const singleColumnRow = (children: PChild[], layer: Layer, hide: Hide): PRow => ({
  kind: "row",
  layer,
  cols: [{ layer: emptyLayer(), width: { kind: "pct", n: 100 }, cell: null, children }],
  gap: null,
  layout: "single",
  hide,
});

const colFromCell = (cell: Cell, depth: number, ctx: PlanCtx): PCol => {
  const base: Layer = {
    paint: hasPaint(ctx.v, cell.el) ? cell.el : null,
    spacing: [ownPad(cell.el)],
    sizeEls: [],
  };
  const merged = mergeChain(base, cell.body, ctx);
  return {
    layer: merged.layer,
    width: cell.width,
    cell: cell.el,
    children: childrenFromItems(merged.items, depth, ctx),
  };
};

const rowFromCols = (cols: Cols, layer: Layer, depth: number, ctx: PlanCtx): PRow => ({
  kind: "row",
  layer: withExtra(layer, cols.wrap),
  cols: cols.cells.map((cell) => colFromCell(cell, depth, ctx)),
  gap: cols.gap,
  layout: cols.layout,
  hide: cols.hide,
});

const rowFromBox = (box: Box, depth: number, ctx: PlanCtx): PRow => {
  const merged = mergeChain(layerOfBox(box, ctx), box.inner, ctx);
  const only = merged.items.length === 1 ? merged.items[0] : null;
  if (only && only.kind === "cols") return rowFromCols(only, merged.layer, depth, ctx);
  // One block alone in a painted row: the spacing between the row's fill and the block is the row's
  // padding (a block carries wrapper spacing only when nothing around it is a layer of its own).
  if (only && only.kind === "leaf" && merged.layer.paint && only.wrap.length) {
    const layer: Layer = { ...merged.layer, spacing: [...merged.layer.spacing, ...only.wrap] };
    only.wrap = [];
    return singleColumnRow(childrenFromItems(merged.items, depth, ctx), layer, box.hide);
  }
  return singleColumnRow(childrenFromItems(merged.items, depth, ctx), merged.layer, box.hide);
};

/** The children of a column (or a lone column) in a row at `depth`. */
const childrenFromItems = (items: Item[], depth: number, ctx: PlanCtx): PChild[] => {
  const out: PChild[] = [];
  for (const item of items) {
    if (item.kind === "leaf") {
      out.push(item);
      continue;
    }
    if (item.kind === "box" && !boxPaint(item, ctx)) {
      out.push(...childrenFromItems(pushDown(item, ctx), depth, ctx));
      continue;
    }
    if (depth + 1 > MAX_NESTED_DEPTH) {
      if (item.kind === "box") {
        ctx.report.warn("depth", "Layers nested more than four deep were flattened; the innermost fills and borders were dropped.");
        out.push(...childrenFromItems(pushDown(item, ctx), depth, ctx));
      } else {
        ctx.report.warn("depth", "Columns nested more than four deep were stacked into one column.");
        for (const cell of item.cells) {
          const pads: WrapPad[] = [ownPad(cell.el), ...item.wrap];
          cell.body.forEach((b, i) => {
            b.wrap.push(...pads.map((p) => ({ ...p, top: p.top && i === 0, bottom: p.bottom && i === cell.body.length - 1 })));
          });
          out.push(...childrenFromItems(cell.body, depth, ctx));
        }
      }
      continue;
    }
    out.push(item.kind === "box" ? rowFromBox(item, depth + 1, ctx) : rowFromCols(item, emptyLayer(), depth + 1, ctx));
  }
  return out;
};

// ─── Entry point ──────────────────────────────────────────────────────────────

/** The top-level rows for the content container's items. */
export const planRows = (items: Item[], ctx: PlanCtx): PTop[] => {
  const out: PTop[] = [];
  for (const item of unwrapTop(items, ctx)) {
    if (item.kind === "leaf") {
      if (item.type === "spacer" && !item.hide.d && !item.hide.p) out.push({ kind: "spacer-row", leaf: item });
      else if (item.ownWrapper && item.own) {
        // On the canvas a filled wrapper around one text block is a row with a background, not a
        // text block that carries it: the row is what the editor offers background controls on.
        const el = item.own;
        item.own = null;
        item.ownWrapper = false;
        out.push(singleColumnRow([item], { paint: el, spacing: [ownPad(el)], sizeEls: [el] }, item.hide));
      } else out.push(singleColumnRow([item], emptyLayer(), item.hide));
    } else if (item.kind === "cols") {
      out.push(rowFromCols(item, emptyLayer(), 0, ctx));
    } else {
      out.push(rowFromBox(item, 0, ctx));
    }
  }
  return out;
};
