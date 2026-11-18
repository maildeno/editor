/**
 * Group 5: round trips.
 *
 * A Maildeno template goes through the real exporter, the HTML it writes goes back
 * through the importer, and what comes out must be the template that went in: same
 * rows, columns and blocks, same values, same mobile overrides and hide flags. Only
 * the changes listed in `normalize` (ids, names, nulls, an unset gradient, the
 * button weight "medium", a divider's padding) are allowed to differ.
 *
 * This is the test that says the importer reads what the exporter writes. It does
 * not say it reads what other builders write; the fixtures group does that.
 */

import {
  assert, check, group, roundTrip, imp, exportTemplate, row, column, leaf, spacer, pad, canvasOf,
  hydrateRows, hydrateCanvas, normalize, diff, components, ofType, allCodes, valid,
} from "../lib/html-import-harness";

const IMG = "https://example.com/img";
const merge = (name: string, fallback = ""): string =>
  `<span data-merge="${name}" data-merge-default="${fallback}" contenteditable="false">` +
  `{{ ${name}${fallback ? `|'${fallback}'` : ""} }}</span>`;

/** The round trip must be exact: any difference fails the check and is printed. */
const same = (
  name: string,
  rows: any[],
  canvas: object = canvasOf(),
  options: object = {},
): Promise<void> =>
  check(name, async () => {
    const t = await roundTrip(rows, canvas, options);
    valid(t.result);
    assert.deepEqual(t.differences, [], `\n${t.differences.slice(0, 30).join("\n")}`);
  });

group("5. round trips: Maildeno template -> real export -> import");

// ─── 5a. a whole template ─────────────────────────────────────────────────────

const rich = (): any[] => [
  row("r1", [column("r1c", 100, [
    leaf("h1", "heading", { content: "Welcome to Acme", level: "h1", fontSize: 32, color: "#111111", align: "center", padding: pad(24, 24, 8), mobile: { fontSize: 24 } }),
    leaf("p1", "paragraph", { content: "Thanks for <strong>joining</strong> us. Read the <a href=\"https://example.com/docs\">docs</a>.", fontSize: 16, lineHeight: 1.6, color: "#444444", padding: pad(0, 24, 16) }),
    leaf("b1", "button", { text: "Get started", link: "https://example.com/start", backgroundColor: "#2563eb", color: "#ffffff", padding: pad(12, 28), borderRadius: 8, align: "center", margin: pad(8, 0), mobile: { fontSize: 14 } }),
    leaf("i1", "image", { src: `${IMG}/hero.png`, alt: "Hero", width: 100, align: "center", padding: pad(0, 24, 0) }),
  ], { padding: pad(0) })], { backgroundColor: "#ffffff", padding: pad(16, 0) }),
  row("r2", [
    column("r2a", 50, [leaf("i2", "image", { src: `${IMG}/a.png`, alt: "A", width: 100 }), leaf("p2", "paragraph", { content: "Left column text", padding: pad(8) })], { padding: pad(8) }),
    column("r2b", 50, [leaf("p3", "paragraph", { content: "Right column text", padding: pad(8) })], { padding: pad(8), verticalAlign: "middle" }),
  ], { gap: 20, padding: pad(12) }),
  row("r3", [
    column("r3a", 34, [leaf("p4", "paragraph", { content: "One" })]),
    column("r3b", 33, [leaf("p5", "paragraph", { content: "Two" })]),
    column("r3c", 33, [leaf("p6", "paragraph", { content: "Three" })]),
  ], { backgroundColor: "#f3f4f6", padding: pad(10), mobile: { padding: pad(4) } }),
  spacer("s1", 30),
  row("r4", [column("r4c", 100, [
    leaf("d1", "divider", { height: 2, backgroundColor: "#dddddd", width: 80, margin: pad(10, 0) }),
    leaf("l1", "list", { content: "<ul><li>First</li><li>Second</li><li>Third</li></ul>", fontSize: 15 }),
    leaf("m1", "menu", { items: [
      { label: "Home", link: "https://example.com", enabled: true },
      { label: "Blog", link: "https://example.com/blog", enabled: true },
      { label: "Contact", link: "https://example.com/contact", enabled: true },
    ] }),
    leaf("so1", "socials", { platforms: [
      { name: "Facebook", link: "https://facebook.com/acme", enabled: true, icon: "https://cdn.example.com/icons/facebook.png" },
      { name: "X", link: "https://x.com/acme", enabled: true, icon: "https://cdn.example.com/icons/x.png" },
    ] }),
  ])]),
];

await same("a template with every common block comes back exactly", rich(), canvasOf({ preheaderText: "Hello preheader" }));

await check("the lanes agree: auto, generic and the Maildeno hints give one template", async () => {
  const t = await roundTrip(rich(), canvasOf({ preheaderText: "Hello preheader" }));
  const generic = imp(t.html, { lane: "generic" });
  const auto = imp(t.html, { lane: "auto" });
  assert.deepEqual(normalize(generic.snapshot), normalize(auto.snapshot));
  assert.equal(auto.report.layout.breakpointSource, "maildeno");
});

// ─── 5b. mobile overrides ─────────────────────────────────────────────────────

await same("mobile overrides on blocks, columns, rows and spacers come back as overrides", [
  row("r1", [column("c1", 100, [
    leaf("h", "heading", { content: "Hello", level: "h1", fontSize: 32, mobile: { fontSize: 22, align: "center", padding: pad(4) } }),
    leaf("p", "paragraph", { content: "Body text", fontSize: 16, mobile: { fontSize: 14, lineHeight: 1.3, color: "#222222" } }),
    leaf("b", "button", { text: "Go", link: "https://example.com", mobile: { fontSize: 14, padding: pad(8, 16) } }),
    leaf("i", "image", { src: `${IMG}/a.png`, alt: "a", width: 50, mobile: { width: 100 } }),
    leaf("d", "divider", { height: 2, mobile: { height: 4, backgroundColor: "#ff0000" } }),
  ])], { padding: pad(16), mobile: { padding: pad(8), backgroundColor: "#f0f0f0" } }),
  row("r2", [
    column("c2", 50, [leaf("p2", "paragraph", { content: "Left" })], { padding: pad(8), mobile: { padding: pad(4) } }),
    column("c3", 50, [leaf("p3", "paragraph", { content: "Right" })], { padding: pad(8) }),
  ], { gap: 12, mobile: { gap: 4 } }),
  spacer("s", 40, { mobile: { height: 16 } }),
]);

await same("a phone override that switches a gradient off is kept", [
  row("r1", [column("c1", 100, [leaf("p1", "paragraph", { content: "Gradient on desktop, solid on phones", color: "#ffffff" })])], {
    padding: pad(20), backgroundColor: "#0f172a",
    backgroundGradient: {
      useGradient: true, solid: "#0f172a",
      gradient: { type: "linear", direction: "to right", colors: [{ color: "#0f172a", position: 0 }, { color: "#334155", position: 100 }] },
    },
    mobile: {
      backgroundColor: "#0f172a",
      backgroundGradient: {
        useGradient: false, solid: "#0f172a",
        gradient: { type: "linear", direction: "to right", colors: [{ color: "#ffffff", position: 0 }, { color: "#eeeeee", position: 100 }] },
      },
    },
  }),
]);

await check("only what differs is a mobile override, and the report counts them", async () => {
  const t = await roundTrip([
    row("r1", [column("c1", 100, [
      leaf("p", "paragraph", { content: "Body", fontSize: 16, mobile: { fontSize: 14 } }),
      leaf("q", "paragraph", { content: "Plain", fontSize: 16 }),
    ])]),
  ], canvasOf());
  const found = components(t.result.snapshot);
  assert.deepEqual(found[0].props.mobile, { fontSize: 14 });
  assert.equal(found[1].props.mobile && Object.keys(found[1].props.mobile).length, undefined);
  assert.ok(t.result.report.mobile.keys.fontSize >= 1, "the report counts the font size override");
});

await same("a custom breakpoint (480) is read from the export and keeps its overrides", [
  row("r1", [
    column("c1", 50, [leaf("p1", "paragraph", { content: "Left", mobile: { align: "center" } })]),
    column("c2", 50, [leaf("p2", "paragraph", { content: "Right" })]),
  ], { gap: 24, mobile: { gap: 8 } }),
], canvasOf({ mobileBreakpoint: 480 }));

// ─── 5c. hide flags ───────────────────────────────────────────────────────────

await same("hide flags on blocks come back: hidden on phones, hidden on desktop", [
  row("r1", [column("c1", 100, [
    leaf("p1", "paragraph", { content: "Everyone sees this" }),
    leaf("p2", "paragraph", { content: "Desktop only", mobileHide: true }),
    leaf("p3", "paragraph", { content: "Phone only", desktopHide: true }),
    leaf("i1", "image", { src: `${IMG}/a.png`, alt: "Desktop image", mobileHide: true }),
    leaf("b1", "button", { text: "Phone button", link: "https://example.com", desktopHide: true }),
  ])]),
]);

// ─── 5d. columns, stacking and gaps ───────────────────────────────────────────

await same("columns that stay side by side on phones, and four columns with a gap", [
  row("r1", [
    column("c1", 50, [leaf("p1", "paragraph", { content: "A" })]),
    column("c2", 50, [leaf("p2", "paragraph", { content: "B" })]),
  ], { mobileStack: false, gap: 16 }),
  row("r2", [
    column("c3", 25, [leaf("p3", "paragraph", { content: "1" })]),
    column("c4", 25, [leaf("p4", "paragraph", { content: "2" })]),
    column("c5", 25, [leaf("p5", "paragraph", { content: "3" })]),
    column("c6", 25, [leaf("p6", "paragraph", { content: "4" })]),
  ], { gap: 8 }),
  row("r3", [
    column("c7", 70, [leaf("p7", "paragraph", { content: "Wide" })]),
    column("c8", 30, [leaf("p8", "paragraph", { content: "Narrow" })]),
  ], { gap: 0 }),
]);

await same("column paint, vertical alignment and their phone overrides", [
  row("r1", [
    column("c1", 50, [leaf("p1", "paragraph", { content: "Card one" })], {
      backgroundColor: "#f5f5f5", padding: pad(16), verticalAlign: "middle",
      border: { width: 1, style: "solid", color: "#cccccc", radius: 8 },
      mobile: { padding: pad(8), verticalAlign: "top" },
    }),
    column("c2", 50, [leaf("p2", "paragraph", { content: "Card two" })], {
      backgroundColor: "#ffffff", padding: pad(16), verticalAlign: "bottom",
      boxShadow: { enabled: true, offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: "rgba(0, 0, 0, 0.15)", inset: false },
    }),
  ], { gap: 16, padding: pad(12), backgroundColor: "#eeeeee" }),
]);

// ─── 5e. paint ────────────────────────────────────────────────────────────────

await same("row paint: gradient, background image, border, radius, shadow, minimum height", [
  row("r1", [column("c1", 100, [leaf("p1", "paragraph", { content: "On a gradient", color: "#ffffff" })])], {
    padding: pad(24), backgroundColor: "#ffffff",
    backgroundGradient: {
      useGradient: true, solid: "#ffffff",
      gradient: { type: "linear", direction: "to bottom", colors: [{ color: "#0f172a", position: 0 }, { color: "#334155", position: 100 }] },
    },
  }),
  row("r2", [column("c2", 100, [leaf("p2", "paragraph", { content: "Over a photo", color: "#ffffff" })])], {
    padding: pad(32), backgroundColor: "#222222", backgroundImage: `${IMG}/bg.jpg`, backgroundSize: "contain", backgroundPosition: "top center", backgroundRepeat: "repeat-x", minHeight: 240,
  }),
  row("r3", [column("c3", 100, [leaf("p3", "paragraph", { content: "A card" })])], {
    backgroundColor: "#fafafa", padding: pad(24), border: { width: 2, style: "solid", color: "#111111", radius: 12 },
    boxShadow: { enabled: true, offsetX: 2, offsetY: 6, blur: 16, spread: 1, color: "rgba(15, 23, 42, 0.2)", inset: false },
    mobile: { backgroundColor: "#ffffff", minHeight: 80, border: { width: 1, style: "solid", color: "#999999", radius: 4 } },
  }),
]);

await same("block paint: a filled paragraph, a gradient heading, a bordered button with a shadow", [
  row("r1", [column("c1", 100, [
    leaf("p1", "paragraph", { content: "Highlighted", backgroundColor: "#fff7cc", padding: pad(8, 12) }),
    // the export writes no fallback colour for a block, so the import takes the first stop: start the template there
    leaf("h1", "heading", { content: "On a gradient", level: "h2", color: "#ffffff", padding: pad(12), backgroundColor: "#2563eb", backgroundGradient: {
      useGradient: true, solid: "#2563eb",
      gradient: { type: "linear", direction: "to right", colors: [{ color: "#2563eb", position: 0 }, { color: "#7c3aed", position: 100 }] },
    } }),
    leaf("b1", "button", { text: "Outlined", link: "https://example.com", backgroundColor: "#ffffff", color: "#2563eb", border: { width: 2, style: "solid", color: "#2563eb" }, borderRadius: 6,
      boxShadow: { enabled: true, offsetX: 0, offsetY: 2, blur: 6, spread: 0, color: "rgba(0, 0, 0, 0.2)", inset: false } }),
    leaf("i1", "image", { src: `${IMG}/b.png`, alt: "Rounded", width: 60, borderRadius: 16, border: { width: 2, style: "solid", color: "#dddddd" } }),
  ])]),
]);

// ─── 5f. nesting ──────────────────────────────────────────────────────────────

await same("rows inside columns, three deep", [
  row("r1", [
    column("c1", 100, [
      leaf("p1", "paragraph", { content: "Outer" }),
      row("r2", [
        column("c2", 50, [leaf("p2", "paragraph", { content: "Inner left" })]),
        column("c3", 50, [
          leaf("p5", "paragraph", { content: "Beside the deeper row" }),
          row("r3", [
            column("c4", 60, [leaf("p3", "paragraph", { content: "Deep one" })]),
            column("c5", 40, [leaf("p4", "paragraph", { content: "Deep two" })]),
          ], { gap: 8 }),
        ]),
      ], { gap: 12, padding: pad(8), backgroundColor: "#f3f4f6" }),
    ]),
  ], { padding: pad(10) }),
]);

// ─── 5g. the canvas ───────────────────────────────────────────────────────────

await same("canvas options: width, padding, colours, body image, language and preheader", [
  row("r1", [column("c1", 100, [leaf("p1", "paragraph", { content: "Hello" })])]),
], canvasOf({
  width: 640, padding: pad(12, 8), backgroundColor: "#fafafa", bodyBackgroundColor: "#dddddd", language: "fr",
  bodyBackgroundImage: `${IMG}/body.jpg`, bodyBackgroundSize: "contain", bodyBackgroundPosition: "top center", bodyBackgroundRepeat: "repeat-x",
  preheaderText: "Preview text for the inbox",
}));

await same("a narrow canvas (360) and a wide one (720)", [
  row("r1", [column("c1", 100, [leaf("p1", "paragraph", { content: "Narrow" })])]),
], canvasOf({ width: 360 }));

await same("a wide canvas keeps its width", [
  row("r1", [
    column("c1", 50, [leaf("p1", "paragraph", { content: "Left" })]),
    column("c2", 50, [leaf("p2", "paragraph", { content: "Right" })]),
  ]),
], canvasOf({ width: 720 }));

// ─── 5h. text ─────────────────────────────────────────────────────────────────

await same("rich text: marks, links, colours, line breaks and merge tags", [
  row("r1", [column("c1", 100, [
    leaf("p1", "paragraph", { content: `Hello ${merge("first_name", "friend")}, this is <strong>bold</strong>, <em>italic</em>, <u>underlined</u> and <s>struck</s>.<br>A second line with <a href="https://example.com/a?x=1&amp;y=2">a link</a> and <span style="color: #dc2626">red text</span>.` }),
    leaf("p2", "paragraph", { content: `Order ${merge("order_id")} is on its way`, fontStyle: "italic", letterSpacing: 1, textTransform: "uppercase", align: "right" }),
    leaf("h1", "heading", { content: "Second <em>level</em> heading", level: "h2", fontFamily: "Georgia", textDecoration: "underline" }),
    leaf("h3", "heading", { content: "A smaller heading", level: "h4", fontSize: 18 }),
  ])]),
]);

await same("lists, menus and socials with their own spacing and alignment", [
  row("r1", [column("c1", 100, [
    leaf("l1", "list", { content: "<ol><li>One</li><li>Two</li><li>Three</li></ol>", itemSpacing: 4, fontSize: 14, padding: pad(0, 0, 0, 24) }),
    leaf("m1", "menu", { spacing: 24, align: "left", fontSize: 14, items: [
      { label: "Shop", link: "https://example.com/shop", enabled: true },
      { label: "About", link: "https://example.com/about", enabled: true },
    ] }),
    leaf("so1", "socials", { iconSize: 32, spacing: 12, align: "right", platforms: [
      { name: "Instagram", link: "https://instagram.com/acme", enabled: true, icon: "https://cdn.example.com/icons/instagram.png" },
      { name: "Youtube", link: "https://youtube.com/@acme", enabled: true, icon: "https://cdn.example.com/icons/youtube.png" },
      { name: "Linkedin", link: "https://linkedin.com/company/acme", enabled: true, icon: "https://cdn.example.com/icons/linkedin.png" },
    ] }),
  ])]),
]);

await same("an image that links somewhere, a video, a divider with its margins", [
  row("r1", [column("c1", 100, [
    leaf("i1", "image", { src: `${IMG}/c.png`, alt: "Linked", width: 80, align: "left", enabled: true, link: "https://example.com/landing" }),
    leaf("v1", "video", { src: "https://example.com/v.mp4", coverImage: `${IMG}/cover.png`, alt: "Watch the launch", fallbackLink: "https://example.com/watch", width: 90, borderRadius: 8 }),
    leaf("d1", "divider", { height: 3, backgroundColor: "#999999", width: 60, align: "left", margin: pad(12, 0, 20, 0) }),
  ])]),
]);

await same("spacers between rows, with a fill", [
  row("r1", [column("c1", 100, [leaf("p1", "paragraph", { content: "Above" })])]),
  spacer("s1", 24),
  row("r2", [column("c2", 100, [leaf("p2", "paragraph", { content: "Below" })])]),
  spacer("s2", 12, { backgroundColor: "#eeeeee" }),
]);

// ─── 5i. properties of the round trip itself ──────────────────────────────────

await check("the fixed point: a second trip changes nothing", async () => {
  const first = await roundTrip(rich(), canvasOf({ preheaderText: "Hello preheader" }));
  const rows = hydrateRows(JSON.parse(JSON.stringify(first.result.snapshot.rows)));
  const canvas = hydrateCanvas(JSON.parse(JSON.stringify(first.result.snapshot.canvas)));
  const exported = await exportTemplate(rows as any, canvas as any);
  const second = imp(exported.html);
  assert.deepEqual(diff(normalize(first.result.snapshot), normalize(second.snapshot)), []);
});

await check("a clean Maildeno export imports with no warnings that mean lost content", async () => {
  const t = await roundTrip(rich(), canvasOf({ preheaderText: "Hello preheader" }));
  const lossy = allCodes(t.result).filter((c) => !["image-relative", "fonts"].includes(c));
  assert.deepEqual(lossy, [], "no fallback, drop or warning for markup the exporter itself wrote");
});

await check("the HTML of the export and of the import are the same document in the same words", async () => {
  const t = await roundTrip(rich(), canvasOf({ preheaderText: "Hello preheader" }));
  const rows = hydrateRows(JSON.parse(JSON.stringify(t.result.snapshot.rows)));
  const canvas = hydrateCanvas(JSON.parse(JSON.stringify(t.result.snapshot.canvas)));
  const again = await exportTemplate(rows as any, canvas as any);
  const words = (h: string): string[] =>
    h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#847;|&zwnj;/g, " ").split(/\s+/).filter(Boolean);
  assert.deepEqual(words(again.html), words(t.html));
  assert.equal(ofType(t.result, "paragraph").length >= 6, true);
});
