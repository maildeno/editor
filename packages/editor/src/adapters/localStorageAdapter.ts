import { generateId } from "@/utils/generateId";
import type {
  EditorStorageAdapter,
  TemplateSnapshot,
  TemplateSummary,
  SavedRow,
} from "./types";

const ROWS_KEY = "maildeno:product-rows";
const TEMPLATE_KEY_PREFIX = "maildeno:template:";

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
    return out.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }

  async function deleteTemplate(templateId: string): Promise<void> {
    localStorage.removeItem(TEMPLATE_KEY_PREFIX + templateId);
  }

  async function listSavedRows(): Promise<SavedRow[]> {
    return readJSON<SavedRow[]>(ROWS_KEY) ?? [];
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
      rows.map((r) => (r.id === id ? { ...r, name: name.trim() || r.name } : r)),
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
    listSavedRows,
    saveSavedRow,
    deleteSavedRow,
    renameSavedRow,
    cloneSavedRowForCanvas,
    uploadImage,
  };
}
