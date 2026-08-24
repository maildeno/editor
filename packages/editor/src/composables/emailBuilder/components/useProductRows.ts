// useProductRows.ts — unified entry point
//
// bridges the promise-based EditorStorageAdapter interface (which
// needs to work for a future network-backed adapter too) with the reactive
// ref UI expects (SavedRowsPanel.vue, CanvasRow.vue, CanvasColumn.vue all
// bind directly to `productRows.value`). This composable is the only place
// that changes — every UI consumer keeps the exact same public shape as
// before and needs zero changes.
//
// 's provide/inject conversion is preserved: one instance created at
// the EmailEditor root, injected everywhere else, so every caller shares
// the same reactive rows array.
import { ref, provide, inject, type InjectionKey } from "vue";
import { useStorageAdapter } from "@/adapters";
import type { SavedRow, EditorStorageAdapter } from "@/adapters/types";

function createProductRowsInstance(storageAdapterInstance?: EditorStorageAdapter) {
 const adapter = storageAdapterInstance ?? useStorageAdapter();

 const productRows = ref<SavedRow[]>([]);
 const isFetching = ref(false);
 let hasFetched = false;

 async function fetchRows() {
 if (hasFetched) return;
 hasFetched = true;
 isFetching.value = true;
 try {
 productRows.value = await adapter.listSavedRows();
 } finally {
 isFetching.value = false;
 }
 }

 async function saveProductRow(
 row: Record<string, any>,
 name: string,
 ): Promise<SavedRow | null> {
 const entry = await adapter.saveSavedRow(row, name);
 if (entry) {
 productRows.value = [entry, ...productRows.value];
 }
 return entry;
 }

 async function deleteProductRow(entryId: string) {
 await adapter.deleteSavedRow(entryId);
 productRows.value = productRows.value.filter((r) => r.id !== entryId);
 }

 async function renameProductRow(entryId: string, newName: string) {
 await adapter.renameSavedRow(entryId, newName);
 productRows.value = productRows.value.map((r) =>
 r.id === entryId ? { ...r, name: newName.trim() || r.name } : r,
 );
 return productRows.value;
 }

 function cloneRowForCanvas(entryId: string): Record<string, any> | null {
 return adapter.cloneSavedRowForCanvas(entryId);
 }

 return {
 productRows,
 isFetching,
 fetchRows,
 saveProductRow,
 deleteProductRow,
 renameProductRow,
 cloneRowForCanvas,
 };
}

type ProductRowsInstance = ReturnType<typeof createProductRowsInstance>;
const ProductRowsKey: InjectionKey<ProductRowsInstance> = Symbol(
 "maildeno-editor:product-rows",
);

/** Called once, at the EmailEditor root. storageAdapterInstance is the
 * already-created return value of provideStorageAdapter() — same reasoning
 * as useEmailBuilder.ts's matching parameter: inject() never sees a
 * component's own provides, so useStorageAdapter() called from anywhere
 * within EmailEditor.vue's own setup() can never find what
 * provideStorageAdapter() (also called there) just provided. */
export function provideProductRows(storageAdapterInstance?: EditorStorageAdapter) {
 const instance = createProductRowsInstance(storageAdapterInstance);
 provide(ProductRowsKey, instance);
 return instance;
}

/** Every other file calls this exactly as before. */
export const useProductRows = (): ProductRowsInstance => {
 const instance = inject(ProductRowsKey);
 if (!instance) {
 throw new Error(
 "[maildeno-editor] useProductRows() was called outside an EmailEditor instance.",
 );
 }
 return instance;
};
