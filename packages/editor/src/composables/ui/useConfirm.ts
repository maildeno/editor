import { ref, shallowRef } from "vue";

/**
 * Confirmation dialog store.
 *
 * Module-level singleton state rather than provide/inject, deliberately.
 * An injected service has two failure modes this avoids: it can't be read
 * from the same component that provides it (Vue's inject() never sees the
 * current component's own provide()), and two copies of the providing
 * module produce two different injection keys for what should be one
 * store. A module-scoped ref has neither problem — one store, no keys, no
 * dependency on where in the tree the caller sits — so it behaves
 * identically however the editor is mounted.
 */

export interface ConfirmOptions {
  message?: string;
  header?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  acceptClass?: string;
  rejectClass?: string;
  accept?: () => void;
  reject?: () => void;
}

/** Null when nothing is pending — ConfirmDialog.vue renders on this. */
export const activeConfirm = shallowRef<ConfirmOptions | null>(null);
export const confirmVisible = ref(false);

function close() {
  confirmVisible.value = false;
  // Cleared after the close transition so the dialog doesn't visibly
  // empty out while it animates away.
  setTimeout(() => {
    if (!confirmVisible.value) activeConfirm.value = null;
  }, 200);
}

export function acceptActive() {
  const opts = activeConfirm.value;
  close();
  opts?.accept?.();
}

export function rejectActive() {
  const opts = activeConfirm.value;
  close();
  opts?.reject?.();
}

export function useConfirm() {
  return {
    require(options: ConfirmOptions) {
      activeConfirm.value = options;
      confirmVisible.value = true;
    },
    close,
  };
}
