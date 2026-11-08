/**
 * check-column-widths.ts
 *
 * Checks the column width rules (src/composables/emailBuilder/core/columnWidths)
 * and the editor operation that writes them into a row (setColumnWidths in
 * useEmailBuilderOperations).
 *
 * The rules: widths are whole percentages, no column is under the minimum, and
 * a row always adds up to exactly 100. Setting one column makes the others
 * share the difference in proportion to their widths. Bad data is repaired.
 *
 * Three parts:
 *   1. The known cases, written out, plus the repair of bad data.
 *   2. A randomized property test with a fixed seed, so a failure repeats. It
 *      runs CASES cases (40,000 by default; CASES=200000 for the long run).
 *   3. The operation, on a real operations instance with two spy history
 *      functions: what it writes, which history function it calls, and what it
 *      refuses to touch.
 *
 * No browser and no Vue app. The Width section of the Column panel is checked
 * in a browser: drag the slider, type a number, press Equalize, undo.
 *
 *   cd packages/editor && npx tsx scripts/check-column-widths.ts
 */

import assert from "node:assert/strict";
import { computed, ref } from "vue";
import {
  MIN_COLUMN_WIDTH,
  equalWidths,
  formatWidth,
  maxColumnWidth,
  normalizeWidths,
  readWidths,
  setColumnWidth,
  widthsAreOff,
  widthsTotal,
} from "../src/composables/emailBuilder/core/columnWidths";
import { useEmailBuilderOperations } from "../src/composables/emailBuilder/core/useEmailBuilderOperations";

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
      `FAIL  ${name}\n      ${message.split("\n").slice(0, 15).join("\n      ")}`,
    );
  }
};

/** What a valid row of `n` columns looks like. The floor is 5 up to 20 columns. */
const floorFor = (n: number) =>
  Math.max(1, Math.min(MIN_COLUMN_WIDTH, Math.floor(100 / n)));

const assertValid = (w: number[]) => {
  const json = JSON.stringify(w);
  assert.equal(widthsTotal(w), 100, `total ${widthsTotal(w)} in ${json}`);
  for (const x of w) {
    assert.ok(Number.isInteger(x), `whole number: ${x} in ${json}`);
    assert.ok(x >= floorFor(w.length), `not under the minimum: ${x} in ${json}`);
  }
};

// ─── 1. Known cases ───────────────────────────────────────────────────────────

const cases: Array<[string, () => number[], number[]]> = [
  ["50 / 50, column 1 to 30", () => setColumnWidth([50, 50], 0, 30), [30, 70]],
  [
    "34 / 33 / 33, column 1 to 50: the others split the rest",
    () => setColumnWidth([34, 33, 33], 0, 50),
    [50, 25, 25],
  ],
  ["one column is always 100", () => setColumnWidth([100], 0, 40), [100]],
  [
    "25 / 50 / 25, column 2 to 90: the others stop at the minimum",
    () => setColumnWidth([25, 50, 25], 1, 90),
    [5, 90, 5],
  ],
  [
    "50 / 50, column 2 to 100 is clamped to 95",
    () => setColumnWidth([50, 50], 1, 100),
    [5, 95],
  ],
  [
    "50 / 50, column 1 to 1 is clamped to the minimum",
    () => setColumnWidth([50, 50], 0, 1),
    [5, 95],
  ],
  [
    "setting a column to the width it has changes nothing",
    () => setColumnWidth([33, 33, 34], 2, 34),
    [33, 33, 34],
  ],
  [
    "unequal others keep their proportions: 20 / 30 / 50, column 3 to 70",
    () => setColumnWidth([20, 30, 50], 2, 70),
    [12, 18, 70],
  ],
  [
    "three columns cannot go past 90 (the other two need 5 each)",
    () => setColumnWidth([34, 33, 33], 0, 95),
    [90, 5, 5],
  ],
  ["equalWidths(3): the remainder goes to the first", () => equalWidths(3), [34, 33, 33]],
  ["equalWidths(4)", () => equalWidths(4), [25, 25, 25, 25]],
  ["equalWidths(1)", () => equalWidths(1), [100]],
  ["equalWidths(0)", () => equalWidths(0), []],
  [
    "equalWidths(20): every column at the minimum",
    () => equalWidths(20),
    new Array<number>(20).fill(5),
  ],
  [
    "a legacy row that adds up to 60 is repaired to 50 / 50",
    () => normalizeWidths([30, 30]),
    [50, 50],
  ],
  [
    "a legacy row that adds up to 90 keeps its proportions",
    () => normalizeWidths([60, 20, 10]),
    [67, 22, 11],
  ],
  [
    "decimals from Custom widths become whole numbers, the extra point going to the biggest remainder",
    () => normalizeWidths([33.33, 33.33, 33.34]),
    [33, 33, 34],
  ],
  [
    "the first change to a decimal row rounds it, then applies the edit",
    () => setColumnWidth([33.33, 33.33, 33.34], 0, 50),
    [50, 25, 25],
  ],
];
for (const [name, got, want] of cases) {
  check(name, () => assert.deepEqual(got(), want));
}

check("a valid row is left exactly as it is", () => {
  for (const w of [[25, 50, 25], [5, 90, 5], [34, 33, 33], [100], [95, 5]]) {
    assert.deepEqual(normalizeWidths(w), w);
  }
});

// ─── Bad data is repaired, never trusted ──────────────────────────────────────

check("0, NaN and missing widths each count as 1", () => {
  assert.deepEqual(normalizeWidths([0, NaN, 10]), normalizeWidths([1, 1, 10]));
  assert.deepEqual(
    normalizeWidths([undefined, null, 10] as unknown as number[]),
    normalizeWidths([1, 1, 10]),
  );
});

check("negative and infinite widths count as 1", () => {
  assert.deepEqual(
    normalizeWidths([-5, Infinity, 20]),
    normalizeWidths([1, 1, 20]),
  );
});

check("numeric text is read as the number", () => {
  assert.deepEqual(
    normalizeWidths(["60", "20", "10"] as unknown as number[]),
    normalizeWidths([60, 20, 10]),
  );
  assert.deepEqual(setColumnWidth([50, 50], 0, "40" as unknown as number), [
    40, 60,
  ]);
});

check("an index outside the row changes nothing beyond the repair", () => {
  for (const bad of [-1, 2, 3, 1.5, NaN, Infinity]) {
    assert.deepEqual(setColumnWidth([40, 60], bad, 10), [40, 60], `index ${bad}`);
  }
  assert.deepEqual(setColumnWidth([30, 30], 7, 10), [50, 50]);
});

check("a target that is not a number changes nothing beyond the repair", () => {
  assert.deepEqual(setColumnWidth([40, 60], 0, NaN), [40, 60]);
  assert.deepEqual(setColumnWidth([40, 60], 0, "abc" as unknown as number), [
    40, 60,
  ]);
  assert.deepEqual(setColumnWidth([30, 30], 0, NaN), [50, 50]);
});

check("an infinite target is clamped like any other", () => {
  assert.deepEqual(setColumnWidth([50, 50], 0, Infinity), [95, 5]);
  assert.deepEqual(setColumnWidth([50, 50], 0, -Infinity), [5, 95]);
});

check("an empty row stays empty", () => {
  assert.deepEqual(normalizeWidths([]), []);
  assert.deepEqual(setColumnWidth([], 0, 50), []);
});

check("the input array is never modified", () => {
  const input = [30, 30, 30];
  const copy = [...input];
  normalizeWidths(input);
  setColumnWidth(input, 1, 80);
  assert.deepEqual(input, copy);
});

check("a row longer than 20 columns still adds up to 100", () => {
  for (const n of [21, 25, 33, 50, 99, 100]) {
    const eq = equalWidths(n);
    assert.equal(eq.length, n);
    assertValid(eq);
    const edited = setColumnWidth(eq, 0, 500);
    assertValid(edited);
    assert.equal(edited[0], maxColumnWidth(n));
  }
});

// ─── Helpers the panel uses ───────────────────────────────────────────────────

check("maxColumnWidth: what the others leave over", () => {
  assert.equal(maxColumnWidth(1), 100);
  assert.equal(maxColumnWidth(2), 95);
  assert.equal(maxColumnWidth(3), 90);
  assert.equal(maxColumnWidth(4), 85);
  assert.equal(maxColumnWidth(6), 75);
  assert.equal(maxColumnWidth(20), 5);
});

check("the slider's maximum is the width setColumnWidth really gives", () => {
  for (let n = 2; n <= 8; n++) {
    const got = setColumnWidth(equalWidths(n), 0, 1000);
    assert.equal(got[0], maxColumnWidth(n), `${n} columns`);
    assertValid(got);
  }
});

check("widthsAreOff: only a total away from 100 counts", () => {
  assert.equal(widthsAreOff([50, 50]), false);
  assert.equal(widthsAreOff([34, 33, 33]), false);
  assert.equal(widthsAreOff([100]), false);
  assert.equal(widthsAreOff([30, 30]), true);
  assert.equal(widthsAreOff([60, 60]), true);
  assert.equal(widthsAreOff([80]), true);
  assert.equal(widthsAreOff([]), false);
});

check("widthsAreOff uses the Layout tab's tolerance of 0.01", () => {
  assert.equal(widthsAreOff([33.33, 33.33, 33.34]), false);
  assert.equal(widthsAreOff([33.335, 33.335, 33.33]), false);
  assert.equal(widthsAreOff([33.3, 33.3, 33.3]), true);
});

check("readWidths: numbers, numeric text, and 0 for anything else", () => {
  assert.deepEqual(
    readWidths([
      { width: 40 },
      { width: "35" },
      {},
      { width: NaN },
      { width: null },
      { width: "abc" },
    ]),
    [40, 35, 0, 0, 0, 0],
  );
});

check("formatWidth: whole numbers as they are, decimals to two places", () => {
  assert.equal(formatWidth(40), "40");
  assert.equal(formatWidth(100), "100");
  assert.equal(formatWidth(33.5), "33.5");
  assert.equal(formatWidth(33.333333), "33.33");
  assert.equal(formatWidth(0.1 + 0.2), "0.3");
  assert.equal(formatWidth("35"), "35");
  assert.equal(formatWidth(undefined), "0");
  assert.equal(formatWidth("abc"), "0");
});

// ─── 2. Randomized property test ──────────────────────────────────────────────

const CASES = Number(process.env.CASES) > 0 ? Number(process.env.CASES) : 40000;

// A small seeded generator, so a failure can be repeated.
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

check(`${CASES} random edits keep every rule`, () => {
  for (let t = 0; t < CASES; t++) {
    // Mostly the rows the editor can build (1 to 6 columns), now and then a
    // long one.
    const n = rnd() < 0.05 ? ri(7, 30) : ri(1, 6);
    const start =
      n === 1
        ? [100]
        : normalizeWidths(Array.from({ length: n }, () => ri(1, 100)));
    assertValid(start);
    assert.deepEqual(normalizeWidths(start), start, "a valid row is unchanged");

    const i = ri(0, n - 1);
    const target = ri(-20, 140);
    const before = [...start];
    const next = setColumnWidth(start, i, target);

    assert.deepEqual(start, before, "input was modified");
    assert.equal(next.length, n);
    assertValid(next);
    if (n > 1) {
      assert.equal(
        next[i],
        Math.min(maxColumnWidth(n), Math.max(floorFor(n), target)),
        `column ${i} of ${JSON.stringify(start)} to ${target}`,
      );
    }
    assert.deepEqual(setColumnWidth(next, i, next[i]), next, "repeating the edit");

    // The columns that were not touched never swap places.
    const rest = start.map((_, k) => k).filter((k) => k !== i);
    for (let a = 0; a < rest.length; a++) {
      for (let b = a + 1; b < rest.length; b++) {
        if (start[rest[a]] > start[rest[b]]) {
          assert.ok(
            next[rest[a]] >= next[rest[b]],
            `order of untouched columns in ${JSON.stringify(start)} -> ${JSON.stringify(next)}`,
          );
        }
      }
    }
  }
});

check(`${CASES} random invalid rows are repaired and edited into valid ones`, () => {
  const junk = () => {
    const r = rnd();
    if (r < 0.1) return NaN;
    if (r < 0.15) return -ri(1, 50);
    if (r < 0.2) return 0;
    return rnd() * 200;
  };
  for (let t = 0; t < CASES; t++) {
    const n = ri(1, 8);
    const bad = Array.from({ length: n }, junk);
    assertValid(normalizeWidths(bad));
    assertValid(setColumnWidth(bad, ri(0, n - 1), ri(-20, 140)));
  }
});

// ─── 3. The operation ─────────────────────────────────────────────────────────

type Call = { kind: "immediate" | "debounced"; action: string };

const makeOps = () => {
  const rows = ref<any[]>([]);
  const selectedId = ref<string | null>(null);
  const calls: Call[] = [];
  const ops = useEmailBuilderOperations(
    rows,
    selectedId,
    {},
    (action) => calls.push({ kind: "immediate", action }),
    (action) => calls.push({ kind: "debounced", action }),
  );
  return { ops, rows, calls };
};
const widthsOf = (row: any): number[] => row.columns.map((c: any) => c.width);

check("setColumnWidths writes the widths and records one immediate step", () => {
  const { ops, rows, calls } = makeOps();
  ops.addRow(3);
  calls.length = 0;
  const row = rows.value[0];

  assert.equal(ops.setColumnWidths(row.id, [50, 25, 25]), true);
  assert.deepEqual(widthsOf(row), [50, 25, 25]);
  assert.deepEqual(calls, [{ kind: "immediate", action: "column-width" }]);
});

check("debounced = true uses the debounced history function only", () => {
  const { ops, rows, calls } = makeOps();
  ops.addRow(2);
  calls.length = 0;

  assert.equal(ops.setColumnWidths(rows.value[0].id, [30, 70], true), true);
  assert.deepEqual(widthsOf(rows.value[0]), [30, 70]);
  assert.deepEqual(calls, [{ kind: "debounced", action: "column-width" }]);
});

check("the same widths: false, nothing written, no history entry", () => {
  const { ops, rows, calls } = makeOps();
  ops.addRow(3);
  calls.length = 0;

  assert.equal(ops.setColumnWidths(rows.value[0].id, [34, 33, 33]), false);
  assert.equal(ops.setColumnWidths(rows.value[0].id, [34, 33, 33], true), false);
  assert.deepEqual(widthsOf(rows.value[0]), [34, 33, 33]);
  assert.equal(calls.length, 0);
});

check("widths are repaired before they are stored", () => {
  const { ops, rows } = makeOps();
  ops.addRow([50, 25, 25]);
  const row = rows.value[0];

  assert.equal(ops.setColumnWidths(row.id, [10, 10, 10]), true);
  assert.deepEqual(widthsOf(row), [34, 33, 33]);

  // 0 and NaN count as 1, so this is 1 : 1 : 10, not what the row has now.
  assert.equal(ops.setColumnWidths(row.id, [0, NaN, 10]), true);
  assert.deepEqual(widthsOf(row), normalizeWidths([1, 1, 10]));
  assertValid(widthsOf(row));
});

check("a width stored as text is replaced by the number", () => {
  const { ops, rows, calls } = makeOps();
  ops.addRow(2);
  const row = rows.value[0];
  row.columns[0].width = "50"; // hand-edited JSON
  calls.length = 0;

  assert.equal(ops.setColumnWidths(row.id, [50, 50]), true);
  assert.equal(row.columns[0].width, 50);
  assert.equal(typeof row.columns[0].width, "number");
  assert.equal(calls.length, 1);
});

check("a row that does not add up to 100 can be fixed", () => {
  const { ops, rows } = makeOps();
  ops.addRow(2);
  const row = rows.value[0];
  row.columns[0].width = 30;
  row.columns[1].width = 30; // a template from before widths were kept to 100
  assert.equal(widthsAreOff(readWidths(row.columns)), true);

  assert.equal(
    ops.setColumnWidths(row.id, normalizeWidths(readWidths(row.columns))),
    true,
  );
  assert.deepEqual(widthsOf(row), [50, 50]);
  assert.equal(widthsAreOff(readWidths(row.columns)), false);
});

check("refused without touching anything: unknown row, wrong count, spacer", () => {
  const { ops, rows, calls } = makeOps();
  ops.addRow(3);
  ops.addSpacer();
  const row = rows.value[0];
  const spacer = rows.value[1];
  calls.length = 0;

  assert.equal(ops.setColumnWidths("no-such-row", [50, 25, 25]), false);
  assert.equal(ops.setColumnWidths(row.id, [50, 50]), false);
  assert.equal(ops.setColumnWidths(row.id, [25, 25, 25, 25]), false);
  assert.equal(ops.setColumnWidths(row.id, []), false);
  assert.equal(ops.setColumnWidths(row.id, null as unknown as number[]), false);
  assert.equal(ops.setColumnWidths(spacer.id, [100]), false);
  assert.equal(ops.setColumnWidths(null as unknown as string, [100]), false);

  assert.deepEqual(widthsOf(row), [34, 33, 33]);
  assert.equal(calls.length, 0);
});

check("a nested row changes on its own; the row around it does not", () => {
  const { ops, rows, calls } = makeOps();
  ops.addRow(2);
  const outer = rows.value[0];
  ops.addNestedRow(outer.id, outer.columns[0].id, 3);
  const nested = outer.columns[0].children[0];
  assert.equal(nested.type, "row");
  calls.length = 0;

  assert.equal(ops.setColumnWidths(nested.id, [60, 20, 20]), true);
  assert.deepEqual(widthsOf(nested), [60, 20, 20]);
  assert.deepEqual(widthsOf(outer), [50, 50]);
  assert.equal(calls.length, 1);

  assert.equal(ops.setColumnWidths(outer.id, [20, 80]), true);
  assert.deepEqual(widthsOf(outer), [20, 80]);
  assert.deepEqual(widthsOf(nested), [60, 20, 20]);
});

check("it changes the row findRow returns, which is what the panel reads", () => {
  const { ops, rows } = makeOps();
  ops.addRow(2);
  const id = rows.value[0].id;

  assert.equal(ops.findRow(id), rows.value[0]);
  ops.setColumnWidths(id, [10, 90]);
  assert.deepEqual(widthsOf(ops.findRow(id)), [10, 90]);
});

check("the change is reactive, so the canvas and the panel follow", () => {
  const { ops, rows } = makeOps();
  ops.addRow(3);
  const shown = computed(() => rows.value[0].columns.map((c: any) => c.width));
  assert.deepEqual(shown.value, [34, 33, 33]);

  ops.setColumnWidths(rows.value[0].id, [50, 25, 25], true);
  assert.deepEqual(shown.value, [50, 25, 25]);
});

check("other row settings and the columns' contents are left alone", () => {
  const { ops, rows } = makeOps();
  ops.addRow(2);
  const row = rows.value[0];
  row.columns[0].backgroundColor = "#ff0000";
  row.gap = 24;
  row.mobileStack = false;
  const ids = row.columns.map((c: any) => c.id);

  ops.setColumnWidths(row.id, [20, 80]);

  assert.deepEqual(
    row.columns.map((c: any) => c.id),
    ids,
  );
  assert.equal(row.columns[0].backgroundColor, "#ff0000");
  assert.equal(row.gap, 24);
  assert.equal(row.mobileStack, false);
});

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
