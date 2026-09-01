import { ref, provide, inject, type InjectionKey } from "vue";

/**
 * Shared open/close state for the Saved Rows panel.
 *
 * this used to be Nuxt's useState, shared across components by
 * matching string key. Same provide/inject conversion as useEmailBuilder —
 * one instance created at the EmailEditor root, injected everywhere else,
 * so LayoutTab's toggle button and SavedRowsPanel's isOpen check still see
 * the same boolean.
 *
 * The "system" tab concept was removed from SavedRowsPanel.vue
 * (see its top-of-file note) — activeTab is kept here since LayoutTab still
 * references the shape, but it's permanently "user" now in practice.
 */

export type SavedRowsTab = "user" | "system";

type SavedRowsPanelInstance = ReturnType<typeof createSavedRowsPanelInstance>;
const SavedRowsPanelKey: InjectionKey<SavedRowsPanelInstance> = Symbol(
  "maildeno-editor:saved-rows-panel",
);

/** Called once, at the EmailEditor root. */
export function provideSavedRowsPanel() {
  const instance = createSavedRowsPanelInstance();
  provide(SavedRowsPanelKey, instance);
  return instance;
}

/** Every other file calls this exactly as before. */
export const useSavedRowsPanel = (): SavedRowsPanelInstance => {
  const instance = inject(SavedRowsPanelKey);
  if (!instance) {
    throw new Error(
      "[maildeno-editor] useSavedRowsPanel() was called outside an EmailEditor instance.",
    );
  }
  return instance;
};

function createSavedRowsPanelInstance() {
  const isOpen = ref<boolean>(false);
  const activeTab = ref<SavedRowsTab>("user");

  function open(tab?: SavedRowsTab) {
    if (tab) activeTab.value = tab;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle(tab?: SavedRowsTab) {
    // If a tab is requested and the panel is already open on a different tab,
    // don't close — just switch tabs. This matches the typical pattern in
    // products like Figma / Notion where clicking a sidebar item that's
    // already showing a different sub-view switches view rather than closing.
    if (tab && isOpen.value && activeTab.value !== tab) {
      activeTab.value = tab;
      return;
    }
    isOpen.value = !isOpen.value;
    if (isOpen.value && tab) activeTab.value = tab;
  }

  function setTab(tab: SavedRowsTab) {
    activeTab.value = tab;
  }

  return {
    isOpen,
    activeTab,
    open,
    close,
    toggle,
    setTab,
  };
}
