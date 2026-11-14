/**
 * export-shadow-model.ts
 *
 * Writes the two files that tests/shadow_model.rs and tests/shadow_clip.rs of the engine read:
 *
 *   shadow-model.json   what the editor's box shadow model (core/boxShadow.ts, core/cssColor.ts) makes of a list of
 *                       stored values: the clamped and rounded fields, the colour, whether the shadow is drawn, and
 *                       the CSS it writes
 *   shadow-clip.json    what the editor's clipping rule makes of a list of rows and columns: hasShadowInside,
 *                       hasActiveShadow, columnsHaveShadow and clipsOverflow, and the corner test on its own
 *
 * The inputs are made here from a fixed seed, so a run always writes the same files. Nothing is left out for being
 * strange: the point is that the engine and the editor agree on the strange ones too. (The one place they are
 * meant to differ is a colour function with a line break or a no-break space inside, which the editor keeps and
 * the engine replaces with the default colour; no input here has one.)
 *
 * Copy this file into packages/editor/scripts/ of the editor repo, then, from packages/editor:
 *
 *   npx tsx scripts/export-shadow-model.ts <engine repo>/tests/fixtures
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  boxShadowMobileRule,
  boxShadowValue,
  clipsOverflow,
  columnsHaveShadow,
  cornersReachContent,
  hasActiveShadow,
  hasShadowInside,
  isBoxShadowActive,
  normalizeBoxShadow,
} from "../src/composables/emailBuilder/core/boxShadow";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: npx tsx scripts/export-shadow-model.ts <output folder>");
  process.exit(1);
}

// ─── A small, fixed random source ─────────────────────────────────────────────

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = mulberry32(20260314);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
const chance = (p: number): boolean => rnd() < p;
const between = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

// ─── 1. The shadow model ──────────────────────────────────────────────────────

const NUMBERS: unknown[] = [
  -999, -51, -50.5, -50, -49.999, -12.345, -1.235, -1.005, -0.005, -0.004, 0, 0.004, 0.005, 0.01, 0.285,
  1.005, 1.235, 1.2349999, 2.675, 4, 7.5, 12, 49.995, 50, 50.004, 50.5, 99.999, 100, 100.5, 999,
  "8", " 8.5 ", "-3", "+5", ".5", "5.", "1e1", "0x10", "0b11", "0o7", "0X1f", "", "   ", "x", "8px", "1,5", "1_0",
  "-0x10", "Infinity", "-Infinity", "NaN", true, false, null, [], {}, [3],
];

const COLORS: unknown[] = [
  "#fff", "#FFF", "#abcd", "#ABCD", "#aabbcc", "#AABBCC", "#aabbccdd", "#00000080", "#00000000", "#ffffff01",
  "#ffffffff", "#12", "#12345", "#1234567", "#123456789", "#ggg", "ff0000", "#0a1B2c",
  "rgb(1,2,3)", "rgb(1 2 3)", "rgb(1 2 3 / 50%)", "rgb(1, 2, 3, 0.5)", "rgba(1,2,3)", "rgba(0,0,0,.3)",
  "rgba(0, 0, 0, 0.15)", "rgba(100%,50%,0%,1)", "rgba(300,-5,0,2)", "rgba(0,0,0,0.004)", "rgba(0,0,0,0.005)",
  "rgba(0,0,0,0.994)", "rgba(0,0,0,0.995)", "rgba(0,0,0,0.996)", "RGB(1,2,3)", "RGBA(1,2,3,0.5)",
  " rgb( 1 , 2 , 3 ) ", "rgb(1,2,3,)", "rgb(1.5,2.5,3.5)", "rgb(0.5,0.5,0.5)", "rgb(+1,+2,+3)", "rgb(-1,-2,-3)",
  "rgb(.5,5.,5)", "rgb(1e2,0,0)", "rgb(50%, 50%, 50%)", "rgb(-10%, 110%, 50.5%)", "rgb(1, 2, 3", "rgb(1, (2), 3)",
  "rgb(1,2)", "rgb(1,2,3,4,5)", "rgb(a,b,c)", "rgb(1 2 3 / 50% / 4)", "rgb()", "rgb(%, 1, 2)",
  "tomato", "Tomato", "transparent", "TRANSPARENT", "currentColor", "red", "ab", "abc", "a".repeat(30), "a".repeat(31),
  "hsl(10, 50%, 50%)", "hsla(10,50%,50%,.5)", "hsl(10deg 50% 50%)", "HSL(10 50% 50%)", "hsl(1,\t2%,\t3%)", "hsl( )", "hsl()",
  "rgba(0,0,0,0.5);color:red", "rgba(0,0,0,0.5) !important", "rgba(0,0,0,0.5)}", "red;}</style><script>alert(1)</script>",
  'red" onload="x', "red; background:url(x)", "url(javascript:alert(1))", "expression(alert(1))", "hsl(0,0%,0%;)",
  "hsl(0,0%,0%)x", "x hsl(0,0%,0%)", "calc(1)", "color-mix(in srgb, red, blue)",
  "", "  ", " #fff ", "rgb(1, 2, 3)\n", " #fff ", "﻿#fff", "\t#abc\t",
  42, 0, true, false, null, {}, [], ["#fff"],
];

const shadowCases: any[] = [];
const addShadow = (input: unknown) => {
  const opts = { allowInset: false };
  const value = boxShadowValue(input);
  const mobileRule = boxShadowMobileRule(input);
  const valueNoInset = boxShadowValue(input, opts);
  const mobileRuleNoInset = boxShadowMobileRule(input, opts);
  shadowCases.push({
    input,
    normalized: normalizeBoxShadow(input),
    active: isBoxShadowActive(input),
    value,
    mobileRule,
    // Written only where drawing the shadow for an <img> (no inset) makes a difference.
    ...(valueNoInset !== value ? { valueNoInset, mobileRuleNoInset } : {}),
  });
};

// Whole values of the wrong kind, and partial ones.
for (const input of [
  null, "nope", 7, 0, [], true, false, {}, [{ enabled: true }],
  { enabled: true },
  { enabled: true, blur: 20 },
  { enabled: true, inset: true },
  { enabled: false, offsetX: 3, offsetY: 3, blur: 3, spread: 3, color: "#123456", inset: true },
  { enabled: true, offsetX: 0, offsetY: 0, blur: 0, spread: 0 },
  { enabled: true, offsetX: 0, offsetY: 0, blur: 0, spread: 1 },
  { enabled: true, offsetX: -1, offsetY: 0, blur: 0, spread: 0 },
  { enabled: true, offsetX: 0, offsetY: 0, blur: 0.004, spread: 0 },
  { enabled: true, offsetX: 0, offsetY: 0, blur: 0, spread: -0.004, color: "#000" },
  { enabled: true, color: "rgba(0,0,0,0)" },
  { enabled: true, color: "transparent" },
  { enabled: true, color: "Transparent", inset: true },
  { enabled: true, color: "#00000000" },
  { enabled: "true", inset: "true" },
  { enabled: 1, inset: 1 },
  { enabled: {}, inset: [] },
  { enabled: null, inset: null, offsetX: null, color: null },
  { enabled: true, offsetX: "3", offsetY: "-4", blur: "10", spread: "2", color: "#000" },
  { enabled: true, inset: true, offsetX: -2, offsetY: 3, blur: 16, spread: -4, color: "#000000" },
]) {
  addShadow(input);
}

// Every field against every number, and the colour against every colour.
const SOME_NUMBERS: unknown[] = [-999, -50.5, -1.235, 0, 0.005, 1.005, 50, 50.5, "8", "x", "0x10", null];
for (const field of ["offsetX", "offsetY", "blur", "spread"]) {
  // offsetX and blur have different ranges, and offsetY and spread share those two: the long list for the first
  // two, a short one for the others.
  for (const n of field === "offsetX" || field === "blur" ? NUMBERS : SOME_NUMBERS) {
    addShadow({ enabled: true, [field]: n });
  }
}
for (const color of COLORS) {
  addShadow({ enabled: true, offsetX: 0, offsetY: 6, blur: 16, spread: 0, color });
}

// Random whole shadows.
for (let i = 0; i < 50; i++) {
  const s: Record<string, unknown> = {};
  if (chance(0.9)) s.enabled = chance(0.85) ? true : pick([false, "true", 1, null]);
  if (chance(0.8)) s.offsetX = chance(0.7) ? between(-60, 60) : pick(NUMBERS);
  if (chance(0.8)) s.offsetY = chance(0.7) ? between(-60, 60) : pick(NUMBERS);
  if (chance(0.8)) s.blur = chance(0.7) ? between(-5, 110) : pick(NUMBERS);
  if (chance(0.8)) s.spread = chance(0.7) ? between(-60, 60) : pick(NUMBERS);
  if (chance(0.8)) s.color = pick(COLORS);
  if (chance(0.5)) s.inset = chance(0.7) ? true : pick([false, "true", 1, null]);
  // Quarter values and the odd long fraction, which are where rounding differs.
  for (const key of ["offsetX", "offsetY", "blur", "spread"]) {
    if (typeof s[key] === "number" && chance(0.4)) s[key] = (s[key] as number) + pick([0.125, 0.25, 0.375, 0.005, 0.015, 0.0049, 0.0051]);
  }
  addShadow(s);
}

// ─── 2. The clipping rule ─────────────────────────────────────────────────────

const shadow = (extra: Record<string, unknown> = {}) => ({
  enabled: true, offsetX: 0, offsetY: 6, blur: 16, spread: 0, color: "#333333", inset: false, ...extra,
});

/** A shadow value as it can be found on a node: on, off, zero-sized, transparent, junk, or none. */
const anyShadow = (): unknown =>
  pick([
    undefined, undefined, undefined, null,
    shadow(), shadow({ inset: true }), shadow({ enabled: false }),
    shadow({ offsetY: 0, blur: 0 }), shadow({ color: "transparent" }), shadow({ color: "rgba(0,0,0,0)" }),
    "junk", 5, {},
  ]);

const side = (): unknown =>
  pick([undefined, null, 0, 0, 4, 5, 6, 10, 12, 18, 20, 30, 40, 60, -5, "9", "x", true, 2.5]);

const anyPadding = (): unknown => {
  const kind = between(0, 5);
  if (kind === 0) return undefined;
  if (kind === 1) return null;
  if (kind === 2) {
    const v = pick([0, 5, 10, 20, 40]);
    return { top: v, right: v, bottom: v, left: v };
  }
  const p: Record<string, unknown> = {};
  for (const k of ["top", "right", "bottom", "left"]) if (chance(0.75)) p[k] = side();
  return p;
};

const anyBorder = (): unknown => {
  if (chance(0.25)) return undefined;
  const b: Record<string, unknown> = { style: "solid", color: "#000000" };
  if (chance(0.9)) b.width = pick([0, 0, 1, 2, 3, 6, 25]);
  if (chance(0.9)) b.radius = pick([0, 0, 4, 8, 12, 20, 24, 50, 200, 2.5]);
  return b;
};

const anyMobile = (): unknown => {
  if (chance(0.55)) return undefined;
  const m: Record<string, unknown> = {};
  if (chance(0.5)) m.padding = anyPadding();
  if (chance(0.5)) m.border = anyBorder();
  if (chance(0.35)) m.boxShadow = anyShadow();
  if (chance(0.1)) m.backgroundColor = "#eeeeee";
  return m;
};

let nextId = 0;
const id = (prefix: string) => `${prefix}${nextId++}`;

const component = (): any => {
  const kind = pick(["image", "image", "button", "button", "heading", "video", "paragraph", "legacy-image", "legacy-button", "spacer", "divider"]);
  const props: Record<string, unknown> = {};
  if (chance(0.7)) props.boxShadow = anyShadow();
  if (chance(0.25)) props.mobile = { boxShadow: anyShadow() };
  switch (kind) {
    case "spacer":
      return { id: id("sp"), type: "row-spacer", height: 20, ...(chance(0.5) ? { boxShadow: anyShadow() } : {}) };
    case "legacy-image":
      return { id: id("li"), type: "image", props };
    case "legacy-button":
      return { id: id("lb"), type: "button", props };
    default:
      return { id: id("cmp"), type: "component", componentType: kind, props };
  }
};

const column = (depth: number): any => {
  const kids: any[] = [];
  const count = between(0, 2);
  for (let i = 0; i < count; i++) {
    kids.push(depth < 2 && chance(0.25) ? row(depth + 1) : component());
  }
  const col: any = { id: id("col"), width: 50 };
  col[chance(0.85) ? "children" : "components"] = kids;
  if (chance(0.6)) col.border = anyBorder();
  if (chance(0.6)) col.padding = anyPadding();
  if (chance(0.35)) col.boxShadow = anyShadow();
  const mobile = anyMobile();
  if (mobile) col.mobile = mobile;
  return col;
};

function row(depth: number): any {
  const columns: any[] = [];
  const count = between(1, 2);
  for (let i = 0; i < count; i++) columns.push(column(depth));
  const r: any = { id: id("row"), type: "row", columns };
  if (chance(0.7)) r.border = anyBorder();
  if (chance(0.7)) r.padding = anyPadding();
  if (chance(0.3)) r.boxShadow = anyShadow();
  const mobile = anyMobile();
  if (mobile) r.mobile = mobile;
  return r;
}

const clipCases: any[] = [];
const addClip = (node: any) => {
  clipCases.push({
    node,
    hasActiveShadow: hasActiveShadow(node),
    columnsHaveShadow: columnsHaveShadow(node),
    hasShadowInside: hasShadowInside(node),
    clipsOverflow: clipsOverflow(node),
  });
};

// A few that are known, then a lot that are random: rows, and the columns inside them.
addClip({ id: "empty-row", type: "row", columns: [] });
addClip({ id: "empty-col", width: 100, children: [] });

// The card: a column with a button that has a shadow, in every combination of radius, padding and mobile
// override that matters. The clip is one declaration for both sizes, so a corner that the content can reach on
// desktop or on mobile keeps it, and one it cannot reach on either lets it go.
const pad = (v: number) => ({ top: v, right: v, bottom: v, left: v });
const curve = (radius: number, width = 0) => ({ width, style: "solid", color: "#000000", radius });
const card = (extra: Record<string, unknown>) => ({
  id: id("card"),
  width: 100,
  children: [{ id: id("btn"), type: "component", componentType: "button", props: { boxShadow: shadow() } }],
  ...extra,
});
for (const extra of [
  { border: curve(20), padding: pad(40) },
  { border: curve(20), padding: pad(40), mobile: { padding: pad(0) } },
  { border: curve(20), padding: pad(40), mobile: { padding: pad(30) } },
  { border: curve(20), padding: pad(0), mobile: { padding: pad(40) } },
  { border: curve(20), padding: pad(0), mobile: { border: curve(0) } },
  { border: curve(20), padding: pad(0), mobile: { border: { width: 0, style: "solid", color: "#000000", radius: 0 } } },
  { border: curve(0), padding: pad(0), mobile: { border: curve(20) } },
  { border: curve(20), padding: pad(5), mobile: { border: { width: 10, style: "solid", color: "#000000" } } },
  { border: curve(20), padding: pad(40), mobile: { padding: { top: 30, left: 30 } } },
  { border: curve(20), padding: pad(40), mobile: { padding: { top: null, left: null } } },
  { border: curve(20), padding: pad(40), mobile: { padding: {} } },
  { border: curve(20), padding: pad(40), mobile: { padding: null } },
  { border: curve(20), padding: pad(40), mobile: { border: curve(200) } },
  { border: curve(20, 2), padding: pad(18) },
  { border: curve(20), padding: { top: 40, left: 40 } },
  { border: curve(20), padding: { top: -5, right: "9", bottom: "x", left: true } },
  { border: curve(0), padding: pad(0) },
  { padding: pad(0) },
  { border: curve(20), padding: pad(40), boxShadow: shadow() },
]) {
  addClip(card(extra));
  addClip({ id: id("row"), type: "row", columns: [card({})], ...extra });
}
for (let i = 0; i < 45; i++) addClip(row(0));
for (let i = 0; i < 45; i++) addClip(column(0));

// The same corner test on its own, over a grid of radius, border width and padding.
const cornerCases: any[] = [];
for (const radius of [0, 2, 4, 8, 12, 20, 24, 50]) {
  for (const borderWidth of [0, 1, 2, 6]) {
    for (let i = 0; i < 3; i++) {
      const padding = {
        top: pick([0, 2, 5, 6, 9, 10, 12, 18, 20, 40]),
        right: pick([0, 2, 5, 6, 9, 10, 12, 18, 20, 40]),
        bottom: pick([0, 2, 5, 6, 9, 10, 12, 18, 20, 40]),
        left: pick([0, 2, 5, 6, 9, 10, 12, 18, 20, 40]),
      };
      cornerCases.push({ radius, borderWidth, padding, reaches: cornersReachContent(radius, borderWidth, padding) });
    }
  }
}
// Squares of padding p inside a circle of radius r, at the edge of the arc.
for (const radius of [10, 20, 100]) {
  for (const p of [radius * (1 - Math.SQRT1_2), radius * (1 - Math.SQRT1_2) - 0.01, radius * (1 - Math.SQRT1_2) + 0.01]) {
    const padding = { top: p, right: p, bottom: p, left: p };
    cornerCases.push({ radius, borderWidth: 0, padding, reaches: cornersReachContent(radius, 0, padding) });
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
const lines = (key: string, items: unknown[]) =>
  `  ${JSON.stringify(key)}: [\n${items.map((item) => `    ${JSON.stringify(item)}`).join(",\n")}\n  ]`;

writeFileSync(
  join(outDir, "shadow-model.json"),
  `{\n${lines("shadows", shadowCases)}\n}\n`,
  "utf8",
);
writeFileSync(
  join(outDir, "shadow-clip.json"),
  `{\n${lines("nodes", clipCases)},\n${lines("corners", cornerCases)}\n}\n`,
  "utf8",
);
console.log(
  `wrote ${shadowCases.length} shadow cases, ${clipCases.length} nodes and ${cornerCases.length} corner cases to ${outDir}`,
);
