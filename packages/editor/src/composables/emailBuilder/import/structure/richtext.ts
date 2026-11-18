// import/structure/richtext.ts
// ─────────────────────────────────────────────────────────────────────────────
// Inline content to the HTML the rich text editor stores
//
// A paragraph, a heading or a list in Maildeno keeps its content as the editor
// writes it: inline HTML only, lines joined with <br>, colours as #hex. This
// module produces exactly that from arbitrary source markup, so the editor loads
// the result without losing anything and a later edit does not change it.
//
// What survives, and how:
//   bold, italic, underline, strike, code   as <strong> <em> <u> <s> <code>,
//                                           whether they came from a tag or from CSS
//   links                                   <a href>, with the colour and the missing
//                                           underline carried in style=""
//   colour, font family, background         one <span style="…"> per element
//   {{ merge_tag }}                         the editor's own merge-tag node
//   line breaks                             <br>
//
// What does not, and is counted in the report: font size, letter spacing,
// line height and text transform *inside* a block (the block's own value is
// kept, which is what the editor can represent), images, sub/superscript.
//
// Marks are decided by comparing an element with its parent's computed style,
// so `<b>` and `font-weight:700` give the same result, and a span that repeats
// what its parent already says adds nothing.
// ─────────────────────────────────────────────────────────────────────────────

import type { Cascade, ElStyle, View } from "../css/cascade";
import { colorToString, primaryFamily, sameColor } from "../css/values";
import { toCssFontFamily } from "../../core/templateFonts";
import type { ReportBuilder } from "../report";
import { linkUrl } from "../map/urls";
import { isBlankText, isElement, isText, normText } from "./dom";

export interface RichTextContext {
  cascade: Cascade;
  /** Content is read in this view. Always the desktop view. */
  view: View;
  report: ReportBuilder;
}

const escapeText = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// ─── Merge tags ───────────────────────────────────────────────────────────────

// The same shapes core/merge-tags and the exporters recognise: {{ name }} and
// {{ name|'default' }}, with a bare word, 'single' or "double"-quoted name.
const MERGE_RE =
  /\{\{\{?\s*(?:'([^']*)'|"([^"]*)"|(\w+))(?:\s*\|\s*(?:'([^']*)'|"([^"]*)"|([^'"}\s][^'"}]*?)))?\s*\}?\}\}/g;

const OTHER_MERGE_RE = /\*\|[A-Za-z0-9_:]+\|\*|%%[\w ]+%%|\$\{[\w.]+\}|\[\[[\w ]+\]\]|\{\$[\w.]+\}|\{%[^%]*%\}/;

/** Escapes a text node and turns {{ merge_tags }} into the editor's chips. */
const textToHtml = (text: string, ctx: RichTextContext): string => {
  if (OTHER_MERGE_RE.test(text)) {
    ctx.report.warn(
      "merge-syntax",
      "Merge tags in another syntax (Mailchimp *|TAG|*, %%tag%%, ${tag}, Liquid) were kept as plain text.",
    );
  }
  let out = "";
  let last = 0;
  MERGE_RE.lastIndex = 0;
  for (let m = MERGE_RE.exec(text); m; m = MERGE_RE.exec(text)) {
    out += escapeText(text.slice(last, m.index));
    const name = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    let fallback = (m[4] ?? m[5] ?? m[6] ?? "").trim();
    last = m.index + m[0].length;
    // Maildeno's own export writes a default after the tag as a comment: {{ name }}{{!-- default: there --}}
    const note = /^\{\{!--\s*default:\s*([\s\S]*?)\s*--\}\}/.exec(text.slice(last));
    if (note) {
      if (!fallback) fallback = note[1].trim();
      last += note[0].length;
      MERGE_RE.lastIndex = last;
    }
    const shown = fallback ? `{{ ${name}|'${fallback}' }}` : `{{ ${name} }}`;
    out +=
      `<span data-merge="${escapeAttr(name)}" data-merge-default="${escapeAttr(fallback)}" contenteditable="false">` +
      `${escapeText(shown)}</span>`;
  }
  out += escapeText(text.slice(last));
  return out;
};

// ─── Marks ────────────────────────────────────────────────────────────────────

const UA_LINK_COLOR = "#0000ee";

const family = (cs: ElStyle): string | null => primaryFamily(cs.inh("font-family"))?.family ?? null;

const dropped = (ctx: RichTextContext, what: string): void => {
  ctx.report.warn(
    `inline-${what}`,
    `Changes of ${what} inside a text block were flattened: the block keeps one ${what}.`,
  );
};

const wrapElement = (el: Element, cs: ElStyle, parent: ElStyle, inner: string, ctx: RichTextContext): string => {
  const tag = el.localName;
  let html = inner;
  if (!html) return "";

  // — decorations and weight, innermost first
  const deco = cs.decorations();
  const parentDeco = parent.decorations();
  // a link with no usable target is text: its colour and underline are written as marks
  const href = tag === "a" && el.hasAttribute("href") ? linkUrl(el.getAttribute("href"), ctx.report) : "";
  const isLink = href !== "";

  if (tag === "code" || tag === "kbd" || tag === "samp" || tag === "tt") html = `<code>${html}</code>`;
  if (deco.lineThrough && !parentDeco.lineThrough) html = `<s>${html}</s>`;
  if (!isLink && deco.underline && !parentDeco.underline) html = `<u>${html}</u>`;
  if (cs.italic() && !parent.italic()) html = `<em>${html}</em>`;
  if (cs.fontWeight() >= 600 && parent.fontWeight() < 600) html = `<strong>${html}</strong>`;

  // — what a span can carry
  const style: string[] = [];
  const color = cs.textColor();
  if (!sameColor(color, parent.textColor()) && !isLink) style.push(`color: ${colorToString(color)}`);
  const fam = family(cs);
  if (fam && fam !== family(parent)) style.push(`font-family: ${toCssFontFamily(fam)}`);
  const bg = cs.color("background-color");
  if (bg && bg.a > 0 && !sameColor(bg, parent.color("background-color"))) {
    style.push(`background-color: ${colorToString(bg)}`);
  }
  if (style.length && !isLink) html = `<span style="${escapeAttr(style.join("; "))}">${html}</span>`;

  // — things the editor cannot hold inside a block
  // sub and sup are reported on their own; their smaller size comes with them
  if (Math.abs(cs.fontSize() - parent.fontSize()) > 0.5 && cs.fontSize() > 0 && tag !== "sub" && tag !== "sup") {
    dropped(ctx, "font-size");
  }
  if (Math.abs(cs.letterSpacing() - parent.letterSpacing()) > 0.05) dropped(ctx, "letter-spacing");
  if (cs.textTransform() !== parent.textTransform()) dropped(ctx, "text-transform");
  if (tag === "sub" || tag === "sup") ctx.report.drop("sub-sup", "Subscript and superscript are not supported and were shown as normal text.");

  // — links last, so they sit outermost
  if (isLink) {
    const linkStyle: string[] = [];
    // the browser's own link blue is what an unstyled link already is, so it is not written out
    if (!sameColor(color, parent.textColor()) && colorToString(color) !== UA_LINK_COLOR) {
      linkStyle.push(`color: ${colorToString(color)}`);
    }
    if (!deco.underline) linkStyle.push("text-decoration: none");
    const styleAttr = linkStyle.length ? ` style="${escapeAttr(linkStyle.join("; "))}"` : "";
    html = `<a href="${escapeAttr(href)}"${styleAttr}>${html}</a>`;
  }
  return html;
};

// ─── Walk ─────────────────────────────────────────────────────────────────────

const walk = (node: Node, parent: ElStyle, ctx: RichTextContext): string => {
  if (isText(node)) {
    const text = node.data.replace(/[​‌‍⁠͏­﻿]/g, "").replace(/\s+/g, " ");
    return text ? textToHtml(text, ctx) : "";
  }
  if (!isElement(node)) return "";
  const tag = node.localName;
  if (tag === "br") return "<br>";
  if (tag === "script" || tag === "style" || tag === "head") return "";
  if (tag === "img") {
    ctx.report.drop("inline-image", "Images inside a line of text are not supported; they were split out or left out.");
    return "";
  }
  const cs = ctx.cascade.styleOf(node, ctx.view);
  if (cs.isHidden()) return "";
  const inner = Array.from(node.childNodes)
    .map((child) => walk(child, cs, ctx))
    .join("");
  return wrapElement(node, cs, parent, inner, ctx);
};

/** Cleans up the joined output: single spaces, no space around <br>, no edge breaks. */
const tidy = (html: string): string =>
  html
    .replace(/ {2,}/g, " ")
    .replace(/ <br>/g, "<br>")
    .replace(/<br> /g, "<br>")
    .replace(/^(?:\s|<br>)+/, "")
    .replace(/(?:\s|<br>)+$/, "")
    .replace(/(<br>){3,}/g, "<br><br>");

/**
 * The editor's content string for `nodes`, with marks decided against `base`,
 * the element the block's own typography is read from.
 */
export const toRichText = (nodes: Node[], base: Element, ctx: RichTextContext): string => {
  const baseCs = ctx.cascade.styleOf(base, ctx.view);
  return tidy(nodes.map((n) => walk(n, baseCs, ctx)).join(""));
};

/** A list element as `<ul><li>…</li></ul>`, items flattened to one level. */
export const toListHtml = (list: Element, base: Element, ctx: RichTextContext): string => {
  const ordered = list.localName === "ol";
  const items: string[] = [];
  const baseCs = ctx.cascade.styleOf(base, ctx.view);
  const collect = (ul: Element, depth: number): void => {
    for (const child of Array.from(ul.children)) {
      if (child.localName === "li") {
        // the item's own text, without any nested list
        const own = Array.from(child.childNodes).filter(
          (n) => !(isElement(n) && (n.localName === "ul" || n.localName === "ol")),
        );
        const html = tidy(own.map((n) => walk(n, baseCs, ctx)).join(""));
        if (html) items.push(`<li>${html}</li>`);
        for (const nested of Array.from(child.children)) {
          if (nested.localName === "ul" || nested.localName === "ol") {
            ctx.report.fallback("nested-list", "Nested lists were flattened to one level.");
            collect(nested, depth + 1);
          }
        }
      }
    }
  };
  collect(list, 0);
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.join("")}</${tag}>`;
};

/** The visible text of nodes, for props that hold plain text (button text, menu labels). */
export const plainFromNodes = (nodes: Node[]): string =>
  normText(nodes.map((n) => n.textContent ?? "").join(" "));

/** Whether nodes hold no text at all (only whitespace, breaks, comments). */
export const nodesAreBlank = (nodes: Node[]): boolean =>
  nodes.every((n) => {
    if (isText(n)) return isBlankText(n.data);
    if (isElement(n)) return n.localName === "br" || isBlankText(n.textContent ?? "") && !n.querySelector("img,video");
    return true;
  });
