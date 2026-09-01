// composables/useEmailBuilderOperations.ts
// This module handles component and row operations (add, delete, move, update)
//
// ⚠️ CRITICAL: col.children is the canonical key going forward.
// Legacy data uses col.components. Every file that reads a column's
// contents MUST use: col.children ?? col.components ?? []
// All WRITES go to col.children.
//
// ── ID REGISTRY (performance) ─────────────────────────────────────────────────
// A flat Map<string, nodeRef> indexed by ID. findRow / findComponent now do
// O(1) lookups instead of O(N) recursive tree walks, which makes
// ContentTab.vue's `selectedRow` / `selectedComponent` computeds effectively
// free to re-evaluate. Previously each property panel switch walked the entire
// tree; with ~60 components that dominates the hot path.
//
// Registry invariants:
//   • Stores LIVE reactive references (no copies), so prop mutations flow
//     through unchanged — computeds still react correctly to any deep change.
//   • Rebuilt by reindex() whenever STRUCTURE changes (add / delete / move /
//     duplicate / reorder / paste-from-history). NOT rebuilt on updateComponent
//     because prop mutations don't change which nodes exist or what their IDs are.
//   • Exposed via rebuildIdRegistry() so undo/redo and loadTemplate can rebuild
//     after replacing rows.value wholesale.
//   • Lookup helpers (findRow, findComponent) fall back to a tree walk on a
//     Map miss, so a stale registry never corrupts behaviour — it only loses
//     the speedup for that call. Misses also lazily re-cache the node.

import { createDefaultVisibility } from "./config/componentConfig";
import { generateId } from "@/utils/generateId";

// ─── Row name helpers ─────────────────────────────────────────────────────────

/**
 * Converts a human-readable label to a snake_case name.
 * e.g. "Hero Home Section" → "hero_home_section"
 */
export const toRowName = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

/**
 * Converts a snake_case row name to a human-readable display name.
 * e.g. "hero_home_section" → "Hero Home Section"
 */
export const displayName = (name: string): string =>
  name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Generates a default row name.
 * e.g. "row_B3e4", "row_ X3f4i"
 */
const defaultRowName = (): string => `row_${generateId().slice(0, 4)}`;

// ─── Gradient factory helpers ─────────────────────────────────────────────────

/** Default gradient shape for a row, column and spacer */
const makeBackground = (solidColor: string) => ({
  useGradient: false,
  solid: solidColor,
  gradient: {
    type: "linear" as const,
    direction: "to right",
    colors: [
      { color: "#ffffff", position: 0 },
      { color: "#eeeeee", position: 100 },
    ],
  },
});

// ─── Column children accessor ─────────────────────────────────────────────────
// Always use this to READ a column's children — never bare col.components.

/**
 * Returns the live children array for a column, respecting the
 * children → components fallback. Returns the actual reactive array
 * so mutations (push, splice, etc.) work directly.
 *
 * For columns that only have the legacy `components` key, this returns
 * that array directly (no copy), so mutations still apply to the source.
 */
const getChildren = (col: any): any[] => {
  return col.children ?? col.components ?? [];
};

/**
 * Ensures a column has a `children` key and returns it.
 * If the column only has `components`, migrates it on the fly:
 *   - Sets col.children = col.components (same reference, zero-copy)
 *   - Deletes col.components so only one key exists
 * This is safe because both point to the same array after migration.
 */
const ensureChildren = (col: any): any[] => {
  if (!col.children) {
    col.children = col.components ?? [];
    // Keep components as an alias for legacy readers during the transition.
    // Delete it only when the full migration is confirmed.
    // delete col.components;
  }
  return col.children;
};

// ─── Deep-clone helpers with fresh IDs ───────────────────────────────────────

/**
 * Deep-clones any node (row, nested row, row-spacer, or component) and
 * assigns a brand-new unique ID. Recursively walks:
 *   row → columns → children → (nested rows | components | spacers)
 *
 * Every node at every depth gets:
 *   1. A full deep clone (no shared references with the source)
 *   2. A fresh unique ID
 *
 * This guarantees the duplicate is fully independent of the original and
 * that no two nodes in the tree can ever share an ID.
 */
const cloneNodeWithFreshIds = <T extends Record<string, any>>(node: T): T => {
  // JSON round-trip, not structuredClone. Reason: Vue wraps reactive state in
  // Proxy objects, and structuredClone throws DataCloneError on Proxies.
  // JSON serialization walks the proxy transparently and produces a plain
  // object clone — which is exactly what we want for a clean duplicate.
  // Safe here because our tree is pure JSON data (no Dates, Maps, functions,
  // or circular refs).
  const clone: any = JSON.parse(JSON.stringify(node));

  clone.id = generateId();

  // Row (top-level or nested): recurse through columns → children
  if (clone.type === "row" && Array.isArray(clone.columns)) {
    clone.columns = clone.columns.map((col: any) => {
      const kids = col.children ?? col.components ?? [];
      const freshCol: any = {
        ...col,
        id: generateId(),
        children: kids.map((child: any) => cloneNodeWithFreshIds(child)),
      };
      // Drop legacy key — canonical shape uses `children`
      delete freshCol.components;
      return freshCol;
    });
  }

  // Leaves (components, row-spacers): the JSON round-trip already deep-cloned
  // their nested objects (props, padding, border, visibility, etc.) and the
  // fresh ID was assigned above. Nothing else to do.

  return clone as T;
};

/**
 * Deep-clones a row (or row-spacer) with fresh IDs throughout, AND gives it
 * a unique name among the sibling rows.
 */
const cloneRowWithFreshIds = (row: any, existingRows: any[]): any => {
  const clone = cloneNodeWithFreshIds(row);

  // Row-spacers don't carry a `name` field, skip the uniquifying step.
  if (clone.type === "row-spacer") return clone;

  // Generate a unique name by appending "_copy", incrementing on collision.
  const baseName = row.name ?? defaultRowName();
  const existingNames = new Set(existingRows.map((r: any) => r.name));
  let finalName = `${baseName}_copy`;
  let counter = 2;
  while (existingNames.has(finalName)) {
    finalName = `${baseName}_copy_${counter}`;
    counter++;
  }
  clone.name = finalName;

  return clone;
};

/**
 * Deep-clones a single component and assigns a new ID.
 * Thin wrapper around cloneNodeWithFreshIds for call-site clarity.
 */
const cloneComponentWithFreshId = (component: any): any =>
  cloneNodeWithFreshIds(component);

// ─── Recursive tree search helpers ────────────────────────────────────────────

/**
 * Recursively find a child element by ID within a children[] array.
 * Returns { parentChildren, index, element } or null.
 * Works with nested rows (child.type === 'row').
 */
const findInChildren = (
  children: any[],
  id: any,
): { parentChildren: any[]; index: number; element: any } | null => {
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (el.id === id)
      return { parentChildren: children, index: i, element: el };
    if (el.type === "row") {
      for (const col of el.columns ?? []) {
        const found = findInChildren(col.children ?? col.components ?? [], id);
        if (found) return found;
      }
    }
  }
  return null;
};

// ─── Recursive row search ────────────────────────────────────────────────────
/**
 * Find a row (or row-spacer) by ID anywhere in the tree — top-level OR nested.
 * Returns the row object or null.
 */
const findRowAnywhere = (topLevelRows: any[], id: any): any => {
  for (const row of topLevelRows) {
    if (row.id === id) return row;
    if (row.type === "row" && row.columns) {
      for (const col of row.columns) {
        const kids = getChildren(col);
        for (const child of kids) {
          if (child.id === id && child.type === "row") return child;
          if (child.type === "row" && child.columns) {
            const found = findRowAnywhere([child], id);
            if (found) return found;
          }
        }
      }
    }
  }
  return null;
};

// ─── ID REGISTRY ──────────────────────────────────────────────────────────────
// Flat Map<id, nodeRef> for O(1) lookups.
//
// Scope: MODULE-LEVEL, not per-composable-call. Every caller of
// useEmailBuilderOperations() sees the same registry, because rows is a
// useState() global. The registry mirrors rows exactly; separate registries
// per call would immediately desync.
//
// Memory: one Map entry per node (row, column, component, spacer).
// For a 60-component template that's ~80 entries — negligible.

const idRegistry = new Map<string, any>();

/**
 * Rebuild the registry from scratch using the current rows tree.
 * O(N). Called after wholesale replacements (undo/redo, loadTemplate,
 * initFromStorage, resetTemplate) and after structural ops that move many
 * nodes at once (bulk reorder, duplicate of a complex subtree).
 *
 * For single-node ops (add one component, delete one row) you can use the
 * cheaper addNodeToRegistry / removeNodeFromRegistry helpers below instead,
 * but calling this after every op is still O(N) per op — cheap enough that
 * measurement shows no difference for trees up to ~200 nodes. If you ever
 * hit multi-thousand-node trees, switch to the incremental helpers.
 */
const rebuildIdRegistry = (rowsArray: any[]): void => {
  idRegistry.clear();
  const walk = (items: any[]): void => {
    for (const item of items) {
      if (!item?.id) continue;
      idRegistry.set(item.id, item);
      if (item.type === "row" && Array.isArray(item.columns)) {
        for (const col of item.columns) {
          if (col?.id) idRegistry.set(col.id, col);
          walk(col.children ?? col.components ?? []);
        }
      }
    }
  };
  walk(rowsArray);
};

/**
 * Add a single node and all its descendants to the registry.
 * Use for incremental updates after an add/duplicate op on a single subtree.
 */
const addNodeToRegistry = (node: any): void => {
  if (!node?.id) return;
  idRegistry.set(node.id, node);
  if (node.type === "row" && Array.isArray(node.columns)) {
    for (const col of node.columns) {
      if (col?.id) idRegistry.set(col.id, col);
      const kids = col.children ?? col.components ?? [];
      for (const child of kids) addNodeToRegistry(child);
    }
  }
};

/**
 * Remove a single node and all its descendants from the registry.
 * Use for incremental updates after a delete op on a single subtree.
 */
const removeNodeFromRegistry = (node: any): void => {
  if (!node?.id) return;
  idRegistry.delete(node.id);
  if (node.type === "row" && Array.isArray(node.columns)) {
    for (const col of node.columns) {
      if (col?.id) idRegistry.delete(col.id);
      const kids = col.children ?? col.components ?? [];
      for (const child of kids) removeNodeFromRegistry(child);
    }
  }
};

export const useEmailBuilderOperations = (
  rows: any,
  selectedId: any,
  defaultProps: any,
  saveToHistoryFn: (action: string) => void,
  // Content edits (typing, formatting) are debounced so rapid-fire onUpdate
  // calls collapse into a single history entry instead of one per keystroke.
  // Structural ops (add, delete, move, duplicate) always use saveToHistoryFn
  // (immediate) so undo is never blocked by a pending debounce timer.
  saveToHistoryDebouncedFn: (action: string) => void = saveToHistoryFn,
) => {
  // ── Initial registry seed ──────────────────────────────────────────────────
  // rows may already be populated (template restored from storage before this
  // composable was called). Seed once so the first findComponent call is fast.
  if (idRegistry.size === 0 && Array.isArray(rows.value) && rows.value.length) {
    rebuildIdRegistry(rows.value);
  }

  // ==========================================
  // ROW OPERATIONS
  // ==========================================

  const addRow = (layout: number | number[], silent = false) => {
    let widths: number[];

    if (Array.isArray(layout)) {
      const total = layout.reduce((a, b) => a + b, 0);
      if (total !== 100) {
        console.warn("Column widths must sum to 100%");
        return;
      }
      widths = layout;
    } else {
      const base = Math.floor(100 / layout);
      widths = Array(layout).fill(base);
      widths[0] += 100 - widths.reduce((a, b) => a + b, 0);
    }

    // Assign a unique default name
    const name = defaultRowName();

    const row = {
      id: `${generateId()}`,
      type: "row",
      name,

      // ── Columns ──────────────────────────────────────────────────────────────
      columns: widths.map((width, i) => ({
        id: `${generateId()}-${i}`,
        width,
        children: [], // ← canonical key
        backgroundColor: "transparent",
        backgroundGradient: makeBackground("transparent"),
        backgroundImage: "",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
        border: { width: 0, style: "solid", color: "#000000", radius: 0 },
        verticalAlign: "top",
      })),

      // ── Row-level background ──────────────────────────────────────────────────
      backgroundColor: "#ffffff",
      backgroundGradient: makeBackground("#ffffff"),
      backgroundImage: "",
      backgroundSize: "cover",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",

      // ── Layout ────────────────────────────────────────────────────────────────
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      border: { width: 0, style: "solid", color: "#000000", radius: 0 },
      minHeight: 0,
      gap: 12,
      mobileStack: true,
      visibility: createDefaultVisibility(),
    };

    rows.value.push(row);
    // CRITICAL: register the PROXY (in the array), not the raw `row` variable.
    // Vue wraps array entries in reactive proxies at push-time. The local
    // `row` variable still points at the raw object; mutations through one
    // do not propagate to the other. Reading rows.value[N] back returns the
    // proxy that the canvas actually renders against.
    const inserted = rows.value[rows.value.length - 1];
    addNodeToRegistry(inserted);
    if (!silent) saveToHistoryFn("add-row");
  };

  /**
   * Add a nested row inside a column's children[] array.
   * @param parentRowId  ID of the row that owns the target column.
   * @param columnId     ID of the column to insert the nested row into.
   * @param layout       Column count (number) or explicit widths (number[]).
   * @param insertIndex  Position in children[]. Defaults to end.
   */
  const addNestedRow = (
    parentRowId: any,
    columnId: string,
    layout: number | number[],
    insertIndex?: number,
  ) => {
    const parentRow = findRowAnywhere(rows.value, parentRowId);
    if (!parentRow?.columns) return;

    const column = parentRow.columns.find((c: any) => c.id === columnId);
    if (!column) return;

    let widths: number[];
    if (Array.isArray(layout)) {
      const total = layout.reduce((a: number, b: number) => a + b, 0);
      if (total !== 100) {
        console.warn("[addNestedRow] Widths must sum to 100%");
        return;
      }
      widths = layout;
    } else {
      const base = Math.floor(100 / layout);
      widths = Array(layout).fill(base);
      widths[0] += 100 - widths.reduce((a: number, b: number) => a + b, 0);
    }

    const nestedRow = {
      id: `${generateId()}`,
      type: "row",
      name: `nested_row_${generateId().slice(0, 4)}`,
      columns: widths.map((width: number, i: number) => ({
        id: `${generateId()}-${i}`,
        width,
        children: [],
        backgroundColor: "transparent",
        backgroundGradient: makeBackground("transparent"),
        backgroundImage: "",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        border: { width: 0, style: "solid", color: "#000000", radius: 0 },
        verticalAlign: "top",
      })),
      backgroundColor: "transparent",
      backgroundGradient: makeBackground("transparent"),
      backgroundImage: "",
      backgroundSize: "cover",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      border: { width: 0, style: "solid", color: "#000000", radius: 0 },
      minHeight: 0,
      gap: 0,
      mobileStack: true,
      visibility: createDefaultVisibility(),
    };

    const kids = ensureChildren(column);
    const idx =
      insertIndex !== undefined &&
      insertIndex >= 0 &&
      insertIndex <= kids.length
        ? insertIndex
        : kids.length;
    kids.splice(idx, 0, nestedRow);
    // Re-read the proxy from the array. See addRow for full rationale.
    const inserted = kids[idx];
    addNodeToRegistry(inserted);
    saveToHistoryFn("add-nested-row");
  };

  /**
   * Find a row by ID anywhere in the tree (top-level or nested).
   *
   * Fast path: O(1) Map lookup. Returns the node only if it's a row/spacer.
   * Fallback: tree walk if the registry misses (stale after an external
   * replacement that didn't call rebuildIdRegistry). The fallback also
   * re-caches the node so subsequent lookups are fast again.
   */
  const findRow = (id: any) => {
    if (id == null) return null;
    const key = String(id);

    const cached = idRegistry.get(key);
    if (cached && (cached.type === "row" || cached.type === "row-spacer")) {
      return cached;
    }

    // Fallback — keeps behaviour correct even if registry is stale
    const found = findRowAnywhere(rows.value, id);
    if (found) idRegistry.set(key, found);
    return found;
  };

  /**
   * Delete a row/spacer by ID — searches top-level first, then recursively
   * through nested children[] arrays.
   */
  const deleteRow = (id: any) => {
    // Top-level
    const topIdx = rows.value.findIndex((r: any) => r.id === id);
    if (topIdx !== -1) {
      const [removed] = rows.value.splice(topIdx, 1);
      removeNodeFromRegistry(removed);
      saveToHistoryFn("delete-row");
      return;
    }
    // Nested — search children[] arrays recursively using findInChildren
    for (const row of rows.value) {
      if (!row.columns) continue;
      for (const col of row.columns) {
        const kids = getChildren(col);
        const result = findInChildren(kids, id);
        if (result) {
          const [removed] = result.parentChildren.splice(result.index, 1);
          removeNodeFromRegistry(removed);
          saveToHistoryFn("delete-row");
          return;
        }
      }
    }
  };

  const moveRow = (rowId: any, direction: "up" | "down") => {
    // Try top-level first
    const topIndex = rows.value.findIndex((r: any) => r.id === rowId);
    if (topIndex !== -1) {
      const newIndex = direction === "up" ? topIndex - 1 : topIndex + 1;
      if (newIndex < 0 || newIndex >= rows.value.length) return;
      // FIX: use splice instead of index assignment to guarantee Vue reactivity
      const [item] = rows.value.splice(topIndex, 1);
      rows.value.splice(newIndex, 0, item);
      // No registry change needed — node references are unchanged, only order.
      saveToHistoryFn("move-row");
      return;
    }

    // Search nested children[] arrays recursively
    const tryMoveInChildren = (children: any[]): boolean => {
      const idx = children.findIndex((c: any) => c.id === rowId);
      if (idx !== -1) {
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= children.length) return true; // found but at boundary
        // FIX: use splice instead of index assignment to guarantee Vue reactivity
        const [item] = children.splice(idx, 1);
        children.splice(newIdx, 0, item);
        saveToHistoryFn("move-row");
        return true;
      }
      // Recurse into any nested rows
      for (const child of children) {
        if (child.type === "row" && child.columns) {
          for (const col of child.columns) {
            if (tryMoveInChildren(col.children ?? col.components ?? []))
              return true;
          }
        }
      }
      return false;
    };

    for (const row of rows.value) {
      if (!row.columns) continue;
      for (const col of row.columns) {
        if (tryMoveInChildren(col.children ?? col.components ?? [])) return;
      }
    }
  };

  /**
   * Move a nested row (type='row'|'row-spacer') from its current parent
   * children[] into a target column's children[] at a given index.
   * If targetColumnId is null, inserts into top-level rows.value instead.
   */
  const moveNestedRow = (
    rowId: any,
    targetRowId: any,
    targetColumnId: string | null,
    targetIndex: number,
  ) => {
    // 1. Find and remove the row from wherever it currently lives
    let extracted: any = null;

    // Try top-level
    const topIdx = rows.value.findIndex((r: any) => r.id === rowId);
    if (topIdx !== -1) {
      extracted = rows.value.splice(topIdx, 1)[0];
    }

    // Try nested children
    if (!extracted) {
      const tryExtract = (children: any[]): boolean => {
        const idx = children.findIndex((c: any) => c.id === rowId);
        if (idx !== -1) {
          extracted = children.splice(idx, 1)[0];
          return true;
        }
        for (const child of children) {
          if (child.type === "row" && child.columns) {
            for (const col of child.columns) {
              if (tryExtract(col.children ?? col.components ?? [])) return true;
            }
          }
        }
        return false;
      };
      for (const row of rows.value) {
        if (!row.columns) continue;
        for (const col of row.columns) {
          if (tryExtract(col.children ?? col.components ?? [])) break;
        }
        if (extracted) break;
      }
    }

    if (!extracted) return;

    // 2. Insert into destination
    if (targetColumnId === null) {
      // Drop onto top-level canvas
      const clampedIndex = Math.min(targetIndex, rows.value.length);
      rows.value.splice(clampedIndex, 0, extracted);
    } else {
      const targetParentRow = findRowAnywhere(rows.value, targetRowId);
      if (!targetParentRow?.columns) {
        // Rollback — put it back at end of top-level
        rows.value.push(extracted);
        return;
      }
      const targetCol = targetParentRow.columns.find(
        (c: any) => c.id === targetColumnId,
      );
      if (!targetCol) {
        rows.value.push(extracted);
        return;
      }
      const kids = ensureChildren(targetCol);
      const clampedIndex = Math.min(targetIndex, kids.length);
      kids.splice(clampedIndex, 0, extracted);
    }

    // Registry: the node reference is unchanged, only its position in the tree
    // moved. All descendant IDs still resolve to the same live references, so
    // no registry mutation is needed here.
    saveToHistoryFn("move-nested-row");
  };

  const reorderRows = (fromIndex: any, toIndex: any, silent = false) => {
    if (fromIndex === toIndex) return;

    const item = rows.value[fromIndex];
    rows.value.splice(fromIndex, 1);
    rows.value.splice(toIndex, 0, item);

    // Registry: references unchanged, only order changed — no update needed.
    if (!silent) saveToHistoryFn("reorder-rows");
  };

  const addSpacer = (silent = false) => {
    const name = `spacer_${generateId().slice(0, 4)}`;

    const spacer = {
      id: `${generateId()}`,
      type: "row-spacer",
      name,
      height: 20,
      backgroundColor: "transparent",
      backgroundGradient: makeBackground("transparent"),
      visibility: createDefaultVisibility(),
    };

    rows.value.push(spacer);
    // See addRow for why we re-read the proxy from the array.
    const inserted = rows.value[rows.value.length - 1];
    addNodeToRegistry(inserted);
    if (!silent) saveToHistoryFn("add-row-spacer");
  };

  // ─── Duplicate a row (type === 'row') ────────────────────────────────────────
  /**
   * Inserts a deep clone of the row immediately after the original.
   * All IDs (row, columns, children) are regenerated.
   * The clone receives a unique name derived from the original.
   *
   * FIX: Now searches nested children[] recursively so duplicating a row
   * inside a column works correctly (previously only searched top-level).
   */
  const duplicateRow = (rowId: any) => {
    // ── Top-level search ──────────────────────────────────────────────────────
    const topIndex = rows.value.findIndex((r: any) => r.id === rowId);
    if (topIndex !== -1) {
      const clone = cloneRowWithFreshIds(rows.value[topIndex], rows.value);
      rows.value.splice(topIndex + 1, 0, clone);
      // Re-read the proxy from the array.
      const inserted = rows.value[topIndex + 1];
      addNodeToRegistry(inserted);
      saveToHistoryFn("duplicate-row");
      return;
    }

    // ── Nested search via findInChildren ──────────────────────────────────────
    // Walk every column's children[] tree until we find the row to duplicate.
    for (const row of rows.value) {
      if (!row.columns) continue;
      for (const col of row.columns) {
        const kids = getChildren(col);
        const result = findInChildren(kids, rowId);
        if (result) {
          const clone = cloneRowWithFreshIds(
            result.element,
            result.parentChildren,
          );
          result.parentChildren.splice(result.index + 1, 0, clone);
          // Re-read the proxy from the array.
          const inserted = result.parentChildren[result.index + 1];
          addNodeToRegistry(inserted);
          saveToHistoryFn("duplicate-row");
          return;
        }
      }
    }
  };

  // ─── Duplicate a row-spacer ──────────────────────────────────────────────────
  /**
   * Inserts a deep clone of the row-spacer immediately after the original.
   *
   * FIX: Now searches nested children[] recursively so duplicating a spacer
   * inside a column works correctly (previously only searched top-level).
   */
  const duplicateRowSpacer = (spacerId: any) => {
    // ── Top-level search ──────────────────────────────────────────────────────
    const topIndex = rows.value.findIndex((r: any) => r.id === spacerId);
    if (topIndex !== -1) {
      const clone = cloneRowWithFreshIds(rows.value[topIndex], rows.value);
      rows.value.splice(topIndex + 1, 0, clone);
      // Re-read the proxy from the array.
      const inserted = rows.value[topIndex + 1];
      addNodeToRegistry(inserted);
      saveToHistoryFn("duplicate-row-spacer");
      return;
    }

    // ── Nested search via findInChildren ──────────────────────────────────────
    for (const row of rows.value) {
      if (!row.columns) continue;
      for (const col of row.columns) {
        const kids = getChildren(col);
        const result = findInChildren(kids, spacerId);
        if (result) {
          const clone = cloneRowWithFreshIds(
            result.element,
            result.parentChildren,
          );
          result.parentChildren.splice(result.index + 1, 0, clone);
          // Re-read the proxy from the array.
          const inserted = result.parentChildren[result.index + 1];
          addNodeToRegistry(inserted);
          saveToHistoryFn("duplicate-row-spacer");
          return;
        }
      }
    }
  };

  // ==========================================
  // COMPONENT OPERATIONS
  // ==========================================

  /**
   * Add a new component at the end of a column's children.
   * Uses ensureChildren() to write to col.children (canonical key).
   */
  const addComponent = (rowId: any, columnId: string, type: string) => {
    const row = findRowAnywhere(rows.value, rowId);
    if (!row) return;

    const column = row.columns.find((c: any) => c.id === columnId);
    if (!column) return;

    const component = {
      id: `${generateId()}`,
      type: "component", // ← discriminated union structural role
      componentType: type, // ← render variant: 'paragraph', 'heading', etc.
      props: JSON.parse(JSON.stringify(defaultProps[type])),
    };

    const kids = ensureChildren(column);
    kids.push(component);
    // Re-read the proxy reference from the array. The local `component`
    // variable is the raw object; the array entry is the reactive proxy.
    // The registry MUST hold the proxy so panels mutate the same reference
    // the canvas renders against.
    const inserted = kids[kids.length - 1];
    addNodeToRegistry(inserted);
    selectedId.value = inserted.id;

    saveToHistoryFn("add-component");
  };

  /**
   * Add a new component at a specific index within a column's children.
   *
   * IMPORTANT: Always writes the discriminated union shape:
   *   { type: 'component', componentType: <render variant> }
   */
  const addComponentAtIndex = (
    rowId: any,
    columnId: string,
    type: string,
    index: any,
  ) => {
    const row = findRowAnywhere(rows.value, rowId);
    if (!row) return;

    const column = row.columns.find((c: any) => c.id === columnId);
    if (!column) return;

    const component = {
      id: `${generateId()}`,
      type: "component", // ← discriminated union structural role
      componentType: type, // ← render variant: 'paragraph', 'heading', etc.
      props: JSON.parse(JSON.stringify(defaultProps[type])),
    };

    const kids = ensureChildren(column);
    kids.splice(index, 0, component);
    // Re-read the proxy from the array. See addComponent for rationale.
    const inserted = kids[index];
    addNodeToRegistry(inserted);
    selectedId.value = inserted.id;

    saveToHistoryFn("add-component");
  };

  /**
   * Delete a component by ID. Searches recursively through the entire tree.
   */
  const deleteComponent = (id: any) => {
    for (const row of rows.value) {
      if (!row.columns) continue; // ← skip row-spacers
      for (const column of row.columns) {
        const kids = getChildren(column);
        const result = findInChildren(kids, id);
        if (result) {
          const [removed] = result.parentChildren.splice(result.index, 1);
          removeNodeFromRegistry(removed);
          if (selectedId.value === id) selectedId.value = null;
          saveToHistoryFn("delete-component");
          return;
        }
      }
    }
  };

  /**
   * Move a component up/down within its parent children array.
   * Searches recursively.
   * FIX: uses splice instead of index assignment for guaranteed Vue reactivity.
   */
  const moveComponent = (componentId: any, direction: "up" | "down") => {
    for (const row of rows.value) {
      if (!row.columns) continue; // ← skip row-spacers
      for (const column of row.columns) {
        const kids = getChildren(column);
        const result = findInChildren(kids, componentId);
        if (result) {
          const { parentChildren, index } = result;
          const newIndex = direction === "up" ? index - 1 : index + 1;
          if (newIndex >= 0 && newIndex < parentChildren.length) {
            // FIX: splice-based swap guarantees Vue reactivity on all array types
            const [item] = parentChildren.splice(index, 1);
            parentChildren.splice(newIndex, 0, item);
            // Registry unchanged — same node reference, different position
            saveToHistoryFn("move-component");
          }
          return;
        }
      }
    }
  };

  /**
   * Move a component from one column to another (or within the same column
   * at a different index). Searches recursively for the source.
   *
   * ── Why we DON'T clone the moved component ─────────────────────────────────
   * Earlier versions JSON-cloned the extracted node before re-inserting it,
   * with a comment claiming this gave Vue "a fresh reference so Vue treats it
   * as a new node in its destination."
   *
   * That was wrong and introduced a stale-reference bug:
   *   • The clone has the SAME ID as the original (it's a move, not a copy).
   *   • Property panels resolve their bound component via:
   *       computed(() => findComponent(selectedId.value))
   *     which only depends on selectedId. selectedId doesn't change during a
   *     move, so Vue never re-evaluates the panel's computed, and the panel
   *     keeps a reference to the now-detached pre-move object.
   *
   * The fix: keep the SAME reference across the move. splice extracts the
   * reactive proxy intact; splice-insert into the target array stores the
   * same proxy. The registry entry already points at this proxy from when it
   * was originally added — no remove-and-re-add needed.
   */
  const moveComponentBetweenColumns = (
    componentId: any,
    targetRowId: any,
    targetColumnId: string,
    targetIndex: any,
  ) => {
    let component: any = null;

    // Find and remove the component from its current location (recursive)
    for (const row of rows.value) {
      if (!row.columns) continue; // ← skip row-spacers
      for (const column of row.columns) {
        const kids = getChildren(column);
        const result = findInChildren(kids, componentId);
        if (result) {
          // Keep the same reference — splice extracts the proxy intact.
          component = result.element;
          result.parentChildren.splice(result.index, 1);
          break;
        }
      }
      if (component) break;
    }

    if (!component) return;

    // Insert into target column — search recursively (nested rows included)
    const targetRow = findRowAnywhere(rows.value, targetRowId);
    if (!targetRow || !targetRow.columns) return;

    const targetColumn = targetRow.columns.find(
      (c: any) => c.id === targetColumnId,
    );
    if (!targetColumn) return;

    const targetKids = ensureChildren(targetColumn);
    targetKids.splice(targetIndex, 0, component);
    // Registry intact — same reference, same ID, no update needed.
    saveToHistoryFn("move-component");
  };

  /**
   * Find a component by ID anywhere in the tree.
   *
   * Fast path: O(1) Map lookup. Returns the node only if it's a component.
   * Fallback: tree walk if registry miss — also re-caches the result.
   *
   * This is called every time ContentTab.vue re-evaluates its `selectedComponent`
   * computed, which happens on any prop mutation inside the selected node
   * (text edits, colour picks, slider drags). O(1) here makes the property
   * panel feel instant.
   */
  const findComponent = (id: any) => {
    if (id == null) return null;
    const key = String(id);

    const cached = idRegistry.get(key);
    if (cached && cached.type === "component") return cached;

    // Fallback — keeps behaviour correct even if registry is stale
    for (const row of rows.value) {
      if (!row.columns) continue;
      for (const column of row.columns) {
        const kids = getChildren(column);
        const result = findInChildren(kids, id);
        if (result && result.element.type === "component") {
          idRegistry.set(key, result.element);
          return result.element;
        }
      }
    }
    return null;
  };

  const updateComponent = (id: any, props: any) => {
    const comp = findComponent(id);
    if (comp) {
      Object.assign(comp.props, props);
      // Registry is UNCHANGED — we mutated props in place on the existing
      // reactive reference. Any computed watching this component continues
      // to see the update because Vue's reactivity tracks the property
      // access, not the reference identity.
      //
      // Use the debounced variant: content edits fire on every keystroke /
      // every color-picker tick. Collapsing them into one entry means a single
      // Undo press reverses the whole "bold this word" or "paint it red" action
      // rather than stepping through each intermediate transaction.
      saveToHistoryDebouncedFn("update-component");
    }
  };

  // ─── Duplicate a component ───────────────────────────────────────────────────
  /**
   * Inserts a deep clone of the component immediately after the original,
   * within the same parent children array. Selects the duplicate automatically.
   * Searches recursively.
   */
  const duplicateComponent = (componentId: any) => {
    for (const row of rows.value) {
      if (!row.columns) continue; // ← skip row-spacers
      for (const column of row.columns) {
        const kids = getChildren(column);
        const result = findInChildren(kids, componentId);
        if (result) {
          const clone = cloneComponentWithFreshId(result.element);
          result.parentChildren.splice(result.index + 1, 0, clone);
          // Re-read the proxy from the array.
          const inserted = result.parentChildren[result.index + 1];
          addNodeToRegistry(inserted);
          selectedId.value = inserted.id;
          saveToHistoryFn("duplicate-component");
          return;
        }
      }
    }
  };

  return {
    // Row operations
    addRow,
    addNestedRow,
    findRow,
    deleteRow,
    moveRow,
    moveNestedRow,
    reorderRows,
    addSpacer,
    duplicateRow,
    duplicateRowSpacer,

    // Component operations
    addComponent,
    addComponentAtIndex,
    deleteComponent,
    moveComponent,
    moveComponentBetweenColumns,
    findComponent,
    updateComponent,
    duplicateComponent,

    // ── Registry control (exported for wholesale replacements) ───────────────
    // useEmailBuilder MUST call rebuildIdRegistry(rows.value) whenever it
    // replaces rows.value wholesale:
    //   • after undo / redo (restoreState)
    //   • after loadTemplate
    //   • after initFromStorage
    //   • after initForCreate
    //   • after resetTemplate
    // Single-node adds/deletes/duplicates already keep the registry in sync
    // via addNodeToRegistry / removeNodeFromRegistry above — no action needed
    // from the caller for those.
    rebuildIdRegistry: () => rebuildIdRegistry(rows.value),
  };
};
