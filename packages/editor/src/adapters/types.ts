/**
 * The storage adapter interface. This is the actual product boundary — see
 * the project README's "Positioning" section: the editor is MIT-licensed
 * and fully functional against createLocalStorageAdapter() below, with zero
 * backend. A hosted adapter (implementing the same interface against a real
 * API) is a separate package, not part of this one.
 *
 * Deliberately does NOT cover useEmailBuilderPersistence's autosave draft —
 * that's a single-slot, 30-day-TTL crash-recovery buffer that's always
 * localStorage regardless of which adapter is active (explicitly designed
 * to be cleared once a "real" save happens through this interface, not a
 * replacement for it). Confirmed still wired and working via Header.vue's
 * initFromStorage() call — untouched by this batch.
 */

export interface TemplateSnapshot {
  rows: Record<string, any>[];
  canvasStyles: Record<string, any>;
  name?: string;
  tags?: string[];
  updatedAt?: string;
}

/** One entry in the saved-templates list. Deliberately a summary, not a full
 *  TemplateSnapshot — listing shouldn't require loading every template's rows,
 *  which for a cloud adapter would mean fetching entire documents just to
 *  render a list. Selecting one calls loadTemplate(id) for the real content. */
export interface TemplateSummary {
  templateId: string;
  name?: string;
  updatedAt?: string;
}

export interface SavedRow {
  id: string;
  name: string;
  createdAt: string;
  row: Record<string, any>;
}

export interface EditorStorageAdapter {
  loadTemplate(templateId?: string): Promise<TemplateSnapshot | null>;
  saveTemplate(
    snapshot: TemplateSnapshot,
    templateId?: string,
  ): Promise<{ templateId: string }>;

  /**
   * Lists saved templates for the saved-templates panel.
   *
   * Optional on purpose: adding it as a required method would break every
   * adapter already written against this interface. When absent, the panel
   * says so rather than appearing broken — the same capability-gating used
   * for onSendTestEmail, where a feature that can't be backed simply isn't
   * offered.
   */
  listTemplates(): Promise<TemplateSummary[]>;

  /** Optional, and only surfaced in the panel when implemented. */
  deleteTemplate(templateId: string): Promise<void>;

  listSavedRows(): Promise<SavedRow[]>;
  saveSavedRow(row: Record<string, any>, name: string): Promise<SavedRow | null>;
  deleteSavedRow(id: string): Promise<void>;
  renameSavedRow(id: string, name: string): Promise<void>;
  cloneSavedRowForCanvas(id: string): Record<string, any> | null;

  uploadImage(file: File): Promise<string>;
}

/**
 * What a host actually passes as `storageAdapter`.
 *
 * Every method is optional. Anything you leave out falls back to the
 * built-in localStorage adapter, so you can override only the parts you
 * care about:
 *
 * ```ts
 * // Upload images to your own storage; keep everything else local.
 * init({ storageAdapter: { uploadImage: (file) => uploadToS3(file) } });
 * ```
 *
 * Internally the editor always works with a complete `EditorStorageAdapter`
 * — `provideStorageAdapter` merges your partial over the defaults — so no
 * call site has to guard against a missing method.
 *
 * One thing worth knowing: the fallback is per-method, not per-area. If you
 * implement `saveTemplate` against your own backend but leave
 * `listTemplates` out, the saved-templates panel will list whatever is in
 * localStorage rather than your backend. The editor warns about that
 * specific mismatch in development.
 */
export type PartialStorageAdapter = Partial<EditorStorageAdapter>;
