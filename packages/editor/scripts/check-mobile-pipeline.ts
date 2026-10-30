/**
 * check-mobile-pipeline.ts
 *
 * Checks the optimize / hydrate pipelines for `mobile` overrides on rows,
 * columns and row-spacers. Pure functions only: no browser, no Vue app.
 *
 *   npx tsx packages/editor/scripts/check-mobile-pipeline.ts
 *   npx tsx packages/editor/scripts/check-mobile-pipeline.ts path/to/template.json
 *
 * With a template path it also checks that the file loads through
 * normalizeTemplateSnapshot and hydrate, that it round-trips, and (when the
 * template has no `mobile` anywhere) that none appears after a save.
 */

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  hydrateCanvas,
  hydrateRows,
} from "../src/composables/emailBuilder/transform/pipeline/hydrate";
import { optimizeRows } from "../src/composables/emailBuilder/transform/pipeline/optimize";
import { normalizeTemplateSnapshot } from "../src/composables/emailBuilder/export/targets/templateSnapshot";

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

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// ─── Fixture builders ─────────────────────────────────────────────────────────

const pad = (n: number) => ({ top: n, right: n, bottom: n, left: n });

const gradient = (solid: string, useGradient: boolean) => ({
  useGradient,
  solid,
  gradient: {
    type: "linear" as const,
    direction: "to right",
    colors: [
      { color: "#111111", position: 0 },
      { color: "#999999", position: 100 },
    ],
  },
});

const spacerNode = (id: string, extra: object = {}) => ({
  id,
  type: "row-spacer",
  height: 25,
  ...extra,
});
const columnNode = (
  id: string,
  children: unknown[] = [],
  extra: object = {},
) => ({
  id,
  width: 100,
  children,
  ...extra,
});
const rowNode = (id: string, columns: unknown[], extra: object = {}) => ({
  id,
  type: "row",
  name: id,
  columns,
  ...extra,
});
const spacerComponent = (id: string) => ({
  id,
  type: "component",
  componentType: "spacer",
  props: {},
});

/** A desktop gradient with a "solid on mobile" override on top of it. */
const solidOverGradient = () => ({
  backgroundGradient: gradient("#050031", true),
  mobile: {
    backgroundColor: "#222222",
    backgroundGradient: gradient("#222222", false),
  },
});

const fixtureRows = (): any[] => [
  // 0: row with a nested row (inside its column), overrides at every level
  rowNode(
    "r1",
    [
      columnNode(
        "c1",
        [
          spacerComponent("leaf1"),
          rowNode(
            "n1",
            [columnNode("nc1", [], { mobile: { verticalAlign: "top" } })],
            {
              mobile: { padding: pad(2) },
            },
          ),
        ],
        {
          mobile: {
            padding: pad(4),
            verticalAlign: "middle",
            backgroundColor: null,
          },
        },
      ),
    ],
    { mobile: { padding: pad(8), border: null, minHeight: null } },
  ),
  // 1: top-level spacer with an override
  spacerNode("s1", { mobile: { height: 12 } }),
  // 2: a mobile object where every key is null: must vanish on save
  rowNode("r2", [columnNode("c2")], {
    mobile: { backgroundColor: null, padding: null },
  }),
  // 3: spacer with no mobile at all
  spacerNode("s2"),
  // 4 to 6: a solid override on top of a desktop gradient
  rowNode("r3", [columnNode("c3")], solidOverGradient()),
  rowNode("r4", [columnNode("c4", [], solidOverGradient())]),
  spacerNode("s3", solidOverGradient()),
  // 7: a mobile gradient with useGradient:false on a node whose desktop is NOT a gradient
  rowNode("r5", [columnNode("c5")], {
    mobile: {
      backgroundColor: "#333333",
      backgroundGradient: gradient("#333333", false),
    },
  }),
  // 8: a key this version does not know about
  rowNode("r6", [columnNode("c6")], { mobile: { someFutureKey: 1 } }),
];

// ─── Walking helpers ──────────────────────────────────────────────────────────

type Kind = "row" | "column" | "row-spacer";

/** Visits every row, column and row-spacer, including nested ones. */
const walk = (nodes: any[], visit: (node: any, kind: Kind) => void): void => {
  for (const node of nodes) {
    if (node.type === "row-spacer") {
      visit(node, "row-spacer");
      continue;
    }
    visit(node, "row");
    for (const col of node.columns ?? []) {
      visit(col, "column");
      walk(
        (col.children ?? []).filter(
          (c: any) => c.type === "row" || c.type === "row-spacer",
        ),
        visit,
      );
    }
  }
};

const mobileKeysFor: Record<Kind, string[]> = {
  row: [
    "backgroundColor",
    "backgroundGradient",
    "padding",
    "border",
    "minHeight",
    "gap",
  ],
  column: [
    "backgroundColor",
    "backgroundGradient",
    "padding",
    "border",
    "verticalAlign",
  ],
  "row-spacer": ["height", "backgroundColor", "backgroundGradient"],
};

const withoutMobile = (rows: any[]): any[] => {
  const copy = clone(rows);
  walk(copy, (node) => {
    delete node.mobile;
  });
  return copy;
};

const countMobile = (rows: any[]): number => {
  let n = 0;
  walk(rows, (node) => {
    if ("mobile" in node) n++;
  });
  return n;
};

const hydrate = (rows: any[]): any[] =>
  hydrateRows(clone(rows) as any) as any[];
const optimize = (rows: any[]): any[] =>
  optimizeRows(clone(rows) as any) as any[];

// ─── Checks on the built-in fixture ───────────────────────────────────────────

console.log("Fixture checks");

check(
  "hydrate seeds a null baseline on rows, columns, row-spacers and nested rows",
  () => {
    const rows = hydrate(withoutMobile(fixtureRows()));
    let seen = 0;
    walk(rows, (node, kind) => {
      assert.ok(node.mobile, `${kind} ${node.id} has no mobile object`);
      assert.deepEqual(
        Object.keys(node.mobile).sort(),
        [...mobileKeysFor[kind]].sort(),
        `${kind} ${node.id}`,
      );
      for (const key of mobileKeysFor[kind]) {
        assert.equal(node.mobile[key], null, `${kind} ${node.id}.${key}`);
      }
      seen++;
    });
    assert.ok(
      seen >= 12,
      `expected to visit the whole tree, saw ${seen} nodes`,
    );
  },
);

check(
  "hydrate keeps the overrides that are set and leaves the rest null",
  () => {
    const rows = hydrate(fixtureRows());
    const r1 = rows[0];
    assert.deepEqual(r1.mobile.padding, pad(8));
    assert.equal(r1.mobile.border, null);
    assert.equal(r1.columns[0].mobile.verticalAlign, "middle");
    assert.deepEqual(r1.columns[0].mobile.padding, pad(4));
    const nested = r1.columns[0].children[1];
    assert.deepEqual(nested.mobile.padding, pad(2));
    assert.equal(rows[1].mobile.height, 12);
    assert.equal(rows[3].mobile.height, null);
  },
);

check(
  "every node gets its own baseline object, and the defaults are never mutated",
  () => {
    const rows = hydrate(fixtureRows());
    assert.notStrictEqual(rows[1].mobile, rows[3].mobile);
    rows[3].mobile.height = 99;
    assert.equal(rows[1].mobile.height, 12);
    const again = hydrate(fixtureRows());
    assert.equal(again[3].mobile.height, null);
  },
);

check("optimize drops an all-null mobile and a missing one", () => {
  const out = optimize(hydrate(fixtureRows()));
  assert.equal("mobile" in out[2], false, "all-null row");
  assert.equal("mobile" in out[3], false, "spacer without mobile");
  assert.equal("mobile" in out[2].columns[0], false, "its column");
});

check("optimize keeps only the keys that are set", () => {
  const out = optimize(hydrate(fixtureRows()));
  assert.deepEqual(out[0].mobile, { padding: pad(8) });
  assert.deepEqual(out[0].columns[0].mobile, {
    padding: pad(4),
    verticalAlign: "middle",
  });
  assert.deepEqual(out[0].columns[0].children[1].mobile, { padding: pad(2) });
  assert.deepEqual(out[1].mobile, { height: 12 });
});

check(
  "saving twice gives the same JSON: optimize(hydrate(saved)) equals saved",
  () => {
    const saved = optimize(hydrate(fixtureRows()));
    assert.deepEqual(optimize(hydrate(saved)), saved);
  },
);

check(
  "a mobile solid over a desktop gradient survives optimize (row, column, row-spacer)",
  () => {
    const out = optimize(hydrate(fixtureRows()));
    const survivors = [out[4], out[5].columns[0], out[6]];
    for (const node of survivors) {
      assert.equal(node.mobile.backgroundGradient.useGradient, false, node.id);
      assert.equal(node.mobile.backgroundColor, "#222222", node.id);
    }
  },
);

check(
  "a useGradient:false mobile gradient is still dropped when the desktop node is not a gradient",
  () => {
    const out = optimize(hydrate(fixtureRows()));
    assert.deepEqual(out[7].mobile, { backgroundColor: "#333333" });
  },
);

check(
  "keys this version does not know about pass through hydrate and optimize",
  () => {
    const hydrated = hydrate(fixtureRows());
    assert.equal(hydrated[8].mobile.someFutureKey, 1);
    assert.deepEqual(optimize(hydrated)[8].mobile, { someFutureKey: 1 });
  },
);

check("a template with no mobile anywhere saves without gaining any", () => {
  const plain = withoutMobile(fixtureRows());
  assert.equal(countMobile(plain), 0);
  assert.equal(countMobile(optimize(hydrate(plain))), 0);
});

const gradientComponent = (id: string, props: object) => ({
  id,
  type: "component",
  componentType: "spacer",
  props,
});

check(
  "a mobile solid over a desktop gradient survives optimize on components too",
  () => {
    const rows = [
      rowNode("rc", [
        columnNode("cc", [
          gradientComponent("g1", {
            backgroundGradient: gradient("#050031", true),
            mobile: {
              backgroundColor: "#222222",
              backgroundGradient: gradient("#222222", false),
            },
          }),
        ]),
      ]),
    ];
    const mobile = optimize(hydrate(rows))[0].columns[0].children[0].props
      .mobile;
    assert.equal(mobile.backgroundGradient.useGradient, false);
    assert.equal(mobile.backgroundColor, "#222222");
  },
);

check(
  "a useGradient:false mobile gradient is still dropped on components whose desktop is not a gradient",
  () => {
    const rows = [
      rowNode("rc", [
        columnNode("cc", [
          gradientComponent("g2", {
            mobile: {
              backgroundColor: "#333333",
              backgroundGradient: gradient("#333333", false),
            },
          }),
        ]),
      ]),
    ];
    const mobile = optimize(hydrate(rows))[0].columns[0].children[0].props
      .mobile;
    assert.deepEqual(mobile, { backgroundColor: "#333333" });
  },
);

// ─── Checks on a real template file ───────────────────────────────────────────

const templatePath = process.argv[2];
if (templatePath) {
  console.log(`\nTemplate checks: ${templatePath}`);
  const raw = JSON.parse(readFileSync(templatePath, "utf8"));

  check(
    "loads through normalizeTemplateSnapshot, hydrateCanvas and hydrateRows",
    () => {
      const snapshot = normalizeTemplateSnapshot(clone(raw));
      hydrateCanvas(clone(snapshot.canvas) as any);
      const rows = hydrate(snapshot.rows as any[]);
      assert.ok(rows.length > 0, "no rows");
      walk(rows, (node, kind) => {
        assert.ok(node.mobile, `${kind} ${node.id} has no mobile baseline`);
      });
    },
  );

  check("saving twice gives the same JSON", () => {
    const snapshot = normalizeTemplateSnapshot(clone(raw));
    const saved = optimize(hydrate(snapshot.rows as any[]));
    assert.deepEqual(optimize(hydrate(saved)), saved);
  });

  const snapshot = normalizeTemplateSnapshot(clone(raw));
  if (countMobile(snapshot.rows as any[]) === 0) {
    check(
      "saves without gaining any mobile key (the template has none)",
      () => {
        const out = optimize(hydrate(snapshot.rows as any[]));
        assert.equal(countMobile(out), 0);
      },
    );
  } else {
    console.log(
      "SKIP  no-mobile check: the template already has mobile overrides",
    );
  }
}

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
