/**
 * check-export-core.ts
 *
 * Checks the shared export core for `mobile` overrides on rows, columns and
 * row-spacers: the row box and hook classes (export/shared/nodeBox.ts), the
 * mobile CSS generator and the tree walker (export/useEmailExportMobileStyles.ts).
 * Pure functions only: no browser, no Vue app.
 *
 *   npx tsx packages/editor/scripts/check-export-core.ts
 *
 * The "golden" strings below were produced by the 0.4.12 exporters
 * (wrapWithContainerDiv, wrapWithContainerDivReact and emailMobileStyles) before
 * they were changed, so they pin down that templates without overrides keep
 * exactly the markup and CSS they had. The two wrapper helpers have since been
 * replaced by nodeBox.ts.
 */

import assert from "node:assert/strict";
import {
  buildRowBox,
  classAttr,
  columnClasses,
  gapClasses,
  hasNodeMobile,
  nodeHooks,
  renderBoxHtml,
  renderBoxJsx,
  spacerClasses,
} from "../src/composables/emailBuilder/export/shared/nodeBox";
import {
  collectNodeMobileStyles,
  emailNodeMobileStyles,
  mobileBackgroundRules,
  useEmailExportMobileStyles,
} from "../src/composables/emailBuilder/export/useEmailExportMobileStyles";

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

const pad = (n: number) => ({ top: n, right: n, bottom: n, left: n });
const border = { width: 1, style: "solid", color: "#333", radius: 12 };

// ─── Row box: golden markup from 0.4.12 ───────────────────────────────────────

const P = { top: 1, right: 2, bottom: 3, left: 4 };

/**
 * `react` for the simple border is the new property order. 0.4.12 wrote
 * `border` last; the CSS is the same.
 */
const rowBoxGoldens: Array<{
  name: string;
  border?: object;
  padding?: object;
  html: string;
  react: string;
}> = [
  {
    name: "no border, no padding",
    html: '<div style="padding:0px 0px 0px 0px;line-height:0;font-size:0">X</div>',
    react:
      '<div style={{ padding:"0px 0px 0px 0px", lineHeight:"0", fontSize:"0" }}>X</div>',
  },
  {
    name: "no border, padding",
    padding: P,
    html: '<div style="padding:1px 2px 3px 4px;line-height:0;font-size:0">X</div>',
    react:
      '<div style={{ padding:"1px 2px 3px 4px", lineHeight:"0", fontSize:"0" }}>X</div>',
  },
  {
    name: "simple border (one div)",
    border: { width: 2, radius: 0, style: "solid", color: "#111" },
    padding: P,
    html: '<div style="padding:1px 2px 3px 4px;border:2px solid #111;line-height:0;font-size:0">X</div>',
    react:
      '<div style={{ padding:"1px 2px 3px 4px", border:"2px solid #111", lineHeight:"0", fontSize:"0" }}>X</div>',
  },
  {
    name: "radius without a border (still one div)",
    border: { width: 0, radius: 8, style: "solid", color: "#000" },
    padding: P,
    html: '<div style="padding:1px 2px 3px 4px;line-height:0;font-size:0">X</div>',
    react:
      '<div style={{ padding:"1px 2px 3px 4px", lineHeight:"0", fontSize:"0" }}>X</div>',
  },
  {
    name: "radius and border (outer + inner)",
    border: { width: 1, radius: 8, style: "dashed", color: "#f00" },
    padding: P,
    html: '<div style="border-radius:8px;overflow:hidden;line-height:0;font-size:0;border:1px dashed #f00"><div style="padding:1px 2px 3px 4px;line-height:0;font-size:0">X</div></div>',
    react:
      '<div style={{ borderRadius:"8px", overflow:"hidden", lineHeight:"0", fontSize:"0", border:"1px dashed #f00" }}><div style={{ padding:"1px 2px 3px 4px", lineHeight:"0", fontSize:"0" }}>X</div></div>',
  },
  {
    name: "zero border, zero padding",
    border: { width: 0, radius: 0, style: "solid", color: "#000" },
    padding: pad(0),
    html: '<div style="padding:0px 0px 0px 0px;line-height:0;font-size:0">X</div>',
    react:
      '<div style={{ padding:"0px 0px 0px 0px", lineHeight:"0", fontSize:"0" }}>X</div>',
  },
];

console.log("Row box");

for (const g of rowBoxGoldens) {
  check(
    `without overrides: ${g.name} matches the 0.4.12 markup (HTML and React)`,
    () => {
      const box = buildRowBox({
        id: "r",
        border: g.border,
        padding: g.padding,
      });
      assert.equal(renderBoxHtml(box, "X"), g.html);
      assert.equal(renderBoxJsx(box, "X"), g.react);
    },
  );
}

check(
  "the row <td> carries the radius plus two pixels and clips, with no hook class",
  () => {
    const plain = buildRowBox({ id: "r" });
    assert.deepEqual(plain.td.decls, [["overflow", "hidden"]]);
    assert.deepEqual(plain.td.classes, []);
    const round = buildRowBox({ id: "r", border: { radius: 8 } });
    assert.deepEqual(round.td.decls, [
      ["border-radius", "10px"],
      ["overflow", "hidden"],
    ]);
    assert.equal(buildRowBox({ id: "r", minHeight: 120 }).minHeight, 120);
  },
);

check(
  "without overrides there are no hook classes and no class attributes",
  () => {
    const box = buildRowBox({
      id: "r",
      border: rowBoxGoldens[4].border,
      padding: P,
    });
    assert.deepEqual(
      [box.td.classes, box.outer?.classes, box.inner.classes],
      [[], [], []],
    );
    assert.ok(!renderBoxHtml(box, "X").includes("class="));
    assert.ok(!renderBoxJsx(box, "X").includes("className"));
  },
);

check(
  "a mobile border forces the outer element even when the desktop row has no border",
  () => {
    const row = { id: "r1", padding: P, mobile: { border } };
    assert.equal(
      renderBoxHtml(buildRowBox(row), "X"),
      '<div class="eb-r1-outer" style="border-radius:0px;overflow:hidden;line-height:0;font-size:0"><div class="eb-r1-box" style="padding:1px 2px 3px 4px;line-height:0;font-size:0">X</div></div>',
    );
  },
);

check(
  "a desktop simple border moves to the outer element when a mobile border forces it",
  () => {
    const row = {
      id: "r2",
      border: { width: 2, radius: 0, style: "solid", color: "#111" },
      mobile: { border },
    };
    const box = buildRowBox(row);
    assert.ok(
      box.outer?.decls.some(
        ([p, v]) => p === "border" && v === "2px solid #111",
      ),
    );
    assert.ok(!box.inner.decls.some(([p]) => p === "border"));
  },
);

check(
  "a padding-only override keeps the single div, with both hooks on it",
  () => {
    const box = buildRowBox({
      id: "r3",
      padding: P,
      mobile: { padding: pad(2) },
    });
    assert.equal(box.outer, null);
    assert.deepEqual(box.inner.classes, ["eb-r3-box", "eb-r3-outer"]);
    assert.deepEqual(box.td.classes, ["eb-r3"]);
    assert.equal(
      renderBoxHtml(box, "X"),
      '<div class="eb-r3-box eb-r3-outer" style="padding:1px 2px 3px 4px;line-height:0;font-size:0">X</div>',
    );
  },
);

check("hasNodeMobile ignores null and empty overrides", () => {
  assert.equal(hasNodeMobile(undefined), false);
  assert.equal(hasNodeMobile({}), false);
  assert.equal(hasNodeMobile({ mobile: null }), false);
  assert.equal(hasNodeMobile({ mobile: {} }), false);
  assert.equal(
    hasNodeMobile({ mobile: { padding: null, gap: undefined } }),
    false,
  );
  assert.equal(hasNodeMobile({ mobile: { gap: 0 } }), true);
  assert.deepEqual(nodeHooks({ id: "x", mobile: { padding: null } }).root, []);
});

check(
  "column, gap and spacer class lists equal the hand-built ones when there are no overrides",
  () => {
    for (const mobileStack of [true, false]) {
      const row = { id: "r", gap: 12, mobileStack };
      const stack = mobileStack ? " mobile-stack" : "";
      assert.equal(gapClasses(row).join(" "), `gap-12${stack}`);
      assert.equal(columnClasses(row, { id: "c" }).join(" "), stack.trim());
    }
    assert.deepEqual(spacerClasses({ id: "s" }), []);
  },
);

check(
  "hooks on columns, gap cells and spacers appear only with overrides",
  () => {
    assert.deepEqual(
      columnClasses(
        { id: "r", mobileStack: true },
        { id: "c", mobile: { padding: pad(1) } },
      ),
      ["mobile-stack", "eb-c"],
    );
    assert.deepEqual(spacerClasses({ id: "s", mobile: { height: 5 } }), [
      "eb-s",
    ]);
    assert.ok(
      gapClasses({
        id: "g",
        gap: 8,
        mobileStack: true,
        mobile: { gap: 20 },
      }).includes("eb-g-gap"),
    );
    assert.ok(
      !gapClasses({
        id: "g",
        gap: 8,
        mobileStack: false,
        mobile: { gap: 20 },
      }).includes("eb-g-gap"),
    );
    assert.ok(
      !gapClasses({ id: "g", gap: 8, mobileStack: true }).includes("eb-g-gap"),
    );
  },
);

check("classAttr omits the attribute when there are no classes", () => {
  assert.equal(classAttr([]), "");
  assert.equal(classAttr(["a", "b"]), ' class="a b"');
});

// ─── Background rules: extracted from emailMobileStyles ───────────────────────

console.log("\nBackground rules");

const stops = [
  { color: "#111111", position: 0 },
  { color: "#999999", position: 100 },
];
const gradientBg = (extra: object = {}) => ({
  useGradient: true,
  solid: "#111111",
  gradient: { type: "linear", direction: "to right", colors: stops },
  ...extra,
});

check(
  "a gradient emits the solid colour for Outlook and the gradient for the rest",
  () => {
    assert.deepEqual(
      mobileBackgroundRules({ backgroundGradient: gradientBg() }),
      [
        "background-color: #111111 !important",
        "background: linear-gradient(to right, #111111 0%, #999999 100%) !important",
      ],
    );
  },
);

check(
  "solid mode and a standalone colour both reset the background first",
  () => {
    const expected = [
      "background: none !important",
      "background-color: #222222 !important",
    ];
    assert.deepEqual(
      mobileBackgroundRules({
        backgroundGradient: { useGradient: false, solid: "#222222" },
      }),
      expected,
    );
    assert.deepEqual(
      mobileBackgroundRules({ backgroundColor: "#222222" }),
      expected,
    );
  },
);

check(
  "no override, and a gradient with fewer than two stops, behave as in 0.4.12",
  () => {
    assert.deepEqual(mobileBackgroundRules({}), []);
    assert.deepEqual(mobileBackgroundRules({ backgroundGradient: null }), []);
    const oneStop = gradientBg({
      gradient: {
        type: "linear",
        direction: "to right",
        colors: stops.slice(0, 1),
      },
    });
    assert.deepEqual(mobileBackgroundRules({ backgroundGradient: oneStop }), [
      "background: none !important",
      "background-color: #111111 !important",
    ]);
  },
);

check(
  "keepImage emits only the colour layer, so a background image survives",
  () => {
    assert.deepEqual(
      mobileBackgroundRules({ backgroundColor: "#fff" }, { keepImage: true }),
      ["background-color: #fff !important"],
    );
    assert.deepEqual(
      mobileBackgroundRules(
        { backgroundGradient: gradientBg() },
        { keepImage: true },
      ),
      ["background-color: #111111 !important"],
    );
  },
);

check(
  "emailMobileStyles output for components is unchanged (0.4.12 goldens)",
  () => {
    const { emailMobileStyles } = useEmailExportMobileStyles();
    const cases: Array<[any, string]> = [
      [
        {
          id: "c1",
          type: "component",
          componentType: "paragraph",
          props: { mobile: { fontSize: 20, backgroundGradient: gradientBg() } },
        },
        ".eb-c1 { font-size: 20px !important; background-color: #111111 !important; background: linear-gradient(to right, #111111 0%, #999999 100%) !important }",
      ],
      [
        {
          id: "c2",
          type: "component",
          componentType: "button",
          props: {
            mobile: {
              backgroundGradient: { useGradient: false, solid: "#222222" },
            },
          },
        },
        ".eb-c2-link { background: none !important; background-color: #222222 !important }",
      ],
      [
        {
          id: "c3",
          type: "component",
          componentType: "heading",
          props: { mobile: { backgroundColor: "#ffffff" } },
        },
        ".eb-c3 { background: none !important; background-color: #ffffff !important }",
      ],
      [
        {
          id: "c4",
          type: "component",
          componentType: "menu",
          props: { mobileStack: true },
        },
        ".eb-c4-menu-item a { display: block !important; white-space: normal !important; margin-left: 0 !important; margin-right: 0 !important; margin-bottom: 0px !important; }\n.eb-c4-menu-item:last-of-type a { margin-bottom: 0 !important; }",
      ],
    ];
    for (const [comp, css] of cases) {
      assert.equal(
        emailMobileStyles(comp, `eb-${comp.id}`),
        css,
        comp.componentType,
      );
    }
  },
);

// ─── Node CSS generator ───────────────────────────────────────────────────────

console.log("\nNode CSS generator");

const rowOf = (extra: object) => ({
  id: "r",
  type: "row",
  columns: [],
  ...extra,
});

check("row-spacer: height and background", () => {
  assert.equal(
    emailNodeMobileStyles(
      { id: "s", type: "row-spacer", mobile: { height: 12 } },
      "eb-s",
    ),
    ".eb-s { height: 12px !important; line-height: 12px !important }",
  );
  assert.equal(
    emailNodeMobileStyles(
      { id: "s", type: "row-spacer", mobile: { backgroundColor: "#111" } },
      "eb-s",
    ),
    ".eb-s { background: none !important; background-color: #111 !important }",
  );
});

check("row: background and min-height on the td, padding on the box", () => {
  assert.equal(
    emailNodeMobileStyles(
      rowOf({
        mobile: { padding: pad(8), minHeight: 40, backgroundColor: "#101010" },
      }),
      "eb-r",
    ),
    ".eb-r { background: none !important; background-color: #101010 !important; min-height: 40px !important }\n.eb-r-box { padding: 8px 8px 8px 8px !important }",
  );
});

check(
  "row: a border override sets the radius plus two on the td and the border on the outer",
  () => {
    assert.equal(
      emailNodeMobileStyles(rowOf({ mobile: { border } }), "eb-r"),
      ".eb-r { border-radius: 14px !important }\n.eb-r-outer { border: 1px solid #333 !important; border-radius: 12px !important }",
    );
  },
);

check(
  "row with a background image: a mobile colour never emits `background: none`",
  () => {
    const css = emailNodeMobileStyles(
      rowOf({ backgroundImage: "x.png", mobile: { backgroundColor: "#fff" } }),
      "eb-r",
    );
    assert.equal(css, ".eb-r { background-color: #fff !important }");
  },
);

check("row gap applies only when the row is stacked", () => {
  assert.equal(
    emailNodeMobileStyles(
      rowOf({ gap: 12, mobileStack: true, mobile: { gap: 20 } }),
      "eb-r",
    ),
    ".mobile-stack.eb-r-gap { height: 20px !important; line-height: 20px !important; }",
  );
  assert.equal(
    emailNodeMobileStyles(
      rowOf({ gap: 12, mobileStack: false, mobile: { gap: 20 } }),
      "eb-r",
    ),
    "",
  );
});

check(
  "row gap needs a desktop gap: without one there are no gap cells to restyle",
  () => {
    for (const gap of [0, undefined]) {
      assert.equal(
        emailNodeMobileStyles(
          rowOf({ gap, mobileStack: true, mobile: { gap: 20 } }),
          "eb-r",
        ),
        "",
        `desktop gap ${gap}`,
      );
    }
    // A mobile gap of 0 still has something to restyle: it removes the gap.
    assert.equal(
      emailNodeMobileStyles(
        rowOf({ gap: 12, mobileStack: true, mobile: { gap: 0 } }),
        "eb-r",
      ),
      ".mobile-stack.eb-r-gap { height: 0px !important; line-height: 0px !important; }",
    );
  },
);

check("column: padding, border and vertical alignment on the td", () => {
  assert.equal(
    emailNodeMobileStyles(
      { id: "c", mobile: { padding: pad(4), border, verticalAlign: "middle" } },
      "eb-c",
    ),
    ".eb-c { padding: 4px 4px 4px 4px !important; border: 1px solid #333 !important; border-radius: 12px !important; vertical-align: middle !important }",
  );
});

check("nothing is emitted without overrides", () => {
  assert.equal(emailNodeMobileStyles(rowOf({}), "eb-r"), "");
  assert.equal(
    emailNodeMobileStyles(
      rowOf({ mobile: { padding: null, border: null } }),
      "eb-r",
    ),
    "",
  );
  assert.equal(emailNodeMobileStyles({ id: "c", mobile: {} }, "eb-c"), "");
});

check(
  "every class the generator targets exists in the markup the row box renders",
  () => {
    const scenarios: Array<[string, any]> = [
      [
        "padding only",
        rowOf({
          padding: pad(8),
          mobileStack: true,
          gap: 12,
          mobile: { padding: pad(4) },
        }),
      ],
      [
        "mobile border, desktop none",
        rowOf({
          padding: pad(8),
          mobileStack: true,
          gap: 12,
          mobile: { border },
        }),
      ],
      [
        "mobile border over radius and border",
        rowOf({
          border: { width: 2, style: "solid", color: "#000", radius: 6 },
          mobileStack: true,
          gap: 12,
          mobile: { border },
        }),
      ],
      [
        "everything",
        rowOf({
          border: { width: 2, style: "solid", color: "#000", radius: 0 },
          minHeight: 50,
          mobileStack: true,
          gap: 12,
          mobile: {
            padding: pad(4),
            border,
            backgroundColor: "#111",
            minHeight: 20,
            gap: 30,
          },
        }),
      ],
    ];
    for (const [name, row] of scenarios) {
      const css = emailNodeMobileStyles(row, `eb-${row.id}`);
      const wanted = new Set(
        [...css.matchAll(/\.(?:mobile-stack\.)?(eb-[\w-]+)/g)].map((m) => m[1]),
      );
      const box = buildRowBox(row);
      const present = new Set<string>([
        ...box.td.classes,
        ...(box.outer?.classes ?? []),
        ...box.inner.classes,
        ...gapClasses(row),
      ]);
      const missing = [...wanted].filter((c) => !present.has(c));
      assert.deepEqual(
        missing,
        [],
        `${name}: targets classes the markup lacks`,
      );
    }
  },
);

// ─── Tree walker ──────────────────────────────────────────────────────────────

console.log("\nTree walker");

const col = (id: string, children: unknown[] = [], extra: object = {}) => ({
  id,
  children,
  ...extra,
});
const nested = (id: string, columns: unknown[], extra: object = {}) =>
  rowOf({ id, columns, ...extra });
const spacer = (id: string, extra: object = {}) => ({
  id,
  type: "row-spacer",
  ...extra,
});
const selectors = (css: string[]) => css.map((block) => block.split(" ")[0]);
const all = () => true;

const tree = () => [
  nested(
    "r1",
    [
      col(
        "c1",
        [
          nested("n1", [col("nc1", [], { mobile: { verticalAlign: "top" } })], {
            mobile: { padding: pad(2) },
          }),
        ],
        {
          mobile: { padding: pad(4) },
        },
      ),
    ],
    { mobile: { padding: pad(8) } },
  ),
  spacer("s1", { mobile: { height: 12 } }),
];

check(
  "reaches rows, columns, nested rows, nested columns and top-level spacers, in document order",
  () => {
    assert.deepEqual(selectors(collectNodeMobileStyles(tree(), all, 5)), [
      ".eb-r1-box",
      ".eb-c1",
      ".eb-n1-box",
      ".eb-nc1",
      ".eb-s1",
    ]);
  },
);

check("a hidden node is skipped together with everything inside it", () => {
  assert.deepEqual(
    selectors(collectNodeMobileStyles(tree(), (node) => node.id !== "n1", 5)),
    [".eb-r1-box", ".eb-c1", ".eb-s1"],
  );
});

check("the depth limit matches the leaf-component walker", () => {
  const chain = nested("r0", [
    col("c0", [
      nested("n1", [
        col("c1", [nested("n2", [col("c2", [nested("n3", [])])])]),
      ]),
    ]),
  ]);
  const withOverrides = JSON.parse(JSON.stringify(chain));
  const mark = (node: any) => {
    node.mobile = { padding: pad(1) };
    for (const c of node.columns ?? [])
      for (const k of c.children ?? []) mark(k);
  };
  mark(withOverrides);
  assert.deepEqual(
    selectors(collectNodeMobileStyles([withOverrides], all, 2)),
    [".eb-r0-box", ".eb-n1-box", ".eb-n2-box"],
  );
});

check("a template without overrides emits nothing", () => {
  const plain = JSON.parse(JSON.stringify(tree()));
  const strip = (node: any) => {
    delete node.mobile;
    for (const c of node.columns ?? []) {
      delete c.mobile;
      for (const k of c.children ?? []) strip(k);
    }
  };
  plain.forEach(strip);
  assert.deepEqual(collectNodeMobileStyles(plain, all, 5), []);
});

check(
  "legacy shapes: a row without `type`, and a column that still uses `components`",
  () => {
    const legacy = [
      {
        id: "L",
        columns: [
          {
            id: "lc",
            components: [nested("ln", [], { mobile: { padding: pad(1) } })],
          },
        ],
        mobile: { padding: pad(2) },
      },
    ];
    assert.deepEqual(selectors(collectNodeMobileStyles(legacy, all, 5)), [
      ".eb-L-box",
      ".eb-ln-box",
    ]);
  },
);

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
