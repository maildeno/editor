/**
 * useLayoutDrag
 * Shared state for sidebar → canvas layout drag-and-drop.
 *
 * same provide/inject conversion as useEmailBuilder — called from
 * 5 different files (CanvasRowDropZone, LayoutTab, Canvas, CanvasColumn,
 * SavedRowsPanel), all needing the same isLayoutDragActive/layoutDragPayload
 * so a drag started from one component is observed by all the others.
 */
import { ref, provide, inject, type InjectionKey } from "vue";

export type LayoutDragPayload =
  | { type: "row"; columns: number | number[] }
  | { type: "spacer" }
  | { type: "product-row"; entryId: string }
  /** Drop a nested row inside an existing column (child insertion) */
  | {
      type: "nested-row";
      columns: number | number[];
      targetColumnId: string;
      targetIndex: number;
    };

type LayoutDragInstance = ReturnType<typeof createLayoutDragInstance>;
const LayoutDragKey: InjectionKey<LayoutDragInstance> = Symbol(
  "maildeno-editor:layout-drag",
);

/** Called once, at the EmailEditor root. */
export function provideLayoutDrag() {
  const instance = createLayoutDragInstance();
  provide(LayoutDragKey, instance);
  return instance;
}

/** Every other file calls this exactly as before. */
export const useLayoutDrag = (): LayoutDragInstance => {
  const instance = inject(LayoutDragKey);
  if (!instance) {
    throw new Error(
      "[maildeno-editor] useLayoutDrag() was called outside an EmailEditor instance.",
    );
  }
  return instance;
};

function createLayoutDragInstance() {
  const isLayoutDragActive = ref<boolean>(false);
  const layoutDragPayload = ref<LayoutDragPayload | null>(null);

  const startLayoutDrag = (e: DragEvent, payload: LayoutDragPayload) => {
    isLayoutDragActive.value = true;
    layoutDragPayload.value = payload;

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("layoutDragType", payload.type);

      if (payload.type === "row" || payload.type === "nested-row") {
        e.dataTransfer.setData(
          "layoutDragColumns",
          JSON.stringify(payload.columns),
        );
      }
      if (payload.type === "product-row") {
        e.dataTransfer.setData("layoutDragEntryId", payload.entryId);
      }
      if (payload.type === "nested-row") {
        e.dataTransfer.setData(
          "layoutDragTargetColumnId",
          payload.targetColumnId,
        );
        e.dataTransfer.setData(
          "layoutDragTargetIndex",
          String(payload.targetIndex),
        );
      }
    }
  };

  const endLayoutDrag = () => {
    isLayoutDragActive.value = false;
    layoutDragPayload.value = null;
  };

  return {
    isLayoutDragActive,
    layoutDragPayload,
    startLayoutDrag,
    endLayoutDrag,
  };
}
