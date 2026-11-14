/**
 * export-shadow-fixture.ts
 *
 * Writes the editor's side of the `k-shadow` fixture: the template as the editor's optimizer saves it, and the
 * HTML, MJML and React Email the editor exports for it. `tests/fixtures/gen_expected.py` turns that folder into
 * `tests/fixtures/k-shadow.json` and `tests/fixtures/expected/k-shadow.txt`.
 *
 * The template is defined here, in the saved (sparse) form the SDKs send. It is the one fixture that is written
 * for the engine's shadow tests (README, "Box shadows"), so it holds every case that has a different answer:
 *
 *   row 1   a row with its own shadow, a border and a radius, and a mobile shadow that replaces it
 *   row 2   a square row with its own shadow, and a mobile shadow that turns it off
 *   row 3   a padded, rounded row: shadows on its columns and on an image and two buttons inside them, with
 *           mobile shadows (an inset one on an image, which is dropped, and on a button, which is kept). The room
 *           around the corners is enough, so nothing clips. One of the buttons has an icon
 *   row 4   a rounded row with no padding around a shadowed column: the corners reach the content, so it clips.
 *           The column's mobile shadow sits among its other mobile keys (the order of the declarations in the rule)
 *   row 5   nested rows: one with its own shadow, one around a shadowed column
 *   row 6   shadows that write nothing (off, no size, no colour) and shadows in their other spellings
 *   row 7   a row with a shadow and a mobile border, which gives it an outer layer of its own, and a mobile
 *           shadow among the other mobile keys of a row (the order of the declarations in the rule)
 *   row 8   inset shadows on a row and on a column, desktop and mobile (a row and a column keep the inset)
 *   row 9   a square column with a shadow, in a row with no gap: its cell clips and carries the shadow, so the
 *           table around the columns needs separate borders for no other reason than that
 *
 * Usage, from the editor repo:
 *
 *   cp <engine repo>/tests/fixtures/editor-scripts/export-shadow-fixture.ts packages/editor/scripts/
 *   cd packages/editor
 *   npx tsx scripts/export-shadow-fixture.ts /tmp/editor-run
 *
 * It writes /tmp/editor-run/k-shadow/editor/{optimized.json,export.html,export.mjml,export.jsx}, the layout
 * `gen_expected.py` reads (the folder the other ten fixtures use).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  hydrateCanvas,
  hydrateRows,
} from "../src/composables/emailBuilder/transform/pipeline/hydrate";
import {
  optimizeCanvas,
  optimizeRows,
} from "../src/composables/emailBuilder/transform/pipeline/optimize";
import { exportTemplate } from "./lib/headless-export";

const outRoot = process.argv[2];
if (!outRoot) {
  console.error(
    "usage: npx tsx scripts/export-shadow-fixture.ts <runDir>   (writes <runDir>/k-shadow/editor/)",
  );
  process.exit(2);
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// ── Builders (the saved, sparse form) ────────────────────────────────────────

type Shadow = {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
};

/** A shadow that is on. Only what differs from the editor's default needs saying. */
const shadow = (color: string, extra: Partial<Shadow> = {}): Shadow => ({
  enabled: true,
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
  color,
  inset: false,
  ...extra,
});
/** A shadow that is switched off but keeps its values, as the editor saves it. */
const off = (extra: Partial<Shadow> = {}): Shadow => ({
  ...shadow("rgba(0, 0, 0, 0.15)"),
  enabled: false,
  ...extra,
});

const pad = (n: number) => ({ top: n, right: n, bottom: n, left: n });
const border = (width: number, radius: number, color = "#c7d2fe") => ({
  width,
  style: "solid",
  color,
  radius,
});

const paragraph = (id: string, text: string) => ({
  id,
  type: "component",
  componentType: "paragraph",
  props: { content: text, fontSize: 15, color: "#161433", fontFamily: "Arial" },
});
const image = (id: string, props: object = {}) => ({
  id,
  type: "component",
  componentType: "image",
  props: {
    src: "https://img.example.com/shadow.png",
    alt: "Shadow",
    width: 80,
    align: "left",
    ...props,
  },
});
const button = (id: string, text: string, props: object = {}) => ({
  id,
  type: "component",
  componentType: "button",
  props: {
    text,
    link: "https://example.com/go",
    backgroundColor: "#a3271f",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: "Arial",
    padding: { top: 12, right: 22, bottom: 12, left: 22 },
    borderRadius: 10,
    border: { width: 0, color: "transparent", style: "solid" },
    align: "left",
    ...props,
  },
});
const column = (
  id: string,
  width: number,
  children: unknown[],
  extra: object = {},
) => ({ id, width, verticalAlign: "top", backgroundColor: "transparent", children, ...extra });
const row = (id: string, columns: unknown[], extra: object = {}) => ({
  id,
  type: "row",
  name: `r${id.slice(-4)}`,
  columns,
  ...extra,
});

// ── The template ─────────────────────────────────────────────────────────────

const rows = [
  // 1. Own shadow, border, radius. The mobile shadow replaces the desktop one.
  row(
    "5000000000000010",
    [
      column("5000000000000011", 100, [
        paragraph("50000000000a0011", "Row with its own shadow and a softer one on mobile."),
      ]),
    ],
    {
      padding: pad(24),
      backgroundColor: "#f6f5fc",
      border: border(1, 16),
      boxShadow: shadow("#2531a3", { offsetY: 6, blur: 16 }),
      mobile: {
        boxShadow: shadow("rgba(37, 49, 163, 0.35)", { offsetY: 2, blur: 6 }),
      },
    },
  ),

  // 2. Square row with a hard shadow; mobile turns it off.
  row(
    "5000000000000020",
    [
      column("5000000000000021", 100, [
        paragraph("50000000000a0021", "A hard shadow on desktop, none on mobile."),
      ]),
    ],
    {
      padding: pad(16),
      backgroundColor: "#ffffff",
      boxShadow: shadow("#222d47", { offsetX: 4, offsetY: 4, blur: 0 }),
      mobile: { boxShadow: off() },
    },
  ),

  // 3. Padded, rounded row. Column A holds an image and a button with shadows and has room around its corners;
  //    column B has none, and its button's corners reach the edge of the column.
  row(
    "5000000000000030",
    [
      column(
        "5000000000000031",
        50,
        [
          image("50000000000a0031", {
            boxShadow: shadow("rgba(0, 0, 0, 0.15)"),
            // inset on an image is ignored (an <img> cannot hold an inset shadow), on mobile too
            mobile: {
              boxShadow: shadow("#000000", { offsetY: 1, blur: 3, inset: true }),
            },
          }),
          button("50000000000a0032", "Inset", {
            boxShadow: shadow("rgba(255, 255, 255, 0.45)", {
              offsetY: 2,
              blur: 4,
              inset: true,
            }),
            mobile: { boxShadow: off() },
          }),
        ],
        {
          padding: pad(16),
          backgroundColor: "#ffffff",
          border: border(0, 12),
          boxShadow: shadow("#6b21a8", { offsetY: 8, blur: 20, spread: -4 }),
        },
      ),
      column(
        "5000000000000032",
        50,
        [
          button("50000000000a0033", "Raised", {
            boxShadow: shadow("#222d47", { offsetX: 3, offsetY: 3, blur: 0 }),
            mobile: {
              boxShadow: shadow("#222d47", { offsetY: 1, blur: 2, inset: true }),
            },
          }),
          // a button with an icon is built another way (a table inside the link); the shadow is on the link too
          button("50000000000a0034", "With icon", {
            icon: "https://img.example.com/icon.png",
            iconAlt: "",
            iconSize: 18,
            iconGap: 6,
            boxShadow: shadow("#065f46", { offsetY: 3, blur: 8 }),
          }),
        ],
        {
          backgroundColor: "#fcebea",
          border: border(0, 8),
        },
      ),
    ],
    {
      padding: pad(40),
      gap: 12,
      mobileStack: true,
      backgroundColor: "#f6f5fc",
      border: border(0, 24),
    },
  ),

  // 4. A rounded row with no padding around a shadowed column: its corners reach the column, so the row clips.
  row(
    "5000000000000040",
    [
      column(
        "5000000000000041",
        100,
        [paragraph("50000000000a0041", "The row clips, so the column's shadow stays inside it.")],
        {
          backgroundColor: "#fcebea",
          border: border(0, 20),
          boxShadow: shadow("#d21717"),
          mobile: {
            backgroundColor: "#ffe4e4",
            padding: pad(8),
            border: border(1, 10, "#d21717"),
            boxShadow: shadow("#d21717", { offsetY: 2, blur: 6 }),
            verticalAlign: "middle",
          },
        },
      ),
    ],
    {
      backgroundColor: "#f6f5fc",
      border: border(0, 20),
    },
  ),

  // 5. Nested rows: one with its own shadow, one around a shadowed column.
  row(
    "5000000000000050",
    [
      column("5000000000000051", 100, [
        row(
          "5000000000000052",
          [
            column("5000000000000053", 100, [
              paragraph("50000000000a0053", "A nested row with its own shadow."),
            ]),
          ],
          {
            padding: pad(16),
            backgroundColor: "#f6f5fc",
            border: border(0, 12),
            boxShadow: shadow("#0f766e", { offsetY: 5, blur: 14 }),
            mobile: { boxShadow: shadow("#0f766e", { offsetY: 2, blur: 4 }) },
          },
        ),
        row(
          "5000000000000054",
          [
            column(
              "5000000000000055",
              100,
              [paragraph("50000000000a0055", "A nested row around a shadowed column.")],
              {
                padding: pad(16),
                backgroundColor: "#ffffff",
                border: border(0, 10),
                boxShadow: shadow("#b45309"),
                mobile: { boxShadow: off() },
              },
            ),
          ],
          { padding: pad(12), border: border(0, 14) },
        ),
      ]),
    ],
    { padding: pad(20), backgroundColor: "#ffffff" },
  ),

  // 6. Shadows that write nothing, and shadows in other spellings. None of the nodes has a mobile key.
  row(
    "5000000000000060",
    [
      column("5000000000000061", 100, [
        // off, with its values kept
        image("50000000000a0061", {
          boxShadow: off({ offsetY: 9 }),
        }),
        // on, with nothing to draw: no offset, blur or spread
        image("50000000000a0062", {
          boxShadow: shadow("#ff0000", { offsetX: 0, offsetY: 0, blur: 0, spread: 0 }),
        }),
        // on, with a colour that is fully transparent
        button("50000000000a0063", "Clear", {
          boxShadow: shadow("rgba(0, 0, 0, 0)"),
        }),
        button("50000000000a0064", "Clear hex", {
          boxShadow: shadow("#ff000000"),
        }),
        // other spellings of a colour: short hex, space-separated rgb with a slash alpha, percentages
        image("50000000000a0065", { boxShadow: shadow("#abc") }),
        image("50000000000a0066", {
          boxShadow: shadow("rgb(10 20 30 / 50%)", { offsetX: -3, spread: 2 }),
        }),
        button("50000000000a0067", "Percent", {
          boxShadow: shadow("rgba(100%, 0%, 50%, 0.5)", { blur: 0 }),
        }),
        // an inset shadow on an image is written without the inset
        image("50000000000a0069", {
          boxShadow: shadow("#123456", { inset: true }),
        }),
        // sizes outside the limits are clamped (offset 50, blur 100, spread -50)
        image("50000000000a0068", {
          boxShadow: shadow("#336699", { offsetX: 80, offsetY: -90, blur: 150, spread: -70 }),
        }),
      ]),
    ],
    { padding: pad(12) },
  ),

  // 7. A row with its own shadow and a mobile border: the border needs an outer layer of its own.
  row(
    "5000000000000070",
    [
      column("5000000000000071", 100, [
        paragraph("50000000000a0071", "A row with a shadow and a mobile border."),
      ]),
    ],
    {
      padding: pad(20),
      backgroundColor: "#ffffff",
      border: border(0, 14),
      boxShadow: shadow("#111827", { offsetY: 10, blur: 24, spread: -6 }),
      mobile: {
        border: border(2, 14, "#111827"),
        boxShadow: shadow("#111827", { offsetY: 2, blur: 6 }),
        minHeight: 120,
        padding: pad(10),
        backgroundColor: "#eeeeee",
      },
    },
  ),

  // 8. Inset shadows on a row and on a column, desktop and mobile. A row and a column keep the inset.
  row(
    "5000000000000080",
    [
      column(
        "5000000000000081",
        100,
        [paragraph("50000000000a0081", "Inset shadows on a row and on its column.")],
        {
          padding: pad(16),
          backgroundColor: "#ffffff",
          border: border(0, 8),
          boxShadow: shadow("rgba(0, 0, 0, 0.25)", { offsetY: 2, blur: 8, inset: true }),
          mobile: {
            boxShadow: shadow("rgba(0, 0, 0, 0.25)", { offsetY: 1, blur: 4, inset: true }),
          },
        },
      ),
    ],
    {
      padding: pad(16),
      backgroundColor: "#f6f5fc",
      border: border(0, 12),
      boxShadow: shadow("rgba(0, 0, 0, 0.2)", { offsetX: 1, offsetY: 1, blur: 6, spread: 1, inset: true }),
      mobile: {
        boxShadow: shadow("rgba(0, 0, 0, 0.2)", { offsetY: 0, blur: 3, inset: true }),
      },
    },
  ),

  // 9. A square column with a shadow, in a row with no gap. Nothing inside the column has a shadow, so its cell clips
  //    and carries its own; no radius and no gap asks for separate borders, so only the shadow does.
  row(
    "5000000000000090",
    [
      column(
        "5000000000000091",
        100,
        [paragraph("50000000000a0091", "A square column with a shadow.")],
        {
          backgroundColor: "#ffffff",
          boxShadow: shadow("#7c2d12", { offsetY: 3, blur: 10 }),
        },
      ),
    ],
    { padding: pad(20) },
  ),
];

const canvas = {
  language: "en-US",
  preheaderText: "Shadows on rows, columns, images and buttons",
  bodyBackgroundColor: "#f4f4f4",
  backgroundColor: "#ffffff",
  width: 600,
  mobileBreakpoint: 480,
};

// ── Save it the way the editor does, then export what it saved ───────────────

const savedRows = optimizeRows(hydrateRows(clone(rows) as any) as any);
const savedCanvas = optimizeCanvas(hydrateCanvas(clone(canvas) as any) as any);
const optimized = {
  template_id: "k-shadow",
  template_name: "Shadows",
  canvas: savedCanvas,
  rows: savedRows,
  schema_version: "1.0",
};

const exported = await exportTemplate(savedRows, savedCanvas);

const dir = join(outRoot, "k-shadow", "editor");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "optimized.json"), JSON.stringify(optimized, null, 2));
writeFileSync(join(dir, "export.html"), exported.html);
writeFileSync(join(dir, "export.mjml"), exported.mjml);
writeFileSync(join(dir, "export.jsx"), exported.jsx);
console.log(`k-shadow: ${savedRows.length} rows -> ${dir}`);
