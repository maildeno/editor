// import/structure/leaves.ts
// ─────────────────────────────────────────────────────────────────────────────
// Detection helpers for the analyzer
//
// Small, mostly pure tests the analyzer asks while it classifies markup:
//
//   hasPaint / spacingOf    does this element draw anything, or take up room?
//   emptyChain              a chain of single-child wrappers with nothing in it:
//                           the shape of a spacer or a divider
//   buttonChain             a link inside single-child wrappers, one of which is
//                           painted: the "bulletproof button" tables and divs
//   collectLinkItems        a run of links: a menu, or a row of social icons
//   peel                    single-child style wrappers (<span>, <font>, <b>)
//                           whose style belongs to the block, not to a mark
//
// They read the cascade in both views, so a block that only looks like a box on
// a phone (or only on desktop) is still seen as one.
// ─────────────────────────────────────────────────────────────────────────────

import type { Cascade, ElStyle, View } from "../css/cascade";
import { parseLen, sameColor } from "../css/values";
import {
  SKIP_TAGS,
  elementChildren,
  hasVisibleContent,
  isBlankText,
  isElement,
  isText,
  normText,
  rowCells,
  tableRows,
} from "./dom";
import type { LinkItem } from "./ir";

export interface Views {
  cascade: Cascade;
  desktop: View;
  phone: View;
}

const both = <T>(v: Views, el: Element, f: (cs: ElStyle) => T): [T, T] => [
  f(v.cascade.styleOf(el, v.desktop)),
  f(v.cascade.styleOf(el, v.phone)),
];

// ─── Paint and spacing ────────────────────────────────────────────────────────

const paintIn = (cs: ElStyle): boolean => {
  const bg = cs.color("background-color");
  if (bg && bg.a > 0.01) return true;
  const image = cs.get("background-image");
  if (image && image.toLowerCase() !== "none" && /url\(|gradient\(/i.test(image)) return true;
  for (const side of ["top", "right", "bottom", "left"] as const) {
    if (cs.border(side).width > 0) return true;
  }
  const shadow = cs.get("box-shadow");
  return !!shadow && shadow.trim().toLowerCase() !== "none";
};

/** Whether the element paints a background, a border or a shadow in either view. */
export const hasPaint = (v: Views, el: Element): boolean => both(v, el, paintIn).some(Boolean);

const flatIn = (cs: ElStyle): boolean => {
  for (const side of ["top", "right", "bottom", "left"] as const) if (cs.border(side).width > 0) return false;
  const shadow = cs.get("box-shadow");
  if (shadow && shadow.trim().toLowerCase() !== "none") return false;
  if (cs.radii().some((r) => r > 0)) return false;
  const image = cs.get("background-image");
  return !(image && /url\(/i.test(image));
};

/** Whether an element's paint is only a colour or a gradient: no border, radius, shadow or image. */
export const flatFill = (v: Views, el: Element): boolean => both(v, el, flatIn).every(Boolean);

const borderedIn = (cs: ElStyle): boolean =>
  (["top", "right", "bottom", "left"] as const).some((side) => cs.border(side).width > 0);

/** Draws a border and nothing else: no fill, image or shadow (a radius may round it). */
const frameIn = (cs: ElStyle): boolean => {
  const bg = cs.color("background-color");
  if (bg && bg.a > 0.01) return false;
  const image = cs.get("background-image");
  if (image && image.trim().toLowerCase() !== "none") return false;
  const shadow = cs.get("box-shadow");
  return !(shadow && shadow.trim().toLowerCase() !== "none");
};

/** Whether an element draws a border and nothing else in both views, with a border in at least one. */
export const frameOnly = (v: Views, el: Element): boolean =>
  both(v, el, frameIn).every(Boolean) && both(v, el, borderedIn).some(Boolean);

/** Whether an element has a border on any side in either view. */
export const hasBorder = (v: Views, el: Element): boolean => both(v, el, borderedIn).some(Boolean);

const BACKGROUND_PROPS = ["background-image", "background-size", "background-position", "background-repeat", "box-shadow"];

const sameLook = (a: ElStyle, b: ElStyle): boolean => {
  const ca = a.color("background-color");
  const cb = b.color("background-color");
  const fa = !!ca && ca.a > 0.01;
  const fb = !!cb && cb.a > 0.01;
  if (fa !== fb || (fa && ca && cb && !sameColor(ca, cb))) return false;
  for (const prop of BACKGROUND_PROPS) {
    const x = (a.get(prop) ?? "none").trim().toLowerCase().replace(/\s+/g, " ");
    const y = (b.get(prop) ?? "none").trim().toLowerCase().replace(/\s+/g, " ");
    if (x !== y && !(x === "none" && y === "") && !(x === "" && y === "none")) {
      // size, position and repeat only count when there is an image
      if (prop === "box-shadow" || (a.get("background-image") ?? "none") !== "none") return false;
    }
  }
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const ba = a.border(side);
    const bb = b.border(side);
    if (ba.width !== bb.width) return false;
    if (ba.width > 0 && (ba.style !== bb.style || !ba.color || !bb.color || !sameColor(ba.color, bb.color))) return false;
  }
  const ra = a.radii();
  const rb = b.radii();
  return ra.every((r, i) => Math.abs(r - rb[i]) < 0.01);
};

const imageIn = (cs: ElStyle): boolean => /url\(|gradient\(/i.test(cs.get("background-image") ?? "");

/** Whether an element paints a background image or a gradient in either view. */
export const hasImage = (v: Views, el: Element): boolean => both(v, el, imageIn).some(Boolean);

/** Whether two elements have the same background colour in both views. */
export const sameFill = (v: Views, a: Element, b: Element): boolean =>
  [v.desktop, v.phone].every((view) => {
    const ca = v.cascade.styleOf(a, view).color("background-color");
    const cb = v.cascade.styleOf(b, view).color("background-color");
    const fa = !!ca && ca.a > 0.01;
    const fb = !!cb && cb.a > 0.01;
    return fa === fb && (!fa || (!!ca && !!cb && sameColor(ca, cb)));
  });

/** Whether two elements paint exactly the same thing (fill, image, borders, radius, shadow) in both views. */
export const samePaint = (v: Views, a: Element, b: Element): boolean =>
  sameLook(v.cascade.styleOf(a, v.desktop), v.cascade.styleOf(b, v.desktop)) &&
  sameLook(v.cascade.styleOf(a, v.phone), v.cascade.styleOf(b, v.phone));

/**
 * Whether an element takes no visible space and shows nothing: display:none,
 * or one of the shapes preheaders are hidden with (max-height 0 with clipping,
 * zero opacity with no size).
 */
export const isInvisible = (cs: ElStyle): boolean => {
  if (cs.isHidden()) return true;
  const overflow = (cs.get("overflow") ?? "").trim().toLowerCase();
  const clipped = overflow === "hidden" || overflow === "clip";
  const maxHeight = cs.px("max-height");
  const height = cs.px("height");
  if (clipped && ((maxHeight !== null && maxHeight <= 0) || (height !== null && height <= 0))) return true;
  const opacity = Number.parseFloat(cs.get("opacity") ?? "");
  if (Number.isFinite(opacity) && opacity === 0) {
    const fontSize = cs.px("font-size");
    if (clipped || (maxHeight !== null && maxHeight <= 0) || (fontSize !== null && fontSize <= 1)) return true;
  }
  return false;
};

const NO_SPACING = new Set(["tr", "tbody", "thead", "tfoot", "colgroup", "col"]);
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

export type Sides = { top: number; right: number; bottom: number; left: number };

/**
 * An element's padding in px. Rows and row groups have none. A table has none
 * while its borders are collapsed.
 */
export const paddingOf = (cs: ElStyle): Sides => {
  const tag = cs.el.localName;
  if (NO_SPACING.has(tag)) return { ...ZERO };
  if (tag === "table" && (cs.inh("border-collapse") ?? "").trim().toLowerCase() === "collapse") return { ...ZERO };
  return cs.box("padding");
};

/**
 * An element's margin in px, where a margin takes effect: not on table cells
 * or row groups. An auto margin only centres or aligns, and counts as 0.
 */
export const marginOf = (cs: ElStyle): Sides => {
  const tag = cs.el.localName;
  if (NO_SPACING.has(tag) || tag === "td" || tag === "th") return { ...ZERO };
  const m = cs.box("margin");
  const auto = cs.autoMargins();
  return { top: m.top, right: auto.right ? 0 : m.right, bottom: m.bottom, left: auto.left ? 0 : m.left };
};

/** The space an element adds around its content: padding plus margin. */
export const spacingIn = (cs: ElStyle): Sides => {
  const p = paddingOf(cs);
  const m = marginOf(cs);
  return { top: p.top + m.top, right: p.right + m.right, bottom: p.bottom + m.bottom, left: p.left + m.left };
};

export const hasSpacing = (v: Views, el: Element): boolean =>
  both(v, el, (cs) => {
    const s = spacingIn(cs);
    return s.top + s.right + s.bottom + s.left > 0;
  }).some(Boolean);

/** A declared height in px (attribute, height, min-height), or null. */
export const declaredHeight = (cs: ElStyle): number | null => {
  const h = cs.px("height") ?? cs.px("min-height");
  return h !== null && h > 0 ? h : null;
};

export interface ChainMetrics {
  /** The chain's own height in px: the largest declared height, or the one line its text makes. */
  inner: number;
  /** Padding and margin above, below, left and right, added over the whole chain. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** top + bottom */
  vertical: number;
  /** The innermost element in the chain that paints, if any: the bar, not the section around it. */
  paint: Element | null;
}

/**
 * What an empty chain (a spacer, a divider, a thin bar) measures in one view.
 * A non-breaking space or a <br> makes a line, so `font-size:1px; line-height:20px`
 * with `&nbsp;` measures 20.
 */
export const measureChain = (v: Views, chain: Element[], view: View): ChainMetrics => {
  let declared = 0;
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  let paint: Element | null = null;
  for (const el of chain) {
    const cs = v.cascade.styleOf(el, view);
    declared = Math.max(declared, declaredHeight(cs) ?? 0);
    const s = spacingIn(cs);
    top += s.top;
    bottom += s.bottom;
    left += s.left;
    right += s.right;
    if (paintIn(cs)) paint = el;
  }
  const last = chain[chain.length - 1];
  const hasLine = /\u00a0/.test(chain[0].textContent ?? "") || chain.some((e) => e.querySelector("br") !== null || e.localName === "br");
  let lineBox = 0;
  if (hasLine && last) {
    const cs = v.cascade.styleOf(last, view);
    lineBox = cs.lineHeight() * cs.fontSize();
  }
  return { inner: Math.max(declared, lineBox), top, bottom, left, right, vertical: top + bottom, paint };
};

// ─── Chains ───────────────────────────────────────────────────────────────────

const WRAPPER_TAGS = new Set(["table", "tbody", "thead", "tfoot", "tr", "td", "th", "div", "span", "p", "center", "font", "section", "article", "main", "header", "footer", "nobr"]);

const contentChildren = (el: Element): Element[] =>
  elementChildren(el).filter((c) => !SKIP_TAGS.has(c.localName));

/** Whether an element holds visible text directly (not through a child element). */
const hasOwnText = (el: Element): boolean =>
  Array.from(el.childNodes).some((n) => isText(n) && !isBlankText(n.data));

/**
 * The elements from `el` down while each has exactly one element child and no
 * text of its own, as long as nothing visible is inside at all. That is what a
 * spacer or a divider looks like in a table or a div. Null when `el` holds
 * anything visible.
 */
export const emptyChain = (el: Element): Element[] | null => {
  if (hasVisibleContent(el)) return null;
  const chain: Element[] = [];
  let cur: Element | null = el;
  while (cur) {
    chain.push(cur);
    const kids = contentChildren(cur);
    // every table adds a body and a row, and Maildeno's own wrappers add three tables around a block
    if (kids.length !== 1 || chain.length > 24) break;
    cur = kids[0];
  }
  return chain;
};

export interface ButtonChain {
  /** Outermost wrapper first, the link last. */
  chain: Element[];
  link: Element;
}

/**
 * A link reached through single-child wrappers, with nothing else beside it:
 * `<table><tr><td><a>`, `<div><a>`, `<span><a>`. The caller decides whether the
 * result looks like a button (a painted wrapper or a painted link).
 */
export const buttonChain = (el: Element): ButtonChain | null => {
  const chain: Element[] = [];
  let cur: Element | null = el;
  while (cur && chain.length < 10) {
    if (cur.localName === "a" && cur.hasAttribute("href")) return { chain, link: cur };
    if (!WRAPPER_TAGS.has(cur.localName)) return null;
    if (hasOwnText(cur)) return null;
    chain.push(cur);
    const kids = contentChildren(cur);
    if (kids.length !== 1) return null;
    cur = kids[0];
  }
  return null;
};

/** One row and one cell, for a table in a chain: the shape a single-cell wrapper takes. */
export const isSingleCellTable = (table: Element): boolean => {
  const rows = tableRows(table);
  return rows.length === 1 && rowCells(rows[0]).length === 1;
};

// ─── Peeling ──────────────────────────────────────────────────────────────────

const PEELABLE = new Set(["span", "font", "b", "strong", "i", "em", "u", "big", "small", "s", "strike", "nobr"]);

/**
 * Strips single-child style wrappers off a run of nodes: `<td><font><span>text`
 * is text whose block style is the span's. Returns the inner nodes and the
 * element their typography is read from. A wrapper that paints (a highlighted
 * span) or sets display:inline-block stays, as a mark.
 */
export const peel = (
  nodes: Node[],
  container: Element,
  v: Views,
): { nodes: Node[]; base: Element } => {
  let base = container;
  let cur = nodes;
  for (let i = 0; i < 6; i++) {
    const meaningful = cur.filter((n) => !(isText(n) && isBlankText(n.data)) && (isText(n) || isElement(n)));
    if (meaningful.length !== 1) break;
    const only = meaningful[0];
    if (!isElement(only) || !PEELABLE.has(only.localName)) break;
    const keep = both(v, only, (cs) => paintIn(cs) || cs.display() === "inline-block" || cs.box("padding").left > 0)[0];
    if (keep) break;
    base = only;
    cur = Array.from(only.childNodes);
  }
  return { nodes: cur, base };
};

/** The innermost element of a chain of single-child inline wrappers inside `el`. */
export const innermostText = (el: Element, v: Views): Element => peel(Array.from(el.childNodes), el, v).base;

// ─── Images ───────────────────────────────────────────────────────────────────

/** A 1×1 (or smaller than 3×3) image: an open-tracking pixel. */
export const isTrackingPixel = (img: Element, cs: ElStyle): boolean => {
  const w = cs.px("width") ?? parseLen(img.getAttribute("width"))?.n ?? null;
  const h = cs.px("height") ?? parseLen(img.getAttribute("height"))?.n ?? null;
  return w !== null && h !== null && w <= 2 && h <= 2;
};

/**
 * The single image inside `el` when that is all `el` shows: an <img>, or a link,
 * span or picture around one. Null when there is text or more than one image.
 */
export const soleImage = (el: Element): Element | null => {
  if (el.localName === "img") return el;
  const text = normText(el.textContent ?? "");
  if (text) return null;
  const imgs = Array.from(el.querySelectorAll("img"));
  if (imgs.length !== 1) return null;
  // nothing but wrappers between el and the image
  let cur: Element | null = imgs[0].parentElement;
  while (cur && cur !== el) {
    if (!(PEELABLE.has(cur.localName) || cur.localName === "a" || cur.localName === "picture")) return null;
    cur = cur.parentElement;
  }
  return imgs[0];
};

// ─── Social networks ──────────────────────────────────────────────────────────

const NETWORKS: Array<[name: string, pattern: RegExp]> = [
  ["Facebook", /(^|[./])(facebook|fb)\.(com|me)|\bfacebook\b/i],
  ["X", /(^|[./])x\.com|\btwitter-x\b/i],
  ["Twitter", /(^|[./])(twitter\.com|t\.co)|\btwitter\b/i],
  ["Instagram", /(^|[./])instagram\.com|\binstagram\b/i],
  ["Linkedin", /(^|[./])(linkedin\.com|lnkd\.in)|\blinkedin\b/i],
  ["Youtube", /(^|[./])(youtube\.com|youtu\.be)|\byoutube\b/i],
  ["Tiktok", /(^|[./])tiktok\.com|\btiktok\b/i],
  ["Pinterest", /(^|[./])pinterest\.[a-z.]+|\bpinterest\b/i],
  ["Snapchat", /(^|[./])snapchat\.com|\bsnapchat\b/i],
  ["Whatsapp", /(^|[./])(wa\.me|whatsapp\.com)|\bwhatsapp\b/i],
  ["Telegram", /(^|[./])(t\.me|telegram\.me|telegram\.org)|\btelegram\b/i],
  ["Reddit", /(^|[./])reddit\.com|\breddit\b/i],
  ["Github", /(^|[./])github\.com|\bgithub\b/i],
  ["Discord", /(^|[./])discord\.(gg|com)|\bdiscord\b/i],
  ["Threads", /(^|[./])threads\.net|\bthreads\b/i],
  ["Tumblr", /(^|[./])tumblr\.com|\btumblr\b/i],
  ["Vimeo", /(^|[./])vimeo\.com|\bvimeo\b/i],
  ["Medium", /(^|[./])medium\.com|\bmedium\b/i],
  ["Dribbble", /(^|[./])dribbble\.com|\bdribbble\b/i],
  ["Behance", /(^|[./])behance\.net|\bbehance\b/i],
  ["Spotify", /(^|[./])spotify\.com|\bspotify\b/i],
  ["Twitch", /(^|[./])twitch\.tv|\btwitch\b/i],
  ["Mastodon", /\bmastodon\b/i],
];

/** The network a link and its icon point at, from the URL first, then the alt text and file name. */
export const socialName = (href: string, alt: string, src: string): string | null => {
  const file = src.split("/").pop() ?? "";
  for (const text of [href, alt, file]) {
    if (!text) continue;
    for (const [name, re] of NETWORKS) if (re.test(text)) return name;
  }
  return null;
};

// ─── Link rows: menus and socials ─────────────────────────────────────────────

export interface LinkRow {
  kind: "menu" | "socials";
  items: LinkItem[];
  /** Characters such as | or • sat between the links. */
  separators: boolean;
}

const SEPARATORS = /^[\s|•·\-–—/\\»›>*~.:]*$/;

/**
 * Whether `el` holds nothing but links, and which kind of row that makes:
 *   at least two links with short text, separated by nothing or by | • ·   →  menu
 *   links that each hold one small image, one at least a known network      →  socials
 * Anything else (prose with a link in it, a single link) is not a link row.
 */
export const collectLinkItems = (el: Element, v: Views): LinkRow | null => {
  const links = Array.from(el.querySelectorAll("a[href]"));
  if (!links.length) return null;
  if (el.querySelector("p, h1, h2, h3, h4, h5, h6, ul, ol, hr, video")) return null;

  // text that is not inside a link must be separators
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("a").forEach((a) => a.remove());
  const rest = normText(clone.textContent ?? "");
  if (!SEPARATORS.test(rest)) return null;
  const separators = rest.replace(/\s/g, "") !== "";

  const cellOf = (a: Element): Element | null => {
    let cur: Element | null = a.parentElement;
    while (cur && cur !== el) {
      if (cur.localName === "td" || cur.localName === "th" || cur.localName === "span") return cur;
      cur = cur.parentElement;
    }
    return null;
  };

  // links that each take a line are a list of links, not a menu. A block link is fine when every
  // link has a table cell of its own in one row, which is how a row of icons is laid out.
  if (links.length > 1 && links.some((a) => v.cascade.styleOf(a, v.desktop).display() === "block")) {
    const rows = new Set(links.map((a) => a.closest("tr")));
    const cells = new Set(links.map((a) => cellOf(a)));
    const sideBySide = rows.size === 1 && !rows.has(null) && cells.size === links.length && !cells.has(null);
    if (!sideBySide) return null;
  }
  // links drawn as buttons are not menu items
  if (links.some((a) => hasPaint(v, a) || (cellOf(a) !== null && hasPaint(v, cellOf(a) as Element)))) return null;

  const imageLinks = links.filter((a) => a.querySelector("img"));
  if (imageLinks.length === links.length) {
    // socials: every link is only an icon, and the icons are small
    const items: LinkItem[] = [];
    let known = 0;
    for (const a of links) {
      const img = soleImage(a);
      if (!img) return null;
      const ics = v.cascade.styleOf(img, v.desktop);
      const size = ics.px("width") ?? parseLen(img.getAttribute("width"))?.n ?? null;
      if (size !== null && size > 96) return null;
      const name = socialName(a.getAttribute("href") ?? "", img.getAttribute("alt") ?? "", img.getAttribute("src") ?? "");
      if (name) known++;
      items.push({ a, label: name ?? normText(img.getAttribute("alt") ?? ""), href: a.getAttribute("href") ?? "", img, cell: cellOf(a) });
    }
    if (!known) return null;
    return { kind: "socials", items, separators };
  }

  if (imageLinks.length === 0 && links.length >= 2) {
    const items: LinkItem[] = [];
    for (const a of links) {
      const label = normText(a.textContent ?? "");
      if (!label || label.length > 40) return null;
      items.push({ a, label, href: a.getAttribute("href") ?? "", img: null, cell: cellOf(a) });
    }
    return { kind: "menu", items, separators };
  }
  return null;
};
