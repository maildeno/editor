/**
 * check-inline-fonts.ts
 *
 * Checks how a template's fonts are discovered (core/templateFonts.ts), with
 * the focus on fonts applied to part of a text — the rich-text editor stores
 * those as <span style="font-family: …"> inside props.content, not in
 * props.fontFamily.
 *
 * The bug this guards: after a page refresh, a font picked for a selection
 * rendered in a fallback face until the user picked it again. The span kept its
 * style, but the canvas only loaded props.fontFamily fonts, so nothing
 * requested the inline one. Pure functions plus the headless exporter: no
 * browser, no Vue app.
 *
 * The canvas has to load what the exported email will embed, so one block
 * compares the canvas collector with the real export engine's Google Fonts URL.
 *
 * It also covers a second, related bug: a family with a word that starts with a
 * digit (Exo 2, Source Sans 3, Source Serif 4) is not valid CSS unquoted, so
 * the browser dropped the whole declaration — the toolbar saved an empty
 * style="", the canvas showed the block in a fallback face, and the React
 * export stripped the quotes the HTML and MJML exports kept. toCssFontFamily
 * is the one rule for writing such a name; the last block checks the exports.
 *
 *   cd packages/editor && npx tsx scripts/check-inline-fonts.ts
 */

import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  collectFontsForCanvas,
  extractFontFamiliesFromHtml,
  needsCssQuotes,
  primaryFontFamily,
  toCssFontFamily,
} from "../src/composables/emailBuilder/core/templateFonts";
import { useGoogleFonts } from "../src/composables/system/useGoogleFonts";
import { hydrateRows } from "../src/composables/emailBuilder/transform/pipeline/hydrate";

// The list block builds its markup with the DOM, so jsdom is put in place
// before the exporter loads (same as export-saved-fixtures.ts).
const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
const { exportTemplate } = await import("./lib/headless-export");
const { normalizeFontFamily, bareFontFamily } =
  await import("../src/composables/emailBuilder/export/generators/react-email");

// ─── Tiny harness ─────────────────────────────────────────────────────────────

let failed = 0;
const check = (name: string, fn: () => void | Promise<void>) => {
  const report = (err: unknown) => {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      `FAIL  ${name}\n      ${message.split("\n").slice(0, 12).join("\n      ")}`,
    );
  };
  try {
    const out = fn();
    if (out instanceof Promise) {
      return out.then(
        () => console.log(`PASS  ${name}`),
        (err) => report(err),
      );
    }
    console.log(`PASS  ${name}`);
  } catch (err) {
    report(err);
  }
};

const sorted = (xs: string[]) => [...xs].sort();

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const leaf = (id: string, componentType: string, props: object = {}) => ({
  id,
  type: "component",
  componentType,
  props,
});
const column = (id: string, children: unknown[], extra: object = {}) => ({
  id,
  width: 100,
  verticalAlign: "middle",
  children,
  ...extra,
});
const row = (id: string, columns: unknown[], extra: object = {}) => ({
  id,
  type: "row",
  name: id,
  mobileStack: true,
  columns,
  ...extra,
});
const inline = (family: string, text = "Hello") =>
  `<p><span style="font-family: ${family};">${text}</span></p>`;

// ─── primaryFontFamily ────────────────────────────────────────────────────────
//
// What the toolbar's font picker compares with its option list. After a reload
// TipTap returns a multi-word family with its quotes — `"Open Sans"` — and the
// picker, matching on the bare name, went blank for a span that had the font.

console.log("primaryFontFamily");

check(
  "REGRESSION: a quoted multi-word family comes back as the bare name",
  () => {
    assert.equal(primaryFontFamily(`"Open Sans"`), "Open Sans");
    assert.equal(primaryFontFamily(`'Playfair Display'`), "Playfair Display");
  },
);

check("a quoted digit-named family comes back as the bare name too", () => {
  // The toolbar writes `"Source Sans 3"` (toCssFontFamily), and the picker has
  // to find `Source Sans 3` in its list from that.
  assert.equal(primaryFontFamily(`"Source Sans 3"`), "Source Sans 3");
  assert.equal(primaryFontFamily(toCssFontFamily("Exo 2")), "Exo 2");
});

check("a bare family, as applied in a session, is left as it is", () => {
  assert.equal(primaryFontFamily("Roboto"), "Roboto");
  assert.equal(primaryFontFamily("Open Sans"), "Open Sans");
});

check("only the first family of a stack is returned, unquoted", () => {
  assert.equal(primaryFontFamily(`"Inter", Arial, sans-serif`), "Inter");
  assert.equal(primaryFontFamily(`Merriweather , serif`), "Merriweather");
});

check("returns null when there is no usable family", () => {
  assert.equal(primaryFontFamily(null), null);
  assert.equal(primaryFontFamily(undefined), null);
  assert.equal(primaryFontFamily(""), null);
  assert.equal(primaryFontFamily("   "), null);
  assert.equal(primaryFontFamily(`""`), null);
  assert.equal(primaryFontFamily(42), null);
});

// ─── toCssFontFamily ──────────────────────────────────────────────────────────
//
// `font-family: Source Sans 3` is invalid CSS: an unquoted name is a run of
// identifiers and an identifier cannot start with a digit. The browser drops
// the whole declaration without a word — the toolbar built the span from it
// and got style="" (nothing applied, nothing saved), and the canvas renderers
// lost the block's font the same way. Quoted, the name is fine.

console.log("\ntoCssFontFamily");

const DIGIT_NAMED = ["Exo 2", "Source Sans 3", "Source Serif 4"];

check("REGRESSION: the families with a digit-led word are quoted", () => {
  for (const name of DIGIT_NAMED) {
    assert.equal(needsCssQuotes(name), true, `${name} needs quotes`);
    assert.equal(toCssFontFamily(name), `"${name}"`);
  }
});

check("every other family the editor offers is returned untouched", () => {
  const offered = useGoogleFonts().googleFonts.value;
  for (const name of DIGIT_NAMED) {
    assert.ok(offered.includes(name), `${name} is no longer in the font list`);
  }
  for (const name of offered) {
    const digitLed = name.split(/\s+/).some((word) => /^\d/.test(word));
    assert.equal(
      toCssFontFamily(name),
      digitLed ? `"${name}"` : name,
      `unexpected CSS for "${name}"`,
    );
  }
});

check("a stack is handled name by name and keeps its own spacing", () => {
  assert.equal(
    toCssFontFamily("Source Sans 3, Arial, sans-serif"),
    `"Source Sans 3", Arial, sans-serif`,
  );
  assert.equal(
    toCssFontFamily("Arial,  Exo 2 ,serif"),
    `Arial,  "Exo 2" ,serif`,
  );
  assert.equal(toCssFontFamily("Georgia,serif"), "Georgia,serif");
});

check("a value that is already quoted, or not set, passes through", () => {
  assert.equal(toCssFontFamily(`"Source Sans 3"`), `"Source Sans 3"`);
  assert.equal(toCssFontFamily(`'Exo 2', Arial`), `'Exo 2', Arial`);
  assert.equal(toCssFontFamily(""), "");
  assert.equal(toCssFontFamily(undefined as any), undefined);
  assert.equal(toCssFontFamily(null as any), null);
});

check("it is the start of a word that matters, not a digit anywhere", () => {
  assert.equal(toCssFontFamily("Sans3"), "Sans3");
  assert.equal(toCssFontFamily("Open Sans"), "Open Sans");
  assert.equal(toCssFontFamily("M PLUS 1p"), `"M PLUS 1p"`);
  assert.equal(toCssFontFamily("3Dumb"), `"3Dumb"`);
});

check("a backslash inside a quoted name is escaped", () => {
  assert.equal(toCssFontFamily("Odd 2\\Name"), `"Odd 2\\\\Name"`);
});

// ─── extractFontFamiliesFromHtml ──────────────────────────────────────────────

console.log("\nextractFontFamiliesFromHtml");

check("reads the span the rich-text editor writes (unquoted, with `;`)", () => {
  assert.deepEqual(extractFontFamiliesFromHtml(inline("Roboto")), ["Roboto"]);
});

check("reads a digit-named family from the span the toolbar writes", () => {
  assert.deepEqual(
    extractFontFamiliesFromHtml(inline("&quot;Source Sans 3&quot;")),
    ["Source Sans 3"],
  );
  assert.deepEqual(
    extractFontFamiliesFromHtml(inline("&quot;Exo 2&quot;, sans-serif")),
    ["Exo 2"],
  );
});

check("keeps a multi-word family together", () => {
  assert.deepEqual(extractFontFamiliesFromHtml(inline("Open Sans")), [
    "Open Sans",
  ]);
});

check("strips single and double quotes and ignores the fallback stack", () => {
  assert.deepEqual(
    extractFontFamiliesFromHtml(`<span style="font-family: 'Inter';">x</span>`),
    ["Inter"],
  );
  assert.deepEqual(
    extractFontFamiliesFromHtml(
      `<span style='font-family: "Inter", Arial, sans-serif;'>x</span>`,
    ),
    ["Inter"],
  );
});

check("decodes entity-encoded quotes instead of returning `&quot`", () => {
  assert.deepEqual(
    extractFontFamiliesFromHtml(
      `<span style="font-family:&quot;Lora&quot;, serif;">x</span>`,
    ),
    ["Lora"],
  );
});

check("handles a declaration with no trailing semicolon", () => {
  assert.deepEqual(
    extractFontFamiliesFromHtml(
      `<span style="font-family: Comic Sans MS">x</span>`,
    ),
    ["Comic Sans MS"],
  );
});

check("finds the font among other declarations", () => {
  assert.deepEqual(
    extractFontFamiliesFromHtml(
      `<span style="color:#000; font-family: Merriweather, serif; font-weight:700">x</span>`,
    ),
    ["Merriweather"],
  );
});

check("returns every span's font, in document order", () => {
  assert.deepEqual(
    extractFontFamiliesFromHtml(
      `${inline("Roboto", "a")}${inline("Lora", "b")}${inline("Roboto", "c")}`,
    ),
    ["Roboto", "Lora", "Roboto"],
  );
});

check("returns nothing for content without a font, or not a string", () => {
  assert.deepEqual(extractFontFamiliesFromHtml("<p>plain</p>"), []);
  assert.deepEqual(extractFontFamiliesFromHtml(""), []);
  assert.deepEqual(extractFontFamiliesFromHtml(undefined as any), []);
  assert.deepEqual(extractFontFamiliesFromHtml(null as any), []);
  assert.deepEqual(extractFontFamiliesFromHtml(42 as any), []);
});

// ─── collectFontsForCanvas ────────────────────────────────────────────────────

console.log("\ncollectFontsForCanvas");

// The bug. Before the fix this returned ["Inter"] — the span's font was never
// collected, so it was never loaded after a refresh.
check("REGRESSION: a font applied to a selection is collected", () => {
  const tree = [
    row("r1", [
      column("c1", [
        leaf("p1", "paragraph", {
          fontFamily: "Inter",
          content: inline("Roboto"),
        }),
      ]),
    ]),
  ];
  assert.deepEqual(sorted(collectFontsForCanvas(tree)), ["Inter", "Roboto"]);
});

check("a digit-named font applied to a selection is collected", () => {
  const tree = [
    row("r1", [
      column("c1", [
        leaf("p1", "paragraph", {
          content: inline("&quot;Source Serif 4&quot;"),
        }),
      ]),
    ]),
  ];
  assert.deepEqual(collectFontsForCanvas(tree), ["Source Serif 4"]);
});

check("an inline font is collected when the block font is not set", () => {
  const tree = [
    row("r1", [
      column("c1", [leaf("p1", "paragraph", { content: inline("Lora") })]),
    ]),
  ];
  assert.deepEqual(collectFontsForCanvas(tree), ["Lora"]);
});

check("headings and lists are swept the same way as paragraphs", () => {
  const tree = [
    row("r1", [
      column("c1", [
        leaf("h1", "heading", { content: inline("Playfair Display") }),
        leaf("l1", "list", {
          content: `<ul><li><span style="font-family: Raleway;">one</span></li></ul>`,
        }),
      ]),
    ]),
  ];
  assert.deepEqual(sorted(collectFontsForCanvas(tree)), [
    "Playfair Display",
    "Raleway",
  ]);
});

check("block-level and mobile fonts are still collected", () => {
  const tree = [
    row("r1", [
      column("c1", [
        leaf("p1", "paragraph", {
          fontFamily: "Inter",
          mobile: { fontFamily: "Poppins" },
          content: "<p>no inline font</p>",
        }),
        leaf("b1", "button", { fontFamily: "Lato" }),
      ]),
    ]),
  ];
  assert.deepEqual(sorted(collectFontsForCanvas(tree)), [
    "Inter",
    "Lato",
    "Poppins",
  ]);
});

check("a family used in several places is returned once", () => {
  const tree = [
    row("r1", [
      column("c1", [
        leaf("p1", "paragraph", {
          fontFamily: "Inter",
          content: inline("Inter"),
        }),
        leaf("p2", "paragraph", {
          fontFamily: "Inter",
          content: inline("Roboto"),
        }),
      ]),
      column("c2", [leaf("p3", "paragraph", { content: inline("Roboto") })]),
    ]),
  ];
  assert.deepEqual(sorted(collectFontsForCanvas(tree)), ["Inter", "Roboto"]);
});

check(
  "reaches inline fonts in nested rows and legacy `components` columns",
  () => {
    const nested = row("rn", [
      column("cn", [
        leaf("pn", "paragraph", { content: inline("Merriweather") }),
      ]),
    ]);
    const legacyColumn = {
      id: "cl",
      width: 100,
      components: [leaf("pl", "paragraph", { content: inline("Oswald") })],
    };
    const tree = [row("r1", [column("c1", [nested]), legacyColumn])];
    assert.deepEqual(sorted(collectFontsForCanvas(tree)), [
      "Merriweather",
      "Oswald",
    ]);
  },
);

check(
  "the depth limit is unchanged: a font 6 levels down is not collected",
  () => {
    // top-level leaf = depth 0; each nested row adds one level; the walker stops
    // at depth 5, the same limit the exporter uses (MAX_DEPTH).
    const nest = (levels: number, family: string): unknown => {
      let node: unknown = leaf(`leaf${levels}`, "paragraph", {
        content: inline(family),
      });
      for (let i = levels; i > 0; i--) {
        node = row(`nr${i}`, [column(`nc${i}`, [node])]);
      }
      return node;
    };
    const wrap = (child: unknown) => [row("top", [column("topc", [child])])];

    assert.deepEqual(collectFontsForCanvas(wrap(nest(4, "Reachable"))), [
      "Reachable",
    ]);
    assert.deepEqual(collectFontsForCanvas(wrap(nest(5, "TooDeep"))), []);
  },
);

check(
  "spacers, null entries and non-string content are skipped without throwing",
  () => {
    const tree: any[] = [
      null,
      { id: "s0", type: "row-spacer", height: 20 },
      row("r1", [
        column("c1", [
          null,
          { id: "s1", type: "row-spacer", height: 10 },
          leaf("p1", "paragraph", { content: undefined, fontFamily: "Inter" }),
          leaf("p2", "paragraph", { content: { not: "a string" } as any }),
          leaf("d1", "divider"),
        ]),
      ]),
    ];
    assert.deepEqual(collectFontsForCanvas(tree), ["Inter"]);
  },
);

// ─── canvas vs export ─────────────────────────────────────────────────────────
//
// What the canvas loads must be what the exported email embeds. Runs the real
// export engine and reads the single Google Fonts <link> it writes.

console.log("\ncanvas vs export");

const WEB_SAFE = new Set(["Arial", "Georgia", "Times New Roman", "Verdana"]);

const familiesInExport = (html: string): string[] => {
  const url = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/)?.[0];
  if (!url) return [];
  return [...url.matchAll(/family=([^:&]+)/g)].map((m) =>
    decodeURIComponent(m[1]!.replace(/\+/g, " ")),
  );
};

await check(
  "the canvas loads exactly the Google fonts the export embeds",
  async () => {
    const rows: any[] = [
      row("r1", [
        column("c1", [
          leaf("p1", "paragraph", {
            fontFamily: "Inter",
            content: `${inline("Roboto", "a")}${inline("Open Sans", "b")}${inline("Georgia", "c")}`,
          }),
          leaf("h1", "heading", {
            fontFamily: "Lora",
            content: inline("Playfair Display"),
          }),
        ]),
        column("c2", [
          leaf("l1", "list", {
            fontFamily: "Arial",
            content: `<ul><li><span style="font-family: Raleway;">one</span></li></ul>`,
          }),
        ]),
      ]),
    ];
    const canvas = { width: 600, mobileBreakpoint: 600 };

    const exported = familiesInExport(
      (await exportTemplate(rows, canvas)).html,
    );

    // The canvas sees the hydrated tree, like the export engine does.
    const hydrated = hydrateRows(
      JSON.parse(JSON.stringify(rows)) as any,
    ) as any[];
    const onCanvas = collectFontsForCanvas(hydrated).filter(
      (f) => !WEB_SAFE.has(f),
    );

    assert.ok(
      exported.length > 0,
      "the export embedded no Google Fonts link at all",
    );
    assert.deepEqual(sorted(onCanvas), sorted(exported));
    // and the inline ones are really in there, not just agreeing on a short list
    for (const f of ["Roboto", "Open Sans", "Playfair Display", "Raleway"]) {
      assert.ok(onCanvas.includes(f), `canvas is missing inline font "${f}"`);
    }
  },
);

// ─── digit-named fonts in the exports ─────────────────────────────────────────
//
// HTML and MJML always quoted the family; the React export stripped the quotes
// from every name, which for these three leaves `font-family: Source Sans 3`
// in the email — invalid, so dropped by the client.

console.log("\ndigit-named fonts in the exports");

check("normalizeFontFamily keeps the quotes a digit-named family needs", () => {
  assert.equal(
    normalizeFontFamily(`'Source Sans 3', Arial, sans-serif`),
    `'Source Sans 3', Arial, sans-serif`,
  );
  assert.equal(normalizeFontFamily(`'Exo 2'`), `'Exo 2'`);
  assert.equal(
    normalizeFontFamily(`'Open Sans', 'Source Serif 4'`),
    `Open Sans, 'Source Serif 4'`,
  );
});

check("normalizeFontFamily still strips them everywhere else", () => {
  assert.equal(
    normalizeFontFamily(`'Open Sans', Arial, sans-serif`),
    "Open Sans, Arial, sans-serif",
  );
  assert.equal(
    normalizeFontFamily(`'Roboto', 'Helvetica'`),
    "Roboto, Helvetica",
  );
  assert.equal(normalizeFontFamily("Arial, sans-serif"), "Arial, sans-serif");
  // double quotes were never touched, and are not now
  assert.equal(normalizeFontFamily(`"Open Sans", Arial`), `"Open Sans", Arial`);
});

check("bareFontFamily leaves the plain name, for props that quote it", () => {
  assert.equal(bareFontFamily(`'Source Sans 3'`), "Source Sans 3");
  assert.equal(bareFontFamily("Source Sans 3"), "Source Sans 3");
  assert.equal(bareFontFamily(`'Open Sans'`), "Open Sans");
});

await check(
  "HTML, MJML and React Email all write the three families validly",
  async () => {
    const rows: any[] = [
      row("r1", [
        column("c1", [
          leaf("p1", "paragraph", {
            fontFamily: "Source Sans 3",
            content: `<p>block</p>`,
          }),
          leaf("h1", "heading", {
            fontFamily: "Exo 2",
            content: `<p>head</p>`,
          }),
          leaf("p2", "paragraph", {
            fontFamily: "Open Sans",
            content: `<p><span style="font-family: &quot;Source Serif 4&quot;;">inline</span></p>`,
          }),
        ]),
      ]),
    ];
    const out = await exportTemplate(rows, {
      width: 600,
      mobileBreakpoint: 600,
    });

    for (const target of ["html", "mjml"] as const) {
      const text: string = out[target];
      assert.match(
        text,
        /font-family:\s*'Source Sans 3', Arial, sans-serif/,
        target,
      );
      assert.match(text, /font-family:\s*'Exo 2', Arial, sans-serif/, target);
      assert.match(text, /font-family:\s*'Source Serif 4'/, target);
      assert.match(
        text,
        /font-family:\s*'Open Sans', Arial, sans-serif/,
        target,
      );
    }

    const jsx: string = out.jsx;
    assert.ok(
      jsx.includes(`fontFamily: "'Source Sans 3', Arial, sans-serif"`),
      "React Email lost the quotes on a block-level Source Sans 3",
    );
    assert.ok(
      jsx.includes(`fontFamily: "'Exo 2', Arial, sans-serif"`),
      "React Email lost the quotes on a block-level Exo 2",
    );
    assert.ok(
      jsx.includes(`fontFamily: "'Source Serif 4'"`),
      "React Email lost the quotes on an inline Source Serif 4",
    );
    // every other family is written exactly as it was before
    assert.ok(jsx.includes(`fontFamily: "Open Sans, Arial, sans-serif"`));
  },
);

// ──────────────────────────────────────────────────────────────────────────────

if (failed > 0) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
