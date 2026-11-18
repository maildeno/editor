/**
 * check-html-import.ts
 *
 * End-to-end checks for the HTML importer (src/composables/emailBuilder/import).
 *
 *   cd packages/editor
 *   npx tsx scripts/check-html-import.ts            # everything
 *   npx tsx scripts/check-html-import.ts styles     # one group, by file name
 *
 * Five groups, run in this order (each is a file in scripts/html-import-checks):
 *
 *   intake      what is refused, removed and reported before any styling is read
 *   styles      the cascade, media queries, units and the mobile diff, as block props
 *   structure   rows, columns, gaps, stacking, nesting, every block type, odd markup
 *   fixtures    real-world HTML in scripts/fixtures/html-import: properties every
 *               import must have (valid, stable, loses no text, survives the export)
 *   roundtrip   Maildeno template -> the real exporter -> import -> the same template
 *
 * The CSS layer on its own is in check-html-import-css.ts.
 */

import { summary } from "./lib/html-import-harness";

const GROUPS = ["intake", "styles", "structure", "fixtures", "roundtrip"] as const;
const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !(GROUPS as readonly string[]).includes(w));
if (unknown.length) {
  console.error(`unknown group: ${unknown.join(", ")} (groups: ${GROUPS.join(", ")})`);
  process.exit(2);
}

for (const name of GROUPS) {
  if (wanted.length && !wanted.includes(name)) continue;
  await import(`./html-import-checks/${name}.ts`);
}

process.exit(summary());
