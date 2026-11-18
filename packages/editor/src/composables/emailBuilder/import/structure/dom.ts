// import/structure/dom.ts
// ─────────────────────────────────────────────────────────────────────────────
// Small DOM helpers shared by the analyzer and the readers
// ─────────────────────────────────────────────────────────────────────────────

export const isElement = (n: Node | null | undefined): n is Element => !!n && n.nodeType === 1;
export const isText = (n: Node | null | undefined): n is Text => !!n && n.nodeType === 3;

/** Characters that take no space and carry no content: zero-width, soft hyphen, BOM. */
const INVISIBLE = /[​‌‍⁠͏­﻿]/g;

/** Whitespace collapsed to single spaces, invisible characters removed, trimmed. */
export const normText = (s: string): string =>
  s.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();

export const isBlankText = (s: string): boolean => normText(s) === "";

export const textOf = (n: Node): string => normText(n.textContent ?? "");

export const elementChildren = (el: Element): Element[] => Array.from(el.children);

/** Tags that carry inline content and are never layout containers. */
export const INLINE_TAGS = new Set(
  "a abbr acronym b bdi bdo big br cite code del dfn em font i img ins kbd label mark nobr picture q s samp small span strike strong sub sup time tt u var video wbr".split(
    " ",
  ),
);

/** Tags the importer never reads: no content, or already handled elsewhere. */
export const SKIP_TAGS = new Set(["script", "style", "head", "meta", "link", "title", "noscript", "template", "base", "area", "param", "source", "track", "datalist", "map"]);

/** The direct <tr> children of a table, through any <thead>/<tbody>/<tfoot>. */
export const tableRows = (table: Element): Element[] => {
  const rows: Element[] = [];
  for (const child of Array.from(table.children)) {
    const tag = child.localName;
    if (tag === "tr") rows.push(child);
    else if (tag === "thead" || tag === "tbody" || tag === "tfoot") {
      for (const tr of Array.from(child.children)) if (tr.localName === "tr") rows.push(tr);
    }
  }
  return rows;
};

/** The direct <td>/<th> children of a row. */
export const rowCells = (tr: Element): Element[] =>
  Array.from(tr.children).filter((c) => c.localName === "td" || c.localName === "th");

/**
 * Whether a node tree has anything a reader can see: text, an image, a video,
 * a list or a rule. Whitespace, nbsp and zero-width characters do not count.
 */
export const hasVisibleContent = (node: Node): boolean => {
  if (isText(node)) return !isBlankText(node.data);
  if (!isElement(node)) return false;
  const tag = node.localName;
  if (tag === "img" || tag === "video" || tag === "hr") return true;
  if (SKIP_TAGS.has(tag)) return false;
  return Array.from(node.childNodes).some(hasVisibleContent);
};

/** A URL kept for a prop: trimmed, protocol-relative made https. */
export const cleanUrl = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const t = raw.trim().replace(/"/g, "%22");
  if (t.startsWith("//")) return `https:${t}`;
  return t;
};

/** Whether a link will survive Maildeno's export as written (safeUrl leaves it alone). */
export const isExportSafeUrl = (url: string): boolean =>
  /\{\{.*?\}\}/.test(url) || /^(https?:\/\/|mailto:|tel:)/i.test(url);

/** Text for a prop that is escaped on the way out: no markup characters. */
export const plainText = (s: string): string => normText(s).replace(/[<>]/g, "");
