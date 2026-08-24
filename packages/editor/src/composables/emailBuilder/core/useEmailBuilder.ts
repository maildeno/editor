// composables/emailBuilder/core/useEmailBuilder.ts
// Main orchestrator — wires history, persistence, operations, and export.
//
// this used to source its state from Nuxt's useState(key, ...),
// which is a page-wide singleton keyed by string — every call to
// useEmailBuilder() from anywhere (Header.vue, Canvas.vue, panels, ...) got
// the SAME `rows`/`selectedId`/etc. That sharing is real behavior worth
// keeping, not an artifact of Nuxt to throw away — a canvas edit in one
// component needs to be visible to all the others. Converting each call site
// to its own local ref() independently would silently break that: every
// component would get its own disconnected copy of the canvas.
//
// The replacement: createEmailBuilderInstance() below builds the full
// instance — state and all the derived logic that follows it — exactly
// once. EmailEditor.vue calls provideEmailBuilder() at the root, which
// creates that one instance and provide()s it. Every other file keeps
// calling useEmailBuilder() exactly as before, completely unchanged; it now
// just injects the one shared instance instead of hitting a global keyed
// store. No consumer file needs to know this happened.

import {
 nextTick,
 onUnmounted,
 watchEffect,
 ref,
 computed,
 provide,
 inject,
 type InjectionKey,
} from "vue";
import { useConfirm } from "@/composables/ui/useConfirm";
import { useInfoDialog } from "@/composables/ui/useInfoDialog";
import { useEmailBuilderDefaults } from "../core/useEmailBuilderDefault";
import { useEmailBuilderOperations } from "../core/useEmailBuilderOperations";
import { useEmailBuilderHistory } from "../history/useEmailBuilderHistory";
import { useEmailBuilderPersistence } from "../persistence/useEmailBuilderPersistence";
import { htmlGenerator } from "../export/generators/html";
import { reactEmailGenerator } from "../export/generators/react-email";
import { mjmlGenerator } from "../export/generators/mjml";
import { useEmailExportEngine } from "../export/useEmailExportEngine";
import { hydrateCanvas, hydrateRows } from "../transform/pipeline/hydrate";
import { useGoogleFonts } from "@/composables/system/useGoogleFonts";
import { useStorageAdapter } from "@/adapters";
import type { EditorStorageAdapter } from "@/adapters/types";

// 3 s debounce before writing to localStorage
const AUTOSAVE_DEBOUNCE_MS = 3000;

// Stamped by loadTemplate() so every auto-save carries the correct templateId
let _activeTemplateId: string | null = null;
// Stamped by loadTemplate() so every auto-save carries the template name + tags,
// allowing the page to restore them from the draft without a DB fetch.
let _activeTemplateName: string | undefined;
let _activeTemplateTags: any[] | undefined;

// Module-scope dirty-check: the last history `version` value we actually
// flushed to disk. When debouncedSave() fires, if version hasn't moved we
// skip the entire optimize+stringify+write pipeline. Prevents redundant
// writes after undo→redo round-trips and after selection-only changes.
let _lastSavedVersion = -1;

const DEFAULT_CANVAS = () => ({
 language: "en-US",
 preheaderText: "View this email in your browser",
 bodyBackgroundColor: "#f9fafb",
 bodyBackgroundImage: "",
 bodyBackgroundSize: "cover",
 bodyBackgroundPosition: "center center",
 bodyBackgroundRepeat: "no-repeat",
 backgroundColor: "#ffffff",
 width: 600,
 padding: { top: 0, right: 0, bottom: 0, left: 0 },
 mobileBreakpoint: 600,
});

type EmailBuilderInstance = ReturnType<typeof createEmailBuilderInstance>;
const EmailBuilderKey: InjectionKey<EmailBuilderInstance> = Symbol(
 "maildeno-editor:email-builder",
);

/** Called once, at the EmailEditor root. Do not call from any other file.
 * storageAdapterInstance/infoDialogInstance are the already-created
 * return values of provideStorageAdapter()/provideInfoDialog() — see the
 * comment on useEmailExportEngine's matching parameter for why these are
 * passed directly rather than re-injected internally. */
export function provideEmailBuilder(
 storageAdapterInstance?: EditorStorageAdapter,
 infoDialogInstance?: ReturnType<typeof useInfoDialog>,
) {
 const instance = createEmailBuilderInstance(
 storageAdapterInstance,
 infoDialogInstance,
 );
 provide(EmailBuilderKey, instance);
 return instance;
}

/**
 * Every file that isn't the root calls this exactly as before —
 * destructuring rows/selectedId/exportHTML/etc. Same signature, same
 * return shape. Throws a clear error instead of silently returning
 * undefined if something tries to use it outside an EmailEditor tree,
 * which is a much easier bug to find than "canvasStyles is undefined"
 * three files away.
 */
export const useEmailBuilder = (): EmailBuilderInstance => {
 const instance = inject(EmailBuilderKey);
 if (!instance) {
 throw new Error(
 "[maildeno-editor] useEmailBuilder() was called outside an EmailEditor instance. " +
 "This composable only works inside the component tree under <EmailEditor>, " +
 "which is where provideEmailBuilder() creates the shared instance.",
 );
 }
 return instance;
};

function createEmailBuilderInstance(
 storageAdapterInstance?: EditorStorageAdapter,
 infoDialogInstance?: ReturnType<typeof useInfoDialog>,
) {
 const storageAdapter = storageAdapterInstance ?? useStorageAdapter();
 const confirm = useConfirm();

 // ── State ───────────────────────────────────────────────────────────────────

 const rows = ref<any[]>([]);
 const selectedId = ref<string | null>(null);
 const canvasStyles = ref<Record<string, any>>(DEFAULT_CANVAS());
 const savedTemplateName = ref<string | null>(null);
 const templateTags = ref<any[]>([]);

 const selectedRowId = ref<string | null>(null);
 const selectedColumn = ref<{ rowId: string; columnId: string } | null>(
 null,
 );
 // UI tab state — kept here so loadTemplate / resetTemplate can clear them
 // on navigation, preventing stale panel content from a previous template.
 const sidebarTab = ref("properties");

 const previewMode = ref("desktop");
 const isBuilderReady = ref(false);
 const linksActive = ref<boolean>(false);

 // moved here from Header.vue's local refs — EmailEditor needs to
 // set these at the root when loading a template by ID; Header needs to
 // read/write them for the save flow. Shared state, not Header-local.
 const templateId = ref<string | null>(null);
 const builderMode = ref<"create" | "edit" | "view">("create");

 const visibilityPreviewContext = ref<Record<string, string>>({});

 const mergeTagInsertQueue = ref<{
 componentId: string;
 tagName: string;
 default: string;
 } | null>(null);

 const triggerMergeTagInsert = (
 componentId: string,
 tagName: string,
 defaultValue: string = "",
 ) => {
 mergeTagInsertQueue.value = { componentId, tagName, default: defaultValue };
 };

 const mergeTagPreviewContext = ref<Record<string, string>>({});
 const mergeTagPreviewActive = ref<boolean>(false);
 const linkTagPreviewContext = ref<Record<string, string>>({});
 const linkTagPreviewActive = ref<boolean>(false);

 // Cross-file canvas UI state — drag/hover flags that used to be independent
 // useState(key, ...) calls in every consuming file (CanvasRow, CanvasColumn,
 // CanvasComponent, Canvas.vue, CanvasRowDropZone, CanvasRowSpacer,
 // LayersPanel), each relying on Nuxt matching the same key string. No
 // single file owned these — they're peers — so they land here instead.
 const canvasHoveredId = ref<string | null>(null);
 const nestedRowDragId = ref<string | null>(null);
 const isRowDragActive = ref<boolean>(false);
 const isTopLevelRowDragActive = ref<boolean>(false);
 const layerHoveredId = ref<string | null>(null);

 // Shared with the export engine and three tab components (LinkTagTab,
 // MergeTagTab, VisibilityWrapESPTab) that previously each independently
 // called useState("espConfig", ...) and relied on Nuxt's key-based sharing
 // to land on the same object. Passed explicitly into useEmailExportEngine
 // below now instead.
 const espConfig = ref<{ syntax: import("../export/transformers/espWrapper").ESPSyntax }>({
 syntax: "handlebars",
 });

 // ── Modules ─────────────────────────────────────────────────────────────────

 const { defaultProps } = useEmailBuilderDefaults();
 const historyManager = useEmailBuilderHistory();

 const getCurrentStateFn = () =>
 historyManager.getCurrentState(rows, canvasStyles);

 const restoreStateFn = (state: any) =>
 historyManager.restoreState(
 state,
 rows,
 canvasStyles,
 selectedId,
 selectedRowId,
 selectedColumn,
 );

 const { generateHTMLComponent } = htmlGenerator();
 const { generateReactEmailComponent } = reactEmailGenerator();
 const { generateMJMLComponent } = mjmlGenerator();

 const generators = {
 html: generateHTMLComponent,
 react: generateReactEmailComponent,
 mjml: generateMJMLComponent,
 };

 const {
 saveToLocal,
 flushSave,
 loadFromLocal,
 clearLocal,
 hasDraft,
 saveStatus,
 lastSaved,
 } = useEmailBuilderPersistence();

 // ── Centralized Google Fonts sync ──────────────────────────────────────────
 //
 // Single watchEffect replaces the per-component `watch(fontFamily)` that
 // previously lived in CanvasComponent.vue. Rationale:
 //
 // • Per-component watches fired loadGoogleFont() once per component on
 // mount — a 62-component template with 6 unique fonts fired 6 separate
 // blocking <link> requests, sequentially scheduled during mount.
 // • One centralized watchEffect walks the tree, collects the UNIQUE set
 // of fonts, and dispatches them to syncFontsForTemplate() which
 // combines them into a single Google Fonts request.
 // • syncFontsForTemplate is idempotent; it diffs against the already-
 // loaded set and only injects a new <link> when the set grows.
 //
 // Mirrors the font-key extraction rules used by collectFonts() in
 // useEmailExportEngine — props.fontFamily + props.mobile.fontFamily on
 // every leaf component. If you add a new font-bearing prop path in the
 // future, update both walkers to keep canvas and export in sync.
 const { syncFontsForTemplate } = useGoogleFonts();

 const MAX_FONT_WALK_DEPTH = 5;
 const collectFontsForCanvas = (tree: any[]): string[] => {
 const found = new Set<string>();
 const walk = (children: any[], depth: number): void => {
 if (depth >= MAX_FONT_WALK_DEPTH) return;
 for (const child of children) {
 if (!child) continue;
 const t = child.type;
 if (t === "row") {
 for (const col of child.columns ?? []) {
 walk(col.children ?? col.components ?? [], depth + 1);
 }
 continue;
 }
 if (t === "row-spacer") continue;
 // leaf component
 const props = child.props;
 if (props?.fontFamily) found.add(props.fontFamily);
 if (props?.mobile?.fontFamily) found.add(props.mobile.fontFamily);
 }
 };

 for (const row of tree) {
 if (!row) continue;
 if (row.type === "row-spacer") continue;
 for (const col of row.columns ?? []) {
 walk(col.children ?? col.components ?? [], 0);
 }
 }
 return Array.from(found);
 };

 // Debounce font sync — rapid font-picker clicks would otherwise spam
 // syncFontsForTemplate. 200 ms is short enough to feel instant and long
 // enough to coalesce a burst of clicks into one <link> injection.
 {
 let fontSyncTimer: ReturnType<typeof setTimeout> | null = null;
 watchEffect(() => {
 const fonts = collectFontsForCanvas(rows.value as any[]);
 if (fontSyncTimer) clearTimeout(fontSyncTimer);
 fontSyncTimer = setTimeout(() => {
 fontSyncTimer = null;
 syncFontsForTemplate(fonts);
 }, 200);
 });
 }

 // ── Auto-save ───────────────────────────────────────────────────────────────

 let debounceTimer: ReturnType<typeof setTimeout> | null = null;
 // Suppresses debouncedSave while restoring state (init / loadTemplate)
 let _restoringFromStorage = false;

 const debouncedSave = () => {
 if (_restoringFromStorage) return;
 if (debounceTimer) clearTimeout(debounceTimer);
 debounceTimer = setTimeout(() => {
 debounceTimer = null;

 // Dirty-check: if nothing has actually changed since the last disk write,
 // skip the whole pipeline. Cheap integer compare — no tree walk needed.
 const v = historyManager.version.value;
 if (v === _lastSavedVersion) return;
 _lastSavedVersion = v;

 // Keep _activeTemplateName in sync with whatever the user has typed in
 // the header input. savedTemplateName is the useState the header writes
 // into, so reading it here ensures renames are captured in every
 // subsequent autosave — including the beforeunload flush — without
 // requiring a separate watcher.
 _activeTemplateName = savedTemplateName.value ?? undefined;

 saveToLocal(
 rows.value,
 canvasStyles.value,
 _activeTemplateId,
 _activeTemplateName,
 _activeTemplateTags,
 );
 }, AUTOSAVE_DEBOUNCE_MS);
 };

 // Structural ops → immediate; style/text → debounced
 function saveToHistory(action: string = "change", immediate = false) {
 historyManager.saveToHistory(getCurrentStateFn, action, immediate);
 debouncedSave();
 }

 function saveToHistoryImmediate(action: string) {
 saveToHistory(action, true);
 }

 // ── Operations ──────────────────────────────────────────────────────────────

 const operations = useEmailBuilderOperations(
 rows,
 selectedId,
 defaultProps,
 saveToHistoryImmediate,
 saveToHistory,
 );

 // ── ID registry rebuild helper ─────────────────────────────────────────────
 // The operations module maintains a flat Map<id, nodeRef> so findRow and
 // findComponent are O(1). That registry is kept in sync automatically for
 // single-node mutations (add, delete, duplicate, move). But any operation
 // that replaces rows.value WHOLESALE — undo/redo, loadTemplate,
 // initFromStorage, initForCreate, resetTemplate — must trigger an explicit
 // rebuild, because the incremental helpers only observe mutations that go
 // through the operations API.
 //
 // Calling this is cheap: O(N) over the node count (~80 for a 60-component
 // template), no allocations beyond Map entries. Do it AFTER the replacement
 // has settled (post-nextTick where relevant), so the Map points at the new
 // live references rather than the old ones.
 const rebuildRegistry = () => operations.rebuildIdRegistry();

 const addRowSilent = (layout: number | number[]) =>
 operations.addRow(layout, true);
 const addSpacerSilent = () => operations.addSpacer(true);
 const reorderRowsSilent = (from: number, to: number) =>
 operations.reorderRows(from, to, true);

 // ── deleteRow wrapper: invalidates stale selection state ───────────────────
 //
 // Bug this fixes: deleting a row from its action bar removed the row from
 // the tree but left `selectedId`, `selectedRowId`, and `selectedColumn`
 // pointing at IDs that no longer existed. The most visible symptom was
 // LayoutTab → handleLayoutClick: it reads `selectedColumn` to decide
 // between addRow (top-level append) and addNestedRow (insert into a
 // selected column). After a delete, `selectedColumn` still held a stale
 // { rowId, columnId } whose row was gone, so addNestedRow's
 // findRowAnywhere() returned null and silently bailed — the layout never
 // appeared. The user had to clear the canvas (resetTemplate, which DOES
 // null all three selection states) to unstick the panel.
 //
 // The fix mirrors what deleteComponent already does in operations
 // (`if (selectedId.value === id) selectedId.value = null`): a delete must
 // invalidate any selection that referenced the deleted subtree. We do it
 // here in the wrapper rather than inside operations.deleteRow because:
 // • selectedRowId and selectedColumn live in useEmailBuilder, not in
 // the operations module — wrapping avoids widening the operations
 // constructor signature.
 // • Every call site of deleteRow benefits, not just the action bar.
 //
 // We collect every ID in the about-to-be-deleted subtree (the row itself,
 // its columns, any nested rows, any components) and null any selection
 // state that points into that set. Then delegate to operations.deleteRow,
 // which performs the actual splice and history commit.
 const collectSubtreeIds = (node: any, ids: Set<string>): void => {
 if (!node?.id) return;
 ids.add(node.id);
 if (node.type === "row" && Array.isArray(node.columns)) {
 for (const col of node.columns) {
 if (col?.id) ids.add(col.id);
 const kids = col.children ?? col.components ?? [];
 for (const child of kids) collectSubtreeIds(child, ids);
 }
 }
 };

 const deleteRowWrapper = (id: any) => {
 // Resolve the live node BEFORE deletion so we can enumerate its IDs.
 // findRow handles both top-level and nested rows/spacers.
 const target = operations.findRow(id);
 if (target) {
 const ids = new Set<string>();
 collectSubtreeIds(target, ids);

 if (selectedId.value && ids.has(selectedId.value)) {
 selectedId.value = null;
 }
 if (selectedRowId.value && ids.has(selectedRowId.value)) {
 selectedRowId.value = null;
 }
 if (
 selectedColumn.value &&
 (ids.has(selectedColumn.value.rowId) ||
 ids.has(selectedColumn.value.columnId))
 ) {
 selectedColumn.value = null;
 }
 }

 operations.deleteRow(id);
 };

 const tagSubstitution = computed(() => ({
 mergeTagContext: mergeTagPreviewContext.value,
 mergeTagActive: mergeTagPreviewActive.value,
 linkTagContext: linkTagPreviewContext.value,
 linkTagActive: linkTagPreviewActive.value,
 }));

 const exportModule = useEmailExportEngine(
 rows,
 canvasStyles,
 generators,
 saveToHistory,
 visibilityPreviewContext,
 tagSubstitution,
 undefined, // visibilityContextOrUndefined — legacy-form-only, unused here
 undefined, // tagSubstitutionOrUndefined — legacy-form-only, unused here
 espConfig,
 infoDialogInstance,
 );

 // ── beforeunload / onUnmounted flush ────────────────────────────────────────
 // Registered once per composable call; removed in onUnmounted to prevent
 // listener stacking across SPA navigations.

 {
 const handleUnload = () => {
 if (debounceTimer) {
 clearTimeout(debounceTimer);
 debounceTimer = null;
 flushSave(
 rows.value,
 canvasStyles.value,
 _activeTemplateId,
 _activeTemplateName,
 _activeTemplateTags,
 );
 _lastSavedVersion = historyManager.version.value;
 }
 };

 window.addEventListener("beforeunload", handleUnload);

 onUnmounted(() => {
 window.removeEventListener("beforeunload", handleUnload);
 if (debounceTimer) {
 clearTimeout(debounceTimer);
 debounceTimer = null;
 flushSave(
 rows.value,
 canvasStyles.value,
 _activeTemplateId,
 _activeTemplateName,
 _activeTemplateTags,
 );
 _lastSavedVersion = historyManager.version.value;
 }
 });
 }

 // ── initFromStorage ─────────────────────────────────────────────────────────
 // Call in onMounted() of the create page only.
 // Returns the stored ISO updatedAt if a draft was restored, null otherwise.

 const initFromStorage = (): string | null => {
 if ((rows.value as any[]).length > 0) {
 isBuilderReady.value = true;
 // Registry may have missed the initial load (composable wasn't called
 // yet when rows were populated). Rebuild to be safe.
 rebuildRegistry();
 // Clear all selection + panel state. selectedColumn/selectedRowId are
 // useState globals that survive SPA navigation, so a column selected in
 // a previously visited template can persist into this entry. If it does,
 // LayoutTab.handleLayoutClick reads the stale selectedColumn and routes
 // layout clicks to addNestedRow against a column that no longer exists —
 // findRowAnywhere returns null and the add bails silently (drag-drop is
 // unaffected because it never reads selectedColumn). Mirrors loadTemplate.
 selectedId.value = null;
 selectedRowId.value = null;
 selectedColumn.value = null;
 sidebarTab.value = "properties";
 return null;
 }

 const draft = loadFromLocal();
 if (!draft) {
 isBuilderReady.value = true;
 return null;
 }

 // initFromStorage is the generic, layout-level restore — the Header's
 // onMounted calls it on EVERY builder route (create and edit), because the
 // Header lives in the `designer` layout. It must therefore only ever restore
 // CREATE-page drafts (templateId === null), which is its sole legitimate
 // use. Edit-page drafts (templateId !== null) are owned by loadTemplate(),
 // which reconciles them against the current route's templateId. Restoring an
 // edit draft here — before loadTemplate runs — would momentarily paint a
 // different template's content onto the canvas and race loadTemplate's own
 // draft/DB reconciliation.
 //
 // We deliberately DO NOT clearLocal() here: on an edit page this draft is
 // exactly the unsaved work loadTemplate still needs to restore. Just bow out
 // and let loadTemplate handle it. Mirrors initForCreate's own
 // `draft.templateId === null` gate.
 if (draft.templateId !== null) {
 isBuilderReady.value = true;
 return null;
 }

 isBuilderReady.value = false;
 _restoringFromStorage = true;
 rows.value = draft.rows;
 canvasStyles.value = draft.canvas;
 // Wholesale row replacement — clear all selection + panel state so a stale
 // selectedColumn/selectedRowId from a previously visited template can't
 // survive into this restored draft (same hazard as loadTemplate guards
 // against: stale selectedColumn makes LayoutTab click-to-add silently bail).
 selectedId.value = null;
 selectedRowId.value = null;
 selectedColumn.value = null;
 sidebarTab.value = "properties";

 nextTick(() => {
 _restoringFromStorage = false;
 // Wholesale replacement — rebuild the registry so the very first
 // findComponent call (from ContentTab's selectedComponent computed)
 // hits the fast path.
 rebuildRegistry();
 historyManager.initialize(getCurrentStateFn());
 // After seeding history, sync the last-saved marker so the very next
 // autosave correctly sees "no change yet" and skips redundant work.
 _lastSavedVersion = historyManager.version.value;
 isBuilderReady.value = true;
 });

 lastSaved.value = new Date(draft.updatedAt);

 // Restore the cached template name and tags from the draft so the header
 // input is populated without needing a DB fetch.
 if (draft.name !== undefined) savedTemplateName.value = draft.name;
 if (draft.tags !== undefined) templateTags.value = draft.tags;

 return draft.updatedAt;
 };

 // ── saveTemplate ───────────────────────────────────────────────────
 // Replaces Header.vue's old saveTemplateStub. Takes the already-optimized
 // payload (Header still owns building it, since it has the toast/label
 // logic around the call) and stamps templateId/builderMode on success.
 const saveTemplate = async (payload: {
 rows: any[];
 canvasStyles: Record<string, any>;
 name?: string;
 tags?: string[];
 }): Promise<string> => {
 const { templateId: newId } = await storageAdapter.saveTemplate(
 payload,
 templateId.value ?? undefined,
 );
 templateId.value = newId;
 if (builderMode.value === "create") {
 builderMode.value = "edit";
 }
 // Logged regardless of which adapter is active — a host can see/copy
 // the actual email JSON straight from the console, even before they've
 // implemented a custom storageAdapter, or just for debugging what's
 // actually being persisted.
 const exportedJson = exportModule.getExportedJSON(payload.name);
 if (exportedJson) {
 console.info("[maildeno-editor] Saved — exported JSON:", exportedJson);
 }
 return newId;
 };

 // ── loadTemplateById ───────────────────────────────────────────────
 // Adapter-driven entry point — called from EmailEditor.vue when a
 // templateId prop is given. Fetches via the adapter, then hands off to
 // the existing loadTemplate() below (draft reconciliation, proper
 // nextTick/registry/history sequencing) rather than duplicating that
 // logic — this only adds the fetch step that useTemplateAPI would have
 // done in the original app.
 const loadTemplateById = async (id: string): Promise<boolean> => {
 const snapshot = await storageAdapter.loadTemplate(id);
 if (!snapshot) return false;

 loadTemplate(
 {
 canvas: snapshot.canvasStyles,
 content: { rows: snapshot.rows },
 name: snapshot.name,
 tags: snapshot.tags,
 },
 id,
 );
 templateId.value = id;
 builderMode.value = "edit";
 return true;
 };

 // ── initForCreate ───────────────────────────────────────────────────────────
 // Call in onMounted() of pages/email/create.vue.
 // Restores a create-page draft (templateId: null) if one exists;
 // clears any edit-page draft that may have leaked in.

 const initForCreate = () => {
 isBuilderReady.value = false;

 // Clear selection + panel state up front, BEFORE the draft branch below,
 // so both exits are covered (the initFromStorage draft-restore return AND
 // the blank-canvas reset). selectedColumn/selectedRowId are useState
 // globals that survive SPA navigation; a column selected while building a
 // previous template persists into a fresh /create entry. Without this,
 // LayoutTab.handleLayoutClick reads the stale selectedColumn and routes
 // layout clicks to addNestedRow against a column that no longer exists,
 // which bails silently — so clicking a layout adds nothing. (Drag-drop is
 // unaffected: Canvas.handleLayoutDrop never reads selectedColumn.) A full
 // page refresh masked this because useState re-initialises to null on
 // reload. Mirrors resetTemplate()/loadTemplate().
 selectedColumn.value = null;
 selectedRowId.value = null;
 sidebarTab.value = "properties";

 if (debounceTimer) {
 clearTimeout(debounceTimer);
 debounceTimer = null;
 }

 const draft = loadFromLocal();

 if (draft && draft.templateId === null) {
 initFromStorage();
 return;
 }

 if (draft && draft.templateId !== null) {
 clearLocal();
 }

 _restoringFromStorage = true;
 rows.value = [];
 selectedId.value = null;
 canvasStyles.value = DEFAULT_CANVAS();
 _activeTemplateId = null;
 // Clear name/tags so a stale value from a previously visited edit page
 // doesn't bleed into a fresh /create session.
 savedTemplateName.value = null;
 templateTags.value = [];

 nextTick(() => {
 _restoringFromStorage = false;
 // Registry rebuild after wholesale reset. Tree is empty here but the
 // call is still correct and costs ~nothing.
 rebuildRegistry();
 historyManager.initialize(getCurrentStateFn());
 _lastSavedVersion = historyManager.version.value;
 isBuilderReady.value = true;
 });
 };

 // ── startNewTemplate ────────────────────────────────────────────────────────
 /**
 * Starts a genuinely blank template. Backs the header's "New template"
 * button.
 *
 * Separate from initForCreate rather than reusing it, because the two want
 * opposite things from a saved draft. initForCreate runs on mount, where
 * restoring the draft is the whole point — it's how an interrupted session
 * survives a refresh. This is an explicit user action meaning "throw that
 * away", so it always clears the draft instead of restoring it. Calling
 * initForCreate here hit its draft branch and left the canvas exactly as it
 * was, which is why the button appeared to do nothing.
 *
 * It also resets templateId and builderMode, which initForCreate leaves
 * alone (it only clears the internal _activeTemplateId). Those two drive the
 * header's Save/Update label and decide whether the next save creates a new
 * template or overwrites the one that was open — so without resetting them,
 * saving a "new" template would silently overwrite the previous one.
 */
 const startNewTemplate = () => {
 isBuilderReady.value = false;

 selectedColumn.value = null;
 selectedRowId.value = null;
 sidebarTab.value = "properties";

 if (debounceTimer) {
 clearTimeout(debounceTimer);
 debounceTimer = null;
 }

 // Unconditional, unlike initForCreate: the draft is what we're discarding.
 clearLocal();

 _restoringFromStorage = true;
 rows.value = [];
 selectedId.value = null;
 canvasStyles.value = DEFAULT_CANVAS();
 _activeTemplateId = null;
 templateId.value = null;
 builderMode.value = "create";
 savedTemplateName.value = null;
 templateTags.value = [];

 nextTick(() => {
 _restoringFromStorage = false;
 rebuildRegistry();
 historyManager.initialize(getCurrentStateFn());
 _lastSavedVersion = historyManager.version.value;
 isBuilderReady.value = true;
 });
 };

 // ── loadTemplate ────────────────────────────────────────────────────────────
 // Call in onMounted() of pages/email/[id].vue.
 // Checks localStorage for a matching draft before applying the DB payload.
 // The global isBuilderReady still controls internal builder component behaviour
 // The local isReady:onReady prop controls whether EmailEditor renders the <Loader> overlay — and this one is guaranteed to be false on every fresh navigation because it's a local ref

 const loadTemplate = (
 template: {
 canvas: any;
 content: { rows: any[] };
 name?: string;
 tags?: any[];
 },
 templateId: string,
 onReady?: () => void,
 ) => {
 isBuilderReady.value = false;
 _activeTemplateId = templateId;
 // Stamp name + tags so every subsequent auto-save carries them and the
 // page can restore them from the draft without a DB fetch.
 _activeTemplateName = template.name;
 _activeTemplateTags = template.tags;

 // Populate reactive state immediately so the header input reflects the
 // template name as soon as loadTemplate is called, before any draft
 // check or DB hydration completes.
 savedTemplateName.value = template.name ?? null;
 templateTags.value = template.tags ?? [];

 if (debounceTimer) {
 clearTimeout(debounceTimer);
 debounceTimer = null;
 }

 const draft = loadFromLocal();

 if (draft && draft.templateId === templateId) {
 // Matching draft — restore it, skip the DB payload.
 // Prefer the draft's cached name/tags over the DB values: the draft
 // may carry a rename the user made in a previous session that hasn't
 // been DB-saved yet.
 console.info(
 `[EmailBuilder] Restoring local draft for template ${templateId} (saved ${draft.updatedAt}).`,
 );

 if (draft.name !== undefined) savedTemplateName.value = draft.name;
 if (draft.tags !== undefined) templateTags.value = draft.tags;

 _restoringFromStorage = true;
 canvasStyles.value = draft.canvas;
 rows.value = draft.rows;
 // Clear all selection + panel state so ContentTab doesn't show stale
 // data from the previously visited template.
 selectedId.value = null;
 selectedRowId.value = null;
 selectedColumn.value = null;
 sidebarTab.value = "properties";

 nextTick(() => {
 _restoringFromStorage = false;
 // Wholesale replacement from draft — rebuild registry
 rebuildRegistry();
 historyManager.initialize(getCurrentStateFn());
 _lastSavedVersion = historyManager.version.value;
 isBuilderReady.value = true;
 onReady?.();
 });

 lastSaved.value = new Date(draft.updatedAt);
 return;
 }

 if (draft && draft.templateId !== templateId) {
 // Stale draft from a different template — clear it
 console.info(
 `[EmailBuilder] Clearing stale draft (belongs to ${draft.templateId}, current is ${templateId}).`,
 );
 clearLocal();
 }

 // Apply DB payload
 _restoringFromStorage = true;
 canvasStyles.value = hydrateCanvas(
 JSON.parse(JSON.stringify(template.canvas)),
 );
 rows.value = hydrateRows(
 JSON.parse(JSON.stringify(template.content?.rows ?? [])),
 );
 // Clear all selection + panel state so ContentTab doesn't show stale
 // data from the previously visited template.
 selectedId.value = null;
 selectedRowId.value = null;
 selectedColumn.value = null;
 sidebarTab.value = "properties";

 nextTick(() => {
 _restoringFromStorage = false;
 // Wholesale replacement from DB — rebuild registry
 rebuildRegistry();
 historyManager.initialize(getCurrentStateFn());
 _lastSavedVersion = historyManager.version.value;
 isBuilderReady.value = true;
 onReady?.();
 });
 };

 // ── loadVersionSnapshot ───────────────────────────────────────────────────
 //
 // In-place restore of a version's DESIGN into the CURRENTLY OPEN template.
 // The history drawer calls this after fetching a FullTemplateVersion via
 // useTemplateVersions().getVersion(). It deliberately differs from
 // loadTemplate():
 // • No draft check. loadTemplate prefers a matching localStorage draft over
 // its payload; here we always want the chosen version, not a draft.
 // • No isBuilderReady toggle. The builder is already mounted and the user
 // is mid-edit; swapping rows.value reactively re-renders the canvas in
 // place with no remount flash.
 // • Pushed onto the history stack as an UNDOABLE step (saveToHistoryImmediate)
 // rather than initialize(), so the user can undo the restore. It also
 // marks the document dirty and schedules a localStorage autosave of the
 // restored state. The user then clicks Save to persist via the normal PUT,
 // which archives the pre-restore state as a brand-new version.
 // • name / tags are intentionally NOT changed — a restore brings back the
 // design, not the template's identity. (The header keeps its current name.)
 //
 // Font sync is automatic: the watchEffect on rows.value picks up the restored
 // tree's fonts on the next tick, same as any other wholesale replacement.
 const loadVersionSnapshot = (snapshot: {
 canvas: any;
 content: { rows: any[] };
 }) => {
 if (debounceTimer) {
 clearTimeout(debounceTimer);
 debounceTimer = null;
 }

 _restoringFromStorage = true; // suppress the autosave watcher during the swap
 canvasStyles.value = hydrateCanvas(
 JSON.parse(JSON.stringify(snapshot.canvas)),
 );
 rows.value = hydrateRows(
 JSON.parse(JSON.stringify(snapshot.content?.rows ?? [])),
 );
 // Clear selection + panel state so the property panels don't point at nodes
 // that no longer exist in the restored tree.
 selectedId.value = null;
 selectedRowId.value = null;
 selectedColumn.value = null;
 sidebarTab.value = "properties";

 nextTick(() => {
 _restoringFromStorage = false;
 // Wholesale replacement — rebuild the id registry before any find* runs.
 rebuildRegistry();
 // Undoable step; also marks dirty + schedules an autosave of the restored
 // state. NOT initialize() — that would wipe the undo history.
 saveToHistoryImmediate("restore-version");
 });
 };

 // ── Undo / Redo ─────────────────────────────────────────────────────────────
 //
 // Undo / redo replace rows.value wholesale with a cloned snapshot from the
 // history stack. The old node references are gone; the registry is pointing
 // at ghosts. MUST rebuild before control returns to the caller, otherwise
 // the next findComponent / findRow call will return a stale (detached)
 // reference and the UI will appear to do nothing when the user clicks.
 //
 // Rebuild is O(N), dwarfed by the clone work that already ran inside
 // historyManager.undo() / redo(). No perceptible impact.

 const undoWrapper = () => {
 const previousState = historyManager.undo(restoreStateFn);
 if (previousState) {
 rebuildRegistry();
 debouncedSave();
 }
 };

 const redoWrapper = () => {
 const nextState = historyManager.redo(restoreStateFn);
 if (nextState) {
 rebuildRegistry();
 debouncedSave();
 }
 };

 // ── Template management ─────────────────────────────────────────────────────

 const resetTemplate = () => {
 rows.value = [];
 selectedId.value = null;
 selectedRowId.value = null;
 selectedColumn.value = null;
 sidebarTab.value = "properties";
 canvasStyles.value = DEFAULT_CANVAS();
 nextTick(() => {
 // Empty tree, but still rebuild so the registry is in a known-clean state.
 rebuildRegistry();
 historyManager.initialize(getCurrentStateFn());
 _lastSavedVersion = historyManager.version.value;
 });
 };

 const clearTemplate = () => {
 confirm.require({
 message:
 "Are you sure you want to clear the current template? This cannot be undone.",
 header: "Clear Template",
 acceptLabel: "Yes",
 rejectLabel: "Cancel",
 acceptClass: "!bg-red-600 !hover:bg-red-700 !border-red-600 !px-6 !py-2",
 rejectClass:
 "!bg-gray-200 !hover:bg-gray-300 !text-gray-800 !border-gray-200 !px-6 !py-2",
 accept: () => resetTemplate(),
 reject: () => {},
 });
 };

 // ── Public API ──────────────────────────────────────────────────────────────

 return {
 // State
 rows,
 canvasStyles,
 templateTags,
 savedTemplateName,
 previewMode,
 sidebarTab,
 selectedId,
 selectedRowId,
 selectedColumn,
 visibilityPreviewContext,
 mergeTagInsertQueue,
 triggerMergeTagInsert,
 mergeTagPreviewContext,
 mergeTagPreviewActive,
 linkTagPreviewContext,
 linkTagPreviewActive,
 isBuilderReady,
 linksActive,
 espConfig,
 canvasHoveredId,
 nestedRowDragId,
 isRowDragActive,
 isTopLevelRowDragActive,
 layerHoveredId,

 // Row operations
 addRow: operations.addRow,
 addNestedRow: operations.addNestedRow,
 findRow: operations.findRow,
 deleteRow: deleteRowWrapper,
 moveRow: operations.moveRow,
 moveNestedRow: operations.moveNestedRow,
 reorderRows: operations.reorderRows,
 addSpacer: operations.addSpacer,
 duplicateRow: operations.duplicateRow,
 duplicateRowSpacer: operations.duplicateRowSpacer,

 // Silent batch variants (Canvas.vue drag-drop)
 addRowSilent,
 addSpacerSilent,
 reorderRowsSilent,

 // Component operations
 addComponent: operations.addComponent,
 addComponentAtIndex: operations.addComponentAtIndex,
 deleteComponent: operations.deleteComponent,
 moveComponent: operations.moveComponent,
 moveComponentBetweenColumns: operations.moveComponentBetweenColumns,
 findComponent: operations.findComponent,
 updateComponent: operations.updateComponent,
 duplicateComponent: operations.duplicateComponent,

 // Export / Import
 exportHTML: exportModule.exportHTML,
 getExportedHTML: exportModule.getExportedHTML,
 exportReactEmail: exportModule.exportReactEmail,
 getExportedReactEmail: exportModule.getExportedReactEmail,
 exportMJML: exportModule.exportMJML,
 getExportedMJML: exportModule.getExportedMJML,
 exportJSON: exportModule.exportJSON,
 getExportedJSON: exportModule.getExportedJSON,
 importJSON: (file: File) => exportModule.importJSON(file, selectedId),

 // Template management
 clearTemplate,

 // History
 undo: undoWrapper,
 redo: redoWrapper,
 canUndo: historyManager.canUndo,
 canRedo: historyManager.canRedo,
 historyStatus: historyManager.historyStatus,
 saveToHistory,
 saveToHistoryImmediate,

 // Auto-save
 initFromStorage,
 clearLocal,
 loadFromLocal,
 hasDraft,
 saveStatus,
 lastSaved,

 // DB integration
 initForCreate,
 startNewTemplate,
 loadTemplate,
 loadTemplateById,
 saveTemplate,
 templateId,
 builderMode,
 loadVersionSnapshot,
 };
}
