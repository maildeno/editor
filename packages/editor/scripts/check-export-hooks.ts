/**
 * check-export-hooks.ts
 *
 * End-to-end checks for the mobile override hooks in the exported email. It
 * runs the real export engine headlessly (scripts/lib/headless-export.ts) on a
 * small template and inspects the output.
 *
 *   cd packages/editor
 *   npx tsx scripts/check-export-hooks.ts
 *
 * The property that matters most: every class the mobile CSS targets exists in
 * the exported markup, and nodes without overrides get no hook classes at all.
 * HTML, React Email and MJML are covered.
 */

import assert from "node:assert/strict";
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

// ─── Fixture ──────────────────────────────────────────────────────────────────

const pad = (n: number) => ({ top: n, right: n, bottom: n, left: n });
const border = { width: 1, style: "solid", color: "#333333", radius: 12 };

const leaf = (id: string) => ({
  id,
  type: "component",
  componentType: "spacer",
  props: {},
});
const column = (
  id: string,
  width: number,
  children: unknown[],
  extra: object = {},
) => ({ id, width, verticalAlign: "middle", children, ...extra });
const row = (id: string, columns: unknown[], extra: object = {}) => ({
  id,
  type: "row",
  name: id,
  mobileStack: true,
  columns,
  ...extra,
});
const spacer = (id: string, extra: object = {}) => ({
  id,
  type: "row-spacer",
  height: 25,
  ...extra,
});

/** Every node id that carries overrides, and the control row that does not. */
const OVERRIDDEN = [
  "rA",
  "cA1",
  "nA",
  "ncA",
  "nsA",
  "rB",
  "rC",
  "rD",
  "rE",
  "sTop",
];
const UNTOUCHED = ["rPlain", "cPlain", "cA2", "rMin", "cMin", "rGrad", "cGrad"];

const fixture = (): any[] => [
  // Overrides on every kind of node, including a nested row and nested spacer
  row(
    "rA",
    [
      column(
        "cA1",
        50,
        [
          leaf("lA1"),
          row(
            "nA",
            [
              column("ncA", 100, [leaf("lA2")], {
                padding: { top: 3, right: 5, bottom: 7, left: 9 },
                border: {
                  width: 3,
                  style: "dashed",
                  color: "#556677",
                  radius: 0,
                },
                mobile: { verticalAlign: "top" },
              }),
            ],
            { mobile: { padding: pad(2) } },
          ),
          spacer("nsA", { mobile: { height: 6 } }),
        ],
        { mobile: { padding: pad(4), verticalAlign: "middle" } },
      ),
      column("cA2", 50, [leaf("lA3")]),
    ],
    {
      gap: 12,
      mobile: {
        padding: pad(8),
        backgroundColor: "#101010",
        minHeight: 40,
        gap: 20,
      },
    },
  ),
  // Desktop radius and border (already two elements) plus a mobile border
  row("rB", [column("cB", 100, [leaf("lB")])], {
    border: { ...border, radius: 6 },
    padding: pad(4),
    mobile: { border: { ...border, width: 3 } },
  }),
  // No desktop border, a mobile border: the outer element must be forced
  row("rC", [column("cC", 100, [leaf("lC")])], {
    padding: pad(4),
    mobile: { border },
  }),
  // Desktop simple border, a padding-only override: one element, two hooks
  row("rD", [column("cD", 100, [leaf("lD")])], {
    border: { width: 2, style: "solid", color: "#111111", radius: 0 },
    padding: pad(4),
    mobile: { padding: pad(1) },
  }),
  // A background image must survive a mobile colour override
  row("rE", [column("cE", 100, [leaf("lE")])], {
    backgroundImage: "https://example.com/x.png",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    mobile: { backgroundColor: "#ffffff" },
  }),
  spacer("sTop", { mobile: { height: 12 } }),
  // Control: radius, min-height and padding, and a bordered, padded column,
  // but nothing overridden
  row(
    "rMin",
    [
      column("cMin", 100, [leaf("lM")], {
        padding: pad(3),
        border: { width: 2, style: "solid", color: "#444444", radius: 0 },
      }),
    ],
    {
      minHeight: 80,
      border: { width: 0, radius: 8, style: "solid", color: "#000000" },
      padding: pad(2),
    },
  ),
  // Control: a background colour, which Outlook also gets as a bgcolor
  row("rPlain", [column("cPlain", 100, [leaf("lP")])], {
    padding: pad(4),
    backgroundColor: "#c0ffee",
  }),
  // Control: a gradient background, whose solid colour is the Outlook fallback
  row("rGrad", [column("cGrad", 100, [leaf("lG")])], {
    backgroundGradient: {
      useGradient: true,
      solid: "#123456",
      gradient: {
        type: "linear",
        direction: "to right",
        colors: [
          { color: "#111111", position: 0 },
          { color: "#999999", position: 100 },
        ],
      },
    },
  }),
];

const withoutMobile = (rows: any[]): any[] => {
  const strip = (node: any): void => {
    delete node.mobile;
    for (const col of node.columns ?? []) {
      delete col.mobile;
      (col.children ?? []).forEach(strip);
    }
  };
  const copy = JSON.parse(JSON.stringify(rows));
  copy.forEach(strip);
  return copy;
};

const canvas = { width: 600, mobileBreakpoint: 600 };

// ─── Helpers over the exported text ───────────────────────────────────────────

const styleText = (html: string): string =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join("\n");

/** Every `.eb-...` class the CSS mentions. */
const cssClasses = (html: string): Set<string> =>
  new Set(
    [...styleText(html).matchAll(/\.(eb-[\w-]+)/g)].map((m) => m[1] as string),
  );

/** Every class token that appears in a class="..." attribute. */
const markupClasses = (html: string): Set<string> =>
  new Set(
    [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) =>
      (m[1] as string).split(/\s+/).filter(Boolean),
    ),
  );

const hookFor = (id: string) => new RegExp(`eb-${id}(?![\\w-])`);

// ─── Run ──────────────────────────────────────────────────────────────────────

const withOverrides = await exportTemplate(fixture(), canvas);
const plain = await exportTemplate(withoutMobile(fixture()), canvas);

console.log("HTML export");

check("every class the mobile CSS targets exists in the markup", () => {
  const wanted = [...cssClasses(withOverrides.html)];
  assert.ok(wanted.length >= 9, `expected many rules, got ${wanted.length}`);
  const present = markupClasses(withOverrides.html);
  const missing = wanted.filter((c) => !present.has(c));
  assert.deepEqual(missing, []);
});

check("nodes without overrides get no hook classes, and no CSS", () => {
  for (const id of UNTOUCHED) {
    assert.ok(!hookFor(id).test(withOverrides.html), `eb-${id} appears`);
  }
});

check(
  "a template without any overrides has no node hooks or node CSS at all",
  () => {
    for (const id of [...OVERRIDDEN, ...UNTOUCHED]) {
      assert.ok(!hookFor(id).test(plain.html), `eb-${id} appears`);
    }
  },
);

check("row <td> and the wrapper: one element carries both hooks", () => {
  const html = withOverrides.html;
  assert.ok(html.includes('<td class="eb-rA" style="'), "row td hook");
  assert.ok(
    html.includes('<div class="eb-rA-box eb-rA-outer" style="padding:'),
    "single wrapper with both hooks",
  );
  assert.ok(
    html.includes(
      '<div class="eb-rD-box eb-rD-outer" style="padding:4px 4px 4px 4px;border:2px solid #111111;line-height:0;font-size:0">',
    ),
    "simple border stays on the single wrapper",
  );
});

check(
  "desktop radius and border: outer and inner each carry their hook",
  () => {
    assert.ok(
      withOverrides.html.includes(
        '<div class="eb-rB-outer" style="border-radius:6px;overflow:hidden;line-height:0;font-size:0;border:1px solid #333333"><div class="eb-rB-box" style="padding:4px 4px 4px 4px;line-height:0;font-size:0">',
      ),
    );
  },
);

check(
  "a mobile border forces the outer element on a row with no desktop border",
  () => {
    assert.ok(
      withOverrides.html.includes(
        '<div class="eb-rC-outer" style="border-radius:0px;overflow:hidden;line-height:0;font-size:0"><div class="eb-rC-box" style="padding:4px 4px 4px 4px;line-height:0;font-size:0">',
      ),
    );
  },
);

check(
  "an untouched row <td> keeps its exact style order and gets no class",
  () => {
    const td = withOverrides.html.match(
      /<td( class="[^"]*")? style="([^"]*min-height:80px)"/,
    );
    assert.ok(td, "row td with min-height not found");
    assert.equal(
      td[1],
      undefined,
      "an untouched row td must have no class attribute",
    );
    assert.ok(
      (td[2] as string).endsWith(
        "border-radius:10px;overflow:hidden;min-height:80px",
      ),
      td[2],
    );
  },
);

check("column cells carry the stack class and their hook", () => {
  const html = withOverrides.html;
  assert.ok(html.includes('class="mobile-stack eb-cA1"'));
  assert.ok(html.includes('class="mobile-stack eb-ncA"'));
  assert.ok(
    html.includes('valign="middle" class="mobile-stack" style="'),
    "untouched column keeps its plain class",
  );
});

check(
  "the gap cell carries its hook only for a stacked row with a mobile gap",
  () => {
    assert.ok(
      withOverrides.html.includes('class="gap-12 mobile-stack eb-rA-gap"'),
    );
    assert.ok(
      styleText(withOverrides.html).includes(
        ".mobile-stack.eb-rA-gap { height: 20px !important; line-height: 20px !important; }",
      ),
    );
  },
);

check("top-level and nested spacers carry their hook", () => {
  assert.ok(withOverrides.html.includes('<div class="eb-sTop" height="25"'));
  assert.ok(withOverrides.html.includes('<div class="eb-nsA" height="25"'));
});

check(
  "a mobile colour on an image-backed row never resets the background",
  () => {
    const css = styleText(withOverrides.html);
    assert.ok(css.includes(".eb-rE { background-color: #ffffff !important }"));
    assert.ok(!css.includes(".eb-rE { background: none"));
  },
);

check("the node rules sit inside the mobile media query", () => {
  const css = styleText(withOverrides.html);
  const open = css.indexOf("@media");
  assert.ok(open >= 0, "no media query");
  for (const selector of [".eb-rA-box", ".eb-sTop", ".eb-cA1"]) {
    const at = css.indexOf(selector);
    assert.ok(at > open, `${selector} is not after the @media opening`);
  }
});

// ─── React Email export ───────────────────────────────────────────────────────

console.log("\nReact Email export");

/** The mobile CSS lives in a `const styles = `...`` template literal. */
const jsxStyleText = (jsx: string): string =>
  jsx.match(/const styles = `([\s\S]*?)`/)?.[1] ?? "";

const jsxCssClasses = (jsx: string): Set<string> =>
  new Set(
    [...jsxStyleText(jsx).matchAll(/\.(eb-[\w-]+)/g)].map(
      (m) => m[1] as string,
    ),
  );

const jsxMarkupClasses = (jsx: string): Set<string> =>
  new Set(
    [...jsx.matchAll(/className="([^"]*)"/g)].flatMap((m) =>
      (m[1] as string).split(/\s+/).filter(Boolean),
    ),
  );

check("React: every class the mobile CSS targets exists in the markup", () => {
  const wanted = [...jsxCssClasses(withOverrides.jsx)];
  assert.ok(wanted.length >= 9, `expected many rules, got ${wanted.length}`);
  const present = jsxMarkupClasses(withOverrides.jsx);
  assert.deepEqual(
    wanted.filter((c) => !present.has(c)),
    [],
  );
});

check("React: nodes without overrides get no hook classes", () => {
  for (const id of UNTOUCHED) {
    assert.ok(!hookFor(id).test(withOverrides.jsx), `eb-${id} appears`);
  }
  for (const id of [...OVERRIDDEN, ...UNTOUCHED]) {
    assert.ok(
      !hookFor(id).test(plain.jsx),
      `eb-${id} appears without overrides`,
    );
  }
});

check("React: <Section> and the wrapper carry the hooks", () => {
  const jsx = withOverrides.jsx;
  assert.ok(
    jsx.includes('<Section className="eb-rA" style={{ '),
    "Section hook",
  );
  assert.ok(
    jsx.includes('<div className="eb-rA-box eb-rA-outer" style={{ padding:'),
    "single wrapper with both hooks",
  );
  assert.ok(
    jsx.includes(
      '<div className="eb-rD-box eb-rD-outer" style={{ padding:"4px 4px 4px 4px", border:"2px solid #111111", lineHeight:"0", fontSize:"0" }}>',
    ),
    "simple border stays on the single wrapper",
  );
  assert.ok(
    jsx.includes(
      '<div className="eb-rB-outer" style={{ borderRadius:"6px", overflow:"hidden", lineHeight:"0", fontSize:"0", border:"1px solid #333333" }}><div className="eb-rB-box" style={{ padding:"4px 4px 4px 4px", lineHeight:"0", fontSize:"0" }}>',
    ),
    "radius and border: outer and inner",
  );
});

check(
  "React: a mobile border forces the outer element on a row with no desktop border",
  () => {
    assert.ok(
      withOverrides.jsx.includes(
        '<div className="eb-rC-outer" style={{ borderRadius:"0px", overflow:"hidden", lineHeight:"0", fontSize:"0" }}><div className="eb-rC-box" style={{ padding:"4px 4px 4px 4px", lineHeight:"0", fontSize:"0" }}>',
      ),
    );
  },
);

check("React: columns, gap cells and spacers carry their hooks", () => {
  const jsx = withOverrides.jsx;
  assert.ok(jsx.includes('className="mobile-stack eb-cA1"'));
  assert.ok(jsx.includes('className="mobile-stack eb-ncA"'));
  assert.ok(
    jsx.includes('className="mobile-stack"\nstyle'),
    "an untouched column keeps its plain class",
  );
  assert.ok(jsx.includes('className="gap-12 mobile-stack eb-rA-gap"'));
  assert.ok(jsx.includes('<div className="eb-sTop" style={{ display: "block"'));
  assert.ok(jsx.includes('<div className="eb-nsA" style={{ display: "block"'));
});

check(
  "React: an untouched row <Section> has no class, keeps its style order, and never gets min-height",
  () => {
    const section = withOverrides.jsx.match(
      /<Section( className="[^"]*")? style=\{\{ ([^}]*borderRadius:"10px"[^}]*) \}\}>/,
    );
    assert.ok(section, "row Section with a radius not found");
    assert.equal(
      section[1],
      undefined,
      "an untouched Section must have no className",
    );
    assert.ok(
      (section[2] as string).endsWith('borderRadius:"10px", overflow:"hidden"'),
      section[2],
    );
    assert.ok(
      !/min-?height/i.test(
        withOverrides.jsx.replace(jsxStyleText(withOverrides.jsx), ""),
      ),
      "React Email must not emit a row min-height",
    );
  },
);

check("React: the node rules sit inside the mobile media query", () => {
  const css = jsxStyleText(withOverrides.jsx);
  const open = css.indexOf("@media");
  assert.ok(open >= 0, "no media query");
  for (const selector of [".eb-rA-box", ".eb-sTop", ".eb-cA1"]) {
    assert.ok(
      css.indexOf(selector) > open,
      `${selector} is not after the @media opening`,
    );
  }
});

// ─── MJML export ──────────────────────────────────────────────────────────────

console.log("\nMJML export");

/** The mobile CSS lives in <mj-style> blocks. */
const mjmlStyleText = (mjml: string): string =>
  [...mjml.matchAll(/<mj-style[^>]*>([\s\S]*?)<\/mj-style>/g)]
    .map((m) => m[1])
    .join("\n");

const mjmlCssClasses = (mjml: string): Set<string> =>
  new Set(
    [...mjmlStyleText(mjml).matchAll(/\.(eb-[\w-]+)/g)].map(
      (m) => m[1] as string,
    ),
  );

const countOf = (text: string, needle: string): number =>
  text.split(needle).length - 1;

check("MJML: every class the mobile CSS targets exists in the markup", () => {
  const wanted = [...mjmlCssClasses(withOverrides.mjml)];
  assert.ok(wanted.length >= 9, `expected many rules, got ${wanted.length}`);
  const present = markupClasses(withOverrides.mjml);
  assert.deepEqual(
    wanted.filter((c) => !present.has(c)),
    [],
  );
});

check("MJML: nodes without overrides get no hook classes", () => {
  for (const id of UNTOUCHED) {
    assert.ok(!hookFor(id).test(withOverrides.mjml), `eb-${id} appears`);
  }
  for (const id of [...OVERRIDDEN, ...UNTOUCHED]) {
    assert.ok(
      !hookFor(id).test(plain.mjml),
      `eb-${id} appears without overrides`,
    );
  }
});

check("MJML: the row <td> and the wrapper carry the hooks", () => {
  const mjml = withOverrides.mjml;
  assert.ok(
    /<td class="eb-rA" style="[^"]*overflow:hidden"><div class="eb-rA-box eb-rA-outer" style="padding:0px 0px 0px 0px;line-height:0;font-size:0">/.test(
      mjml,
    ),
    "row td and a single wrapper with both hooks",
  );
  assert.ok(
    mjml.includes(
      '<div class="eb-rD-box eb-rD-outer" style="padding:4px 4px 4px 4px;border:2px solid #111111;line-height:0;font-size:0">',
    ),
    "simple border stays on the single wrapper",
  );
  assert.ok(
    mjml.includes(
      '<div class="eb-rB-outer" style="border-radius:6px;overflow:hidden;line-height:0;font-size:0;border:1px solid #333333"><div class="eb-rB-box" style="padding:4px 4px 4px 4px;line-height:0;font-size:0">',
    ),
    "radius and border: outer and inner",
  );
});

check(
  "MJML: a mobile border forces the outer element on a row with no desktop border",
  () => {
    assert.ok(
      withOverrides.mjml.includes(
        '<div class="eb-rC-outer" style="border-radius:0px;overflow:hidden;line-height:0;font-size:0"><div class="eb-rC-box" style="padding:4px 4px 4px 4px;line-height:0;font-size:0">',
      ),
    );
  },
);

check("MJML: a nested row uses the same shell as a top-level row", () => {
  assert.ok(
    /border-collapse:collapse;"><tr><td class="eb-nA" style="[^"]*overflow:hidden"><div class="eb-nA-box eb-nA-outer" style="padding:0px 0px 0px 0px;line-height:0;font-size:0"><table /.test(
      withOverrides.mjml,
    ),
  );
});

check("MJML: columns, gap cells and spacers carry their hooks", () => {
  const mjml = withOverrides.mjml;
  assert.ok(mjml.includes('class="mobile-stack eb-cA1"'));
  assert.ok(mjml.includes('class="mobile-stack eb-ncA"'));
  assert.ok(
    mjml.includes('valign="middle" class="mobile-stack" style="'),
    "an untouched column keeps its plain class",
  );
  assert.ok(mjml.includes('class="gap-12 mobile-stack eb-rA-gap"'));
  assert.ok(mjml.includes('<div class="eb-sTop" height="25"'));
  assert.ok(mjml.includes('<div class="eb-nsA" height="25"'));
});

check(
  "MJML: an untouched row <td> has no class and keeps its style order",
  () => {
    const td = withOverrides.mjml.match(
      /<td( class="[^"]*")? style="([^"]*min-height:80px)">/,
    );
    assert.ok(td, "row td with min-height not found");
    assert.equal(
      td[1],
      undefined,
      "an untouched row td must have no class attribute",
    );
    assert.ok(
      (td[2] as string).endsWith(
        "border-radius:10px;overflow:hidden;min-height:80px",
      ),
      td[2],
    );
  },
);

check(
  "MJML: a column's border and padding are written once, on its <td>, with no wrapper div",
  () => {
    const mjml = withOverrides.mjml;
    // The nested column and the top-level column both have a border and padding.
    assert.equal(
      countOf(mjml, "border:3px dashed #556677"),
      1,
      "nested border",
    );
    assert.equal(countOf(mjml, "padding:3px 5px 7px 9px"), 1, "nested padding");
    assert.equal(countOf(mjml, "border:2px solid #444444"), 1, "column border");
    assert.equal(countOf(mjml, "padding:3px 3px 3px 3px"), 1, "column padding");
    // The leaf content follows the <td> directly: nothing sits between them.
    assert.ok(
      /class="mobile-stack eb-ncA" style="[^"]*padding:3px 5px 7px 9px"><div style="font-family:none/.test(
        mjml,
      ),
      "nested column",
    );
    assert.ok(
      /border:2px solid #444444[^"]*padding:3px 3px 3px 3px"><div style="font-family:none/.test(
        mjml,
      ),
      "top-level column",
    );
  },
);

check(
  "MJML: the Outlook background colour stays on the conditional table",
  () => {
    const mjml = withOverrides.mjml;
    assert.ok(
      mjml.includes(
        'width="600" bgcolor="#c0ffee"><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->',
      ),
      "a solid background colour",
    );
    assert.ok(
      mjml.includes('width="600" bgcolor="#123456"><tr>'),
      "a gradient row falls back to its solid colour",
    );
  },
);

check("MJML: the node rules sit inside the mobile media query", () => {
  const css = mjmlStyleText(withOverrides.mjml);
  const open = css.indexOf("@media");
  assert.ok(open >= 0, "no media query");
  for (const selector of [".eb-rA-box", ".eb-sTop", ".eb-cA1"]) {
    assert.ok(
      css.indexOf(selector) > open,
      `${selector} is not after the @media opening`,
    );
  }
});

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
