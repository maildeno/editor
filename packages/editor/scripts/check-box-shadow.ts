/**
 * check-box-shadow.ts
 *
 * Checks the box shadow feature of rows, columns, images and buttons, from the
 * stored value to the exported email:
 *
 *   1. the colour parser and the shadow model (core/cssColor, core/boxShadow):
 *      reading a stored value, clamping it, and writing the CSS
 *   2. the clipping rule: when a row or column stops clipping its overflow so
 *      a shadow inside it can be seen (it is square, or its padding keeps the
 *      content clear of the rounded corners), and when it has to keep clipping;
 *      and where a row's own clip goes in the export, which is never onto the
 *      <td> that carries the row's shadow (a clipping cell in a table with
 *      collapsed borders is drawn without its shadow)
 *   3. save and load (optimizeRows, hydrateRows): defaults are stripped, tuned
 *      and mobile values survive, and a round trip is stable
 *   4. the HTML, MJML and React Email exports, the hook classes and the mobile
 *      CSS, run through the real export engine (scripts/lib/headless-export.ts)
 *   5. the Preview screen's client simulation (transformForClient)
 *   6. the colour picker's model (useColor), which has to open on rgba()
 *
 * The editing logic of the panel (useBoxShadowEditor) is in
 * check-box-shadow-editor.ts, which needs a stub for the editor instance.
 *
 *   cd packages/editor
 *   npx tsx scripts/check-box-shadow.ts
 */

import assert from "node:assert/strict";
import { exportTemplate } from "./lib/headless-export";
import {
  BOX_SHADOW_LIMITS,
  BOX_SHADOW_PRESETS,
  DEFAULT_BOX_SHADOW,
  boxShadowEquals,
  boxShadowFromPreset,
  boxShadowMobileRule,
  boxShadowValue,
  clipsOverflow,
  columnsHaveShadow,
  cornersReachContent,
  createDefaultBoxShadow,
  hasActiveShadow,
  hasShadowInside,
  isBoxShadowActive,
  matchBoxShadowPreset,
  normalizeBoxShadow,
  normalizeShadowColor,
} from "../src/composables/emailBuilder/core/boxShadow";
import {
  formatCssColor,
  parseCssColor,
} from "../src/composables/emailBuilder/core/cssColor";
import {
  hydrateRows,
  hydrateComponent,
} from "../src/composables/emailBuilder/transform/pipeline/hydrate";
import { optimizeRows } from "../src/composables/emailBuilder/transform/pipeline/optimize";
import { useClientPreview } from "../src/composables/emailBuilder/preview/useClientPreview";
import { useColor } from "../src/composables/system/useColor";

// ─── Tiny harness ─────────────────────────────────────────────────────────────

let failed = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      `FAIL  ${name}\n      ${message.split("\n").slice(0, 14).join("\n      ")}`,
    );
  }
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A shadow, switched on. Every test element gets its own colour to find it by. */
const sh = (color: string, extra: object = {}) => ({
  enabled: true,
  offsetX: 0,
  offsetY: 6,
  blur: 16,
  spread: 0,
  color,
  inset: false,
  ...extra,
});

const ROW = "#111111";
const COL = "#222222";
const IMG = "#333333";
const BTN = "#444444";

const image = (id: string, props: object = {}) => ({
  id,
  type: "component",
  componentType: "image",
  props: { src: "https://example.com/a.png", alt: "a", ...props },
});
const button = (id: string, props: object = {}) => ({
  id,
  type: "component",
  componentType: "button",
  props: { text: "Go", link: "https://example.com", ...props },
});
const heading = (id: string, props: object = {}) => ({
  id,
  type: "component",
  componentType: "heading",
  props: { content: "<h1>Hi</h1>", ...props },
});
const column = (
  id: string,
  width: number,
  children: unknown[],
  extra: object = {},
) => ({ id, width, verticalAlign: "top", children, ...extra });
const row = (id: string, columns: unknown[], extra: object = {}) => ({
  id,
  type: "row",
  name: id,
  mobileStack: true,
  columns,
  ...extra,
});
const spacer = (id: string, extra: object = {}) => ({
  id,
  type: "row-spacer",
  height: 20,
  ...extra,
});

const canvas = { width: 600 };

/** The opening tags of `html` that contain `needle`. */
const tagsWith = (html: string, needle: string): string[] =>
  (html.match(/<[a-zA-Z][^>]*>/g) ?? []).filter((t) => t.includes(needle));

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

/** The <td> of every row: they carry the background, and no vertical-align. */
const rowTds = (html: string): string[] =>
  (html.match(/<td\b[^>]*>/g) ?? []).filter(
    (t) => t.includes("background") && !t.includes("vertical-align"),
  );

/** The <td> of every column: they are the ones with a vertical-align. */
const columnTds = (html: string): string[] =>
  (html.match(/<td\b[^>]*>/g) ?? []).filter((t) =>
    t.includes("vertical-align"),
  );

/** The divs inside a row's <td>: the ones that hold its border, padding and clip. */
const rowDivs = (html: string): string[] =>
  (html.match(/<div\b[^>]*>/g) ?? []).filter((t) =>
    t.includes("line-height:0;font-size:0"),
  );

/**
 * The <td> tags that would lose their own box-shadow in a browser. A cell with
 * an overflow other than visible, in a table whose borders are collapsed, is
 * drawn without its shadow (seen in Chrome 153), however much room the shadow
 * has. border-collapse is inherited, so a table without a value of its own
 * takes the one around it; `fallback` is the value of one that has neither:
 * the HTML export sets none (separate), and the stylesheet MJML writes into
 * the head sets `collapse` on every table.
 */
const cellsThatLoseTheirShadow = (
  html: string,
  fallback: "collapse" | "separate",
): string[] => {
  const lost: string[] = [];
  const modes: string[] = [];
  for (const [tag] of html.matchAll(/<table\b[^>]*>|<\/table>|<td\b[^>]*>/g)) {
    if (tag.startsWith("</")) {
      modes.pop();
    } else if (tag.startsWith("<table")) {
      const own = /border-collapse:\s*(collapse|separate)/.exec(tag)?.[1];
      modes.push(own ?? modes.at(-1) ?? fallback);
    } else if (
      (modes.at(-1) ?? fallback) === "collapse" &&
      /box-shadow:\s*(?!none)/.test(tag) &&
      /overflow(-x|-y)?:\s*(hidden|clip|auto|scroll)/.test(tag)
    ) {
      lost.push(tag);
    }
  }
  return lost;
};

/** A template with a shadow on every one of the four kinds. */
const shadowed = (): any[] => [
  row(
    "rowS",
    [
      column("colS", 50, [image("imgS", { boxShadow: sh(IMG) })], {
        boxShadow: sh(COL),
      }),
      column("colB", 50, [button("btnS", { boxShadow: sh(BTN) })]),
    ],
    { boxShadow: sh(ROW) },
  ),
];

/** The same kinds, no shadow anywhere. */
const plain = (): any[] => [
  row("rowP", [
    column("colP1", 50, [image("imgP"), heading("hP")]),
    column("colP2", 50, [button("btnP")]),
  ]),
  spacer("spP"),
];

// ─── 1. Colour parsing ────────────────────────────────────────────────────────

await check(
  "parseCssColor reads hex, rgb() and rgba() in every spelling",
  () => {
    assert.deepEqual(parseCssColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepEqual(parseCssColor("#0a1B2c"), { r: 10, g: 27, b: 44, a: 1 });
    assert.deepEqual(parseCssColor("#000000ff"), { r: 0, g: 0, b: 0, a: 1 });
    const hex8 = parseCssColor("#00000080")!;
    assert.equal(Math.round(hex8.a * 100), 50);
    assert.deepEqual(parseCssColor("#0008")!.r, 0);
    assert.deepEqual(parseCssColor("rgba(0, 0, 0, 0.15)"), {
      r: 0,
      g: 0,
      b: 0,
      a: 0.15,
    });
    assert.deepEqual(parseCssColor("rgb(1,2,3)"), { r: 1, g: 2, b: 3, a: 1 });
    assert.deepEqual(parseCssColor("rgb(1 2 3 / 50%)"), {
      r: 1,
      g: 2,
      b: 3,
      a: 0.5,
    });
    assert.deepEqual(parseCssColor("rgba(100%, 0%, 0%, 1)"), {
      r: 255,
      g: 0,
      b: 0,
      a: 1,
    });
    // Out of range is clamped, not rejected.
    assert.deepEqual(parseCssColor("rgba(300, -5, 0, 2)"), {
      r: 255,
      g: 0,
      b: 0,
      a: 1,
    });
  },
);

await check("parseCssColor returns null for what it cannot read", () => {
  for (const bad of [
    "",
    "red",
    "transparent",
    "#12",
    "#12345",
    "ff0000",
    "rgba(1, 2)",
    "rgba(1, 2, 3, 4, 5)",
    "rgb(a, b, c)",
    "hsl(0, 0%, 0%)",
    "url(x)",
    "rgba(0,0,0,0.5); color:red",
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(parseCssColor(bad as any), null, JSON.stringify(bad));
  }
});

await check(
  "formatCssColor writes hex when opaque and rgba() otherwise",
  () => {
    assert.equal(formatCssColor({ r: 0, g: 0, b: 0, a: 1 }), "#000000");
    assert.equal(formatCssColor({ r: 255, g: 128, b: 0, a: 1 }), "#ff8000");
    assert.equal(
      formatCssColor({ r: 0, g: 0, b: 0, a: 0.15 }),
      "rgba(0, 0, 0, 0.15)",
    );
    // The alpha is rounded to two decimals; one that rounds to 1 is opaque.
    assert.equal(
      formatCssColor({ r: 1, g: 2, b: 3, a: 0.123456 }),
      "rgba(1, 2, 3, 0.12)",
    );
    assert.equal(formatCssColor({ r: 1, g: 2, b: 3, a: 0.999 }), "#010203");
    assert.equal(
      formatCssColor({ r: 1, g: 2, b: 3, a: 0 }),
      "rgba(1, 2, 3, 0)",
    );
  },
);

// ─── 2. The shadow model ──────────────────────────────────────────────────────

await check(
  "normalizeBoxShadow fills anything missing, partial or wrong",
  () => {
    const off = { ...DEFAULT_BOX_SHADOW };
    for (const v of [undefined, null, "nope", 7, [], true]) {
      assert.deepEqual(normalizeBoxShadow(v), off, JSON.stringify(v));
    }
    assert.deepEqual(normalizeBoxShadow({}), off);
    assert.deepEqual(normalizeBoxShadow({ enabled: true, blur: 20 }), {
      ...off,
      enabled: true,
      blur: 20,
    });
  },
);

await check(
  "normalizeBoxShadow clamps to the limits and rounds to 2 decimals",
  () => {
    const { offset, blur, spread } = BOX_SHADOW_LIMITS;
    const s = normalizeBoxShadow({
      offsetX: -999,
      offsetY: 999,
      blur: -3,
      spread: 1000,
    });
    assert.equal(s.offsetX, offset.min);
    assert.equal(s.offsetY, offset.max);
    assert.equal(s.blur, blur.min);
    assert.equal(s.spread, spread.max);
    assert.equal(normalizeBoxShadow({ blur: 1000 }).blur, blur.max);
    assert.equal(normalizeBoxShadow({ offsetX: 1.23456 }).offsetX, 1.23);
    // Strings that are numbers are read; the rest fall back to the default.
    assert.equal(normalizeBoxShadow({ blur: "8" }).blur, 8);
    assert.equal(
      normalizeBoxShadow({ blur: "" }).blur,
      DEFAULT_BOX_SHADOW.blur,
    );
    assert.equal(
      normalizeBoxShadow({ blur: "x" }).blur,
      DEFAULT_BOX_SHADOW.blur,
    );
    assert.equal(
      normalizeBoxShadow({ blur: NaN }).blur,
      DEFAULT_BOX_SHADOW.blur,
    );
    assert.equal(
      normalizeBoxShadow({ blur: Infinity }).blur,
      DEFAULT_BOX_SHADOW.blur,
    );
  },
);

await check("enabled and inset are true only when exactly true", () => {
  for (const v of ["true", 1, "yes", {}, [], null, undefined, 0, "false"]) {
    const s = normalizeBoxShadow({ enabled: v, inset: v });
    assert.equal(s.enabled, false, JSON.stringify(v));
    assert.equal(s.inset, false, JSON.stringify(v));
  }
  const on = normalizeBoxShadow({ enabled: true, inset: true });
  assert.equal(on.enabled && on.inset, true);
});

await check("normalizeBoxShadow never returns the object it was given", () => {
  const input = { enabled: true };
  assert.notEqual(normalizeBoxShadow(input) as object, input);
  assert.notEqual(createDefaultBoxShadow(), DEFAULT_BOX_SHADOW);
  const a = createDefaultBoxShadow();
  a.blur = 99;
  assert.equal(DEFAULT_BOX_SHADOW.blur, 12);
  assert.equal(createDefaultBoxShadow().blur, 12);
});

await check(
  "normalizeShadowColor keeps safe colours and replaces the rest",
  () => {
    assert.equal(normalizeShadowColor("#abc"), "#aabbcc");
    assert.equal(normalizeShadowColor("  #ABCDEF "), "#abcdef");
    assert.equal(normalizeShadowColor("#00000080"), "rgba(0, 0, 0, 0.5)");
    assert.equal(normalizeShadowColor("rgba(0,0,0,.3)"), "rgba(0, 0, 0, 0.3)");
    assert.equal(
      normalizeShadowColor("rgb(0 0 0 / 40%)"),
      "rgba(0, 0, 0, 0.4)",
    );
    // Unreadable but harmless: kept as written.
    assert.equal(normalizeShadowColor("tomato"), "tomato");
    assert.equal(normalizeShadowColor("transparent"), "transparent");
    assert.equal(
      normalizeShadowColor("hsl(10, 50%, 50%)"),
      "hsl(10, 50%, 50%)",
    );
    // Anything that could end a declaration, a tag or an attribute is not.
    const fallback = DEFAULT_BOX_SHADOW.color;
    for (const bad of [
      "red;}</style><script>alert(1)</script>",
      'red" onload="x',
      "red; background:url(x)",
      "url(javascript:alert(1))",
      "rgba(0,0,0,0.5) !important",
      "expression(alert(1))",
      "rgba(0,0,0,0.5);color:red",
      "#12",
      "",
      "   ",
      "a",
      42,
      null,
      undefined,
      {},
    ]) {
      assert.equal(normalizeShadowColor(bad), fallback, JSON.stringify(bad));
    }
  },
);

await check("boxShadowValue writes the property value, with units", () => {
  assert.equal(boxShadowValue(undefined), "");
  assert.equal(boxShadowValue({ ...DEFAULT_BOX_SHADOW }), "");
  assert.equal(
    boxShadowValue({ ...DEFAULT_BOX_SHADOW, enabled: true }),
    "0px 4px 12px 0px rgba(0, 0, 0, 0.15)",
  );
  assert.equal(
    boxShadowValue(sh("#000000", { offsetX: -2, offsetY: 3, spread: -4 })),
    "-2px 3px 16px -4px #000000",
  );
  assert.equal(
    boxShadowValue(sh("#000000", { inset: true })),
    "inset 0px 6px 16px 0px #000000",
  );
});

await check(
  "allowInset: false draws an inset shadow outside, for an <img>",
  () => {
    const inset = sh("#000000", { inset: true });
    assert.equal(
      boxShadowValue(inset, { allowInset: false }),
      "0px 6px 16px 0px #000000",
    );
    assert.equal(
      boxShadowValue(inset, { allowInset: true }).startsWith("inset"),
      true,
    );
  },
);

await check("a shadow that would draw nothing writes nothing", () => {
  const zero = { offsetX: 0, offsetY: 0, blur: 0, spread: 0 };
  assert.equal(boxShadowValue(sh("#000000", zero)), "");
  assert.equal(isBoxShadowActive(sh("#000000", zero)), false);
  assert.equal(boxShadowValue(sh("rgba(0, 0, 0, 0)")), "");
  assert.equal(boxShadowValue(sh("transparent")), "");
  assert.equal(isBoxShadowActive(sh("#000000", { ...zero, spread: 1 })), true);
  assert.equal(
    isBoxShadowActive(sh("#000000", { ...zero, offsetX: -1 })),
    true,
  );
});

await check(
  "boxShadowMobileRule writes none for an override that is off",
  () => {
    assert.equal(
      boxShadowMobileRule(sh("#000000")),
      "box-shadow: 0px 6px 16px 0px #000000 !important",
    );
    assert.equal(
      boxShadowMobileRule({ ...sh("#000000"), enabled: false }),
      "box-shadow: none !important",
    );
    assert.equal(boxShadowMobileRule(null), "box-shadow: none !important");
    assert.equal(
      boxShadowMobileRule(sh("#000000", { inset: true }), {
        allowInset: false,
      }),
      "box-shadow: 0px 6px 16px 0px #000000 !important",
    );
  },
);

await check(
  "boxShadowEquals compares what the shadow means, not its spelling",
  () => {
    assert.equal(boxShadowEquals(undefined, { ...DEFAULT_BOX_SHADOW }), true);
    assert.equal(
      boxShadowEquals(
        { enabled: true, color: "#ABC" },
        { enabled: true, color: "#aabbcc" },
      ),
      true,
    );
    assert.equal(boxShadowEquals({ enabled: true }, { enabled: false }), false);
    assert.equal(boxShadowEquals({ blur: 1 }, { blur: 2 }), false);
  },
);

await check(
  "every preset is valid, distinct and found again by matchBoxShadowPreset",
  () => {
    const ids = new Set(BOX_SHADOW_PRESETS.map((p) => p.id));
    assert.equal(ids.size, BOX_SHADOW_PRESETS.length);
    assert.ok(BOX_SHADOW_PRESETS.length >= 4);
    for (const preset of BOX_SHADOW_PRESETS) {
      const s = boxShadowFromPreset(preset);
      assert.equal(s.enabled, true);
      // A preset is already normal: normalizing changes nothing.
      assert.deepEqual(normalizeBoxShadow(s), s, preset.id);
      assert.equal(isBoxShadowActive(s), true, preset.id);
      assert.equal(matchBoxShadowPreset(s)?.id, preset.id);
      // Switching it off keeps it recognisable.
      assert.equal(
        matchBoxShadowPreset({ ...s, enabled: false })?.id,
        preset.id,
      );
    }
    assert.equal(matchBoxShadowPreset(sh("#123456")), null);
    // Only one preset is inset, so an image (which has none) still gets four.
    assert.equal(BOX_SHADOW_PRESETS.filter((p) => p.shadow.inset).length, 1);
  },
);

// ─── 3. The clipping rule ─────────────────────────────────────────────────────

await check("hasActiveShadow sees desktop and mobile-only shadows", () => {
  assert.equal(hasActiveShadow(undefined), false);
  assert.equal(hasActiveShadow({}), false);
  assert.equal(hasActiveShadow({ boxShadow: sh(ROW) }), true);
  assert.equal(
    hasActiveShadow({ boxShadow: { ...sh(ROW), enabled: false } }),
    false,
  );
  assert.equal(hasActiveShadow({ mobile: { boxShadow: sh(ROW) } }), true);
  assert.equal(hasActiveShadow({ mobile: { boxShadow: null } }), false);
});

await check(
  "hasShadowInside looks through columns, nested rows and blocks",
  () => {
    const [r] = shadowed();
    // A row: its columns count, and what they hold.
    assert.equal(hasShadowInside(r), true);
    // A column: its children count, its own shadow does not.
    assert.equal(hasShadowInside(r.columns[0]), true); // the image
    assert.equal(hasShadowInside(r.columns[1]), true); // the button
    const own = column("c", 100, [heading("h")], { boxShadow: sh(COL) });
    assert.equal(hasShadowInside(own), false);
    // A row's own shadow does not count, a column's inside it does.
    assert.equal(
      hasShadowInside(row("r", [column("c", 100, [])], { boxShadow: sh(ROW) })),
      false,
    );
    assert.equal(
      hasShadowInside(row("r", [column("c", 100, [], { boxShadow: sh(COL) })])),
      true,
    );
    // Nested rows, at any depth, and a mobile-only shadow.
    const deep = column("c", 100, [
      row("n1", [
        column("n1c", 100, [
          row("n2", [
            column("n2c", 100, [
              button("b", { mobile: { boxShadow: sh(BTN) } }),
            ]),
          ]),
        ]),
      ]),
    ]);
    assert.equal(hasShadowInside(deep), true);
    const deepNested = column("c", 100, [
      row("n1", [column("n1c", 100, [], { boxShadow: sh(COL) })]),
    ]);
    assert.equal(hasShadowInside(deepNested), true);
    // A nested row's own shadow counts for the column around it.
    assert.equal(
      hasShadowInside(column("c", 100, [row("n", [], { boxShadow: sh(ROW) })])),
      true,
    );
  },
);

await check(
  "only an image or a button counts; a stray boxShadow elsewhere does not",
  () => {
    const stray = column("c", 100, [
      heading("h", { boxShadow: sh(IMG) }),
      spacer("s", { boxShadow: sh(IMG) }),
    ]);
    assert.equal(hasShadowInside(stray), false);
    // Legacy flat shape: the type is the component type, props are the same.
    const legacy = column("c", 100, [
      { id: "i", type: "image", props: { boxShadow: sh(IMG) } },
    ]);
    assert.equal(hasShadowInside(legacy), true);
    assert.equal(
      hasShadowInside({
        id: "c",
        components: [button("b", { boxShadow: sh(BTN) })],
      }),
      true,
    );
  },
);

await check("columnsHaveShadow is about the row's own columns only", () => {
  const [r] = shadowed();
  assert.equal(columnsHaveShadow(r), true);
  assert.equal(columnsHaveShadow(plain()[0]), false);
  assert.equal(columnsHaveShadow(null), false);
  // A shadow on a button inside is not a column shadow.
  assert.equal(
    columnsHaveShadow(
      row("r", [column("c", 100, [button("b", { boxShadow: sh(BTN) })])]),
    ),
    false,
  );
});

await check(
  "clipsOverflow: square nodes stop clipping for a shadow inside, rounded ones do not",
  () => {
    const withShadow = (extra: object = {}) =>
      column("c", 100, [image("i", { boxShadow: sh(IMG) })], extra);
    const radius = (r: number) => ({
      border: { width: 0, style: "solid", color: "#000000", radius: r },
    });
    // No shadow inside: always clips, as before.
    assert.equal(clipsOverflow(column("c", 100, [heading("h")])), true);
    assert.equal(clipsOverflow(null), true);
    // Square, with a shadow inside: does not clip.
    assert.equal(clipsOverflow(withShadow()), false);
    assert.equal(clipsOverflow(withShadow(radius(0))), false);
    // Rounded on desktop or on mobile: keeps clipping.
    assert.equal(clipsOverflow(withShadow(radius(8))), true);
    assert.equal(
      clipsOverflow(withShadow({ mobile: { border: { radius: 8 } } })),
      true,
    );
    // Its own shadow never makes it stop clipping.
    assert.equal(
      clipsOverflow(column("c", 100, [heading("h")], { boxShadow: sh(COL) })),
      true,
    );
    // A row stops clipping for a column's shadow.
    const [r] = shadowed();
    assert.equal(clipsOverflow(r), false);
    assert.equal(clipsOverflow(plain()[0]), true);
  },
);

await check(
  "cornersReachContent: content reaches a rounded corner unless the padding keeps it inside the curve",
  () => {
    const pad = (v: number) => ({ top: v, right: v, bottom: v, left: v });
    // Square: there is no curve.
    assert.equal(cornersReachContent(0, 0, undefined), false);
    assert.equal(cornersReachContent(0, 0, pad(0)), false);
    // Rounded and no padding: the content sits in every corner.
    assert.equal(cornersReachContent(20, 0, undefined), true);
    assert.equal(cornersReachContent(20, 0, pad(0)), true);
    // Padding of at least the radius on either side of a corner is clear of it.
    assert.equal(cornersReachContent(20, 0, pad(20)), false);
    assert.equal(cornersReachContent(20, 0, pad(40)), false);
    // Less than the radius can still be clear: the point (10, 10) is inside the
    // arc, (5, 5) is not (the arc passes through about (5.9, 5.9)).
    assert.equal(cornersReachContent(20, 0, pad(10)), false);
    assert.equal(cornersReachContent(20, 0, pad(6)), false);
    assert.equal(cornersReachContent(20, 0, pad(5)), true);
    // One corner is enough: here only the top left is reachable.
    assert.equal(
      cornersReachContent(20, 0, { top: 2, left: 10, right: 40, bottom: 40 }),
      true,
    );
    assert.equal(
      cornersReachContent(20, 0, { top: 40, left: 10, right: 40, bottom: 40 }),
      false,
    );
    // The clip follows the padding edge: the border takes its width off the radius.
    assert.equal(cornersReachContent(20, 2, pad(18)), false);
    assert.equal(cornersReachContent(20, 2, pad(5)), true);
    assert.equal(cornersReachContent(4, 6, pad(0)), false);
    // Missing, negative and non-numeric sides count as 0.
    assert.equal(cornersReachContent(20, 0, { top: -5 } as any), true);
    assert.equal(cornersReachContent(20, 0, { top: "9" } as any), true);
  },
);

await check(
  "clipsOverflow: a rounded node whose padding keeps the content off the corners stops clipping for a shadow inside",
  () => {
    const pad = (v: number) => ({ top: v, right: v, bottom: v, left: v });
    const round = (r: number, width = 0) => ({
      border: { width, style: "solid", color: "#000000", radius: r },
    });
    const card = (extra: object) =>
      column("c", 100, [button("b", { boxShadow: sh(BTN) })], extra);
    // A card: radius 20, padding 40.
    assert.equal(
      clipsOverflow(card({ ...round(20), padding: pad(40) })),
      false,
    );
    // The same card with the content in the corners keeps the clip.
    assert.equal(clipsOverflow(card({ ...round(20), padding: pad(0) })), true);
    assert.equal(clipsOverflow(card(round(20))), true);
    // Padding on one side only is not enough to clear all four corners.
    assert.equal(
      clipsOverflow(card({ ...round(20), padding: { top: 40, left: 40 } })),
      true,
    );
    // A border narrows the curve the clip follows.
    assert.equal(
      clipsOverflow(card({ ...round(20, 2), padding: pad(18) })),
      false,
    );
    // The clip is one declaration for both sizes: a corner the content can
    // reach on mobile keeps it, whether the padding or the radius changes there.
    assert.equal(
      clipsOverflow(
        card({ ...round(20), padding: pad(40), mobile: { padding: pad(0) } }),
      ),
      true,
    );
    assert.equal(
      clipsOverflow(
        card({
          ...round(20),
          padding: pad(40),
          mobile: { padding: pad(30) },
        }),
      ),
      false,
    );
    assert.equal(
      clipsOverflow(
        card({ ...round(20), padding: pad(40), mobile: round(200) }),
      ),
      true,
    );
    // A mobile border with no radius keeps the desktop radius.
    assert.equal(
      clipsOverflow(
        card({
          ...round(20),
          padding: pad(0),
          mobile: { border: { width: 1, style: "solid", color: "#000000" } },
        }),
      ),
      true,
    );
    // A row follows the same rule.
    const r = row(
      "r",
      [column("c", 100, [heading("h")], { boxShadow: sh(COL) })],
      {
        ...round(20),
        padding: pad(30),
      },
    );
    assert.equal(clipsOverflow(r), false);
    assert.equal(clipsOverflow({ ...r, padding: pad(0) }), true);
    // With no shadow inside, the clip stays whatever the padding is.
    assert.equal(
      clipsOverflow(
        column("c", 100, [heading("h")], { ...round(20), padding: pad(40) }),
      ),
      true,
    );
    // A shadow at any depth counts.
    const deep = column(
      "c",
      100,
      [row("n", [column("nc", 100, [button("b", { boxShadow: sh(BTN) })])])],
      { ...round(20), padding: pad(40) },
    );
    assert.equal(clipsOverflow(deep), false);
  },
);

// ─── 4. Save and load ─────────────────────────────────────────────────────────

const load = (rows: any[]): any[] => hydrateRows(clone(rows) as any) as any[];
const save = (rows: any[]): any[] => optimizeRows(clone(rows) as any) as any[];

/** Every node of a tree: rows, columns, children. */
const walk = (nodes: any[], fn: (n: any) => void): void => {
  for (const n of nodes) {
    fn(n);
    for (const c of n.columns ?? []) {
      fn(c);
      walk(c.children ?? [], fn);
    }
  }
};

await check(
  "loading gives rows and columns a default shadow and a null baseline",
  () => {
    const [r] = load(plain());
    for (const node of [r, r.columns[0]]) {
      assert.deepEqual(node.boxShadow, DEFAULT_BOX_SHADOW);
      assert.equal(node.mobile.boxShadow, null);
      assert.ok("boxShadow" in node.mobile);
    }
  },
);

await check(
  "loading gives images and buttons a default shadow and a null baseline",
  () => {
    const [r] = load(plain());
    const img = r.columns[0].children[0];
    const btn = r.columns[1].children[0];
    for (const c of [img, btn]) {
      assert.deepEqual(c.props.boxShadow, DEFAULT_BOX_SHADOW);
      assert.equal(c.props.mobile.boxShadow, null);
      assert.ok("boxShadow" in c.props.mobile);
    }
    // Other blocks do not get one.
    const h = r.columns[0].children[1];
    assert.equal("boxShadow" in h.props, false);
    assert.equal("boxShadow" in (h.props.mobile ?? {}), false);
  },
);

await check(
  "a template without shadows saves with no shadow key at all",
  () => {
    const saved = save(load(plain()));
    assert.equal(JSON.stringify(saved).includes("boxShadow"), false);
    walk(saved, (n) => {
      assert.equal("boxShadow" in n, false);
      assert.equal("boxShadow" in (n.props ?? {}), false);
    });
  },
);

await check("a shadow that is on is saved whole, on all four kinds", () => {
  const saved = save(load(shadowed()));
  const r = saved[0];
  assert.equal(r.boxShadow.color, ROW);
  assert.equal(r.boxShadow.enabled, true);
  assert.equal(r.columns[0].boxShadow.color, COL);
  assert.equal(r.columns[0].children[0].props.boxShadow.color, IMG);
  assert.equal(r.columns[1].children[0].props.boxShadow.color, BTN);
});

await check(
  "a shadow that is off but tuned is kept; one left at the default is not",
  () => {
    const tuned = { ...sh("#556677", { blur: 33 }), enabled: false };
    const saved = save(
      load([
        row("r", [column("c", 100, [button("b", { boxShadow: tuned })])], {
          boxShadow: { ...DEFAULT_BOX_SHADOW },
        }),
      ]),
    );
    assert.equal("boxShadow" in saved[0], false);
    assert.deepEqual(saved[0].columns[0].children[0].props.boxShadow, tuned);
    // And it comes back as it was.
    const back = load(saved);
    assert.deepEqual(back[0].columns[0].children[0].props.boxShadow, tuned);
  },
);

await check("a partial saved shadow is completed from the defaults", () => {
  const [r] = load([
    row(
      "r",
      [
        column("c", 100, [
          image("i", { boxShadow: { enabled: true, blur: 40 } }),
        ]),
      ],
      {
        boxShadow: { enabled: true },
      },
    ),
  ]);
  assert.deepEqual(r.boxShadow, { ...DEFAULT_BOX_SHADOW, enabled: true });
  assert.deepEqual(r.columns[0].children[0].props.boxShadow, {
    ...DEFAULT_BOX_SHADOW,
    enabled: true,
    blur: 40,
  });
});

await check("a mobile override survives save and load, including 'off'", () => {
  const off = { ...sh("#000000"), enabled: false };
  const rows = [
    row(
      "r",
      [
        column(
          "c",
          100,
          [
            image("i", { boxShadow: sh(IMG), mobile: { boxShadow: off } }),
            button("b", { mobile: { boxShadow: sh(BTN) } }),
          ],
          { mobile: { boxShadow: off } },
        ),
      ],
      { boxShadow: sh(ROW), mobile: { boxShadow: off } },
    ),
  ];
  const saved = save(load(rows));
  assert.deepEqual(saved[0].mobile, { boxShadow: off });
  assert.deepEqual(saved[0].columns[0].mobile, { boxShadow: off });
  assert.deepEqual(saved[0].columns[0].children[0].props.mobile, {
    boxShadow: off,
  });
  assert.deepEqual(
    saved[0].columns[0].children[1].props.mobile.boxShadow,
    sh(BTN),
  );
  const back = load(saved);
  assert.deepEqual(back[0].mobile.boxShadow, off);
  assert.deepEqual(back[0].columns[0].children[0].props.mobile.boxShadow, off);
});

await check(
  "a null mobile shadow saves nothing and an all-null baseline saves no mobile key",
  () => {
    const saved = save(load(shadowed()));
    assert.equal(JSON.stringify(saved).includes('"mobile"'), false);
  },
);

await check(
  "load, save, load, save is stable for a template with shadows",
  () => {
    const once = save(load(shadowed()));
    const twice = save(load(once));
    assert.equal(JSON.stringify(twice), JSON.stringify(once));
  },
);

await check("hydrateComponent completes a lone image or button", () => {
  const img = hydrateComponent({
    id: "i",
    type: "component",
    componentType: "image",
    props: { boxShadow: { enabled: true } },
  });
  assert.equal((img.props.boxShadow as any).blur, DEFAULT_BOX_SHADOW.blur);
  const btn = hydrateComponent({
    id: "b",
    type: "component",
    componentType: "button",
    props: {},
  });
  assert.deepEqual(btn.props.boxShadow, DEFAULT_BOX_SHADOW);
});

// ─── 5. Export ────────────────────────────────────────────────────────────────

const out = await exportTemplate(shadowed(), canvas);
const VALUE = (c: string) => `0px 6px 16px 0px ${c}`;

await check(
  "HTML: the shadow lands on the row <td>, the column <td>, the <img> and the <a>",
  () => {
    const rowTd = tagsWith(out.html, VALUE(ROW));
    assert.equal(rowTd.length, 1);
    assert.ok(rowTd[0].startsWith("<td"));
    // The row's <td> is the one with the background, not a wrapper div.
    assert.ok(/background/.test(rowTd[0]));

    const colTd = tagsWith(out.html, VALUE(COL));
    assert.equal(colTd.length, 1);
    assert.ok(colTd[0].startsWith("<td"));
    assert.ok(colTd[0].includes("vertical-align"));

    const img = tagsWith(out.html, VALUE(IMG));
    assert.equal(img.length, 1);
    assert.ok(img[0].startsWith("<img"));

    const btn = tagsWith(out.html, VALUE(BTN));
    assert.equal(btn.length, 1);
    assert.ok(btn[0].startsWith("<a "));
    assert.ok(btn[0].includes("display:inline-block"));
  },
);

await check("MJML: the same four elements carry the same values", () => {
  for (const [color, start] of [
    [ROW, "<td"],
    [COL, "<td"],
    [IMG, "<img"],
    [BTN, "<a "],
  ] as const) {
    const tags = tagsWith(out.mjml, VALUE(color));
    assert.equal(tags.length, 1, `${color} in MJML`);
    assert.ok(tags[0].startsWith(start), `${color} on ${tags[0].slice(0, 30)}`);
  }
});

await check(
  "React Email: boxShadow on the Section, the Column, the Img and the Link",
  () => {
    const re = (tag: string, color: string) =>
      new RegExp(
        `<${tag}\\b[^>]*boxShadow:\\s*"${VALUE(color).replace(/[().]/g, "\\$&")}"`,
      );
    assert.match(out.jsx, re("Section", ROW));
    assert.match(out.jsx, re("Column", COL));
    assert.match(out.jsx, re("Img", IMG));
    assert.match(out.jsx, re("Link", BTN));
    assert.equal(count(out.jsx, /boxShadow/g), 4);
    // JSX takes camelCase: no CSS spelling leaks into the style objects.
    assert.equal(out.jsx.includes("box-shadow"), false);
  },
);

await check(
  "a template without shadows exports no shadow in any format",
  async () => {
    const p = await exportTemplate(plain(), canvas);
    for (const text of [p.html, p.mjml, p.jsx]) {
      assert.equal(/box-?shadow/i.test(text), false);
    }
  },
);

await check(
  "a shadow that is off exports nothing, whatever values it keeps",
  async () => {
    const off = { ...sh(IMG, { blur: 40 }), enabled: false };
    const p = await exportTemplate(
      [
        row(
          "r",
          [
            column(
              "c",
              100,
              [image("i", { boxShadow: off }), button("b", { boxShadow: off })],
              { boxShadow: off },
            ),
          ],
          { boxShadow: off },
        ),
      ],
      canvas,
    );
    for (const text of [p.html, p.mjml, p.jsx]) {
      assert.equal(/box-?shadow/i.test(text), false);
    }
  },
);

await check(
  "inset: drawn on a row, column and button, never on an image",
  async () => {
    const p = await exportTemplate(
      [
        row(
          "r",
          [
            column(
              "c",
              100,
              [
                image("i", { boxShadow: sh(IMG, { inset: true }) }),
                button("b", { boxShadow: sh(BTN, { inset: true }) }),
              ],
              { boxShadow: sh(COL, { inset: true }) },
            ),
          ],
          { boxShadow: sh(ROW, { inset: true }) },
        ),
      ],
      canvas,
    );
    for (const text of [p.html, p.mjml]) {
      for (const color of [ROW, COL, BTN]) {
        assert.equal(tagsWith(text, `inset ${VALUE(color)}`).length, 1, color);
      }
      const img = tagsWith(text, VALUE(IMG));
      assert.equal(img.length, 1);
      assert.equal(img[0].includes("inset"), false);
    }
    // Section, Column and Link: the Img draws its shadow outside.
    assert.equal(count(p.jsx, /boxShadow:\s*"inset /g), 3);
    assert.equal(count(p.jsx, /boxShadow/g), 4);
    assert.equal(p.jsx.includes(`boxShadow:"${VALUE(IMG)}"`), true);
  },
);

await check(
  "a hostile colour in the saved JSON never reaches the email",
  async () => {
    const evil = 'red;}</style><script>alert(1)</script><x y="';
    const p = await exportTemplate(
      [
        row(
          "r",
          [
            column(
              "c",
              100,
              [
                image("i", { boxShadow: sh(evil) }),
                button("b", { boxShadow: sh(evil) }),
              ],
              { boxShadow: sh(evil) },
            ),
          ],
          { boxShadow: sh(evil), mobile: { boxShadow: sh(evil) } },
        ),
      ],
      canvas,
    );
    for (const text of [p.html, p.mjml, p.jsx]) {
      assert.equal(text.includes("<script"), false);
      assert.equal(text.includes("alert(1)"), false);
    }
    // It is replaced by the default colour, so the shadow is still there.
    assert.ok(p.html.includes("0px 6px 16px 0px rgba(0, 0, 0, 0.15)"));
  },
);

await check("numbers outside the range are clamped in the email", async () => {
  const p = await exportTemplate(
    [
      row("r", [column("c", 100, [button("b")])], {
        boxShadow: sh(ROW, {
          offsetX: 9999,
          offsetY: -9999,
          blur: -50,
          spread: 9999,
        }),
      }),
    ],
    canvas,
  );
  assert.equal(tagsWith(p.html, "50px -50px 0px 50px #111111").length, 1);
});

// ── Clipping, in the exported email ──────────────────────────────────────────

await check(
  "without shadows every row and column still clips, as before",
  async () => {
    const p = await exportTemplate(plain(), canvas);
    // One row <td> and two column <td>.
    assert.equal(rowTds(p.html).length, 1);
    assert.equal(columnTds(p.html).length, 2);
    for (const t of [...rowTds(p.html), ...columnTds(p.html)]) {
      assert.ok(t.includes("overflow:hidden"), t);
    }
    assert.equal(count(p.mjml, /overflow:hidden/g) >= 3, true);
    assert.equal(count(p.jsx, /overflow:"hidden"/g) >= 3, true);
  },
);

await check(
  "a shadow on an image or button lifts the clip from its square column and row",
  async () => {
    const p = await exportTemplate(
      [
        row("r", [
          column("c1", 50, [image("i", { boxShadow: sh(IMG) })]),
          column("c2", 50, [heading("h")]),
        ]),
      ],
      canvas,
    );
    for (const text of [p.html, p.mjml]) {
      const cols = columnTds(text);
      assert.equal(cols.length, 2);
      // Column 1 holds the shadow and lets it past. Column 2 holds nothing: it clips.
      assert.equal(
        cols.filter((t) => !t.includes("overflow:hidden")).length,
        1,
      );
      assert.equal(cols.filter((t) => t.includes("overflow:hidden")).length, 1);
    }
    // The row <td> no longer clips either.
    assert.equal(rowTds(p.html).length, 1);
    assert.equal(rowTds(p.html)[0].includes("overflow:hidden"), false);
    // React Email makes the same decisions: only column 2 still clips.
    assert.equal(count(p.jsx, /overflow:"hidden"/g), 1);
  },
);

await check(
  "a rounded column keeps clipping, and its row, which is square, still lifts",
  async () => {
    const round = {
      border: { width: 0, style: "solid", color: "#000000", radius: 12 },
    };
    const p = await exportTemplate(
      [
        row("r", [
          column("c1", 100, [image("i", { boxShadow: sh(IMG) })], round),
        ]),
      ],
      canvas,
    );
    const cols = columnTds(p.html);
    assert.equal(cols.length, 1);
    assert.ok(cols[0].includes("overflow:hidden"));
    assert.ok(cols[0].includes("border-radius:12px"));
    // By the rule: a square row with a shadow somewhere inside stops clipping.
    assert.equal(rowTds(p.html)[0].includes("overflow:hidden"), false);
  },
);

await check(
  "a column's own shadow is not clipped by it, but lifts the clip from its row",
  async () => {
    const p = await exportTemplate(
      [row("r", [column("c1", 100, [heading("h")], { boxShadow: sh(COL) })])],
      canvas,
    );
    const col = tagsWith(p.html, VALUE(COL))[0];
    assert.ok(
      col.includes("overflow:hidden"),
      "the column still clips what it holds",
    );
    assert.equal(rowTds(p.html)[0].includes("overflow:hidden"), false);
  },
);

await check(
  "a nested row's shadow lifts the clip from the column around it",
  async () => {
    const p = await exportTemplate(
      [
        row("r", [
          column("outer", 100, [
            row("inner", [column("innerCol", 100, [heading("h")])], {
              boxShadow: sh(ROW),
            }),
          ]),
        ]),
      ],
      canvas,
    );
    const cols = columnTds(p.html);
    assert.equal(cols.length, 2);
    // The outer column holds the nested row and lets its shadow past; the inner one holds only a heading.
    assert.equal(cols.filter((t) => !t.includes("overflow:hidden")).length, 1);
    assert.equal(cols.filter((t) => t.includes("overflow:hidden")).length, 1);
  },
);

await check(
  "a row with a radius keeps clipping the children it rounds",
  async () => {
    const p = await exportTemplate(
      [
        row("r", [column("c", 100, [image("i", { boxShadow: sh(IMG) })])], {
          border: { width: 0, style: "solid", color: "#000000", radius: 10 },
        }),
      ],
      canvas,
    );
    const tds = rowTds(p.html);
    assert.equal(tds.length, 1);
    assert.ok(tds[0].includes("border-radius:10px"));
    assert.ok(tds[0].includes("overflow:hidden"));
  },
);

await check(
  "a rounded column whose padding keeps the content off its corners lets a shadow inside it past",
  async () => {
    const card = (padding: number) =>
      exportTemplate(
        [
          row("r", [
            column("c1", 100, [button("b", { boxShadow: sh(BTN) })], {
              padding: {
                top: padding,
                right: padding,
                bottom: padding,
                left: padding,
              },
              border: {
                width: 0,
                style: "solid",
                color: "#000000",
                radius: 20,
              },
            }),
          ]),
        ],
        canvas,
      );
    const padded = await card(30);
    for (const text of [padded.html, padded.mjml]) {
      const cols = columnTds(text);
      assert.equal(cols.length, 1);
      assert.ok(cols[0].includes("border-radius:20px"), cols[0]);
      assert.equal(cols[0].includes("overflow:hidden"), false, cols[0]);
    }
    assert.equal(count(padded.jsx, /overflow:"hidden"/g), 0);
    // Without padding the button is in the corners: the clip stays.
    const flush = await card(0);
    for (const text of [flush.html, flush.mjml]) {
      assert.ok(columnTds(text)[0].includes("overflow:hidden"));
    }
    assert.equal(count(flush.jsx, /overflow:"hidden"/g), 1);
  },
);

await check(
  "a rounded, bordered row follows the same rule on both of its elements",
  async () => {
    const make = (padding: number) =>
      exportTemplate(
        [
          row(
            "r",
            [column("c1", 100, [heading("h")], { boxShadow: sh(COL) })],
            {
              padding: {
                top: padding,
                right: padding,
                bottom: padding,
                left: padding,
              },
              border: {
                width: 2,
                style: "solid",
                color: "#333333",
                radius: 20,
              },
            },
          ),
        ],
        canvas,
      );
    // Padded: the <td> and the outer element that carries the border do not clip.
    const padded = await make(30);
    const outerP = tagsWith(padded.html, "border:2px solid #333333");
    assert.equal(outerP.length, 1);
    assert.ok(outerP[0].includes("border-radius:20px"));
    assert.equal(outerP[0].includes("overflow:hidden"), false, outerP[0]);
    assert.equal(rowTds(padded.html)[0].includes("overflow:hidden"), false);
    // Flush: both clip, so the column's square background is trimmed by the curve.
    const flush = await make(0);
    const outerF = tagsWith(flush.html, "border:2px solid #333333");
    assert.ok(outerF[0].includes("overflow:hidden"), outerF[0]);
    assert.ok(rowTds(flush.html)[0].includes("overflow:hidden"));
  },
);

await check(
  "a square row with a mobile border override does not clip the shadow of its column",
  async () => {
    const make = (withShadow: boolean) =>
      exportTemplate(
        [
          row(
            "r",
            [
              column("c1", 100, [heading("h")], {
                ...(withShadow ? { boxShadow: sh(COL) } : {}),
              }),
            ],
            {
              mobile: {
                border: {
                  width: 1,
                  style: "solid",
                  color: "#000000",
                  radius: 0,
                },
              },
            },
          ),
        ],
        canvas,
      );
    // The mobile border forces an outer element for the override to attach to.
    // It clipped whatever was inside, shadow or not; now it follows the rule.
    const withS = await make(true);
    const outerS = tagsWith(withS.html, 'class="eb-r-outer"');
    assert.equal(outerS.length, 1);
    assert.equal(outerS[0].includes("overflow:hidden"), false, outerS[0]);
    // With no shadow inside it still clips, exactly as it did.
    const without = await make(false);
    const outerN = tagsWith(without.html, 'class="eb-r-outer"');
    assert.equal(outerN.length, 1);
    assert.ok(outerN[0].includes("overflow:hidden"), outerN[0]);
  },
);

// ── A row's own shadow, in the exported email ────────────────────────────────
//
// A row's own <td> carries its shadow, so the <td> must not clip: in a table
// with collapsed borders (every row's <td> is in one) a cell that clips is
// drawn without its shadow. The clip, which still rounds the corners and trims
// the children's backgrounds, lives on a div inside the cell.

const rounded = (radius: number, width = 0) => ({
  border: { width, style: "solid", color: "#333333", radius },
});
const padded = (n: number) => ({
  padding: { top: n, right: n, bottom: n, left: n },
});
/** A row with its own shadow around one column that holds `kids`. */
const shadowRow = (extra: object = {}, kids: unknown[] = [heading("h")]) =>
  row("r", [column("c", 100, kids)], { boxShadow: sh(ROW), ...extra });

await check(
  "the scanner behind these checks flags the cell it is meant to catch, and only that",
  () => {
    const cell =
      '<td style="overflow:hidden;box-shadow:0px 6px 16px 0px #111">';
    const lost = (html: string, fallback: "collapse" | "separate") =>
      cellsThatLoseTheirShadow(html, fallback).length;
    const collapse = '<table style="border-collapse:collapse"><tr>';
    const separate = '<table style="border-collapse:separate"><tr>';
    assert.equal(lost(collapse + cell, "separate"), 1);
    // A table inside it follows it, unless it says otherwise.
    assert.equal(lost(`${collapse}<td><table><tr>${cell}`, "separate"), 1);
    assert.equal(lost(`${collapse}<td>${separate}${cell}`, "separate"), 0);
    // When a table closes, the one around it counts again.
    assert.equal(
      lost(
        `${collapse}<td>${separate}</tr></table></td><tr>${cell}`,
        "x" as any,
      ),
      1,
    );
    // No value anywhere: the fallback decides.
    assert.equal(lost(`<table><tr>${cell}`, "collapse"), 1);
    assert.equal(lost(`<table><tr>${cell}`, "separate"), 0);
    // No overflow, no shadow, or a shadow of none: nothing is lost.
    assert.equal(
      lost(
        `${collapse}<td style="box-shadow:0px 6px 16px 0px #111">`,
        "separate",
      ),
      0,
    );
    assert.equal(
      lost(`${collapse}<td style="overflow:hidden">`, "separate"),
      0,
    );
    assert.equal(
      lost(
        `${collapse}<td style="overflow:hidden;box-shadow:none">`,
        "separate",
      ),
      0,
    );
  },
);

await check(
  "a row's own shadow is never on a cell that clips, whatever the row looks like",
  async () => {
    for (const radius of [0, 12, 20]) {
      for (const borderWidth of [0, 2]) {
        for (const pad of [0, 30]) {
          for (const nested of [false, true]) {
            const r = shadowRow({
              ...rounded(radius, borderWidth),
              ...padded(pad),
            });
            const label = `radius ${radius}, border ${borderWidth}, padding ${pad}, ${nested ? "nested" : "top level"}`;
            const p = await exportTemplate(
              nested ? [row("o", [column("oc", 100, [r])])] : [r],
              canvas,
            );
            for (const [text, fallback] of [
              [p.html, "separate"],
              [p.mjml, "collapse"],
            ] as const) {
              const mine = tagsWith(text, VALUE(ROW));
              assert.equal(mine.length, 1, label);
              assert.ok(mine[0].startsWith("<td"), label);
              assert.equal(
                /overflow/.test(mine[0]),
                false,
                `${label}: ${mine[0]}`,
              );
              assert.deepEqual(
                cellsThatLoseTheirShadow(text, fallback),
                [],
                label,
              );
              // The row still clips: one div inside the cell does it.
              assert.equal(
                rowDivs(text).filter((t) => t.includes("overflow:hidden"))
                  .length,
                1,
                label,
              );
            }
            // React Email: the Section carries the shadow and no overflow.
            const sections = (p.jsx.match(/<Section\b[^>]*>/g) ?? []).filter(
              (t) => t.includes("boxShadow"),
            );
            assert.equal(sections.length, 1, label);
            assert.equal(sections[0].includes("overflow"), false, label);
          }
        }
      }
    }
  },
);

await check(
  "the clip of a row with its own shadow moves into the cell, rounded corners and all",
  async () => {
    const make = (extra: object) => exportTemplate([shadowRow(extra)], canvas);

    // Square: the div that holds the padding clips; nothing is rounded.
    const square = await make({});
    for (const text of [square.html, square.mjml]) {
      const [td] = tagsWith(text, VALUE(ROW));
      assert.equal(td.includes("border-radius"), false, td);
      const divs = rowDivs(text);
      assert.equal(divs.length, 1);
      assert.ok(divs[0].includes("overflow:hidden"), divs[0]);
      assert.equal(divs[0].includes("border-radius"), false, divs[0]);
    }

    // Rounded: the cell keeps the radius (its background and shadow follow
    // the curve), and the div takes the radius too, to cut the children.
    const round = await make(rounded(12));
    for (const text of [round.html, round.mjml]) {
      const [td] = tagsWith(text, VALUE(ROW));
      assert.ok(td.includes("border-radius:12px"), td);
      const divs = rowDivs(text);
      assert.equal(divs.length, 1);
      assert.ok(divs[0].includes("border-radius:12px"), divs[0]);
      assert.ok(divs[0].includes("overflow:hidden"), divs[0]);
    }

    // Rounded and bordered: the outer div, which draws the border, clips; the
    // div with the padding does not need to.
    const border = await make(rounded(12, 2));
    for (const text of [border.html, border.mjml]) {
      const [td] = tagsWith(text, VALUE(ROW));
      assert.ok(td.includes("border-radius:12px"), td);
      assert.equal(td.includes("overflow"), false, td);
      const divs = rowDivs(text);
      assert.equal(divs.length, 2);
      assert.ok(divs[0].includes("border:2px solid #333333"), divs[0]);
      assert.ok(divs[0].includes("border-radius:12px"), divs[0]);
      assert.ok(divs[0].includes("overflow:hidden"), divs[0]);
      assert.equal(divs[1].includes("overflow"), false, divs[1]);
    }

    // React Email: same layers, in style objects.
    const jsxDiv = (jsx: string) =>
      (jsx.match(/<div style=\{\{[^}]*\}\}>/g) ?? []).filter((t) =>
        t.includes('lineHeight:"0"'),
      );
    assert.ok(jsxDiv(round.jsx)[0].includes('overflow:"hidden"'));
    assert.ok(jsxDiv(round.jsx)[0].includes('borderRadius:"12px"'));
    const section = (round.jsx.match(/<Section\b[^>]*>/g) ?? [])[0];
    assert.ok(section.includes('borderRadius:"12px"'), section);
    assert.equal(section.includes("overflow"), false, section);
  },
);

await check(
  "a row without a shadow of its own exports as before: the cell clips, no div does",
  async () => {
    // The shadow here is the image's. The row is rounded and flush, so it clips.
    const p = await exportTemplate(
      [
        row("r", [column("c", 100, [image("i", { boxShadow: sh(IMG) })])], {
          ...rounded(10),
        }),
      ],
      canvas,
    );
    for (const text of [p.html, p.mjml]) {
      const tds = rowTds(text);
      assert.equal(tds.length, 1);
      assert.ok(tds[0].includes("border-radius:10px"), tds[0]);
      assert.ok(tds[0].includes("overflow:hidden"), tds[0]);
      for (const d of rowDivs(text)) {
        assert.equal(d.includes("overflow"), false, d);
      }
    }
    const section = (p.jsx.match(/<Section\b[^>]*>/g) ?? [])[0];
    assert.ok(section.includes('overflow:"hidden"'), section);
    // And with no shadow anywhere the row is exactly what it was.
    const plainRow = await exportTemplate(
      [row("r", [column("c", 100, [heading("h")])], rounded(10))],
      canvas,
    );
    assert.ok(rowTds(plainRow.html)[0].includes("overflow:hidden"));
    for (const d of rowDivs(plainRow.html)) {
      assert.equal(d.includes("overflow"), false, d);
    }
  },
);

await check(
  "a shadow inside a rounded row lifts its clip only when padding keeps the content off the corners",
  async () => {
    const make = (pad: number) =>
      exportTemplate(
        [
          shadowRow({ ...rounded(20), ...padded(pad) }, [
            button("b", { boxShadow: sh(BTN) }),
          ]),
        ],
        canvas,
      );
    // Padded: the button's shadow has room, so nothing clips, and the row's own shadow is on the cell as ever.
    const roomy = await make(30);
    for (const text of [roomy.html, roomy.mjml]) {
      const [td] = tagsWith(text, VALUE(ROW));
      assert.ok(td.includes("border-radius:20px"), td);
      assert.equal(td.includes("overflow"), false, td);
      for (const d of rowDivs(text))
        assert.equal(d.includes("overflow"), false, d);
    }
    assert.equal(/<Section\b[^>]*overflow/.test(roomy.jsx), false);
    // Flush: the button is in the corners, so the row clips (inside the cell, not on it).
    const flush = await make(0);
    for (const text of [flush.html, flush.mjml]) {
      const [td] = tagsWith(text, VALUE(ROW));
      assert.equal(td.includes("overflow"), false, td);
      assert.equal(
        rowDivs(text).filter((t) => t.includes("overflow:hidden")).length,
        1,
      );
    }
  },
);

await check(
  "a row with a shadow and a mobile border override clips on the outer element, not on the cell",
  async () => {
    const p = await exportTemplate(
      [
        shadowRow({
          mobile: {
            border: { width: 1, style: "solid", color: "#000000", radius: 0 },
          },
        }),
      ],
      canvas,
    );
    for (const [text, fallback] of [
      [p.html, "separate"],
      [p.mjml, "collapse"],
    ] as const) {
      const [td] = tagsWith(text, VALUE(ROW));
      assert.ok(td.includes('class="eb-r"'), td);
      assert.equal(td.includes("overflow"), false, td);
      const outer = tagsWith(text, 'class="eb-r-outer"');
      assert.equal(outer.length, 1);
      assert.ok(outer[0].includes("overflow:hidden"), outer[0]);
      assert.deepEqual(cellsThatLoseTheirShadow(text, fallback), []);
    }
    assert.equal(/<Section\b[^>]*overflow/.test(p.jsx), false);
  },
);

await check(
  "border-collapse is separate when a column has a shadow, and unchanged otherwise",
  async () => {
    const gap0 = (cols: unknown[]) => [row("r", cols, { gap: 0 })];
    const withShadow = await exportTemplate(
      gap0([
        column("a", 50, [heading("h")], { boxShadow: sh(COL) }),
        column("b", 50, [heading("h2")]),
      ]),
      canvas,
    );
    const without = await exportTemplate(
      gap0([column("a", 50, [heading("h")]), column("b", 50, [heading("h2")])]),
      canvas,
    );
    // The table that holds a row's columns has this one style. The outer
    // email-container table also says border-collapse, so it is not matched.
    const sepOf = (t: string) =>
      t.match(
        /<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:(separate|collapse);">/,
      )?.[1];
    assert.equal(sepOf(withShadow.html), "separate");
    assert.equal(sepOf(without.html), "collapse");
    assert.equal(sepOf(withShadow.mjml), "separate");
    assert.equal(sepOf(without.mjml), "collapse");
    // A shadow on a button, not on a column, changes nothing here.
    const onButton = await exportTemplate(
      gap0([column("a", 100, [button("b", { boxShadow: sh(BTN) })])]),
      canvas,
    );
    assert.equal(sepOf(onButton.html), "collapse");
  },
);

// ── Mobile overrides ─────────────────────────────────────────────────────────

/** The mobile overrides block, up to the end of the <style> that holds it. */
const mobileCss = (html: string): string => {
  const start = html.indexOf("/* Mobile property overrides */");
  assert.ok(start >= 0, "mobile overrides block is present");
  return html.slice(start, html.indexOf("</style>", start));
};

await check(
  "mobile: each override becomes one rule on the element's hook class",
  async () => {
    const on = sh("#abcdef", { offsetY: 2, blur: 4 });
    const off = { ...sh("#000000"), enabled: false };
    const rows = [
      row(
        "rr",
        [
          column(
            "cc",
            100,
            [
              image("ii", { boxShadow: sh(IMG), mobile: { boxShadow: off } }),
              button("bb", { mobile: { boxShadow: on } }),
            ],
            { mobile: { boxShadow: on } },
          ),
        ],
        { boxShadow: sh(ROW), mobile: { boxShadow: off } },
      ),
    ];
    const p = await exportTemplate(rows, canvas);
    const css = mobileCss(p.html);
    assert.match(css, /\.eb-rr \{[^}]*box-shadow: none !important/);
    assert.match(
      css,
      /\.eb-cc \{[^}]*box-shadow: 0px 2px 4px 0px #abcdef !important/,
    );
    assert.match(css, /\.eb-ii img \{[^}]*box-shadow: none !important/);
    assert.match(
      css,
      /\.eb-bb-link \{[^}]*box-shadow: 0px 2px 4px 0px #abcdef !important/,
    );
    // Every class a rule targets exists in the markup.
    for (const cls of ["eb-rr", "eb-cc", "eb-ii", "eb-bb-link"]) {
      assert.ok(
        p.html.includes(cls + '"') || p.html.includes(cls + " "),
        `${cls} in markup`,
      );
    }
    // MJML carries the same rules, React Email in its <style>.
    assert.match(p.mjml, /\.eb-rr \{[^}]*box-shadow: none !important/);
    assert.match(p.jsx, /box-shadow: none !important/);
  },
);

await check(
  "a shadow that only exists on mobile is kept off a clipping cell too",
  async () => {
    // Desktop: none. Mobile: the row has a shadow, set on the cell by its hook class.
    const p = await exportTemplate(
      [shadowRow({ boxShadow: undefined, mobile: { boxShadow: sh(ROW) } })],
      canvas,
    );
    for (const text of [p.html, p.mjml]) {
      const tds = tagsWith(text, 'class="eb-r"');
      assert.equal(tds.length, 1);
      assert.equal(tds[0].includes("overflow"), false, tds[0]);
      const clip = tagsWith(text, 'class="eb-r-box eb-r-outer"');
      assert.equal(clip.length, 1);
      assert.ok(clip[0].includes("overflow:hidden"), clip[0]);
    }
    assert.match(
      mobileCss(p.html),
      /\.eb-r \{[^}]*box-shadow: 0px 6px 16px 0px #111111 !important/,
    );
    assert.equal(
      /<Section\b[^>]*overflow/.test(p.jsx),
      false,
      "React Email Section",
    );

    // Desktop shadow, off on mobile: the shadow is on the cell, which does not clip.
    const off = await exportTemplate(
      [shadowRow({ mobile: { boxShadow: { ...sh(ROW), enabled: false } } })],
      canvas,
    );
    const [td] = tagsWith(off.html, VALUE(ROW));
    assert.equal(td.includes("overflow"), false, td);
    assert.match(
      mobileCss(off.html),
      /\.eb-r \{[^}]*box-shadow: none !important/,
    );
  },
);

await check("mobile: an image override is written without inset", async () => {
  const p = await exportTemplate(
    [
      row("r", [
        column("c", 100, [
          image("ii", { mobile: { boxShadow: sh(IMG, { inset: true }) } }),
        ]),
      ]),
    ],
    canvas,
  );
  assert.match(
    mobileCss(p.html),
    /\.eb-ii img \{[^}]*box-shadow: 0px 6px 16px 0px #333333 !important/,
  );
  assert.equal(mobileCss(p.html).includes("inset"), false);
});

await check(
  "mobile: a button override does not reach an inline link (anchor)",
  async () => {
    const p = await exportTemplate(
      [
        row("r", [
          column("c", 100, [
            {
              id: "aa",
              type: "component",
              componentType: "anchor",
              props: {
                text: "x",
                link: "https://example.com",
                mobile: { boxShadow: sh(BTN) },
              },
            },
          ]),
        ]),
      ],
      canvas,
    );
    assert.equal(/box-shadow/.test(p.html), false);
  },
);

await check("no mobile rule when nothing is overridden", () => {
  assert.equal(out.html.includes("Mobile property overrides"), false);
  assert.equal(/box-shadow:[^;"]*!important/.test(out.html), false);
});

// ─── 6. The Preview screen's client simulation ────────────────────────────────

const { transformForClient, selectedClients, availableClients } =
  useClientPreview();
const client = (id: string) => {
  const c = [...selectedClients.value, ...availableClients.value].find(
    (x) => x.id === id,
  );
  assert.ok(c, `client ${id}`);
  return c!;
};

await check(
  "clients that cannot draw shadows lose them; the others keep them",
  () => {
    const html = out.html;
    const total = count(html, /box-shadow:/g);
    assert.equal(total, 4);
    // Which clients draw a shadow follows caniemail.com/features/css-box-shadow.
    for (const id of [
      "apple-mail",
      "apple-mail-ios",
      "outlook-365",
      "outlook-web",
      "thunderbird",
      "samsung-mail",
      "protonmail",
    ]) {
      assert.equal(
        count(transformForClient(html, client(id)), /box-shadow:/g),
        total,
        id,
      );
    }
    for (const id of [
      "outlook-desktop",
      "gmail-web",
      "gmail-android",
      "gmail-ios",
      "yahoo-mail",
      "aol-mail",
    ]) {
      assert.equal(
        count(transformForClient(html, client(id)), /box-shadow:/g),
        0,
        id,
      );
    }
  },
);

await check("stripping shadows keeps the mobile stylesheet whole", async () => {
  const off = { ...sh("#000000"), enabled: false };
  const p = await exportTemplate(
    [
      row(
        "r",
        [
          column("c", 100, [
            button("b", { boxShadow: sh(BTN), mobile: { boxShadow: off } }),
          ]),
        ],
        {
          mobile: {
            boxShadow: off,
            padding: { top: 5, right: 5, bottom: 5, left: 5 },
          },
        },
      ),
    ],
    canvas,
  );
  const before = mobileCss(p.html);
  // Gmail Android has media queries and no shadows. The declaration that is
  // removed ends a rule (`box-shadow: none !important }`); what follows it must
  // still be there, braces and all.
  const after = mobileCss(transformForClient(p.html, client("gmail-android")));
  assert.equal(/box-shadow/.test(after), false);
  assert.ok(after.includes(".eb-b-link {"));
  assert.ok(after.includes(".eb-r-box {"));
  assert.ok(after.includes("padding: 5px 5px 5px 5px !important"));
  assert.equal(count(after, /\}/g), count(before, /\}/g));
  assert.equal(count(after, /\{/g), count(before, /\{/g));
});

// ─── 7. The colour picker opens on what it is given ───────────────────────────

await check("useColor opens on rgba(), with its alpha", () => {
  const c = useColor("rgba(0, 0, 0, 0.15)");
  assert.equal(c.hex.value, "#000000");
  assert.equal(c.a.value, 0.15);
  assert.equal(c.cssColor.value, "rgba(0, 0, 0, 0.15)");
  const d = useColor("rgba(255, 128, 0, 0.5)");
  assert.deepEqual(d.rgb.value, [255, 128, 0]);
  assert.equal(d.a.value, 0.5);
});

await check(
  "useColor opens on 8-digit hex and on a plain hex, with alpha 1",
  () => {
    const a = useColor("#ff000080");
    assert.deepEqual(a.rgb.value, [255, 0, 0]);
    assert.equal(Math.round(a.a.value * 100), 50);
    const b = useColor("#00ff00");
    assert.deepEqual(b.rgb.value, [0, 255, 0]);
    assert.equal(b.a.value, 1);
    assert.equal(b.cssColor.value, "#00ff00");
    // A bare hex without # keeps working, as before.
    const c = useColor("0000ff");
    assert.deepEqual(c.rgb.value, [0, 0, 255]);
  },
);

await check(
  "useColor still falls back to its default on a value it cannot read",
  () => {
    for (const bad of ["transparent", "tomato", "nonsense", ""]) {
      const c = useColor(bad);
      assert.equal(c.a.value, 1, bad);
      assert.deepEqual(c.rgb.value, [255, 0, 0], bad);
    }
  },
);

await check(
  "setFromColor sets the alpha too; setFromHex leaves it alone",
  () => {
    const c = useColor("#336699");
    c.a.value = 0.4;
    assert.equal(c.setFromHex("#ff0000"), true);
    assert.equal(c.a.value, 0.4);
    assert.equal(c.setFromColor("#00ff00"), true);
    assert.equal(c.a.value, 1);
    assert.equal(c.setFromColor("rgba(1, 2, 3, 0.25)"), true);
    assert.deepEqual(c.rgb.value, [1, 2, 3]);
    assert.equal(c.a.value, 0.25);
    assert.equal(c.setFromColor("nope"), false);
    assert.equal(c.a.value, 0.25);
  },
);

await check(
  "a colour written by the picker is read back by the picker, unchanged",
  () => {
    for (const css of [
      "#336699",
      "rgba(51, 102, 153, 0.35)",
      "rgba(0, 0, 0, 0.15)",
      "#000000",
    ]) {
      const c = useColor(css);
      assert.equal(c.cssColor.value, css, css);
      // And the shadow keeps it as it is.
      assert.equal(normalizeShadowColor(c.cssColor.value), css, css);
    }
  },
);

// ─── Result ───────────────────────────────────────────────────────────────────

if (failed > 0) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll box shadow checks passed.");
