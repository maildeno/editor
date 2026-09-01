// Public API surface.
//
// Styling (Tailwind, icons, the Satoshi font) is injected programmatically
// by EmailEditor.vue on mount, directly into document.head — see that
// file's onMounted comment. So no CSS import is needed here or by
// consumers: importing EmailEditor is the only thing the plain
// Vue-component path requires, matching the custom-element path
// (element.ts / init.ts), which was always self-contained.

export { default as EmailEditor } from "./components/features/emailBuilder/EmailEditor.vue";

// ── Storage adapter ────────────────────────────────────────────────
export { createLocalStorageAdapter } from "./adapters/localStorageAdapter";
export type {
  EditorStorageAdapter,
  PartialStorageAdapter,
  TemplateSnapshot,
  TemplateSummary,
  TemplateVersionSummary,
  SavedRow,
} from "./adapters/types";

// ── Block registry ─────────────────────────────────────────────────
export { registerBlock, getBlock, getAllBlocks } from "./blocks/registry";
export type { BlockDefinition, BlockRenderContext } from "./blocks/types";

// ── ESP registry ───────────────────────────────────────────────────
export { registerESPSyntax, getRegisteredCustomESPs } from "./esp/registry";
export type { ESPWrapperOverrides } from "./esp/registry";

// ── Merge tag registry ─────────────────────────────────────────────
export {
  registerMergeTags,
  getRegisteredMergeTagIds,
} from "./merge-tags/registry";
export type { MergeTagRegistration } from "./merge-tags/registry";

// ── Theming ────────────────────────────────────────────────────────
export { setEditorTheme, palette } from "./theme";
export type { ThemeOptions, ThemeTokens } from "./theme";

// Deliberately NOT exporting init()/registerMaildenoEditorElement here —
// both pull in element.ts, which builds the full shadow-root CSS bundle at
// module-load time (buildShadowStyles). A host who only wants the plain
// EmailEditor Vue component shouldn't pay that cost for nothing, and
// re-exporting it here would defeat vite.config.ts's whole reason for
// having index/element as separate build entries. Custom-element usage —
// including init() — lives at the "@maildeno/editor/element" entry
// instead (see element.ts).
export type { InitOptions, EditorHandle } from "./init";
export type { EditorWriteApi, AssistantMount } from "./types/assistant";
