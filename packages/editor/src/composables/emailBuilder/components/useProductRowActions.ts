/**
 * composables/emailBuilder/components/useProductRowActions.ts
 *
 * Orchestration composable: wraps the row-saving composable with toast
 * feedback so CanvasRow.vue and other callers stay toast-free.
 *
 * the original also branched on auth.isSystemManager to save
 * into a Maildeno-owned "system template library" via a separate
 * useSystemSavedRows composable. That composable was never part of the
 * uploaded source (it's one of the files referenced but missing from the
 * start), and the system-template concept is Maildeno product content, not
 * editor functionality, so that branch is removed rather than stubbed.
 */
import { isHandled } from "@/adapters/errors";
import { useToast } from "@/composables/ui/useToast";
import { useProductRows } from "@/composables/emailBuilder/components/useProductRows";

export function useProductRowActions() {
  const toast = useToast();
  const { saveProductRow } = useProductRows();

  /**
   * Save a row, handling all toast notifications.
   * Returns true on success so the caller can close its UI.
   */
  async function saveProductRowWithToast(
    row: Record<string, any>,
    name: string,
  ): Promise<boolean> {
    try {
      const entry = await saveProductRow(row, name);

      // local.ts returns null when the localStorage cap is hit
      if (!entry || !entry.id) {
        toast.add({
          severity: "warn",
          summary: "Save failed",
          detail: "Limit reached. Delete some items to save more.",
          life: 3000,
        });
        return false;
      }

      toast.add({
        severity: "success",
        summary: "Row saved",
        life: 3000,
      });
      return true;
    } catch (err) {
      console.error("[maildeno-editor] failed to save row:", err);
      // A host adapter that already reported this (a read-only role, a plan
      // cap) has said something specific; "Please try again" on top of it is
      // both redundant and wrong — trying again will fail the same way.
      if (!isHandled(err)) {
        toast.add({
          severity: "error",
          summary: "Failed to save row",
          detail: "Please try again",
          life: 5000,
        });
      }
      return false;
    }
  }

  return { saveProductRowWithToast };
}
