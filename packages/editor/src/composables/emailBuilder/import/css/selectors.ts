// import/css/selectors.ts
// ─────────────────────────────────────────────────────────────────────────────
// Selector utilities for the HTML importer
//
// Three small jobs, none of which needs a full selector parser:
//
//   specificity   the (id, class, type) weight of a selector, as one number, so
//                 the cascade can order the rules that match one element
//   selectorKey   the id, class or tag in the rightmost compound selector, which
//                 is what the rule index is keyed on. A rule is only tried on
//                 elements that carry that key
//   classify      is the selector worth matching at all? Hover and focus states
//                 and pseudo-elements never apply to a static document, so they
//                 are skipped (and counted) instead of matched
//
// Matching itself is Element.matches(), the browser's own engine (or jsdom's),
// so combinators, :not(), :nth-child() and attribute selectors behave exactly as
// they do in a mail client's renderer.
// ─────────────────────────────────────────────────────────────────────────────

const isIdentChar = (ch: string): boolean => /[\w-]/.test(ch) || ch > "\u007f" || ch === "\\";

/** The index just past the `)` or `]` that closes the opener at `start`. */
const skipGroup = (s: string, start: number): number => {
  const open = s[start];
  const close = open === "(" ? ")" : "]";
  let depth = 0;
  let quote = "";
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return s.length;
};

const readIdent = (s: string, from: number): number => {
  let i = from;
  while (i < s.length && isIdentChar(s[i])) i++;
  return i;
};

const LEGACY_PSEUDO_ELEMENTS = new Set(["before", "after", "first-line", "first-letter"]);

/** [ids, classes/attributes/pseudo-classes, types/pseudo-elements] */
const countParts = (sel: string): [number, number, number] => {
  let a = 0;
  let b = 0;
  let c = 0;
  let i = 0;
  let atCompoundStart = true;
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === "#") {
      a++;
      i = readIdent(sel, i + 1);
      atCompoundStart = false;
    } else if (ch === ".") {
      b++;
      i = readIdent(sel, i + 1);
      atCompoundStart = false;
    } else if (ch === "[") {
      b++;
      i = skipGroup(sel, i);
      atCompoundStart = false;
    } else if (ch === ":") {
      if (sel[i + 1] === ":") {
        c++;
        i = readIdent(sel, i + 2);
        if (sel[i] === "(") i = skipGroup(sel, i);
      } else {
        const nameEnd = readIdent(sel, i + 1);
        const name = sel.slice(i + 1, nameEnd).toLowerCase();
        i = nameEnd;
        if (sel[i] === "(") {
          const groupEnd = skipGroup(sel, i);
          const inner = sel.slice(i + 1, groupEnd - 1);
          if (name === "not" || name === "is" || name === "matches" || name === "has") {
            // The weight of the heaviest argument.
            let best: [number, number, number] = [0, 0, 0];
            for (const arg of inner.split(",")) {
              const p = countParts(arg.trim());
              if (p[0] > best[0] || (p[0] === best[0] && (p[1] > best[1] || (p[1] === best[1] && p[2] > best[2])))) best = p;
            }
            a += best[0];
            b += best[1];
            c += best[2];
          } else if (name === "where") {
            // no weight
          } else {
            b++;
          }
          i = groupEnd;
        } else if (LEGACY_PSEUDO_ELEMENTS.has(name)) {
          c++;
        } else {
          b++;
        }
      }
      atCompoundStart = false;
    } else if (ch === "*") {
      i++;
      atCompoundStart = false;
    } else if (ch === ">" || ch === "+" || ch === "~" || /\s/.test(ch)) {
      i++;
      atCompoundStart = true;
    } else if (isIdentChar(ch) && atCompoundStart) {
      c++;
      i = readIdent(sel, i);
      atCompoundStart = false;
    } else {
      i++;
    }
  }
  return [a, b, c];
};

/** One number that sorts like (ids, classes, types): a×10000 + b×100 + c. */
export const specificity = (selector: string): number => {
  const [a, b, c] = countParts(selector.trim());
  return Math.min(a, 99) * 10000 + Math.min(b, 99) * 100 + Math.min(c, 99);
};

// ─── Index key ────────────────────────────────────────────────────────────────

export interface SelectorKey {
  kind: "id" | "class" | "tag" | "any";
  key: string;
}

/** The text after the last top-level combinator: the rightmost compound. */
const lastCompound = (sel: string): string => {
  let cut = 0;
  let i = 0;
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === "(" || ch === "[") {
      i = skipGroup(sel, i);
      continue;
    }
    if (ch === ">" || ch === "+" || ch === "~" || /\s/.test(ch)) cut = i + 1;
    i++;
  }
  return sel.slice(cut).trim();
};

/**
 * What a rule can be found by. The rightmost compound is what the matched
 * element itself must satisfy, so an element without the id, the class or the
 * tag cannot match and the rule is never tried on it.
 */
export const selectorKey = (selector: string): SelectorKey => {
  const compound = lastCompound(selector.trim());
  // Pseudo-classes (and their arguments, such as :not(.x)) are left out, so a
  // class inside one is not taken for a requirement of the element.
  let plain = "";
  for (let i = 0; i < compound.length; ) {
    const ch = compound[i];
    if (ch === ":") {
      let j = i + 1;
      if (compound[j] === ":") j++;
      j = readIdent(compound, j);
      i = compound[j] === "(" ? skipGroup(compound, j) : j;
    } else if (ch === "[") {
      i = skipGroup(compound, i);
    } else {
      plain += ch;
      i++;
    }
  }
  const id = /#((?:[\w-]|\\.)+)/.exec(plain);
  if (id) return { kind: "id", key: id[1] };
  const cls = /\.((?:[\w-]|\\.)+)/.exec(plain);
  if (cls) return { kind: "class", key: cls[1] };
  const tag = /^([a-z][\w-]*)/i.exec(plain);
  if (tag) return { kind: "tag", key: tag[1].toLowerCase() };
  return { kind: "any", key: "*" };
};

// ─── Classification ───────────────────────────────────────────────────────────

export type SelectorClass = "ok" | "interactive" | "pseudo-element";

const INTERACTIVE_RE = /:(hover|active|focus|focus-within|focus-visible|target)\b/i;
const PSEUDO_ELEMENT_RE = /::|:(before|after|first-line|first-letter)\b/i;

/**
 * "interactive" (hover, focus, active) and "pseudo-element" (::before, ::after)
 * selectors describe states and generated content that a static import cannot
 * carry. Everything else is matched.
 */
export const classifySelector = (selector: string): SelectorClass => {
  if (PSEUDO_ELEMENT_RE.test(selector)) return "pseudo-element";
  if (INTERACTIVE_RE.test(selector)) return "interactive";
  return "ok";
};

/**
 * Selectors that exist to reach one mail client. They are matched like any
 * other, and almost never match anything here, but the report counts them.
 */
export const isClientHackSelector = (selector: string): boolean =>
  /\.ExternalClass|\.ReadMsgBody|\.yshortcuts|#outlook\b|\bu\s*\+\s*[.#]|\[owa\b|x-apple-data-detectors|\.apple-link|\.mso-|\[class\*?=["']?x_|\.gmail|\.moz-text-html|\.aol_mail|\.Mso/i.test(
    selector,
  );
