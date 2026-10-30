/**
 * check-canvas-helpers.ts
 *
 * Checks the mobile-override helpers that the canvas and the Preview screen
 * share (src/blocks/canvasStyleHelpers.ts): the merge for components
 * (applyMobileOverrides, resolveMobileProps) and the merge for rows, columns
 * and row-spacers (applyNodeMobileOverrides). Pure functions only: no browser,
 * no Vue app. The components themselves are checked in a browser, see the
 * Batch 6 notes in the doc.
 *
 * The canvas has to show what the email will show, so part of this script
 * compares the helper with the exporter's own rules (emailNodeMobileStyles):
 * whatever the exporter writes CSS for, the canvas applies, and a key the
 * exporter ignores never changes the canvas either.
 *
 *   cd packages/editor && npx tsx scripts/check-canvas-helpers.ts
 */

import assert from "node:assert/strict";
import { ref } from "vue";
import {
  applyMobileOverrides,
  applyNodeMobileOverrides,
  resolveBackground,
  resolveMobileProps,
} from "../src/blocks/canvasStyleHelpers";
import { emailNodeMobileStyles } from "../src/composables/emailBuilder/export/useEmailExportMobileStyles";

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
const border = (radius = 0) => ({
  width: 1,
  style: "solid",
  color: "#cccccc",
  radius,
});

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === "object") {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

const gradient = (a: string, b: string, solid = a) => ({
  useGradient: true,
  solid,
  gradient: {
    type: "linear",
    direction: "to bottom",
    colors: [
      { color: a, position: 0 },
      { color: b, position: 100 },
    ],
  },
});

// ─── Nodes ────────────────────────────────────────────────────────────────────

type Kind = "row" | "stackedRow" | "column" | "spacer";

/** A desktop node of each kind, with a mobile baseline of `mobile`. */
const nodeOf = (kind: Kind, mobile: Record<string, any> | null): any => {
  switch (kind) {
    case "row":
    case "stackedRow":
      return {
        id: "r",
        type: "row",
        columns: [],
        mobileStack: kind === "stackedRow",
        backgroundColor: "#ffffff",
        padding: pad(10),
        border: border(8),
        minHeight: 0,
        gap: 10,
        mobile,
      };
    case "column":
      return {
        id: "c",
        width: 50,
        backgroundColor: "#ffffff",
        padding: pad(10),
        border: border(8),
        verticalAlign: "top",
        children: [],
        mobile,
      };
    case "spacer":
      return {
        id: "s",
        type: "row-spacer",
        height: 20,
        backgroundColor: "#ffffff",
        mobile,
      };
  }
};

const KINDS: Kind[] = ["row", "stackedRow", "column", "spacer"];

/** One sample override per overridable key. */
const sample: Record<string, any> = {
  backgroundColor: "#112233",
  backgroundGradient: gradient("#111111", "#222222"),
  padding: pad(4),
  border: { width: 2, style: "dashed", color: "#445566", radius: 6 },
  minHeight: 77,
  gap: 13,
  verticalAlign: "bottom",
  height: 33,
};

/** Keys of a row, column or row-spacer that the exporters do not honour. */
const strayKeys = [
  "width",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "mobileStack",
  "columns",
  "children",
  "components",
  "id",
  "type",
  "visibility",
  "mobileHide",
  "desktopHide",
  "align",
  "fontSize",
  "color",
];

const sampleFor = (key: string) => sample[key] ?? 7;

/** Does the exporter write any CSS for this one override on this kind? */
const exporterHonours = (kind: Kind, key: string): boolean =>
  emailNodeMobileStyles(nodeOf(kind, { [key]: sampleFor(key) }), "eb-x") !== "";

/** Does the canvas change this key of this kind of node on mobile? */
const canvasApplies = (kind: Kind, key: string): boolean => {
  const node = nodeOf(kind, { [key]: sampleFor(key) });
  const resolved = applyNodeMobileOverrides(node, true);
  return JSON.stringify(resolved[key]) === JSON.stringify(sampleFor(key));
};

// ─── No override, no change ───────────────────────────────────────────────────

check("desktop mode returns the node itself, overrides or not", () => {
  for (const kind of KINDS) {
    const node = nodeOf(kind, { padding: pad(1), height: 5 });
    assert.equal(applyNodeMobileOverrides(node, false), node, kind);
  }
});

check("a node without overrides is returned as it is", () => {
  for (const kind of KINDS) {
    const none = nodeOf(kind, null);
    assert.equal(applyNodeMobileOverrides(none, true), none, `${kind} null`);
    const missing = nodeOf(kind, null);
    delete missing.mobile;
    assert.equal(
      applyNodeMobileOverrides(missing, true),
      missing,
      `${kind} missing`,
    );
  }
  assert.equal(applyNodeMobileOverrides(null, true), null);
  assert.equal(applyNodeMobileOverrides(undefined, true), undefined);
});

check("an all-null baseline gives an equal copy", () => {
  const baseline = {
    backgroundColor: null,
    backgroundGradient: null,
    padding: null,
    border: null,
    minHeight: null,
    gap: null,
    verticalAlign: null,
    height: null,
  };
  for (const kind of KINDS) {
    const node = nodeOf(kind, { ...baseline });
    const out = applyNodeMobileOverrides(node, true);
    assert.deepEqual(out, node, kind);
  }
});

// ─── The merge ────────────────────────────────────────────────────────────────

check("every overridable key replaces the desktop value", () => {
  for (const kind of KINDS) {
    for (const key of Object.keys(sample)) {
      const node = nodeOf(kind, { [key]: sample[key] });
      const out = applyNodeMobileOverrides(node, true);
      assert.notEqual(out, node, `${kind}.${key} must be a copy`);
      // Only a stacked row has a mobile gap (see the gap checks below).
      if (key === "gap" && kind !== "stackedRow") {
        assert.equal(out.gap, node.gap, `${kind}.gap is not applied`);
      } else {
        assert.deepEqual(out[key], sample[key], `${kind}.${key}`);
      }
    }
  }
});

check("padding and border are replaced whole, not merged", () => {
  // The editor always writes all four sides and all four border fields. These
  // are deliberately incomplete to show that nothing is filled in from desktop,
  // which is why a hand-written override has to be complete.
  const node = nodeOf("row", {
    padding: { top: 4 },
    border: { width: 3, style: "solid", color: "#000000" },
  });
  const out = applyNodeMobileOverrides(node, true);
  assert.deepEqual(out.padding, { top: 4 });
  // The desktop radius (8) is not carried over: the override has none.
  assert.deepEqual(out.border, { width: 3, style: "solid", color: "#000000" });
  assert.equal("radius" in out.border, false);
});

check("other overrides leave the rest of the node alone", () => {
  const node = nodeOf("column", { padding: pad(2) });
  const out = applyNodeMobileOverrides(node, true);
  const { padding: _p, ...rest } = out;
  const { padding: _q, ...expected } = node;
  assert.deepEqual(rest, expected);
});

check("a null or undefined override means no override", () => {
  const node = nodeOf("column", {
    padding: null,
    verticalAlign: undefined,
    backgroundColor: "#abcdef",
  });
  const out = applyNodeMobileOverrides(node, true);
  assert.deepEqual(out.padding, pad(10));
  assert.equal(out.verticalAlign, "top");
  assert.equal(out.backgroundColor, "#abcdef");
});

check("a zero is an override, not a missing value", () => {
  const spacer = applyNodeMobileOverrides(
    nodeOf("spacer", { height: 0 }),
    true,
  );
  assert.equal(spacer.height, 0);
  const row = applyNodeMobileOverrides(nodeOf("row", { minHeight: 0 }), true);
  assert.equal(row.minHeight, 0);
});

// ─── Only the keys the exporters honour ───────────────────────────────────────

check("keys the exporters ignore never reach the node", () => {
  for (const kind of KINDS) {
    const mobile: Record<string, any> = {};
    strayKeys.forEach((k, i) => (mobile[k] = `stray-${i}`));
    const node = nodeOf(kind, mobile);
    const out = applyNodeMobileOverrides(node, true);
    // Same keys, same values: the only thing that differs is nothing.
    assert.deepEqual(out, node, kind);
    for (const key of strayKeys) {
      assert.deepEqual(out[key], node[key], `${kind}.${key}`);
    }
  }
});

check(
  "a mobile width or background image does not touch the canvas node",
  () => {
    const column = nodeOf("column", { width: 100, backgroundImage: "x.png" });
    const outColumn = applyNodeMobileOverrides(column, true);
    assert.equal(outColumn.width, 50);
    assert.equal(outColumn.backgroundImage, undefined);

    const row = {
      ...nodeOf("row", { backgroundImage: "x.png" }),
      backgroundImage: "a.png",
    };
    assert.equal(applyNodeMobileOverrides(row, true).backgroundImage, "a.png");
  },
);

// ─── Gap: stacked rows only ───────────────────────────────────────────────────

check("a row's mobile gap applies only while the row is stacked", () => {
  const off = nodeOf("row", { gap: 30 });
  assert.equal(applyNodeMobileOverrides(off, true).gap, 10);

  const unset = nodeOf("row", { gap: 30 });
  delete unset.mobileStack;
  assert.equal(applyNodeMobileOverrides(unset, true).gap, 10);

  const on = nodeOf("stackedRow", { gap: 30 });
  assert.equal(applyNodeMobileOverrides(on, true).gap, 30);
});

check("a row's mobile gap needs a desktop gap", () => {
  // The email has gap cells only when the desktop gap is above zero.
  for (const gap of [0, undefined, null]) {
    const node = { ...nodeOf("stackedRow", { gap: 30 }), gap };
    assert.equal(applyNodeMobileOverrides(node, true).gap, gap, `${gap}`);
  }
});

check("a mobile gap of 0 on a stacked row removes the gap", () => {
  const on = nodeOf("stackedRow", { gap: 0 });
  assert.equal(applyNodeMobileOverrides(on, true).gap, 0);
});

check("the gap rule is the exporter's rule", () => {
  const stacked = nodeOf("stackedRow", { gap: 30 });
  const plain = nodeOf("row", { gap: 30 });
  const noGap = { ...nodeOf("stackedRow", { gap: 30 }), gap: 0 };
  assert.match(
    emailNodeMobileStyles(stacked, "eb-r"),
    /\.mobile-stack\.eb-r-gap/,
  );
  assert.equal(emailNodeMobileStyles(plain, "eb-r"), "");
  assert.equal(emailNodeMobileStyles(noGap, "eb-r"), "");
  assert.equal(applyNodeMobileOverrides(stacked, true).gap, 30);
  assert.equal(applyNodeMobileOverrides(plain, true).gap, 10);
  assert.equal(applyNodeMobileOverrides(noGap, true).gap, 0);
});

// ─── Parity with the exporter ─────────────────────────────────────────────────

check("whatever the exporter writes CSS for, the canvas applies", () => {
  for (const kind of KINDS) {
    for (const key of Object.keys(sample)) {
      if (exporterHonours(kind, key)) {
        assert.ok(canvasApplies(kind, key), `${kind}.${key} is in the email`);
      }
    }
  }
});

check(
  "a key the exporter ignores for every kind never changes the canvas",
  () => {
    for (const key of [...strayKeys, "unknownKey"]) {
      for (const kind of KINDS) {
        assert.equal(
          exporterHonours(kind, key),
          false,
          `exporter ${kind}.${key}`,
        );
        assert.equal(canvasApplies(kind, key), false, `canvas ${kind}.${key}`);
      }
    }
  },
);

check(
  "the honoured keys are the same set in the exporter and the canvas",
  () => {
    const set = (fn: (k: Kind, key: string) => boolean) =>
      Object.keys(sample)
        .filter((key) => KINDS.some((k) => fn(k, key)))
        .sort();
    assert.deepEqual(set(canvasApplies), set(exporterHonours));
    assert.deepEqual(set(exporterHonours), Object.keys(sample).sort());
  },
);

check("which kind honours which key, in the exporter", () => {
  const honoured = (kind: Kind) =>
    Object.keys(sample)
      .filter((key) => exporterHonours(kind, key))
      .sort();
  assert.deepEqual(honoured("row"), [
    "backgroundColor",
    "backgroundGradient",
    "border",
    "minHeight",
    "padding",
  ]);
  assert.deepEqual(honoured("stackedRow"), [
    "backgroundColor",
    "backgroundGradient",
    "border",
    "gap",
    "minHeight",
    "padding",
  ]);
  assert.deepEqual(honoured("column"), [
    "backgroundColor",
    "backgroundGradient",
    "border",
    "padding",
    "verticalAlign",
  ]);
  assert.deepEqual(honoured("spacer"), [
    "backgroundColor",
    "backgroundGradient",
    "height",
  ]);
});

// ─── Background as the canvas draws it ────────────────────────────────────────

/** The editor writes a mobile colour and gradient together (setBackground). */
const editorBackground = (bg: any) => ({
  backgroundColor: bg.useGradient ? bg.gradient.colors[0].color : bg.solid,
  backgroundGradient: bg,
});

check("a mobile gradient over a solid desktop background", () => {
  const bg = gradient("#aa0000", "#0000aa");
  const node = nodeOf("row", editorBackground(bg));
  const css = emailNodeMobileStyles(node, "eb-r");
  const drawn = resolveBackground(applyNodeMobileOverrides(node, true));
  assert.equal(drawn, "linear-gradient(to bottom, #aa0000 0%, #0000aa 100%)");
  assert.ok(css.includes(`background: ${drawn} !important`), css);
  // Desktop is untouched.
  assert.equal(
    resolveBackground(applyNodeMobileOverrides(node, false)),
    "#ffffff",
  );
});

check("a mobile solid over a desktop gradient", () => {
  const solid = {
    useGradient: false,
    solid: "#00aa00",
    gradient: gradient("#000", "#fff").gradient,
  };
  const node = {
    ...nodeOf("column", editorBackground(solid)),
    backgroundColor: "#111111",
    backgroundGradient: gradient("#111111", "#999999"),
  };
  const css = emailNodeMobileStyles(node, "eb-c");
  const drawn = resolveBackground(applyNodeMobileOverrides(node, true));
  assert.equal(drawn, "#00aa00");
  assert.ok(css.includes("background-color: #00aa00 !important"), css);
  assert.ok(!css.includes("gradient"), css);
  // Desktop keeps the gradient.
  assert.match(
    resolveBackground(applyNodeMobileOverrides(node, false)),
    /^linear-gradient/,
  );
});

check("a mobile background on a spacer", () => {
  const node = nodeOf("spacer", {
    height: 44,
    ...editorBackground({
      useGradient: false,
      solid: "#eeeeee",
      gradient: gradient("#000", "#fff").gradient,
    }),
  });
  const out = applyNodeMobileOverrides(node, true);
  assert.equal(out.height, 44);
  assert.equal(resolveBackground(out), "#eeeeee");
  const css = emailNodeMobileStyles(node, "eb-s");
  assert.ok(css.includes("height: 44px !important"), css);
  assert.ok(css.includes("background-color: #eeeeee !important"), css);
});

// ─── Not mutating the input ───────────────────────────────────────────────────

check("the node and its overrides are not changed", () => {
  for (const kind of KINDS) {
    const node = deepFreeze(nodeOf(kind, structuredClone(sample)));
    const before = JSON.stringify(node);
    applyNodeMobileOverrides(node, true);
    applyNodeMobileOverrides(node, false);
    assert.equal(JSON.stringify(node), before, kind);
  }
});

check("a second call after a change in mode reads the node again", () => {
  const node = nodeOf("spacer", { height: 50 });
  assert.equal(applyNodeMobileOverrides(node, true).height, 50);
  assert.equal(applyNodeMobileOverrides(node, false).height, 20);
  node.mobile.height = 60;
  assert.equal(applyNodeMobileOverrides(node, true).height, 60);
});

// ─── Components keep the behaviour they had ───────────────────────────────────

const comp = () => ({
  fontSize: 16,
  color: "#000000",
  width: 100,
  padding: pad(10),
  mobile: {
    fontSize: 12,
    color: null,
    width: undefined,
    padding: { top: 1, right: 2, bottom: 3, left: 4 },
  } as Record<string, any>,
});

check("components: applyMobileOverrides merges every non-null key", () => {
  const out = applyMobileOverrides(comp(), true);
  assert.equal(out.fontSize, 12);
  assert.equal(out.color, "#000000");
  assert.equal(out.width, 100);
  assert.deepEqual(out.padding, { top: 1, right: 2, bottom: 3, left: 4 });
});

check("components: a key outside the node whitelist still applies", () => {
  const p = { ...comp(), mobile: { width: 80, fontSize: 9 } };
  const out = applyMobileOverrides(p, true);
  assert.equal(out.width, 80);
  assert.equal(out.fontSize, 9);
});

check(
  "components: desktop mode and a missing baseline return the props",
  () => {
    const p = comp();
    assert.equal(applyMobileOverrides(p, false), p);
    const bare = { fontSize: 16 };
    assert.equal(applyMobileOverrides(bare, true), bare);
    assert.equal(applyMobileOverrides(null, true), null);
    assert.equal(applyMobileOverrides(undefined, true), undefined);
    const nul = { fontSize: 16, mobile: null };
    assert.equal(applyMobileOverrides(nul, true), nul);
  },
);

check("components: resolveMobileProps follows the preview mode ref", () => {
  const mode = ref("desktop");
  const p = comp();
  assert.equal(resolveMobileProps(p, mode), p);
  mode.value = "mobile";
  assert.deepEqual(resolveMobileProps(p, mode), applyMobileOverrides(p, true));
  assert.equal(resolveMobileProps(p, mode).fontSize, 12);
  mode.value = "desktop";
  assert.equal(resolveMobileProps(p, mode).fontSize, 16);
});

check("components: the props are not changed", () => {
  const p = deepFreeze(comp());
  const before = JSON.stringify(p);
  applyMobileOverrides(p, true);
  assert.equal(JSON.stringify(p), before);
});

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
