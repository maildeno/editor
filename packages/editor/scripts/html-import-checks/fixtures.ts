/**
 * Group 4: fixtures.
 *
 * Real-world HTML in scripts/fixtures/html-import: MJML output, a hybrid ghost-table
 * layout, a Mailchimp-style template, Word/Outlook markup, a plain document with no
 * tables and a hostile page. Each one must hold properties that say nothing about how
 * it looks and a lot about whether the importer can be trusted:
 *
 *   valid            the self-check is clean and the JSON holds no NaN or undefined
 *   stable           the same HTML gives the same template
 *   loads            the editor's own loader leaves it unchanged
 *   keeps the text   every word a reader sees in the source is in the template
 *   exports          the real engine writes HTML, MJML and React Email from it
 *   settles          import(export(import(x))) changes nothing the second time round
 */

import {
  assert, check, group, imp, fixture, readdirSync, FIXTURES, valid, components, ofType,
  sourceWords, outputWords, exportTemplate, normalize, diff, hydrateRows, hydrateCanvas,
  allCodes, topRows, allRows, depthOf, formatReport, normalizeTemplateSnapshot,
} from "../lib/html-import-harness";

const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".html")).sort();

/** Words that are in the source markup but are not content for the importer, with the reason. */
const KNOWN_LOSS: Record<string, string[]> = {
  // the label of a <button> inside a <form>: form controls are removed (and reported)
  "hostile.html": ["go"],
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

group(`4. fixtures (${files.length}: ${files.join(", ")})`);
assert.ok(files.length >= 7, "the fixture folder is not empty");

for (const file of files) {
  const html = fixture(file);

  await check(`${file}: valid, with a report that reads`, () => {
    const r = imp(html);
    valid(r);
    assert.ok(components(r.snapshot).length > 0, "has content");
    const text = formatReport(r.report);
    assert.match(text, /Imported \d+ rows?/);
    assert.ok(Math.max(...topRows(r).map(depthOf)) <= 5);
  });

  await check(`${file}: the same HTML gives the same template`, () => {
    assert.deepEqual(imp(html).snapshot, imp(html).snapshot);
  });

  await check(`${file}: the editor's loader leaves it unchanged and it survives JSON`, () => {
    const r = imp(html);
    assert.deepEqual(normalizeTemplateSnapshot(clone(r.snapshot) as any), r.snapshot);
    assert.deepEqual(clone(r.snapshot), r.snapshot);
    const rows = hydrateRows(clone(r.snapshot.rows));
    assert.equal(rows.length, r.snapshot.rows.length);
    hydrateCanvas(clone(r.snapshot.canvas));
  });

  await check(`${file}: every word the reader sees is in the template`, () => {
    const r = imp(html);
    const have = outputWords(r);
    const missing = [...sourceWords(html)].filter((w) => !have.has(w) && !(KNOWN_LOSS[file] ?? []).includes(w));
    assert.deepEqual(missing, [], `words lost: ${missing.slice(0, 20).join(", ")}`);
  });

  await check(`${file}: the real engine exports it to HTML, MJML and React Email`, async () => {
    const r = imp(html);
    const out = await exportTemplate(clone(r.snapshot.rows), clone(r.snapshot.canvas));
    assert.ok(out.html.includes("<html") && out.html.length > 500, "html");
    assert.ok(out.mjml.includes("<mjml") && out.mjml.includes("<mj-body"), "mjml");
    assert.ok(out.jsx.length > 200, "jsx");
    assert.ok(!/NaN|undefined|\[object Object\]/.test(out.html), "no bad values in the HTML");
  });

  await check(`${file}: its own export imports again with the same text and no loss of structure`, async () => {
    const a = imp(html);
    const out = await exportTemplate(clone(a.snapshot.rows), clone(a.snapshot.canvas));
    const b = imp(out.html);
    valid(b);
    const have = outputWords(b);
    const missing = [...outputWords(a)].filter((w) => !have.has(w));
    assert.deepEqual(missing, [], `words lost on the way through: ${missing.slice(0, 20).join(", ")}`);
    assert.equal(topRows(b).length + b.snapshot.rows.filter((n: any) => n.type === "row-spacer").length, a.snapshot.rows.length, "same number of rows");
    assert.equal(components(b.snapshot).length, components(a.snapshot).length, "same number of blocks");
  });

  await check(`${file}: import(export(import(x))) settles: one more trip changes nothing`, async () => {
    const a = imp(html);
    const e1 = await exportTemplate(clone(a.snapshot.rows), clone(a.snapshot.canvas));
    const b = imp(e1.html);
    const e2 = await exportTemplate(clone(b.snapshot.rows), clone(b.snapshot.canvas));
    const c = imp(e2.html);
    const norm = (r: typeof a) => normalize({ canvas: hydrateCanvas(clone(r.snapshot.canvas)), rows: hydrateRows(clone(r.snapshot.rows)) });
    const differences = diff(norm(b), norm(c));
    assert.deepEqual(differences, [], `${differences.length} differences:\n${differences.slice(0, 12).join("\n")}`);
  });
}

// ─── Properties of particular fixtures ────────────────────────────────────────

group("4b. what the fixtures should come out as");

await check("mjml-newsletter: hero background image, cards with borders, stats, menu, socials, a list and a merge tag", () => {
  const r = imp(fixture("mjml-newsletter.html"));
  assert.equal(r.report.flavour, "mjml");
  assert.equal(r.snapshot.canvas.mobileBreakpoint, 479, "MJML's 480px min-width query");
  const types = components(r.snapshot).map((c) => c.type);
  for (const t of ["image", "paragraph", "button", "divider", "list", "menu", "socials"]) assert.ok(types.includes(t), `${t} in ${types.join(",")}`);
  const hero = topRows(r).find((row) => row.backgroundImage);
  assert.ok(hero && /hero-bg/.test(hero.backgroundImage), "hero image");
  assert.equal(hero.backgroundSize, "cover");
  const cards = topRows(r).find((row) => row.columns.length === 2 && row.columns.every((c: any) => c.border?.width === 1));
  assert.ok(cards, "two bordered card columns");
  assert.equal(cards.columns[0].border.radius, 8);
  assert.ok(ofType(r, "paragraph").some((p) => p.props.content.includes('data-merge="first_name"')), "merge tag");
  assert.ok(topRows(r).filter((row) => row.columns.length > 1).every((row) => row.mobileStack), "MJML columns stack");
});

await check("mjml-newsletter: no row has a stray background of its own where the source had none", () => {
  const r = imp(fixture("mjml-newsletter.html"));
  // MJML sections repeat the same fill on the section and its cell; the importer keeps one
  for (const row of allRows(r)) {
    const nested = row.columns.flatMap((c: any) => c.children).filter((x: any) => x.type === "row");
    for (const n of nested) assert.notEqual(n.backgroundColor === row.backgroundColor && row.backgroundColor !== "transparent", true, `nested row repeats ${row.backgroundColor}`);
  }
});

await check("mjml-receipt: the receipt card is a rounded row, its header columns and button survive", () => {
  const r = imp(fixture("mjml-receipt.html"));
  assert.equal(r.report.flavour, "mjml");
  assert.ok(ofType(r, "button").length >= 1);
  assert.ok(allRows(r).some((row) => row.columns.length >= 2), "a multi-column row");
});

await check("hybrid-ghost: ghost tables for Outlook do not double the content", () => {
  const r = imp(fixture("hybrid-ghost.html"));
  const texts = ofType(r, "paragraph").map((p) => p.props.content);
  assert.equal(new Set(texts).size, texts.length, "no paragraph appears twice");
  assert.ok(allRows(r).some((row) => row.columns.length >= 2));
});

await check("mailchimp-like: floated columns, a button, a divider, partial borders reported, merge syntax warned", () => {
  const r = imp(fixture("mailchimp-like.html"));
  const types = components(r.snapshot).map((c) => c.type);
  assert.ok(types.includes("button") && types.includes("divider") && types.includes("image"), types.join(","));
  const c = allCodes(r);
  assert.ok(c.includes("border-partial"), c.join(","));
  assert.ok(c.some((x) => x.startsWith("merge")), c.join(","));
  const footer = topRows(r).at(-1)!;
  assert.equal(footer.backgroundColor, "#fafafa", "the footer's fill is its row's");
});

await check("outlook-word: pt units, <font>, bgcolor and nbsp paragraphs come out as normal blocks and spacers", () => {
  const r = imp(fixture("outlook-word.html"));
  assert.equal(ofType(r, "spacer").length, 3, "each empty paragraph between the blocks is a spacer");
  assert.ok(ofType(r, "button").length >= 1);
  assert.ok(ofType(r, "list").length >= 1);
  assert.ok(topRows(r).some((row) => row.backgroundColor === "#1f3864"), "the header band");
  assert.ok(allCodes(r).includes("button-size"), "the Word button is sized by height and width");
});

await check("plain-doc: no tables, so the body's width and padding become the canvas and the blocks", () => {
  const r = imp(fixture("plain-doc.html"));
  assert.ok(r.snapshot.canvas.width >= 360 && r.snapshot.canvas.width <= 720);
  assert.ok(components(r.snapshot).length >= 3);
});
