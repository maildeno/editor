<template>
  <div ref="anchorRef" class="relative flex items-center justify-center">
    <button
      class="rounded-full border border-(--md-border-strong) cursor-pointer transition-all hover:scale-105 active:scale-95"
      :style="{
        width: size,
        height: size,
        background: currentColor,
        minWidth: size,
        minHeight: size,
      }"
      @mousedown.stop
      @click.stop="togglePanel"
    />

    <ColorPickerPanel
      v-if="panelOpen"
      v-model="pickedColor"
      :anchor="anchorRef"
      @close="closePanel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { TextSelection } from "@tiptap/pm/state";
import ColorPickerPanel from "../../../panels/ui/color-picker/ColorPickerPanel.vue";

const props = defineProps<{
  editor: Editor | undefined;
  type: "text" | "background";
  size?: string;
}>();

const emit = defineEmits<{
  "panel-open": [];
  "panel-close": [];
}>();

const anchorRef = ref<HTMLElement | null>(null);
const panelOpen = ref(false);

const currentColor = computed(() => {
  if (!props.editor) return "#111111";
  if (props.type === "text") {
    return props.editor.getAttributes("textStyle").color || "#111111";
  }
  return props.editor.getAttributes("textStyle").backgroundColor || "#ffffff";
});

const pickedColor = ref(currentColor.value);

// e.target (not composedPath()) is the bug here — see Header.vue's
// handleClickOutside for the full explanation; same fix, same reason.
// document.querySelector('[data-color-panel]') is a second, separate bug
// on top of that: it can't see past a shadow root at all regardless of
// where within it the panel lives, so panelEl was always null for the
// custom-element usage path. Checking composedPath() directly for the
// data-color-panel attribute sidesteps needing to locate the element via
// a global query in the first place.
const onDocPointerDown = (e: PointerEvent) => {
  const path = e.composedPath();
  if (anchorRef.value && path.includes(anchorRef.value)) return;
  if (
    path.some(
      (el) => el instanceof Element && el.hasAttribute("data-color-panel"),
    )
  )
    return;
  closePanel();
};

const closePanel = () => {
  panelOpen.value = false;
  emit("panel-close");
  document.removeEventListener("pointerdown", onDocPointerDown, true);
};

// Store the editor selection when panel opens
const savedSelection = ref<{ from: number; to: number } | null>(null);

const saveSelection = () => {
  if (!props.editor) return;
  const { from, to } = props.editor.state.selection;
  savedSelection.value = { from, to };
};

// ── Silent selection restore ───────────────────────────────────────────────────
// Uses a raw ProseMirror transaction with addToHistory:false so restoring the
// selection does NOT fire TipTap's onUpdate callback. Previously this used
// editor.chain().setTextSelection().run() which IS a history-tracked transaction
// and triggered onUpdate → updateComponent → saveToHistoryImmediate, creating a
// spurious history entry just for re-selecting text before applying the color.
const restoreSelection = () => {
  if (!props.editor || !savedSelection.value) return;
  const { from, to } = savedSelection.value;
  const { doc, tr } = props.editor.state;
  // Clamp to valid document positions to guard against content changes while
  // the color panel was open (e.g. another tab mutating the store).
  const safeFrom = Math.min(from, doc.content.size);
  const safeTo = Math.min(to, doc.content.size);
  const selection = TextSelection.create(doc, safeFrom, safeTo);
  // dispatchTransaction with addToHistory:false skips ProseMirror's history
  // plugin and does NOT call the editor's onUpdate hook — purely a cursor move.
  props.editor.view.dispatch(
    tr.setSelection(selection).setMeta("addToHistory", false),
  );
};

const togglePanel = () => {
  if (panelOpen.value) {
    closePanel();
  } else {
    saveSelection();
    pickedColor.value = currentColor.value;
    panelOpen.value = true;
    emit("panel-open");
    setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown, true);
    }, 0);
  }
};

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown, true);
  if (_colorDebounceTimer) clearTimeout(_colorDebounceTimer);
});

watch(currentColor, (val) => {
  pickedColor.value = val;
});

// ── Debounced color application ────────────────────────────────────────────────
// The color picker fires pickedColor on every pointer-move while the user drags
// the hue/saturation gradient. Without debouncing, each tick creates a separate
// history entry (restoreSelection + setColor = 2 onUpdate fires each time).
// A 150 ms debounce collapses the entire drag into one entry so a single Undo
// press returns to the color before the picker was opened, not a mid-drag value.
let _colorDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const COLOR_DEBOUNCE_MS = 150;

watch(pickedColor, (color) => {
  if (!props.editor || !color) return;

  if (_colorDebounceTimer) clearTimeout(_colorDebounceTimer);
  _colorDebounceTimer = setTimeout(() => {
    _colorDebounceTimer = null;
    if (!props.editor) return;
    restoreSelection();
    if (props.type === "text") {
      const chain = props.editor.chain().focus().setColor(color);

      // A link's underline is painted using the <a> element's OWN `color` —
      // CSS resolves text-decoration-color from whichever element set
      // text-decoration-line, not from any nested colored span inside it —
      // so setColor() alone leaves the underline behind at the link's
      // original color. Keep the link's own inline color in sync too, the
      // same safe unsetLink()->setLink() way toggleLinkUnderline does it
      // (updateAttributes on `link` nests a duplicate mark instead of
      // updating in place). Note this recolors the WHOLE link rather than
      // just the selected portion, since extendMarkRange widens the range
      // to the full link — same scope toggleLinkUnderline already uses.
      if (props.editor.isActive("link")) {
        const attrs = props.editor.getAttributes("link");
        const rest = (attrs.style ?? "")
          .replace(/color:\s*[^;]+;?\s*/i, "")
          .trim();
        const linkAttrs = {
          href: attrs.href,
          target: attrs.target,
          rel: attrs.rel,
          style: rest ? `color: ${color}; ${rest}` : `color: ${color}`,
        };
        chain.extendMarkRange("link").unsetLink().setLink(linkAttrs);
      }

      chain.run();
    } else {
      props.editor
        .chain()
        .focus()
        .setMark("textStyle", { backgroundColor: color })
        .run();
    }
  }, COLOR_DEBOUNCE_MS);
});
</script>
