// import/map/box.ts
// ─────────────────────────────────────────────────────────────────────────────
// Layers → row and column properties
//
// A Layer (from structure/plan.ts) names the elements a row or column draws
// from. This module reads them for one view: padding summed over the spacing
// sources, the fill, the border with its radius, the shadow and the minimum
// height. Everything comes back complete and in Maildeno's value space, so two
// views can be compared key by key.
// ─────────────────────────────────────────────────────────────────────────────

import type { Border, BoxShadow, Padding } from "../../types/emailBuilder";
import type { View } from "../css/cascade";
import type { WrapPad } from "../structure/ir";
import { type Sides, type Views, declaredHeight, spacingIn } from "../structure/leaves";
import type { Layer } from "../structure/plan";
import {
  type Fill,
  padding as toPadding,
  plainBorder,
  radiusOf,
  readBorder,
  readFill,
  readShadow,
  rowBorder,
  wholePx,
} from "./values";

/** The padding a set of spacing sources adds in one view. */
export const sumPads = (v: Views, pads: WrapPad[], view: View, availW: number): Sides => {
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  for (const p of pads) {
    const cs = v.cascade.styleOf(p.el, view);
    if (p.kind === "width") {
      if (cs.isHidden()) continue;
      const len = cs.len("width");
      let w = 0;
      if (len) w = len.unit === "%" ? (len.n * availW) / 100 : (cs.px("width") ?? 0);
      if (p.left) left += w;
      if (p.right) right += w;
      continue;
    }
    const s = spacingIn(cs);
    if (p.top) top += s.top;
    if (p.right) right += s.right;
    if (p.bottom) bottom += s.bottom;
    if (p.left) left += s.left;
  }
  return { top, right, bottom, left };
};

export interface LayerRead {
  padding: Padding;
  fill: Fill;
  border: Border;
  boxShadow: BoxShadow;
  minHeight: number;
  /** What was lost, for the report. */
  lost: { partialBorder: boolean; gradient: boolean; extraLayers: boolean; extraShadow: boolean };
}

const visible = (f: Fill): boolean =>
  f.backgroundColor !== "transparent" || f.backgroundGradient.useGradient || f.backgroundImage !== "";

/** Reads a row or column layer in one view. `availW` is the width the layer sits in, for % spacers. */
export const readLayer = (v: Views, layer: Layer, view: View, availW: number): LayerRead => {
  const pads = sumPads(v, layer.spacing, view, availW);
  const paintCs = layer.paint ? v.cascade.styleOf(layer.paint, view) : null;
  const frameCs = layer.frame ? v.cascade.styleOf(layer.frame, view) : null;
  const fill = readFill(paintCs);
  // the border comes from the frame when there is one; the radius from whichever rounds the corners
  const borderCs = frameCs ?? paintCs;
  const border = borderCs ? readBorder(borderCs) : { width: 0, style: "solid", color: "#000000", partial: false };
  const radiusCs = paintCs && paintCs.radii().some((r) => r > 0) ? paintCs : borderCs;
  const shadow = readShadow(paintCs);
  let minHeight = 0;
  for (const el of layer.sizeEls) {
    const h = declaredHeight(v.cascade.styleOf(el, view));
    if (h !== null) minHeight = Math.max(minHeight, h);
  }
  return {
    padding: toPadding(pads),
    fill,
    border: rowBorder(border, radiusCs ? radiusOf(radiusCs) : 0),
    boxShadow: shadow.shadow,
    minHeight: wholePx(minHeight),
    lost: {
      partialBorder: border.partial,
      gradient: fill.gradientLost,
      extraLayers: fill.extraLayers,
      extraShadow: shadow.extra,
    },
  };
};

export { plainBorder, visible as fillVisible };
