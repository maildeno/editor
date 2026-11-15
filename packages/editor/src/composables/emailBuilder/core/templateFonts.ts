// composables/emailBuilder/core/templateFonts.ts
//
// Font discovery for a template tree. Pure functions — no Vue, no DOM — so the
// canvas and the exporter can share them and scripts can check them headlessly.
//
// Consumers:
//   • the canvas — useEmailBuilder's watchEffect feeds collectFontsForCanvas()
//     into syncFontsForTemplate(), which injects the Google Fonts <link> that
//     makes the fonts actually render in the editor;
//   • the exporter — useEmailExportEngine.collectFonts() uses
//     extractFontFamiliesFromHtml() to decide which families the exported
//     email has to request.
//
// A font can live in two places on a leaf component:
//   1. props.fontFamily / props.mobile.fontFamily — the block-level font.
//   2. props.content — rich-text HTML, where a font applied to just a selection
//      is stored as <span style="font-family: …">.
//
// (2) is easy to forget and it fails quietly: the span keeps its font-family
// style, but nothing ever asks the browser for the font file, so the text
// renders in a fallback face. In the editor it looks fine right up until the
// page is refreshed, because RichTextEditor.applyFont loads the font by hand at
// the moment the user picks it — a one-off that a reload does not repeat. The
// canvas collector therefore has to find these fonts itself, the same way the
// exporter always has.
//
// The file also holds the one rule for writing a font name into CSS
// (toCssFontFamily), because the canvas, the toolbar and the React export all
// have to agree on it.

// ── Font names as CSS ───────────────────────────────────────────────────────
//
// A font name may be written without quotes only if every word in it is a valid
// CSS identifier, and an identifier cannot start with a digit. So
//
//   font-family: Source Sans 3        ← invalid
//   font-family: "Source Sans 3"      ← fine
//
// and when the declaration is invalid the browser throws all of it away,
// silently: the text just keeps whatever font it inherited. Nothing is logged,
// the font's stylesheet still loads, and the picker still lists the font.
//
// Of the families the editor offers, three are affected — Exo 2, Source Sans 3
// and Source Serif 4. The export has always quoted block-level fonts (`'Exo 2',
// Arial, sans-serif`); the canvas, the toolbar and the React export did not.
// Every other family is valid unquoted, and is deliberately left as it is.

const IS_QUOTED_RE = /^["']/;
const WORD_STARTS_WITH_DIGIT_RE = /(?:^|\s)\d/;

/**
 * True when a single family name has to be quoted to be valid CSS — that is,
 * when one of its words starts with a digit. A name that is already quoted
 * is fine as it stands.
 */
export const needsCssQuotes = (name: string): boolean => {
  const trimmed = name.trim();
  return !IS_QUOTED_RE.test(trimmed) && WORD_STARTS_WITH_DIGIT_RE.test(trimmed);
};

/**
 * A font family, written so the browser accepts it. Quotes the names that need
 * it (see above) and returns everything else exactly as given:
 *
 *   `Open Sans`                →  `Open Sans`            (valid as it is)
 *   `Source Sans 3`            →  `"Source Sans 3"`
 *   `Source Sans 3, Arial`     →  `"Source Sans 3", Arial`
 *   `"Source Sans 3"`          →  `"Source Sans 3"`      (already quoted)
 *   `undefined`                →  `undefined`            (unset props pass through)
 *
 * Use it wherever a font name from a template or from the font list becomes a
 * CSS value. Do not use it on a name that is going somewhere that quotes it
 * itself, such as react-email's <Font fontFamily>.
 */
export const toCssFontFamily = (value: string): string => {
  // Unset props pass through. So does anything the author already quoted:
  // quotes anywhere in the value mean someone has written it as CSS.
  if (typeof value !== "string" || /["']/.test(value)) return value;

  let changed = false;
  const parts = value.split(",").map((part) => {
    const name = part.trim();
    if (!needsCssQuotes(name)) return part;
    changed = true;
    // `part` keeps its own surrounding whitespace; only the name is replaced.
    return part.replace(name, () => `"${name.replace(/\\/g, "\\\\")}"`);
  });
  return changed ? parts.join(",") : value;
};

// ── Rich-text font extraction ───────────────────────────────────────────────
//
// The rich text editor inlines per-selection font overrides as:
//   <span style="font-family: 'Inter';">…</span>
//   <span style="font-family:&quot;Lora&quot;, serif;">…</span>
//   <span style="color:#000; font-family: Merriweather, serif;">…</span>
//
// These overrides aren't reflected in `comp.props.fontFamily` (that's only
// the component-level default), so without parsing the HTML we'd miss them
// and the exported email would render system fonts where Google Fonts were
// intended.
//
// Regex over DOM:
//   • collectFonts is SSR-safe — it runs during export and must not assume
//     `document` exists. DOMParser is browser-only.
//   • A regex sweep is O(n) over the content string and dramatically cheaper
//     than constructing a throwaway DOM per leaf component.
//
// Capture strategy:
//   We decode entity-encoded quotes up-front so `&quot;` doesn't introduce
//   a spurious `;` mid-value. We then capture from `font-family:` up to the
//   next `;` (end of declaration) or end of decoded input. After capture, we
//   take only the substring up to the next quote that closes the value, then
//   the first comma-separated family. This handles every form the editor
//   emits in practice:
//     font-family: 'Inter';
//     font-family: "Inter", Arial, sans-serif;
//     font-family: &quot;Comic Sans MS&quot;            ← no trailing `;`
//     font-family: Roboto
const FONT_FAMILY_RE = /font-family\s*:\s*([^;<]+)/gi;

const decodeQuotesForParsing = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

/**
 * The first family of a CSS `font-family` value, without its quotes:
 *   `"Open Sans", sans-serif`  →  `Open Sans`
 *   `'Inter'`                  →  `Inter`
 *   `Roboto`                   →  `Roboto`
 * Returns null for anything that is not a non-empty string.
 *
 * TipTap hands back the span's raw `font-family` text, and the browser stores a
 * multi-word family quoted. So once a template has been reloaded the attribute
 * reads `"Open Sans"` — quote characters included — and no longer equals the
 * plain `Open Sans` in the font list. Anything that compares a span's font with
 * that list (the toolbar's font picker) has to compare the bare name.
 */
export const primaryFontFamily = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  // Take the first family in the stack — the rest are fallbacks.
  const first = value.split(",")[0] ?? "";

  // Strip surrounding quote pair and stray whitespace.
  const cleaned = first
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();

  return cleaned || null;
};

export const extractFontFamiliesFromHtml = (html: string): string[] => {
  if (!html || typeof html !== "string") return [];
  // Cheap early-out: skip the regex entirely if the substring isn't present.
  if (html.indexOf("font-family") === -1) return [];

  // Decode entity-encoded quotes up-front so a `;` inside `&quot;` doesn't
  // terminate the capture prematurely and yield `&quot` as the family name.
  const decoded = decodeQuotesForParsing(html);

  const families: string[] = [];
  let match: RegExpExecArray | null;
  FONT_FAMILY_RE.lastIndex = 0;
  while ((match = FONT_FAMILY_RE.exec(decoded)) !== null) {
    const raw = match[1];
    if (!raw) continue;

    // After decoding, the captured value looks like one of:
    //   "Inter", Arial, sans-serif
    //   "Comic Sans MS"">                         ← editor without trailing `;`
    //   "Comic Sans MS"" data-x="y                ← editor with more attrs
    // The value's real end is the FIRST quote that closes the family name.
    // If the value is quoted, find the closing quote; if not, comma or end.
    let valueSlice = raw;
    const firstChar = valueSlice.trimStart()[0];
    if (firstChar === '"' || firstChar === "'") {
      const startQuote = valueSlice.indexOf(firstChar);
      const endQuote = valueSlice.indexOf(firstChar, startQuote + 1);
      if (endQuote !== -1) {
        // Keep through the closing quote AND any following comma-separated
        // fallbacks before the attribute terminator (a stray `"` from the
        // attribute boundary).
        const afterClose = valueSlice.slice(endQuote + 1);
        const stop = afterClose.search(/["<]/);
        valueSlice =
          stop === -1 ? valueSlice : valueSlice.slice(0, endQuote + 1 + stop);
      }
    } else {
      // Unquoted: stop at the first `"` or `<` (attribute / tag boundary).
      const stop = valueSlice.search(/["<]/);
      if (stop !== -1) valueSlice = valueSlice.slice(0, stop);
    }

    // First family in the stack (the rest are fallbacks), unquoted.
    const family = primaryFontFamily(valueSlice);
    if (family) families.push(family);
  }
  return families;
};

// ── Canvas font collection ──────────────────────────────────────────────────

const MAX_FONT_WALK_DEPTH = 5;

/**
 * Every font family a template needs the browser to have, for the canvas.
 *
 * Covers both places a font can live (see the file header): the block-level
 * `props.fontFamily` / `props.mobile.fontFamily`, and any per-selection
 * `font-family` inside the rich-text HTML in `props.content`.
 *
 * Mirrors the font-key extraction rules used by collectFonts() in
 * useEmailExportEngine, so what the canvas loads is what the export embeds. If
 * you add a new font-bearing prop path in the future, update both walkers to
 * keep canvas and export in sync.
 *
 * Returns the raw family names, web-safe ones included — syncFontsForTemplate
 * filters those out.
 */
export const collectFontsForCanvas = (tree: any[]): string[] => {
  const found = new Set<string>();
  const walk = (children: any[], depth: number): void => {
    if (depth >= MAX_FONT_WALK_DEPTH) return;
    for (const child of children) {
      if (!child) continue;
      const t = child.type;
      if (t === "row") {
        for (const col of child.columns ?? []) {
          walk(col.children ?? col.components ?? [], depth + 1);
        }
        continue;
      }
      if (t === "row-spacer") continue;
      // leaf component
      const props = child.props;
      if (props?.fontFamily) found.add(props.fontFamily);
      if (props?.mobile?.fontFamily) found.add(props.mobile.fontFamily);
      // Inline rich-text overrides — a font applied to part of the text lives
      // only in the content HTML, not in props.fontFamily.
      if (typeof props?.content === "string") {
        for (const f of extractFontFamiliesFromHtml(props.content)) {
          found.add(f);
        }
      }
    }
  };

  for (const row of tree) {
    if (!row) continue;
    if (row.type === "row-spacer") continue;
    for (const col of row.columns ?? []) {
      walk(col.children ?? col.components ?? [], 0);
    }
  }
  return Array.from(found);
};
