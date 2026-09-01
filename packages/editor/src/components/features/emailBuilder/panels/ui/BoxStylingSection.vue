<template>
  <div>
    <div class="flex items-start justify-between mb-2">
      <p class="text-[11px] leading-relaxed text-(--md-text-subtle) pr-2">
        Applies to the highlighted text. Padding & rounded corners render best
        with a background color set.
      </p>
      <button
        v-if="hasBoxStyles"
        type="button"
        @click="resetAll"
        class="shrink-0 text-xs text-(--md-selection-fg) hover:opacity-80"
      >
        ↩ Reset
      </button>
    </div>

    <div
      class="space-y-3"
      :class="{ 'opacity-50 pointer-events-none': !editor }"
    >
      <PropertyNumberSlider
        label="Padding"
        :model-value="padding"
        :min="0"
        :max="60"
        :step="1"
        unit="px"
        @update:model-value="onPaddingChange"
      />
      <PropertyNumberSlider
        label="Corner Radius"
        :model-value="radius"
        :min="0"
        :max="40"
        :step="1"
        unit="px"
        @update:model-value="onRadiusChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { TextSelection } from "@tiptap/pm/state";
import PropertyNumberSlider from "./PropertyNumberSlider.vue";

const props = defineProps<{
  editor: Editor | undefined;
}>();

// Local working copies — source of truth while the user drags. Deliberately NOT
// two-way bound to a computed of the editor's attrs: that bridge caused a
// stutter loop (each tick re-rendered the span, fed back as a new "current
// value", interrupted the next tick). We seed one-way from the selection and
// write one-way to the editor.
const padding = ref(0);
const radius = ref(0);

// Guards the selection-driven re-seed so the selectionUpdate fired by our OWN
// apply transaction (restoreSelection + setMark) doesn't overwrite the slider
// value mid-drag.
let _suppressSync = false;

const parsePadding = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const parts = String(raw)
    .split(/\s+/)
    .map((p) => parseInt(p.replace("px", ""), 10) || 0);
  return parts.length ? Math.max(...parts) : 0;
};
const parseRadius = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  return parseInt(String(raw).replace("px", ""), 10) || 0;
};
const serialize = (n: number): string | null => (n > 0 ? `${n}px` : null);

const hasBoxStyles = computed(() => padding.value > 0 || radius.value > 0);

// ── Selection save / restore (same pattern as RichTextColorPicker) ──────────────
const savedSelection = ref<{ from: number; to: number } | null>(null);

const restoreSelection = () => {
  if (!props.editor || !savedSelection.value) return;
  const { from, to } = savedSelection.value;
  const { doc, tr } = props.editor.state;
  const safeFrom = Math.max(0, Math.min(from, doc.content.size));
  const safeTo = Math.max(0, Math.min(to, doc.content.size));
  // TextSelection.between never throws on a doc-level boundary, unlike .create.
  const selection = TextSelection.between(
    doc.resolve(safeFrom),
    doc.resolve(safeTo),
  );
  props.editor.view.dispatch(
    tr.setSelection(selection).setMeta("addToHistory", false),
  );
};

// Fired on every USER selection change: capture the range (so a later panel
// interaction can restore it after the editor blurs) and reflect the selected
// text's current box style in the sliders. Skipped while we apply our own change.
const syncFromSelection = () => {
  if (_suppressSync || !props.editor) return;
  const { from, to } = props.editor.state.selection;
  savedSelection.value = { from, to };
  const attrs = props.editor.getAttributes("textStyle");
  padding.value = parsePadding(attrs.padding);
  radius.value = parseRadius(attrs.borderRadius);
};

// ── Apply (debounced — collapses a drag into one undo step) ─────────────────────
let _timer: ReturnType<typeof setTimeout> | null = null;
const APPLY_DEBOUNCE_MS = 150;

const apply = () => {
  if (!props.editor) return;
  _suppressSync = true;
  restoreSelection();
  props.editor
    .chain()
    .focus()
    .setMark("textStyle", {
      padding: serialize(padding.value),
      borderRadius: serialize(radius.value),
    })
    .run();
  _suppressSync = false;
};

const scheduleApply = () => {
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    _timer = null;
    apply();
  }, APPLY_DEBOUNCE_MS);
};

const onPaddingChange = (val: number) => {
  padding.value = val;
  scheduleApply();
};
const onRadiusChange = (val: number) => {
  radius.value = val;
  scheduleApply();
};

const resetAll = () => {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  padding.value = 0;
  radius.value = 0;
  if (!props.editor) return;
  _suppressSync = true;
  restoreSelection();
  props.editor
    .chain()
    .focus()
    .setMark("textStyle", { padding: null, borderRadius: null })
    .run();
  _suppressSync = false;
};

// ── Wire / unwire the active editor ─────────────────────────────────────────────
// The :editor prop swaps when the user selects a different text component.
// Detach the old listener, attach to the new one, seed immediately.
let _attached: Editor | null = null;

const attach = (editor: Editor | undefined) => {
  if (_attached === editor) return;
  if (_attached) _attached.off("selectionUpdate", syncFromSelection);
  _attached = editor ?? null;
  if (_attached) {
    _attached.on("selectionUpdate", syncFromSelection);
    syncFromSelection();
  } else {
    padding.value = 0;
    radius.value = 0;
    savedSelection.value = null;
  }
};

watch(() => props.editor, attach, { immediate: true });

onBeforeUnmount(() => {
  if (_timer) clearTimeout(_timer);
  if (_attached) _attached.off("selectionUpdate", syncFromSelection);
});
</script>
