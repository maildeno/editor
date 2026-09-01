import { ref, provide, inject, type InjectionKey } from "vue";

/**
 * same provide/inject conversion — called from SidebarBlockButton.vue
 * and useEmailExportEngine.ts (via useEmailBuilder), both needing to open the
 * same dialog that presumably renders once near the EmailEditor root.
 */

type InfoDialogInstance = ReturnType<typeof createInfoDialogInstance>;
const InfoDialogKey: InjectionKey<InfoDialogInstance> = Symbol(
  "maildeno-editor:info-dialog",
);

/** Called once, at the EmailEditor root. */
export function provideInfoDialog() {
  const instance = createInfoDialogInstance();
  provide(InfoDialogKey, instance);
  return instance;
}

/** Every other file calls this exactly as before. */
export const useInfoDialog = (): InfoDialogInstance => {
  const instance = inject(InfoDialogKey);
  if (!instance) {
    // Falls back rather than throwing — matches useStorageAdapter's same
    // reasoning. A standalone instance here just means open() won't
    // actually show anything (nothing's listening to its refs), which is
    // a far better failure mode than crashing the whole editor over a
    // missing error dialog specifically.
    console.warn(
      "[maildeno-editor] useInfoDialog() couldn't find a provided instance " +
        "— falling back to a standalone instance (open() won't visibly show anything).",
    );
    return createInfoDialogInstance();
  }
  return instance;
};

function createInfoDialogInstance() {
  const visible = ref(false);
  const header = ref("Info");
  const message = ref("");

  const open = (msg: string, h = "Info") => {
    message.value = msg;
    header.value = h;
    visible.value = true;
  };

  return { visible, header, message, open };
}
