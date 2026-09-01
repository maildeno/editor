/**
 * The canvas API handed to a host-supplied assistant panel.
 *
 * Defined once here rather than inline in each place it appears, because it
 * shows up in three: the #assistant slot's prop, assistant.mount()'s second
 * argument, and EditorHandle. Three structural copies would drift the first
 * time a method is added, and the drift would be silent — a slot typed with
 * five methods and a callback typed with four both compile fine.
 *
 * A read/write subset of what EmailEditor exposes, not the whole surface.
 * An assistant needs to see the canvas, change it, and know when it moved.
 * It has no business calling destroy() or re-theming the editor, so those
 * are absent rather than present-and-discouraged.
 */
export interface EditorWriteApi {
  /** Current template as a plain object, or null when the canvas is empty. */
  getJson(): Record<string, unknown> | null;

  /**
   * Replaces the canvas. Accepts what getJson() returns.
   *
   * Defaults to an undoable step, which is almost always what an assistant
   * wants: a user who dislikes a generated design presses Ctrl+Z and has
   * their own work back. Passing "reset" throws that away, so it is for
   * document swaps rather than edits.
   */
  setJson(data: unknown, opts?: { history?: "undoable" | "reset" }): void;

  /** The selected block, or null. `type` is the block type ("paragraph",
   *  "image"), which is what a "rewrite this heading" flow branches on. */
  getSelection(): { id: string; type: string | null } | null;

  /** Selects by id, or clears with null. False if no block has that id. */
  setSelection(id: string | null): boolean;

  /** Runs after each committed change. Returns an unsubscribe function —
   *  call it when the panel tears down, or the callback outlives the panel
   *  and fires against a dead component. */
  onChange(cb: () => void): () => void;
}

/**
 * How an init()/custom-element host fills the assistant drawer.
 *
 * Imperative rather than a component, because that path has no framework in
 * common with the editor — a React host renders with createRoot into the
 * element, a vanilla host sets innerHTML, and neither should need to know
 * Vue exists.
 */
export interface AssistantMount {
  /** Called on first open, with the drawer's body element. */
  mount: (el: HTMLElement, editor: EditorWriteApi) => void;
  /** Called on close and on editor teardown. Tear down listeners and any
   *  framework root here; the editor only empties the element after this. */
  unmount?: (el: HTMLElement) => void;
}
