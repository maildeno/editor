/**
 * check-docs-example.ts
 *
 * Checks the JSON example under "Getting content out" in the package README
 * and the five framework guides. The example is a row with one column and a
 * row spacer that carry a sparse `mobile` object, written the way getJson()
 * returns them. It has to be the same text in every file, and it has to be what
 * the editor really saves and exports, so it cannot drift from the code
 * unnoticed.
 *
 *   cd packages/editor
 *   npx tsx scripts/check-docs-example.ts
 *   npx tsx scripts/check-docs-example.ts path/to/guide.md ...
 *
 * With file arguments only those files are read. Run it from packages/editor so
 * tsx picks up tsconfig.json (the `@/` import alias used inside src).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  hydrateCanvas,
  hydrateRows,
} from "../src/composables/emailBuilder/transform/pipeline/hydrate";
import { optimizeRows } from "../src/composables/emailBuilder/transform/pipeline/optimize";
import { normalizeTemplateSnapshot } from "../src/composables/emailBuilder/export/targets/templateSnapshot";
import { exportTemplate } from "./lib/headless-export";

// ─── Tiny harness ─────────────────────────────────────────────────────────────

let failed = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      `FAIL  ${name}\n      ${message.split("\n").slice(0, 12).join("\n      ")}`,
    );
  }
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// ─── Where the example comes from ─────────────────────────────────────────────

const guides = [
  "../README.md",
  "../docs/Vue_Readme.md",
  "../docs/Nuxt_Readme.md",
  "../docs/React_Readme.md",
  "../docs/Vanilla_Readme.md",
  "../docs/Astro_Readme.md",
].map((relative) => fileURLToPath(new URL(relative, import.meta.url)));

const files = process.argv.length > 2 ? process.argv.slice(2) : guides;

/** The first ```json block after the "Getting content out" heading. */
const exampleIn = (path: string): string => {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const heading = text.indexOf("### Getting content out");
  assert.ok(heading >= 0, `${path}: no "Getting content out" heading`);
  const open = text.indexOf("```json\n", heading);
  assert.ok(open >= 0, `${path}: no json block after the heading`);
  const close = text.indexOf("\n```", open + 8);
  assert.ok(close >= 0, `${path}: the json block is not closed`);
  return text.slice(open + 8, close);
};

let examples: string[];
let example: any[];
try {
  examples = files.map(exampleIn);
  example = JSON.parse(examples[0]);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`FAIL  the json example could not be read\n      ${message}`);
  process.exit(1);
}
const exampleText = examples[0];

// ─── The template around the example ──────────────────────────────────────────

const canvas = {
  language: "en-US",
  preheaderText: "",
  bodyBackgroundColor: "#fafafa",
  backgroundColor: "transparent",
  width: 600,
  mobileBreakpoint: 600,
};

const templateOf = (rows: unknown[]) => ({
  template_id: "docs-example",
  template_name: "Docs example",
  canvas,
  rows: clone(rows),
  schema_version: "1.0",
});

/** What the editor holds after loading, and what a save writes from it. */
const load = (rows: unknown[]) => {
  const snapshot = normalizeTemplateSnapshot(clone(templateOf(rows)));
  hydrateCanvas(clone(snapshot.canvas) as any);
  return hydrateRows(clone(snapshot.rows) as any) as any[];
};
const save = (hydrated: unknown[]): any[] =>
  optimizeRows(clone(hydrated) as any) as any[];

const withoutMobile = (value: any): any => {
  if (Array.isArray(value)) return value.map(withoutMobile);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key !== "mobile") out[key] = withoutMobile(inner);
    }
    return out;
  }
  return value;
};
const hasMobile = (value: unknown): boolean =>
  JSON.stringify(value).includes('"mobile"');

// ─── The text in the guides ───────────────────────────────────────────────────

console.log(`Guides: ${files.length} file(s)`);

check(
  "every guide carries the same json block, character for character",
  () => {
    examples.forEach((text, i) =>
      assert.equal(text, exampleText, `${files[i]} differs from ${files[0]}`),
    );
  },
);

// ─── The save format ──────────────────────────────────────────────────────────

console.log("\nSave format");

const hydrated = load(example);
const saved = save(hydrated);

check("the example is what a save writes: same keys, values and order", () => {
  assert.equal(JSON.stringify(saved), JSON.stringify(example));
});

check("saving the saved JSON again changes nothing", () => {
  assert.equal(JSON.stringify(save(load(saved))), JSON.stringify(saved));
});

check(
  "loading gives every node a full mobile baseline, null where unset",
  () => {
    const [row, spacer] = hydrated;
    const column = row.columns[0];
    assert.deepEqual(Object.keys(row.mobile).sort(), [
      "backgroundColor",
      "backgroundGradient",
      "border",
      "gap",
      "minHeight",
      "padding",
    ]);
    assert.deepEqual(Object.keys(column.mobile).sort(), [
      "backgroundColor",
      "backgroundGradient",
      "border",
      "padding",
      "verticalAlign",
    ]);
    assert.deepEqual(Object.keys(spacer.mobile).sort(), [
      "backgroundColor",
      "backgroundGradient",
      "height",
    ]);
    assert.equal(row.mobile.backgroundColor, example[0].mobile.backgroundColor);
    assert.equal(row.mobile.border, null);
    assert.equal(row.mobile.minHeight, null);
    assert.equal(column.mobile.padding, null);
    assert.equal(spacer.mobile.height, example[1].mobile.height);
  },
);

check("the same rows without any mobile key save with none, unchanged", () => {
  const plain = withoutMobile(example);
  const out = save(load(plain));
  assert.equal(hasMobile(out), false);
  assert.equal(JSON.stringify(out), JSON.stringify(plain));
});

check("an all-null mobile baseline saves with no mobile key", () => {
  const nulls = clone(example);
  nulls[0].mobile = {
    backgroundColor: null,
    backgroundGradient: null,
    padding: null,
    border: null,
    minHeight: null,
    gap: null,
  };
  nulls[0].columns[0].mobile = {
    backgroundColor: null,
    backgroundGradient: null,
    padding: null,
    border: null,
    verticalAlign: null,
  };
  nulls[1].mobile = {
    height: null,
    backgroundColor: null,
    backgroundGradient: null,
  };
  assert.equal(hasMobile(save(load(nulls))), false);
});

// ─── The exports ──────────────────────────────────────────────────────────────

console.log("\nExports");

const exported = await exportTemplate(example, canvas);
const plainExport = await exportTemplate(withoutMobile(example), canvas);

/** The text from the first @media rule on, where the mobile rules live. */
const mediaOf = (text: string): string => {
  const at = text.indexOf("@media");
  assert.ok(at >= 0, "no @media rule");
  return text.slice(at);
};

const [row, spacer] = example;
const mobileRow = row.mobile;
const mobilePadding = `${mobileRow.padding.top}px ${mobileRow.padding.right}px ${mobileRow.padding.bottom}px ${mobileRow.padding.left}px`;
const mobileVerticalAlign = row.columns[0].mobile.verticalAlign;
const mobileSpacerHeight = spacer.mobile.height;

const mobileRulesIn = (label: string, text: string) => {
  const media = mediaOf(text);
  assert.ok(
    media.includes(mobileRow.backgroundColor),
    `${label}: row background ${mobileRow.backgroundColor}`,
  );
  assert.ok(
    media.includes(mobilePadding),
    `${label}: row padding ${mobilePadding}`,
  );
  assert.ok(
    new RegExp(`vertical-align:\\s*${mobileVerticalAlign}`).test(media),
    `${label}: column vertical-align ${mobileVerticalAlign}`,
  );
  assert.ok(
    new RegExp(`height:\\s*${mobileSpacerHeight}px`).test(media),
    `${label}: spacer height ${mobileSpacerHeight}px`,
  );
};

check("HTML: the example's mobile values are in the @media rules", () =>
  mobileRulesIn("HTML", exported.html),
);

check("MJML: the same mobile values are written", () =>
  mobileRulesIn("MJML", exported.mjml),
);

check("React Email: the same mobile values are written", () =>
  mobileRulesIn("React Email", exported.jsx),
);

check(
  "HTML: the markup keeps the desktop values, the mobile ones only in <style>",
  () => {
    const markup = exported.html.replace(/<style[\s\S]*?<\/style>/g, "");
    assert.ok(
      markup.includes(row.backgroundColor),
      `desktop background ${row.backgroundColor} missing from the markup`,
    );
    assert.equal(
      markup.includes(mobileRow.backgroundColor),
      false,
      "the mobile background leaked into the markup",
    );
  },
);

check(
  "without the mobile keys the rows get no hook class and no extra rule",
  () => {
    for (const [label, text] of Object.entries(plainExport)) {
      assert.equal(
        text.includes(`eb-${row.id}`),
        false,
        `${label}: row hook class`,
      );
      assert.equal(
        text.includes(`eb-${spacer.id}`),
        false,
        `${label}: spacer hook class`,
      );
      assert.ok(
        text.length < exported[label as keyof typeof exported].length,
        `${label}: the export with overrides should be the longer one`,
      );
    }
  },
);

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
