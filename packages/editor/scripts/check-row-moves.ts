/**
 * check-row-moves.ts
 *
 * Checks moveNestedRow and canMoveNestedRow (useEmailBuilderOperations): the
 * operation behind dragging a row or a spacer into a column, from the canvas
 * and from the Layers panel.
 *
 * The rules: a row or spacer moves into any column, top-level ones included
 * (until 0.4.21 only one that was already nested could). It lands before the
 * item that is at the target slot when you call, also when it moves within one
 * list. A move is refused, changing nothing, when it would put a row inside
 * itself or push a row past the nesting limit (5 levels, counting the rows
 * nested in it); a tree that is already too deep is not made worse. A move
 * that changes nothing records no history step.
 *
 * No browser and no Vue app. Dragging itself is checked in a browser: drop a
 * top-level row and a spacer into a nested column, from the canvas and from the
 * Layers panel, and watch the drop target light up only where it would work.
 *
 *   cd packages/editor && npx tsx scripts/check-row-moves.ts
 */

import assert from "node:assert/strict";
import { ref } from "vue";
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

// ─── Trees ────────────────────────────────────────────────────────────────────

const comp = (id: string) => ({
  id,
  type: "component",
  componentType: "paragraph",
  props: {},
});
const spacer = (id: string) => ({
  id,
  type: "row-spacer",
  name: id,
  height: 20,
});
const col = (id: string, children: any[] = []) => ({
  id,
  width: 100,
  children,
});
const row = (id: any, ...columns: any[]) => ({
  id,
  type: "row",
  name: String(id),
  columns,
});
/** A row with one column, "<id>c", holding `children`. */
const one = (id: string, children: any[] = []) =>
  row(id, col(`${id}c`, children));

/** T0 > D1 > D2 > ... > Dn, one row inside the last one's column each. */
const chain = (n: number) => {
  let inner: any = null;
  for (let i = n; i >= 1; i--) {
    inner = one(`D${i}`, [comp(`p${i}`), ...(inner ? [inner] : [])]);
  }
  return one("T0", [comp("p0"), ...(inner ? [inner] : [])]);
};

/** The tree as text: id[column|column], components and spacers as their id. */
const outline = (nodes: any[]): string =>
  nodes
    .map((n) =>
      n.type === "row"
        ? `${n.id}[${n.columns
            .map((c: any) => outline(c.children ?? c.components ?? []))
            .join("|")}]`
        : String(n.id),
    )
    .join(",");

type Call = { kind: "immediate" | "debounced"; action: string };

const makeOps = (tree: any[]) => {
  const rows = ref<any[]>(tree);
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

/** Runs `fn` and returns what it passed to console.warn. */
const warnings = (fn: () => void): string[] => {
  const seen: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => seen.push(args.join(" "));
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return seen;
};

/**
 * A refused move: false, the tree untouched, no history step, and
 * canMoveNestedRow says no as well. `reason` is the word moveNestedRow logs.
 */
const assertRefused = (
  tree: any[],
  args: [any, any, string | null],
  reason: string | null,
) => {
  const { ops, rows, calls } = makeOps(tree);
  const before = JSON.stringify(rows.value);
  assert.equal(ops.canMoveNestedRow(...args), false, "canMoveNestedRow");
  let moved: boolean | undefined;
  const logged = warnings(() => {
    moved = ops.moveNestedRow(...args, 0);
  });
  assert.equal(moved, false, "moveNestedRow");
  assert.equal(JSON.stringify(rows.value), before, "tree changed");
  assert.deepEqual(calls, [], "history step recorded");
  if (reason === null) assert.deepEqual(logged, [], "should stay silent");
  else assert.deepEqual(logged, [`[moveNestedRow] refused: ${reason}`]);
};

/** An accepted move: true, canMoveNestedRow says yes first, one history step. */
const assertMoves = (
  tree: any[],
  args: [any, any, string | null],
  slot: number,
  expected: string,
) => {
  const { ops, rows, calls } = makeOps(tree);
  const before = JSON.stringify(rows.value);
  assert.equal(ops.canMoveNestedRow(...args), true, "canMoveNestedRow");
  assert.equal(JSON.stringify(rows.value), before, "canMoveNestedRow moved");
  assert.equal(ops.moveNestedRow(...args, slot), true, "moveNestedRow");
  assert.equal(outline(rows.value), expected);
  assert.deepEqual(calls, [{ kind: "immediate", action: "move-nested-row" }]);
};

// ─── 1. Where things can go ───────────────────────────────────────────────────

check("a top-level row moves into a nested column, at the slot given", () => {
  assertMoves(
    [
      one("T1", [comp("p1")]),
      one("T2", [comp("a"), one("N1", [comp("x"), comp("y")]), comp("z")]),
    ],
    ["T1", "N1", "N1c"],
    1,
    "T2[a,N1[x,T1[p1],y],z]",
  );
});

check("a top-level row moves into an empty nested column", () => {
  assertMoves(
    [one("T1", [comp("p1")]), one("T2", [one("N1")])],
    ["T1", "N1", "N1c"],
    0,
    "T2[N1[T1[p1]]]",
  );
});

check("a top-level row moves into a column of another top-level row", () => {
  assertMoves(
    [one("T1", [comp("p1")]), one("T2", [comp("a")])],
    ["T1", "T2", "T2c"],
    1,
    "T2[a,T1[p1]]",
  );
});

check("a top-level spacer moves into a nested column", () => {
  assertMoves(
    [one("T1"), spacer("SP"), one("T2", [one("N1", [comp("x")])])],
    ["SP", "N1", "N1c"],
    99,
    "T1[],T2[N1[x,SP]]",
  );
});

check("a nested row or spacer moves to another column", () => {
  assertMoves(
    [one("T1", [one("N1", [comp("x")]), spacer("S")]), one("T2", [one("M")])],
    ["N1", "M", "Mc"],
    0,
    "T1[S],T2[M[N1[x]]]",
  );
  assertMoves(
    [one("T1", [one("N1", [comp("x")]), spacer("S")]), one("T2", [one("M")])],
    ["S", "M", "Mc"],
    0,
    "T1[N1[x]],T2[M[S]]",
  );
});

check(
  "a nested row or spacer moves up to the top level, at the slot given",
  () => {
    assertMoves(
      [one("T1", [one("N1", [comp("x")])]), one("T2")],
      ["N1", null, null],
      1,
      "T1[],N1[x],T2[]",
    );
    assertMoves(
      [one("T1", [spacer("S")]), one("T2")],
      ["S", null, null],
      0,
      "S,T1[],T2[]",
    );
  },
);

check("the moved row keeps its identity and everything inside it", () => {
  const { ops, rows } = makeOps([
    one("T1", [comp("p1"), one("N", [comp("deep")])]),
    one("T2", [one("M")]),
  ]);
  const node = rows.value[0];
  const snapshot = JSON.stringify(node);
  assert.equal(ops.moveNestedRow("T1", "M", "Mc", 0), true);
  const landed = rows.value[0].columns[0].children[0].columns[0].children[0];
  assert.strictEqual(landed, node);
  assert.equal(JSON.stringify(landed), snapshot);
});

check(
  "a column that only has the legacy `components` key can take a row",
  () => {
    const legacy: any = { id: "Lc", width: 100, components: [comp("a")] };
    const { ops, rows } = makeOps([one("T1"), row("L", legacy)]);
    assert.equal(ops.moveNestedRow("T1", "L", "Lc", 1), true);
    const column = rows.value[0].columns[0];
    assert.equal(outline(column.children), "a,T1[]");
    assert.strictEqual(column.children, column.components);
  },
);

check("ids are compared as text, so a numeric row id works", () => {
  const { ops, rows } = makeOps([row(5, col("fc")), one("T2")]);
  assert.equal(ops.moveNestedRow("5", "T2", "T2c", 0), true);
  assert.equal(outline(rows.value), "T2[5[]]");
  assertRefused([row(5, col("fc"))], [5, 5, "fc"], "inside-itself");
});

// ─── 2. Slots ────────────────────────────────────────────────────────────────

/** The oracle: take the item out, put it before the item that was at `slot`. */
const expectedOrder = (ids: string[], from: number, slot: number) => {
  const item = ids[from];
  const before = ids[slot]; // undefined when slot is the end
  const rest = ids.filter((id) => id !== item);
  if (before === item) return ids;
  const at = before === undefined ? rest.length : rest.indexOf(before);
  return [...rest.slice(0, at), item, ...rest.slice(at)];
};

check(
  "within a column a row lands before the item at the slot, for every from and slot",
  () => {
    const ids = ["s1", "s2", "s3", "s4"];
    for (let from = 0; from < ids.length; from++) {
      for (let slot = 0; slot <= ids.length; slot++) {
        const { ops, rows } = makeOps([one("T", ids.map(spacer))]);
        assert.equal(ops.moveNestedRow(ids[from], "T", "Tc", slot), true);
        assert.deepEqual(
          outline(rows.value[0].columns[0].children).split(","),
          expectedOrder(ids, from, slot),
          `s${from + 1} to slot ${slot}`,
        );
      }
    }
  },
);

check(
  "dropping a nested row below a sibling in its own column no longer lands one slot too low",
  () => {
    // [a, b, c, d]: a dropped after b is slot 2. It used to end up after c.
    assertMoves(
      [one("T", ["a", "b", "c", "d"].map(spacer))],
      ["a", "T", "Tc"],
      2,
      "T[b,a,c,d]",
    );
  },
);

check(
  "among the top-level rows a row lands before the item at the slot too",
  () => {
    const ids = ["T1", "T2", "T3"];
    for (let from = 0; from < ids.length; from++) {
      for (let slot = 0; slot <= ids.length; slot++) {
        const { ops, rows } = makeOps(ids.map((id) => one(id)));
        assert.equal(ops.moveNestedRow(ids[from], null, null, slot), true);
        assert.deepEqual(
          rows.value.map((r: any) => r.id),
          expectedOrder(ids, from, slot),
          `${ids[from]} to slot ${slot}`,
        );
      }
    }
  },
);

check(
  "a move that changes nothing returns true and records no history step",
  () => {
    const { ops, rows, calls } = makeOps([
      one("T", ["a", "b", "c"].map(spacer)),
    ]);
    // slot 1 and slot 2 are both "right where b already is"
    assert.equal(ops.moveNestedRow("b", "T", "Tc", 1), true);
    assert.equal(ops.moveNestedRow("b", "T", "Tc", 2), true);
    assert.equal(outline(rows.value), "T[a,b,c]");
    assert.deepEqual(calls, []);
  },
);

check(
  "a slot past the end appends, a negative one goes first, NaN appends",
  () => {
    const tree = () => [one("T1"), one("T2", ["a", "b"].map(spacer))];
    for (const [slot, expected] of [
      [99, "T2[a,b,T1[]]"],
      [-5, "T2[T1[],a,b]"],
      [Number.NaN, "T2[a,b,T1[]]"],
    ] as const) {
      const { ops, rows } = makeOps(tree());
      assert.equal(ops.moveNestedRow("T1", "T2", "T2c", slot), true);
      assert.equal(outline(rows.value), expected, `slot ${slot}`);
    }
  },
);

// ─── 3. Moves that are refused ────────────────────────────────────────────────

const nest = () => [
  one("T1"),
  one("T2", [comp("a"), one("N1", [comp("x"), one("N2", [comp("y")])])]),
  spacer("SP"),
];

check("a row can't go into itself", () => {
  assertRefused(nest(), ["T2", "T2", "T2c"], "inside-itself");
});

check("a row can't go into a column inside itself", () => {
  assertRefused(nest(), ["T2", "N1", "N1c"], "inside-itself");
  assertRefused(nest(), ["T2", "N2", "N2c"], "inside-itself");
  assertRefused(nest(), ["N1", "N2", "N2c"], "inside-itself");
});

check(
  "a row whose source, target row or target column is missing is refused",
  () => {
    assertRefused(nest(), ["nope", "T2", "T2c"], null);
    assertRefused(nest(), ["T1", "nope", "T2c"], "missing-target");
    assertRefused(nest(), ["T1", "T2", "nope"], "missing-target");
    // a spacer has no columns to move into
    assertRefused(nest(), ["T1", "SP", "T2c"], "missing-target");
  },
);

// ─── 4. The nesting limit ─────────────────────────────────────────────────────
// Depth: a top-level row is 0, the row nested in it 1, and so on. A row's
// contents are only drawn while its own depth is under 5, so a row may sit at
// depth 4 at the deepest; a spacer, which holds nothing, at depth 5.

check("a row can go as deep as depth 4, not one level further", () => {
  const tree = () => [chain(4), one("R", [comp("r")])];
  assertMoves(
    tree(),
    ["R", "D3", "D3c"],
    0,
    "T0[p0,D1[p1,D2[p2,D3[R[r],p3,D4[p4]]]]]",
  );
  assertRefused(tree(), ["R", "D4", "D4c"], "too-deep");
});

check(
  "what is nested inside the row counts: it may not pass depth 4 either",
  () => {
    const tree = () => [chain(4), one("R", [one("Q", [comp("q")])])];
    // R at depth 3 puts Q at depth 4: fine. R at depth 4 would put Q at 5.
    assertMoves(
      tree(),
      ["R", "D2", "D2c"],
      0,
      "T0[p0,D1[p1,D2[R[Q[q]],p2,D3[p3,D4[p4]]]]]",
    );
    assertRefused(tree(), ["R", "D3", "D3c"], "too-deep");
  },
);

check("a spacer can sit one level lower than a row, but no more", () => {
  assertMoves(
    [chain(4), spacer("SP")],
    ["SP", "D4", "D4c"],
    0,
    "T0[p0,D1[p1,D2[p2,D3[p3,D4[SP,p4]]]]]",
  );
  assertRefused([chain(5), spacer("SP")], ["SP", "D5", "D5c"], "too-deep");
});

check(
  "a tree that is already too deep is not made worse, and can be tidied",
  () => {
    // chain(6): D6 is at depth 6. It may move up, sideways or out, never down.
    const tree = () => [chain(6), one("R", [comp("r")])];
    assertRefused(tree(), ["R", "D5", "D5c"], "too-deep");
    assertMoves(
      tree(),
      ["D6", "D5", "D5c"],
      0,
      "T0[p0,D1[p1,D2[p2,D3[p3,D4[p4,D5[D6[p6],p5]]]]]],R[r]",
    ); // reordered in the column it is already in: no deeper than before
    assertMoves(
      tree(),
      ["D6", "D4", "D4c"],
      0,
      "T0[p0,D1[p1,D2[p2,D3[p3,D4[D6[p6],p4,D5[p5]]]]]],R[r]",
    ); // still too deep (depth 5), but shallower than where it was
    assertMoves(
      tree(),
      ["D6", null, null],
      0,
      "D6[p6],T0[p0,D1[p1,D2[p2,D3[p3,D4[p4,D5[p5]]]]]],R[r]",
    );
  },
);

check("the top level takes anything, however deep it came from", () => {
  assertMoves(
    [chain(4)],
    ["D4", null, null],
    1,
    "T0[p0,D1[p1,D2[p2,D3[p3]]]],D4[p4]",
  );
});

check(
  "canMoveNestedRow answers like moveNestedRow and never moves anything",
  () => {
    const trees: Array<[() => any[], [any, any, string | null]]> = [
      [() => [chain(4), one("R")], ["R", "D3", "D3c"]],
      [() => [chain(4), one("R")], ["R", "D4", "D4c"]],
      [nest, ["T1", "N1", "N1c"]],
      [nest, ["T2", "N1", "N1c"]],
      [nest, ["SP", "N2", "N2c"]],
      [nest, ["N2", null, null]],
      [nest, ["gone", "N2", "N2c"]],
    ];
    for (const [tree, args] of trees) {
      const probe = makeOps(tree());
      const before = JSON.stringify(probe.rows.value);
      const can = probe.ops.canMoveNestedRow(...args);
      assert.equal(JSON.stringify(probe.rows.value), before, "was changed");
      assert.deepEqual(probe.calls, [], "recorded history");

      const real = makeOps(tree());
      let moved = false;
      warnings(() => {
        moved = real.ops.moveNestedRow(...args, 0);
      });
      assert.equal(can, moved, JSON.stringify(args));
    }
  },
);

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
