/**
 * export-saved-fixtures.ts
 *
 * Exports fixtures that are already saved (`tests/fixtures/<name>.json`, in the form the editor's optimizer writes)
 * through the editor in this tree, into the folder layout that `tests/fixtures/gen_expected.py` reads. It answers
 * "does this editor still write what the expected files say?" without rebuilding any template.
 *
 * Usage, from the editor repo:
 *
 *   cp <engine repo>/tests/fixtures/editor-scripts/export-saved-fixtures.ts packages/editor/scripts/
 *   cd packages/editor
 *   npx tsx scripts/export-saved-fixtures.ts <engine repo>/tests/fixtures /tmp/editor-run carrier-space k-text ...
 *
 * Then, from the engine repo, make the expected files into a scratch folder and compare them with the committed ones:
 *
 *   mkdir -p /tmp/check/fixtures/expected
 *   python3 -I tests/fixtures/gen_expected.py /tmp/editor-run /tmp/check carrier-space k-text ...
 *   diff --strip-trailing-cr tests/fixtures/expected/k-text.txt /tmp/check/fixtures/expected/k-text.txt
 *
 * Unlike the script that wrote the first ten fixtures, this one does not pass the template name to the exporters.
 * The name reaches only the page title and the name of the React component, and no fragment looks at either.
 * The list block builds its markup with the DOM, so jsdom (the editor already has it) is put in place first.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { normalizeTemplateSnapshot } from "../src/composables/emailBuilder/export/targets/templateSnapshot";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;

// Imported after the DOM exists, because the block definitions read `document` when they render.
const { exportTemplate } = await import("./lib/headless-export");

const [fixturesDir, outRoot, ...names] = process.argv.slice(2);
if (!fixturesDir || !outRoot || names.length === 0) {
  console.error(
    "usage: npx tsx scripts/export-saved-fixtures.ts <fixtures folder> <runDir> <fixture name> [fixture name ...]",
  );
  process.exit(2);
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

for (const name of names) {
  const text = readFileSync(join(fixturesDir, `${name}.json`), "utf8");
  const snapshot = normalizeTemplateSnapshot(JSON.parse(text));
  const exported = await exportTemplate(clone(snapshot.rows as any[]), snapshot.canvas);

  const dir = join(outRoot, name, "editor");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "optimized.json"), text);
  writeFileSync(join(dir, "export.html"), exported.html);
  writeFileSync(join(dir, "export.mjml"), exported.mjml);
  writeFileSync(join(dir, "export.jsx"), exported.jsx);
  console.log(`${name}: ${exported.html.length} / ${exported.mjml.length} / ${exported.jsx.length} chars -> ${dir}`);
}
