/**
 * Group 2: styles to props.
 *
 * Small documents, one idea each. What the cascade makes of a style (specificity,
 * !important, inheritance, units, shorthands), what a media query turns into (a
 * `mobile` override, a hide flag, the breakpoint) and how the page and the
 * container become the canvas.
 */

import {
  assert, check, group, imp, page, email, only, ofType, topRows, allRows, codes, allCodes,
  textOf, valid, components,
} from "../lib/html-import-harness";

/** A one-cell row of an email. */
const T = (inner: string, style = ""): string => `<tr><td style="${style}">${inner}</td></tr>`;

// ═════════════════════════════════════════════════════════════════════════════
group("2a. canvas and page");
// ═════════════════════════════════════════════════════════════════════════════

await check("the content table's width is the canvas width; the page and the table fills are kept apart", () => {
  const r = imp(email(T("<p>x</p>")));
  const c = r.snapshot.canvas;
  assert.equal(c.width, 600);
  assert.equal(c.bodyBackgroundColor, "#eeeeee");
  assert.equal(c.backgroundColor, "#ffffff");
  assert.deepEqual(c.padding, { top: 0, right: 0, bottom: 0, left: 0 });
});

await check("a div with a max-width is the container when there is no table", () => {
  const r = imp(page('<div style="max-width:640px;margin:0 auto;background:#ffffff"><p>x</p></div>'));
  assert.equal(r.snapshot.canvas.width, 640);
});

await check("widths outside 360 to 720 are clamped and reported", () => {
  const wide = imp(email(T("<p>x</p>"), "", 900));
  assert.equal(wide.snapshot.canvas.width, 720);
  assert.ok(codes(wide.report.warnings).includes("canvas-width"));
  const narrow = imp(email(T("<p>x</p>"), "", 300));
  assert.equal(narrow.snapshot.canvas.width, 360);
  assert.ok(codes(narrow.report.warnings).includes("canvas-width"));
});

await check("bgcolor on the body is the page colour", () => {
  const r = imp('<!DOCTYPE html><html><head><title>t</title></head><body bgcolor="#123456"><table width="600" align="center"><tr><td>Hello</td></tr></table></body></html>');
  assert.equal(r.snapshot.canvas.bodyBackgroundColor, "#123456");
});

await check("a page background image keeps its size; without an image the editor's own defaults stand", () => {
  const withImage = imp('<!DOCTYPE html><html><head><title>t</title></head><body style="background-image:url(https://x.example/y.png);background-size:cover;background-color:#eeeeee"><table width="600" align="center"><tr><td>Hello</td></tr></table></body></html>');
  const c = withImage.snapshot.canvas;
  assert.equal(c.bodyBackgroundImage, "https://x.example/y.png");
  assert.equal(c.bodyBackgroundSize, "cover");
  const without = imp(email(T("<p>x</p>"))).snapshot.canvas;
  assert.ok(!without.bodyBackgroundImage);
  assert.equal(without.bodyBackgroundSize, "cover");
  assert.equal(without.bodyBackgroundRepeat, "no-repeat");
  // with an image and no size, the browser's own initial values apply
  const bare = imp('<!DOCTYPE html><html><head><title>t</title></head><body style="background-image:url(https://x.example/y.png)"><table width="600" align="center"><tr><td>Hello</td></tr></table></body></html>').snapshot.canvas;
  assert.equal(bare.bodyBackgroundSize, "auto");
  assert.equal(bare.bodyBackgroundRepeat, "repeat");
});

await check("lang comes from the html element; und (MJML's placeholder) is ignored", () => {
  const fr = imp('<!DOCTYPE html><html lang="fr"><head><title>t</title></head><body><p>Bonjour</p></body></html>');
  assert.equal(fr.snapshot.canvas.language, "fr");
  const und = imp('<!DOCTYPE html><html lang="und"><head><title>t</title></head><body><p>x</p></body></html>');
  assert.notEqual(und.snapshot.canvas.language, "und");
});

await check("the first hidden block of text is the preheader and does not become a block", () => {
  const r = imp(email(T('<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Inbox preview</div>') + T("<p>Body</p>")));
  assert.equal(r.snapshot.canvas.preheaderText, "Inbox preview");
  assert.equal(components(r.snapshot).length, 1, "only the body paragraph");
  assert.equal(topRows(r).length, 1, "no empty row left behind");
});

await check("hidden text after visible text is not a preheader, and its removal is reported", () => {
  const r = imp(email(T('<p>Visible first</p><div style="display:none">late hidden</div>')));
  assert.equal(r.snapshot.canvas.preheaderText, "");
  assert.ok(codes(r.report.dropped).includes("hidden"), allCodes(r).join(","));
});

await check("text hidden on desktop but shown on a phone is a block, never the preheader", () => {
  const r = imp(email(T('<p class="dm">only on phones</p><p>always</p>'), "<style>.dm{display:none} @media (max-width:480px){.dm{display:block !important}}</style>"));
  assert.equal(r.snapshot.canvas.preheaderText, "");
  const p = ofType(r, "paragraph")[0];
  assert.equal(textOf(p.props.content), "only on phones");
  assert.equal(p.props.desktopHide, true);
  assert.equal(p.props.mobileHide, false);
});

// ═════════════════════════════════════════════════════════════════════════════
group("2b. the cascade");
// ═════════════════════════════════════════════════════════════════════════════

const colourOf = (html: string, head = ""): string => only(imp(email(T(html), head)), "paragraph").props.color;

await check("specificity: element < class < id < inline", () => {
  const head = "<style>p{color:#111111} .a{color:#222222} #x{color:#333333}</style>";
  assert.equal(colourOf('<p>hi</p>', head), "#111111");
  assert.equal(colourOf('<p class="a">hi</p>', head), "#222222");
  assert.equal(colourOf('<p class="a" id="x">hi</p>', head), "#333333");
  assert.equal(colourOf('<p class="a" id="x" style="color:#444444">hi</p>', head), "#444444");
});

await check("!important in a stylesheet beats an inline style", () => {
  assert.equal(colourOf('<p class="a" style="color:#444444">hi</p>', "<style>.a{color:#555555 !important}</style>"), "#555555");
});

await check("at equal specificity the later rule wins", () => {
  assert.equal(colourOf('<p class="a b">hi</p>', "<style>.a{color:#111111} .b{color:#222222}</style>"), "#222222");
  assert.equal(colourOf('<p class="a b">hi</p>', "<style>.b{color:#222222} .a{color:#111111}</style>"), "#111111");
});

await check("descendant and child selectors, and attribute selectors, match", () => {
  const head = "<style>.card p{color:#aa0000} table.c > tbody > tr > td > .x{color:#00aa00} [data-k='v']{color:#0000aa}</style>";
  assert.equal(colourOf('<div class="card"><p>hi</p></div>', head), "#aa0000");
  assert.equal(colourOf('<div class="x">hi</div>', head), "#00aa00");
  assert.equal(colourOf('<p data-k="v">hi</p>', head), "#0000aa");
});

await check("font and colour inherit from a cell; line-height and size come along", () => {
  const p = only(imp(email(T("<p>hi</p>", "color:#666666;font-size:15px;font-family:Georgia,serif"))), "paragraph").props;
  assert.equal(p.color, "#666666");
  assert.equal(p.fontSize, 15);
  assert.equal(p.fontFamily, "Georgia");
});

await check("units: em, pt, %, rem and a px or % line-height become px and a unitless ratio", () => {
  const r = imp(email(T('<p style="font-size:1.25em">a</p><p style="font-size:12pt">b</p><p style="font-size:150%">c</p><p style="font-size:1rem;line-height:24px">d</p><p style="font-size:20px;line-height:150%">e</p>')));
  const p = ofType(r, "paragraph").map((c) => c.props);
  assert.deepEqual(p.map((x) => x.fontSize), [20, 16, 24, 16, 20]);
  assert.equal(p[3].lineHeight, 1.5);
  assert.equal(p[4].lineHeight, 1.5);
});

await check("the font shorthand fills size, weight, style, family and line-height", () => {
  const p = only(imp(email(T("<p style=\"font:italic bold 18px/1.4 'Helvetica Neue',Arial,sans-serif\">a</p>"))), "paragraph").props;
  assert.equal(p.fontSize, 18);
  assert.equal(p.fontWeight, "bold");
  assert.equal(p.fontStyle, "italic");
  assert.equal(p.fontFamily, "Helvetica Neue");
  assert.equal(p.lineHeight, 1.4);
});

await check("colours: names, short hex, rgb and hsl become hex; a translucent colour stays rgba", () => {
  const r = imp(email(T('<p style="color:red">a</p><p style="color:#abc">b</p><p style="color:rgb(10,20,30)">c</p><p style="color:hsl(120,100%,25%)">d</p><p style="color:rgba(0,0,0,.5)">e</p>')));
  assert.deepEqual(ofType(r, "paragraph").map((c) => c.props.color), ["#ff0000", "#aabbcc", "#0a141e", "#008000", "rgba(0, 0, 0, 0.5)"]);
});

await check("text styles: weight, italic, underline, letter spacing, case and a px line-height", () => {
  const p = only(imp(email(T('<p style="font-weight:700;font-style:italic;text-decoration:underline;letter-spacing:2px;text-transform:uppercase;line-height:30px;font-size:18px">Styled</p>'))), "paragraph").props;
  assert.equal(p.fontWeight, "bold");
  assert.equal(p.fontStyle, "italic");
  assert.equal(p.textDecoration, "underline");
  assert.equal(p.letterSpacing, 2);
  assert.equal(p.textTransform, "uppercase");
  assert.equal(Math.round(p.lineHeight * 100), 167);
});

await check("alignment: the align attribute, <center>, text-align and a centred outer cell that inherits", () => {
  const r = imp(email(
    `<tr><td align="right">Right</td></tr>` +
      `<tr><td><center>Centre</center></td></tr>` +
      `<tr><td style="text-align:left">Left</td></tr>`,
  ));
  assert.deepEqual(ofType(r, "paragraph").map((c) => c.props.align), ["right", "center", "left"]);
  // text-align inherits through a nested table, as it does in a browser
  const inherit = imp(page('<table width="100%"><tr><td align="center"><table width="600"><tr><td>Inherited</td></tr></table></td></tr></table>'));
  assert.equal(only(inherit, "paragraph").props.align, "center");
});

await check("<font> face, size and colour are read; size 4 is 18px", () => {
  const p = only(imp(email(T('<font face="Verdana" size="4" color="#990000">Old school</font>'))), "paragraph").props;
  assert.equal(p.fontFamily, "Verdana");
  assert.equal(p.fontSize, 18);
  assert.equal(p.color, "#990000");
});

await check("inline marks stay inside the text; sub and sup are reported once, not as a size change too", () => {
  const r = imp(email(T('<p>Plain <b>bold</b> <i>ital</i> <u>under</u> <span style="color:#ff0000">red</span> <a href="https://x.example/l">link</a> <sup>2</sup><br>second</p>')));
  const content = only(r, "paragraph").props.content;
  for (const piece of ["<strong>bold</strong>", "<em>ital</em>", "<u>under</u>", 'color: #ff0000', 'href="https://x.example/l"', "<br"]) {
    assert.ok(content.includes(piece), `${piece} in ${content}`);
  }
  const c = allCodes(r);
  assert.ok(c.includes("sub-sup"), c.join(","));
  assert.ok(!c.includes("inline-font-size"), c.join(","));
});

await check("margins on paragraphs are the browser's own: 1em above and below unless the source says otherwise", () => {
  const r = imp(email(T('<p>default</p>') + T('<p style="margin:0">none</p>')));
  const [a, b] = ofType(r, "paragraph").map((c) => c.props.margin);
  assert.deepEqual(a, { top: 16, right: 0, bottom: 16, left: 0 });
  assert.deepEqual(b, { top: 0, right: 0, bottom: 0, left: 0 });
});

await check("merge tags become Maildeno merge spans, with their defaults", () => {
  const r = imp(email(T("<p>Hi {{ first_name | 'friend' }}, order {{order_id}}</p>")));
  const content = only(r, "paragraph").props.content;
  assert.ok(content.includes('data-merge="first_name"'), content);
  assert.ok(content.includes('data-merge-default="friend"'), content);
  assert.ok(content.includes('data-merge="order_id"'), content);
  assert.ok(!allCodes(r).includes("merge-syntax"), "{{ }} is Maildeno's own syntax");
});

await check("another merge syntax is kept as text and reported", () => {
  const r = imp(email(T("<p>Hello *|FNAME|* and %%name%% and ${user}</p>")));
  assert.ok(textOf(only(r, "paragraph").props.content).includes("*|FNAME|*"));
  assert.ok(allCodes(r).some((c) => c.startsWith("merge")), allCodes(r).join(","));
});

// ═════════════════════════════════════════════════════════════════════════════
group("2c. media queries become mobile overrides");
// ═════════════════════════════════════════════════════════════════════════════

await check("a max-width query is the breakpoint, and what it changes is a mobile override", () => {
  const r = imp(email(T('<p class="t">hi</p>'), "<style>.t{font-size:20px} @media (max-width:480px){.t{font-size:14px}}</style>"));
  const p = only(r, "paragraph").props;
  assert.equal(p.fontSize, 20);
  assert.equal(p.mobile.fontSize, 14);
  assert.equal(r.snapshot.canvas.mobileBreakpoint, 480);
  assert.equal(r.report.layout.breakpointSource, "media-query");
});

await check("the em-based margin that comes with a smaller font size is carried to the phone too", () => {
  const r = imp(email(T('<p class="t">hi</p>'), "<style>.t{font-size:20px} @media (max-width:480px){.t{font-size:14px}}</style>"));
  const m = only(r, "paragraph").props;
  assert.equal(m.margin.top, 20);
  assert.equal(m.mobile.margin.top, 14);
});

await check("an !important rule in the query beats the inline style, the usual way email overrides mobile", () => {
  const r = imp(email(T('<p class="t" style="font-size:20px">hi</p>'), "<style>@media only screen and (max-width:480px){.t{font-size:14px !important}}</style>"));
  const p = only(r, "paragraph").props;
  assert.equal(p.fontSize, 20);
  assert.equal(p.mobile.fontSize, 14);
});

await check("a min-width query written mobile-first gives the same result", () => {
  const r = imp(email(T('<p class="t">hi</p>'), "<style>.t{font-size:14px} @media (min-width:481px){.t{font-size:20px}}</style>"));
  const p = only(r, "paragraph").props;
  assert.equal(p.fontSize, 20);
  assert.equal(p.mobile.fontSize, 14);
});

await check("query forms: screen and, device-width, em, and a min and max range", () => {
  for (const [query, bp] of [
    ["only screen and (max-width:480px)", 480],
    ["only screen and (max-device-width:480px)", 480],
    ["(max-width:30em)", 480],
    ["screen and (min-width:320px) and (max-width:500px)", 500],
  ] as const) {
    const r = imp(email(T('<p class="t">hi</p>'), `<style>@media ${query}{.t{font-size:12px !important}}</style>`));
    assert.equal(r.snapshot.canvas.mobileBreakpoint, bp, query);
    assert.equal(only(r, "paragraph").props.mobile.fontSize, 12, query);
  }
});

await check("queries about something other than width are ignored and reported", () => {
  const r = imp(email(T('<p class="t">hi</p>'), "<style>.t{color:#111111} @media (prefers-color-scheme:dark){.t{color:#eeeeee}} @media print{.t{color:#000000}}</style>"));
  const p = only(r, "paragraph").props;
  assert.equal(p.color, "#111111");
  assert.ok(!p.mobile || p.mobile.color === undefined);
  assert.ok(allCodes(r).includes("css-media-other"), allCodes(r).join(","));
});

await check("no query: the breakpoint is 600 and says it was a default", () => {
  const r = imp(email(T("<p>x</p>")));
  assert.equal(r.snapshot.canvas.mobileBreakpoint, 600);
  assert.equal(r.report.layout.breakpointSource, "default");
});

await check("a breakpoint under 360 is clamped to 360 and reported", () => {
  const r = imp(email(T('<p class="t">hi</p>'), "<style>@media (max-width:320px){.t{font-size:14px}}</style>"));
  assert.equal(r.snapshot.canvas.mobileBreakpoint, 360);
  assert.ok(allCodes(r).includes("breakpoint"), allCodes(r).join(","));
});

await check("queries at several widths are read once at the phone width, and the report says they were combined", () => {
  const r = imp(email(T('<p class="t">hi</p>'), "<style>.t{font-size:20px} @media (max-width:600px){.t{font-size:16px}} @media (max-width:480px){.t{font-size:12px}}</style>"));
  const p = only(r, "paragraph").props;
  assert.equal(p.fontSize, 20);
  assert.equal(p.mobile.fontSize, 12);
  assert.equal(r.snapshot.canvas.mobileBreakpoint, 600);
  const entry = r.report.warnings.find((w) => w.code === "breakpoints-merged");
  assert.ok(entry, allCodes(r).join(","));
  assert.match(entry.message, /600 and 480px/);
});

await check("one width written twice, or as a min/max pair, is not several breakpoints", () => {
  const twice = imp(email(T('<p class="t">hi</p>'), "<style>@media (max-width:480px){.t{font-size:14px}} @media (max-width:480px){.t{color:#222222}}</style>"));
  assert.ok(!allCodes(twice).includes("breakpoints-merged"), allCodes(twice).join(","));
  const pair = imp(email(T('<p class="t">hi</p>'), "<style>@media (min-width:481px){.t{font-size:20px}} @media (max-width:480px){.t{font-size:14px}}</style>"));
  assert.ok(!allCodes(pair).includes("breakpoints-merged"), allCodes(pair).join(","));
});

await check("the breakpoint that actually changes something wins over one that matches nothing", () => {
  const r = imp(email(T('<p class="t">hi</p>'), "<style>@media (max-width:480px){.t{font-size:14px}} @media (max-width:600px){.nothing{color:red}}</style>"));
  assert.equal(r.snapshot.canvas.mobileBreakpoint, 480);
});

await check("hidden on phones: display:none in a query sets mobileHide, and the row keeps its place", () => {
  const r = imp(email(T('<p class="hm">only desktop</p><p>always</p>'), "<style>@media (max-width:480px){.hm{display:none !important}}</style>"));
  const [a, b] = ofType(r, "paragraph").map((c) => c.props);
  assert.equal(a.mobileHide, true);
  assert.equal(a.desktopHide, false);
  assert.equal(b.mobileHide, false);
});

await check("hidden on desktop: display:none, then display:block in a query, sets desktopHide and keeps the text", () => {
  const r = imp(email(T('<p class="dm">only mobile</p>'), "<style>.dm{display:none} @media (max-width:480px){.dm{display:block !important}}</style>"));
  const p = only(r, "paragraph").props;
  assert.equal(textOf(p.content), "only mobile");
  assert.equal(p.desktopHide, true);
});

await check("an image hidden on phones gets the flag on the image, with no stray width override", () => {
  const r = imp(email(T('<img class="hm" src="https://x.example/a.png" width="300"><p>t</p>'), "<style>@media (max-width:480px){.hm{display:none !important}}</style>"));
  const img = only(r, "image").props;
  assert.equal(img.mobileHide, true);
  assert.ok(!img.mobile || img.mobile.width === undefined);
});

await check("hidden in both views: left out, and reported", () => {
  const r = imp(email(T('<p>kept</p><p style="display:none">gone</p>')));
  assert.equal(ofType(r, "paragraph").length, 1);
  assert.ok(codes(r.report.dropped).includes("hidden"));
});

await check("a column whose blocks are all hidden on phones keeps its width in a row that does not stack, and the report says so", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="50%" class="hm">Side</td><td width="50%">Main</td></tr></table></td></tr>`, "<style>@media (max-width:480px){.hm{display:none !important}}</style>"));
  assert.ok(allCodes(r).includes("column-hidden"), allCodes(r).join(","));
});

await check("a row hidden on phones leaves its fill and padding behind, and says so; a bare one does not", () => {
  const withPad = imp(email(`<tr><td class="hm" style="padding:20px;background:#ffeedd">Banner</td></tr>` + T("<p>x</p>"), "<style>@media (max-width:480px){.hm{display:none !important}}</style>"));
  assert.ok(allCodes(withPad).includes("row-hidden"));
  const bare = imp(email(`<tr><td class="hm">Banner</td></tr>` + T("<p>x</p>"), "<style>@media (max-width:480px){.hm{display:none !important}}</style>"));
  assert.ok(!allCodes(bare).includes("row-hidden"), allCodes(bare).join(","));
});

await check("column and row spacing in a query become mobile overrides on the column and the row", () => {
  const col = imp(email(`<tr><td><table width="100%"><tr><td class="pad" width="50%" style="padding:30px">A</td><td width="50%" style="padding:30px">B</td></tr></table></td></tr>`, "<style>@media (max-width:480px){.pad{padding:10px !important}}</style>"));
  const row = topRows(col)[0];
  assert.deepEqual(row.columns[0].mobile.padding, { top: 10, right: 10, bottom: 10, left: 10 });
  assert.ok(!row.columns[1].mobile);
  const r2 = imp(email(`<tr><td class="r" style="padding:40px 60px;background:#f6f6f6"><p>x</p></td></tr>`, "<style>@media (max-width:480px){.r{padding:20px 16px !important}}</style>"));
  assert.deepEqual(topRows(r2)[0].mobile.padding, { top: 20, right: 16, bottom: 20, left: 16 });
});

await check("an image that goes full width on a phone has a mobile width of 100", () => {
  const r = imp(email(T('<img class="im" src="https://x.example/a.png" width="300" alt="a">'), "<style>@media (max-width:480px){img.im{width:100% !important;height:auto !important}}</style>"));
  const img = only(r, "image").props;
  assert.equal(img.width, 50);
  assert.equal(img.mobile.width, 100);
});

await check("a text-align change in a query is a mobile align", () => {
  const r = imp(email(T('<p class="al" style="text-align:left">hi</p>'), "<style>@media (max-width:480px){.al{text-align:center !important}}</style>"));
  const p = only(r, "paragraph").props;
  assert.equal(p.align, "left");
  assert.equal(p.mobile.align, "center");
});

await check("only what differs is in mobile: an unchanged property is never repeated", () => {
  const r = imp(email(T('<p class="t" style="color:#222222;margin:0">hi</p>'), "<style>@media (max-width:480px){.t{font-size:12px !important}}</style>"));
  const m = only(r, "paragraph").props.mobile;
  assert.deepEqual(Object.keys(m).sort(), ["fontSize"]);
});

await check("a button that fills a phone's width is reported, since Maildeno buttons have no such setting", () => {
  const r = imp(email(T('<a class="b" href="https://x.example/go" style="display:inline-block;background:#00aa55;color:#fff;padding:10px 20px">Go</a>'), "<style>@media (max-width:480px){.b{display:block !important}}</style>"));
  assert.equal(only(r, "button").props.text, "Go");
  assert.ok(allCodes(r).includes("mobile-unsupported-button-width"), allCodes(r).join(","));
});

// ═════════════════════════════════════════════════════════════════════════════
group("2d. paint: fills, images, gradients, borders, shadows");
// ═════════════════════════════════════════════════════════════════════════════

await check("a gradient on a cell is a row gradient, with its colour stops and angle", () => {
  const r = imp(email(T("<p>x</p>", "background-image:linear-gradient(90deg,#ff0000 0%,#0000ff 100%);background-color:#ff0000;padding:20px")));
  const row = topRows(r)[0];
  assert.equal(row.backgroundGradient.useGradient, true);
  assert.equal(row.backgroundGradient.gradient.direction, "90deg");
  assert.deepEqual(row.backgroundGradient.gradient.colors.map((c: any) => [c.color, c.position]), [["#ff0000", 0], ["#0000ff", 100]]);
  assert.equal(row.backgroundColor, "#ff0000", "the fallback colour is the first stop or the solid colour");
});

await check("a background image keeps its size, position and repeat, and a fixed height is the row's minimum height", () => {
  const r = imp(email(T("<p>x</p>", "background-image:url('https://x.example/bg.jpg');background-size:cover;background-position:center center;background-repeat:no-repeat;background-color:#222222;padding:30px;height:300px")));
  const row = topRows(r)[0];
  assert.equal(row.backgroundImage, "https://x.example/bg.jpg");
  assert.equal(row.backgroundSize, "cover");
  assert.equal(row.backgroundRepeat, "no-repeat");
  assert.equal(row.backgroundColor, "#222222");
  assert.equal(row.minHeight, 300);
});

await check("the background attribute (no CSS) tiles, as a browser draws it", () => {
  const r = imp(email(`<tr><td background="https://x.example/bg2.jpg" bgcolor="#334455" height="200" style="padding:10px"><p>x</p></td></tr>`));
  const row = topRows(r)[0];
  assert.equal(row.backgroundImage, "https://x.example/bg2.jpg");
  assert.equal(row.backgroundRepeat, "repeat");
  assert.equal(row.backgroundSize, "auto");
  assert.equal(row.backgroundColor, "#334455");
  assert.equal(row.minHeight, 200);
});

await check("a column keeps its own border, radius, shadow, fill, padding and vertical alignment", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="50%" valign="top" style="border:1px solid #dddddd;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);background:#fafafa;padding:16px">A</td><td width="50%" valign="bottom" style="padding:16px">B</td></tr></table></td></tr>`));
  const [a, b] = topRows(r)[0].columns;
  assert.deepEqual(a.border, { width: 1, color: "#dddddd", style: "solid", radius: 8 });
  assert.equal(a.boxShadow.enabled, true);
  assert.deepEqual([a.boxShadow.offsetX, a.boxShadow.offsetY, a.boxShadow.blur], [0, 2, 6]);
  assert.equal(a.backgroundColor, "#fafafa");
  assert.deepEqual(a.padding, { top: 16, right: 16, bottom: 16, left: 16 });
  assert.equal(a.verticalAlign, "top");
  assert.equal(b.verticalAlign, "bottom");
});

await check("a fixed height on a plain cell is a minimum height", () => {
  const r = imp(email(`<tr><td height="120" style="background:#ddeeff">Tall band</td></tr>`));
  assert.equal(topRows(r)[0].minHeight, 120);
});

await check("a border on only some sides cannot be held, so it is dropped and reported", () => {
  const r = imp(email(`<tr><td style="border-top:2px solid #cc0000;padding:12px">Only a top rule</td></tr>`));
  assert.ok(allCodes(r).includes("border-partial") || ofType(r, "divider").length > 0, allCodes(r).join(","));
});

await check("a border and rounded corners on a text block's own element are reported as lost", () => {
  const r = imp(email(T('<p style="border-left:4px solid #999;padding-left:12px;margin:0">Quote</p>')));
  const c = allCodes(r);
  assert.ok(c.includes("text-decor") || c.includes("border-partial"), c.join(","));
});

await check("a background image on the same cell as a fill keeps both", () => {
  const r = imp(email(T("<p>x</p>", "background:#102030 url(https://x.example/t.png) repeat-x")));
  const row = topRows(r)[0];
  assert.equal(row.backgroundColor, "#102030");
  assert.equal(row.backgroundRepeat, "repeat-x");
});

await check("every paint value is a value the editor accepts", () => {
  const r = imp(email(
    T("<p>a</p>", "background:#abc") + T("<p>b</p>", "background:rgba(10,20,30,.5);padding:8px") + T("<p>c</p>", "background:linear-gradient(to bottom,#fff,#000)"),
  ));
  valid(r);
  for (const row of allRows(r)) {
    assert.match(row.backgroundColor, /^(#[0-9a-f]{6}|transparent|rgba?\([^)]*\))$/, row.backgroundColor);
  }
});
