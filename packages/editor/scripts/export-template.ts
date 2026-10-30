/**
 * export-template.ts
 *
 * Exports a template JSON to HTML, MJML and React Email without a browser, and
 * writes the three files to a folder. Its job is to make "export before and
 * after a change, then diff" repeatable.
 *
 *   cd packages/editor
 *   npx tsx scripts/export-template.ts <template.json> <outDir> [--overrides]
 *
 * Run it at the old revision and at the new one, then compare:
 *
 *   diff -r /tmp/before /tmp/after
 *
 * `--overrides` adds sample `mobile` overrides to the first row, its first
 * column, the first nested row (and its first column) and the first row-spacer,
 * so the mobile CSS they produce shows up in the output. Run from
 * packages/editor so tsx picks up tsconfig.json (the `@/` import alias).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { normalizeTemplateSnapshot } from "../src/composables/emailBuilder/export/targets/templateSnapshot";
import { exportTemplate } from "./lib/headless-export";

const [templatePath, outDir, ...flags] = process.argv.slice(2);
if (!templatePath || !outDir) {
  console.error(
    "usage: npx tsx scripts/export-template.ts <template.json> <outDir> [--overrides]",
  );
  process.exit(2);
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const pad = (n: number) => ({ top: n, right: n, bottom: n, left: n });

const addSampleOverrides = (rows: any[]): void => {
  const row = rows.find((r) => r.type !== "row-spacer");
  const column = row?.columns?.[0];
  if (row)
    row.mobile = { padding: pad(8), backgroundColor: "#101010", minHeight: 40 };
  if (column) {
    column.mobile = { padding: pad(4), verticalAlign: "middle" };
    const nestedRow = (column.children ?? []).find(
      (c: any) => c.type === "row",
    );
    if (nestedRow) {
      nestedRow.mobile = { padding: pad(2) };
      const nestedColumn = nestedRow.columns?.[0];
      if (nestedColumn) nestedColumn.mobile = { verticalAlign: "top" };
    }
  }
  const spacer = rows.find((r) => r.type === "row-spacer");
  if (spacer) spacer.mobile = { height: 12 };
};

const snapshot = normalizeTemplateSnapshot(
  JSON.parse(readFileSync(templatePath, "utf8")),
);
const rows: any[] = clone(snapshot.rows as any[]);
if (flags.includes("--overrides")) addSampleOverrides(rows);

const exported = await exportTemplate(rows, snapshot.canvas);

mkdirSync(outDir, { recursive: true });
const files: Record<string, string> = {
  "export.html": exported.html,
  "export.mjml": exported.mjml,
  "export.jsx": exported.jsx,
};
for (const [name, text] of Object.entries(files)) {
  writeFileSync(`${outDir}/${name}`, text);
  console.log(`${name.padEnd(12)} ${text.length} chars -> ${outDir}/${name}`);
}
