/**
 * check-html-import-css.ts
 *
 * Checks the CSS layer of the HTML importer on its own: values, the stylesheet
 * parser, selectors and @media evaluation. Pure functions, no DOM.
 *
 *   cd packages/editor && npx tsx scripts/check-html-import-css.ts
 *
 * The end-to-end importer checks are in check-html-import.ts.
 */

import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  Cascade,
  DESKTOP_VIEW,
  phoneViewFor,
} from "../src/composables/emailBuilder/import/css/cascade";
import {
  colorToString,
  expandShorthand,
  parseColor,
  parseLen,
  primaryFamily,
  px,
  resolveVars,
  splitCommas,
  splitSpaces,
} from "../src/composables/emailBuilder/import/css/values";
import {
  parseDeclarations,
  parseStylesheet,
  stripComments,
} from "../src/composables/emailBuilder/import/css/parse";
import {
  classifySelector,
  isClientHackSelector,
  selectorKey,
  specificity,
} from "../src/composables/emailBuilder/import/css/selectors";
import {
  evalMedia,
  evalMediaStack,
  mediaWidthThresholds,
} from "../src/composables/emailBuilder/import/css/media";

// ─── Tiny harness ─────────────────────────────────────────────────────────────

let failed = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      `FAIL  ${name}\n      ${message.split("\n").slice(0, 12).join("\n      ")}`,
    );
  }
};

const longhands = (prop: string, value: string) =>
  Object.fromEntries(expandShorthand(prop, value));

const phone = { width: 375, height: 667 };
const desktop = { width: 1024, height: 768 };

// ─── values ───────────────────────────────────────────────────────────────────

check("splitting respects parentheses and quotes", () => {
  assert.deepEqual(splitSpaces("1px solid rgba(0, 0, 0, 0.5)"), [
    "1px",
    "solid",
    "rgba(0, 0, 0, 0.5)",
  ]);
  assert.deepEqual(splitCommas("'Helvetica Neue', Arial, sans-serif"), [
    "'Helvetica Neue'",
    "Arial",
    "sans-serif",
  ]);
  assert.deepEqual(splitCommas("url(a,b.png), red"), ["url(a,b.png)", "red"]);
});

check("colours: hex, rgb, hsl, names, transparent, currentColor", () => {
  assert.equal(colorToString(parseColor("#FFF")!), "#ffffff");
  assert.equal(colorToString(parseColor("rgb(255, 0, 0)")!), "#ff0000");
  assert.equal(colorToString(parseColor("rgb(255 0 0 / 50%)")!), "rgba(255, 0, 0, 0.5)");
  assert.equal(colorToString(parseColor("hsl(120, 100%, 25%)")!), "#008000");
  assert.equal(colorToString(parseColor("hsla(0 0% 0% / 0.2)")!), "rgba(0, 0, 0, 0.2)");
  assert.equal(colorToString(parseColor("RebeccaPurple")!), "#663399");
  assert.equal(colorToString(parseColor("transparent")!), "transparent");
  assert.equal(
    colorToString(parseColor("currentColor", { r: 1, g: 2, b: 3, a: 1 })!),
    "#010203",
  );
  assert.equal(parseColor("notacolour"), null);
  assert.equal(parseColor("inherit"), null);
});

check("lengths: units to px, percentages stay unresolved", () => {
  assert.equal(px("12px"), 12);
  assert.equal(px("12pt"), 16);
  assert.equal(px("1.5em", { em: 20 }), 30);
  assert.equal(px("2rem"), 32);
  assert.equal(px("0"), 0);
  assert.equal(px("600"), 600);
  assert.equal(px("50%"), null);
  assert.equal(px("auto"), null);
  assert.deepEqual(parseLen("50%"), { n: 50, unit: "%" });
});

check("margin and padding shorthands expand to four sides", () => {
  assert.deepEqual(longhands("padding", "10px 20px"), {
    "padding-top": "10px",
    "padding-right": "20px",
    "padding-bottom": "10px",
    "padding-left": "20px",
  });
  assert.deepEqual(longhands("margin", "0 auto 5px"), {
    "margin-top": "0",
    "margin-right": "auto",
    "margin-bottom": "5px",
    "margin-left": "auto",
  });
  assert.equal(longhands("padding", "1px 2px 3px 4px")["padding-left"], "4px");
});

check("border shorthand: width, style, colour; no style means no border", () => {
  const b = longhands("border", "1px solid #ccc");
  assert.equal(b["border-top-width"], "1px");
  assert.equal(b["border-left-style"], "solid");
  assert.equal(b["border-bottom-color"], "#ccc");
  assert.equal(longhands("border", "0")["border-top-width"], "0");
  assert.equal(longhands("border", "0")["border-top-style"], "none");
  assert.equal(longhands("border-bottom", "2px dashed red")["border-bottom-style"], "dashed");
  assert.equal(longhands("border", "thin solid")["border-top-width"], "1px");
});

check("border-radius expands per corner", () => {
  const r = longhands("border-radius", "4px 8px");
  assert.equal(r["border-top-left-radius"], "4px");
  assert.equal(r["border-top-right-radius"], "8px");
  assert.equal(r["border-bottom-right-radius"], "4px");
  assert.equal(r["border-bottom-left-radius"], "8px");
  assert.equal(longhands("border-radius", "10px / 20px")["border-top-left-radius"], "10px");
});

check("background shorthand: colour, image, position/size, resets", () => {
  const bg = longhands("background", "#f00 url(a.png) no-repeat center / cover");
  assert.equal(bg["background-color"], "#f00");
  assert.equal(bg["background-image"], "url(a.png)");
  assert.equal(bg["background-repeat"], "no-repeat");
  assert.equal(bg["background-position"], "center");
  assert.equal(bg["background-size"], "cover");
  const plain = longhands("background", "#fff");
  assert.equal(plain["background-image"], "none");
  assert.equal(plain["background-color"], "#fff");
  const grad = longhands("background", "linear-gradient(to right, #fff, #000)");
  assert.equal(grad["background-image"], "linear-gradient(to right, #fff, #000)");
});

check("font shorthand: style, weight, size/line-height, family", () => {
  const f = longhands("font", "italic bold 14px/1.4 'Helvetica Neue', Arial");
  assert.equal(f["font-style"], "italic");
  assert.equal(f["font-weight"], "bold");
  assert.equal(f["font-size"], "14px");
  assert.equal(f["line-height"], "1.4");
  assert.equal(f["font-family"], "'Helvetica Neue', Arial");
  assert.equal(longhands("font", "12px Arial")["font-weight"], "normal");
});

check("var() with fallback and nesting", () => {
  const vars = new Map([["--brand", "#123456"], ["--pad", "var(--unit)"], ["--unit", "8px"]]);
  assert.equal(resolveVars("var(--brand)", vars), "#123456");
  assert.equal(resolveVars("var(--missing, #fff)", vars), "#fff");
  assert.equal(resolveVars("var(--pad) 0", vars), "8px 0");
  assert.equal(resolveVars("var(--missing)", vars), null);
  assert.equal(resolveVars("1px solid var(--brand)", vars), "1px solid #123456");
});

check("font stack: first family, generics become web-safe names", () => {
  assert.deepEqual(primaryFamily("'Helvetica Neue', Arial, sans-serif"), {
    family: "Helvetica Neue",
    generic: false,
  });
  assert.deepEqual(primaryFamily("sans-serif"), { family: "Arial", generic: true });
  assert.equal(primaryFamily(""), null);
});

// ─── parse ────────────────────────────────────────────────────────────────────

check("comments are removed, strings keep their slashes", () => {
  assert.equal(stripComments("a /* x */ b").replace(/\s+/g, " "), "a b");
  assert.ok(stripComments('content: "/* kept */"').includes("/* kept */"));
});

check("declarations: !important, case, hacks, scriptable values", () => {
  const d = parseDeclarations(
    "COLOR: Red !important; *zoom: 1; _height: 1px; width: expression(alert(1)); padding:0; --Brand: #fff",
  );
  assert.deepEqual(
    d.map((x) => [x.prop, x.value, x.important]),
    [
      ["color", "Red", true],
      ["padding", "0", false],
      ["--Brand", "#fff", false],
    ],
  );
});

check("data URLs with semicolons stay in one declaration", () => {
  const d = parseDeclarations("background:url(data:image/png;base64,AAAA) no-repeat; color:red");
  assert.equal(d.length, 2);
  assert.ok(d[0].value.startsWith("url(data:image/png;base64,AAAA)"));
});

check("stylesheet: rules, selector lists, order, @media stack", () => {
  const counter = { order: 0 };
  const sheet = parseStylesheet(
    `
    <!-- body { margin:0 } -->
    .a, .b > p { color:red }
    @media only screen and (max-width: 600px) {
      .a { width:100% !important }
      @media (min-width: 300px) { .c { display:none } }
    }
    @font-face { font-family: X; src: url(x.woff) }
    @import url(foo.css);
    .broken { }
    `,
    counter,
  );
  assert.equal(sheet.rules.length, 4);
  assert.deepEqual(sheet.rules[0].selectors, ["body"]);
  assert.deepEqual(sheet.rules[1].selectors, [".a", ".b > p"]);
  assert.deepEqual(sheet.rules[2].media, ["only screen and (max-width: 600px)"]);
  assert.deepEqual(sheet.rules[3].media, [
    "only screen and (max-width: 600px)",
    "(min-width: 300px)",
  ]);
  assert.deepEqual(
    sheet.rules.map((r) => r.order),
    [0, 1, 2, 3],
  );
  assert.equal(sheet.skipped["@font-face"], 1);
  assert.equal(sheet.skipped["@import"], 1);
});

check("a broken rule does not take its neighbours with it", () => {
  const sheet = parseStylesheet(".a { color: red } .b { color:blue; } .c{{{ }");
  assert.ok(sheet.rules.some((r) => r.selectors[0] === ".a"));
  assert.ok(sheet.rules.some((r) => r.selectors[0] === ".b"));
});

// ─── selectors ────────────────────────────────────────────────────────────────

check("specificity orders id > class > type", () => {
  assert.ok(specificity("#a") > specificity(".a.b.c"));
  assert.ok(specificity(".a") > specificity("div p span"));
  assert.equal(specificity("*"), 0);
  assert.equal(specificity("td.x"), 101);
  assert.equal(specificity("a:not(.x)"), 101);
  assert.equal(specificity(":where(.x) p"), 1);
  assert.equal(specificity("table td[width]"), 102);
});

check("index key: id, class or tag of the rightmost compound", () => {
  assert.deepEqual(selectorKey("table .x td.y"), { kind: "class", key: "y" });
  assert.deepEqual(selectorKey("div > #main"), { kind: "id", key: "main" });
  assert.deepEqual(selectorKey("table td"), { kind: "tag", key: "td" });
  assert.deepEqual(selectorKey("td:not(.skip)"), { kind: "tag", key: "td" });
  assert.deepEqual(selectorKey("*"), { kind: "any", key: "*" });
  assert.deepEqual(selectorKey("[x-apple-data-detectors]"), { kind: "any", key: "*" });
});

check("classification: states and generated content are not matched", () => {
  assert.equal(classifySelector("a:hover"), "interactive");
  assert.equal(classifySelector("a:focus-visible"), "interactive");
  assert.equal(classifySelector("p::before"), "pseudo-element");
  assert.equal(classifySelector("p:after"), "pseudo-element");
  assert.equal(classifySelector("td.x"), "ok");
  assert.equal(isClientHackSelector("u + .body .x"), true);
  assert.equal(isClientHackSelector(".ExternalClass p"), true);
  assert.equal(isClientHackSelector(".card"), false);
});

// ─── media ────────────────────────────────────────────────────────────────────

check("media: max-width and min-width at phone and desktop widths", () => {
  assert.equal(evalMedia("only screen and (max-width: 600px)", phone), "yes");
  assert.equal(evalMedia("only screen and (max-width: 600px)", desktop), "no");
  assert.equal(evalMedia("(min-width: 601px)", desktop), "yes");
  assert.equal(evalMedia("(min-width: 601px)", phone), "no");
  assert.equal(evalMedia("screen and (max-width: 40em)", phone), "yes");
  assert.equal(evalMedia("(max-width: 360px)", phone), "no");
});

check("media: range syntax, lists, not, print", () => {
  assert.equal(evalMedia("(width <= 600px)", phone), "yes");
  assert.equal(evalMedia("(400px <= width <= 800px)", phone), "no");
  assert.equal(evalMedia("(400px <= width <= 1200px)", desktop), "yes");
  assert.equal(evalMedia("print, (max-width: 600px)", phone), "yes");
  assert.equal(evalMedia("not screen and (max-width: 600px)", phone), "no");
  assert.equal(evalMedia("print", phone), "no");
  assert.equal(evalMedia("all", phone), "yes");
});

check("media: hacks and dark mode are ignored, not guessed", () => {
  assert.equal(evalMedia("(-webkit-min-device-pixel-ratio: 2)", phone), "ignored");
  assert.equal(evalMedia("(prefers-color-scheme: dark)", phone), "ignored");
  assert.equal(evalMedia("screen and (-ms-high-contrast: none)", desktop), "ignored");
  assert.equal(
    evalMediaStack(["(max-width: 600px)", "(prefers-color-scheme: dark)"], phone),
    "ignored",
  );
  assert.equal(evalMediaStack(["(max-width: 600px)", "(min-width: 500px)"], phone), "no");
  assert.equal(evalMediaStack([], phone), "yes");
});

check("media thresholds: the largest 'mobile' width of each query", () => {
  assert.deepEqual(mediaWidthThresholds("only screen and (max-width: 600px)"), [600]);
  assert.deepEqual(mediaWidthThresholds("(min-width: 601px)"), [600]);
  assert.deepEqual(mediaWidthThresholds("(width <= 480px)"), [480]);
  assert.deepEqual(mediaWidthThresholds("(max-width: 480px), (max-width: 600px)"), [480, 600]);
  assert.deepEqual(mediaWidthThresholds("(prefers-color-scheme: dark)"), []);
});

// ─── cascade ──────────────────────────────────────────────────────────────────

const load = (html: string) => {
  const doc = new JSDOM(html).window.document;
  const cascade = new Cascade(doc);
  const phoneView = phoneViewFor(600);
  const at = (selector: string, view = DESKTOP_VIEW) => {
    const el = doc.querySelector(selector);
    assert.ok(el, `no element matches ${selector}`);
    return cascade.styleOf(el, view);
  };
  return { doc, cascade, at, phoneView };
};

check("cascade: specificity, order, inline and !important", () => {
  const { at } = load(`<style>
    p { color: green }
    .a { color: red }
    #x { color: blue }
    .late { color: orange }
    .imp { color: purple !important }
  </style>
  <p id="x" class="a">one</p>
  <p class="a late">two</p>
  <p class="imp" style="color: black">three</p>
  <p class="a" style="color: black">four</p>
  <p class="imp" style="color: black !important">five</p>`);
  const c = (n: number) => colorToString(at(`p:nth-of-type(${n})`).color("color")!);
  assert.equal(c(1), "#0000ff"); // id beats class
  assert.equal(c(2), "#ffa500"); // equal specificity: later rule
  assert.equal(c(3), "#800080"); // !important author beats plain inline
  assert.equal(c(4), "#000000"); // inline beats class
  assert.equal(c(5), "#000000"); // !important inline beats !important author
});

check("cascade: a shorthand and a longhand are ordered like any two declarations", () => {
  const { at } = load(`<style>
    .a { padding: 0; padding-left: 10px }
    .b { padding-left: 10px; padding: 0 }
  </style><div class="a">x</div><div class="b">y</div>`);
  assert.equal(at("div.a").px("padding-left"), 10);
  assert.equal(at("div.b").px("padding-left"), 0);
});

check("cascade: @media rules apply in the phone view only", () => {
  const { at, phoneView } = load(`<style>
    .box { width: 600px; display: block }
    @media only screen and (max-width: 600px) {
      .box { width: 100% !important; display: none }
    }
    @media (prefers-color-scheme: dark) { .box { width: 1px } }
  </style><div class="box">x</div>`);
  assert.equal(at(".box").get("width"), "600px");
  assert.equal(at(".box").display(), "block");
  assert.equal(at(".box", phoneView).get("width"), "100%");
  assert.equal(at(".box", phoneView).isHidden(), true);
});

check("cascade: inheritance of colour, font size, line height", () => {
  const { at } = load(`<style>
    body { color: #333; font-size: 14px; line-height: 1.5 }
    .big { font-size: 2em }
    .px { line-height: 21px }
  </style><body><div><p class="big">a</p><p class="px">b</p><span>c</span></div></body>`);
  assert.equal(colorToString(at("p.big").textColor()), "#333333");
  assert.equal(at("p.big").fontSize(), 28);
  assert.equal(at("p.big").lineHeight(), 1.5);
  // a px line-height inherits as pixels: 21px on a 14px element is 1.5
  assert.equal(at("p.px").lineHeight(), 1.5);
  assert.equal(at("span").fontSize(), 14);
});

check("cascade: a px line-height divides by the element's own font size when inherited", () => {
  const { at } = load(`<style>
    td { line-height: 24px; font-size: 12px }
    .small { font-size: 8px }
  </style><table><tr><td><span class="small">x</span></td></tr></table>`);
  assert.equal(at("td").lineHeight(), 2);
  assert.equal(at(".small").lineHeight(), 3);
});

check("cascade: legacy attributes act as low-priority hints", () => {
  const { at } = load(`<style> td.x { background-color: #00ff00 } </style>
  <table width="600" align="center" cellpadding="8" bgcolor="#eeeeee">
    <tr><td class="x" width="50%" valign="top" bgcolor="#ff0000" align="right">a</td>
        <td height="40">b</td></tr>
  </table>
  <font color="#123456" face="Verdana" size="+1">t</font>`);
  const table = at("table");
  assert.equal(table.px("width"), 600);
  assert.deepEqual(table.autoMargins(), { left: true, right: true });
  assert.equal(colorToString(table.color("background-color")!), "#eeeeee");
  const td = at("td.x");
  assert.equal(td.get("width"), "50%");
  assert.equal(td.get("vertical-align"), "top");
  assert.equal(td.textAlign(), "right");
  assert.equal(td.px("padding-left"), 8);
  // the author rule beats the bgcolor attribute
  assert.equal(colorToString(td.color("background-color")!), "#00ff00");
  assert.equal(at("td:nth-child(2)").px("height"), 40);
  const font = at("font");
  assert.equal(colorToString(font.color("color")!), "#123456");
  assert.equal(font.get("font-family"), "Verdana");
  assert.equal(font.fontSize(), 18);
});

check("cascade: a table cell is vertically middle unless something says otherwise", () => {
  const { at } = load(`<table><tr><td>a</td><td valign="bottom">b</td></tr></table>`);
  assert.equal(at("td:nth-child(1)").get("vertical-align"), "middle");
  assert.equal(at("td:nth-child(2)").get("vertical-align"), "bottom");
});

check("cascade: user-agent defaults for headings, paragraphs and links", () => {
  const { at } = load(`<h1>t</h1><p>p</p><a href="x">l</a><a>no href</a><ul><li>i</li></ul>`);
  assert.equal(at("h1").fontSize(), 32);
  assert.equal(at("h1").fontWeight(), 700);
  assert.equal(at("p").px("margin-top"), 16);
  assert.equal(colorToString(at("a[href]").textColor()), "#0000ee");
  assert.equal(at("a[href]").decorations().underline, true);
  assert.equal(at("a:not([href])").decorations().underline, false);
  assert.equal(at("ul").px("padding-left"), 40);
});

check("cascade: text-decoration reaches children but none cancels on the element", () => {
  const { at } = load(`<div style="text-decoration: underline"><span>a</span><span style="text-decoration:none">b</span></div>`);
  assert.equal(at("span:nth-child(1)").decorations().underline, true);
  assert.equal(at("span:nth-child(2)").decorations().underline, false);
});

check("cascade: border widths need a style; radii read per corner", () => {
  const { at } = load(`<div style="border: 2px solid #f00; border-radius: 4px 8px"></div>
  <div style="border: 2px #f00"></div>`);
  const a = at("div:nth-of-type(1)");
  assert.equal(a.border("top").width, 2);
  assert.equal(colorToString(a.border("top").color!), "#ff0000");
  assert.deepEqual(a.radii(), [4, 8, 4, 8]);
  assert.equal(at("div:nth-of-type(2)").border("top").width, 0);
});

check("cascade: hover rules are skipped and counted, var() resolves", () => {
  const { at, cascade } = load(`<style>
    :root { --brand: #112233 }
    a:hover { color: red }
    p::before { content: "x" }
    .c { color: var(--brand); padding: var(--none, 4px) }
    .d { color: var(--nope) }
  </style><p class="c">x</p><p class="d">y</p>`);
  assert.equal(cascade.stats.interactiveRules, 1);
  assert.equal(cascade.stats.pseudoElementRules, 1);
  assert.equal(colorToString(at("p.c").color("color")!), "#112233");
  assert.equal(at("p.c").px("padding-top"), 4);
  assert.equal(cascade.stats.unresolvedVars, 1);
});

check("cascade: breakpoint candidates are weighted by what the queries change", () => {
  const { cascade } = load(`<style>
    @media (max-width: 480px) { .a { color: red } }
    @media only screen and (max-width: 600px) { .b { display: block; width: 100% } .c { padding: 0 } }
  </style><div></div>`);
  const c = cascade.breakpointCandidates();
  assert.equal(c.get(600), 12); // display + width, plus padding as four longhands
  assert.equal(c.get(480), 1);
});

check("cascade: hidden elements are display:none, and !important in the phone view wins", () => {
  const { at, phoneView } = load(`<style>
    .only-mobile { display: none }
    @media (max-width: 600px) { .only-mobile { display: block !important } }
  </style><div class="only-mobile">m</div><div hidden>h</div>`);
  assert.equal(at(".only-mobile").isHidden(), true);
  assert.equal(at(".only-mobile", phoneView).isHidden(), false);
  assert.equal(at("div[hidden]").isHidden(), true);
});

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
