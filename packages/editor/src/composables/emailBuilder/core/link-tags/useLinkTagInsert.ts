/**
 * useLinkTagInsert.ts
 *
 * Shared composable for merge tag insertion into any plain-text/link input fields.
 * Used by AnchorProperties, ButtonProperties, ImageProperties, VideoProperties.
 *
 * Usage:
 *   const { lastFocusedField, trackCursor, handleTagInsert } = useLinkTagInsert(component)
 */
import { ref, nextTick } from "vue";
import type { ComputedRef } from "vue";

interface LinkComponent {
  props: Record<string, any>;
}

export const useLinkTagInsert = (
  component: ComputedRef<LinkComponent | undefined>,
  defaultField = "link",
) => {
  // Which field was last focused — drives where tag pills insert
  const lastFocusedField = ref<string>(defaultField);

  // Last known cursor positions per field (keyed by field name)
  const cursorPositions = ref<Record<string, number | null>>({});

  /**
   * Call on @click and @keyup of each input to track cursor position.
   */
  const trackCursor = (field: string, event: Event) => {
    const el = event.target as HTMLInputElement;
    lastFocusedField.value = field;
    cursorPositions.value[field] = el.selectionStart;
  };

  /**
   * Insert {{ tag }} at the last known cursor position in the target field.
   * Pass inputRefs — a map of field name → template ref — so the composable
   * can restore focus after insertion.
   *
   * Receives the same payload shape that LinkFieldMergeTags emits:
   *   { tag: string, default: string }
   */
  const handleTagInsert = (
    { tag, default: fallback }: { tag: string; default?: string },
    inputRefs?: Record<string, any>,
  ) => {
    if (!component.value) return;

    const raw = fallback?.trim()
      ? `{{ ${tag}|'${fallback.trim()}' }}`
      : `{{ ${tag} }}`;

    const field = lastFocusedField.value;
    const current = component.value.props[field] ?? "";
    const pos = cursorPositions.value[field] ?? current.length;

    component.value.props[field] =
      current.slice(0, pos) + raw + current.slice(pos);

    nextTick(() => {
      const refEl = inputRefs?.[field];
      const inputEl: HTMLInputElement | null =
        refEl?.$el instanceof HTMLInputElement
          ? refEl.$el
          : (refEl?.$el?.querySelector("input") ?? null);

      if (!inputEl) return;
      inputEl.focus();
      const newPos = pos + raw.length;
      inputEl.setSelectionRange(newPos, newPos);
      cursorPositions.value[field] = newPos;
    });
  };

  return { lastFocusedField, trackCursor, handleTagInsert };
};
