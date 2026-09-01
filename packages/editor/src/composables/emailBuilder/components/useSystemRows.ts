// useSystemRows.ts
//
// The read-only counterpart to useProductRows, backing the "Shared" tab in
// SavedRowsPanel.
//
// Kept as its own composable rather than a flag on useProductRows because the
// two have genuinely different shapes: this one has no save, no rename and no
// delete, and adding them as no-ops would invite call sites that appear to
// work and silently do nothing. The panel's RowSource interface is what makes
// them interchangeable where it matters.
//
// Same provide/inject arrangement as useProductRows: one instance at the
// EmailEditor root, injected everywhere else, so the list is fetched once and
// shared rather than re-fetched per consumer.

import { ref, provide, inject, type InjectionKey } from "vue";
import { useStorageAdapter } from "@/adapters";
import type { SavedRow, EditorStorageAdapter } from "@/adapters/types";

function createSystemRowsInstance(
  storageAdapterInstance?: EditorStorageAdapter,
) {
  const adapter = storageAdapterInstance ?? useStorageAdapter();

  const systemRows = ref<SavedRow[]>([]);
  const isFetching = ref(false);
  /** False when the host's adapter doesn't implement the method at all. The
   *  panel uses this to decide whether the tab can ever exist. */
  const isSupported = ref(typeof adapter.listSystemSavedRows === "function");
  let hasFetched = false;

  async function fetchRows() {
    if (hasFetched || !isSupported.value) return;
    hasFetched = true;
    isFetching.value = true;
    try {
      systemRows.value = await adapter.listSystemSavedRows();
    } catch (e) {
      // Swallowed to a warning rather than surfaced: a shared library that
      // fails to load should cost the user that tab, not their session. Their
      // own rows and the canvas are unaffected, and a toast here would fire on
      // every panel open for a host whose endpoint is misconfigured.
      console.warn("[maildeno-editor] couldn't load shared rows:", e);
      systemRows.value = [];
    } finally {
      isFetching.value = false;
    }
  }

  /**
   * Delegates to the same synchronous clone the user library uses.
   *
   * The adapter resolves ids across BOTH libraries because this runs mid-drag
   * and the drag has no idea which tab the row came from — see the note on
   * listSystemSavedRows in adapters/types.ts.
   */
  function cloneRowForCanvas(entryId: string): Record<string, any> | null {
    return adapter.cloneSavedRowForCanvas(entryId);
  }

  return { systemRows, isFetching, isSupported, fetchRows, cloneRowForCanvas };
}

export type SystemRowsInstance = ReturnType<typeof createSystemRowsInstance>;

const SystemRowsKey: InjectionKey<SystemRowsInstance> = Symbol(
  "maildeno-editor:system-rows",
);

export function provideSystemRows(
  storageAdapterInstance?: EditorStorageAdapter,
): SystemRowsInstance {
  const instance = createSystemRowsInstance(storageAdapterInstance);
  provide(SystemRowsKey, instance);
  return instance;
}

export function useSystemRows(): SystemRowsInstance {
  const instance = inject(SystemRowsKey, undefined);
  if (!instance) {
    // Matches useProductRows / useStorageAdapter: degrade to a private
    // instance rather than throw, so a component rendered outside
    // EmailEditor's tree still works instead of crashing.
    return createSystemRowsInstance();
  }
  return instance;
}
