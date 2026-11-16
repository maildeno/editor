/**
 * check-saved-row-preview.ts
 *
 * Checks the thumbnails of the Saved Rows panel: the components that draw a
 * saved row from its stored form (RowPreview for the top-level row,
 * RowPreviewRow for a nested one, RowPreviewChildren and
 * RowPreviewLegacyComponent for what a column holds).
 *
 *   1. how deep a thumbnail goes: every level the canvas shows is shown, and
 *      it stops where the canvas stops, at the same level, for a row saved
 *      with `children` and for one saved with the older `components`
 *   2. shadows: a row, a column, an image and a button show theirs, an image
 *      never inset, and nothing else gets one
 *   3. the overflow clip: a row or column keeps it unless a shadow inside it
 *      would be cut off and no rounded corner needs it (clipsOverflow), the
 *      rule of the canvas and of the exports, at every level
 *   4. boxShadowReach, which the panel uses to leave room around a row that
 *      has a shadow of its own
 *
 * No browser. The real components are loaded through Vite's SSR loader and
 * rendered to HTML with Vue's server renderer, and the HTML is read back with
 * jsdom. What does need a browser is the frame around a thumbnail
 * (SavedRowsPanel: the room it leaves for a shadow of the row, its scale and
 * its height): run apps/playground, open the Layout tab and Saved Rows, with a
 * saved row that has a shadow, one nested more than three levels deep and one
 * with rounded corners.
 *
 *   cd packages/editor
 *   npx tsx scripts/check-saved-row-preview.ts
 */

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import {
  BOX_SHADOW_LIMITS,
  boxShadowReach,
  boxShadowValue,
  clipsOverflow,
} from "../src/composables/emailBuilder/core/boxShadow";

// ─── Tiny harness ─────────────────────────────────────────────────────────────

let failed = 0;
const check = async (
  name: string,
  fn: () => void | string | Promise<void | string>,
) => {
  try {
    const note = await fn();
    console.log(`PASS  ${name}${note ? `  (${note})` : ""}`);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      `FAIL  ${name}\n      ${message.split("\n").slice(0, 14).join("\n      ")}`,
    );
  }
};

// ─── The real components, rendered to HTML ────────────────────────────────────

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({
  root,
  configFile: false,
  logLevel: "silent",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [vue()],
  resolve: { alias: { "@": resolve(root, "src") } },
  optimizeDeps: { noDiscovery: true, include: [] },
});

const loadModule = async (url: string): Promise<any> => {
  const s = server as any;
  return typeof s.ssrLoadModule === "function"
    ? s.ssrLoadModule(url)
    : s.environments.ssr.runner.import(url);
};

// One document to read every rendering back in.
const doc = new JSDOM("<!doctype html><body></body>").window.document;

type Node = Record<string, any>;
type Style = Record<string, string>;

/** The style attribute as a map, kebab-case names. Values may hold `;` in url(). */
const styleOf = (el: Element): Style => {
  const src = el.getAttribute("style") ?? "";
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(src.slice(start));
  const out: Style = {};
  for (const part of parts) {
    const at = part.indexOf(":");
    if (at > 0)
      out[part.slice(0, at).trim().toLowerCase()] = part.slice(at + 1).trim();
  }
  return out;
};

const kids = (el: Element): Element[] => [...el.children];
const columnsOf = (rowEl: Element): Element[] =>
  kids(rowEl).filter((c) => c.classList.contains("shrink-0"));
const clips = (el: Element): boolean => styleOf(el).overflow === "hidden";
const shadowOf = (el: Element | null | undefined): string =>
  el ? (styleOf(el)["box-shadow"] ?? "") : "";
const everyElement = (el: Element): Element[] => [
  el,
  ...el.querySelectorAll("*"),
];

/** A row box: a thumbnail's top-level row or a nested one. */
const isRowBox = (el: Element): boolean => {
  const s = styleOf(el);
  return s["flex-direction"] === "row" && s["align-items"] === "stretch";
};
/** What a row that is too deep leaves in place of each thing it holds. */
const isGap = (el: Element): boolean => {
  const s = styleOf(el);
  return s.height === "4px" && s.width === "100%" && el.children.length === 0;
};
const gapsIn = (el: Element): number => everyElement(el).filter(isGap).length;
const rowsIn = (el: Element): number =>
  everyElement(el).filter(isRowBox).length;
/** The text of every element that holds text directly, in document order. */
const textsIn = (el: Element): string[] =>
  everyElement(el)
    .filter((e) => e.children.length === 0)
    .map((e) => (e.textContent ?? "").trim())
    .filter(Boolean);
/** The heights of the spacers that are drawn (not the gap of a too-deep row). */
const spacerHeightsIn = (el: Element): string[] =>
  everyElement(el)
    .filter((e) => styleOf(e)["flex-shrink"] === "0" && e.children.length === 0)
    .map((e) => styleOf(e).height);

const fragment = (html: string): Element => {
  const holder = doc.createElement("div");
  holder.innerHTML = html;
  const first = holder.firstElementChild;
  assert.ok(first, "the component drew nothing");
  return first;
};

const { default: RowPreview } = await loadModule(
  "/src/components/features/emailBuilder/product/RowPreview.vue",
);
const { default: RowPreviewRow } = await loadModule(
  "/src/components/features/emailBuilder/product/RowPreviewRow.vue",
);

/** A top-level row's thumbnail, as the panel draws it. */
const renderTop = async (row: Node): Promise<Element> =>
  fragment(await renderToString(createSSRApp(RowPreview, { row })));
/** A nested row's thumbnail: `depth` is 1 for a row in a top-level row's column. */
const renderNested = async (row: Node, depth = 1): Promise<Element> =>
  fragment(await renderToString(createSSRApp(RowPreviewRow, { row, depth })));

// ─── Rows to draw ─────────────────────────────────────────────────────────────

const sides = (n: number) => ({ top: n, right: n, bottom: n, left: n });
const border = (radius: unknown = 0, width = 0) => ({
  width,
  style: "solid",
  color: "#333333",
  radius,
});
const shadow = (over: Node = {}): Node => ({
  enabled: true,
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
  color: "rgba(0, 0, 0, 0.15)",
  inset: false,
  ...over,
});

const text = (id: string, content: string, extra: Node = {}): Node => ({
  id,
  type: "component",
  componentType: "paragraph",
  props: { content, ...extra },
});
const button = (id: string, label: string, props: Node = {}): Node => ({
  id,
  type: "component",
  componentType: "button",
  props: { text: label, ...props },
});
const GIF =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const image = (id: string, props: Node = {}): Node => ({
  id,
  type: "component",
  componentType: "image",
  props: { src: GIF, alt: id, ...props },
});
const spacer = (id: string, height: number): Node => ({
  id,
  type: "row-spacer",
  height,
});
const column = (id: string, children: Node[], extra: Node = {}): Node => ({
  id,
  width: 100,
  padding: sides(10),
  border: border(),
  children,
  ...extra,
});
const row = (id: string, columns: Node[], extra: Node = {}): Node => ({
  id,
  type: "row",
  padding: sides(0),
  border: border(),
  columns,
  ...extra,
});

/** A row at each level from 0 down to `levels`, each holding "L<level>", a spacer and the next. */
const chain = (levels: number, legacy = false): Node => {
  const level = (d: number): Node => {
    const own = legacy
      ? { id: `t${d}`, type: "paragraph", props: { content: `L${d}` } }
      : text(`t${d}`, `L${d}`);
    const inside = [own, spacer(`s${d}`, 20 + d)];
    if (d < levels) inside.push(level(d + 1));
    return row(`r${d}`, [
      legacy
        ? { ...column(`c${d}`, []), children: undefined, components: inside }
        : column(`c${d}`, inside),
    ]);
  };
  return level(0);
};

// ─── 1. Depth ─────────────────────────────────────────────────────────────────
//
// The canvas draws a top-level row at depth 0 and hands each nested row one
// more. What a row holds is drawn while the row's depth is below 5, so a row at
// 4 shows its content, a row at 5 is drawn but holds nothing (the canvas shows
// a notice in place of each child, the thumbnail a 4px gap), and a row at 6 is
// never drawn.

const levelsShown = (texts: string[]) =>
  texts.filter((t) => /^L\d+$/.test(t)).map((t) => Number(t.slice(1)));

await check(
  "depth: a row nested seven levels deep shows levels 0-4, draws row 5, stops there",
  async () => {
    const el = await renderTop(chain(7));
    assert.deepEqual(levelsShown(textsIn(el)), [0, 1, 2, 3, 4]);
    assert.equal(rowsIn(el), 6, "the top-level row and nested rows 1-5");
    // What row 5 holds (its text, its spacer, row 6) is three gaps.
    assert.equal(gapsIn(el), 3);
    assert.deepEqual(spacerHeightsIn(el), [
      "20px",
      "21px",
      "22px",
      "23px",
      "24px",
    ]);
  },
);

for (const [levels, shown] of [
  [0, [0]],
  [1, [0, 1]],
  [2, [0, 1, 2]],
  [3, [0, 1, 2, 3]],
  [4, [0, 1, 2, 3, 4]],
  [5, [0, 1, 2, 3, 4]],
] as const) {
  await check(
    `depth: a chain of ${levels} nested row${levels === 1 ? "" : "s"} shows levels ${shown.join(", ")}`,
    async () => {
      const el = await renderTop(chain(levels));
      assert.deepEqual(levelsShown(textsIn(el)), [...shown]);
      assert.equal(rowsIn(el), levels + 1, "every row in the chain is drawn");
      // Only row 5 holds anything that is left out: its text and its spacer.
      assert.equal(gapsIn(el), levels === 5 ? 2 : 0);
    },
  );
}

await check(
  "depth: a row saved with `components` (the older shape) goes as deep",
  async () => {
    const el = await renderTop(chain(7, true));
    assert.deepEqual(levelsShown(textsIn(el)), [0, 1, 2, 3, 4]);
    assert.equal(rowsIn(el), 6);
  },
);

await check(
  "depth: two columns at the third level both show what they hold, and what is inside them",
  async () => {
    const deep = row("n3", [
      column(
        "n3a",
        [text("ta", "A3"), row("n4a", [column("n4ac", [text("tb", "A4")])])],
        { width: 50 },
      ),
      column("n3b", [text("tc", "B3"), button("bb", "B3 button")], {
        width: 50,
      }),
    ]);
    const top = row("n0", [
      column("n0c", [
        text("t0", "T0"),
        row("n1", [column("n1c", [row("n2", [column("n2c", [deep])])])]),
      ]),
    ]);
    const el = await renderTop(top);
    assert.deepEqual(textsIn(el), ["T0", "A3", "A4", "B3", "B3 button"]);
    assert.equal(
      rowsIn(el),
      5,
      "the top-level row, rows 1 to 3 and row 4 in column A",
    );
    assert.equal(gapsIn(el), 0);
  },
);

await check(
  "depth: a spacer is drawn down to row 4 and is a gap below",
  async () => {
    const el = await renderTop(chain(6));
    // Spacers sit at every level; rows 0-4 draw theirs, row 5's is a gap.
    assert.deepEqual(spacerHeightsIn(el), [
      "20px",
      "21px",
      "22px",
      "23px",
      "24px",
    ]);
  },
);

await check(
  "depth: a nested row drawn on its own follows its `depth` prop",
  async () => {
    const one = row("x", [
      column("xc", [
        text("xt", "inside"),
        row("y", [column("yc", [text("yt", "below")])]),
      ]),
    ]);
    // At 4 it shows what it holds, and the row in it (at 5) is drawn without its content.
    const at4 = await renderNested(one, 4);
    assert.deepEqual(textsIn(at4), ["inside"]);
    assert.equal(rowsIn(at4), 2);
    assert.equal(gapsIn(at4), 1);
    // At 5 it is drawn and holds nothing: a gap for each of its two children.
    const at5 = await renderNested(one, 5);
    assert.deepEqual(textsIn(at5), []);
    assert.equal(gapsIn(at5), 2);
    // The default is the first level.
    const dflt = fragment(
      await renderToString(createSSRApp(RowPreviewRow, { row: one })),
    );
    assert.deepEqual(textsIn(dflt), ["inside", "below"]);
  },
);

// ─── 2. Shadows ───────────────────────────────────────────────────────────────

const ROW_SHADOW = "0px 8px 24px 0px rgba(0, 0, 0, 0.25)";
const COL_SHADOW = "2px 2px 6px 1px rgba(0, 0, 0, 0.15)";
const IMAGE_SHADOW = "0px 3px 5px 0px rgba(0, 0, 0, 0.15)";
const BUTTON_SHADOW = "inset 0px 2px 4px 0px rgba(0, 0, 0, 0.15)";
const NESTED_ROW_SHADOW = "0px 0px 0px 3px rgba(255, 0, 0, 0.5)";
const NESTED_COL_SHADOW = "0px 4px 8px 0px rgba(0, 0, 0, 0.15)";

const textOf = (scope: Element, label: string): Element => {
  const found = everyElement(scope).find(
    (e) => e.children.length === 0 && (e.textContent ?? "").trim() === label,
  );
  assert.ok(found, `no element with the text "${label}"`);
  return found;
};

const shadowed = (): Node =>
  row(
    "r",
    [
      column(
        "c",
        [
          image("img", {
            boxShadow: shadow({ inset: true, offsetY: 3, blur: 5 }),
          }),
          button("btn", "Inset button", {
            boxShadow: shadow({ inset: true, blur: 4, offsetY: 2 }),
          }),
          text("txt", "Text", { boxShadow: shadow() }),
          row(
            "nr",
            [
              column(
                "nc",
                [
                  button("off", "Off", {
                    boxShadow: shadow({ enabled: false }),
                  }),
                  button("zero", "Zero", {
                    boxShadow: shadow({ offsetY: 0, blur: 0, spread: 0 }),
                  }),
                  button("clear", "Clear", {
                    boxShadow: shadow({ color: "rgba(0, 0, 0, 0)" }),
                  }),
                  button("junk", "Junk", { boxShadow: "nope" }),
                  button("none", "None"),
                ],
                { boxShadow: shadow({ blur: 8 }) },
              ),
            ],
            {
              boxShadow: shadow({
                offsetY: 0,
                blur: 0,
                spread: 3,
                color: "rgba(255, 0, 0, 0.5)",
              }),
            },
          ),
        ],
        { boxShadow: shadow({ offsetX: 2, offsetY: 2, blur: 6, spread: 1 }) },
      ),
    ],
    {
      boxShadow: shadow({ offsetY: 8, blur: 24, color: "rgba(0, 0, 0, 0.25)" }),
    },
  );

await check(
  "shadows: a top-level row, its column, a nested row and its column show theirs",
  async () => {
    const el = await renderTop(shadowed());
    assert.equal(shadowOf(el), ROW_SHADOW);
    const [col] = columnsOf(el);
    assert.equal(shadowOf(col), COL_SHADOW);
    const nestedRow = kids(col).find(isRowBox);
    assert.ok(nestedRow, "the nested row is drawn");
    assert.equal(shadowOf(nestedRow), NESTED_ROW_SHADOW);
    assert.equal(shadowOf(columnsOf(nestedRow)[0]), NESTED_COL_SHADOW);
  },
);

await check(
  "shadows: an image shows its shadow, drawn outside even when it was saved inset",
  async () => {
    const el = await renderTop(shadowed());
    assert.equal(shadowOf(el.querySelector("img")), IMAGE_SHADOW);
  },
);

await check("shadows: a button shows its shadow, inset kept", async () => {
  const el = await renderTop(shadowed());
  assert.equal(shadowOf(textOf(el, "Inset button")), BUTTON_SHADOW);
});

await check(
  "shadows: a shadow that is off, empty, clear or unreadable draws nothing, and neither does text",
  async () => {
    const el = await renderTop(shadowed());
    for (const label of ["Off", "Zero", "Clear", "Junk", "None", "Text"]) {
      assert.equal(shadowOf(textOf(el, label)), "", label);
      // The shadow is on the element that holds the label or on a wrapper around it.
      let up: Element | null = textOf(el, label);
      while (up && up !== el) {
        assert.equal(shadowOf(up), up === el ? ROW_SHADOW : shadowOf(up));
        up = up.parentElement;
      }
    }
    // Six shadows in all: the row, a column, an image, a button, a nested row and its column.
    const drawn = everyElement(el).filter((e) => shadowOf(e));
    assert.deepEqual(
      drawn.map(shadowOf).sort(),
      [
        BUTTON_SHADOW,
        COL_SHADOW,
        IMAGE_SHADOW,
        NESTED_COL_SHADOW,
        NESTED_ROW_SHADOW,
        ROW_SHADOW,
      ].sort(),
    );
  },
);

await check(
  "shadows: a nested row drawn on its own shows the same shadows",
  async () => {
    const nested = fragment(
      await renderToString(
        createSSRApp(RowPreviewRow, { row: shadowed(), depth: 1 }),
      ),
    );
    assert.equal(shadowOf(nested), ROW_SHADOW);
    assert.equal(shadowOf(columnsOf(nested)[0]), COL_SHADOW);
  },
);

await check(
  "shadows: a row saved without any shadow draws no box-shadow at all",
  async () => {
    const plain = row("p", [
      column("pc", [
        text("pt", "Plain"),
        button("pb", "Plain button"),
        image("pi"),
      ]),
    ]);
    const html = await renderToString(createSSRApp(RowPreview, { row: plain }));
    assert.ok(!html.includes("box-shadow"), "no box-shadow in the markup");
  },
);

// ─── 3. The overflow clip ─────────────────────────────────────────────────────

const shadowButton = () => button("sb", "Shadow", { boxShadow: shadow() });
const shadowImage = () => image("si", { boxShadow: shadow() });

interface ClipCase {
  name: string;
  rowExtra?: Node;
  colExtra?: Node;
  inside: () => Node[];
  row: boolean;
  col: boolean;
}

const CLIP_CASES: ClipCase[] = [
  {
    name: "nothing has a shadow: the row and the column clip",
    inside: () => [text("t", "Text")],
    row: true,
    col: true,
  },
  {
    name: "a button with a shadow in a square column: neither clips, the shadow would be cut",
    inside: () => [shadowButton()],
    row: false,
    col: false,
  },
  {
    name: "an image with a shadow, the same",
    inside: () => [shadowImage()],
    row: false,
    col: false,
  },
  {
    name: "a column rounded 12 with no padding keeps its clip, the row does not",
    colExtra: { border: border(12), padding: sides(0) },
    inside: () => [shadowButton()],
    row: false,
    col: true,
  },
  {
    name: "a column rounded 12 with padding 20 is clear of its curve: no clip",
    colExtra: { border: border(12), padding: sides(20) },
    inside: () => [shadowButton()],
    row: false,
    col: false,
  },
  {
    name: "a row rounded 16 with no padding keeps its clip, its square column does not",
    rowExtra: { border: border(16), padding: sides(0) },
    colExtra: { padding: sides(0) },
    inside: () => [shadowButton()],
    row: true,
    col: false,
  },
  {
    name: "rounded at the bottom only, with padding clear of both corners: no clip",
    colExtra: {
      border: border({
        topLeft: 0,
        topRight: 0,
        bottomRight: 20,
        bottomLeft: 20,
      }),
      padding: { top: 0, right: 30, bottom: 30, left: 30 },
    },
    inside: () => [shadowButton()],
    row: false,
    col: false,
  },
  {
    name: "rounded at the bottom only, with no padding: a corner is reached, clip",
    colExtra: {
      border: border({
        topLeft: 0,
        topRight: 0,
        bottomRight: 20,
        bottomLeft: 20,
      }),
      padding: sides(0),
    },
    inside: () => [shadowButton()],
    row: false,
    col: true,
  },
  {
    name: "rounded only on mobile: the clip is one declaration, so it stays",
    colExtra: {
      border: border(0),
      padding: sides(0),
      mobile: { border: { radius: 12 } },
    },
    inside: () => [shadowButton()],
    row: false,
    col: true,
  },
  {
    name: "a column's own shadow is not clipped by its own overflow, but the row clipping it would cut it",
    colExtra: { boxShadow: shadow() },
    inside: () => [text("t", "Text")],
    row: false,
    col: true,
  },
  {
    name: "a row's own shadow does not stop it clipping",
    rowExtra: { boxShadow: shadow() },
    inside: () => [text("t", "Text")],
    row: true,
    col: true,
  },
];

for (const c of CLIP_CASES) {
  const build = () =>
    row("r", [column("c", c.inside(), c.colExtra)], c.rowExtra);
  await check(`clip (top-level row): ${c.name}`, async () => {
    const el = await renderTop(build());
    assert.equal(clips(el), c.row, "row");
    assert.equal(clips(columnsOf(el)[0]), c.col, "column");
  });
  await check(`clip (nested row): ${c.name}`, async () => {
    const el = await renderNested(build());
    assert.equal(clips(el), c.row, "row");
    assert.equal(clips(columnsOf(el)[0]), c.col, "column");
  });
}

await check(
  "clip: the shadow of a nested row stops the clip of what holds it, not its own",
  async () => {
    const el = await renderTop(
      row("r", [
        column("c", [
          row("n", [column("nc", [text("t", "Text")])], {
            boxShadow: shadow(),
          }),
        ]),
      ]),
    );
    const [col] = columnsOf(el);
    const nested = kids(col)[0];
    assert.equal(clips(el), false, "top-level row");
    assert.equal(clips(col), false, "its column");
    assert.equal(clips(nested), true, "the nested row keeps its own clip");
    assert.equal(clips(columnsOf(nested)[0]), true, "and so does its column");
  },
);

await check(
  "clip: the clip is the inline style alone, no class that would force it",
  async () => {
    const el = await renderTop(
      row("r", [
        column("c", [
          shadowButton(),
          row("n", [column("nc", [shadowButton()])]),
        ]),
      ]),
    );
    const boxes = everyElement(el).filter(
      (e) => e === el || isRowBox(e) || e.classList.contains("shrink-0"),
    );
    assert.equal(
      boxes.length,
      4,
      "a row and a column, and a nested row and a column",
    );
    for (const box of boxes) {
      assert.ok(
        !box.classList.contains("overflow-hidden"),
        `a row or column has the class overflow-hidden: ${box.getAttribute("class")}`,
      );
      assert.equal(clips(box), false);
    }
  },
);

// A seeded random matrix: rows of one to four columns, nested up to three
// levels, with shadows, radii, per-corner radii and mobile overrides at random.
// Every row and column is compared with the rule, and every shadow with its value.

let seed = 20240607;
const rand = (n: number): number => {
  seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
  return (seed >>> 12) % n;
};
const pick = <T>(list: readonly T[]): T => list[rand(list.length)];

const randomShadow = (): Node | undefined => {
  if (rand(2) === 0) return undefined;
  return shadow({
    enabled: rand(6) !== 0,
    offsetX: pick([0, 0, 4, -6]),
    offsetY: pick([0, 2, 8]),
    blur: pick([0, 6, 20]),
    spread: pick([0, 0, 3, -2]),
    inset: rand(5) === 0,
  });
};
const randomRadius = (): unknown =>
  pick([
    0,
    0,
    10,
    24,
    { topLeft: 20, topRight: 0, bottomRight: 0, bottomLeft: 20 },
    { topLeft: 0, topRight: 16, bottomRight: 16, bottomLeft: 0 },
  ]);
const randomSides = () => ({
  top: pick([0, 8, 24, 40]),
  right: pick([0, 8, 24, 40]),
  bottom: pick([0, 8, 24, 40]),
  left: pick([0, 8, 24, 40]),
});
const randomMobile = (): Node | undefined =>
  rand(4) === 0
    ? {
        border: { radius: pick([0, 12, 30]) },
        padding: { top: pick([0, 20]) },
      }
    : undefined;

const randomLeaf = (id: string): Node => {
  const kind = rand(4);
  if (kind === 0) return text(id, `T ${id}`);
  if (kind === 1) return spacer(id, pick([8, 16]));
  if (kind === 2) return image(id, { boxShadow: randomShadow() });
  return button(id, `B ${id}`, { boxShadow: randomShadow() });
};

const randomRow = (id: string, level: number): Node => {
  const widths = pick([[100], [50, 50], [33, 33, 34], [25, 25, 25, 25]]);
  return row(
    id,
    widths.map((w, i) => {
      const inside: Node[] = [];
      const count = 1 + rand(3);
      for (let k = 0; k < count; k++)
        inside.push(randomLeaf(`${id}-${i}-${k}`));
      if (level < 3 && rand(3) === 0)
        inside.push(randomRow(`${id}-${i}-n`, level + 1));
      return column(`${id}-c${i}`, inside, {
        width: w,
        padding: randomSides(),
        border: border(randomRadius(), pick([0, 0, 2])),
        boxShadow: randomShadow(),
        mobile: randomMobile(),
      });
    }),
    {
      padding: randomSides(),
      border: border(randomRadius(), pick([0, 0, 2])),
      boxShadow: randomShadow(),
      mobile: randomMobile(),
    },
  );
};

await check(
  "matrix: every row and column clips as clipsOverflow says, and shows its shadow",
  async () => {
    const tally = {
      rows: 0,
      columns: 0,
      clipping: 0,
      notClipping: 0,
      shadows: 0,
    };
    const walk = (node: Node, el: Element, path: string) => {
      const where = `${path} (row ${node.id})`;
      assert.equal(clips(el), clipsOverflow(node), `${where}: clip`);
      assert.equal(
        shadowOf(el),
        boxShadowValue(node.boxShadow),
        `${where}: shadow`,
      );
      assert.ok(!el.classList.contains("overflow-hidden"), `${where}: class`);
      tally.rows++;
      tally.shadows += shadowOf(el) ? 1 : 0;
      clipsOverflow(node) ? tally.clipping++ : tally.notClipping++;
      const cols = columnsOf(el);
      assert.equal(cols.length, node.columns.length, `${where}: columns`);
      node.columns.forEach((col: Node, i: number) => {
        const colEl = cols[i];
        const here = `${where} > column ${i}`;
        assert.equal(clips(colEl), clipsOverflow(col), `${here}: clip`);
        assert.equal(
          shadowOf(colEl),
          boxShadowValue(col.boxShadow),
          `${here}: shadow`,
        );
        assert.ok(
          !colEl.classList.contains("overflow-hidden"),
          `${here}: class`,
        );
        tally.columns++;
        tally.shadows += shadowOf(colEl) ? 1 : 0;
        clipsOverflow(col) ? tally.clipping++ : tally.notClipping++;
        const childEls = kids(colEl);
        assert.equal(childEls.length, col.children.length, `${here}: children`);
        col.children.forEach((child: Node, j: number) => {
          const childEl = childEls[j];
          if (child.type === "row")
            return walk(child, childEl, `${here} > ${j}`);
          if (child.type === "row-spacer") return;
          const props = child.props ?? {};
          if (child.componentType === "image") {
            const img = childEl.querySelector("img");
            const expected = boxShadowValue(props.boxShadow, {
              allowInset: false,
            });
            assert.equal(shadowOf(img), expected, `${here} > image: shadow`);
            tally.shadows += expected ? 1 : 0;
          } else if (child.componentType === "button") {
            const label = childEl.querySelector("span");
            const expected = boxShadowValue(props.boxShadow);
            assert.equal(shadowOf(label), expected, `${here} > button: shadow`);
            tally.shadows += expected ? 1 : 0;
          } else {
            assert.ok(
              !everyElement(childEl).some((e) => shadowOf(e)),
              `${here} > text: no shadow`,
            );
          }
        });
      });
    };
    const N = 150;
    for (let i = 0; i < N; i++) {
      const node = randomRow(`m${i}`, 0);
      walk(node, await renderTop(node), `matrix ${i}`);
    }
    assert.ok(
      tally.clipping > 100 && tally.notClipping > 100,
      "the matrix covers both outcomes",
    );
    assert.ok(tally.shadows > 300, "and plenty of shadows");
    return `${N} rows, ${tally.rows} rows and ${tally.columns} columns judged: ${tally.clipping} clip, ${tally.notClipping} do not; ${tally.shadows} shadows`;
  },
);

// ─── 4. boxShadowReach ────────────────────────────────────────────────────────

const reach = (over: Node): number => boxShadowReach(shadow(over));

await check("reach: nothing that is not drawn reaches anywhere", () => {
  for (const raw of [
    undefined,
    null,
    "",
    "nope",
    5,
    [],
    {},
    { enabled: false },
  ]) {
    assert.equal(boxShadowReach(raw), 0, JSON.stringify(raw));
  }
  assert.equal(reach({ enabled: false }), 0, "off");
  assert.equal(
    reach({ offsetX: 0, offsetY: 0, blur: 0, spread: 0 }),
    0,
    "no size",
  );
  assert.equal(reach({ color: "rgba(0, 0, 0, 0)" }), 0, "clear");
  assert.equal(reach({ color: "transparent" }), 0, "transparent");
  assert.equal(
    reach({ inset: true, blur: 30 }),
    0,
    "inset stays inside the box",
  );
});

await check("reach: the largest of the four sides, rounded up", () => {
  assert.equal(
    reach({ offsetX: 0, offsetY: 4, blur: 12, spread: 0 }),
    16,
    "the default: 12 of blur, 4 more below",
  );
  assert.equal(
    reach({ offsetX: 0, offsetY: 0, blur: 10, spread: 5 }),
    15,
    "spread and blur add",
  );
  assert.equal(
    reach({ offsetX: 6, offsetY: 0, blur: 0, spread: 0 }),
    6,
    "a hard shadow moved right",
  );
  assert.equal(
    reach({ offsetX: -8, offsetY: 0, blur: 4, spread: 0 }),
    12,
    "moved left: 4 + 8 on the left",
  );
  assert.equal(
    reach({ offsetX: 0, offsetY: -10, blur: 0, spread: 2 }),
    12,
    "moved up",
  );
  assert.equal(
    reach({ offsetX: 0, offsetY: 10, blur: 20, spread: -10 }),
    20,
    "a negative spread still reaches below",
  );
  assert.equal(
    reach({ offsetX: 0, offsetY: 0, blur: 2.2, spread: 0 }),
    3,
    "rounded up, not to the nearest",
  );
  assert.equal(
    reach({ offsetX: 0, offsetY: 0, blur: 2.5, spread: 0.2 }),
    3,
    "also when it is nearly the next",
  );
});

await check(
  "reach: a shadow that is smaller than its box and not moved far does not stick out",
  () => {
    assert.equal(reach({ offsetX: 0, offsetY: 0, blur: 0, spread: -5 }), 0);
    assert.equal(reach({ offsetX: 2, offsetY: 2, blur: 0, spread: -5 }), 0);
  },
);

await check("reach: it is capped by the limits of the fields", () => {
  const { offset, blur, spread } = BOX_SHADOW_LIMITS;
  const most = offset.max + blur.max + spread.max;
  assert.equal(
    reach({
      offsetX: offset.max,
      offsetY: offset.max,
      blur: blur.max,
      spread: spread.max,
    }),
    most,
  );
  assert.equal(
    reach({ offsetX: 9999, offsetY: 9999, blur: 9999, spread: 9999 }),
    most,
    "clamped like the stored value",
  );
});

await check(
  "reach: it is positive exactly when an outer shadow is drawn beyond the box",
  () => {
    let positive = 0;
    for (let i = 0; i < 2000; i++) {
      const s = shadow({
        enabled: rand(8) !== 0,
        offsetX: rand(61) - 30,
        offsetY: rand(61) - 30,
        blur: rand(41),
        spread: rand(41) - 20,
        inset: rand(6) === 0,
        color: pick(["rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0)", "#112233"]),
      });
      const r = boxShadowReach(s);
      const css = boxShadowValue(s);
      // The farthest an outer shadow gets from the box, side by side.
      const edge = s.spread + s.blur;
      const sidesOut = [
        edge + s.offsetX,
        edge - s.offsetX,
        edge + s.offsetY,
        edge - s.offsetY,
      ];
      const sticksOut = css !== "" && !s.inset && Math.max(...sidesOut) > 0;
      assert.equal(r > 0, sticksOut, JSON.stringify(s));
      if (sticksOut) {
        positive++;
        assert.ok(
          r >= Math.max(...sidesOut) && r < Math.max(...sidesOut) + 1,
          JSON.stringify(s),
        );
      }
    }
    assert.ok(positive > 500);
    return `${positive} of 2000 random shadows stick out`;
  },
);

// ─── Result ───────────────────────────────────────────────────────────────────

await server.close();

if (failed > 0) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
