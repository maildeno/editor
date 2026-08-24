import { provide, inject, type InjectionKey } from "vue";
import type { EditorStorageAdapter, PartialStorageAdapter } from "./types";
import { createLocalStorageAdapter } from "./localStorageAdapter";

const StorageAdapterKey: InjectionKey<EditorStorageAdapter> = Symbol(
  "maildeno-editor:storage-adapter",
);

/**
 * Called once, at the EmailEditor root. Accepts the host's adapter if one
 * was passed as a prop; falls back to the localStorage default otherwise.
 * Per-instance, matching every other provide() in this package — two
 * <EmailEditor> on one page each get their own adapter instance, not a
 * shared one.
 *
 * Returns the instance directly — EmailEditor.vue passes this straight
 * into provideEmailBuilder()/provideProductRows() rather than having them
 * call useStorageAdapter() internally. inject() never sees a component's
 * own provides (only its parent's, or app context for the root) — a
 * component can never inject what it itself just provided, in any Vue
 * app, regardless of call order. Confirmed against Vue's actual inject()
 * source, not assumed.
 */

/**
 * Fills any method a host left out with the localStorage default, so the
 * rest of the editor can call the adapter unconditionally.
 *
 * Hosts commonly want to override one thing — images to S3, say — without
 * reimplementing template and saved-row persistence they are happy to keep
 * local. Requiring all eight methods to change one of them is a poor trade,
 * and every call site guarding `adapter.x?.()` would be worse.
 *
 * Keys explicitly set to undefined are ignored rather than overriding a
 * default with nothing — `{ uploadImage: maybeUndefined }` should degrade
 * to the default, not break image upload.
 */
function mergeWithDefaults(
  partial: PartialStorageAdapter | undefined,
): EditorStorageAdapter {
  const defaults = createLocalStorageAdapter();
  if (!partial) return defaults;

  const merged = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(partial)) {
    if (typeof value === "function") merged[key] = value;
  }

  // Mixing backends per-method is legal but rarely intended: saving to your
  // own store while listing from localStorage looks like data loss from the
  // user's side. Warn once, in development only.
  if (
    (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV &&
    (partial.saveTemplate || partial.loadTemplate) &&
    !partial.listTemplates
  ) {
    console.warn(
      "[maildeno-editor] storageAdapter implements loadTemplate/saveTemplate " +
        "but not listTemplates — the saved-templates panel will list " +
        "localStorage templates, not yours. Implement listTemplates (and " +
        "deleteTemplate) to list from the same place you save to.",
    );
  }

  return merged as unknown as EditorStorageAdapter;
}

export function provideStorageAdapter(
  adapter?: PartialStorageAdapter,
): EditorStorageAdapter {
  const instance = mergeWithDefaults(adapter);
  provide(StorageAdapterKey, instance);
  return instance;
}

/** For genuine child components of <EmailEditor> — Header.vue,
 * SavedRowsPanel.vue, etc. Their inject() correctly sees EmailEditor.vue's
 * provides via instance.parent.provides, since they're actual children,
 * not the same instance that called provide(). */
export const useStorageAdapter = (): EditorStorageAdapter => {
  const instance = inject(StorageAdapterKey);
  if (!instance) {
    // Falls back rather than throwing — a hard crash of the entire editor
    // is a worse failure mode than quietly using the default local adapter
    // for whatever this render happened to be. Still console-visible, so
    // it won't silently hide a real integration problem for a host who
    // passed a custom adapter and would want to know it wasn't picked up.
    console.warn(
      "[maildeno-editor] useStorageAdapter() couldn't find a provided adapter " +
        "— falling back to the default localStorage adapter. If you passed a " +
        "custom storageAdapter, it wasn't picked up; please report this.",
    );
    return createLocalStorageAdapter();
  }
  return instance;
};
