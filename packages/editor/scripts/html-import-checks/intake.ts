/**
 * Group 1: intake and safety.
 *
 * What is refused outright, what is removed and reported, and what is kept but
 * flagged. Everything here is decided before a single style is read.
 */

import {
  assert, check, group, imp, page, email, fixture, only, ofType, topRows, depthOf,
  codes, allCodes, textOf, valid, throwsImport, parseHtml, counter, importHtml,
} from "../lib/html-import-harness";

group("1. intake and safety");

await check("empty, blank and non-string input is refused", () => {
  throwsImport("", "empty");
  throwsImport("   \n\t ", "empty");
  throwsImport(undefined, "empty");
  throwsImport(42, "empty");
});

await check("MJML source is refused with a message that says what to do", () => {
  throwsImport("<mjml><mj-body></mj-body></mjml>", "mjml-source");
  throwsImport('<?xml version="1.0"?>\n<mjml>\n<mj-body/></mjml>', "mjml-source");
  try {
    importHtml("<mjml></mjml>", { parseHtml });
    assert.fail("should have thrown");
  } catch (err) {
    assert.match(String((err as Error).message), /compile/i);
  }
});

await check("input over the size limit is refused", () => {
  throwsImport(page("<p>x</p>"), "too-large", { maxBytes: 20 });
});

await check("a document with nothing visible is refused, not imported as an empty template", () => {
  throwsImport(page(""), "no-content");
  throwsImport(page('<div style="display:none">hidden</div><script>1</script>'), "no-content");
});

await check("no DOM parser available gives a clear error", () => {
  const g = globalThis as any;
  const saved = g.DOMParser;
  g.DOMParser = undefined;
  try {
    importHtml(page("<p>x</p>"));
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal((err as any).code, "no-dom");
  } finally {
    g.DOMParser = saved;
  }
});

await check("the default parser (global DOMParser) works without a parseHtml option", () => {
  const r = importHtml(page("<p>Hello</p>"), { ids: counter() });
  assert.equal(textOf(only(r, "paragraph").props.content), "Hello");
});

await check("text with no tags at all becomes one paragraph", () => {
  const r = imp("Just some words");
  assert.equal(textOf(only(r, "paragraph").props.content), "Just some words");
  valid(r);
});

const hostile = fixture("hostile.html");

await check("hostile HTML: nothing executable survives in the output", () => {
  const r = imp(hostile);
  const json = JSON.stringify(r.snapshot).toLowerCase();
  for (const bad of ["<script", "javascript:", "vbscript:", "onclick", "onerror", "onload", "<iframe", "<object", "<embed", "<svg", "expression(", "evil.example.com"]) {
    assert.ok(!json.includes(bad), `output contains ${bad}`);
  }
  valid(r);
});

await check("hostile HTML: every removal is reported", () => {
  const r = imp(hostile);
  const safety = codes(r.report.safety);
  for (const code of ["script", "embed", "event-handler", "script-url", "data-link", "css-script", "meta-refresh"]) {
    assert.ok(safety.includes(code), `missing safety code ${code}; have ${safety.join(", ")}`);
  }
  assert.ok(codes(r.report.dropped).includes("svg"), "svg");
  assert.ok(allCodes(r).includes("external-stylesheet"), "external-stylesheet");
});

await check("hostile HTML: the visible content that was safe is kept", () => {
  const r = imp(hostile);
  const texts = ofType(r, "paragraph").map((p) => textOf(p.props.content));
  assert.ok(texts.some((t) => t.includes("Text inside a form stays.")), texts.join(" | "));
  assert.ok(texts.some((t) => t.includes("Expression text")), texts.join(" | "));
  const links = JSON.stringify(r.snapshot).match(/https:\/\/example\.com\/fine/g) ?? [];
  assert.equal(links.length, 1, "the harmless link is kept once");
});

await check("alt and src go into the export unescaped, so neither can carry a quote or angle bracket", () => {
  const r = imp(hostile);
  for (const img of ofType(r, "image")) {
    assert.ok(!/["<>]/.test(img.props.alt), `alt: ${img.props.alt}`);
    assert.ok(!/["<>\s]/.test(img.props.src), `src: ${img.props.src}`);
  }
});

await check("markup in text is escaped, never carried into content as live HTML", () => {
  const r = imp(page("<p>a &lt;script&gt;alert(1)&lt;/script&gt; b &amp; c <b>bold</b></p>"));
  const content = only(r, "paragraph").props.content;
  assert.ok(content.includes("&lt;script&gt;"), content);
  assert.ok(!content.includes("<script"), content);
  assert.ok(content.includes("<strong>bold</strong>"), content);
  assert.ok(content.includes("&amp;"), content);
});

await check("javascript: and data: URLs on links are removed, the text stays", () => {
  const r = imp(page('<p>Go <a href="javascript:alert(1)">here</a> or <a href="data:text/html,x">there</a> or <a href="https://ok.example/a">ok</a></p>'));
  const content = only(r, "paragraph").props.content;
  assert.ok(!/javascript:|data:/.test(content), content);
  assert.match(textOf(content), /Go here or there or ok/);
  assert.ok(content.includes('href="https://ok.example/a"'), content);
});

await check("a button with an unsafe link keeps its text and loses the link", () => {
  const r = imp(email('<tr><td style="padding:20px"><a href="javascript:alert(1)" style="background:#111;color:#fff;padding:10px 20px;display:inline-block">Click</a></td></tr>'));
  const b = only(r, "button");
  assert.equal(b.props.link, "");
  assert.equal(b.props.text, "Click");
});

await check("data:, cid: and relative images are kept and each one is reported", () => {
  const r = imp(email('<tr><td><img src="data:image/png;base64,AAAA" width="100" alt="a"></td></tr><tr><td><img src="cid:logo" width="100" alt="b"></td></tr><tr><td><img src="img/x.png" width="100" alt="c"></td></tr>'));
  assert.equal(ofType(r, "image").length, 3);
  const w = codes(r.report.warnings);
  for (const code of ["image-data", "image-cid", "image-relative"]) assert.ok(w.includes(code), `${code} in ${w.join(",")}`);
});

await check("relative and hash links are kept and reported; tel: and mailto: are kept quietly", () => {
  const r = imp(page('<p>See <a href="/about">about</a>, <a href="#top">the top</a>, <a href="tel:+1555">call</a> or <a href="mailto:x@y.z">write</a> for more.</p>'));
  const w = codes(r.report.warnings);
  assert.ok(w.includes("url-relative"), w.join(","));
  assert.ok(w.includes("url-hash"), w.join(","));
  const content = only(r, "paragraph").props.content;
  assert.ok(content.includes("tel:+1555") && content.includes("mailto:x@y.z"), content);
});

await check("garbage markup never throws: unclosed tags, stray closers, cells outside rows", () => {
  const garbage = [
    "<table><td>cell</td><td>cell two",
    "</td></tr></table><p>stray closers</p></div>",
    "<table><tr><table><tr><td><p>deep<div><span>x",
    "<td>orphan</td>",
    "<p><b><i>unclosed <u>marks",
    "<<<>>> &&& <a href=>x</a> <img src=> <p style=';;;color'>q</p>",
  ];
  for (const g of garbage) valid(imp(`<html><body>${g}</body></html>`));
});

await check("forty nested one-cell tables are flattened to the depth the exporters render", () => {
  let html = '<p style="font-family:Arial">deep text</p>';
  for (let i = 0; i < 40; i++) {
    html = `<table width="100%" cellpadding="8" style="background:${i % 2 ? "#ffeecc" : "#ccddff"}"><tr><td>${html}</td></tr></table>`;
  }
  const r = imp(page(html));
  valid(r);
  assert.ok(Math.max(...topRows(r).map(depthOf)) <= 5, "depth");
  assert.ok(textOf(only(r, "paragraph").props.content).includes("deep text"));
});

await check("two-column tables nested six deep are capped, and the cap is reported", () => {
  let html = "<p>core</p>";
  for (let i = 0; i < 6; i++) {
    html = `<table width="100%"><tr><td width="50%" style="background:#f0f0f0;padding:8px">${html}</td><td width="50%" style="padding:8px">side ${i}</td></tr></table>`;
  }
  const r = imp(page(html));
  valid(r);
  assert.ok(Math.max(...topRows(r).map(depthOf)) <= 5, "depth");
  assert.ok(allCodes(r).includes("depth"), allCodes(r).join(","));
});

await check("1,500 paragraphs import in reasonable time", () => {
  const rows = Array.from({ length: 1500 }, (_, i) => `<tr><td style="padding:4px 12px;font:14px Arial">Paragraph number ${i} with <b>some</b> text.</td></tr>`).join("");
  const t0 = Date.now();
  const r = imp(email(rows));
  const ms = Date.now() - t0;
  assert.equal(ofType(r, "paragraph").length, 1500);
  assert.ok(ms < 20000, `took ${ms}ms`);
});
