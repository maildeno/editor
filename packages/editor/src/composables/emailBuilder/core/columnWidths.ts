// composables/emailBuilder/core/columnWidths.ts
//
// What changing one column's width does to the other columns of its row.
//
// A column's `width` is a percentage of its row, and a row is only valid when
// its columns add up to 100. The canvas paints `width%` as it is, while the
// exporters scale each width to the space left after the gaps and put the
// rounding on the last column, so a row that does not total 100 looks one way
// in the editor and another in the email. Everything here keeps one rule:
//
//   • widths are whole percentages,
//   • no column is narrower than MIN_COLUMN_WIDTH,
//   • the row adds up to exactly 100.
//
// Setting one column clamps it to what the row can afford and the other
// columns share what is left in proportion to their current widths (none of
// them goes below the minimum). Data that breaks the rule is repaired here,
// never trusted: a template from an older version, a hand-edited file or a
// Custom widths layout with decimals can all reach these functions.
//
// Pure functions, no Vue and no editor state, so they are checked on their own
// (scripts/check-column-widths.ts). `setColumnWidths` in
// useEmailBuilderOperations.ts is what writes the result into a row.
//
// Supports up to 100 columns per row; the editor offers six.

/** The narrowest a column can be made, in percent. */
export const MIN_COLUMN_WIDTH = 5;

/**
 * How far a row's total may sit from 100 before it counts as wrong. The same
 * tolerance the Custom widths box in the Layout tab accepts, so a layout it
 * lets you add is never reported as broken.
 */
const TOTAL_TOLERANCE = 0.01;

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/**
 * The minimum that `n` columns can all honour. It is `min` for any row the
 * editor can build (up to 20 columns); a longer row gets a smaller floor so
 * the widths can still add up to 100.
 */
const floorFor = (n: number, min: number): number =>
  Math.max(1, Math.min(min, Math.floor(100 / n)));

/**
 * Largest-remainder rounding: whole numbers that add up to exactly `total`,
 * none below `min`. Shares that sit on the minimum can leave the floors above
 * `total`; the excess is taken back from the widest columns.
 */
function roundToTotal(shares: number[], total: number, min: number): number[] {
  if (shares.length === 0) return [];
  const floors = shares.map((s) => Math.max(min, Math.floor(s + 1e-9)));
  let left = total - sum(floors);
  const order = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) {
    floors[order[k].i]++;
  }
  while (left < 0) {
    const j = floors.indexOf(Math.max(...floors));
    if (floors[j] <= min) break;
    floors[j]--;
    left++;
  }
  return floors;
}

/**
 * Spread `total` over the columns in proportion to `weights`, none below
 * `min`. A column whose share falls under the minimum is pinned at it and the
 * others share what remains ("water-filling"), until nobody is under.
 */
function spreadProportionally(
  weights: number[],
  total: number,
  min: number,
): number[] {
  const n = weights.length;
  const fixed = new Array<boolean>(n).fill(false);
  const out = new Array<number>(n).fill(0);
  for (;;) {
    const free = weights.map((_, i) => i).filter((i) => !fixed[i]);
    const pool = total - fixed.reduce((s, f, i) => s + (f ? out[i] : 0), 0);
    const w = free.reduce((s, i) => s + weights[i], 0) || free.length;
    let changed = false;
    for (const i of free) out[i] = (pool * (weights[i] || 1)) / w;
    for (const i of free) {
      if (out[i] < min) {
        out[i] = min;
        fixed[i] = true;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return roundToTotal(out, total, min);
}

/**
 * Turn any list of widths into a valid one: whole numbers, none below the
 * minimum, adding up to 100. The columns keep their proportions where they
 * can, so `[30, 30]` (a row that totals 60) becomes `[50, 50]` and
 * `[60, 20, 10]` becomes `[67, 22, 11]`. A width that is not a positive
 * number (0, NaN, text, a missing value) counts as 1, so the column still
 * gets a share. A single column is always 100.
 */
export function normalizeWidths(
  widths: number[],
  min: number = MIN_COLUMN_WIDTH,
): number[] {
  const n = widths.length;
  if (n === 0) return [];
  if (n === 1) return [100];
  const weights = widths.map((w) => {
    const x = Number(w);
    return Number.isFinite(x) && x > 0 ? x : 1;
  });
  return spreadProportionally(weights, 100, floorFor(n, min));
}

/**
 * `n` equal columns. The remainder goes to the first column, the same as
 * `addRow` does for a plain column count: 3 columns are `[34, 33, 33]`.
 */
export const equalWidths = (n: number): number[] =>
  normalizeWidths(new Array<number>(n).fill(1));

/**
 * The widest one column of `n` can be: everything the others do not need for
 * their minimum. 95 for two columns, 90 for three. A single column is 100.
 */
export function maxColumnWidth(
  n: number,
  min: number = MIN_COLUMN_WIDTH,
): number {
  if (n <= 1) return 100;
  const lo = floorFor(n, min);
  return Math.max(lo, 100 - lo * (n - 1));
}

/**
 * Give column `index` the width `target`; the other columns share the
 * difference in proportion to their current widths.
 *
 * The target is rounded and clamped to what the row can afford, so the column
 * ends up at `clamp(round(target), MIN, maxColumnWidth(n))`. Incoming widths
 * are repaired first, which means a row that was not valid comes back valid
 * even when the edit itself changes nothing. An `index` outside the row or a
 * target that is not a number changes nothing beyond that repair. Repeating
 * the same edit on its own result returns the same widths.
 *
 * ```
 * setColumnWidth([50, 50], 0, 30)      // [30, 70]
 * setColumnWidth([34, 33, 33], 0, 50)  // [50, 25, 25]
 * setColumnWidth([25, 50, 25], 1, 90)  // [5, 90, 5]  the others stop at the minimum
 * setColumnWidth([50, 50], 1, 100)     // [5, 95]     clamped to what is possible
 * ```
 */
export function setColumnWidth(
  widths: number[],
  index: number,
  target: number,
  min: number = MIN_COLUMN_WIDTH,
): number[] {
  const n = widths.length;
  if (n <= 1) return n === 1 ? [100] : [];

  const base = normalizeWidths(widths, min); // never trust incoming data
  const wanted = Number(target);
  if (!Number.isInteger(index) || index < 0 || index >= n) return base;
  if (Number.isNaN(wanted)) return base;

  const lo = floorFor(n, min);
  const w = clamp(Math.round(wanted), lo, maxColumnWidth(n, min));
  if (w === base[index]) return base;

  const others = base.filter((_, i) => i !== index);
  const spread = spreadProportionally(others, 100 - w, lo);
  const out: number[] = [];
  let k = 0;
  for (let i = 0; i < n; i++) out.push(i === index ? w : spread[k++]);
  return out;
}

/** What the widths add up to. */
export const widthsTotal = sum;

/**
 * True when a row's widths do not add up to 100 (within a hundredth), the
 * sign of a row from before widths were kept to 100. An empty row is not.
 */
export const widthsAreOff = (widths: number[]): boolean =>
  widths.length > 0 && Math.abs(sum(widths) - 100) > TOTAL_TOLERANCE;

/**
 * The widths of a row's columns as numbers, for showing and adding up. A
 * width that is not a finite number (text that is not numeric, a missing
 * value) reads as 0, and numeric text such as `"50"` reads as 50.
 */
export const readWidths = (
  columns: ReadonlyArray<{ width?: unknown }>,
): number[] =>
  columns.map((c) => {
    const n = Number(c?.width);
    return Number.isFinite(n) ? n : 0;
  });

/**
 * A width as it reads in the UI: a whole number as it is, a decimal (from a
 * Custom widths layout) to at most two places, anything else as 0.
 */
export const formatWidth = (w: unknown): string => {
  const n = Number(w);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0";
};
