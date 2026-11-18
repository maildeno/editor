// import/structure/recognize.ts
// ─────────────────────────────────────────────────────────────────────────────
// Block recognition: which Maildeno block is this markup?
//
// Two entry points, both used by analyze.ts:
//
//   leafFromElement   an element that is a block by itself, or a chain of
//                     wrappers around one: <hr>, <img>, <video>, a bulletproof
//                     button table, an empty cell with a height, a row of links
//   classifyRun       a run of text and inline elements inside a container:
//                     a paragraph, or an image / button / link between them
//
// Recognition is by content first and style second. A link with a background
// and padding is a button, a link on its own is an anchor, two or more short
// links are a menu, small icons that name social networks are socials, an empty
// element with a height is a spacer, and a thin painted one is a divider.
//
// Wrappers that paint (a coloured <td> around an image) are never absorbed here:
// they are layers of their own, and recognition returns null so the analyzer
// can make a Box and look inside. The one exception is a button, whose painted
// table or cell is the button.
// ─────────────────────────────────────────────────────────────────────────────

import { sameColor } from "../css/values";
import type { Rgba } from "../../core/cssColor";
import type { ReportBuilder } from "../report";
import { hasVisibleContent, isBlankText, isElement, isText, normText, tableRows } from "./dom";
import type { BlockType, Hide, Leaf, WrapPad } from "./ir";
import {
  type Views,
  buttonChain,
  collectLinkItems,
  emptyChain,
  hasPaint,
  hasSpacing,
  isInvisible,
  isTrackingPixel,
  measureChain,
  peel,
  soleImage,
} from "./leaves";
import { nodesAreBlank } from "./richtext";

export interface RecCtx {
  v: Views;
  report: ReportBuilder;
}

const mk = (type: BlockType, hide: Hide, init: Partial<Leaf> = {}): Leaf => ({
  kind: "leaf",
  type,
  own: null,
  text: null,
  nodes: [],
  hide,
  wrap: [],
  ...init,
});

/** The spacing an element adds, as a wrap entry. Empty when it adds none. */
export const wrapOf = (el: Element, ctx: RecCtx): WrapPad[] =>
  hasSpacing(ctx.v, el) ? [{ el, kind: "spacing", top: true, right: true, bottom: true, left: true }] : [];

const wrapAll = (els: Element[], ctx: RecCtx): WrapPad[] => els.flatMap((e) => wrapOf(e, ctx));

/** The elements from `from` down to the parent of `to`, outermost first. */
const pathDown = (from: Element, to: Element): Element[] => {
  const out: Element[] = [];
  let cur: Element | null = to.parentElement;
  while (cur && cur !== from) {
    out.push(cur);
    cur = cur.parentElement;
  }
  if (cur === from && from !== to) out.push(from);
  return out.reverse();
};

const bgOf = (el: Element, v: Views): Rgba | null => {
  const c = v.cascade.styleOf(el, v.desktop).color("background-color");
  return c && c.a > 0.01 ? c : null;
};

// ─── Text ─────────────────────────────────────────────────────────────────────

/** The nodes something shows: not an element that is hidden on desktop and on a phone. */
const shownNodes = (nodes: Node[], v: Views): Node[] =>
  nodes.filter(
    (n) => !isElement(n) || !(isInvisible(v.cascade.styleOf(n, v.desktop)) && isInvisible(v.cascade.styleOf(n, v.phone))),
  );

/** A paragraph or heading from `nodes`. Null when there is nothing to show. */
export const textLeaf = (
  type: "paragraph" | "heading",
  own: Element | null,
  nodes: Node[],
  container: Element,
  ctx: RecCtx,
  hide: Hide,
  level?: string,
): Leaf | null => {
  nodes = shownNodes(nodes, ctx.v);
  if (nodesAreBlank(nodes)) return null;
  const peeled = peel(nodes, container, ctx.v);
  return mk(type, hide, { own, text: peeled.base, nodes: peeled.nodes, level });
};

export const listLeaf = (list: Element, ctx: RecCtx, hide: Hide): Leaf | null => {
  const items = Array.from(list.querySelectorAll("li"));
  if (!items.some((li) => normText(li.textContent ?? ""))) return null;
  return mk("list", hide, { own: list, text: list });
};

// ─── Images and video ─────────────────────────────────────────────────────────

const imageLeaf = (img: Element, wrappers: Element[], link: Element | null, ctx: RecCtx, hide: Hide): Leaf | "skip" => {
  const cs = ctx.v.cascade.styleOf(img, ctx.v.desktop);
  if (isTrackingPixel(img, cs)) {
    ctx.report.drop("tracking-pixel", "Tracking pixels (1×1 images) were left out. Your email service adds its own.");
    return "skip";
  }
  if (!(img.getAttribute("src") ?? "").trim()) {
    ctx.report.drop("image-no-src", "Images without a source were left out.");
    return "skip";
  }
  return mk("image", hide, { own: img, img, link, wrap: wrapAll(wrappers, ctx) });
};

const videoLeaf = (video: Element, wrappers: Element[], link: Element | null, ctx: RecCtx, hide: Hide): Leaf => {
  return mk("video", hide, { own: video, video, link, wrap: wrapAll(wrappers, ctx) });
};

/** A single <video>, alone in `el` apart from wrappers and its own fallback content. */
const soleVideo = (el: Element): Element | null => {
  if (el.localName === "video") return el;
  const videos = Array.from(el.querySelectorAll("video"));
  if (videos.length !== 1) return null;
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("video").forEach((n) => n.remove());
  return normText(clone.textContent ?? "") || clone.querySelector("img") ? null : videos[0];
};

// ─── Buttons and anchors ──────────────────────────────────────────────────────

/**
 * Which painted element is the button's surface. With one painted element, that
 * one. With several, walk outward from the innermost: a layer joins the button
 * when it paints the same colour (a table and the cell inside it) or when
 * either layer has no fill of its own (a border on the link, a fill on the
 * cell). A layer with a different fill is a section behind the button.
 */
const pickShellStart = (surfaces: Element[], painted: number[], v: Views): number => {
  let cur = painted[painted.length - 1];
  for (let k = painted.length - 2; k >= 0; k--) {
    const outer = painted[k];
    const a = bgOf(surfaces[cur], v);
    const b = bgOf(surfaces[outer], v);
    if (!a || !b || sameColor(a, b)) cur = outer;
    else break;
  }
  return cur;
};

const buttonOrAnchor = (el: Element, ctx: RecCtx, hide: Hide): Leaf | null => {
  const bc = buttonChain(el);
  if (!bc) return null;
  const { chain, link } = bc;
  const label = normText(link.textContent ?? "");
  const hasImg = link.querySelector("img") !== null;
  if (!label) return null;
  if (label.length > 80) return null;
  const v = ctx.v;
  const surfaces = [...chain, link];
  const painted = surfaces.map((e, i) => (hasPaint(v, e) ? i : -1)).filter((i) => i >= 0);

  const peeled = peel(Array.from(link.childNodes), link, v);

  if (painted.length === 0) {
    if (hasImg) return null; // an icon link without a fill reads better as text
    return mk("anchor", hide, { link, text: peeled.base, nodes: peeled.nodes, wrap: wrapAll(chain, ctx) });
  }

  const start = pickShellStart(surfaces, painted, v);
  // a painted layer outside the button is a section: leave it to the analyzer
  if (painted.some((i) => i < start)) return null;
  const shell = surfaces.slice(start);
  const outer = surfaces.slice(0, start);
  const img = link.querySelector("img");
  return mk("button", hide, {
    link,
    img,
    text: peeled.base,
    nodes: peeled.nodes,
    shell,
    wrap: wrapAll(outer, ctx),
  });
};

// ─── Spacers and dividers ─────────────────────────────────────────────────────

const emptyLeaf = (el: Element, ctx: RecCtx, hide: Hide): Leaf | "skip" | null => {
  if (hasVisibleContent(el)) return null;
  const chain = emptyChain(el);
  if (!chain) return null;
  const v = ctx.v;
  const view = hide.d && !hide.p ? v.phone : v.desktop;
  const m = measureChain(v, chain, view);
  const total = m.inner + m.vertical;
  const paintCs = m.paint ? v.cascade.styleOf(m.paint, view) : null;
  const fill = paintCs ? paintCs.color("background-color") : null;
  const hasFill = !!fill && fill.a > 0.01;
  let borderLine = false;
  if (paintCs && !hasFill) {
    borderLine = paintCs.border("top").width > 0 || paintCs.border("bottom").width > 0;
  }

  // thin is the bar's own thickness, not the room around it: a 2px line with 10px margins is a divider
  const thickness = m.inner > 0 ? m.inner : total;
  if (hasFill && thickness > 0 && thickness <= 8) return mk("divider", hide, { shell: chain, src: m.paint });
  if (borderLine) return mk("divider", hide, { shell: chain, src: m.paint });
  if (total <= 0.5 && !(hasFill && total > 0)) return "skip";
  return mk("spacer", hide, { shell: chain, src: m.paint });
};

// ─── Menus and socials ────────────────────────────────────────────────────────

const linkRowLeaf = (el: Element, ctx: RecCtx, hide: Hide): Leaf | null => {
  if (el.localName === "table" && tableRows(el).length !== 1) return null;
  if (hasPaint(ctx.v, el)) return null;
  const row = collectLinkItems(el, ctx.v);
  if (!row) return null;
  return mk(row.kind, hide, { items: row.items, separators: row.separators, text: row.items[0].a, wrap: wrapOf(el, ctx) });
};

// ─── Entry points ─────────────────────────────────────────────────────────────

const LIST_TAGS = new Set(["ul", "ol"]);
const WRAPPER_TAGS = new Set(["a", "p", "div", "span", "td", "th", "table", "center", "section", "article", "main", "header", "footer", "font", "nobr", "figure", "tr", "tbody"]);

/**
 * The leaf for an element that is one on its own, or null when the analyzer
 * should look inside it. "skip" means it is a leaf that shows nothing (a
 * tracking pixel, an empty element with no height).
 */
export const leafFromElement = (el: Element, ctx: RecCtx, hide: Hide): Leaf | "skip" | null => {
  const tag = el.localName;
  const v = ctx.v;

  if (tag === "hr") return mk("divider", hide, { own: el, src: el });
  if (tag === "img") return imageLeaf(el, [], null, ctx, hide);
  if (tag === "video") return videoLeaf(el, [], null, ctx, hide);

  if (LIST_TAGS.has(tag)) {
    // a list whose items sit in a row is a menu
    const li = el.querySelector("li");
    if (li) {
      const d = v.cascade.styleOf(li, v.desktop).display();
      if (d === "inline" || d === "inline-block" || d === "flex") return linkRowLeaf(el, ctx, hide);
    }
    return null;
  }

  if (!WRAPPER_TAGS.has(tag)) return null;

  // 1. an empty element with a height
  const empty = emptyLeaf(el, ctx, hide);
  if (empty) return empty;

  // 2. an image, perhaps inside a link and some wrappers
  const img = soleImage(el);
  if (img) {
    const path = pathDown(el, img);
    if (path.some((e) => e.localName !== "a" && hasPaint(v, e))) return null;
    const link = path.find((e) => e.localName === "a" && e.hasAttribute("href")) ?? null;
    return imageLeaf(img, path.filter((e) => e.localName !== "a"), link, ctx, hide);
  }

  // 3. a video, perhaps inside a link
  const video = soleVideo(el);
  if (video) {
    const path = pathDown(el, video);
    if (path.some((e) => e.localName !== "a" && hasPaint(v, e))) return null;
    const link = path.find((e) => e.localName === "a" && e.hasAttribute("href")) ?? null;
    return videoLeaf(video, path.filter((e) => e.localName !== "a"), link, ctx, hide);
  }

  // 4. a button or an anchor
  const button = buttonOrAnchor(el, ctx, hide);
  if (button) return button;

  // 5. a row of links
  return linkRowLeaf(el, ctx, hide);
};

type Segment = { kind: "text"; nodes: Node[] } | { kind: "image"; node: Element };

const isImageNode = (n: Node): n is Element => {
  if (!isElement(n)) return false;
  if (n.localName === "img") return true;
  if (n.localName === "a" || n.localName === "span" || n.localName === "picture") {
    const img = soleImage(n);
    return !!img;
  }
  return false;
};

/**
 * The leaves for a run of inline content. Images and a lone link or button
 * split the run, and what is left becomes paragraphs. `whole` says the run is
 * everything in `container`, which allows a row of links to be a menu.
 */
export const classifyRun = (nodes: Node[], container: Element, ctx: RecCtx, hide: Hide, whole: boolean): Leaf[] => {
  nodes = shownNodes(nodes, ctx.v);
  const meaningful = nodes.filter((n) => (isText(n) ? !isBlankText(n.data) : isElement(n) && hasVisibleContent(n)));
  if (!meaningful.length) return [];

  if (whole) {
    const row = collectLinkItems(container, ctx.v);
    if (row && !hasPaint(ctx.v, container)) {
      return [mk(row.kind, hide, { items: row.items, separators: row.separators, text: row.items[0].a })];
    }
  }

  // split around images and standalone links
  const segments: Segment[] = [];
  let current: Node[] = [];
  const flush = (): void => {
    if (current.length) segments.push({ kind: "text", nodes: current });
    current = [];
  };
  for (const n of nodes) {
    if (isImageNode(n)) {
      flush();
      segments.push({ kind: "image", node: n });
    } else current.push(n);
  }
  flush();

  const leaves: Leaf[] = [];
  for (const seg of segments) {
    if (seg.kind === "image") {
      const via = seg.node;
      const img = via.localName === "img" ? via : soleImage(via);
      if (!img) continue;
      const path = via === img ? [] : pathDown(via, img);
      const link = via.localName === "a" && via.hasAttribute("href") ? via : (path.find((e) => e.localName === "a" && e.hasAttribute("href")) ?? null);
      const result = imageLeaf(img, path.filter((e) => e.localName !== "a"), link, ctx, hide);
      if (result !== "skip") leaves.push(result);
      continue;
    }
    const kept = seg.nodes.filter((n) => (isText(n) ? !isBlankText(n.data) : isElement(n) && hasVisibleContent(n)));
    if (!kept.length) continue;
    // a lone link (or a link inside inline wrappers) is a button or an anchor
    if (kept.length === 1 && isElement(kept[0])) {
      const only = kept[0];
      const button = buttonOrAnchor(only, ctx, hide);
      if (button) {
        leaves.push(button);
        continue;
      }
    }
    const leaf = textLeaf("paragraph", null, seg.nodes, container, ctx, hide);
    if (leaf) leaves.push(leaf);
  }
  return leaves;
};
