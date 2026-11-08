/**
 * check-sidebar-ui-state.ts
 *
 * Checks createSidebarUiState (src/composables/emailBuilder/core), the
 * per-editor state behind the left sidebar's tabs: which tab is open at each
 * level, and the sample data typed into the Merge Tag and Link Tag tabs.
 *
 * Those tabs are removed from the page (v-if) whenever another tab is open, so
 * they read and write this state through toRef() instead of keeping their own
 * refs. The checks follow that exact use: a "tab" is a set of toRef()s that is
 * dropped and then rebuilt, and what the user typed has to still be there.
 *
 * No browser and no Vue app. The tab components themselves are checked in a
 * browser: switch tabs at all three levels and look at the entries, the values
 * and the Preview switch.
 *
 *   cd packages/editor && npx tsx scripts/check-sidebar-ui-state.ts
 */

import assert from "node:assert/strict";
import { toRef, watch } from "vue";
import { createSidebarUiState } from "../src/composables/emailBuilder/core/useSidebarUiState";

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

// What MergeTagTab and LinkTagTab do when they are created. Calling it again is
// what happens when the user comes back to the tab.
const openMergeTab = (s: ReturnType<typeof createSidebarUiState>) => ({
  entries: toRef(s.mergeTags, "entries"),
  showDetectedSummary: toRef(s.mergeTags, "showDetectedSummary"),
  showSystemTags: toRef(s.mergeTags, "showSystemTags"),
  showESPPreview: toRef(s.mergeTags, "showESPPreview"),
});
const openLinkTab = (s: ReturnType<typeof createSidebarUiState>) => ({
  entries: toRef(s.linkTags, "entries"),
  showDetectedSummary: toRef(s.linkTags, "showDetectedSummary"),
  showESPPreview: toRef(s.linkTags, "showESPPreview"),
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

check("a new editor starts where the tabs used to start", () => {
  const s = createSidebarUiState();
  assert.equal(s.leftTab, "Content");
  assert.equal(s.generalTab, "Styles");
  assert.equal(s.tagsTab, "Merge Tag");

  assert.deepEqual(s.mergeTags.entries, []);
  assert.equal(s.mergeTags.showDetectedSummary, true);
  assert.equal(s.mergeTags.showSystemTags, false);
  assert.equal(s.mergeTags.showESPPreview, true);

  assert.deepEqual(s.linkTags.entries, []);
  assert.equal(s.linkTags.showDetectedSummary, true);
  assert.equal(s.linkTags.showESPPreview, true);
});

// ─── The bug: state has to outlive the tab ────────────────────────────────────

check("merge tag entries and values survive the tab being removed and re-created", () => {
  const s = createSidebarUiState();

  const first = openMergeTab(s);
  first.entries.value.push({ tag: "first_name", fallback: "", value: "Philip" });
  first.entries.value.push({ tag: "company", fallback: "", value: "Acme" });

  // The tab is removed: its refs are gone. Nothing else holds on to them.
  const second = openMergeTab(s);
  assert.equal(second.entries.value.length, 2);
  assert.deepEqual(
    second.entries.value.map((e) => [e.tag, e.value]),
    [
      ["first_name", "Philip"],
      ["company", "Acme"],
    ],
  );
});

check("merge tag section toggles survive the tab being re-created", () => {
  const s = createSidebarUiState();

  const first = openMergeTab(s);
  first.showDetectedSummary.value = false;
  first.showSystemTags.value = true;
  first.showESPPreview.value = false;

  const second = openMergeTab(s);
  assert.equal(second.showDetectedSummary.value, false);
  assert.equal(second.showSystemTags.value, true);
  assert.equal(second.showESPPreview.value, false);
});

check("link tag entries, values and toggles survive the tab being re-created", () => {
  const s = createSidebarUiState();

  const first = openLinkTab(s);
  first.entries.value.push({
    tag: "cta_url",
    value: "https://example.com/go",
    default: "",
  });
  first.showDetectedSummary.value = false;
  first.showESPPreview.value = false;

  const second = openLinkTab(s);
  assert.equal(second.entries.value.length, 1);
  assert.equal(second.entries.value[0]!.value, "https://example.com/go");
  assert.equal(second.showDetectedSummary.value, false);
  assert.equal(second.showESPPreview.value, false);
});

check("the open tab at each level is remembered", () => {
  const s = createSidebarUiState();

  // What `@click="activeTab = tab"` does in the three tab components.
  toRef(s, "leftTab").value = "General";
  toRef(s, "generalTab").value = "Tags";
  toRef(s, "tagsTab").value = "Link Tag";

  assert.equal(toRef(s, "leftTab").value, "General");
  assert.equal(toRef(s, "generalTab").value, "Tags");
  assert.equal(toRef(s, "tagsTab").value, "Link Tag");
});

// ─── What the tabs rely on ────────────────────────────────────────────────────

check("a ref made with toRef writes through to the state, and reads from it", () => {
  const s = createSidebarUiState();
  const entries = toRef(s.mergeTags, "entries");

  entries.value = [{ tag: "a", fallback: "", value: "1" }];
  assert.equal(s.mergeTags.entries.length, 1);

  s.mergeTags.entries.push({ tag: "b", fallback: "", value: "2" });
  assert.equal(entries.value.length, 2);
});

check("editing one entry in place is seen by a deep watcher", () => {
  // MergeTagTab and LinkTagTab rebuild the preview context from the entries
  // with watch(tagEntries, ..., { deep: true }); that has to keep working on
  // a ref that comes from toRef.
  const s = createSidebarUiState();
  const { entries } = openMergeTab(s);
  entries.value.push({ tag: "first_name", fallback: "", value: "" });

  let calls = 0;
  const stop = watch(entries, () => calls++, { deep: true, flush: "sync" });

  entries.value[0]!.value = "Ana";
  assert.equal(calls, 1);
  stop();
});

check("merge tag and link tag data are separate", () => {
  const s = createSidebarUiState();
  openMergeTab(s).entries.value.push({ tag: "x", fallback: "", value: "" });

  assert.equal(s.mergeTags.entries.length, 1);
  assert.equal(s.linkTags.entries.length, 0);
  assert.notEqual(s.mergeTags.entries, s.linkTags.entries as unknown);
});

// ─── Per editor ───────────────────────────────────────────────────────────────

check("two editors do not share their sidebar state", () => {
  const a = createSidebarUiState();
  const b = createSidebarUiState();

  openMergeTab(a).entries.value.push({ tag: "x", fallback: "", value: "1" });
  openLinkTab(a).entries.value.push({ tag: "y", value: "2", default: "" });
  a.leftTab = "General";
  a.mergeTags.showSystemTags = true;

  assert.equal(b.mergeTags.entries.length, 0);
  assert.equal(b.linkTags.entries.length, 0);
  assert.equal(b.leftTab, "Content");
  assert.equal(b.mergeTags.showSystemTags, false);
});

console.log(
  failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
