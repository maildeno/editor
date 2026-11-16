/**
 * check-border-radius.ts
 *
 * Checks the corner radius of rows, columns, images, videos and buttons, with
 * one number for all four corners or one per corner, from the stored value to
 * the exported email:
 *
 *   1. the radius model (core/borderRadius): reading a stored value, comparing
 *      two, the saved form of a value, and the CSS it becomes
 *   2. the clipping rule (core/boxShadow): a rounded row or column keeps its
 *      overflow clip unless a shadow inside needs the room, and each corner is
 *      judged against its own radius
 *   3. save and load (optimizeRows, hydrateRows): a per-corner radius survives
 *      and a round trip is stable, and a plain number is saved as it always was
 *   4. the HTML, MJML and React Email exports, and the mobile CSS, run through
 *      the real export engine (scripts/lib/headless-export.ts)
 *   5. the editing logic of the Row and Column panels (useNodeStyleEditor) and
 *      of the component panels (useComponentStyleEditor), for a radius
 *   6. the Preview screen's client simulation (transformForClient)
 *
 * The control itself (PropertyBorderRadius.vue) and the panels need a browser:
 * run apps/playground and open the Layout section of a Button, Image or Video,
 * and the Border section of a Row or Column, in Desktop and in Mobile.
 *
 * No browser and no Vue app. useEmailBuilder, which would inject the shared
 * editor instance, is swapped for a stub that records the history commits
 * (lib/builder-stub-hooks.mjs).
 *
 *   cd packages/editor
 *   npx tsx scripts/check-border-radius.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import { computed, reactive, ref } from "vue";
import { exportTemplate } from "./lib/headless-export";
import {
  BORDER_RADIUS_CORNERS,
  BORDER_RADIUS_LIMITS,
  borderRadiusEquals,
  borderRadiusMobileRule,
  borderRadiusValue,
  cloneBorderRadius,
  hasBorderRadius,
  isUniformBorderRadius,
  normalizeBorderRadius,
  toStoredBorderRadius,
  uniformBorderRadius,
  withBorderRadiusCorner,
} from "../src/composables/emailBuilder/core/borderRadius";
import {
  clipsOverflow,
  cornersReachContent,
} from "../src/composables/emailBuilder/core/boxShadow";
import { hydrateRows } from "../src/composables/emailBuilder/transform/pipeline/hydrate";
import { optimizeRows } from "../src/composables/emailBuilder/transform/pipeline/optimize";
import { useClientPreview } from "../src/composables/emailBuilder/preview/useClientPreview";
import type { EditMode } from "../src/composables/emailBuilder/components/useComponentStyleEditor";

// The stub has to be in place before the editor modules are loaded.
register("./lib/builder-stub-hooks.mjs", import.meta.url);
const { useNodeStyleEditor } =
  await import("../src/composables/emailBuilder/components/useNodeStyleEditor");
const { useComponentStyleEditor } =
  await import("../src/composables/emailBuilder/components/useComponentStyleEditor");

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

// ─── History recorder ─────────────────────────────────────────────────────────

const g = globalThis as unknown as { __historyCalls?: unknown[][] };
const resetHistory = () => {
  g.__historyCalls = [];
};
/** The action names of the commits since the last reset. */
const commits = (): string[] =>
  (g.__historyCalls ?? []).map((c) => String(c[0]));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A radius with one value per corner, in CSS order. */
const c4 = (
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
) => ({ topLeft, topRight, bottomRight, bottomLeft });

const border = (width: number, radius: unknown, color = "#cc0000") => ({
  width,
  style: "solid",
  color,
  radius,
});

/** A shadow, switched on, for the clipping checks. */
const sh = (color: string) => ({
  enabled: true,
  offsetX: 0,
  offsetY: 6,
  blur: 16,
  spread: 0,
  color,
  inset: false,
});

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
const video = (id: string, props: object = {}) => ({
  id,
  type: "component",
  componentType: "video",
  props: { src: "https://example.com/v.mp4", alt: "v", ...props },
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

const canvas = { width: 600 };

/** The opening tags of `html` that contain `needle`. */
const tagsWith = (html: string, needle: string): string[] =>
  (html.match(/<[a-zA-Z][^>]*>/g) ?? []).filter((t) => t.includes(needle));

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

/** The mobile overrides block, up to the end of the <style> that holds it. */
const mobileCss = (html: string): string => {
  const start = html.indexOf("/* Mobile property overrides */");
  assert.ok(start >= 0, "mobile overrides block is present");
  return html.slice(start, html.indexOf("</style>", start));
};

/** The opening tag of the <table> that most closely precedes `needle`. */
const tableAround = (html: string, needle: string): string => {
  const at = html.indexOf(needle);
  assert.ok(at >= 0, `${needle} is in the email`);
  const tables = [...html.slice(0, at).matchAll(/<table\b[^>]*>/g)];
  assert.ok(tables.length > 0, "a table precedes it");
  return tables[tables.length - 1][0];
};

// ─── 1. The radius model ──────────────────────────────────────────────────────

await check("a number is the same radius on all four corners", () => {
  assert.deepEqual(normalizeBorderRadius(8), c4(8, 8, 8, 8));
  assert.deepEqual(normalizeBorderRadius(0), c4(0, 0, 0, 0));
  assert.deepEqual(normalizeBorderRadius(4.5), c4(4.5, 4.5, 4.5, 4.5));
  assert.deepEqual(normalizeBorderRadius("12"), c4(12, 12, 12, 12));
});

await check("an object is read corner by corner; a bad corner is 0", () => {
  assert.deepEqual(normalizeBorderRadius(c4(1, 2, 3, 4)), c4(1, 2, 3, 4));
  // A corner the object leaves out is square, not the fallback.
  assert.deepEqual(normalizeBorderRadius({ topLeft: 8 }, 4), c4(8, 0, 0, 0));
  assert.deepEqual(
    normalizeBorderRadius({
      topLeft: "6",
      topRight: -3,
      bottomRight: Number.NaN,
      bottomLeft: "wide",
    }),
    c4(6, 0, 0, 0),
  );
});

await check("anything that is not a radius is the fallback", () => {
  for (const raw of [
    undefined,
    null,
    "",
    "   ",
    "abc",
    "8px;}",
    Number.NaN,
    Infinity,
    [],
    [8],
    true,
    () => 1,
  ]) {
    assert.deepEqual(normalizeBorderRadius(raw), c4(0, 0, 0, 0), String(raw));
    assert.deepEqual(
      normalizeBorderRadius(raw, 4),
      c4(4, 4, 4, 4),
      String(raw),
    );
  }
  // 0 is a radius, not a missing one: it does not take the fallback.
  assert.deepEqual(normalizeBorderRadius(0, 4), c4(0, 0, 0, 0));
});

await check("a radius is never negative and never above 9999", () => {
  assert.deepEqual(normalizeBorderRadius(-5), c4(0, 0, 0, 0));
  assert.deepEqual(normalizeBorderRadius(1e308), c4(9999, 9999, 9999, 9999));
  // What the control cannot reach is still read as stored: a pill's 999 stays.
  assert.equal(BORDER_RADIUS_LIMITS.max, 100);
  assert.deepEqual(normalizeBorderRadius(999), c4(999, 999, 999, 999));
});

await check(
  "normalizeBorderRadius never returns the object it was given",
  () => {
    const given = c4(1, 2, 3, 4);
    const read = normalizeBorderRadius(given);
    assert.notEqual(read, given);
    read.topLeft = 99;
    assert.equal(given.topLeft, 1);
  },
);

await check("the corners are listed in CSS order", () => {
  assert.deepEqual(
    [...BORDER_RADIUS_CORNERS],
    ["topLeft", "topRight", "bottomRight", "bottomLeft"],
  );
});

await check("uniform and rounded are about the corners, not the form", () => {
  assert.equal(isUniformBorderRadius(8), true);
  assert.equal(isUniformBorderRadius(c4(8, 8, 8, 8)), true);
  assert.equal(isUniformBorderRadius(c4(8, 8, 8, 0)), false);
  assert.equal(isUniformBorderRadius(undefined), true);

  assert.equal(hasBorderRadius(0), false);
  assert.equal(hasBorderRadius(undefined), false);
  assert.equal(hasBorderRadius(c4(0, 0, 0, 0)), false);
  assert.equal(hasBorderRadius(-4), false);
  assert.equal(hasBorderRadius(1), true);
  assert.equal(hasBorderRadius(c4(0, 0, 0, 3)), true);
});

await check(
  "two radii are equal when they round the same corners alike",
  () => {
    assert.equal(borderRadiusEquals(8, c4(8, 8, 8, 8)), true);
    assert.equal(borderRadiusEquals(undefined, 0), true);
    assert.equal(borderRadiusEquals(c4(1, 2, 3, 4), c4(1, 2, 3, 4)), true);
    assert.equal(borderRadiusEquals(c4(1, 2, 3, 4), c4(1, 2, 4, 3)), false);
    assert.equal(borderRadiusEquals(8, 9), false);
    assert.equal(borderRadiusEquals(8, c4(8, 8, 8, 0)), false);
  },
);

await check("the saved form is a number when the corners are equal", () => {
  assert.equal(toStoredBorderRadius(8), 8);
  assert.equal(toStoredBorderRadius(c4(8, 8, 8, 8)), 8);
  assert.equal(toStoredBorderRadius(undefined), 0);
  assert.deepEqual(toStoredBorderRadius(c4(8, 8, 0, 0)), c4(8, 8, 0, 0));
  const given = c4(8, 8, 0, 0);
  assert.notEqual(toStoredBorderRadius(given), given);
});

await check(
  "withBorderRadiusCorner sets one corner and returns the saved form",
  () => {
    assert.deepEqual(
      withBorderRadiusCorner(8, "bottomLeft", 0),
      c4(8, 8, 8, 0),
    );
    assert.deepEqual(
      withBorderRadiusCorner(c4(8, 8, 8, 0), "topRight", 2),
      c4(8, 2, 8, 0),
    );
    // Making the four equal brings back the plain number.
    assert.equal(withBorderRadiusCorner(c4(8, 8, 8, 0), "bottomLeft", 8), 8);
    // A corner is read like any stored value.
    assert.deepEqual(withBorderRadiusCorner(4, "topLeft", -9), c4(0, 4, 4, 4));
  },
);

await check("uniformBorderRadius is a number, however it is asked", () => {
  assert.equal(uniformBorderRadius(12), 12);
  assert.equal(uniformBorderRadius(-1), 0);
  assert.equal(uniformBorderRadius(Number.NaN), 0);
});

await check(
  "borderRadiusValue is one length for equal corners, else four",
  () => {
    assert.equal(borderRadiusValue(8), "8px");
    assert.equal(borderRadiusValue(0), "0px");
    assert.equal(borderRadiusValue(4.5), "4.5px");
    assert.equal(borderRadiusValue(999), "999px");
    assert.equal(borderRadiusValue(c4(8, 8, 8, 8)), "8px");
    // CSS order: top left, top right, bottom right, bottom left.
    assert.equal(borderRadiusValue(c4(1, 2, 3, 4)), "1px 2px 3px 4px");
    assert.equal(borderRadiusValue(c4(12, 12, 0, 0)), "12px 12px 0px 0px");
    assert.equal(borderRadiusValue(undefined), "0px");
    assert.equal(borderRadiusValue(undefined, 4), "4px");
    assert.equal(borderRadiusValue(0, 4), "0px");
  },
);

await check(
  "borderRadiusMobileRule is the declaration of a media query",
  () => {
    assert.equal(borderRadiusMobileRule(6), "border-radius: 6px !important");
    assert.equal(
      borderRadiusMobileRule(c4(0, 6, 0, 6)),
      "border-radius: 0px 6px 0px 6px !important",
    );
  },
);

await check("cloneBorderRadius shares nothing with its source", () => {
  const given = c4(1, 2, 3, 4);
  const copy = cloneBorderRadius(given);
  assert.deepEqual(copy, given);
  assert.notEqual(copy, given);
  assert.equal(cloneBorderRadius(8), 8);
  assert.equal(cloneBorderRadius(undefined), undefined);
  assert.equal(cloneBorderRadius(null), null);
});

// ─── 2. The clipping rule ─────────────────────────────────────────────────────

await check("equal corners clip as they always did", () => {
  const pad = (n: number) => ({ top: n, right: n, bottom: n, left: n });
  // Square: nothing to protect.
  assert.equal(cornersReachContent(0, 0, pad(0)), false);
  // Content in the corner of a 20px curve.
  assert.equal(cornersReachContent(20, 0, pad(0)), true);
  assert.equal(cornersReachContent(20, 0, pad(5)), true);
  // Padding equal to the radius clears the corner; half of it is inside the arc.
  assert.equal(cornersReachContent(20, 0, pad(20)), false);
  assert.equal(cornersReachContent(20, 0, pad(10)), false);
  // The border width comes off the radius: 20 - 5 = 15.
  assert.equal(cornersReachContent(20, 5, pad(5)), false);
  assert.equal(cornersReachContent(20, 5, pad(2)), true);
  assert.equal(cornersReachContent(c4(20, 20, 20, 20), 5, pad(5)), false);
});

await check("each corner is judged against its own radius", () => {
  const top = { top: 20, right: 0, bottom: 0, left: 0 };
  // Rounded on top only: the padding clears both top corners and the bottom
  // corners are square, so nothing reaches a curve...
  assert.equal(cornersReachContent(c4(20, 20, 0, 0), 0, top), false);
  // ...where the same padding under a curve on all four corners leaves the
  // bottom ones reached.
  assert.equal(cornersReachContent(20, 0, top), true);
  // One rounded corner is enough when nothing clears it.
  assert.equal(cornersReachContent(c4(0, 0, 0, 20), 0, top), true);
  assert.equal(
    cornersReachContent(c4(0, 0, 0, 20), 0, { ...top, left: 20 }),
    false,
  );
  // A corner pairs with the two paddings that meet there.
  const wide = { top: 0, right: 0, bottom: 0, left: 30 };
  assert.equal(cornersReachContent(c4(20, 0, 0, 0), 0, wide), false);
  assert.equal(cornersReachContent(c4(0, 20, 0, 0), 0, wide), true);
  // The border width comes off each corner's own radius.
  assert.equal(cornersReachContent(c4(12, 30, 0, 0), 10, top), false);
  assert.equal(
    cornersReachContent(c4(12, 30, 0, 0), 10, { ...top, top: 0 }),
    true,
  );
});

await check(
  "clipsOverflow reads a per-corner radius, on desktop and on mobile",
  () => {
    const holder = (radius: unknown, mobileRadius?: unknown) => ({
      border: { width: 0, radius },
      padding: { top: 20, right: 0, bottom: 0, left: 0 },
      ...(mobileRadius !== undefined
        ? { mobile: { border: { width: 0, radius: mobileRadius } } }
        : {}),
      children: [
        {
          type: "component",
          componentType: "button",
          props: { boxShadow: sh("#000000") },
        },
      ],
    });
    // With a shadow inside, a box stops clipping when no corner can be reached.
    assert.equal(clipsOverflow(holder(c4(20, 20, 0, 0))), false);
    assert.equal(clipsOverflow(holder(20)), true);
    assert.equal(clipsOverflow(holder(c4(0, 0, 20, 0))), true);
    // The clip is one declaration for both screen sizes.
    assert.equal(
      clipsOverflow(holder(c4(20, 20, 0, 0), c4(0, 0, 20, 0))),
      true,
    );
    assert.equal(clipsOverflow(holder(0, c4(20, 20, 0, 0))), false);
    // Nothing inside has a shadow: it clips, as it always did.
    assert.equal(
      clipsOverflow({
        border: { width: 0, radius: c4(20, 20, 0, 0) },
        children: [],
      }),
      true,
    );
  },
);

// ─── 3. Save and load ─────────────────────────────────────────────────────────

const savedRows = (): any[] => [
  row("rA", [column("cA", 100, [button("bA")])], {
    border: border(0, c4(12, 12, 0, 0), "#000000"),
  }),
  row("rB", [column("cB", 100, [button("bB")])], {
    border: border(0, c4(0, 0, 0, 0), "#000000"),
  }),
  row("rC", [column("cC", 100, [button("bC")])], {
    border: border(0, 8, "#000000"),
  }),
];

const withDefaults = () => hydrateRows(clone(savedRows()) as any) as any[];

await check(
  "a per-corner radius is saved whole; an all-zero one is dropped",
  () => {
    const saved = optimizeRows(withDefaults() as any) as any[];
    const [a, b, c] = saved;
    assert.deepEqual(a.border.radius, c4(12, 12, 0, 0));
    // Zero on every corner is the default border, as 0 always was.
    assert.equal("border" in b, false);
    // A number stays a number.
    assert.equal(c.border.radius, 8);
  },
);

await check(
  "a per-corner radius survives load, and a round trip is stable",
  () => {
    const once = optimizeRows(withDefaults() as any);
    const loaded = hydrateRows(clone(once) as any) as any[];
    assert.deepEqual(loaded[0].border.radius, c4(12, 12, 0, 0));
    assert.equal(loaded[1].border.radius, 0);
    const twice = optimizeRows(loaded as any);
    assert.deepEqual(clone(twice), clone(once));
  },
);

await check("a component's radius and its mobile override are kept", () => {
  const rows = hydrateRows(
    clone([
      row("r", [
        column("c", 100, [
          button("b", {
            borderRadius: c4(1, 2, 3, 4),
            mobile: { borderRadius: c4(4, 3, 2, 1) },
          }),
          image("i", { borderRadius: c4(5, 6, 7, 8) }),
          video("v", {
            borderRadius: 3,
            mobile: { borderRadius: c4(0, 9, 0, 9) },
          }),
        ]),
      ]),
    ]) as any,
  ) as any[];
  const saved = optimizeRows(rows as any) as any[];
  const kids = saved[0].columns[0].children;
  assert.deepEqual(kids[0].props.borderRadius, c4(1, 2, 3, 4));
  assert.deepEqual(kids[0].props.mobile.borderRadius, c4(4, 3, 2, 1));
  assert.deepEqual(kids[1].props.borderRadius, c4(5, 6, 7, 8));
  assert.equal(kids[2].props.borderRadius, 3);
  assert.deepEqual(kids[2].props.mobile.borderRadius, c4(0, 9, 0, 9));
  // And back in.
  const loaded = hydrateRows(clone(saved) as any) as any[];
  const back = loaded[0].columns[0].children;
  assert.deepEqual(back[0].props.borderRadius, c4(1, 2, 3, 4));
  assert.deepEqual(back[0].props.mobile.borderRadius, c4(4, 3, 2, 1));
});

await check(
  "a mobile border with a per-corner radius survives save and load",
  () => {
    const rows = hydrateRows(
      clone([
        row(
          "r",
          [
            column("c", 100, [], {
              mobile: { border: border(0, c4(0, 6, 0, 6)) },
            }),
          ],
          { mobile: { border: border(0, c4(0, 0, 9, 9)) } },
        ),
      ]) as any,
    ) as any[];
    const saved = optimizeRows(rows as any) as any[];
    assert.deepEqual(saved[0].mobile.border.radius, c4(0, 0, 9, 9));
    assert.deepEqual(saved[0].columns[0].mobile.border.radius, c4(0, 6, 0, 6));
    const loaded = hydrateRows(clone(saved) as any) as any[];
    assert.deepEqual(loaded[0].mobile.border.radius, c4(0, 0, 9, 9));
    assert.deepEqual(loaded[0].columns[0].mobile.border.radius, c4(0, 6, 0, 6));
  },
);

// ─── 4. Export ────────────────────────────────────────────────────────────────

const perCorner = (): any[] => [
  row(
    "rowT",
    [
      column(
        "colT",
        100,
        [
          button("btn", {
            borderRadius: c4(1, 2, 3, 4),
            mobile: { borderRadius: c4(4, 3, 2, 1) },
          }),
          image("img", {
            borderRadius: c4(5, 6, 7, 8),
            mobile: { borderRadius: c4(8, 7, 6, 5) },
          }),
          video("vid", {
            coverImage: "https://example.com/c.png",
            borderRadius: c4(9, 10, 11, 12),
            mobile: { borderRadius: c4(12, 11, 10, 9) },
          }),
          video("vid2", { borderRadius: c4(13, 14, 15, 16) }),
        ],
        {
          border: border(0, c4(4, 0, 4, 0)),
          mobile: { border: border(0, c4(0, 6, 0, 6)) },
        },
      ),
    ],
    {
      border: border(0, c4(12, 12, 0, 0)),
      mobile: { border: border(0, c4(0, 0, 9, 9)) },
    },
  ),
  row("rowU", [column("colU", 100, [])], {
    border: border(2, c4(0, 0, 10, 10)),
  }),
];

const exported = await exportTemplate(perCorner(), canvas);

await check(
  "HTML: a row with a radius and a mobile border carries it on td and outer div",
  () => {
    const html = exported.html;
    const td = tagsWith(html, 'class="eb-rowT"');
    assert.equal(td.length, 1);
    assert.ok(td[0].startsWith("<td"));
    assert.ok(td[0].includes("border-radius:12px 12px 0px 0px"), td[0]);
    const outer = tagsWith(html, 'class="eb-rowT-outer"');
    assert.equal(outer.length, 1);
    assert.ok(outer[0].includes("border-radius:12px 12px 0px 0px"), outer[0]);
  },
);

await check(
  "HTML: a row with a radius and a border keeps the radius off the padding div",
  () => {
    const html = exported.html;
    const withRadius = tagsWith(html, "border-radius:0px 0px 10px 10px");
    assert.equal(withRadius.length, 2, withRadius.join("\n"));
    assert.deepEqual(
      withRadius.map((t) => t.slice(0, 4)),
      ["<td ", "<div"],
    );
    // The border is drawn by the same element that is rounded.
    assert.ok(
      withRadius[1].includes("border:2px solid #cc0000"),
      withRadius[1],
    );
    // The padding div inside it has no radius of its own.
    const padding = tagsWith(html, "padding:").filter(
      (t) => t.startsWith("<div") && !t.includes("border:"),
    );
    assert.ok(padding.length > 0);
    for (const t of padding)
      assert.equal(t.includes("border-radius"), false, t);
  },
);

await check(
  "HTML: a column, a button, an image and a video carry one value per corner",
  () => {
    const html = exported.html;
    const col = tagsWith(html, "eb-colT")[0];
    assert.ok(
      col.startsWith("<td") && col.includes("border-radius:4px 0px 4px 0px"),
      col,
    );
    const btn = tagsWith(html, "eb-btn-link")[0];
    assert.ok(
      btn.startsWith("<a ") && btn.includes("border-radius:1px 2px 3px 4px"),
      btn,
    );
    const img = tagsWith(html, 'src="https://example.com/a.png"')[0];
    assert.ok(img.includes("border-radius:5px 6px 7px 8px"), img);
    // The video and its cover image fallback, and the span that stands in when
    // there is no cover image.
    assert.equal(tagsWith(html, "border-radius:9px 10px 11px 12px").length, 2);
    assert.equal(tagsWith(html, "border-radius:13px 14px 15px 16px").length, 2);
    assert.ok(
      tagsWith(html, "border-radius:13px 14px 15px 16px").some((t) =>
        t.startsWith("<span"),
      ),
    );
  },
);

await check("MJML and React Email write the same values", () => {
  for (const out of [exported.mjml, exported.html]) {
    for (const v of [
      "12px 12px 0px 0px",
      "0px 0px 10px 10px",
      "4px 0px 4px 0px",
      "1px 2px 3px 4px",
      "5px 6px 7px 8px",
      "9px 10px 11px 12px",
      "13px 14px 15px 16px",
    ]) {
      assert.ok(out.includes(`border-radius:${v}`), v);
    }
  }
  const jsx = exported.jsx;
  for (const v of [
    "12px 12px 0px 0px",
    "0px 0px 10px 10px",
    "4px 0px 4px 0px",
    "1px 2px 3px 4px",
    "5px 6px 7px 8px",
    "9px 10px 11px 12px",
    "13px 14px 15px 16px",
  ]) {
    assert.ok(new RegExp(`borderRadius: ?"${v}"`).test(jsx), `jsx ${v}`);
  }
});

await check(
  "mobile: each override is one rule, with the whole corner list",
  () => {
    const css = mobileCss(exported.html);
    assert.ok(
      css.includes(".eb-rowT { border-radius: 0px 0px 9px 9px !important }"),
      css,
    );
    assert.ok(
      /\.eb-rowT-outer \{[^}]*border-radius: 0px 0px 9px 9px !important/.test(
        css,
      ),
      css,
    );
    assert.ok(
      /\.eb-colT \{[^}]*border-radius: 0px 6px 0px 6px !important/.test(css),
      css,
    );
    assert.ok(
      css.includes(
        ".eb-btn-link { border-radius: 4px 3px 2px 1px !important }",
      ),
      css,
    );
    assert.ok(css.includes("border-radius: 8px 7px 6px 5px !important"), css);
    assert.ok(
      css.includes("border-radius: 12px 11px 10px 9px !important"),
      css,
    );
  },
);

await check(
  "a row with a rounded column is separated, one with only square columns is not",
  async () => {
    // Border-radius on a <td> needs border-collapse: separate to draw. A gap
    // separates the table too, and a row has one by default, so these have none.
    const separated = async (radius: unknown): Promise<boolean[]> => {
      const o = await exportTemplate(
        [
          row("rG", [column("cG", 100, [], { border: border(0, radius) })], {
            gap: 0,
          }),
        ],
        canvas,
      );
      return [o.html, o.mjml].map((out) =>
        /border-collapse:separate/.test(tableAround(out, "vertical-align:top")),
      );
    };
    assert.deepEqual(await separated(0), [false, false]);
    assert.deepEqual(await separated(c4(0, 0, 0, 0)), [false, false]);
    assert.deepEqual(await separated(5), [true, true]);
    assert.deepEqual(await separated(c4(12, 12, 0, 0)), [true, true]);
    // One rounded corner is enough.
    assert.deepEqual(await separated(c4(0, 0, 0, 5)), [true, true]);
  },
);

await check(
  "equal corners export as one length, whatever form they are stored in",
  async () => {
    const tpl = (radius: unknown) => [
      row(
        "rU",
        [
          column(
            "cU",
            100,
            [
              button("bU", {
                borderRadius: radius,
                mobile: { borderRadius: radius },
              }),
              image("iU", { borderRadius: radius }),
              video("vU", { borderRadius: radius }),
            ],
            { border: border(0, radius) },
          ),
        ],
        { border: border(0, radius), mobile: { border: border(0, radius) } },
      ),
    ];
    const asNumber = await exportTemplate(tpl(8), canvas);
    const asObject = await exportTemplate(tpl(c4(8, 8, 8, 8)), canvas);
    assert.equal(asObject.html, asNumber.html);
    assert.equal(asObject.mjml, asNumber.mjml);
    assert.equal(asObject.jsx, asNumber.jsx);
    assert.ok(asNumber.html.includes("border-radius:8px"));
    assert.equal(/border-radius: ?\d+(\.\d+)?px \d/.test(asNumber.html), false);
  },
);

await check(
  "a value that is not a radius never reaches the email",
  async () => {
    const evil = "8px;}</style><script>alert(1)</script>";
    const out = await exportTemplate(
      [
        row(
          "rE",
          [
            column(
              "cE",
              100,
              [
                button("bE", {
                  borderRadius: {
                    topLeft: evil,
                    topRight: -5,
                    bottomRight: 1e308,
                    bottomLeft: "7",
                  },
                  mobile: { borderRadius: evil },
                }),
                image("iE", { borderRadius: evil }),
              ],
              { border: border(0, evil) },
            ),
          ],
          { border: border(1, { topLeft: evil }) },
        ),
      ],
      canvas,
    );
    for (const text of [out.html, out.mjml, out.jsx]) {
      assert.equal(text.includes("<script"), false);
      assert.equal(text.includes("alert(1)"), false);
    }
    assert.ok(out.html.includes("border-radius:0px 0px 9999px 7px"), "button");
  },
);

await check(
  "columns that have a shadow inside stop clipping only where no corner is reached",
  async () => {
    const tpl = (radius: unknown) => [
      row("rS", [
        column("cS", 100, [button("bS", { boxShadow: sh("#123456") })], {
          backgroundColor: "#a1b2c3",
          padding: { top: 20, right: 0, bottom: 0, left: 0 },
          border: border(0, radius),
        }),
      ]),
    ];
    const clipped = async (radius: unknown) => {
      const o = await exportTemplate(tpl(radius), canvas);
      const td = tagsWith(o.html, "#a1b2c3")[0];
      assert.ok(td.startsWith("<td"), td);
      const mjml = tagsWith(o.mjml, "#a1b2c3")[0];
      assert.equal(
        mjml.includes("overflow:hidden"),
        td.includes("overflow:hidden"),
      );
      assert.equal(
        /overflow: ?"hidden"/.test(
          o.jsx.slice(
            o.jsx.indexOf("#a1b2c3") - 400,
            o.jsx.indexOf("#a1b2c3") + 400,
          ),
        ),
        td.includes("overflow:hidden"),
      );
      return td.includes("overflow:hidden");
    };
    assert.equal(await clipped(c4(20, 20, 0, 0)), false);
    assert.equal(await clipped(20), true);
    assert.equal(await clipped(c4(0, 0, 20, 0)), true);
  },
);

await check(
  "the row box: the radius value is decided in one place",
  async () => {
    const rows = [
      row("rX", [column("cX", 100, [])], {
        border: border(0, c4(3, 0, 3, 0)),
        padding: { top: 1, right: 1, bottom: 1, left: 1 },
      }),
    ];
    const o = await exportTemplate(rows, canvas);
    // No border and no mobile border: the radius sits on the <td> alone.
    assert.equal(tagsWith(o.html, "border-radius:3px 0px 3px 0px").length, 1);
  },
);

// ─── 5. The panels' editing logic ─────────────────────────────────────────────

const hydratedNodes = hydrateRows(
  clone([
    {
      id: "r1",
      type: "row",
      columns: [{ id: "c1", children: [] }],
    },
  ]) as any,
) as any[];

const freshRow = (): any => clone(hydratedNodes[0]);

/** A node editor on a reactive row, as the Row panel gets it. */
const openNode = (node: any, mode: EditMode = "desktop") => {
  const live = reactive(node) as any;
  const editMode = ref<EditMode>(mode);
  const ed = useNodeStyleEditor(
    computed(() => live),
    editMode,
  );
  resetHistory();
  return { node: live, editMode, ed };
};

await check("Row and Column panels: a desktop radius is written whole", () => {
  const { node, ed } = openNode(freshRow());
  ed.setBorderProp("radius", c4(12, 12, 0, 0));
  assert.deepEqual(clone(node.border.radius), c4(12, 12, 0, 0));
  assert.deepEqual(clone(ed.displayBorderValue("radius")), c4(12, 12, 0, 0));
  assert.deepEqual(commits(), ["set-border-radius"]);
  ed.setBorderProp("radius", 6);
  assert.equal(node.border.radius, 6);
});

await check(
  "Row panel: a mobile radius that draws the desktop one is not an override",
  () => {
    const row = freshRow();
    row.border.radius = 8;
    const { node, ed } = openNode(row, "mobile");
    ed.setBorderProp("radius", c4(8, 8, 8, 8));
    assert.equal(node.mobile.border, null);
    assert.equal(ed.isBorderPropOverridden("radius"), false);

    // The same the other way round: a per-corner desktop radius, a plain mobile one.
    const row2 = freshRow();
    row2.border.radius = c4(5, 5, 5, 5);
    const o2 = openNode(row2, "mobile");
    o2.ed.setBorderProp("radius", 5);
    assert.equal(o2.node.mobile.border, null);
    assert.equal(o2.ed.isBorderPropOverridden("radius"), false);
  },
);

await check(
  "Row panel: a different mobile radius is an override, desktop untouched",
  () => {
    const row = freshRow();
    row.border.radius = 8;
    const { node, ed } = openNode(row, "mobile");
    ed.setBorderProp("radius", c4(12, 12, 0, 0));
    assert.deepEqual(clone(node.mobile.border.radius), c4(12, 12, 0, 0));
    assert.equal(ed.isBorderPropOverridden("radius"), true);
    assert.equal(node.border.radius, 8);
    assert.deepEqual(clone(ed.displayBorderValue("radius")), c4(12, 12, 0, 0));
    assert.deepEqual(commits(), ["set-border-radius"]);
  },
);

await check(
  "Row panel: what is written is a copy, not the object it was given",
  () => {
    const { node, ed } = openNode(freshRow(), "mobile");
    const given = c4(12, 12, 0, 0);
    ed.setBorderProp("radius", given);
    assert.notEqual(node.mobile.border.radius, given);
    given.topLeft = 99;
    assert.equal(node.mobile.border.radius.topLeft, 12);
  },
);

await check(
  "Row panel: the first mobile edit copies the desktop radius, not shares it",
  () => {
    const row = freshRow();
    row.border.radius = c4(12, 12, 0, 0);
    const { node, ed } = openNode(row, "mobile");
    ed.setBorderProp("width", 3);
    assert.deepEqual(clone(node.mobile.border.radius), c4(12, 12, 0, 0));
    assert.notEqual(node.mobile.border.radius, node.border.radius);
    // Not an override of the radius: it is the same corners.
    assert.equal(ed.isBorderPropOverridden("radius"), false);
    assert.equal(ed.isBorderPropOverridden("width"), true);
  },
);

await check(
  "Row panel: resetting the radius puts the desktop one back and leaves the rest",
  () => {
    const row = freshRow();
    row.border.radius = c4(12, 12, 0, 0);
    const { node, ed } = openNode(row, "mobile");
    ed.setBorderProp("width", 3);
    ed.setBorderProp("radius", c4(1, 2, 3, 4));
    assert.equal(ed.isBorderPropOverridden("radius"), true);
    ed.resetBorderProp("radius");
    assert.equal(ed.isBorderPropOverridden("radius"), false);
    assert.deepEqual(clone(node.mobile.border.radius), c4(12, 12, 0, 0));
    assert.notEqual(node.mobile.border.radius, node.border.radius);
    assert.equal(node.mobile.border.width, 3);
  },
);

await check(
  "Row panel: when every mobile field matches desktop the border override goes",
  () => {
    const row = freshRow();
    row.border.radius = c4(12, 12, 0, 0);
    const { node, ed } = openNode(row, "mobile");
    ed.setBorderProp("radius", c4(1, 2, 3, 4));
    assert.ok(node.mobile.border);
    ed.setBorderProp("radius", c4(12, 12, 0, 0));
    assert.equal(node.mobile.border, null);
  },
);

await check(
  "component panels: a radius is a whole value on desktop and on mobile",
  () => {
    const live = reactive({
      id: "b",
      type: "button",
      props: {
        borderRadius: 4,
        mobile: { borderRadius: null as unknown },
      },
    }) as any;
    const editMode = ref<EditMode>("desktop");
    const ed = useComponentStyleEditor(
      computed(() => live),
      editMode,
    );
    resetHistory();

    ed.setProp("borderRadius", c4(8, 8, 0, 0));
    assert.deepEqual(clone(live.props.borderRadius), c4(8, 8, 0, 0));
    assert.equal(ed.isOverridden("borderRadius"), false);

    editMode.value = "mobile";
    assert.deepEqual(clone(ed.displayValue("borderRadius")), c4(8, 8, 0, 0));
    ed.setProp("borderRadius", 2);
    assert.equal(live.props.mobile.borderRadius, 2);
    assert.equal(ed.isOverridden("borderRadius"), true);
    assert.deepEqual(clone(live.props.borderRadius), c4(8, 8, 0, 0));

    ed.resetProp("borderRadius");
    assert.equal(live.props.mobile.borderRadius, null);
    assert.deepEqual(clone(ed.displayValue("borderRadius")), c4(8, 8, 0, 0));
    assert.deepEqual(commits(), [
      "set-borderRadius",
      "set-borderRadius",
      "reset-borderRadius",
    ]);
  },
);

await check(
  "component border override: a radius is compared by its corners",
  () => {
    const live = reactive({
      id: "x",
      type: "image",
      props: {
        border: {
          width: 1,
          color: "#000000",
          style: "solid",
          radius: c4(1, 2, 3, 4),
        },
        mobile: {
          border: {
            width: 1,
            color: "#000000",
            style: "solid",
            radius: c4(1, 2, 3, 4),
          },
        },
      },
    }) as any;
    const ed = useComponentStyleEditor(
      computed(() => live),
      ref<EditMode>("mobile"),
    );
    // A different object that draws the same corners is not an override.
    assert.equal(ed.isBorderOverridden(), false);
    live.props.mobile.border.radius = c4(1, 2, 3, 5);
    assert.equal(ed.isBorderOverridden(), true);
  },
);

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
  "classic Outlook drops a rounded <td> of any kind, and keeps a rounded button",
  () => {
    const html = exported.html;
    const tdRadius = (s: string) => count(s, /<td\b[^>]*border-radius:\s*\d/g);
    assert.ok(tdRadius(html) >= 3);
    const outlook = transformForClient(html, client("outlook-desktop"));
    assert.equal(tdRadius(outlook), 0);
    // The four-value list goes whole: nothing is left of it on a <td>.
    assert.equal(count(outlook, /<td\b[^>]*border-radius:\s*\d+px \d+px/g), 0);
    // A button is a link, and the preview keeps its radius.
    assert.ok(outlook.includes("border-radius:1px 2px 3px 4px"));
    // Other clients keep everything.
    for (const id of ["apple-mail", "gmail-web"]) {
      assert.equal(
        tdRadius(transformForClient(html, client(id))),
        tdRadius(html),
        id,
      );
    }
  },
);

// ─── Result ───────────────────────────────────────────────────────────────────

if (failed > 0) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
