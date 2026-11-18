// import/structure/canvas.ts
// ─────────────────────────────────────────────────────────────────────────────
// The canvas: everything around and above the rows
//
// An email is a page background, perhaps some outer tables that centre things,
// and a content container of a fixed width. This module finds the container and
// reads what belongs to the canvas instead of to a row:
//
//   width              the container's width or max-width
//   backgroundColor    the container's fill
//   bodyBackground*    the page behind it: body, html, or an outer full-width table
//   padding            the padding of the outer wrappers (Maildeno writes the
//                      canvas padding on the cell that centres the container)
//   preheaderText      the first hidden block of text
//
// The container is the first element on the way down whose width is fixed in
// pixels. When several sections each carry the same fixed width (MJML), their
// parent is the container and that width is the canvas width.
// ─────────────────────────────────────────────────────────────────────────────

import type { Rgba } from "../../core/cssColor";
import { normalizePosition, normalizeRepeat, normalizeSize, urlOf } from "../css/background";
import { colorToString, compositeOver } from "../css/values";
import type { ReportBuilder } from "../report";
import { SKIP_TAGS, elementChildren, hasVisibleContent, isBlankText, isText, normText, rowCells, tableRows } from "./dom";
import { type Views, hasPaint, isInvisible, isTrackingPixel, spacingIn } from "./leaves";

export interface CanvasDraft {
  container: Element;
  width: number;
  backgroundColor: string;
  bodyBackgroundColor: string;
  bodyBackgroundImage: string;
  bodyBackgroundSize: string;
  bodyBackgroundPosition: string;
  bodyBackgroundRepeat: string;
  padding: { top: number; right: number; bottom: number; left: number };
  preheaderText: string;
  /** The preheader element, to be passed over by the analyzer. */
  preheaderEl: Element | null;
}

export const MIN_CANVAS_WIDTH = 360;
export const MAX_CANVAS_WIDTH = 720;
export const DEFAULT_CANVAS_WIDTH = 600;

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

// ─── Preheader ────────────────────────────────────────────────────────────────

/**
 * The first hidden block of text before any visible text. Preheaders are
 * hidden with display:none, or with max-height:0 and clipping, or with zero
 * opacity and no size, and they are hidden on a phone too. Maildeno's own export follows the text with filler
 * characters; those collapse away with the whitespace.
 */
const findPreheader = (body: Element, v: Views): { el: Element; text: string } | null => {
  let found: { el: Element; text: string } | null = null;
  const visit = (el: Element): boolean => {
    if (SKIP_TAGS.has(el.localName)) return false;
    const cs = v.cascade.styleOf(el, v.desktop);
    if (isInvisible(cs)) {
      // Hidden in both views. Text that a phone shows (display:none only on desktop) is a block
      // with a desktop-hide flag, not a preheader.
      if (!isInvisible(v.cascade.styleOf(el, v.phone))) return false;
      const text = normText(el.textContent ?? "");
      if (text) {
        found = { el, text };
        return true;
      }
      return false;
    }
    for (const n of Array.from(el.childNodes)) if (isText(n) && !isBlankText(n.data)) return true;
    if (el.localName === "img" || el.localName === "video") return true;
    for (const child of Array.from(el.children)) if (visit(child)) return true;
    return false;
  };
  visit(body);
  return found;
};

// ─── Width ────────────────────────────────────────────────────────────────────

/** A width fixed in px by `width` or `max-width`; null for percentages and for nothing. */
const fixedWidth = (el: Element, v: Views): number | null => {
  const cs = v.cascade.styleOf(el, v.desktop);
  const found: number[] = [];
  for (const prop of ["width", "max-width"]) {
    const len = cs.len(prop);
    if (len && len.unit !== "%") {
      const px = cs.px(prop);
      if (px !== null && px > 0) found.push(px);
    }
  }
  return found.length ? Math.min(...found) : null;
};

const countsAsContent = (el: Element, v: Views): boolean => {
  if (SKIP_TAGS.has(el.localName)) return false;
  const cs = v.cascade.styleOf(el, v.desktop);
  if (isInvisible(cs)) return false;
  if (el.localName === "img" && isTrackingPixel(el, cs)) return false;
  if (hasVisibleContent(el) || hasPaint(v, el)) return true;
  return (cs.px("height") ?? 0) > 0 || (cs.px("min-height") ?? 0) > 0;
};

/**
 * What the container can be: a wrapper. A heading, list, image, link or paragraph that is
 * the only thing in the page is content, never the box the content sits in.
 */
const CONTAINER_TAGS = new Set(["div", "table", "td", "th", "center", "section", "article", "main", "header", "footer", "aside", "nav", "font", "form"]);

/** The one element a wrapper holds, stepping through a single-cell table. Null when there are several. */
const singleChild = (el: Element, v: Views, skip: Set<Element>): Element | null => {
  if (el.localName === "table") {
    const rows = tableRows(el).filter((r) => !isInvisible(v.cascade.styleOf(r, v.desktop)));
    if (rows.length !== 1) return null;
    const cells = rowCells(rows[0]).filter((c) => !isInvisible(v.cascade.styleOf(c, v.desktop)));
    return cells.length === 1 ? cells[0] : null;
  }
  if (Array.from(el.childNodes).some((n) => isText(n) && !isBlankText(n.data))) return null;
  const kids = elementChildren(el).filter((k) => !skip.has(k) && countsAsContent(k, v));
  return kids.length === 1 ? kids[0] : null;
};

// ─── Background ───────────────────────────────────────────────────────────────

interface PageBackground {
  color: Rgba | null;
  image: string;
  size: string;
  position: string;
  repeat: string;
}

const backgroundOf = (el: Element, v: Views): PageBackground | null => {
  const cs = v.cascade.styleOf(el, v.desktop);
  const color = cs.color("background-color");
  const image = urlOf(cs.get("background-image"));
  const hasColor = !!color && color.a > 0.01;
  if (!hasColor && !image) return null;
  return {
    color: hasColor ? color : null,
    image,
    // an image the source gives no size, position or repeat for is drawn with the CSS initial values
    size: normalizeSize(cs.get("background-size"), "auto"),
    position: normalizePosition(cs.get("background-position"), "left top"),
    repeat: normalizeRepeat(cs.get("background-repeat"), "repeat"),
  };
};

// ─── The canvas ───────────────────────────────────────────────────────────────

export const findCanvas = (doc: Document, v: Views, report: ReportBuilder): CanvasDraft => {
  const body = doc.body ?? doc.documentElement;
  const html = doc.documentElement;

  const preheader = findPreheader(body, v);
  const skip = new Set<Element>(preheader ? [preheader.el] : []);

  // walk down the single-child chain to the first fixed width
  let cur: Element = body;
  const outer: Element[] = [];
  let container: Element = body;
  let width: number | null = null;
  for (let i = 0; i < 24; i++) {
    const w = fixedWidth(cur, v);
    if (w !== null) {
      container = cur;
      width = w;
      break;
    }
    const next = singleChild(cur, v, skip);
    if (!next || !CONTAINER_TAGS.has(next.localName)) {
      container = cur;
      break;
    }
    outer.push(cur);
    cur = next;
  }

  // several sections that each carry the same fixed width: that is the canvas width
  if (width === null) {
    const kids = elementChildren(container).filter((k) => !skip.has(k) && countsAsContent(k, v));
    const widths = kids.map((k) => fixedWidth(k, v));
    // sections, not an image or a button that happens to have a width
    if (kids.length >= 1 && kids.every((k) => CONTAINER_TAGS.has(k.localName)) && widths.every((w) => w !== null && Math.abs(w - (widths[0] as number)) < 1)) {
      width = widths[0];
    }
  }

  let canvasWidth = width ?? DEFAULT_CANVAS_WIDTH;
  if (width === null) {
    report.warn("canvas-width", `No fixed content width was found, so the canvas is ${DEFAULT_CANVAS_WIDTH}px wide.`);
  } else if (canvasWidth < MIN_CANVAS_WIDTH || canvasWidth > MAX_CANVAS_WIDTH) {
    const clamped = Math.min(MAX_CANVAS_WIDTH, Math.max(MIN_CANVAS_WIDTH, canvasWidth));
    report.warn(
      "canvas-width",
      `The content is ${Math.round(canvasWidth)}px wide; the editor allows ${MIN_CANVAS_WIDTH} to ${MAX_CANVAS_WIDTH}px, so ${clamped}px was used.`,
    );
    canvasWidth = clamped;
  }
  canvasWidth = Math.round(canvasWidth);

  // the page behind: html, body, then the outer wrappers
  const page =
    [html, body, ...outer].map((el) => backgroundOf(el, v)).find((bg): bg is PageBackground => bg !== null) ?? null;
  const pageColor = page?.color ? compositeOver(page.color, WHITE) : WHITE;

  // the container's own fill, composited over the page
  const own = container === body || container === html ? null : backgroundOf(container, v);
  const containerColor = own?.color ? compositeOver(own.color, pageColor) : pageColor;
  if (own?.image) report.drop("container-image", "A background image on the content container was left out; the canvas keeps its page image only.");
  if (container !== body && container !== html) {
    const cs = v.cascade.styleOf(container, v.desktop);
    const rounded = cs.radii().some((r) => r > 0);
    const shadow = (cs.get("box-shadow") ?? "none").trim().toLowerCase() !== "none";
    const bordered = (["top", "right", "bottom", "left"] as const).some((s) => cs.border(s).width > 0);
    if (rounded || shadow || bordered) {
      report.drop("container-box", "A border, radius or shadow on the content container was left out. The canvas has none; put it on a row instead.");
    }
  }

  // padding from the wrappers outside the container
  const padding = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const el of outer) {
    const s = spacingIn(v.cascade.styleOf(el, v.desktop));
    padding.top += s.top;
    padding.right += s.right;
    padding.bottom += s.bottom;
    padding.left += s.left;
  }
  for (const side of ["top", "right", "bottom", "left"] as const) padding[side] = Math.round(Math.max(0, padding[side]));

  return {
    container,
    width: canvasWidth,
    backgroundColor: colorToString(containerColor),
    bodyBackgroundColor: colorToString(pageColor),
    // size, position and repeat only mean something with an image; the editor resets them without one
    bodyBackgroundImage: page?.image ?? "",
    bodyBackgroundSize: page?.image ? page.size : "cover",
    bodyBackgroundPosition: page?.image ? page.position : "center center",
    bodyBackgroundRepeat: page?.image ? page.repeat : "no-repeat",
    padding,
    preheaderText: preheader?.text ?? "",
    preheaderEl: preheader?.el ?? null,
  };
};

