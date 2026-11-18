// import/css/parse.ts
// ─────────────────────────────────────────────────────────────────────────────
// A small, forgiving CSS parser for the HTML importer
//
// It reads what email stylesheets contain: style rules, @media blocks, and the
// at-rules it has to step over (@font-face, @import, @keyframes, @page, vendor
// blocks). It does not validate. A broken rule is skipped and counted, and the
// rules around it still parse, which is how a browser treats the same sheet.
//
// The output is a flat list of rules, each with its selector list, its
// declarations in source order (shorthands not yet expanded) and the stack of
// @media preludes it sits inside. Order is the rule's position in the whole
// document, which the cascade uses as the last tie-breaker.
//
// No external CSS library on purpose: the importer has to run in the browser
// and in Node with the same behaviour, and it only needs this much of CSS.
// ─────────────────────────────────────────────────────────────────────────────

import { splitCommas, splitTopLevel } from "./values";

export interface Decl {
  /** Lower-case, except custom properties (--x), which keep their case. */
  prop: string;
  value: string;
  important: boolean;
}

export interface Rule {
  /** The selector list, already split on top-level commas. */
  selectors: string[];
  decls: Decl[];
  /** @media preludes this rule sits inside, outermost first. Empty = always. */
  media: string[];
  /** Position of the rule in the document, across all style elements. */
  order: number;
}

export interface ParsedSheet {
  rules: Rule[];
  /** At-rules and chunks that were stepped over, by name, for the report. */
  skipped: Record<string, number>;
}

// ─── Comments and markers ─────────────────────────────────────────────────────

/** Removes /* … *\/ comments (outside strings) and the <!-- --> markers. */
export const stripComments = (css: string): string => {
  let out = "";
  let quote = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < css.length) out += css[++i];
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
    } else if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end === -1) break;
      i = end + 1;
      out += " ";
    } else if (css.startsWith("<!--", i)) {
      i += 3;
      out += " ";
    } else if (css.startsWith("-->", i)) {
      i += 2;
      out += " ";
    } else {
      out += ch;
    }
  }
  return out;
};

// ─── Declarations ─────────────────────────────────────────────────────────────

const PROP_RE = /^(?:--[\w-]+|-?[a-z][a-z0-9-]*)$/i;
const IMPORTANT_RE = /\s*!\s*important\s*$/i;

/** Properties the importer never keeps: scriptable or binding hooks. */
const DROPPED_PROPS = new Set(["behavior", "-moz-binding", "-ms-behavior"]);

/**
 * Parses the inside of a declaration block, or a style="" attribute. Declarations
 * with a malformed name (IE's `*zoom`, `_height` hacks) or a scriptable value
 * (`expression(...)`) are dropped.
 */
export const parseDeclarations = (text: string): Decl[] => {
  const out: Decl[] = [];
  for (const piece of splitTopLevel(stripComments(text), (c) => c === ";")) {
    const colon = piece.indexOf(":");
    if (colon <= 0) continue;
    const rawProp = piece.slice(0, colon).trim();
    if (!PROP_RE.test(rawProp)) continue;
    const prop = rawProp.startsWith("--") ? rawProp : rawProp.toLowerCase();
    if (DROPPED_PROPS.has(prop)) continue;
    let value = piece.slice(colon + 1).trim();
    const important = IMPORTANT_RE.test(value);
    if (important) value = value.replace(IMPORTANT_RE, "").trim();
    if (!value) continue;
    if (/expression\s*\(|javascript\s*:/i.test(value)) continue;
    out.push({ prop, value, important });
  }
  return out;
};

// ─── Blocks ───────────────────────────────────────────────────────────────────

/** The index of the `}` that closes the `{` at `open`, or css.length. */
const findBlockEnd = (css: string, open: number): number => {
  let depth = 0;
  let quote = "";
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length;
};

/** The index of the first top-level `{` or `;` at or after `from`, or -1. */
const findPreludeEnd = (css: string, from: number): number => {
  let paren = 0;
  let quote = "";
  for (let i = from; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") paren++;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (paren === 0 && (ch === "{" || ch === ";")) return i;
  }
  return -1;
};

/** At-rules whose block is read as more rules, in the same media context. */
const TRANSPARENT_AT_RULES = new Set(["supports", "layer", "scope", "starting-style"]);

const bump = (sheet: ParsedSheet, key: string): void => {
  sheet.skipped[key] = (sheet.skipped[key] ?? 0) + 1;
};

const MAX_DEPTH = 8;

const parseInto = (
  css: string,
  media: string[],
  sheet: ParsedSheet,
  counter: { order: number },
  depth: number,
): void => {
  if (depth > MAX_DEPTH) return;
  let i = 0;
  const n = css.length;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;

    if (css[i] === "}" || css[i] === ";") {
      i++;
      continue;
    }

    if (css[i] === "@") {
      const nameMatch = /^@([\w-]+)/.exec(css.slice(i, i + 40));
      const name = (nameMatch?.[1] ?? "").toLowerCase();
      const end = findPreludeEnd(css, i + 1 + name.length);
      if (end === -1) {
        bump(sheet, `@${name || "?"}`);
        break;
      }
      const prelude = css.slice(i + 1 + name.length, end).trim();
      if (css[end] === ";") {
        bump(sheet, `@${name}`);
        i = end + 1;
        continue;
      }
      const close = findBlockEnd(css, end);
      const body = css.slice(end + 1, close);
      if (name === "media") {
        parseInto(body, [...media, prelude], sheet, counter, depth + 1);
      } else if (TRANSPARENT_AT_RULES.has(name)) {
        parseInto(body, media, sheet, counter, depth + 1);
      } else {
        bump(sheet, `@${name}`);
      }
      i = close + 1;
      continue;
    }

    const open = css.indexOf("{", i);
    if (open === -1) break;
    const close = findBlockEnd(css, open);
    const selectorText = css.slice(i, open).trim();
    const body = css.slice(open + 1, close);
    i = close + 1;
    if (!selectorText) continue;
    const selectors = splitCommas(selectorText);
    const decls = parseDeclarations(body);
    if (!selectors.length || !decls.length) {
      if (!decls.length) bump(sheet, "empty-rule");
      continue;
    }
    sheet.rules.push({ selectors, decls, media, order: counter.order++ });
  }
};

/**
 * Parses one style element's text. `counter` carries the rule order across
 * several elements, so a rule in a later <style> wins over an equal one in an
 * earlier one.
 */
export const parseStylesheet = (
  text: string,
  counter: { order: number } = { order: 0 },
): ParsedSheet => {
  const sheet: ParsedSheet = { rules: [], skipped: {} };
  parseInto(stripComments(text), [], sheet, counter, 0);
  return sheet;
};
