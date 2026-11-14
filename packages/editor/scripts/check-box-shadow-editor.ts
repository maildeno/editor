/**
 * check-box-shadow-editor.ts
 *
 * Checks useBoxShadowEditor (src/composables/emailBuilder/components), the
 * editing logic behind the Shadow control in the Row, Column, Image and Button
 * panels: desktop and mobile reads and writes, the "same as desktop" clean-up,
 * reset, the history commits, and the inset rule for an image. Then it follows
 * what the four panels write through the save step (optimizeRows) and the
 * exporter, to the CSS an email client gets.
 *
 * The shadow model, the save and load steps and the exporters are checked on
 * their own in check-box-shadow.ts.
 *
 * No browser and no Vue app. useEmailBuilder, which would inject the shared
 * editor instance, is swapped for a stub that records the history commits
 * (lib/builder-stub-hooks.mjs). The control itself (PropertyBoxShadow.vue) and
 * the panels need a browser: run apps/playground and look at the Shadow section
 * of the Row, Column, Image and Button panels, in Desktop and in Mobile.
 *
 *   cd packages/editor && npx tsx scripts/check-box-shadow-editor.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import { computed, reactive, ref } from "vue";
import { exportTemplate } from "./lib/headless-export";
import { DEFAULT_BOX_SHADOW } from "../src/composables/emailBuilder/core/boxShadow";
import { hydrateRows } from "../src/composables/emailBuilder/transform/pipeline/hydrate";
import { optimizeRows } from "../src/composables/emailBuilder/transform/pipeline/optimize";
import { emailNodeMobileStyles } from "../src/composables/emailBuilder/export/useEmailExportMobileStyles";
import type { EditMode } from "../src/composables/emailBuilder/components/useComponentStyleEditor";

// The stub has to be in place before the editor module is loaded.
register("./lib/builder-stub-hooks.mjs", import.meta.url);
const { useBoxShadowEditor } =
  await import("../src/composables/emailBuilder/components/useBoxShadowEditor");

// ─── Tiny harness ─────────────────────────────────────────────────────────────

let failed = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
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

// ─── History recorder ─────────────────────────────────────────────────────────

const g = globalThis as unknown as { __historyCalls?: unknown[][] };
const resetHistory = () => {
  g.__historyCalls = [];
};
/** The action names of the commits since the last reset. */
const commits = (): string[] =>
  (g.__historyCalls ?? []).map((c) => String(c[0]));

// ─── Fixtures: real nodes, as hydrate.ts builds them ──────────────────────────

/** A switched-on shadow. Each element gets its own colour to find it by. */
const sh = (color: string, extra: object = {}) => ({
  enabled: true,
  offsetX: 0,
  offsetY: 6,
  blur: 16,
  spread: 0,
  color,
  inset: false,
  ...extra,
});
const off = (color: string, extra: object = {}) =>
  sh(color, { enabled: false, ...extra });

const ROW = "#111111";
const COL = "#222222";
const IMG = "#333333";
const BTN = "#444444";

const hydrated = hydrateRows(
  clone([
    {
      id: "r1",
      type: "row",
      mobileStack: true,
      columns: [
        {
          id: "c1",
          width: 100,
          children: [
            {
              id: "i1",
              type: "component",
              componentType: "image",
              props: { src: "https://example.com/a.png", alt: "a" },
            },
            {
              id: "b1",
              type: "component",
              componentType: "button",
              props: { text: "Go", link: "https://example.com" },
            },
          ],
        },
      ],
    },
  ]) as any,
) as any[];

const freshTree = (): any => clone(hydrated[0]);
const freshRow = (): any => freshTree();
const freshColumn = (): any => freshTree().columns[0];
const freshImage = (): any => freshTree().columns[0].children[0];
const freshButton = (): any => freshTree().columns[0].children[1];

/** An editor on a reactive holder, as a panel gets it. */
const open = (
  holder: any,
  mode: EditMode = "desktop",
  opts: { allowInset?: boolean } = {},
) => {
  const live = reactive(holder) as any;
  const editMode = ref<EditMode>(mode);
  const ed = useBoxShadowEditor(
    computed(() => live),
    editMode,
    opts,
  );
  resetHistory();
  return { holder: live, editMode, ed };
};

// ─── Reading ──────────────────────────────────────────────────────────────────

await check("the nodes a panel opens start with the shadow off", () => {
  for (const node of [
    freshRow(),
    freshColumn(),
    freshImage().props,
    freshButton().props,
  ]) {
    const { ed } = open(node);
    assert.deepEqual(ed.shadow.value, DEFAULT_BOX_SHADOW);
    assert.equal(ed.shadow.value.enabled, false);
    assert.equal(ed.isOverridden.value, false);
  }
});

await check(
  "a holder with no shadow at all reads as off and does not throw",
  () => {
    const { ed } = open({});
    assert.deepEqual(ed.shadow.value, DEFAULT_BOX_SHADOW);
    assert.equal(ed.isOverridden.value, false);
  },
);

await check("what is stored is completed and clamped when read", () => {
  const { holder, ed } = open(freshRow());
  holder.boxShadow = { enabled: true, blur: 999, color: "red;}" };
  assert.equal(ed.shadow.value.enabled, true);
  assert.equal(ed.shadow.value.blur, 100);
  assert.equal(ed.shadow.value.color, DEFAULT_BOX_SHADOW.color);
  assert.equal(ed.shadow.value.offsetY, DEFAULT_BOX_SHADOW.offsetY);
});

await check(
  "the control follows the mode: desktop shadow, or the mobile override",
  () => {
    const raw = freshRow();
    raw.boxShadow = sh(ROW);
    raw.mobile.boxShadow = off(ROW);
    const { editMode, ed } = open(raw, "desktop");
    assert.equal(ed.shadow.value.enabled, true);
    editMode.value = "mobile";
    assert.equal(ed.shadow.value.enabled, false);
    assert.equal(ed.isOverridden.value, true);
    editMode.value = "desktop";
    assert.equal(ed.shadow.value.enabled, true);
    assert.equal(ed.isOverridden.value, false, "never in desktop");
  },
);

await check(
  "mobile with no override shows the desktop shadow, not overridden",
  () => {
    const raw = freshColumn();
    raw.boxShadow = sh(COL);
    const { ed } = open(raw, "mobile");
    assert.deepEqual(ed.shadow.value, sh(COL));
    assert.equal(ed.isOverridden.value, false);
    // A node that has no mobile object at all, as a freshly created one may.
    const bare = { boxShadow: sh(COL) };
    const { ed: ed2 } = open(bare, "mobile");
    assert.deepEqual(ed2.shadow.value, sh(COL));
    assert.equal(ed2.isOverridden.value, false);
  },
);

// ─── Writing on desktop ───────────────────────────────────────────────────────

await check("desktop: the whole shadow is stored, in one history step", () => {
  const { holder, ed } = open(freshRow());
  ed.setShadow(sh(ROW));
  assert.deepEqual(holder.boxShadow, sh(ROW));
  assert.equal(holder.mobile.boxShadow, null, "mobile is not touched");
  assert.deepEqual(commits(), ["set-boxShadow"]);
});

await check(
  "desktop: every write is one history step, and the last one wins",
  () => {
    const { holder, ed } = open(freshButton().props);
    ed.setShadow(sh(BTN));
    ed.setShadow(sh(BTN, { blur: 30 }));
    ed.setShadow({ ...sh(BTN, { blur: 30 }), enabled: false });
    assert.deepEqual(commits(), [
      "set-boxShadow",
      "set-boxShadow",
      "set-boxShadow",
    ]);
    // A shadow that is switched off keeps its values.
    assert.deepEqual(holder.boxShadow, off(BTN, { blur: 30 }));
  },
);

await check(
  "desktop: what is written is normalised, so nothing hostile is stored",
  () => {
    const { holder, ed } = open(freshColumn());
    ed.setShadow({
      ...sh("red;}</style><script>alert(1)</script>"),
      blur: 5000,
      offsetX: -5000,
    } as any);
    assert.equal(holder.boxShadow.color, DEFAULT_BOX_SHADOW.color);
    assert.equal(holder.boxShadow.blur, 100);
    assert.equal(holder.boxShadow.offsetX, -50);
  },
);

await check(
  "the stored shadow is a copy: editing the argument or another layer leaves it alone",
  () => {
    const { holder, ed, editMode } = open(freshRow());
    const arg = sh(ROW);
    ed.setShadow(arg);
    arg.blur = 77;
    assert.equal(holder.boxShadow.blur, 16);
    editMode.value = "mobile";
    ed.setShadow(sh(ROW, { blur: 2 }));
    holder.mobile.boxShadow.blur = 55;
    assert.equal(
      holder.boxShadow.blur,
      16,
      "desktop and mobile are separate objects",
    );
  },
);

// ─── Writing on mobile ────────────────────────────────────────────────────────

await check(
  "mobile: a shadow that differs is stored whole on mobile; desktop is untouched",
  () => {
    const raw = freshRow();
    raw.boxShadow = sh(ROW);
    const { holder, ed } = open(raw, "mobile");
    ed.setShadow(sh(ROW, { blur: 2, offsetY: 1 }));
    assert.deepEqual(holder.mobile.boxShadow, sh(ROW, { blur: 2, offsetY: 1 }));
    assert.deepEqual(holder.boxShadow, sh(ROW));
    assert.equal(ed.isOverridden.value, true);
    assert.deepEqual(commits(), ["set-boxShadow"]);
  },
);

await check(
  "mobile: writing what desktop already draws drops the override",
  () => {
    const raw = freshColumn();
    raw.boxShadow = sh(COL);
    raw.mobile.boxShadow = sh(COL, { blur: 3 });
    const { holder, ed } = open(raw, "mobile");
    assert.equal(ed.isOverridden.value, true);
    ed.setShadow(sh(COL));
    assert.equal(holder.mobile.boxShadow, null);
    assert.equal(ed.isOverridden.value, false);
    // The control keeps showing the desktop shadow, so the user sees no jump.
    assert.deepEqual(ed.shadow.value, sh(COL));
  },
);

await check(
  "mobile: two shadows that are both off are the same, whatever values they keep",
  () => {
    const raw = freshButton().props;
    raw.boxShadow = off(BTN, { blur: 40 });
    const { holder, ed } = open(raw, "mobile");
    ed.setShadow(off(BTN, { blur: 2, color: "#abcdef" }));
    assert.equal(holder.mobile.boxShadow, null);
    assert.equal(ed.isOverridden.value, false);
  },
);

await check(
  "mobile: off over a desktop shadow that is on is an override (it writes none)",
  () => {
    const raw = freshRow();
    raw.boxShadow = sh(ROW);
    const { holder, ed } = open(raw, "mobile");
    ed.setShadow({ ...ed.shadow.value, enabled: false });
    assert.deepEqual(holder.mobile.boxShadow, off(ROW));
    assert.equal(ed.isOverridden.value, true);
    assert.equal(ed.shadow.value.enabled, false);
    assert.match(
      emailNodeMobileStyles(holder, "eb-r1"),
      /\.eb-r1 \{ box-shadow: none !important \}/,
    );
  },
);

await check(
  "mobile: on over a desktop shadow that is off is an override, even sized down to nothing",
  () => {
    const raw = freshColumn();
    raw.boxShadow = off(COL);
    const { holder, ed } = open(raw, "mobile");
    // The user switches it on, then drags every slider to zero.
    ed.setShadow(sh(COL));
    ed.setShadow(sh(COL, { offsetX: 0, offsetY: 0, blur: 0, spread: 0 }));
    assert.equal(holder.mobile.boxShadow.enabled, true);
    assert.equal(
      ed.isOverridden.value,
      true,
      "the override must not vanish while it is being dragged",
    );
  },
);

await check(
  "mobile: the same sizes with a different colour or inset is an override",
  () => {
    const raw = freshRow();
    raw.boxShadow = sh(ROW);
    const { holder, ed } = open(raw, "mobile");
    ed.setShadow(sh("#999999"));
    assert.equal(ed.isOverridden.value, true);
    ed.setShadow(sh(ROW, { inset: true }));
    assert.equal(holder.mobile.boxShadow.inset, true);
    assert.equal(ed.isOverridden.value, true);
  },
);

await check(
  "mobile: the override is written even when the node has no mobile object",
  () => {
    const { holder, ed } = open({ boxShadow: sh(ROW) }, "mobile");
    ed.setShadow(sh(ROW, { blur: 1 }));
    assert.deepEqual(holder.mobile, { boxShadow: sh(ROW, { blur: 1 }) });
  },
);

await check(
  "a stored override that now equals desktop is shown as not overridden",
  () => {
    const raw = freshRow();
    raw.boxShadow = sh(ROW);
    raw.mobile.boxShadow = sh(ROW, { blur: 2 });
    const { holder, ed, editMode } = open(raw, "mobile");
    assert.equal(ed.isOverridden.value, true);
    // Desktop is edited to match it.
    editMode.value = "desktop";
    ed.setShadow(sh(ROW, { blur: 2 }));
    editMode.value = "mobile";
    assert.equal(ed.isOverridden.value, false);
    assert.deepEqual(holder.mobile.boxShadow, sh(ROW, { blur: 2 }));
  },
);

// ─── Reset ────────────────────────────────────────────────────────────────────

await check(
  "reset: goes back to the desktop shadow, in one history step",
  () => {
    const raw = freshRow();
    raw.boxShadow = sh(ROW);
    raw.mobile.boxShadow = off(ROW);
    const { holder, ed } = open(raw, "mobile");
    ed.resetShadow();
    assert.equal(holder.mobile.boxShadow, null);
    assert.deepEqual(holder.boxShadow, sh(ROW));
    assert.deepEqual(ed.shadow.value, sh(ROW));
    assert.equal(ed.isOverridden.value, false);
    assert.deepEqual(commits(), ["reset-boxShadow"]);
  },
);

await check(
  "reset: does nothing, and records nothing, on desktop or without a mobile object",
  () => {
    const raw = freshRow();
    raw.boxShadow = sh(ROW);
    raw.mobile.boxShadow = off(ROW);
    const { holder, ed } = open(raw, "desktop");
    ed.resetShadow();
    assert.deepEqual(holder.mobile.boxShadow, off(ROW));
    assert.deepEqual(commits(), []);
    const { holder: bare, ed: ed2 } = open({ boxShadow: sh(ROW) }, "mobile");
    ed2.resetShadow();
    assert.equal("mobile" in bare, false, "no empty mobile object is created");
    assert.deepEqual(commits(), []);
  },
);

// ─── Inset on an image ────────────────────────────────────────────────────────

await check("an image never stores or shows inset: it is drawn outside", () => {
  const { holder, ed, editMode } = open(freshImage().props, "desktop", {
    allowInset: false,
  });
  ed.setShadow(sh(IMG, { inset: true }));
  assert.equal(holder.boxShadow.inset, false);
  // A saved file that says otherwise reads as outside.
  holder.boxShadow = sh(IMG, { inset: true });
  assert.equal(ed.shadow.value.inset, false);
  editMode.value = "mobile";
  ed.setShadow(sh(IMG, { blur: 4, inset: true }));
  assert.equal(holder.mobile.boxShadow.inset, false);
});

await check(
  "an image's inset is not compared, so it cannot make a fake override",
  () => {
    const raw = freshImage().props;
    raw.boxShadow = sh(IMG);
    const { holder, ed } = open(raw, "mobile", { allowInset: false });
    ed.setShadow(sh(IMG, { inset: true }));
    assert.equal(holder.mobile.boxShadow, null);
    assert.equal(ed.isOverridden.value, false);
  },
);

await check("a row, column or button keeps inset as part of the shadow", () => {
  for (const node of [freshRow(), freshColumn(), freshButton().props]) {
    const { holder, ed } = open(node);
    ed.setShadow(sh("#555555", { inset: true }));
    assert.equal(holder.boxShadow.inset, true);
    assert.equal(ed.shadow.value.inset, true);
  }
});

// ─── No holder ────────────────────────────────────────────────────────────────

await check("with nothing selected it reads as off and writes nothing", () => {
  resetHistory();
  const ed = useBoxShadowEditor(
    computed(() => null),
    ref<EditMode>("desktop"),
  );
  assert.deepEqual(ed.shadow.value, DEFAULT_BOX_SHADOW);
  ed.setShadow(sh(ROW));
  ed.resetShadow();
  assert.deepEqual(commits(), []);
  assert.equal(ed.isOverridden.value, false);
});

// ─── From the panels to the email ─────────────────────────────────────────────

/** The four panels' editors on one tree, sharing one mode, as the app has it. */
const panels = () => {
  const tree = reactive(freshTree()) as any;
  const editMode = ref<EditMode>("desktop");
  const mk = (get: () => any, opts: { allowInset?: boolean } = {}) =>
    useBoxShadowEditor(computed(get), editMode, opts);
  return {
    tree,
    editMode,
    row: mk(() => tree),
    column: mk(() => tree.columns[0]),
    image: mk(() => tree.columns[0].children[0].props, { allowInset: false }),
    button: mk(() => tree.columns[0].children[1].props),
  };
};

const canvas = { width: 600 };
const save = (tree: any): any[] => optimizeRows(clone([tree]) as any) as any[];
const VALUE = (c: string, extra = "") => `${extra}0px 6px 16px 0px ${c}`;
const tagsWith = (html: string, needle: string): string[] =>
  (html.match(/<[a-zA-Z][^>]*>/g) ?? []).filter((t) => t.includes(needle));

await check(
  "what the four panels write is saved, and reaches the email on desktop and mobile",
  async () => {
    const p = panels();

    // Desktop: all four on. The image's inset is dropped, the button's is kept.
    p.row.setShadow(sh(ROW));
    p.column.setShadow(sh(COL));
    p.image.setShadow(sh(IMG, { inset: true }));
    p.button.setShadow(sh(BTN, { inset: true }));

    // Mobile: the row and the image switch theirs off, the column and the button change theirs.
    p.editMode.value = "mobile";
    p.row.setShadow({ ...p.row.shadow.value, enabled: false });
    p.column.setShadow({ ...p.column.shadow.value, blur: 2 });
    p.image.setShadow({ ...p.image.shadow.value, enabled: false });
    p.button.setShadow({ ...p.button.shadow.value, offsetY: 1 });
    for (const ed of [p.row, p.column, p.image, p.button]) {
      assert.equal(ed.isOverridden.value, true);
    }

    const [row] = save(p.tree);
    const col = row.columns[0];
    const [img, btn] = col.children;
    assert.deepEqual(row.boxShadow, sh(ROW));
    assert.deepEqual(row.mobile, { boxShadow: off(ROW) });
    assert.deepEqual(col.boxShadow, sh(COL));
    assert.deepEqual(col.mobile, { boxShadow: sh(COL, { blur: 2 }) });
    assert.deepEqual(
      img.props.boxShadow,
      sh(IMG),
      "an image is saved without inset",
    );
    assert.deepEqual(img.props.mobile, { boxShadow: off(IMG) });
    assert.deepEqual(btn.props.boxShadow, sh(BTN, { inset: true }));
    assert.deepEqual(btn.props.mobile, {
      boxShadow: sh(BTN, { inset: true, offsetY: 1 }),
    });

    const out = await exportTemplate([row], canvas);
    for (const text of [out.html, out.mjml]) {
      assert.equal(tagsWith(text, VALUE(ROW)).length, 1, "row");
      assert.equal(tagsWith(text, VALUE(COL)).length, 1, "column");
      assert.equal(tagsWith(text, VALUE(IMG)).length, 1, "image");
      assert.equal(tagsWith(text, VALUE(BTN, "inset ")).length, 1, "button");
    }
    assert.match(out.html, /\.eb-r1 \{[^}]*box-shadow: none !important/);
    assert.match(
      out.html,
      /\.eb-c1 \{[^}]*box-shadow: 0px 6px 2px 0px #222222 !important/,
    );
    assert.match(out.html, /\.eb-i1 img \{[^}]*box-shadow: none !important/);
    assert.match(
      out.html,
      /\.eb-b1-link \{[^}]*box-shadow: inset 0px 1px 16px 0px #444444 !important/,
    );
  },
);

await check(
  "resetting all four on mobile leaves nothing of the overrides to save or export",
  async () => {
    const p = panels();
    p.row.setShadow(sh(ROW));
    p.column.setShadow(sh(COL));
    p.image.setShadow(sh(IMG));
    p.button.setShadow(sh(BTN));
    p.editMode.value = "mobile";
    for (const ed of [p.row, p.column, p.image, p.button]) {
      ed.setShadow({ ...ed.shadow.value, enabled: false });
    }
    const withOverrides = await exportTemplate(save(p.tree), canvas);
    assert.ok(withOverrides.html.includes("Mobile property overrides"));

    for (const ed of [p.row, p.column, p.image, p.button]) ed.resetShadow();
    const saved = save(p.tree);
    assert.equal(JSON.stringify(saved).includes('"mobile"'), false);
    const out = await exportTemplate(saved, canvas);
    assert.equal(out.html.includes("Mobile property overrides"), false);
    // The desktop shadows are all still there.
    assert.equal((out.html.match(/box-shadow:/g) ?? []).length, 4);
  },
);

await check(
  "a shadow that is switched off on desktop, and only tuned, is not exported",
  async () => {
    const p = panels();
    p.row.setShadow(off(ROW, { blur: 40 }));
    p.image.setShadow(off(IMG, { blur: 40 }));
    const out = await exportTemplate(save(p.tree), canvas);
    for (const text of [out.html, out.mjml, out.jsx]) {
      assert.equal(/box-?shadow/i.test(text), false);
    }
    // It is saved, so the values are there when it is switched on again.
    const [row] = save(p.tree);
    assert.deepEqual(row.boxShadow, off(ROW, { blur: 40 }));
  },
);

// ─── Result ───────────────────────────────────────────────────────────────────

if (failed > 0) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll box shadow editor checks passed.");
