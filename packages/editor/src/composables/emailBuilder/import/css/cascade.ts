// import/css/cascade.ts
// ─────────────────────────────────────────────────────────────────────────────
// The importer's own cascade
//
// The browser's getComputedStyle is not used, for three reasons: it does not
// exist in Node, it answers for one viewport, and it hands back resolved values
// (every colour as rgb(), every length in px) where the importer needs to know
// what the source declared. So this module does the part of CSS the importer
// needs, over a DOM it only reads:
//
//   harvest    every <style> (head and body), every style="" attribute and the
//              legacy presentational attributes (bgcolor, width, align, valign,
//              cellpadding, background, <font>) become declarations
//   cascade    per element and per view: user-agent defaults < presentational
//              hints < author rules (specificity, then source order) < inline
//              style < !important author < !important inline. A rule inside
//              @media takes part only when its query holds in the view
//   inherit    colour, font, line-height, text-align and friends walk up the tree;
//              relative font sizes resolve against the parent
//
// A view is a viewport: the importer asks the same element twice, once at a
// desktop width and once at a phone width, and the difference between the two
// answers is what becomes a Maildeno `mobile` override.
//
// Selector matching is Element.matches(), so the same code runs in a browser
// and in jsdom. Hover, focus and pseudo-element rules are skipped and counted.
// ─────────────────────────────────────────────────────────────────────────────

import {
  parseDeclarations,
  parseStylesheet,
  type Decl,
  type Rule,
} from "./parse";
import {
  classifySelector,
  isClientHackSelector,
  selectorKey,
  specificity,
  type SelectorKey,
} from "./selectors";
import {
  evalMediaStack,
  mediaWidthThresholds,
  type MediaResult,
  type Viewport,
} from "./media";
import {
  expandShorthand,
  fallbackTracker,
  lenToPx,
  parseColor,
  parseLen,
  resolveVars,
  type Longhand,
  type Rgba,
} from "./values";

// ─── Views ────────────────────────────────────────────────────────────────────

export interface View {
  name: "desktop" | "phone";
  viewport: Viewport;
}

export const DESKTOP_VIEW: View = {
  name: "desktop",
  viewport: { width: 1024, height: 768 },
};

/** The phone view for a breakpoint: one pixel under it, and never wider than 375. */
export const phoneViewFor = (breakpoint: number): View => ({
  name: "phone",
  viewport: { width: Math.max(280, Math.min(breakpoint - 1, 375)), height: 667 },
});

// ─── What the harvest found ───────────────────────────────────────────────────

export interface CascadeStats {
  styleElements: number;
  rules: number;
  inlineStyleElements: number;
  /** hover, focus and similar rules, which a static import cannot keep */
  interactiveRules: number;
  pseudoElementRules: number;
  clientHackRules: number;
  /** rules inside @media that cannot be evaluated here (dark mode, retina) */
  ignoredMediaRules: number;
  /** selectors Element.matches() refused */
  unsupportedSelectors: number;
  /** at-rules and empty rules that were stepped over, by name */
  skipped: Record<string, number>;
  unresolvedVars: number;
}

interface DeclEntry {
  prop: string;
  value: string;
  important: boolean;
  idx: number;
}

interface Entry {
  selector: string;
  spec: number;
  order: number;
  decls: DeclEntry[];
  media: string[];
  key: SelectorKey;
}

interface Candidate {
  value: string;
  tier: number;
  spec: number;
  order: number;
  idx: number;
}

// ─── User-agent defaults ──────────────────────────────────────────────────────

const BLOCK_TAGS = new Set(
  "address article aside blockquote body center dd details div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr html legend main menu nav ol p pre section summary ul".split(
    " ",
  ),
);

const NONE_TAGS = new Set(
  "head script style title meta link base template noscript area datalist param source track".split(" "),
);

const TABLE_DISPLAY: Record<string, string> = {
  table: "table",
  thead: "table-header-group",
  tbody: "table-row-group",
  tfoot: "table-footer-group",
  tr: "table-row",
  td: "table-cell",
  th: "table-cell",
  caption: "table-caption",
  col: "table-column",
  colgroup: "table-column-group",
  li: "list-item",
};

const HEADING_SIZE: Record<string, string> = {
  h1: "2em",
  h2: "1.5em",
  h3: "1.17em",
  h4: "1em",
  h5: "0.83em",
  h6: "0.67em",
};

const HEADING_MARGIN: Record<string, string> = {
  h1: "0.67em",
  h2: "0.83em",
  h3: "1em",
  h4: "1.33em",
  h5: "1.67em",
  h6: "2.33em",
};

/** The default look of an element, before any author style. */
const uaDecls = (el: Element): Longhand[] => {
  const tag = el.localName;
  const out: Longhand[] = [];
  if (NONE_TAGS.has(tag) || el.hasAttribute("hidden")) out.push(["display", "none"]);
  else if (TABLE_DISPLAY[tag]) out.push(["display", TABLE_DISPLAY[tag]]);
  else if (BLOCK_TAGS.has(tag)) out.push(["display", "block"]);
  else out.push(["display", "inline"]);

  if (/^h[1-6]$/.test(tag)) {
    out.push(["font-size", HEADING_SIZE[tag]], ["font-weight", "bold"]);
    out.push(["margin-top", HEADING_MARGIN[tag]], ["margin-bottom", HEADING_MARGIN[tag]]);
  }
  switch (tag) {
    case "p":
    case "dl":
    case "pre":
    case "figure":
      out.push(["margin-top", "1em"], ["margin-bottom", "1em"]);
      break;
    case "ul":
    case "ol":
      out.push(["margin-top", "1em"], ["margin-bottom", "1em"], ["padding-left", "40px"]);
      break;
    case "blockquote":
      out.push(["margin-top", "1em"], ["margin-bottom", "1em"], ["margin-left", "40px"], ["margin-right", "40px"]);
      break;
    case "hr":
      out.push(["margin-top", "0.5em"], ["margin-bottom", "0.5em"], ["margin-left", "auto"], ["margin-right", "auto"]);
      out.push(["border-top-width", "1px"], ["border-top-style", "inset"], ["border-top-color", "gray"]);
      break;
    case "b":
    case "strong":
    case "th":
      out.push(["font-weight", "bold"]);
      break;
    case "i":
    case "em":
    case "cite":
    case "dfn":
    case "var":
    case "address":
      out.push(["font-style", "italic"]);
      break;
    case "u":
    case "ins":
      out.push(["text-decoration-line", "underline"]);
      break;
    case "s":
    case "strike":
    case "del":
      out.push(["text-decoration-line", "line-through"]);
      break;
    case "a":
      if (el.hasAttribute("href")) {
        out.push(["color", "#0000ee"], ["text-decoration-line", "underline"]);
      }
      break;
    case "small":
    case "sub":
    case "sup":
      out.push(["font-size", "smaller"]);
      break;
    case "big":
      out.push(["font-size", "larger"]);
      break;
    case "center":
      out.push(["text-align", "center"]);
      break;
    case "code":
    case "kbd":
    case "samp":
    case "tt":
      out.push(["font-family", "monospace"]);
      break;
  }
  // centred, unless an ancestor sets the alignment itself (see ElStyle.textAlign)
  if (tag === "th") out.push(["text-align", "-internal-center"]);
  // table sections and rows pass their vertical alignment on to the cells, and
  // the table body's own default is middle
  if (tag === "tbody" || tag === "thead" || tag === "tfoot") out.push(["vertical-align", "middle"]);
  if (tag === "td" || tag === "th" || tag === "tr") out.push(["vertical-align", "inherit"]);
  return out;
};

// ─── Presentational hints (legacy attributes) ─────────────────────────────────

const HTML_FONT_SIZES = ["10px", "13px", "16px", "18px", "24px", "32px", "48px"];

/** `<font size>` to a CSS length: 1-7, or +n / -n against 3. */
const fontSizeFromAttr = (raw: string): string | null => {
  const t = raw.trim();
  const m = /^([+-]?)(\d)$/.exec(t);
  if (!m) return null;
  let n = parseInt(m[2], 10);
  if (m[1] === "+") n = 3 + n;
  else if (m[1] === "-") n = 3 - n;
  n = Math.min(7, Math.max(1, n));
  return HTML_FONT_SIZES[n - 1];
};

/** A width/height attribute: `600` is 600px, `50%` stays, `*` and junk are dropped. */
const dimensionFromAttr = (raw: string | null): string | null => {
  if (raw === null) return null;
  const t = raw.trim();
  if (/^\d+(\.\d+)?%$/.test(t)) return t;
  if (/^\d+(\.\d+)?(px)?$/i.test(t)) return /px$/i.test(t) ? t : `${t}px`;
  return null;
};

const hintDecls = (el: Element): Longhand[] => {
  const tag = el.localName;
  const out: Longhand[] = [];
  const attr = (name: string): string | null => el.getAttribute(name);

  const bgcolor = attr("bgcolor");
  if (bgcolor && /^(body|table|tr|td|th|tbody|thead|tfoot)$/.test(tag)) {
    // Legacy colour values may lack the hash (`bgcolor="ffffff"`).
    const v = /^[0-9a-f]{6}$/i.test(bgcolor.trim()) ? `#${bgcolor.trim()}` : bgcolor.trim();
    out.push(["background-color", v]);
  }
  const background = attr("background");
  if (background && /^(body|table|td|th)$/.test(tag)) {
    out.push(["background-image", `url("${background.trim().replace(/"/g, "%22")}")`]);
  }

  if (/^(table|td|th|img|col|hr|video|iframe)$/.test(tag)) {
    const w = dimensionFromAttr(attr("width"));
    if (w) out.push(["width", w]);
  }
  if (/^(table|td|th|tr|img|video|iframe)$/.test(tag)) {
    const h = dimensionFromAttr(attr("height"));
    if (h) out.push(["height", h]);
  }

  const align = attr("align")?.trim().toLowerCase();
  if (align) {
    if (tag === "table") {
      if (align === "center") out.push(["margin-left", "auto"], ["margin-right", "auto"]);
      else if (align === "left" || align === "right") out.push(["float", align]);
    } else if (tag === "img") {
      if (align === "left" || align === "right") out.push(["float", align]);
      else if (align === "top" || align === "middle" || align === "bottom") out.push(["vertical-align", align]);
    } else if (tag === "hr") {
      if (align === "left") out.push(["margin-left", "0"], ["margin-right", "auto"]);
      else if (align === "right") out.push(["margin-left", "auto"], ["margin-right", "0"]);
    } else if (/^(td|th|tr|tbody|thead|tfoot|div|p|h[1-6]|caption|col|colgroup|center|section|span)$/.test(tag)) {
      if (align === "middle") out.push(["text-align", "center"]);
      else if (/^(left|right|center|justify)$/.test(align)) out.push(["text-align", align]);
    }
  }

  const valign = attr("valign")?.trim().toLowerCase();
  if (valign && /^(td|th|tr|tbody|thead|tfoot|col|colgroup)$/.test(tag)) {
    if (/^(top|middle|bottom|baseline)$/.test(valign)) out.push(["vertical-align", valign]);
  }

  if ((tag === "td" || tag === "th") && el.hasAttribute("nowrap")) out.push(["white-space", "nowrap"]);

  if (tag === "td" || tag === "th") {
    const table = el.closest("table");
    const pad = table?.getAttribute("cellpadding");
    if (pad && /^\d+(\.\d+)?%?$/.test(pad.trim())) {
      const v = pad.trim().endsWith("%") ? pad.trim() : `${pad.trim()}px`;
      out.push(["padding-top", v], ["padding-right", v], ["padding-bottom", v], ["padding-left", v]);
    }
  }
  if (tag === "table") {
    const b = attr("border");
    if (b && /^\d+$/.test(b.trim()) && parseInt(b, 10) > 0) {
      const v = `${parseInt(b, 10)}px`;
      for (const side of ["top", "right", "bottom", "left"]) {
        out.push([`border-${side}-width`, v], [`border-${side}-style`, "outset"], [`border-${side}-color`, "gray"]);
      }
    }
    const spacing = attr("cellspacing");
    if (spacing && /^\d+$/.test(spacing.trim())) out.push(["border-spacing", `${spacing.trim()}px`]);
  }
  if (tag === "font") {
    const color = attr("color");
    if (color) out.push(["color", /^[0-9a-f]{6}$/i.test(color.trim()) ? `#${color.trim()}` : color.trim()]);
    const face = attr("face");
    if (face) out.push(["font-family", face]);
    const size = attr("size");
    const fs = size ? fontSizeFromAttr(size) : null;
    if (fs) out.push(["font-size", fs]);
  }
  if (tag === "body") {
    const text = attr("text");
    if (text) out.push(["color", /^[0-9a-f]{6}$/i.test(text.trim()) ? `#${text.trim()}` : text.trim()]);
  }
  return out;
};

// ─── Inheritance ──────────────────────────────────────────────────────────────

const INHERITED = new Set([
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-variant",
  "letter-spacing",
  "line-height",
  "text-align",
  "text-indent",
  "text-transform",
  "white-space",
  "word-break",
  "word-spacing",
  "direction",
  "visibility",
  "border-collapse",
  "border-spacing",
  "list-style-type",
]);

const FONT_SIZE_KEYWORDS: Record<string, number> = {
  "xx-small": 9,
  "x-small": 10,
  small: 13,
  medium: 16,
  large: 18,
  "x-large": 24,
  "xx-large": 32,
  "xxx-large": 48,
};

// ─── The computed view of one element ─────────────────────────────────────────

export class ElStyle {
  private _fontSize: number | null = null;

  constructor(
    readonly el: Element,
    private readonly cascade: Cascade,
    readonly view: View,
    private readonly declared: ReadonlyMap<string, string>,
  ) {}

  get parent(): ElStyle | null {
    const p = this.el.parentElement;
    return p ? this.cascade.styleOf(p, this.view) : null;
  }

  /**
   * The value the cascade picked for `prop` on this element itself, with the
   * wide keywords applied: inherit reads the parent, initial and revert give
   * nothing, unset inherits only inherited properties.
   */
  get(prop: string): string | undefined {
    const v = this.declared.get(prop);
    if (v === undefined) return undefined;
    const low = v.toLowerCase();
    if (low === "inherit") return this.parent?.get(prop);
    if (low === "initial" || low === "revert" || low === "revert-layer") return undefined;
    if (low === "unset") return INHERITED.has(prop) ? this.parent?.get(prop) : undefined;
    return v;
  }

  /** `get`, then the ancestors, for properties that inherit. */
  inh(prop: string): string | undefined {
    const v = this.get(prop);
    if (v !== undefined) return v;
    return this.parent?.inh(prop);
  }

  /** The element whose declaration `inh(prop)` returns, or null. */
  inhSource(prop: string): ElStyle | null {
    if (this.get(prop) !== undefined) return this;
    return this.parent?.inhSource(prop) ?? null;
  }

  display(): string {
    return (this.get("display") ?? "inline").toLowerCase();
  }

  /** display:none on this element itself. */
  isHidden(): boolean {
    return this.display() === "none";
  }

  /** Font size in px, resolved through the ancestors. Never below 0. */
  fontSize(): number {
    if (this._fontSize !== null) return this._fontSize;
    const parentPx = this.parent ? this.parent.fontSize() : 16;
    const raw = this.get("font-size")?.trim().toLowerCase();
    let size = parentPx;
    if (raw) {
      if (raw in FONT_SIZE_KEYWORDS) size = FONT_SIZE_KEYWORDS[raw];
      else if (raw === "smaller") size = parentPx / 1.2;
      else if (raw === "larger") size = parentPx * 1.2;
      else {
        const len = parseLen(raw);
        if (len?.unit === "%") size = (parentPx * len.n) / 100;
        else {
          const v = lenToPx(len, { em: parentPx, rem: 16 });
          if (v !== null) size = v;
        }
      }
    }
    this._fontSize = Math.max(0, size);
    return this._fontSize;
  }

  /** A length property in px (em against this element's font size), or null. */
  px(prop: string): number | null {
    return lenToPx(parseLen(this.get(prop)), { em: this.fontSize(), rem: 16 });
  }

  /** The raw length for a property, `{n, unit}`, or null. */
  len(prop: string) {
    return parseLen(this.get(prop));
  }

  /** A colour property, with currentColor resolved. Null when not declared. */
  color(prop: string): Rgba | null {
    const raw = this.get(prop);
    if (raw === undefined) return null;
    return parseColor(raw, this.textColor());
  }

  /** The inherited text colour. Black when nothing sets one. */
  textColor(): Rgba {
    const src = this.inhSource("color");
    const raw = src?.get("color");
    if (!raw || !src) return { r: 0, g: 0, b: 0, a: 1 };
    if (raw.trim().toLowerCase() === "currentcolor") return src.parent?.textColor() ?? { r: 0, g: 0, b: 0, a: 1 };
    return parseColor(raw) ?? { r: 0, g: 0, b: 0, a: 1 };
  }

  /** font-weight as a number: normal 400, bold 700, bolder/lighter step from the parent. */
  fontWeight(): number {
    const src = this.inhSource("font-weight");
    const raw = src?.get("font-weight")?.trim().toLowerCase();
    if (!raw || !src) return 400;
    const parentWeight = src.parent?.fontWeight() ?? 400;
    if (raw === "normal") return 400;
    if (raw === "bold") return 700;
    if (raw === "bolder") return parentWeight < 600 ? 700 : 900;
    if (raw === "lighter") return parentWeight > 500 ? 400 : 100;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(900, Math.max(100, n)) : 400;
  }

  italic(): boolean {
    const raw = this.inh("font-style")?.toLowerCase();
    return raw === "italic" || raw === "oblique";
  }

  /**
   * Line height as a multiple of the font size. A unitless value inherits as
   * the number; a length or percentage was computed where it was declared and
   * inherits as pixels, so it is divided by this element's own font size.
   */
  lineHeight(): number {
    const src = this.inhSource("line-height");
    const raw = src?.get("line-height")?.trim().toLowerCase();
    if (!raw || !src || raw === "normal") return 1.2;
    const len = parseLen(raw);
    if (!len) return 1.2;
    if (len.unit === "") return len.n;
    const declaredPx =
      len.unit === "%" ? (src.fontSize() * len.n) / 100 : lenToPx(len, { em: src.fontSize(), rem: 16 });
    if (declaredPx === null) return 1.2;
    const own = this.fontSize();
    return own > 0 ? declaredPx / own : 1.2;
  }

  letterSpacing(): number {
    const raw = this.inh("letter-spacing")?.trim().toLowerCase();
    if (!raw || raw === "normal") return 0;
    return lenToPx(parseLen(raw), { em: this.fontSize(), rem: 16 }) ?? 0;
  }

  textAlign(): "left" | "center" | "right" | "justify" {
    let raw = this.inh("text-align")?.trim().toLowerCase().replace("-webkit-", "").replace("-moz-", "");
    if (raw === "-internal-center") {
      // a <th> centres its text unless something above it has set the alignment: <tr style="text-align:left">
      const above = this.parent?.inh("text-align")?.trim().toLowerCase().replace("-webkit-", "").replace("-moz-", "");
      raw = above && above !== "-internal-center" ? above : "center";
    }
    if (raw === "center" || raw === "right" || raw === "justify") return raw;
    if (raw === "end") return "right";
    return "left";
  }

  textTransform(): "none" | "uppercase" | "lowercase" | "capitalize" {
    const raw = this.inh("text-transform")?.trim().toLowerCase();
    if (raw === "uppercase" || raw === "lowercase" || raw === "capitalize") return raw;
    return "none";
  }

  /**
   * Whether this element's text is underlined or struck through, from its own
   * declarations and from the ancestors, which pass it down to in-flow content
   * but not into inline-blocks or floats.
   */
  decorations(): { underline: boolean; lineThrough: boolean } {
    const out = { underline: false, lineThrough: false };
    let cur: ElStyle | null = this;
    while (cur) {
      const raw = (cur.get("text-decoration-line") ?? "").toLowerCase();
      if (/\bnone\b/.test(raw) && cur === this) return out;
      if (/\bunderline\b/.test(raw)) out.underline = true;
      if (/\bline-through\b/.test(raw)) out.lineThrough = true;
      const d = cur.display();
      if (d === "inline-block" || d === "inline-table" || cur.get("float")?.toLowerCase() === "left" || cur.get("float")?.toLowerCase() === "right") break;
      cur = cur.parent;
    }
    return out;
  }

  /** margin or padding in px per side. A percentage or `auto` reads as 0. */
  box(kind: "margin" | "padding"): { top: number; right: number; bottom: number; left: number } {
    const side = (s: string): number => this.px(`${kind}-${s}`) ?? 0;
    return { top: side("top"), right: side("right"), bottom: side("bottom"), left: side("left") };
  }

  /** margin-left/right: auto, which centres or right-aligns a block. */
  autoMargins(): { left: boolean; right: boolean } {
    return {
      left: this.get("margin-left")?.trim().toLowerCase() === "auto",
      right: this.get("margin-right")?.trim().toLowerCase() === "auto",
    };
  }

  /** One border side. Width 0 when the style is none/hidden or nothing is declared. */
  border(side: "top" | "right" | "bottom" | "left"): { width: number; style: string; color: Rgba | null } {
    const style = (this.get(`border-${side}-style`) ?? "none").trim().toLowerCase();
    const width = style === "none" || style === "hidden" ? 0 : (this.px(`border-${side}-width`) ?? 3);
    const color = this.color(`border-${side}-color`) ?? this.textColor();
    return { width, style, color };
  }

  /** Corner radii in px: [top-left, top-right, bottom-right, bottom-left]. */
  radii(): [number, number, number, number] {
    const corner = (c: string): number => this.px(`border-${c}-radius`) ?? 0;
    return [corner("top-left"), corner("top-right"), corner("bottom-right"), corner("bottom-left")];
  }
}

// ─── The cascade ──────────────────────────────────────────────────────────────

const ROOT_VAR_SELECTORS = /^(:root|html|body|\*)$/i;

export class Cascade {
  readonly stats: CascadeStats = {
    styleElements: 0,
    rules: 0,
    inlineStyleElements: 0,
    interactiveRules: 0,
    pseudoElementRules: 0,
    clientHackRules: 0,
    ignoredMediaRules: 0,
    unsupportedSelectors: 0,
    skipped: {},
    unresolvedVars: 0,
  };

  readonly vars = new Map<string, string>();

  private readonly byId = new Map<string, Entry[]>();
  private readonly byClass = new Map<string, Entry[]>();
  private readonly byTag = new Map<string, Entry[]>();
  private readonly any: Entry[] = [];
  private readonly entries: Entry[] = [];

  private readonly cache = new Map<string, WeakMap<Element, ElStyle>>();
  private readonly inlineCache = new WeakMap<Element, Decl[]>();
  private readonly mediaCache = new Map<string, Map<string, MediaResult>>();
  private ignoredCounted = new Set<Entry>();

  constructor(doc: Document) {
    this.harvest(doc);
  }

  // ── Harvest ────────────────────────────────────────────────────────────────

  private harvest(doc: Document): void {
    const counter = { order: 0 };
    const rules: Rule[] = [];
    const styleEls = Array.from(doc.querySelectorAll("style"));
    this.stats.styleElements = styleEls.length;

    for (const el of styleEls) {
      const mediaAttr = el.getAttribute("media")?.trim();
      const sheet = parseStylesheet(el.textContent ?? "", counter);
      for (const [name, n] of Object.entries(sheet.skipped)) {
        this.stats.skipped[name] = (this.stats.skipped[name] ?? 0) + n;
      }
      for (const rule of sheet.rules) {
        if (mediaAttr && mediaAttr.toLowerCase() !== "all") {
          rules.push({ ...rule, media: [mediaAttr, ...rule.media] });
        } else {
          rules.push(rule);
        }
      }
    }
    this.stats.rules = rules.length;

    // Custom properties first, so var() in any later value can resolve.
    for (const rule of rules) {
      if (rule.media.length) continue;
      if (!rule.selectors.some((s) => ROOT_VAR_SELECTORS.test(s.trim()))) continue;
      for (const d of rule.decls) if (d.prop.startsWith("--")) this.vars.set(d.prop, d.value);
    }

    for (const rule of rules) {
      const decls = this.expand(rule.decls);
      if (!decls.length) continue;
      for (const selector of rule.selectors) {
        const cls = classifySelector(selector);
        if (cls === "interactive") {
          this.stats.interactiveRules++;
          continue;
        }
        if (cls === "pseudo-element") {
          this.stats.pseudoElementRules++;
          continue;
        }
        if (isClientHackSelector(selector)) this.stats.clientHackRules++;
        const entry: Entry = {
          selector,
          spec: specificity(selector),
          order: rule.order,
          decls,
          media: rule.media,
          key: selectorKey(selector),
        };
        this.entries.push(entry);
        this.index(entry);
      }
    }
  }

  private expand(decls: Decl[]): DeclEntry[] {
    const out: DeclEntry[] = [];
    const track = fallbackTracker();
    let idx = 0;
    for (const d of decls) {
      if (d.prop.startsWith("--")) continue;
      const resolved = resolveVars(d.value, this.vars);
      if (resolved === null) {
        this.stats.unresolvedVars++;
        continue;
      }
      for (const [prop, value] of track(d.prop, resolved, expandShorthand(d.prop, resolved))) {
        out.push({ prop, value, important: d.important, idx: idx++ });
      }
    }
    return out;
  }

  private index(entry: Entry): void {
    const { kind, key } = entry.key;
    const bucket =
      kind === "id" ? this.byId : kind === "class" ? this.byClass : kind === "tag" ? this.byTag : null;
    if (!bucket) {
      this.any.push(entry);
      return;
    }
    const list = bucket.get(key);
    if (list) list.push(entry);
    else bucket.set(key, [entry]);
  }

  // ── Media ──────────────────────────────────────────────────────────────────

  private mediaFor(entry: Entry, view: View): MediaResult {
    if (!entry.media.length) return "yes";
    const k = entry.media.join("\u0000");
    let perView = this.mediaCache.get(view.name);
    if (!perView) {
      perView = new Map();
      this.mediaCache.set(view.name, perView);
    }
    let r = perView.get(k);
    if (r === undefined) {
      r = evalMediaStack(entry.media, view.viewport);
      perView.set(k, r);
    }
    if (r === "ignored" && !this.ignoredCounted.has(entry)) {
      this.ignoredCounted.add(entry);
      this.stats.ignoredMediaRules++;
    }
    return r;
  }

  /**
   * The largest "mobile" width the template's media queries switch on, with the
   * weight each candidate carries (declarations inside queries at that width).
   * Structural properties count double: they are what a breakpoint is for.
   */
  breakpointCandidates(): Map<number, number> {
    const STRUCTURAL = /^(display|width|max-width|min-width|float|padding|margin|font-size|text-align|height)/;
    const out = new Map<number, number>();
    for (const entry of this.entries) {
      if (!entry.media.length) continue;
      for (const prelude of entry.media) {
        for (const t of new Set(mediaWidthThresholds(prelude))) {
          if (!(t > 0)) continue;
          let weight = 0;
          for (const d of entry.decls) weight += STRUCTURAL.test(d.prop) ? 2 : 1;
          out.set(t, (out.get(t) ?? 0) + weight);
        }
      }
    }
    return out;
  }

  // ── Per element ────────────────────────────────────────────────────────────

  private inline(el: Element): Decl[] {
    let d = this.inlineCache.get(el);
    if (!d) {
      const text = el.getAttribute("style");
      d = text ? parseDeclarations(text) : [];
      if (d.length) this.stats.inlineStyleElements++;
      this.inlineCache.set(el, d);
    }
    return d;
  }

  private matching(el: Element, view: View): Entry[] {
    const out: Entry[] = [];
    const test = (list: Entry[] | undefined): void => {
      if (!list) return;
      for (const entry of list) {
        if (this.mediaFor(entry, view) !== "yes") continue;
        try {
          if (el.matches(entry.selector)) out.push(entry);
        } catch {
          this.stats.unsupportedSelectors++;
        }
      }
    };
    if (el.id) test(this.byId.get(el.id));
    for (const c of Array.from(el.classList)) test(this.byClass.get(c));
    test(this.byTag.get(el.localName));
    test(this.any);
    return out;
  }

  styleOf(el: Element, view: View): ElStyle {
    let perView = this.cache.get(view.name);
    if (!perView) {
      perView = new WeakMap();
      this.cache.set(view.name, perView);
    }
    const hit = perView.get(el);
    if (hit) return hit;

    const best = new Map<string, Candidate>();
    const offer = (prop: string, value: string, tier: number, spec: number, order: number, idx: number): void => {
      const cur = best.get(prop);
      if (
        !cur ||
        tier > cur.tier ||
        (tier === cur.tier && (spec > cur.spec || (spec === cur.spec && (order > cur.order || (order === cur.order && idx >= cur.idx)))))
      ) {
        best.set(prop, { value, tier, spec, order, idx });
      }
    };

    let n = 0;
    for (const [p, v] of uaDecls(el)) offer(p, v, 0, 0, 0, n++);
    for (const [p, v] of hintDecls(el)) offer(p, v, 1, 0, 0, n++);
    for (const entry of this.matching(el, view)) {
      for (const d of entry.decls) offer(d.prop, d.value, d.important ? 4 : 2, entry.spec, entry.order, d.idx);
    }
    const track = fallbackTracker();
    for (const d of this.inline(el)) {
      if (d.prop.startsWith("--")) continue;
      const resolved = resolveVars(d.value, this.vars);
      if (resolved === null) {
        this.stats.unresolvedVars++;
        continue;
      }
      for (const [p, v] of track(d.prop, resolved, expandShorthand(d.prop, resolved))) offer(p, v, d.important ? 5 : 3, 0, 0, n++);
    }

    const declared = new Map<string, string>();
    for (const [prop, cand] of best) declared.set(prop, cand.value);
    const style = new ElStyle(el, this, view, declared);
    perView.set(el, style);
    return style;
  }
}
