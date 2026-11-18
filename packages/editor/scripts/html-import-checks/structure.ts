/**
 * Group 3: structure.
 *
 * How tables, floats, inline-blocks and flex become rows and columns; what makes a
 * row stack on a phone; and how each block type is recognised: heading, paragraph,
 * anchor, button, image, video, divider, spacer, list, menu, socials. Last, markup
 * that email actually contains and that tends to trip importers up.
 */

import {
  assert, check, group, imp, page, email, only, ofType, topRows, allRows, widthsOf, depthOf,
  codes, allCodes, textOf, valid, components,
} from "../lib/html-import-harness";

const T = (inner: string, style = ""): string => `<tr><td style="${style}">${inner}</td></tr>`;
const widthSum = (w: number[]): number => w.reduce((a, b) => a + b, 0);

// ═════════════════════════════════════════════════════════════════════════════
group("3a. rows and columns");
// ═════════════════════════════════════════════════════════════════════════════

await check("a table cell holding one block is a single-column row", () => {
  const r = imp(email(T("<p>one</p>") + T("<p>two</p>")));
  const rows = topRows(r);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((x) => x.columns.length === 1 && x.columns[0].width === 100));
});

await check("two cells side by side are two columns, with their percentage widths", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="30%">A</td><td width="70%">B</td></tr></table></td></tr>`));
  const row = topRows(r)[0];
  assert.deepEqual(widthsOf(row), [30, 70]);
});

await check("a gap cell between two columns becomes the row's gap, and the columns share what is left", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="48%" valign="top">A</td><td width="4%"></td><td width="48%" valign="top">B</td></tr></table></td></tr>`));
  const row = topRows(r)[0];
  assert.equal(row.columns.length, 2);
  assert.equal(row.gap, 24);
  assert.deepEqual(widthsOf(row), [50, 50]);
});

await check("a gap given in px is the same gap", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="290">A</td><td width="20"></td><td width="290">B</td></tr></table></td></tr>`));
  const row = topRows(r)[0];
  assert.equal(row.gap, 20);
  assert.equal(row.columns.length, 2);
});

await check("px widths become whole percentages that add up to exactly 100", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="200">A</td><td width="200">B</td><td width="200">C</td></tr></table></td></tr>`));
  const w = widthsOf(topRows(r)[0]);
  assert.equal(widthSum(w), 100);
  assert.ok(w.every((x) => Number.isInteger(x) && x >= 5), w.join(","));
});

await check("cells without widths share the row evenly", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td>A</td><td>B</td><td>C</td><td>D</td></tr></table></td></tr>`));
  assert.deepEqual(widthsOf(topRows(r)[0]), [25, 25, 25, 25]);
});

await check("a fixed-width cell beside a flexible one keeps its share", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="150" valign="top">img</td><td valign="top">text</td></tr></table></td></tr>`));
  assert.deepEqual(widthsOf(topRows(r)[0]), [25, 75]);
});

await check("a cell that spans both columns is a row of its own above the columns", () => {
  const r = imp(email(`<tr><td colspan="2">Header across</td></tr><tr><td width="50%">L</td><td width="50%">R</td></tr>`));
  const rows = topRows(r);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].columns.length, 1);
  assert.equal(rows[1].columns.length, 2);
});

await check("columns inside a column are a nested row", () => {
  const r = imp(email(`<tr><td style="padding:20px;background:#f0f0f0"><table width="100%"><tr><td width="50%" style="background:#ffffff;padding:10px"><table width="100%"><tr><td width="50%">a</td><td width="50%">b</td></tr></table></td><td width="50%">c</td></tr></table></td></tr>`));
  const outer = topRows(r)[0];
  assert.equal(outer.columns.length, 2);
  assert.equal(outer.backgroundColor, "#f0f0f0");
  assert.deepEqual(outer.padding, { top: 20, right: 20, bottom: 20, left: 20 });
  const nested = outer.columns[0].children.find((c: any) => c.type === "row");
  assert.ok(nested, "a nested row in the first column");
  assert.equal(nested.columns.length, 2);
  assert.equal(outer.columns[0].backgroundColor, "#ffffff");
  assert.equal(depthOf(outer), 2);
});

await check("floated tables are columns, the way Mailchimp-style layouts build them", () => {
  const r = imp(email(`<tr><td><table align="left" width="290" style="float:left"><tr><td>A</td></tr></table><table align="right" width="290" style="float:right"><tr><td>B</td></tr></table></td></tr>`));
  const row = topRows(r)[0];
  assert.equal(row.columns.length, 2);
  assert.deepEqual(widthsOf(row), [50, 50]);
});

await check("inline-block columns (the hybrid pattern), ghost tables around them ignored", () => {
  const r = imp(email(`<tr><td style="font-size:0"><!--[if mso]><table role="presentation" width="600"><tr><td width="300"><![endif]--><div style="display:inline-block;width:100%;max-width:300px;vertical-align:top;font-size:16px">A</div><!--[if mso]></td><td width="300"><![endif]--><div style="display:inline-block;width:100%;max-width:300px;vertical-align:top;font-size:16px">B</div><!--[if mso]></td></tr></table><![endif]--></td></tr>`));
  const rows = topRows(r);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].columns.length, 2);
  assert.deepEqual(ofType(r, "paragraph").map((p) => textOf(p.props.content)), ["A", "B"]);
});

await check("a flex row is columns with its gap, and the report says flexbox is weakly supported", () => {
  const r = imp(page('<div style="max-width:600px;margin:0 auto"><div style="display:flex;gap:20px"><div style="flex:1">A</div><div style="flex:1">B</div></div></div>'));
  const row = topRows(r)[0];
  assert.equal(row.columns.length, 2);
  assert.equal(row.gap, 20);
  assert.ok(allCodes(r).includes("flex-layout"));
});

await check("a header row (thead, th) becomes bold centred text and the table is flagged as data", () => {
  const r = imp(email(`<tr><td><table width="100%"><thead><tr><th>Head</th></tr></thead><tbody><tr><td>Body</td></tr></tbody></table></td></tr>`));
  const [head] = ofType(r, "paragraph");
  assert.equal(head.props.fontWeight, "bold");
  assert.equal(head.props.align, "center");
  assert.ok(allCodes(r).includes("data-table"));
});

await check("rows keep the order of the source", () => {
  const r = imp(email(T("<h2>One</h2>") + T("<p>Two</p>") + T('<a href="https://x.example/3" style="display:inline-block;background:#111;color:#fff;padding:8px 16px">Three</a>') + T("<p>Four</p>")));
  assert.deepEqual(components(r.snapshot).map((c) => c.type), ["heading", "paragraph", "button", "paragraph"]);
});

// ═════════════════════════════════════════════════════════════════════════════
group("3b. stacking");
// ═════════════════════════════════════════════════════════════════════════════

const twoCols = (cls = ""): string =>
  `<tr><td><table width="100%"><tr><td ${cls} width="50%" valign="top">A</td><td ${cls} width="50%" valign="top">B</td></tr></table></td></tr>`;

await check("columns that the source turns into full-width blocks on a phone stack", () => {
  const r = imp(email(twoCols('class="col"'), "<style>@media (max-width:480px){.col{display:block !important;width:100% !important}}</style>"));
  assert.equal(topRows(r)[0].mobileStack, true);
  assert.ok(!allCodes(r).includes("no-stack"));
});

await check("columns that stay table cells on a phone do not stack, and the report says so", () => {
  const r = imp(email(twoCols()));
  assert.equal(topRows(r)[0].mobileStack, false);
  assert.ok(allCodes(r).includes("no-stack"));
});

await check("a row with one column has nothing to stack and says nothing about it", () => {
  const r = imp(email(T("<p>x</p>")));
  assert.equal(topRows(r)[0].mobileStack, true);
  assert.ok(!allCodes(r).includes("no-stack"));
});

await check("when only some columns stack, the majority decides and the report says it was mixed", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td class="s" width="33%">A</td><td class="s" width="33%">B</td><td width="34%">C</td></tr></table></td></tr>`, "<style>@media (max-width:480px){.s{display:block !important;width:100% !important}}</style>"));
  assert.equal(topRows(r)[0].mobileStack, true);
  assert.ok(allCodes(r).includes("stack-mixed"));
});

await check("hybrid inline-blocks that wrap on a phone stack; ones that still fit do not", () => {
  const wraps = imp(email(`<tr><td style="font-size:0"><div style="display:inline-block;width:100%;max-width:300px;font-size:16px">A</div><div style="display:inline-block;width:100%;max-width:300px;font-size:16px">B</div></td></tr>`));
  assert.equal(topRows(wraps)[0].mobileStack, true);
  const fits = imp(email(`<tr><td style="font-size:0"><div style="display:inline-block;width:150px;font-size:16px">A</div><div style="display:inline-block;width:150px;font-size:16px">B</div></td></tr>`));
  assert.equal(topRows(fits)[0].mobileStack, false);
});

await check("a flex row stays a row on a phone unless the source wraps it or makes it a column", () => {
  const plain = imp(page('<div style="max-width:600px;margin:0 auto"><div style="display:flex"><div style="flex:1">A</div><div style="flex:1">B</div></div></div>'));
  assert.equal(topRows(plain)[0].mobileStack, false);
});

await check("floats that go full width on a phone stack", () => {
  const r = imp(email(`<tr><td><table class="f" align="left" width="290" style="float:left"><tr><td>A</td></tr></table><table class="f" align="right" width="290" style="float:right"><tr><td>B</td></tr></table></td></tr>`, "<style>@media (max-width:480px){.f{float:none !important;width:100% !important}}</style>"));
  assert.equal(topRows(r)[0].mobileStack, true);
});

await check("the gap between stacked columns is what the gap cell becomes on a phone", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td class="c2" width="48%">A</td><td width="4%"></td><td class="c2" width="48%">B</td></tr></table></td></tr>`, "<style>@media (max-width:480px){.c2{display:block !important;width:100% !important}}</style>"));
  const row = topRows(r)[0];
  assert.equal(row.mobileStack, true);
  assert.equal(row.gap, 24);
});

// ═════════════════════════════════════════════════════════════════════════════
group("3c. text blocks");
// ═════════════════════════════════════════════════════════════════════════════

await check("h1 to h3 are headings with their level, the browser's size and margins", () => {
  const r = imp(email(T("<h1>One</h1>") + T('<h2 style="font-size:22px;color:#111">Two</h2>') + T("<h3>Three</h3>")));
  const h = ofType(r, "heading").map((c) => c.props);
  assert.deepEqual(h.map((x) => x.level), ["h1", "h2", "h3"]);
  assert.equal(h[0].fontSize, 32);
  assert.equal(h[1].fontSize, 22);
  assert.equal(h[1].color, "#111111");
  assert.equal(h[0].fontWeight, "bold");
});

await check("a heading's text and a paragraph under it are separate blocks in one column", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="150" valign="top"><img src="https://x.example/a.png" width="130"></td><td valign="top"><h3 style="margin:0">Heading</h3><p style="margin:4px 0 0">Text</p></td></tr></table></td></tr>`));
  const row = topRows(r)[0];
  assert.equal(row.columns.length, 2);
  assert.deepEqual(row.columns[1].children.map((c: any) => c.componentType), ["heading", "paragraph"]);
  assert.equal(row.columns[0].children[0].componentType, "image");
});

await check("text, an image and more text in one cell are three blocks in that order", () => {
  const r = imp(email(T('Intro words<br><img src="https://x.example/a.png" width="200" alt="mid"><br>Outro words')));
  assert.deepEqual(components(r.snapshot).map((c) => c.type), ["paragraph", "image", "paragraph"]);
});

await check("line breaks stay line breaks, doubled ones too", () => {
  const r = imp(email(T("Line one<br>Line two<br><br>Line four")));
  assert.equal(only(r, "paragraph").props.content, "Line one<br>Line two<br><br>Line four");
});

await check("section, header and article are plain wrappers", () => {
  const r = imp(email(`<tr><td><section><header><h2>Title</h2></header><article><p>Body text</p></article></section></td></tr>`));
  assert.deepEqual(components(r.snapshot).map((c) => c.type), ["heading", "paragraph"]);
});

await check("a lone link is an anchor and keeps its colour and size", () => {
  const r = imp(email(T('<a href="https://x.example/more" style="color:#cc0000;font-size:14px">Read more →</a>')));
  const a = only(r, "anchor").props;
  assert.equal(a.text, "Read more →");
  assert.equal(a.link, "https://x.example/more");
  assert.equal(a.color, "#cc0000");
  assert.equal(a.fontSize, 14);
});

await check("an empty named anchor (<a name>) is not content", () => {
  const r = imp(email(T('<a name="top"></a><p>x</p>')));
  assert.deepEqual(components(r.snapshot).map((c) => c.type), ["paragraph"]);
});

await check("whitespace, nbsp and zero-width characters are not content", () => {
  const r = imp(page('<table><tr><td>   &nbsp;  </td></tr></table><p>real</p>'));
  assert.deepEqual(components(r.snapshot).map((c) => textOf(c.props.content)), ["real"]);
});

await check("a list's items keep their inline marks; its typography is the item's, past a <font> or <span>", () => {
  const r = imp(email(T('<ul style="margin:0;padding-left:24px"><li><font face="Verdana" color="#336699">One</font></li><li>Two <b>bold</b></li></ul>')));
  const l = only(r, "list").props;
  assert.ok(l.content.startsWith("<ul>") && l.content.includes("<strong>bold</strong>"), l.content);
  assert.equal(l.fontFamily, "Verdana");
  assert.equal(l.color, "#336699");
  assert.deepEqual(l.padding, { top: 0, right: 0, bottom: 0, left: 24 });
});

await check("ordered and unordered lists keep their kind; the browser's 40px indent is the padding", () => {
  const r = imp(email(T("<ol><li>First</li><li>Second</li></ol>")));
  const l = only(r, "list").props;
  assert.ok(l.content.startsWith("<ol>"), l.content);
  assert.equal(l.padding.left, 40);
});

await check("a nested list is flattened and reported", () => {
  const r = imp(email(T("<ul><li>One<ul><li>Inner</li></ul></li><li>Two</li></ul>")));
  assert.equal((only(r, "list").props.content.match(/<li>/g) ?? []).length, 3);
  assert.ok(allCodes(r).includes("nested-list"));
});

await check("pre-formatted text becomes a paragraph and the loss is reported", () => {
  const r = imp(email(T("<pre>a\n  b</pre>")));
  assert.equal(ofType(r, "paragraph").length, 1);
  assert.ok(allCodes(r).includes("pre"));
});

// ═════════════════════════════════════════════════════════════════════════════
group("3d. buttons");
// ═════════════════════════════════════════════════════════════════════════════

await check("the bulletproof button: a table cell with a fill and radius around a link", () => {
  const r = imp(email(T('<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="#0055ff" style="border-radius:6px;padding:12px 24px"><a href="https://x.example/go" style="color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;font-family:Arial">Buy now</a></td></tr></table>')));
  const b = only(r, "button").props;
  assert.equal(b.text, "Buy now");
  assert.equal(b.link, "https://x.example/go");
  assert.equal(b.backgroundColor, "#0055ff");
  assert.equal(b.color, "#ffffff");
  assert.equal(b.borderRadius, 6);
  assert.deepEqual(b.padding, { top: 12, right: 24, bottom: 12, left: 24 });
  assert.equal(b.fontWeight, "bold");
  assert.equal(b.align, "center");
});

await check("a styled link: border, radius, letter spacing, shadow and alignment from the cell", () => {
  const r = imp(email(T('<a href="https://x.example/go" style="display:inline-block;background:#00aa55;color:#fff;padding:10px 20px;border:2px solid #007733;border-radius:4px;letter-spacing:1px;box-shadow:0 2px 4px rgba(0,0,0,0.3);font-weight:600">Go</a>', "text-align:right")));
  const b = only(r, "button").props;
  assert.equal(b.align, "right");
  assert.equal(b.letterSpacing, 1);
  assert.deepEqual(b.border, { width: 2, color: "#007733", style: "solid" });
  assert.equal(b.boxShadow.enabled, true);
  assert.equal(b.fontWeight, "bold", "600 is bold; the editor has no 'medium'");
});

await check("an outlined button has no fill, only a border", () => {
  const r = imp(email(T('<a href="https://x.example/go" style="display:inline-block;border:2px solid #0055ff;color:#0055ff;padding:8px 20px;border-radius:30px;text-decoration:none">Learn more</a>')));
  const b = only(r, "button").props;
  assert.equal(b.backgroundColor, "transparent");
  assert.equal(b.border.width, 2);
  assert.equal(b.borderRadius, 30);
});

await check("a button sized by line-height and width is rebuilt with padding, and the report says it is approximate", () => {
  const r = imp(email(T('<a href="https://x.example/go" style="display:inline-block;background:#e91e63;color:#fff;line-height:44px;width:180px;text-align:center;text-decoration:none;font-size:16px">Sign up</a>')));
  const b = only(r, "button").props;
  assert.ok(b.padding.top >= 10 && b.padding.top <= 14, `top ${b.padding.top}`);
  assert.ok(b.padding.left >= 50, `left ${b.padding.left}`);
  assert.ok(allCodes(r).includes("button-size"));
});

await check("an icon inside the button link becomes the button's icon", () => {
  const r = imp(email(T('<a href="https://x.example/go" style="display:inline-block;background:#222;color:#fff;padding:10px 18px;text-decoration:none"><img src="https://x.example/i.png" width="16" height="16" alt=""> Download</a>')));
  const b = only(r, "button").props;
  assert.equal(b.text, "Download");
  assert.equal(b.icon, "https://x.example/i.png");
  assert.equal(b.iconSize, 16);
});

await check("a long link or one with no fill is an anchor, not a button", () => {
  const r = imp(email(T('<a href="https://x.example/a">A sentence-long link that is far too long to be a button, with many words in it, so it stays a link</a>')));
  assert.equal(ofType(r, "button").length, 0);
});

await check("a button link that is a merge tag is kept as it is", () => {
  const r = imp(email(T('<a href="{{ cta_url }}" style="display:inline-block;background:#111;color:#fff;padding:8px 16px">Open</a>')));
  assert.equal(only(r, "button").props.link, "{{ cta_url }}");
});

// ═════════════════════════════════════════════════════════════════════════════
group("3e. images, video, dividers, spacers");
// ═════════════════════════════════════════════════════════════════════════════

await check("an image's width is a share of its column: 300px in a 600px canvas is 50", () => {
  const r = imp(email(T('<img src="https://x.example/a.png" width="300" alt="half" style="display:block">')));
  const i = only(r, "image").props;
  assert.equal(i.width, 50);
  assert.equal(i.alt, "half");
  assert.equal(i.height, "auto");
});

await check("width:100% and max-width:100% images are 100", () => {
  const r = imp(email(T('<img src="https://x.example/a.png" style="width:100%;height:auto;display:block;border:0">') + T('<img src="https://x.example/b.png" width="600" style="max-width:100%;display:block">')));
  assert.deepEqual(ofType(r, "image").map((c) => c.props.width), [100, 100]);
});

await check("an image in a link is a linked image: the link is on and kept", () => {
  const r = imp(email(T('<a href="https://x.example/l"><img src="https://x.example/b.png" alt="linked" style="width:100%;display:block;border:0"></a>')));
  const i = only(r, "image").props;
  assert.equal(i.enabled, true);
  assert.equal(i.link, "https://x.example/l");
});

await check("an unlinked image has the link off", () => {
  const r = imp(email(T('<img src="https://x.example/b.png" width="100">')));
  assert.equal(only(r, "image").props.enabled, false);
});

await check("alignment comes from the cell, the align attribute or auto margins", () => {
  const r = imp(email(
    T('<img src="https://x.example/1.png" width="100" style="display:block">', "text-align:right") +
      T('<img src="https://x.example/2.png" width="100" align="right">') +
      T('<img src="https://x.example/3.png" width="100" style="display:block;margin:0 auto">') +
      T('<img src="https://x.example/4.png" width="100">', "text-align:center"),
  ));
  assert.deepEqual(ofType(r, "image").map((c) => c.props.align), ["right", "right", "center", "center"]);
});

await check("an image's border radius is kept", () => {
  const r = imp(email(T('<img src="https://x.example/c.png" alt="round" width="100" height="100" style="border-radius:50px">')));
  assert.equal(only(r, "image").props.borderRadius, 50);
});

await check("a fixed-size image shrinks with its column on a phone: its mobile width is what the same pixels are of the phone", () => {
  const r = imp(email(T('<img src="https://x.example/a.png" width="300" alt="a">')));
  const i = only(r, "image").props;
  assert.equal(i.width, 50);
  assert.equal(i.mobile.width, 80);
});

await check("an image with no source or a 1x1 tracking pixel is dropped and reported", () => {
  const r = imp(email(T('<img alt="nothing"><p>t</p><img src="https://t.example/open.gif" width="1" height="1" alt="">')));
  assert.equal(ofType(r, "image").length, 0);
  const c = allCodes(r);
  assert.ok(c.includes("image-no-src") && c.includes("tracking-pixel"), c.join(","));
});

await check("two images side by side are two columns of one image each", () => {
  const r = imp(email(`<tr><td><table width="100%"><tr><td width="50%"><img src="https://x.example/a.png" style="width:100%;display:block"></td><td width="50%"><img src="https://x.example/b.png" style="width:100%;display:block"></td></tr></table></td></tr>`));
  const row = topRows(r)[0];
  assert.equal(row.columns.length, 2);
  assert.deepEqual(row.columns.map((c: any) => c.children[0].componentType), ["image", "image"]);
  assert.deepEqual(row.columns.map((c: any) => c.children[0].props.width), [100, 100]);
});

await check("a <video> with a poster is a video block with its cover image", () => {
  const r = imp(email(T('<video poster="https://x.example/p.jpg" src="https://x.example/v.mp4" width="400"></video>')));
  const v = only(r, "video").props;
  assert.equal(v.coverImage, "https://x.example/p.jpg");
  assert.equal(v.src, "https://x.example/v.mp4");
  assert.equal(v.width, 67);
});

await check("dividers: an <hr>, a bordered cell and a thin filled cell are all dividers", () => {
  const r = imp(email(
    T('<hr style="border:0;border-top:1px solid #cccccc;margin:20px 0">') +
      T("&nbsp;", "border-top:2px solid #dddddd;font-size:0;line-height:0;height:0") +
      `<tr><td height="1" bgcolor="#bbbbbb" style="font-size:1px;line-height:1px">&nbsp;</td></tr>`,
  ));
  const d = ofType(r, "divider").map((c) => c.props);
  assert.equal(d.length, 3);
  assert.deepEqual(d.map((x) => [x.height, x.backgroundColor]), [[1, "#cccccc"], [2, "#dddddd"], [1, "#bbbbbb"]]);
  assert.equal(d[0].margin.top, 20);
});

await check("spacers: an empty cell with a height, a sized div and an nbsp paragraph", () => {
  const r = imp(email(
    `<tr><td height="24" style="font-size:0;line-height:0">&nbsp;</td></tr>` + T('<div style="height:30px;line-height:30px">&nbsp;</div>') + T("<p>&nbsp;</p>"),
  ));
  const spacers = r.snapshot.rows.filter((n: any) => n.type === "row-spacer");
  assert.equal(spacers.length, 3);
  assert.deepEqual(spacers.slice(0, 2).map((s: any) => s.height), [24, 30]);
  assert.ok(spacers[2].height >= 40 && spacers[2].height <= 60, `nbsp paragraph: ${spacers[2].height}`);
});

await check("a spacer's height can change on a phone", () => {
  const r = imp(email(`<tr><td class="sp" height="48" style="font-size:0;line-height:0">&nbsp;</td></tr>` + T("<p>x</p>"), "<style>@media (max-width:480px){.sp{height:16px !important}}</style>"));
  const s = r.snapshot.rows.find((n: any) => n.type === "row-spacer");
  assert.ok(s, "a spacer row");
  assert.equal(s.height, 48);
  assert.equal(s.mobile?.height, 16);
});

// ═════════════════════════════════════════════════════════════════════════════
group("3f. menus and socials");
// ═════════════════════════════════════════════════════════════════════════════

await check("a row of short links is a menu, with the padding between them as its spacing", () => {
  const link = (l: string, h: string) => `<a href="https://x.example/${h}" style="color:#333;text-decoration:none;padding:0 10px">${l}</a>`;
  const r = imp(email(T(link("Home", "a") + link("Blog", "b") + link("Shop", "c"), "text-align:center")));
  const m = only(r, "menu").props;
  assert.deepEqual(m.items.map((i: any) => i.label), ["Home", "Blog", "Shop"]);
  assert.deepEqual(m.items.map((i: any) => i.link), ["https://x.example/a", "https://x.example/b", "https://x.example/c"]);
  assert.equal(m.spacing, 20);
  assert.equal(m.align, "center");
  assert.equal(m.textDecoration, "none");
});

await check("links told apart by | or • are a menu; the separators go and the links stay apart", () => {
  const r = imp(email(T('<a href="https://x.example/a">Home</a> | <a href="https://x.example/b">Blog</a> • <a href="https://x.example/c">Shop</a>', "text-align:center")));
  const m = only(r, "menu").props;
  assert.equal(m.items.length, 3);
  assert.ok(m.spacing >= 12, `spacing ${m.spacing}`);
  assert.ok(allCodes(r).includes("menu-separators"));
});

await check("links that each take a line are separate anchors, not a menu", () => {
  const r = imp(email(T('<a href="https://x.example/a" style="display:block;padding:6px 0">One</a><a href="https://x.example/b" style="display:block;padding:6px 0">Two</a>')));
  assert.equal(ofType(r, "menu").length, 0);
  assert.equal(ofType(r, "anchor").length, 2);
});

await check("links in a sentence are text, not a menu", () => {
  const r = imp(email(T('<p>Read the <a href="https://x.example/a">docs</a> or the <a href="https://x.example/b">blog</a> first.</p>')));
  assert.equal(ofType(r, "menu").length, 0);
  assert.equal(ofType(r, "paragraph").length, 1);
});

await check("icon links to known networks are a socials block, with names from the URL", () => {
  const icon = (href: string, n: number) => `<a href="${href}"><img src="https://c.example/${n}.png" width="24" height="24" alt="icon"></a>`;
  const r = imp(email(T(
    icon("https://www.facebook.com/a", 1) + icon("https://x.com/a", 2) + icon("https://twitter.com/a", 3) + icon("https://www.instagram.com/a", 4) +
      icon("https://www.linkedin.com/company/a", 5) + icon("https://www.youtube.com/a", 6),
    "text-align:center",
  )));
  const s = only(r, "socials").props;
  // the editor's own spelling: its default socials are "Youtube" and "Linkedin"
  assert.deepEqual(s.platforms.map((p: any) => p.name), ["Facebook", "X", "Twitter", "Instagram", "Linkedin", "Youtube"]);
  assert.ok(s.platforms.every((p: any) => p.enabled && p.icon.startsWith("https://c.example/")));
  assert.equal(s.align, "center");
});

await check("icons that are not a known network are an image row, not socials", () => {
  const r = imp(email(T('<a href="https://example.org/a"><img src="https://c.example/1.png" width="24" alt="o"></a><a href="https://example.net/b"><img src="https://c.example/2.png" width="24" alt="p"></a>', "text-align:center")));
  assert.equal(ofType(r, "socials").length, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
group("3g. markup email really contains");
// ═════════════════════════════════════════════════════════════════════════════

await check("conditional comments are not content; content for every client except Outlook is kept", () => {
  const r = imp(email(`<tr><td><!--[if mso]><table><tr><td><![endif]--><p>Visible</p><!--[if mso]></td></tr></table><![endif]--><!--[if !mso]><!--><p>Not Outlook</p><!--<![endif]--></td></tr>`));
  assert.deepEqual(ofType(r, "paragraph").map((c) => textOf(c.props.content)), ["Visible", "Not Outlook"]);
});

await check("VML (v: and o: elements) and Outlook-only blocks add nothing", () => {
  const r = imp(email(`<tr><td><!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:200px"><v:fill type="tile" src="https://x.example/bg.png" color="#333333"/><v:textbox inset="0,0,0,0"><![endif]--><p>Over a background</p><!--[if gte mso 9]></v:textbox></v:rect><![endif]--></td></tr>`));
  assert.deepEqual(ofType(r, "paragraph").map((c) => textOf(c.props.content)), ["Over a background"]);
  valid(r);
});

await check("<center>, <font>, bgcolor, valign and align attributes from older markup", () => {
  const r = imp(email(`<tr><td bgcolor="#ffeecc" valign="middle" align="center"><center><font face="Verdana" size="4" color="#990000">Old school</font></center></td></tr>`));
  const row = topRows(r)[0];
  const p = only(r, "paragraph").props;
  assert.equal(row.backgroundColor, "#ffeecc");
  assert.equal(p.align, "center");
  assert.equal(p.fontFamily, "Verdana");
});

await check("pt, mm and in units and legacy sizes are read as CSS would", () => {
  const r = imp(email(T('<p style="font-size:12pt;margin:0">a</p><p style="font-size:10.5pt;margin:0">b</p>')));
  const [a, b] = ofType(r, "paragraph").map((c) => c.props.fontSize);
  assert.equal(a, 16);
  assert.ok(Math.abs(b - 14) < 0.1, String(b));
});

await check("a page with no tables is a plain column: the body's max-width is the canvas and its padding goes onto the blocks", () => {
  const r = imp(page("<h1>Title</h1><p>Paragraph one.</p><p>Paragraph two.</p>", "<style>body{max-width:640px;margin:0 auto;padding:24px;font-family:Georgia,serif;color:#222}</style>"));
  assert.equal(r.snapshot.canvas.width, 640);
  assert.deepEqual(components(r.snapshot).map((c) => c.type), ["heading", "paragraph", "paragraph"]);
  const [h, p1, p2] = components(r.snapshot).map((c) => c.props);
  assert.equal(h.padding.left, 24);
  assert.equal(p1.padding.right, 24);
  assert.equal(p2.padding.bottom, 24);
  assert.equal(h.fontFamily, "Georgia");
});

await check("a width-less page gets a 600px canvas and the report says so", () => {
  const r = imp(page("<p>just text</p>"));
  assert.equal(r.snapshot.canvas.width, 600);
  assert.ok(allCodes(r).includes("canvas-width"));
});

await check("a cell outside any table and a table with no rows do not break the import", () => {
  valid(imp("<html><body><td>orphan cell</td><table></table><p>after</p></body></html>"));
});

await check("a page whose only content is one image, button, list, rule or heading imports as that block, not as a container", () => {
  const cases: Array<[string, string]> = [
    ['<img src="https://x.example/a.png" width="300">', "image"],
    ['<div><img src="https://x.example/a.png" width="300"></div>', "image"],
    ['<a href="https://x.example/go" style="display:inline-block;background:#111;color:#fff;padding:10px 20px">Go</a>', "button"],
    ["<ul><li>a</li><li>b</li></ul>", "list"],
    ["<hr>", "divider"],
    ["<h1>Just a title</h1>", "heading"],
  ];
  for (const [html, type] of cases) {
    const r = imp(page(html));
    valid(r);
    assert.deepEqual(components(r.snapshot).map((c) => c.type), [type], html);
  }
  // a lone image's width is not the width of the page
  assert.equal(imp(page('<img src="https://x.example/a.png" width="300">')).snapshot.canvas.width, 600);
});

await check("row names are generated and unique; every row, column and component has an id", () => {
  const r = imp(email(T("<p>a</p>") + T("<p>b</p>") + twoColsPlain()));
  const ids = new Set<string>();
  const add = (id: unknown) => {
    assert.ok(typeof id === "string" && id.length > 0, `id ${String(id)}`);
    assert.ok(!ids.has(id as string), `duplicate id ${id}`);
    ids.add(id as string);
  };
  for (const row of allRows(r)) {
    add(row.id);
    for (const col of row.columns) {
      add(col.id);
      for (const ch of col.children) if (ch.type === "component") add(ch.id);
    }
  }
  const names = allRows(r).map((x) => x.name);
  assert.equal(new Set(names).size, names.length, "row names are unique");
});

function twoColsPlain(): string {
  return `<tr><td><table width="100%"><tr><td width="50%">A</td><td width="50%">B</td></tr></table></td></tr>`;
}

await check("lane generic and lane auto agree on markup that is not from Maildeno", () => {
  const html = email(twoColsPlain() + T("<p>x</p>"));
  const a = imp(html, { lane: "auto" });
  const g = imp(html, { lane: "generic" });
  assert.equal(a.report.flavour, "generic");
  assert.deepEqual(a.snapshot.rows, g.snapshot.rows);
  assert.deepEqual(a.snapshot.canvas, g.snapshot.canvas);
});

await check("the same HTML imported twice with counted ids gives the same template", () => {
  const html = email(twoColsPlain() + T("<h2>Hi</h2><p>text</p>"));
  assert.deepEqual(imp(html).snapshot, imp(html).snapshot);
});

await check("the template name is the title unless one is given", () => {
  assert.equal(imp(page("<p>x</p>")).snapshot.template_name, "t");
  assert.equal(imp(page("<p>x</p>"), { templateName: "Mine" }).snapshot.template_name, "Mine");
  assert.equal(imp("<p>no title</p>").snapshot.template_name, "Imported template");
});
