// composables/emailBuilder/history/useEmailBuilderHistory.ts
// Email-builder-specific undo/redo layer wrapping the generic useHistory stack.
//
// ── Selection is NOT part of the history snapshot ────────────────────────────
// Previous versions stored selectedId, selectedRowId, and selectedColumn in
// every snapshot. That was conceptually wrong (undoing a text edit should not
// move the cursor to a different component) and it bloated every clone.
//
// Current behaviour:
//   • Snapshots contain only document state: { rows, canvasStyles }.
//   • After undo/redo, we RECONCILE the live selection refs:
//       - If the currently selected node (component/row/column) still exists
//         in the restored tree, selection is preserved.
//       - If it was deleted by the undo/redo, selection is cleared to null.
//   • This matches how Figma, Notion, and VS Code handle undo — your cursor
//     stays where it is unless the thing you were pointing at is gone.
//
// Reconciliation walks the restored tree once to build a Set of live IDs
// (O(N), same complexity as the clone that just ran). Could also reuse the
// operations-module registry, but doing it locally keeps history self-
// contained and avoids a cross-module dependency.

import type { Ref } from "vue";
import { useHistory } from "./useHistory";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The document state captured in a history snapshot.
 *
 * Notably absent: selectedId, selectedRowId, selectedColumn. See the header
 * comment above for why.
 */
export interface EmailBuilderState {
  rows: any[];
  canvasStyles: Record<string, any>;
}

// ─── Composable ───────────────────────────────────────────────────────────────

export const useEmailBuilderHistory = () => {
  const {
    saveState,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
    historyStatus,
    initHistory,
    version,
  } = useHistory<EmailBuilderState>();

  // ── State helpers ─────────────────────────────────────────────────────────────

  /**
   * Builds a snapshot from the live reactive refs.
   *
   * Selection refs are NOT parameters — they are reconciled separately in
   * restoreState. If a future feature ever needs selection in history,
   * extend EmailBuilderState rather than re-adding ignored args here.
   */
  const getCurrentState = (
    rows: Ref<any[]>,
    canvasStyles: Ref<Record<string, any>>,
  ): EmailBuilderState => ({
    rows: rows.value,
    canvasStyles: canvasStyles.value,
  });

  /**
   * Restores document state AND reconciles selection against the new tree.
   *
   * Selection reconciliation:
   *   • selectedId        → cleared if that component no longer exists
   *   • selectedRowId     → cleared if that row/spacer no longer exists
   *   • selectedColumn    → cleared if its row OR its column no longer exists
   */
  const restoreState = (
    state: EmailBuilderState | null,
    rows: Ref<any[]>,
    canvasStyles: Ref<Record<string, any>>,
    selectedId: Ref<string | null>,
    selectedRowId: Ref<string | null>,
    selectedColumn: Ref<{ rowId: string; columnId: string } | null>,
  ): void => {
    if (!state) return;
    rows.value = state.rows;
    canvasStyles.value = state.canvasStyles;

    // ── Collect live IDs from the restored tree ──────────────────────────────
    const liveIds = new Set<string>();
    const walk = (items: any[]): void => {
      for (const item of items) {
        if (!item?.id) continue;
        liveIds.add(String(item.id));
        if (item.type === "row" && Array.isArray(item.columns)) {
          for (const col of item.columns) {
            if (col?.id) liveIds.add(String(col.id));
            walk(col.children ?? col.components ?? []);
          }
        }
      }
    };
    walk(state.rows);

    // ── Reconcile each selection ref ─────────────────────────────────────────
    if (selectedId.value && !liveIds.has(String(selectedId.value))) {
      selectedId.value = null;
    }
    if (selectedRowId.value && !liveIds.has(String(selectedRowId.value))) {
      selectedRowId.value = null;
    }
    if (selectedColumn.value) {
      const { rowId, columnId } = selectedColumn.value;
      if (!liveIds.has(String(rowId)) || !liveIds.has(String(columnId))) {
        selectedColumn.value = null;
      }
    }
  };

  // ── saveToHistory ─────────────────────────────────────────────────────────────
  // immediate=false (default) → 600 ms debounce (style/text changes)
  // immediate=true            → synchronous commit (structural ops)

  const saveToHistory = (
    getCurrentStateFn: () => EmailBuilderState,
    action: string = "change",
    immediate = false,
  ): void => {
    saveState(getCurrentStateFn(), action, immediate);
  };

  // ── undo ──────────────────────────────────────────────────────────────────────
  // Returns the restored state so the caller can gate debouncedSave correctly.

  const undo = (
    restoreStateFn: (state: EmailBuilderState | null) => void,
  ): EmailBuilderState | null => {
    const previousState = historyUndo();
    if (previousState) {
      restoreStateFn(previousState);
      return previousState;
    }
    return null;
  };

  // ── redo ──────────────────────────────────────────────────────────────────────

  const redo = (
    restoreStateFn: (state: EmailBuilderState | null) => void,
  ): EmailBuilderState | null => {
    const nextState = historyRedo();
    if (nextState) {
      restoreStateFn(nextState);
      return nextState;
    }
    return null;
  };

  // ── initialize ────────────────────────────────────────────────────────────────
  // Always seeds history regardless of row count — prevents undoing past the
  // initial state into an empty canvas on DB-loaded templates.

  const initialize = (currentState: EmailBuilderState): void => {
    initHistory(currentState);
  };

  return {
    getCurrentState,
    restoreState,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    historyStatus,
    initialize,
    version,
  };
};
