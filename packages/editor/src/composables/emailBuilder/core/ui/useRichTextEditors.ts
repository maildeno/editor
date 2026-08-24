// @/composables/emailBuilder/core/useRichTextEditors.ts
import { reactive, markRaw } from "vue";
import type { Editor } from "@tiptap/vue-3";

// ─── Active rich-text editor registry ──────────────────────────────────────────
// Module-scoped singleton: one Map shared by every caller. Each RichTextEditor
// registers its TipTap instance under the owning component's id on mount and
// removes it on unmount. Property panels resolve the live editor for the
// selected component via editorFor(selectedId) — no prop-drilling through the
// canvas tree.
//
// Kept separate from useEmailBuilder on purpose: the store owns serialisable
// document state (rows, selection, history); a TipTap Editor is a live,
// non-serialisable class instance and must never end up snapshotted into history.
const editors = reactive(new Map<string, Editor>());

export function useRichTextEditors() {
  // markRaw is critical. A reactive Map wraps the values returned from .get() in
  // a reactive() proxy; proxying a TipTap Editor (it holds a ProseMirror view +
  // other class instances) breaks it. markRaw hands back the raw instance, while
  // the Map itself stays reactive so computeds reading editorFor() still update
  // when an editor (un)registers.
  const registerEditor = (id: string, editor: Editor) => {
    editors.set(id, markRaw(editor));
  };

  const unregisterEditor = (id: string) => {
    editors.delete(id);
  };

  const editorFor = (id: string | null | undefined): Editor | undefined =>
    id ? (editors.get(id) as Editor | undefined) : undefined;

  return { registerEditor, unregisterEditor, editorFor };
}
