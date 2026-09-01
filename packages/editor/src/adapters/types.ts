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

/**
 * One entry in the version-history panel. A summary for the same reason
 * TemplateSummary is: rendering a list of fifty versions shouldn't mean
 * downloading fifty full documents. getTemplateVersion(id) fetches content
 * for the one the user actually restores.
 */
export interface TemplateVersionSummary {
  versionId: string;
  createdAt: string;
  /** Optional human label ("Before redesign"). Falls back to a relative
   *  timestamp in the panel when absent. */
  label?: string;
  /** Pinned. Kept versions are excluded from deleteAllTemplateVersions and
   *  are the ones a host's retention policy should spare. The editor only
   *  reads and toggles this; what "spared" means is the host's business. */
  kept?: boolean;
  /** Free-form attribution, shown verbatim if present. Deliberately a
   *  string, not a user object — the editor has no user model and shouldn't
   *  grow one just to render a name. */
  author?: string;
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

  /**
   * ── Version history ──────────────────────────────────────────────────
   *
   * All five are optional, like listTemplates above, and gated the same
   * way: the panel is only reachable when `versions` is set on the editor,
   * and each control within it only appears when its method exists. An
   * adapter can therefore support listing and restoring without supporting
   * deletion, and the UI reflects exactly that.
   *
   * Note the asymmetry with saveTemplate: nothing here creates a version.
   * When a save produces a new version is a policy question — every save,
   * on a timer, on explicit request — and the host already owns saveTemplate,
   * so it can decide there. Putting version creation in this interface would
   * force one policy on every host.
   */
  listTemplateVersions(templateId: string): Promise<TemplateVersionSummary[]>;

  /** Full content for one version, in the same shape as loadTemplate. */
  getTemplateVersion(
    templateId: string,
    versionId: string,
  ): Promise<TemplateSnapshot | null>;

  deleteTemplateVersion(templateId: string, versionId: string): Promise<void>;

  /** Bulk delete. Kept versions survive — see TemplateVersionSummary.kept.
   *  The panel's confirm copy says so, so an implementation that deletes
   *  kept versions too would contradict what the user was told. */
  deleteAllTemplateVersions(templateId: string): Promise<void>;

  setTemplateVersionKept(
    templateId: string,
    versionId: string,
    kept: boolean,
  ): Promise<void>;

  listSavedRows(): Promise<SavedRow[]>;

  /**
   * A second, read-only row library shown in its own tab beside the user's
   * own rows — an organisation's shared blocks, a starter set, whatever the
   * host curates.
   *
   * Optional, and the tab only appears when it is implemented, so a host with
   * one row library sees exactly the panel it has today. The built-in
   * localStorage adapter deliberately does NOT implement it: "shared across
   * an organisation" has no meaning in a single browser's storage, and
   * faking it would demonstrate a feature that cannot work.
   *
   * Read-only by construction. There is no saveSystemSavedRow /
   * deleteSystemSavedRow / renameSystemSavedRow, so the panel renders this
   * tab without rename or delete controls. Who may curate a shared library is
   * a permissions question the host answers in its own admin UI — the editor
   * has no user model to answer it with, and inventing one to grey out a
   * button would be the wrong boundary.
   *
   * cloneSavedRowForCanvas must resolve ids from BOTH libraries. It is the
   * single synchronous entry point used when a row is dragged onto the
   * canvas, and the drag doesn't know which tab the row came from.
   */
  listSystemSavedRows(): Promise<SavedRow[]>;
  saveSavedRow(
    row: Record<string, any>,
    name: string,
  ): Promise<SavedRow | null>;
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
