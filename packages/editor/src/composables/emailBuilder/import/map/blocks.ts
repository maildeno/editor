// import/map/blocks.ts
// ─────────────────────────────────────────────────────────────────────────────
// Leaf → the props of one Maildeno block, for one view
//
// readLeafProps returns the complete prop set of the block's type, read from
// the desktop view or from the phone view. The emitter reads both and keeps the
// phone values that differ as the block's `mobile` overrides, so the two reads
// have to agree on everything that does not change: every property is written
// explicitly, in the same units, in the same shape.
//
// Spacing follows where Maildeno's exporter puts it. Text blocks, images,
// videos, menus and socials keep outside spacing in `padding`; buttons,
// anchors and dividers keep it in `margin`, which is the only outside spacing
// they have. A text block that paints its own background keeps outside spacing
// in `margin` so the fill stays where it was.
// ─────────────────────────────────────────────────────────────────────────────

import type { ElStyle, View } from "../css/cascade";
import { parseLen } from "../css/values";
import type { ReportBuilder } from "../report";
import { isBlankText, isElement, isText } from "../structure/dom";
import type { Leaf } from "../structure/ir";
import { type Sides, type Views, declaredHeight, innermostText, marginOf, measureChain, paddingOf, socialName, spacingIn } from "../structure/leaves";
import { toListHtml, toRichText } from "../structure/richtext";
import { sumPads } from "./box";
import { altText, linkUrl, mediaUrl, plainProp } from "./urls";
import {
  NO_FILL,
  ZERO_SIDES,
  addSides,
  blockAlign,
  buttonWeight,
  padding as toPadding,
  plainBorder,
  radiusOf,
  readBorder,
  readFill,
  readShadow,
  solidFill,
  typography,
  wholePx,
  type Fill,
} from "./values";

export interface MapCtx {
  v: Views;
  report: ReportBuilder;
  /** Font families that are not common web fonts, for the report. */
  fonts: Set<string>;
  /**
   * The elements that make up the column and row the block sits in. Width
   * resolution stops there, because the room it starts from is already inside them.
   */
  stop?: ReadonlySet<Element>;
}

export type Which = "d" | "p";

/** A width per view. */
export interface Dim {
  d: number;
  p: number;
}

export const viewOf = (ctx: MapCtx, which: Which): View => (which === "d" ? ctx.v.desktop : ctx.v.phone);

const st = (ctx: MapCtx, el: Element, which: Which): ElStyle => ctx.v.cascade.styleOf(el, viewOf(ctx, which));

const fillVisible = (f: Fill): boolean =>
  f.backgroundColor !== "transparent" || f.backgroundGradient.useGradient || f.backgroundImage !== "";

// ─── Spacing ──────────────────────────────────────────────────────────────────

const ownMargin = (leaf: Leaf, ctx: MapCtx, which: Which): Sides =>
  leaf.own ? marginOf(st(ctx, leaf.own, which)) : { ...ZERO_SIDES };

const ownPadding = (leaf: Leaf, ctx: MapCtx, which: Which): Sides =>
  leaf.own ? paddingOf(st(ctx, leaf.own, which)) : { ...ZERO_SIDES };

const wrapSides = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim): Sides =>
  sumPads(ctx.v, leaf.wrap, viewOf(ctx, which), avail[which]);

/** Margin and padding of a block, with the wrappers' spacing added to one of them. */
const spacingFor = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, target: "margin" | "padding") => {
  const wrap = wrapSides(leaf, ctx, which, avail);
  const margin = ownMargin(leaf, ctx, which);
  const pad = ownPadding(leaf, ctx, which);
  return {
    margin: toPadding(target === "margin" ? addSides(margin, wrap) : margin),
    padding: toPadding(target === "padding" ? addSides(pad, wrap) : pad),
    sides: {
      margin: target === "margin" ? addSides(margin, wrap) : margin,
      padding: target === "padding" ? addSides(pad, wrap) : pad,
    },
  };
};

const horizontal = (s: Sides): number => s.left + s.right;

// ─── Widths ───────────────────────────────────────────────────────────────────

interface Declared {
  kind: "pct" | "px" | "auto";
  n: number;
}

/** A width as the source declared it: a percentage, pixels, or nothing. A narrower px max-width wins. */
const declaredWidth = (cs: ElStyle): Declared => {
  let d: Declared = { kind: "auto", n: 0 };
  const w = cs.len("width");
  if (w) {
    if (w.unit === "%") d = { kind: "pct", n: w.n };
    else {
      const px = cs.px("width") ?? (w.unit === "" ? w.n : null);
      if (px !== null && px > 0) d = { kind: "px", n: px };
    }
  }
  const mw = cs.len("max-width");
  if (mw && mw.unit !== "%") {
    const px = cs.px("max-width");
    if (px !== null && px > 0 && (d.kind !== "px" || px < d.n)) d = { kind: "px", n: px };
  }
  return d;
};

const clampPct = (n: number): number => Math.min(100, Math.max(1, Math.round(n)));

/** A width and the largest width allowed, as the source declared them. */
interface WidthPart {
  kind: "pct" | "px" | "auto";
  n: number;
  max: { kind: "pct" | "px"; n: number } | null;
}

const widthPart = (cs: ElStyle): WidthPart => {
  const out: WidthPart = { kind: "auto", n: 0, max: null };
  const w = cs.len("width");
  if (w) {
    if (w.unit === "%") out.kind = "pct", out.n = w.n;
    else {
      const px = cs.px("width") ?? (w.unit === "" ? w.n : null);
      if (px !== null && px > 0) out.kind = "px", out.n = px;
    }
  }
  const mw = cs.len("max-width");
  if (mw) {
    if (mw.unit === "%") out.max = { kind: "pct", n: mw.n };
    else {
      const px = cs.px("max-width");
      if (px !== null && px > 0) out.max = { kind: "px", n: px };
    }
  }
  return out;
};

/** The width one element ends up with, given the room its parent offers. */
const applyWidth = (w: WidthPart, room: number): number => {
  let v = w.kind === "px" ? w.n : w.kind === "pct" ? (room * w.n) / 100 : room;
  if (w.max) v = Math.min(v, w.max.kind === "px" ? w.max.n : (room * w.max.n) / 100);
  return v;
};

/**
 * The wrappers between the leaf's column and `el`, outermost first: the
 * elements whose widths (a table cell of 120px, a table of 50%) narrow the room
 * an image has. The walk stops at the column's own elements, because the room
 * handed in already accounts for them.
 */
const segmentAbove = (el: Element, ctx: MapCtx): Element[] => {
  const out: Element[] = [];
  const doc = el.ownerDocument;
  for (let cur = el.parentElement; cur && cur !== doc.body && cur !== doc.documentElement; cur = cur.parentElement) {
    if (ctx.stop?.has(cur)) break;
    out.push(cur);
  }
  return out.reverse();
};

/**
 * An image's or video's width as a percentage of the room it sits in.
 *
 * Widths are resolved the way a browser would: from the column down, each
 * wrapper takes its px width, or its percentage of what its parent has, or all
 * of it. MJML puts the width on a table cell (`td width:120px`) and gives the
 * image `width:100%`, which only this walk turns into 20%.
 *
 * Each view resolves on its own, so a fixed 120px logo is 20% of a 600px
 * canvas and 32% of a 375px phone. The difference becomes a `mobile` width,
 * which is what keeps the logo the size it is in the source.
 */
const widthShare = (el: Element, ctx: MapCtx, which: Which, avail: Dim, spacing: (w: Which) => number): number => {
  const room = avail[which] - spacing(which);
  if (!(room > 0)) return 100;
  let base = room;
  for (const e of segmentAbove(el, ctx)) base = applyWidth(widthPart(st(ctx, e, which)), base);
  return clampPct((applyWidth(widthPart(st(ctx, el, which)), base) / room) * 100);
};

// ─── Rich text ────────────────────────────────────────────────────────────────

const rtCtx = (ctx: MapCtx, which: Which) => ({ cascade: ctx.v.cascade, view: viewOf(ctx, which), report: ctx.report });

// ─── Text blocks ──────────────────────────────────────────────────────────────

/** Borders, rounded corners and shadows on a text block's own element have nowhere to go. */
const reportTextDecor = (el: Element, ctx: MapCtx, which: Which): void => {
  const cs = st(ctx, el, which);
  const bordered = (["top", "right", "bottom", "left"] as const).some((side) => cs.border(side).width > 0);
  const rounded = cs.radii().some((r) => r > 0);
  const shadow = (cs.get("box-shadow") ?? "none").trim().toLowerCase() !== "none";
  if (bordered || rounded || shadow) {
    ctx.report.drop(
      "text-decor",
      "Borders, rounded corners and shadows on text (a quote's side rule, a boxed paragraph) cannot be reproduced and were left out.",
    );
  }
};

const textProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  const textEl = leaf.text as Element;
  if (leaf.own) reportTextDecor(leaf.own, ctx, which);
  const t = typography(st(ctx, textEl, which), ctx.fonts);
  const fill = readFill(leaf.own ? st(ctx, leaf.own, which) : null);
  const sp = spacingFor(leaf, ctx, which, avail, fillVisible(fill) ? "margin" : "padding");
  const props: Record<string, unknown> = {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    color: t.color,
    fontWeight: t.fontWeight,
    fontFamily: t.fontFamily,
    letterSpacing: t.letterSpacing,
    backgroundColor: fill.backgroundColor,
    backgroundGradient: fill.backgroundGradient,
    margin: sp.margin,
    padding: sp.padding,
    textTransform: t.textTransform,
    textDecoration: t.textDecoration,
    align: t.align,
  };
  if (leaf.type === "paragraph") props.fontStyle = t.fontStyle;
  else props.level = leaf.level ?? "h2";
  props.content = withContent ? toRichText(leaf.nodes, textEl, rtCtx(ctx, which)) : "";
  return props;
};

const listProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  const list = leaf.own as Element;
  const li = list.querySelector("li");
  // typography is the item's text, past any <font> or <span> that holds it
  const base = li ? innermostText(li, ctx.v) : list;
  const t = typography(st(ctx, base, which), ctx.fonts);
  reportTextDecor(list, ctx, which);
  const fill = readFill(st(ctx, list, which));
  const sp = spacingFor(leaf, ctx, which, avail, fillVisible(fill) ? "margin" : "padding");
  let itemSpacing = 0;
  if (li) {
    const lcs = st(ctx, li, which);
    itemSpacing = wholePx((lcs.px("margin-bottom") ?? 0) + (lcs.px("padding-bottom") ?? 0));
  }
  const style = (st(ctx, list, which).get("list-style-type") ?? st(ctx, list, which).get("list-style") ?? "").toLowerCase();
  if (/\bnone\b/.test(style)) {
    ctx.report.warn("list-style", "Lists without bullets were converted to normal bulleted lists; Maildeno lists always show markers.");
  }
  return {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontFamily: t.fontFamily,
    letterSpacing: t.letterSpacing,
    color: t.color,
    backgroundColor: fill.backgroundColor,
    backgroundGradient: fill.backgroundGradient,
    margin: sp.margin,
    padding: sp.padding,
    itemSpacing,
    content: withContent ? toListHtml(list, base, rtCtx(ctx, which)) : "",
  };
};

// ─── Buttons and anchors ──────────────────────────────────────────────────────

/** First element of the shell that gives a value, for fill, border, radius and shadow. */
const firstOf = <T>(els: Element[], pick: (el: Element) => T | null): T | null => {
  for (const el of els) {
    const found = pick(el);
    if (found !== null) return found;
  }
  return null;
};

const buttonProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  const link = leaf.link as Element;
  const textEl = leaf.text as Element;
  const shell = leaf.shell && leaf.shell.length ? leaf.shell : [link];
  const tcs = st(ctx, textEl, which);
  const t = typography(tcs, ctx.fonts, "button");

  const fill =
    firstOf(shell, (el) => {
      const f = readFill(st(ctx, el, which));
      return fillVisible(f) ? f : null;
    }) ?? { ...readFill(null) };
  const borderRead =
    firstOf(shell, (el) => {
      const b = readBorder(st(ctx, el, which));
      return b.width > 0 || b.partial ? b : null;
    }) ?? { width: 0, style: "solid", color: "#000000", partial: false };
  if (borderRead.partial && withContent) {
    ctx.report.drop("border-partial", "Borders on only some sides (or with different sides) cannot be reproduced and were left out.");
  }
  const radius = firstOf(shell, (el) => {
    const cs = st(ctx, el, which);
    return cs.radii().some((r) => r > 0) ? radiusOf(cs) : null;
  });
  const shadow = firstOf(shell, (el) => {
    const s = readShadow(st(ctx, el, which));
    return s.shadow.enabled ? s : null;
  });
  if (shadow?.extra && withContent) ctx.report.drop("shadow-layers", "Only the first layer of a multi-layer shadow was kept.");

  // padding adds up over every element from the painted one down to the link
  let pad: Sides = { ...ZERO_SIDES };
  for (const el of shell) pad = addSides(pad, paddingOf(st(ctx, el, which)));

  // A button sized by line-height, height or width instead of padding ("line-height:36px; width:150px")
  // is rebuilt with the padding that makes the same box. The text's width is an estimate.
  let resized = false;
  if (pad.top + pad.bottom < 1) {
    const natural = t.fontSize * 1.2;
    const box = Math.max(tcs.lineHeight() * t.fontSize, ...shell.map((el) => declaredHeight(st(ctx, el, which)) ?? 0));
    if (box > natural + 2) {
      pad = addSides(pad, { top: (box - natural) / 2, bottom: (box - natural) / 2, left: 0, right: 0 });
      resized = true;
    }
  }
  if (pad.left + pad.right < 1) {
    const fixed = Math.max(0, ...shell.map((el) => (st(ctx, el, which).len("width")?.unit === "%" ? 0 : (st(ctx, el, which).px("width") ?? 0))));
    const text = plainProp(link.textContent);
    const textW = text.length * t.fontSize * (buttonWeight(tcs) === "bold" ? 0.6 : 0.55);
    if (fixed > textW + 2) {
      pad = addSides(pad, { top: 0, bottom: 0, left: (fixed - textW) / 2, right: (fixed - textW) / 2 });
      resized = true;
    }
  }
  if (resized && withContent) {
    ctx.report.warn("button-size", "Buttons sized by a fixed height or width were rebuilt with padding; their size may differ slightly.");
  }

  const wrap = wrapSides(leaf, ctx, which, avail);

  // where the button sits: the table around a bulletproof button, or the link itself
  let alignEl = shell[0];
  if (["td", "th", "tr", "tbody"].includes(alignEl.localName)) alignEl = alignEl.closest("table") ?? alignEl;
  const align = blockAlign(st(ctx, alignEl, which));

  // an icon beside the text
  const img = leaf.img ?? null;
  let icon = "";
  let iconAlt = "";
  let iconPosition = "before";
  let iconSize = 20;
  let iconGap = 8;
  if (img) {
    icon = mediaUrl(img.getAttribute("src"), ctx.report);
    iconAlt = altText(img.getAttribute("alt"));
    const ics = st(ctx, img, which);
    iconSize = wholePx(ics.px("width") ?? parseLen(img.getAttribute("width"))?.n ?? ics.px("height") ?? 20) || 20;
    iconPosition = imageComesFirst(link, img) ? "before" : "after";
    iconGap = wholePx(iconPosition === "before" ? (ics.px("margin-right") ?? 8) : (ics.px("margin-left") ?? 8)) || 8;
  }

  return {
    text: plainProp(link.textContent),
    link: linkUrl(link.getAttribute("href"), ctx.report),
    backgroundColor: fill.backgroundColor,
    backgroundGradient: fill.backgroundGradient,
    color: t.color,
    fontSize: t.fontSize,
    fontWeight: buttonWeight(tcs),
    fontFamily: t.fontFamily,
    letterSpacing: t.letterSpacing,
    margin: toPadding(wrap),
    padding: toPadding(pad),
    borderRadius: radius ?? 0,
    border: plainBorder(borderRead),
    boxShadow: (shadow ?? readShadow(null)).shadow,
    align,
    icon,
    iconAlt,
    iconPosition,
    iconSize,
    iconGap,
  };
};

/** Whether `img` comes before the first text in `link`. */
const imageComesFirst = (link: Element, img: Element): boolean => {
  const walker = (node: Node): boolean | null => {
    if (node === img) return true;
    if (isText(node)) return isBlankText(node.data) ? null : false;
    if (!isElement(node)) return null;
    for (const child of Array.from(node.childNodes)) {
      const r = walker(child);
      if (r !== null) return r;
    }
    return null;
  };
  return walker(link) ?? true;
};

const anchorProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  void withContent;
  const link = leaf.link as Element;
  const tcs = st(ctx, leaf.text as Element, which);
  const t = typography(tcs, ctx.fonts, "button");
  const lcs = st(ctx, link, which);
  const wrap = wrapSides(leaf, ctx, which, avail);
  return {
    text: plainProp(link.textContent),
    link: linkUrl(link.getAttribute("href"), ctx.report),
    color: t.color,
    fontSize: t.fontSize,
    fontWeight: buttonWeight(tcs),
    fontFamily: t.fontFamily,
    letterSpacing: t.letterSpacing,
    textDecoration: t.textDecoration,
    margin: toPadding(wrap),
    padding: toPadding(paddingOf(lcs)),
    align: blockAlign(lcs),
  };
};

// ─── Images and video ─────────────────────────────────────────────────────────

const imageProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  const img = leaf.img ?? (leaf.own as Element);
  const cs = st(ctx, img, which);
  const sp = (w: Which) => spacingFor(leaf, ctx, w, avail, "padding").sides;
  const width = widthShare(img, ctx, which, avail, (w) => {
    const s = sp(w);
    return horizontal(s.margin) + horizontal(s.padding);
  });
  const spacing = spacingFor(leaf, ctx, which, avail, "padding");
  const border = readBorder(cs);
  if (border.partial && withContent) {
    ctx.report.drop("border-partial", "Borders on only some sides (or with different sides) cannot be reproduced and were left out.");
  }
  const link = leaf.link ? linkUrl(leaf.link.getAttribute("href"), ctx.report) : "";
  const shadow = readShadow(cs);
  if (shadow.extra && withContent) ctx.report.drop("shadow-layers", "Only the first layer of a multi-layer shadow was kept.");
  return {
    src: mediaUrl(img.getAttribute("src"), ctx.report),
    alt: altText(img.getAttribute("alt")),
    width,
    height: "auto",
    align: blockAlign(cs),
    link,
    enabled: link !== "",
    margin: spacing.margin,
    padding: spacing.padding,
    borderRadius: radiusOf(cs),
    border: plainBorder(border),
    boxShadow: shadow.shadow,
  };
};

const videoProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  const video = leaf.video ?? (leaf.own as Element);
  const cs = st(ctx, video, which);
  const sp = (w: Which) => spacingFor(leaf, ctx, w, avail, "padding").sides;
  const width = widthShare(video, ctx, which, avail, (w) => {
    const s = sp(w);
    return horizontal(s.margin) + horizontal(s.padding);
  });
  const spacing = spacingFor(leaf, ctx, which, avail, "padding");
  const border = readBorder(cs);
  if (border.partial && withContent) {
    ctx.report.drop("border-partial", "Borders on only some sides (or with different sides) cannot be reproduced and were left out.");
  }
  const sourceEl = video.querySelector("source[src]");
  const src = mediaUrl(video.getAttribute("src") ?? sourceEl?.getAttribute("src"), ctx.report);
  const fallbackImg = video.querySelector("img");
  const href = leaf.link ? linkUrl(leaf.link.getAttribute("href"), ctx.report) : "";
  return {
    fallbackLink: href || src,
    src,
    coverImage: mediaUrl(video.getAttribute("poster") ?? fallbackImg?.getAttribute("src"), ctx.report),
    alt: altText(fallbackImg?.getAttribute("alt")) || "Watch video",
    width,
    height: "auto",
    align: blockAlign(cs),
    margin: spacing.margin,
    padding: spacing.padding,
    borderRadius: radiusOf(cs),
    border: plainBorder(border),
  };
};

// ─── Divider and spacer ───────────────────────────────────────────────────────

const DIVIDER_FALLBACK = "#cccccc";

const dividerProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  void withContent;
  const view = viewOf(ctx, which);
  const chain = leaf.shell && leaf.shell.length ? leaf.shell : [leaf.own as Element];
  const isHr = leaf.own?.localName === "hr";
  const m = isHr ? null : measureChain(ctx.v, chain, view);
  const paintEl = isHr ? (leaf.own as Element) : (leaf.src ?? chain[0]);
  const pcs = st(ctx, paintEl, which);
  const fill = readFill(pcs);

  let thickness = 0;
  let color = DIVIDER_FALLBACK;
  let marginTop = 0;
  let marginBottom = 0;
  let marginLeft = 0;
  let marginRight = 0;

  if (isHr) {
    const own = marginOf(pcs);
    marginTop = own.top;
    marginBottom = own.bottom;
    marginLeft = own.left;
    marginRight = own.right;
    const h = pcs.px("height") ?? 0;
    const bw = pcs.border("top").width + pcs.border("bottom").width;
    if (fillVisible(fill) && h > 0) {
      thickness = h;
      color = fill.backgroundColor;
    } else if (bw > 0) {
      thickness = bw;
      const side = pcs.border("top").width > 0 ? pcs.border("top") : pcs.border("bottom");
      color = side.color ? readColorString(side.color) : DIVIDER_FALLBACK;
    } else {
      thickness = h > 0 ? h : 1;
      if (fillVisible(fill)) color = fill.backgroundColor;
    }
  } else if (m) {
    marginTop = m.top;
    marginBottom = m.bottom;
    marginLeft = m.left;
    marginRight = m.right;
    if (fillVisible(fill)) {
      color = fill.backgroundColor;
      thickness = m.inner;
      if (thickness <= 0) {
        // a thin bar made of padding on the painted element
        const pad = paddingOf(pcs);
        thickness = pad.top + pad.bottom;
        marginTop -= pad.top;
        marginBottom -= pad.bottom;
      }
    } else {
      const top = pcs.border("top");
      const bottom = pcs.border("bottom");
      const side = top.width > 0 ? top : bottom;
      thickness = side.width;
      color = side.color ? readColorString(side.color) : DIVIDER_FALLBACK;
      marginTop += m.inner / 2;
      marginBottom += m.inner / 2;
    }
  }

  // width and alignment come from the first element that is narrower than its container
  let widthEl: Element | null = null;
  let widthDecl: Declared = { kind: "auto", n: 0 };
  for (const el of isHr ? [leaf.own as Element] : chain) {
    const d = declaredWidth(st(ctx, el, which));
    if (d.kind === "px" || (d.kind === "pct" && d.n < 100)) {
      widthEl = el;
      widthDecl = d;
      break;
    }
  }
  const room = avail[which] - marginLeft - marginRight;
  let width = 100;
  if (widthDecl.kind === "pct") width = clampPct(widthDecl.n);
  else if (widthDecl.kind === "px" && room > 0) width = clampPct((widthDecl.n / room) * 100);
  let align: "left" | "center" | "right" = "center";
  if (widthEl && width < 100) {
    let aEl = widthEl;
    if (["td", "th", "tr", "tbody"].includes(aEl.localName)) aEl = aEl.closest("table") ?? aEl;
    align = blockAlign(st(ctx, aEl, which));
  }

  const wrap = wrapSides(leaf, ctx, which, avail);
  const sides: Sides = {
    top: marginTop + wrap.top,
    right: marginRight + wrap.right,
    bottom: marginBottom + wrap.bottom,
    left: marginLeft + wrap.left,
  };
  const fillOut = solidFill(color);
  return {
    backgroundColor: fillOut.backgroundColor,
    backgroundGradient: fillOut.backgroundGradient,
    height: Math.max(1, Math.round(thickness)),
    width,
    margin: toPadding(sides),
    padding: toPadding(ZERO_SIDES),
    align,
  };
};

const readColorString = (c: { r: number; g: number; b: number; a: number }): string =>
  c.a <= 0 ? "transparent" : c.a >= 1 ? `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("")}` : `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.round(c.a * 100) / 100})`;

const spacerProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  void withContent;
  const view = viewOf(ctx, which);
  const chain = leaf.shell && leaf.shell.length ? leaf.shell : [];
  const m = chain.length ? measureChain(ctx.v, chain, view) : null;
  const wrap = wrapSides(leaf, ctx, which, avail);
  const height = wholePx((m ? m.inner + m.top + m.bottom : 0) + wrap.top + wrap.bottom);
  const paintCs = m?.paint ? st(ctx, m.paint, which) : null;
  const fill = readFill(paintCs);
  const out = fillVisible(fill) ? solidFill(fill.backgroundColor) : solidFill("transparent");
  return {
    height: Math.max(1, height),
    backgroundColor: out.backgroundColor,
    backgroundGradient: out.backgroundGradient,
  };
};

// ─── Menu and socials ─────────────────────────────────────────────────────────

/**
 * The room an item of a row of links takes on its left and right: the link and
 * every wrapper around it that holds no other item (its cell, the span or the
 * table inside the cell). MJML's social icons sit in a cell with padding and a
 * second cell with the colour, so the nearest cell alone would miss the padding.
 */
const sideSpace = (
  item: { a: Element; cell: Element | null },
  items: Array<{ a: Element }>,
  ctx: MapCtx,
  which: Which,
): { left: number; right: number } => {
  let left = 0;
  let right = 0;
  let cur: Element | null = item.a;
  while (cur && items.filter((it) => cur?.contains(it.a)).length === 1) {
    const s = spacingIn(st(ctx, cur, which));
    left += s.left;
    right += s.right;
    cur = cur.parentElement;
  }
  return { left, right };
};

/**
 * The space between neighbouring items: the right side of one plus the left
 * side of the next, averaged. Maildeno writes half the spacing on each side of
 * every link (and none on the outer edges), so the pair is what recovers it.
 * Callers handle the one-item case; here it is 0.
 */
const gapBetweenItems = (items: Array<{ a: Element; cell: Element | null }>, ctx: MapCtx, which: Which): number => {
  if (items.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < items.length - 1; i++) {
    total += sideSpace(items[i], items, ctx, which).right + sideSpace(items[i + 1], items, ctx, which).left;
  }
  return wholePx(total / (items.length - 1));
};

const menuProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  if (withContent && leaf.separators) {
    ctx.report.warn("menu-separators", "Separator characters between menu links (| or •) were left out; the links are spaced apart instead.");
  }
  const items = leaf.items ?? [];
  const first = items[0];
  const textEl = leaf.text ?? first.a;
  const t = typography(st(ctx, textEl, which), ctx.fonts);
  const spacing = spacingFor(leaf, ctx, which, avail, "padding");
  // one item has no neighbour to measure against; Maildeno's default stands in
  let space = items.length >= 2 ? gapBetweenItems(items, ctx, which) : 8;
  // links that were told apart by a character, not by space, need some room once it is gone
  if (leaf.separators && space < 12) space = 16;
  const stacked = items.every((it) => {
    const el = it.cell ?? it.a;
    return st(ctx, el, "p").display() === "block" && st(ctx, el, "d").display() !== "block";
  });
  return {
    items: items.map((it) => ({ label: plainProp(it.label), link: linkUrl(it.href, ctx.report), enabled: true })),
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontWeight: t.fontWeight,
    fontFamily: t.fontFamily,
    fontStyle: t.fontStyle,
    letterSpacing: t.letterSpacing,
    color: t.color,
    textTransform: t.textTransform,
    textDecoration: t.textDecoration,
    backgroundColor: NO_FILL.backgroundColor,
    backgroundGradient: NO_FILL.backgroundGradient,
    spacing: space,
    align: first ? blockAlign(st(ctx, first.cell ?? first.a, which)) : "center",
    margin: spacing.margin,
    padding: spacing.padding,
    mobileStack: stacked,
  };
};

const socialsProps = (leaf: Leaf, ctx: MapCtx, which: Which, avail: Dim, withContent: boolean): Record<string, unknown> => {
  void withContent;
  const items = leaf.items ?? [];
  const first = items[0];
  const spacing = spacingFor(leaf, ctx, which, avail, "padding");
  let iconSize = 28;
  if (first?.img) {
    const ics = st(ctx, first.img, which);
    iconSize = wholePx(ics.px("width") ?? parseLen(first.img.getAttribute("width"))?.n ?? ics.px("height") ?? 28) || 28;
  }
  const space = items.length >= 2 ? gapBetweenItems(items, ctx, which) : 10;
  return {
    platforms: items.map((it) => ({
      name: it.label || socialName(it.href, "", it.img?.getAttribute("src") ?? "") || "Link",
      link: linkUrl(it.href, ctx.report),
      enabled: true,
      icon: mediaUrl(it.img?.getAttribute("src"), ctx.report),
    })),
    iconSize,
    spacing: space,
    align: first ? blockAlign(st(ctx, first.cell ?? first.a, which)) : "center",
    margin: spacing.margin,
    padding: spacing.padding,
  };
};

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * The complete props of a leaf's block as seen in one view. `withContent` is
 * false for the second read, which only feeds the mobile comparison.
 */
export const readLeafProps = (
  leaf: Leaf,
  ctx: MapCtx,
  which: Which,
  avail: Dim,
  withContent: boolean,
): Record<string, unknown> => {
  switch (leaf.type) {
    case "paragraph":
    case "heading":
      return textProps(leaf, ctx, which, avail, withContent);
    case "list":
      return listProps(leaf, ctx, which, avail, withContent);
    case "button":
      return buttonProps(leaf, ctx, which, avail, withContent);
    case "anchor":
      return anchorProps(leaf, ctx, which, avail, withContent);
    case "image":
      return imageProps(leaf, ctx, which, avail, withContent);
    case "video":
      return videoProps(leaf, ctx, which, avail, withContent);
    case "divider":
      return dividerProps(leaf, ctx, which, avail, withContent);
    case "spacer":
      return spacerProps(leaf, ctx, which, avail, withContent);
    case "menu":
      return menuProps(leaf, ctx, which, avail, withContent);
    case "socials":
      return socialsProps(leaf, ctx, which, avail, withContent);
  }
};
