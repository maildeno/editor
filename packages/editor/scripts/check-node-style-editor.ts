/**
 * check-node-style-editor.ts
 *
 * Checks useNodeStyleEditor (src/composables/emailBuilder/components), the
 * style editor behind the Row, Column and Row-Spacer panels: desktop and mobile
 * reads and writes on a node, the history commits, the background defaults and
 * the border clean-up. Then it follows what the panels write through the two
 * pipelines that matter, the save step (optimizeRows) and the exporter
 * (emailNodeMobileStyles, buildRowBox).
 *
 * No browser and no Vue app. useEmailBuilder, which would inject the shared
 * editor instance, is swapped for a stub that records the history commits
 * (lib/builder-stub-hooks.mjs). The panels themselves are checked in a browser,
 * see the Batch 7 notes in the doc.
 *
 *   cd packages/editor && npx tsx scripts/check-node-style-editor.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import { computed, reactive, ref } from "vue";
import { hydrateRows } from "../src/composables/emailBuilder/transform/pipeline/hydrate";
import { optimizeRows } from "../src/composables/emailBuilder/transform/pipeline/optimize";
import { buildRowBox } from "../src/composables/emailBuilder/export/shared/nodeBox";
import { emailNodeMobileStyles } from "../src/composables/emailBuilder/export/useEmailExportMobileStyles";
import type { EditMode } from "../src/composables/emailBuilder/components/useComponentStyleEditor";

// The stub has to be in place before the editor module is loaded.
register("./lib/builder-stub-hooks.mjs", import.meta.url);
const { useNodeStyleEditor } =
  await import("../src/composables/emailBuilder/components/useNodeStyleEditor");

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
const pad = (n: number) => ({ top: n, right: n, bottom: n, left: n });

// ─── History recorder ─────────────────────────────────────────────────────────

const g = globalThis as unknown as { __historyCalls?: unknown[][] };
const resetHistory = () => {
  g.__historyCalls = [];
};
/** The action names of the commits since the last reset. */
const commits = (): string[] =>
  (g.__historyCalls ?? []).map((c) => String(c[0]));

// ─── Fixtures: real nodes, as hydrate.ts builds them ──────────────────────────

const hydrated = hydrateRows(
  clone([
    {
      id: "r1",
      type: "row",
      columns: [
        { id: "c1", children: [] },
        { id: "c2", children: [] },
      ],
    },
    { id: "s1", type: "row-spacer", height: 20 },
  ]) as any,
) as any[];

const freshRow = (): any => clone(hydrated[0]);
const freshColumn = (): any => clone(hydrated[0].columns[0]);
const freshSpacer = (): any => clone(hydrated[1]);

/** An editor on a reactive node, as the panels get it. */
const open = (node: any, mode: EditMode = "desktop") => {
  const live = reactive(node) as any;
  const editMode = ref<EditMode>(mode);
  const ed = useNodeStyleEditor(
    computed(() => live),
    editMode,
  );
  resetHistory();
  return { node: live, editMode, ed };
};

const BLUE_GREEN = [
  { color: "#007bff", position: 0 },
  { color: "#00ff88", position: 100 },
];
const WHITE_GREY = [
  { color: "#ffffff", position: 0 },
  { color: "#eeeeee", position: 100 },
];
const redToBlue = () => ({
  useGradient: true,
  solid: "#111111",
  gradient: {
    type: "linear" as const,
    direction: "to bottom",
    colors: [
      { color: "#ff0000", position: 0 },
      { color: "#0000ff", position: 100 },
    ],
  },
});

// ─── Plain keys: minHeight, gap, padding, verticalAlign, height ──────────────

check("desktop write goes to the node and leaves mobile alone", () => {
  const { node, ed } = open(freshRow());
  ed.setProp("minHeight", 40);
  assert.equal(node.minHeight, 40);
  assert.equal(node.mobile.minHeight, null);
  assert.deepEqual(commits(), ["set-minHeight"]);
});

check("mobile write goes to node.mobile and leaves the desktop value", () => {
  const { node, ed } = open(freshRow(), "mobile");
  ed.setProp("minHeight", 90);
  assert.equal(node.mobile.minHeight, 90);
  assert.equal(node.minHeight, 0);
  assert.deepEqual(commits(), ["set-minHeight"]);
});

check("displayValue follows the mode and falls back key by key", () => {
  const { node, editMode, ed } = open(freshRow(), "mobile");
  node.minHeight = 30;
  assert.equal(ed.displayValue("minHeight"), 30, "no override: desktop value");
  node.mobile.minHeight = 70;
  assert.equal(ed.displayValue("minHeight"), 70);
  assert.equal(ed.displayValue("gap"), 12, "gap has no override");
  editMode.value = "desktop";
  assert.equal(ed.displayValue("minHeight"), 30, "desktop mode ignores mobile");
});

check("isOverridden is true in mobile mode only, and only for set keys", () => {
  const { node, editMode, ed } = open(freshRow(), "mobile");
  assert.equal(ed.isOverridden("minHeight"), false);
  node.mobile.minHeight = 0;
  assert.equal(ed.isOverridden("minHeight"), true, "0 is a value, not unset");
  assert.equal(ed.isOverridden("gap"), false);
  editMode.value = "desktop";
  assert.equal(ed.isOverridden("minHeight"), false);
});

check(
  "resetProp nulls the override with one commit; desktop reset is a no-op",
  () => {
    const { node, editMode, ed } = open(freshRow(), "mobile");
    ed.setProp("gap", 4);
    resetHistory();
    ed.resetProp("gap");
    assert.equal(node.mobile.gap, null);
    assert.equal(ed.displayValue("gap"), 12);
    assert.deepEqual(commits(), ["reset-gap"]);

    editMode.value = "desktop";
    resetHistory();
    ed.resetProp("gap");
    assert.deepEqual(commits(), [], "nothing to reset on desktop");
    assert.equal(node.gap, 12);
  },
);

check(
  "a node without `mobile` (never hydrated) reads fine and gets one on the first write",
  () => {
    for (const missing of [undefined, null]) {
      const raw = freshRow();
      if (missing === undefined) delete raw.mobile;
      else raw.mobile = null;
      const { node, ed } = open(raw, "mobile");
      assert.equal(ed.displayValue("minHeight"), 0);
      assert.equal(ed.isOverridden("minHeight"), false);
      assert.equal(ed.isBackgroundOverridden(), false);
      assert.equal(ed.isBorderOverridden(), false);
      ed.setProp("minHeight", 10);
      assert.deepEqual(node.mobile, { minHeight: 10 });
    }
  },
);

check("padding is written as a complete object and null clears it", () => {
  const { node, ed } = open(freshRow(), "mobile");
  ed.setProp("padding", pad(8));
  assert.deepEqual(node.mobile.padding, pad(8));
  assert.deepEqual(node.padding, pad(0), "desktop padding untouched");
  assert.equal(ed.isOverridden("padding"), true);
  ed.setProp("padding", null); // what the SpacingControl Reset button emits
  assert.equal(node.mobile.padding, null);
  assert.equal(ed.isOverridden("padding"), false);
});

check("column: vertical align overrides on mobile only", () => {
  const { node, ed, editMode } = open(freshColumn(), "mobile");
  ed.setProp("verticalAlign", "middle");
  assert.equal(node.mobile.verticalAlign, "middle");
  assert.equal(node.verticalAlign, "top");
  assert.equal(ed.displayValue("verticalAlign"), "middle");
  editMode.value = "desktop";
  assert.equal(ed.displayValue("verticalAlign"), "top");
});

check("row-spacer: height overrides on mobile only", () => {
  const { node, ed, editMode } = open(freshSpacer(), "mobile");
  ed.setProp("height", 60);
  assert.equal(node.mobile.height, 60);
  assert.equal(node.height, 20);
  editMode.value = "desktop";
  assert.equal(ed.displayValue("height"), 20);
  ed.setProp("height", 25);
  assert.equal(node.height, 25);
  assert.equal(node.mobile.height, 60);
});

// ─── Background ───────────────────────────────────────────────────────────────

check(
  "display defaults: the panels' white-to-grey stops, not the composable's blue-to-green",
  () => {
    const row = open(freshRow()).ed.displayBackground();
    assert.deepEqual(row.gradient.colors, WHITE_GREY);
    assert.equal(row.useGradient, false);
    assert.equal(row.solid, "#ffffff");
    assert.equal(row.gradient.type, "linear");
    assert.equal(row.gradient.direction, "to right");

    const spacer = open(freshSpacer()).ed.displayBackground();
    assert.equal(spacer.solid, "transparent");

    // A node saved without a gradient object (an old template) gets the same stops.
    const bare = freshColumn();
    delete bare.backgroundGradient;
    bare.backgroundColor = "#abcdef";
    const bareBg = open(bare).ed.displayBackground();
    assert.deepEqual(bareBg.gradient.colors, WHITE_GREY);
    assert.notDeepEqual(bareBg.gradient.colors, BLUE_GREEN);
    assert.equal(bareBg.solid, "#abcdef");

    // A partial gradient keeps what it has and borrows the rest.
    const partial = freshColumn();
    partial.backgroundGradient = {
      useGradient: true,
      solid: "#123456",
      gradient: { direction: "to left" },
    };
    const partialBg = open(partial).ed.displayBackground();
    assert.equal(partialBg.gradient.direction, "to left");
    assert.equal(partialBg.gradient.type, "linear");
    assert.deepEqual(partialBg.gradient.colors, WHITE_GREY);
  },
);

check(
  "the solid colour is the gradient object's `solid`, then backgroundColor, else transparent",
  () => {
    const a = freshRow();
    a.backgroundGradient.solid = "#111111";
    a.backgroundColor = "#222222";
    assert.equal(open(a).ed.displayBackground().solid, "#111111");

    const b = freshRow();
    b.backgroundGradient.solid = "transparent";
    b.backgroundColor = "#222222";
    assert.equal(open(b).ed.displayBackground().solid, "#222222");

    const c = freshRow();
    c.backgroundGradient.solid = "transparent";
    c.backgroundColor = "transparent";
    assert.equal(open(c).ed.displayBackground().solid, "transparent");
  },
);

check(
  "mobile background write: both keys, one commit, desktop untouched",
  () => {
    const { node, ed } = open(freshRow(), "mobile");
    ed.setBackground(redToBlue());
    assert.deepEqual(commits(), ["set-background"]);
    assert.equal(
      node.mobile.backgroundColor,
      "#ff0000",
      "first stop is the fallback",
    );
    assert.deepEqual(node.mobile.backgroundGradient, redToBlue());
    assert.equal(node.backgroundColor, "#ffffff");
    assert.equal(node.backgroundGradient.useGradient, false);
    assert.equal(ed.isBackgroundOverridden(), true);
    const shown = ed.displayBackground();
    assert.equal(shown.useGradient, true);
    assert.deepEqual(shown.gradient.colors, redToBlue().gradient.colors);
  },
);

check(
  "desktop mode shows the desktop background while an override exists",
  () => {
    const { node, editMode, ed } = open(freshRow(), "mobile");
    ed.setBackground(redToBlue());
    editMode.value = "desktop";
    assert.equal(ed.displayBackground().useGradient, false);
    assert.equal(ed.displayBackground().solid, "#ffffff");
    assert.equal(ed.isBackgroundOverridden(), false);
    assert.equal(node.mobile.backgroundColor, "#ff0000");
  },
);

check("resetBackground clears both keys with one commit", () => {
  const { node, ed } = open(freshRow(), "mobile");
  ed.setBackground(redToBlue());
  resetHistory();
  ed.resetBackground();
  assert.equal(node.mobile.backgroundColor, null);
  assert.equal(node.mobile.backgroundGradient, null);
  assert.deepEqual(commits(), ["reset-background"]);
  assert.equal(ed.isBackgroundOverridden(), false);
  assert.equal(ed.displayBackground().useGradient, false);
});

check(
  "a colour-only mobile override (no gradient object) counts as overridden",
  () => {
    const { node, ed } = open(freshRow(), "mobile");
    node.mobile.backgroundColor = "#00ff00";
    assert.equal(ed.isBackgroundOverridden(), true);
    ed.resetBackground();
    assert.equal(ed.isBackgroundOverridden(), false);
  },
);

check(
  "desktop background write keeps backgroundColor in step, one commit",
  () => {
    const { node, ed } = open(freshSpacer());
    ed.setBackground(redToBlue());
    assert.deepEqual(commits(), ["set-background"]);
    assert.equal(node.backgroundColor, "#ff0000");
    assert.equal(node.backgroundGradient.useGradient, true);
    assert.equal(node.mobile.backgroundGradient, null);
  },
);

// ─── Border ───────────────────────────────────────────────────────────────────

const desktopBorder = () => ({
  width: 2,
  style: "dashed",
  color: "#336699",
  radius: 6,
});
const withBorder = () => {
  const row = freshRow();
  row.border = desktopBorder();
  return row;
};

check(
  "first mobile border edit writes a complete border with one field changed",
  () => {
    const { node, ed } = open(withBorder(), "mobile");
    ed.setBorderProp("width", 5);
    assert.deepEqual(node.mobile.border, { ...desktopBorder(), width: 5 });
    assert.deepEqual(node.border, desktopBorder(), "desktop border untouched");
    assert.deepEqual(commits(), ["set-border-width"]);
    assert.equal(ed.isBorderOverridden(), true);
    assert.equal(ed.isBorderPropOverridden("width"), true);
    for (const k of ["style", "color", "radius"] as const) {
      assert.equal(ed.isBorderPropOverridden(k), false, k);
    }
    assert.equal(ed.displayBorderValue("width"), 5);
    assert.equal(ed.displayBorderValue("color"), "#336699");
  },
);

check("resetting the only overridden field removes the mobile border", () => {
  const { node, ed } = open(withBorder(), "mobile");
  ed.setBorderProp("radius", 0);
  assert.ok(node.mobile.border);
  ed.resetBorderProp("radius");
  assert.equal(node.mobile.border, null);
  assert.equal(ed.isBorderOverridden(), false);
  assert.equal(ed.displayBorderValue("radius"), 6);
});

check("with two fields overridden, resetting one keeps the other", () => {
  const { node, ed } = open(withBorder(), "mobile");
  ed.setBorderProp("width", 1);
  ed.setBorderProp("color", "#ff0000");
  ed.resetBorderProp("width");
  assert.deepEqual(node.mobile.border, {
    ...desktopBorder(),
    color: "#ff0000",
  });
  assert.equal(ed.isBorderPropOverridden("width"), false);
  assert.equal(ed.isBorderPropOverridden("color"), true);
  ed.resetBorderProp("color");
  assert.equal(node.mobile.border, null);
});

check(
  "writing the desktop value on mobile (a focus and blur on a slider) leaves no border",
  () => {
    const { node, ed } = open(withBorder(), "mobile");
    ed.setBorderProp("width", 2);
    assert.equal(node.mobile.border, null);
    assert.equal(ed.isBorderOverridden(), false);
    // Same on a node with the default (zero width) border.
    const plain = open(freshColumn(), "mobile");
    plain.ed.setBorderProp("style", "solid");
    assert.equal(plain.node.mobile.border, null);
  },
);

check("a null field in a hand-written mobile border is not an override", () => {
  const { node, ed } = open(withBorder(), "mobile");
  node.mobile.border = { ...desktopBorder(), width: 3, radius: null };
  assert.equal(ed.isBorderPropOverridden("radius"), false);
  assert.equal(ed.displayBorderValue("radius"), 6, "falls back to desktop");
  ed.resetBorderProp("width");
  assert.equal(node.mobile.border, null, "nothing left that differs");
});

check(
  "dragging a field back to the desktop value drops the override mid-drag",
  () => {
    const { node, ed } = open(withBorder(), "mobile");
    for (const w of [3, 4, 3, 2]) ed.setBorderProp("width", w);
    assert.equal(node.mobile.border, null, "equal again: no override");
    ed.setBorderProp("width", 1);
    assert.deepEqual(
      node.mobile.border,
      { ...desktopBorder(), width: 1 },
      "it can start again",
    );
  },
);

check(
  "a redundant mobile border does not change the exported DOM; a stale copy would",
  () => {
    const { node, ed } = open(withBorder(), "mobile");
    node.border = { width: 0, style: "solid", color: "#000000", radius: 0 };
    ed.setBorderProp("width", 3);
    assert.ok(
      buildRowBox(node).outer,
      "a real border override gets the outer element",
    );
    ed.resetBorderProp("width");
    assert.equal(buildRowBox(node).outer, null, "back to the single element");
    assert.equal(emailNodeMobileStyles(node, "eb-r1"), "");

    // What the base composable would leave behind: the control for the check.
    node.mobile.border = { ...node.border };
    assert.ok(
      buildRowBox(node).outer,
      "a leftover copy forces the outer element",
    );
  },
);

check("desktop border writes never touch mobile.border", () => {
  const { node, ed, editMode } = open(withBorder(), "mobile");
  ed.setBorderProp("width", 5);
  const before = clone(node.mobile.border);
  editMode.value = "desktop";
  ed.setBorderProp("width", 5); // the desktop border now equals the mobile one
  assert.equal(node.border.width, 5);
  assert.deepEqual(
    node.mobile.border,
    before,
    "kept: the override was pinned by the user",
  );
  assert.deepEqual(commits().slice(-1), ["set-border-width"]);
});

check("resetBorder clears the whole override with one commit", () => {
  const { node, ed } = open(withBorder(), "mobile");
  ed.setBorderProp("width", 1);
  ed.setBorderProp("style", "dotted");
  resetHistory();
  ed.resetBorder();
  assert.equal(node.mobile.border, null);
  assert.deepEqual(commits(), ["reset-border"]);
});

check("per-field reset is a no-op on desktop and without an override", () => {
  const { node, editMode, ed } = open(withBorder(), "mobile");
  ed.resetBorderProp("width");
  assert.deepEqual(commits(), [], "no mobile border yet");
  ed.setBorderProp("width", 1);
  editMode.value = "desktop";
  resetHistory();
  ed.resetBorderProp("width");
  assert.deepEqual(commits(), []);
  assert.equal(node.mobile.border.width, 1);
  assert.equal(
    ed.isBorderPropOverridden("width"),
    false,
    "badges are mobile only",
  );
});

check("a node with no border at all does not throw", () => {
  const raw = freshColumn();
  delete raw.border;
  const { node, ed } = open(raw, "mobile");
  assert.equal(ed.displayBorderValue("width"), undefined);
  assert.equal(ed.isBorderPropOverridden("width"), false);
  ed.setBorderProp("width", 2);
  assert.equal(node.mobile.border.width, 2);
  assert.equal(ed.isBorderPropOverridden("width"), true);
});

// ─── What the adapter leaves out ──────────────────────────────────────────────

check("no hide toggles, no legacy colour helpers, no increment helpers", () => {
  const api = Object.keys(open(freshRow()).ed);
  for (const gone of [
    "toggleDesktopHide",
    "toggleMobileHide",
    "useTransparentBg",
    "bgColor",
    "setBgColor",
    "incrementProp",
    "decrementProp",
    "toggleGradient",
    "setGradientColors",
    "setGradientConfig",
  ]) {
    assert.ok(!api.includes(gone), `${gone} must not be exposed`);
  }
  assert.ok(
    api.includes("resetBorderProp") && api.includes("isBorderPropOverridden"),
  );
});

check("a null node is safe", () => {
  const editMode = ref<EditMode>("mobile");
  const ed = useNodeStyleEditor(ref(null), editMode);
  resetHistory();
  assert.equal(ed.displayValue("gap"), undefined);
  assert.equal(ed.isOverridden("gap"), false);
  assert.equal(ed.isBackgroundOverridden(), false);
  assert.equal(ed.isBorderOverridden(), false);
  ed.setProp("gap", 4);
  ed.resetProp("gap");
  ed.setBorderProp("width", 1);
  ed.resetBorderProp("width");
  ed.resetBorder();
  ed.resetBackground();
  assert.deepEqual(commits(), []);
});

// ─── From the panel to the saved file and the email ───────────────────────────

const stackedRow = () => {
  const row = withBorder();
  row.mobileStack = true;
  row.gap = 12;
  return row;
};

check(
  "a row edited like the panel does exports the expected mobile CSS",
  () => {
    const { node, ed } = open(stackedRow(), "mobile");
    ed.setProp("padding", pad(8));
    ed.setProp("minHeight", 120);
    ed.setProp("gap", 4);
    ed.setBorderProp("width", 5);
    ed.setBackground({
      useGradient: false,
      solid: "#abcdef",
      gradient: redToBlue().gradient,
    });

    const css = emailNodeMobileStyles(node, "eb-r1");
    assert.match(css, /\.eb-r1-box \{ padding: 8px 8px 8px 8px !important \}/);
    assert.match(
      css,
      /\.eb-r1-outer \{ border: 5px dashed #336699 !important;/,
    );
    assert.match(css, /min-height: 120px !important/);
    assert.match(css, /background-color: #abcdef !important/);
    assert.match(css, /\.mobile-stack\.eb-r1-gap \{ height: 4px !important/);
  },
);

check(
  "resetting every control returns the row to no CSS and no saved `mobile`",
  () => {
    const { node, ed } = open(stackedRow(), "mobile");
    ed.setProp("padding", pad(8));
    ed.setProp("minHeight", 120);
    ed.setProp("gap", 4);
    ed.setBorderProp("width", 5);
    ed.setBackground(redToBlue());

    ed.resetProp("padding");
    ed.resetProp("minHeight");
    ed.resetProp("gap");
    ed.resetBorderProp("width");
    ed.resetBackground();

    assert.equal(emailNodeMobileStyles(node, "eb-r1"), "");
    const saved = optimizeRows(clone([node]) as any) as any[];
    assert.ok(!("mobile" in saved[0]), "the empty mobile object is not saved");
  },
);

check(
  "the save step keeps exactly the overridden keys, with a complete border",
  () => {
    const { node, ed } = open(stackedRow(), "mobile");
    ed.setProp("minHeight", 120);
    ed.setBorderProp("color", "#ff0000");
    const saved = optimizeRows(clone([node]) as any) as any[];
    assert.deepEqual(saved[0].mobile, {
      minHeight: 120,
      border: { ...desktopBorder(), color: "#ff0000" },
    });
  },
);

check("a mobile solid over a desktop gradient survives the save step", () => {
  const raw = freshRow();
  raw.backgroundGradient = redToBlue();
  raw.backgroundColor = "#ff0000";
  const { node, ed } = open(raw, "mobile");
  assert.equal(
    ed.displayBackground().useGradient,
    true,
    "inherits the desktop gradient",
  );
  ed.setBackground({
    useGradient: false,
    solid: "#222222",
    gradient: redToBlue().gradient,
  });
  const saved = optimizeRows(clone([node]) as any) as any[];
  assert.equal(saved[0].mobile.backgroundGradient.useGradient, false);
  assert.equal(saved[0].mobile.backgroundColor, "#222222");
});

check("column and spacer edits export their CSS", () => {
  const col = open(freshColumn(), "mobile");
  col.ed.setProp("verticalAlign", "middle");
  col.ed.setProp("padding", pad(6));
  assert.match(
    emailNodeMobileStyles(col.node, "eb-c1"),
    /vertical-align: middle !important/,
  );
  assert.match(
    emailNodeMobileStyles(col.node, "eb-c1"),
    /padding: 6px 6px 6px 6px !important/,
  );

  const sp = open(freshSpacer(), "mobile");
  sp.ed.setProp("height", 60);
  assert.match(
    emailNodeMobileStyles(sp.node, "eb-s1"),
    /height: 60px !important/,
  );
  sp.ed.resetProp("height");
  assert.equal(emailNodeMobileStyles(sp.node, "eb-s1"), "");
});

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
