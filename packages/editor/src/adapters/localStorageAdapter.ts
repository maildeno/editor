import { generateId } from "@/utils/generateId";
import type {
  EditorStorageAdapter,
  TemplateSnapshot,
  TemplateSummary,
  TemplateVersionSummary,
  SavedRow,
} from "./types";

const ROWS_KEY = "maildeno:product-rows";
const TEMPLATE_KEY_PREFIX = "maildeno:template:";
const VERSIONS_KEY_PREFIX = "maildeno:versions:";

/** Stored per template: the summary fields plus the content, in one record.
 *  Splitting content into separate keys would be closer to how a real
 *  backend works, but it would also mean N reads to render a list — the
 *  opposite of the point — and localStorage has no query layer to make that
 *  worthwhile. */
interface StoredVersion extends TemplateVersionSummary {
  snapshot: TemplateSnapshot;
}

/** How many versions a template keeps before the oldest unkept ones are
 *  pruned. localStorage is a ~5-10MB budget shared with everything else the
 *  page stores, and full document snapshots are not small; unbounded history
 *  would fill it and start throwing QuotaExceededError on ordinary saves.
 *  A real backend would make this a retention policy rather than a constant. */
const MAX_VERSIONS_PER_TEMPLATE = 20;

/**
 * Deep-clones any node (row, nested row, row-spacer, or component) and
 * assigns a brand-new unique ID. Ported verbatim from providers/local.ts —
 * see that file's history for why JSON round-trip is used instead of
 * structuredClone (Vue's reactive Proxy wrapping throws DataCloneError).
 */
function cloneNodeWithFreshIds<T extends Record<string, any>>(node: T): T {
  const clone: any = JSON.parse(JSON.stringify(node));
  clone.id = generateId();

  if (clone.type === "row" && Array.isArray(clone.columns)) {
    clone.columns = clone.columns.map((col: any) => {
      const kids = col.children ?? col.components ?? [];
      const freshCol: any = {
        ...col,
        id: generateId(),
        children: kids.map((child: any) => cloneNodeWithFreshIds(child)),
      };
      delete freshCol.components;
      return freshCol;
    });
  }

  return clone as T;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * The default adapter — fully functional with zero backend. This is what
 * ships when no storageAdapter prop is passed to <EmailEditor>.
 */
export function createLocalStorageAdapter(): EditorStorageAdapter {
  async function loadTemplate(
    templateId?: string,
  ): Promise<TemplateSnapshot | null> {
    if (!templateId) return null;
    return readJSON<TemplateSnapshot>(TEMPLATE_KEY_PREFIX + templateId);
  }

  async function saveTemplate(
    snapshot: TemplateSnapshot,
    templateId?: string,
  ): Promise<{ templateId: string }> {
    const id = templateId || generateId();

    // Version the outgoing state before it is overwritten. Wrapped because
    // a failure to archive history must never block the save itself — losing
    // a version entry is recoverable, losing the user's edit is not.
    try {
      const previous = readJSON<TemplateSnapshot>(TEMPLATE_KEY_PREFIX + id);
      if (previous) pushVersion(id, previous);
    } catch (e) {
      console.warn("[maildeno-editor] couldn't record a template version:", e);
    }

    writeJSON(TEMPLATE_KEY_PREFIX + id, {
      ...snapshot,
      updatedAt: new Date().toISOString(),
    });
    return { templateId: id };
  }

  /**
   * Scans localStorage for template keys. Reads each one to pull out its name
   * and updatedAt — acceptable here because localStorage is synchronous and
   * local; a cloud adapter would instead query an index or a summary endpoint
   * rather than fetching every document.
   */
  async function listTemplates(): Promise<TemplateSummary[]> {
    const out: TemplateSummary[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(TEMPLATE_KEY_PREFIX)) continue;
      const snapshot = readJSON<TemplateSnapshot>(key);
      out.push({
        templateId: key.slice(TEMPLATE_KEY_PREFIX.length),
        name: snapshot?.name,
        updatedAt: snapshot?.updatedAt,
      });
    }
    // Most recently updated first; entries with no timestamp sort last.
    return out.sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
  }

  async function deleteTemplate(templateId: string): Promise<void> {
    localStorage.removeItem(TEMPLATE_KEY_PREFIX + templateId);
    // Otherwise the history outlives the template and leaks storage that
    // nothing can ever reach again — there is no UI that lists versions for
    // a template that no longer exists.
    localStorage.removeItem(VERSIONS_KEY_PREFIX + templateId);
  }

  // ── Version history ─────────────────────────────────────────────────
  //
  // Present so the MIT package demonstrates versioning with no backend —
  // `versions` on <EmailEditor> is a working feature out of the box, not a
  // hook that does nothing until someone wires a server to it.
  //
  // Nothing here creates versions on its own; saveTemplate below snapshots
  // the outgoing template before overwriting it, which is the "every save"
  // policy. A host wanting a different policy implements saveTemplate.

  function readVersions(templateId: string): StoredVersion[] {
    return readJSON<StoredVersion[]>(VERSIONS_KEY_PREFIX + templateId) ?? [];
  }

  function writeVersions(templateId: string, list: StoredVersion[]): void {
    writeJSON(VERSIONS_KEY_PREFIX + templateId, list);
  }

  async function listTemplateVersions(
    templateId: string,
  ): Promise<TemplateVersionSummary[]> {
    // Strip `snapshot` — the interface promises a summary, and a caller that
    // received full content here would come to rely on it, making
    // getTemplateVersion dead code and a cloud adapter a breaking change.
    return readVersions(templateId).map(
      ({ snapshot: _snapshot, ...summary }) => summary,
    );
  }

  async function getTemplateVersion(
    templateId: string,
    versionId: string,
  ): Promise<TemplateSnapshot | null> {
    return (
      readVersions(templateId).find((v) => v.versionId === versionId)
        ?.snapshot ?? null
    );
  }

  async function deleteTemplateVersion(
    templateId: string,
    versionId: string,
  ): Promise<void> {
    writeVersions(
      templateId,
      readVersions(templateId).filter((v) => v.versionId !== versionId),
    );
  }

  async function deleteAllTemplateVersions(templateId: string): Promise<void> {
    // Kept versions survive, matching what the panel's confirm dialog tells
    // the user. Deleting them here would make that copy a lie.
    writeVersions(
      templateId,
      readVersions(templateId).filter((v) => v.kept),
    );
  }

  async function setTemplateVersionKept(
    templateId: string,
    versionId: string,
    kept: boolean,
  ): Promise<void> {
    writeVersions(
      templateId,
      readVersions(templateId).map((v) =>
        v.versionId === versionId ? { ...v, kept } : v,
      ),
    );
  }

  /** Snapshots the CURRENT stored state before an overwrite, so a version
   *  represents "what it looked like before this save" — the thing a user
   *  reaching for history actually wants back. Snapshotting the incoming
   *  state instead would make the newest version identical to what is
   *  already on screen. */
  function pushVersion(templateId: string, previous: TemplateSnapshot): void {
    const list = readVersions(templateId);
    list.unshift({
      versionId: generateId(),
      createdAt: new Date().toISOString(),
      kept: false,
      snapshot: previous,
    });

    // Prune oldest unkept beyond the cap; kept ones never count against it.
    const unkept = list.filter((v) => !v.kept);
    if (unkept.length > MAX_VERSIONS_PER_TEMPLATE) {
      const doomed = new Set(
        unkept.slice(MAX_VERSIONS_PER_TEMPLATE).map((v) => v.versionId),
      );
      writeVersions(
        templateId,
        list.filter((v) => !doomed.has(v.versionId)),
      );
      return;
    }

    writeVersions(templateId, list);
  }

  async function listSavedRows(): Promise<SavedRow[]> {
    return readJSON<SavedRow[]>(ROWS_KEY) ?? [];
  }

  async function listSystemSavedRows(): Promise<SavedRow[]> {
    // Always empty, and deliberately so.
    //
    // A shared row library is content an organisation curates for its members.
    // localStorage is one browser: there are no other members to share with,
    // and no admin surface to curate from. Returning a fabricated starter set
    // would demonstrate a feature that cannot actually work here, and would
    // also put the package in the business of curating email content, which
    // is a product decision hosts should own.
    //
    // The method exists rather than being omitted because EditorStorageAdapter
    // is the complete contract — hosts express "I don't have this" by passing
    // a PartialStorageAdapter. The panel hides the tab when the list is empty,
    // so this costs a local user nothing.
    return [];
  }

  async function saveSavedRow(
    row: Record<string, any>,
    name: string,
  ): Promise<SavedRow | null> {
    const rows = readJSON<SavedRow[]>(ROWS_KEY) ?? [];
    // No cap here — the 5-row limit in the original local.ts was a
    // Maildeno free-tier restriction. No tier concept in the OSS editor.
    const entry: SavedRow = {
      id: generateId(),
      name: name.trim() || `Row ${rows.length + 1}`,
      createdAt: new Date().toISOString(),
      row: JSON.parse(JSON.stringify(row)),
    };
    writeJSON(ROWS_KEY, [entry, ...rows]);
    return entry;
  }

  async function deleteSavedRow(id: string): Promise<void> {
    const rows = readJSON<SavedRow[]>(ROWS_KEY) ?? [];
    writeJSON(
      ROWS_KEY,
      rows.filter((r) => r.id !== id),
    );
  }

  async function renameSavedRow(id: string, name: string): Promise<void> {
    const rows = readJSON<SavedRow[]>(ROWS_KEY) ?? [];
    writeJSON(
      ROWS_KEY,
      rows.map((r) =>
        r.id === id ? { ...r, name: name.trim() || r.name } : r,
      ),
    );
  }

  function cloneSavedRowForCanvas(id: string): Record<string, any> | null {
    const rows = readJSON<SavedRow[]>(ROWS_KEY) ?? [];
    const entry = rows.find((r) => r.id === id);
    if (!entry) return null;
    return cloneNodeWithFreshIds(entry.row);
  }

  async function uploadImage(file: File): Promise<string> {
    // No backend by default — encode as a base64 data URL. Persists fine in
    // localStorage-backed templates; large images will eat into localStorage's
    // ~5-10MB ceiling faster than a real upload would. Documented tradeoff of
    // the zero-config path, not a bug — see README "Storage adapter".
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  return {
    loadTemplate,
    saveTemplate,
    listTemplates,
    deleteTemplate,
    listTemplateVersions,
    getTemplateVersion,
    deleteTemplateVersion,
    deleteAllTemplateVersions,
    setTemplateVersionKept,
    listSavedRows,
    listSystemSavedRows,
    saveSavedRow,
    deleteSavedRow,
    renameSavedRow,
    cloneSavedRowForCanvas,
    uploadImage,
  };
}
