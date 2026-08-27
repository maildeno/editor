<template>
  <div ref="editorRootEl" class="relative w-full">
    <LinkInputDialog
      v-model="showLinkDialog"
      :initial-url="editor?.getAttributes('link').href"
      @submit="handleLinkSubmit"
    />

    <!-- Merge tag picker — floats at cursor when user types {{ -->
    <MergeTagPicker
      :visible="pickerVisible"
      :position="pickerPosition"
      :default-tags="PICKER_DEFAULT_TAGS"
      @commit="handlePickerCommit"
      @cancel="handlePickerCancel"
    />

    <!-- Editor — always mounted so TipTap state (selection, history) is never lost.
         The NodeView handles all merge tag rendering reactively — no overlay needed. -->
    <EditorContent
      v-if="editor"
      :editor="editor"
      class="wrap-break-word outline-none tiptap-content"
    />

    <!-- ── Floating Toolbar ──────────────────────────────────────────────────
         Hidden while previewing (no edits allowed). Visual treatment:
         • Soft glass-morphism (bg-white/95 + backdrop-blur)
         • Multi-layer shadow + ring border (Canva / Postcards-by-Designmodo)
         • Rounded-xl pill shape with tight 1.5/1 padding
         • Refined Lucide-style icons throughout
         • Instant show/hide on focus, no enter animation
    -->
    <Teleport v-if="teleportTarget" :to="teleportTarget">
      <div
        v-if="editor && isFocused && !mergeTagPreviewActive"
        ref="toolbarRef"
        class="fixed -translate-x-1/2 bg-(--md-toolbar-bg)/95 backdrop-blur-md ring-1 ring-(--md-toolbar-border) shadow-[0_8px_24px_-4px_rgba(16,24,40,0.10),0_4px_8px_-2px_rgba(16,24,40,0.06)] rounded-xl px-1.5 py-1 flex gap-0.5 justify-center items-center z-50 w-max"
        :style="{ top: toolbarPos.top + 'px', left: toolbarPos.left + 'px' }"
        @focusout="handleToolbarFocusOut"
        @mousedown.prevent
      >
        <!-- ── Bold ──────────────────────────────────────────────────── -->
        <div class="relative group/btn">
          <button
            @click="editor.chain().focus().toggleBold().run()"
            :class="buttonClass(editor.isActive('bold'))"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            </svg>
          </button>
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg) tracking-normal"
          >
            Bold (Ctrl+B)
          </div>
        </div>

        <!-- ── Italic ────────────────────────────────────────────────── -->
        <div class="relative group/btn">
          <button
            @click="editor.chain().focus().toggleItalic().run()"
            :class="buttonClass(editor.isActive('italic'))"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="19" x2="10" y1="4" y2="4" />
              <line x1="14" x2="5" y1="20" y2="20" />
              <line x1="15" x2="9" y1="4" y2="20" />
            </svg>
          </button>
          <div
            class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-b-(--md-tooltip-bg) tracking-normal"
          >
            Italic (Ctrl+I)
          </div>
        </div>

        <!-- ── Underline ─────────────────────────────────────────────── -->
        <div class="relative group/btn">
          <button
            @click="
              editor.isActive('link')
                ? toggleLinkUnderline()
                : editor.chain().focus().toggleUnderline().run()
            "
            :class="
              buttonClass(
                editor.isActive('link')
                  ? hasLinkUnderline
                  : editor.isActive('underline'),
              )
            "
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4v6a6 6 0 0 0 12 0V4" />
              <line x1="4" x2="20" y1="20" y2="20" />
            </svg>
          </button>
          <div
            class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-b-(--md-tooltip-bg) tracking-normal"
          >
            Underline (Ctrl+U)
          </div>
        </div>

        <div class="w-px h-5 bg-(--md-toolbar-border) mx-1.5" />

        <!-- ── Text Color ────────────────────────────────────────────── -->
        <div class="relative flex items-center">
          <RichTextColorPicker
            :editor="editor"
            type="text"
            size="19px"
            @panel-open="colorPickerOpen = true"
            @panel-close="colorPickerOpen = false"
          />
          <div
            class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm pointer-events-none"
            :style="{
              backgroundColor:
                editor.getAttributes('textStyle').color || '#000',
            }"
          />
        </div>

        <!-- ── Background Color ──────────────────────────────────────── -->
        <div class="relative flex items-center">
          <RichTextColorPicker
            :editor="editor"
            type="background"
            size="19px"
            @panel-open="colorPickerOpen = true"
            @panel-close="colorPickerOpen = false"
          />
          <div
            class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm pointer-events-none"
            :style="{
              backgroundColor:
                editor.getAttributes('textStyle').backgroundColor || '#fff',
            }"
          />
        </div>

        <div class="w-px h-5 bg-(--md-toolbar-border) mx-1.5" />

        <!-- ── Font Family Picker ────────────────────────────────────── -->
        <div class="flex items-center toolbar-font-select" @mousedown.stop>
          <Select
            :model-value="activeFontFamily"
            :options="googleFonts"
            placeholder="Search font..."
            filter
            filter-placeholder="Search fonts..."
            :option-label="null"
            :option-value="null"
            @update:model-value="applyFont"
            @show="fontPickerOpen = true"
            @hide="fontPickerOpen = false"
          >
            <template #value="{ value }">
              <span
                class="text-xs text-(--md-toolbar-text) truncate max-w-22 block"
                :style="value ? { fontFamily: value } : {}"
              >
                {{ value ?? "Select font" }}
              </span>
            </template>
            <template #option="{ option }">
              <span
                class="text-xs text-(--md-toolbar-text)"
                :style="{ fontFamily: option }"
              >
                {{ option }}
              </span>
            </template>
          </Select>
        </div>

        <div
          v-if="props.component.type === 'list'"
          class="w-px h-5 bg-(--md-toolbar-border) mx-1.5"
        />

        <!-- ── Bullet List ───────────────────────────────────────────── -->
        <div
          v-show="props.component.type === 'list'"
          class="relative group/btn"
        >
          <button
            @click="editor.chain().focus().toggleBulletList().run()"
            :class="buttonClass(editor.isActive('bulletList'))"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="8" x2="21" y1="6" y2="6" />
              <line x1="8" x2="21" y1="12" y2="12" />
              <line x1="8" x2="21" y1="18" y2="18" />
              <line x1="3" x2="3.01" y1="6" y2="6" />
              <line x1="3" x2="3.01" y1="12" y2="12" />
              <line x1="3" x2="3.01" y1="18" y2="18" />
            </svg>
          </button>
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg) tracking-normal"
          >
            Bullet list
          </div>
        </div>

        <!-- ── Ordered List ──────────────────────────────────────────── -->
        <div
          v-show="props.component.type === 'list'"
          class="relative group/btn"
        >
          <button
            @click="editor.chain().focus().toggleOrderedList().run()"
            :class="buttonClass(editor.isActive('orderedList'))"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="10" x2="21" y1="6" y2="6" />
              <line x1="10" x2="21" y1="12" y2="12" />
              <line x1="10" x2="21" y1="18" y2="18" />
              <path d="M4 6h1v4" />
              <path d="M4 10h2" />
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
            </svg>
          </button>
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg) tracking-normal"
          >
            Numbered list
          </div>
        </div>

        <div
          v-show="
            props.component.type === 'list' &&
            hasListContent(props.component.props.content)
          "
          class="w-px h-5 bg-(--md-toolbar-border) mx-1.5"
        />

        <!-- ── Add/Edit Link ─────────────────────────────────────────── -->
        <div class="relative group/btn">
          <button
            @click="setLink"
            :class="buttonClass(editor.isActive('link'))"
          >
            <div class="size-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="size-full"
              >
                <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                <line x1="8" x2="16" y1="12" y2="12" />
              </svg>
            </div>
          </button>
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg) tracking-normal"
          >
            {{ editor.isActive("link") ? "Edit link" : "Add link" }}
          </div>
        </div>

        <!-- ── Remove Link ───────────────────────────────────────────── -->
        <div v-if="editor.isActive('link')" class="relative group/btn">
          <button
            @click="editor.chain().focus().unsetLink().run()"
            class="w-8 h-8 rounded-xl text-(--md-danger) hover:opacity-80 hover:bg-(--md-danger-bg) transition-colors flex items-center justify-center"
          >
            <div class="size-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="size-full"
              >
                <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                <line x1="8" x2="16" y1="12" y2="12" />
              </svg>
            </div>
          </button>
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg) tracking-normal"
          >
            Remove link
          </div>
        </div>

        <!-- ── Toggle Link Underline ─────────────────────────────────── -->
        <div v-if="editor.isActive('link')" class="relative group/btn">
          <button
            @click="toggleLinkUnderline"
            :class="buttonClass(hasLinkUnderline)"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4v6a6 6 0 0 0 12 0V4" />
              <line x1="4" x2="20" y1="20" y2="20" />
            </svg>
          </button>
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg) tracking-normal"
          >
            Toggle underline
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";
import { deepActiveElement } from "@/utils/shadowDom";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { NodeView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Link } from "@tiptap/extension-link";
import { Underline } from "@tiptap/extension-underline";
import { ListItem } from "@tiptap/extension-list-item";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useGoogleFonts } from "@/composables/system/useGoogleFonts";
import { useRichTextEditors } from "@/composables/emailBuilder/core/ui/useRichTextEditors";
import LinkInputDialog from "../LinkInputDialog.vue";
import RichTextColorPicker from "./pickers/RichTextColorPicker.vue";
import MergeTagPicker from "./pickers/MergeTagPicker.vue";
import Select from "@/components/ui/primitives/Select.vue";

const CustomListItem = ListItem.extend({
  content: "inline*",
});

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  component: {
    id: string;
    type: string;
    props: { content: string };
  };
}>();
const teleportTarget = useTeleportTarget();

const hasListContent = (content: string) => {
  if (!content) return false;
  // Check if content contains <ul><li>...</li></ul>
  return /<ul>\s*<li>.*?<\/li>\s*<\/ul>/s.test(content);
};

// ─── Store ────────────────────────────────────────────────────────────────────

const {
  mergeTagInsertQueue,
  updateComponent,
  mergeTagPreviewContext,
  mergeTagPreviewActive,
} = useEmailBuilder();

// ─── Google Fonts ─────────────────────────────────────────────────────────────

const { googleFonts, loadGoogleFont } = useGoogleFonts();

// ─── Merge tag resolution helper ──────────────────────────────────────────────
//
// Single source of truth for resolving a tag name + pipe-default to a display
// string. Used by both the NodeView and (previously) buildPreviewHTML.
//
// Resolution priority:
//   1. Explicit context value  →  whatever the user typed in MergeTagTab
//   2. Inline pipe-default     →  {{ first_name|'Friend' }} → "Friend"
//   3. Neither                 →  {{ first_name }}  (raw, clearly unresolved)

const resolveTagValue = (tagName: string, pipeDefault: string): string => {
  if (mergeTagPreviewActive.value) {
    const key = tagName.trim().toLowerCase().replace(/\s+/g, "_");
    const ctxVal = mergeTagPreviewContext.value[key];
    if (ctxVal !== undefined && ctxVal !== "") return ctxVal;
    if (pipeDefault) return pipeDefault;
  }
  // Preview is off — always show the raw tag so the editor reflects stored data
  const fallback = pipeDefault ? `|'${pipeDefault}'` : "";
  return `{{ ${tagName}${fallback} }}`;
};

// ─── MergeTag TipTap node ─────────────────────────────────────────────────────
//
// Uses a NodeView so the DOM text content is swapped reactively whenever
// mergeTagPreviewActive or mergeTagPreviewContext changes — no overlay div,
// no ghost width from hidden raw-tag text.
//
// renderHTML is still needed for:
//   • Server-side rendering / HTML serialisation
//   • Initial parse when the editor first mounts from stored HTML
// It outputs the raw {{ tag }} form because the stored HTML must remain
// template-agnostic (preview context is transient, not persisted).

const MergeTag = Node.create({
  name: "mergeTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      name: { default: null },
      default: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-merge]",
        getAttrs: (el) => ({
          name: (el as HTMLElement).dataset.merge,
          default: (el as HTMLElement).dataset.mergeDefault ?? "",
        }),
      },
    ];
  },

  // renderHTML outputs raw tag — used for HTML serialisation and SSR only.
  // The NodeView overrides the live canvas display.
  renderHTML({ HTMLAttributes }) {
    const fallback = HTMLAttributes.default
      ? `|'${HTMLAttributes.default}'`
      : "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-merge": HTMLAttributes.name,
        "data-merge-default": HTMLAttributes.default ?? "",
        contenteditable: "false",
      }),
      `{{ ${HTMLAttributes.name}${fallback} }}`,
    ];
  },

  // NodeView — owns the live DOM element inside the ProseMirror canvas.
  // Replaces the static renderHTML output so the span's text content always
  // matches the currently resolved preview value with the correct width.
  addNodeView() {
    return ({ node }): NodeView => {
      const span = document.createElement("span");

      // Mirror the same data attributes renderHTML writes so CSS selectors and
      // any external code that queries span[data-merge] still works.
      span.setAttribute("data-merge", node.attrs.name ?? "");
      span.setAttribute("data-merge-default", node.attrs.default ?? "");
      span.setAttribute("contenteditable", "false");
      span.classList.add("merge-tag-node");

      // ── Render ─────────────────────────────────────────────────────────────
      // Single function that sets the span text to exactly what should be
      // visible — either the resolved value or the raw tag. Because textContent
      // is a single DOM text node the element is always as wide as its content.

      const render = () => {
        span.textContent = resolveTagValue(
          node.attrs.name ?? "",
          node.attrs.default ?? "",
        );
      };

      render();

      // ── Reactive updates ───────────────────────────────────────────────────
      // Watch both the active flag and the context map so the span re-renders
      // the moment the user toggles preview or edits a value in MergeTagTab.
      // `deep: true` on the context object catches per-key value changes.

      const stopWatch = watch(
        [mergeTagPreviewActive, mergeTagPreviewContext],
        render,
        { deep: true },
      );

      return {
        dom: span,

        // Called by ProseMirror when the node's attrs change (e.g. a future
        // "edit tag name" command). Return true to keep this NodeView instance
        // alive and re-render; false would destroy + recreate it.
        update(updatedNode) {
          if (updatedNode.type !== node.type) return false;
          // Sync attrs onto the live span without recreating the DOM node
          span.setAttribute("data-merge", updatedNode.attrs.name ?? "");
          span.setAttribute(
            "data-merge-default",
            updatedNode.attrs.default ?? "",
          );
          // Re-resolve with updated attrs
          span.textContent = resolveTagValue(
            updatedNode.attrs.name ?? "",
            updatedNode.attrs.default ?? "",
          );
          return true;
        },

        // Teardown — stop the watcher when this node is removed from the doc
        // to prevent memory leaks in long editing sessions.
        destroy() {
          stopWatch();
        },
      };
    };
  },
});

// ─── Background color + box-styling extension ─────────────────────────────────
//
// Adds three optional inline-style attributes to the textStyle mark:
//   • backgroundColor — existing
//   • padding         — CSS shorthand string ("8px 12px 8px 12px")
//   • borderRadius    — CSS length string ("6px")
//
// When padding or borderRadius is set, the span is automatically rendered as
// display:inline-block so vertical padding actually pushes lines apart and
// rounded corners clip correctly. Unset attrs emit nothing — same shape as
// the existing backgroundColor handling, so stored HTML stays clean for spans
// that only carry color/font.

const Highlight = Extension.create({
  name: "highlight",
  addOptions: () => ({ multicolor: true }),
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (el) =>
              el.style.backgroundColor?.replace(/['"]+/g, "") ?? null,
            renderHTML: (attrs) =>
              attrs.backgroundColor
                ? { style: `background-color: ${attrs.backgroundColor}` }
                : {},
          },
          padding: {
            default: null,
            parseHTML: (el) => el.style.padding || null,
            renderHTML: (attrs) =>
              attrs.padding
                ? { style: `padding: ${attrs.padding}; display: inline-block` }
                : {},
          },
          borderRadius: {
            default: null,
            parseHTML: (el) => el.style.borderRadius || null,
            renderHTML: (attrs) =>
              attrs.borderRadius
                ? {
                    style: `border-radius: ${attrs.borderRadius}; display: inline-block`,
                  }
                : {},
          },
        },
      },
    ];
  },
});

// ─── Custom Link with inline style support ────────────────────────────────────

const CustomLink = Link.extend({
  // Allow other marks (textStyle, bold, etc.) to coexist with link
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (el) => el.getAttribute("style"),
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
});

// ─── Editor instance ──────────────────────────────────────────────────────────

const isFocused = ref(false);
const toolbarRef = ref<HTMLElement | null>(null);

// ── Floating toolbar position ───────────────────────────────────────────────
// Teleported to <body> (see template) so it isn't clipped by the column's/
// row's `overflow: hidden`. Once teleported it's no longer a child of this
// wrapper in the DOM, so `absolute` positioning relative to the wrapper no
// longer works — we track the wrapper's on-screen box ourselves instead.
const editorRootEl = ref<HTMLElement | null>(null);
const toolbarPos = ref({ top: 0, left: 0 });
const TOOLBAR_GAP = 60; // px below the editor — matches the old -bottom-25,
// which also cleared the component action bar sitting closer above it.

let toolbarRafId: number | null = null;
const updateToolbarPosition = () => {
  if (toolbarRafId !== null) return;
  toolbarRafId = requestAnimationFrame(() => {
    toolbarRafId = null;
    if (!editorRootEl.value) return;
    const rect = editorRootEl.value.getBoundingClientRect();
    toolbarPos.value = {
      top: rect.bottom + TOOLBAR_GAP,
      left: rect.left + rect.width / 2,
    };
  });
};

// Typing re-wraps lines constantly, so the ResizeObserver below fires on
// nearly every keystroke. Updating immediately made the bar visibly crawl
// down the screen in real time as you typed — debounce that specific
// trigger so the bar holds still while you're actively typing and only
// settles into its new spot once you pause.
const TOOLBAR_REFLOW_DEBOUNCE_MS = 300;
let toolbarReflowTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedUpdateToolbarPosition = () => {
  if (toolbarReflowTimer !== null) clearTimeout(toolbarReflowTimer);
  toolbarReflowTimer = setTimeout(
    updateToolbarPosition,
    TOOLBAR_REFLOW_DEBOUNCE_MS,
  );
};

// Recompute on focus (nextTick so the bar has rendered first) — immediately,
// no debounce, since this is a one-off event rather than a keystroke.
watch(isFocused, (focused) => {
  if (focused) nextTick(updateToolbarPosition);
});

let toolbarResizeObserver: ResizeObserver | null = null;
onMounted(() => {
  window.addEventListener("scroll", updateToolbarPosition, true);
  window.addEventListener("resize", updateToolbarPosition);
  if (editorRootEl.value) {
    toolbarResizeObserver = new ResizeObserver(debouncedUpdateToolbarPosition);
    toolbarResizeObserver.observe(editorRootEl.value);
  }
});

const showLinkDialog = ref(false);
const colorPickerOpen = ref(false);

// ─── Font picker state ────────────────────────────────────────────────────────
// fontPickerOpen mirrors colorPickerOpen exactly: it tells the onBlur handler
// to keep the toolbar alive while the Select overlay is open, so
// the user can interact with the dropdown without the toolbar disappearing.

const fontPickerOpen = ref(false);

// Bumped on every ProseMirror transaction. This exists because TipTap's
// internal state is not Vue-reactive: editor.getAttributes()/isActive() read
// straight from ProseMirror, so a computed() wrapping them has no reactive
// dependency to invalidate on and serves its first cached value forever.
//
// Template expressions like `editor?.isActive('bold')` happen to work anyway,
// because @tiptap/vue-3's useEditor re-renders the component on transactions
// and re-running the render re-evaluates them. computed() is the case that
// breaks — it caches, and re-rendering alone does not invalidate it.
//
// The visible symptom was undo/redo: they call setContent, which changes the
// document without changing `editor.value`, so the font Select kept showing
// the pre-undo family. onTransaction fires for those too — including when
// onUpdate is deliberately suppressed for programmatic setContent.
const editorStateTick = ref(0);

// Read the active font family at the current cursor / selection. Returns null
// when no inline font-family mark is present so the placeholder is shown.
const activeFontFamily = computed(() => {
  editorStateTick.value; // reactive dependency — see above
  return editor.value?.getAttributes("textStyle").fontFamily ?? null;
});

// Apply the chosen font via TipTap's FontFamily extension, then ensure the
// font file is loaded in the browser. loadGoogleFont is a no-op for web-safe
// fonts and for any family already in the loadedFonts set.
const applyFont = (font: unknown) => {
  if (typeof font !== "string" || !font) {
    editor.value?.chain().focus().unsetFontFamily().run();
    return;
  }
  loadGoogleFont(font);
  editor.value?.chain().focus().setFontFamily(font).run();
};

// ── Suppress onUpdate during programmatic content restores ──────────────────
// When the external store changes (undo/redo, JSON import) the sync watcher
// calls editor.commands.setContent(), which fires TipTap's onUpdate hook
// synchronously. Without this flag, onUpdate → updateComponent → debounced
// saveToHistory queues a new entry whose commit() closure holds a reference
// to the just-restored content. When that timer fires it sees
// currentIndex < history.length-1 and truncates the redo stack, permanently
// destroying entries the user has not yet redone.
// TipTap's setContent dispatches synchronously, so raising the flag before
// the call and clearing it immediately after is race-free.
let _suppressOnUpdate = false;

// ─── Merge tag picker state ───────────────────────────────────────────────────

const pickerVisible = ref(false);
const pickerPosition = ref({ top: 0, left: 0 });
const pickerTriggerFrom = ref<number | null>(null);

const PICKER_DEFAULT_TAGS = [
  "first_name",
  "last_name",
  "email",
  "company",
  "unsubscribe_link",
  "confirmation_url",
  "promo_link",
  "order_id",
  "product_name",
];

const updatePickerPosition = () => {
  if (!editor.value) return;
  const { view } = editor.value;
  const { from } = view.state.selection;
  const coords = view.coordsAtPos(from);
  pickerPosition.value = { top: coords.bottom + 6, left: coords.left };
};

const openPicker = (triggerFrom: number) => {
  pickerTriggerFrom.value = triggerFrom;
  updatePickerPosition();
  pickerVisible.value = true;
};

const closePicker = () => {
  pickerVisible.value = false;
  pickerTriggerFrom.value = null;
};

// Bug fix: snapshot `from` and `to` BEFORE calling closePicker(),
// which nulls out pickerTriggerFrom. Order matters.
const handlePickerCommit = (tagName: string) => {
  const editorInstance = editor.value;
  const from = pickerTriggerFrom.value;
  closePicker(); // safe to call now — we've already captured `from`
  if (!editorInstance || from === null) return;

  // `to` is the current cursor position — the end of whatever the user
  // typed into the picker search box while it was open.
  const to = editorInstance.state.selection.from;

  editorInstance
    .chain()
    .focus()
    .command(({ tr, state }) => {
      tr.replaceWith(
        from,
        to,
        state.schema.nodes.mergeTag.create({ name: tagName, default: "" }),
      );
      return true;
    })
    .run();
};

const handlePickerCancel = () => {
  const editorInstance = editor.value;
  const from = pickerTriggerFrom.value;
  closePicker(); // snapshot first, then close
  if (!editorInstance || from === null) return;

  const to = editorInstance.state.selection.from;
  editorInstance
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.delete(from, to);
      return true;
    })
    .run();
};

const NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

// ─── Helper: check if cursor is inside a list item ────────────────────────────

const isInsideList = (): boolean => {
  if (!editor.value) return false;
  const { state } = editor.value;
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "listItem") return true;
  }
  return false;
};

// ─── onUpdate serializer ──────────────────────────────────────────────────────
//
// Preserves full HTML output including <ul>, <ol>, <li> nodes.
// For paragraph-only content (no lists), the previous behaviour of joining
// <p> innerHTML with <br> is preserved so the stored format stays compatible.

// ─── Inline color normalizer ──────────────────────────────────────────────────
//
// ProseMirror's DOM serializer (used internally by editor.getHTML()) applies
// every mark's "style" attribute via `dom.style.cssText = ...` rather than
// `setAttribute`. That routes the value through the browser's CSSOM parser,
// which canonicalizes colors the instant the style hits a real DOM node —
// #2563eb becomes rgb(37, 99, 235), with a trailing semicolon added. This
// happens for every inline color in the doc (link color, text color spans,
// etc.) purely as a side effect of how the browser stores parsed style
// declarations — it is not something an extension config can prevent, since
// it happens deep inside prosemirror-model's renderSpec, not in our code.
// rgb() and #hex render identically everywhere, but since the color pickers
// hand out hex, we convert back here so stored HTML matches what was picked.
const normalizeInlineColors = (html: string): string =>
  html.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi, (_match, r, g, b) => {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });

const serializeEditorContent = (
  editorInstance: { getHTML: () => string } | null | undefined,
): string => {
  if (!editorInstance) return "";

  const html = normalizeInlineColors(editorInstance.getHTML());
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const hasLists = tmp.querySelector("ul, ol");

  if (hasLists) {
    // ✅ Remove <p> inside <li>
    tmp.querySelectorAll("li > p").forEach((p) => {
      const parent = p.parentElement;
      if (!parent) return;

      while (p.firstChild) {
        parent.insertBefore(p.firstChild, p);
      }
      parent.removeChild(p);
    });

    // ✅ Remove trailing empty paragraphs
    const children = Array.from(tmp.children);

    while (children.length > 0) {
      const last = children[children.length - 1];

      if (
        last.tagName === "P" &&
        (last.innerHTML === "" || last.innerHTML === "<br>")
      ) {
        tmp.removeChild(last);
        children.pop();
      } else {
        break;
      }
    }

    return tmp.innerHTML.replace(/\u00A0/g, " ");
  }

  // paragraph-only fallback (your existing logic)
  const innerContent = Array.from(tmp.querySelectorAll("p"))
    .map((p) => p.innerHTML)
    .filter(Boolean)
    .join("<br>");

  return innerContent.replace(/\u00A0/g, " ");
};

// ─── Debounced content flush to the store ────────────────────────────────────
//
// TipTap fires onUpdate on every single keystroke. Writing to the store on
// every keystroke triggers a full CanvasComponent re-render, style object
// rebuilds (fontFamily loads, style diff), and queues a debounced history
// save. Cumulatively this is the biggest typing-lag source.
//
// Fix: buffer the serialized HTML in-component and flush it to the store at
// most once every FLUSH_MS. The flush is guaranteed on:
//   • timer expiry                (normal typing pause)
//   • editor blur                 (user tabs away / clicks outside)
//   • onBeforeUnmount             (component removed from tree)
//   • merge tag insert / picker commit (next transaction needs fresh state)
//
// FLUSH_MS must be noticeably shorter than useHistory.ts's DEBOUNCE_MS
// (currently 600 ms) so a typing burst lands as exactly one history entry.

const FLUSH_MS = 400;
let _pendingContent: string | null = null;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

const flushPendingContent = () => {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  if (_pendingContent !== null) {
    const content = _pendingContent;
    _pendingContent = null;
    updateComponent(props.component.id, { content });
  }
};

const scheduleFlush = (content: string) => {
  _pendingContent = content;
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushPendingContent, FLUSH_MS);
};

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      // Keep bulletList, orderedList, listItem from StarterKit (default: enabled)
      listItem: false, // disable default
      heading: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      link: false,
      underline: false,
      hardBreak: { keepMarks: true },
    }),
    TextStyle,
    Color.configure({ types: ["textStyle", "link"] }),
    FontFamily,
    Highlight,
    Underline,
    MergeTag,
    CustomLink.configure({ openOnClick: false }),
    CustomListItem,
  ],

  content: props.component.props.content || "",

  editorProps: {
    attributes: { class: "focus:outline-none" },

    // Block all drops so component-level drag-and-drop doesn't interfere
    handleDrop: () => true,

    handleKeyDown: (_view, event) => {
      // Preview mode: allow cursor movement only, swallow everything else
      if (mergeTagPreviewActive.value) {
        return !NAVIGATION_KEYS.has(event.key);
      }

      // Picker open: Escape cancels without bubbling
      if (pickerVisible.value && event.key === "Escape") {
        handlePickerCancel();
        return true;
      }

      // Normal mode: bare Enter behaviour depends on context
      if (event.key === "Enter" && !event.shiftKey) {
        // Inside a list — let TipTap handle it natively (new list item)
        if (isInsideList()) return false;

        // Outside a list — emit a hard break (email-safe line break)
        event.preventDefault();
        editor.value?.commands.setHardBreak();
        return true;
      }

      return false;
    },

    handleTextInput(view, from, _to, text) {
      // Block all typing while previewing
      if (mergeTagPreviewActive.value) return true;

      // Detect the second "{" completing the "{{" trigger sequence.
      // We check the character already in the doc at `from - 1` (the first {
      // was committed in the previous transaction).
      if (text === "{") {
        const preceding = view.state.doc.textBetween(
          Math.max(0, from - 1),
          from,
          "\n",
        );
        if (preceding === "{") {
          // Defer past TipTap's current transaction so both { chars are
          // committed to the doc before we snapshot positions.
          setTimeout(() => {
            if (!editor.value) return;
            const { from: cursorAfter } = editor.value.state.selection;
            // The trigger range starts at the first {: cursorAfter - 2
            openPicker(cursorAfter - 2);
          }, 0);
        }
      }

      return false; // never swallow — let TipTap write the character
    },

    handlePaste: () => mergeTagPreviewActive.value,
  },

  onFocus() {
    isFocused.value = true;
  },

  onBlur() {
    // Flush any buffered content immediately on blur so the store reflects
    // the latest edits before focus-dependent UI (like property panels) reads
    // from it. Without this, the 400 ms debounce could delay a committed edit.
    flushPendingContent();

    setTimeout(() => {
      // Keep the toolbar alive while the color picker, font Select overlay
      if (colorPickerOpen.value || fontPickerOpen.value) return;

      // deepActiveElement() and the root-scoped query below are what make
      // this work in the custom-element build. document.activeElement
      // returns the shadow *host* for anything focused inside a shadow
      // root — never the real element — and document.querySelector cannot
      // see into a shadow root at all. So both checks below used to
      // resolve as "focus has left the toolbar" for every interaction,
      // tearing the toolbar down the moment you clicked the font Select,
      // the merge-tag picker, or the colour picker. All three failed
      // together in React while working fine in the plain Vue path, which
      // is exactly what a shadow-root-only bug looks like.
      const active = deepActiveElement();
      if (!toolbarRef.value?.contains(active)) {
        isFocused.value = false;
      }
      if (pickerVisible.value) {
        // getRootNode() returns the ShadowRoot when mounted inside one and
        // the Document otherwise, so this single query is correct for both
        // usage paths without branching on which is active.
        const root = toolbarRef.value?.getRootNode() as
          Document | ShadowRoot | undefined;
        const pickerEl = root?.querySelector("[data-merge-picker]");
        if (!pickerEl?.contains(active)) {
          handlePickerCancel();
        }
      }
    }, 100);
  },

  // Fires for every document and selection change, including the
  // programmatic setContent that undo/redo performs — unlike onUpdate,
  // which is suppressed in that case.
  onTransaction() {
    editorStateTick.value++;
  },

  onUpdate({ editor }) {
    // Skip when setContent was called programmatically (undo/redo, JSON
    // import). Without this guard the restored content is re-saved to
    // history, creating a ghost entry that truncates the redo stack.
    if (_suppressOnUpdate) return;

    // Debounce the write to the store. This is the single highest-impact
    // fix for typing lag: 11 keystrokes → 1 store write instead of 11.
    scheduleFlush(serializeEditorContent(editor));
  },
});

// ─── Register this editor so property panels can resolve it by component id ────
const { registerEditor, unregisterEditor } = useRichTextEditors();
watch(
  editor,
  (ed) => {
    if (ed) registerEditor(props.component.id, ed);
  },
  { immediate: true },
);

// ─── Sync external store → editor (undo/redo, JSON import) ───────────────────

watch(
  () => props.component.props.content,
  (newContent) => {
    if (!editor.value || editor.value.isFocused) return;
    // Do NOT guard on editor.value.isFocused here.
    // The most critical case is undo/redo while the cursor is inside the
    // editor (Ctrl+Z with focus). The old guard blocked setContent in that
    // case, leaving TipTap showing stale styled content while the store held
    // the correctly restored value. The next user keystroke then re-wrote
    // the store from TipTap's stale state, corrupting the history stack for
    // every other component too.
    // _suppressOnUpdate already prevents the re-entry loop (setContent fires
    // onUpdate synchronously; the flag ensures it is a no-op), so the
    // isFocused guard is no longer needed.
    // Compare against serializeEditorContent's output (not raw getHTML()) —
    // that's the actual shape "content" is stored in (list <p>-unwrapping,
    // <br>-joining, and now hex-normalized colors). Comparing against raw
    // getHTML() would almost always "differ" for any doc with a link or a
    // colored span, since getHTML() always renders colors as rgb() while the
    // stored value is hex, forcing a needless setContent() on every check.
    if (newContent !== serializeEditorContent(editor.value)) {
      _suppressOnUpdate = true;
      editor.value.commands.setContent(newContent, { parseOptions: {} });
      _suppressOnUpdate = false;
    }
  },
);

// ─── Merge tag insert queue ───────────────────────────────────────────────────
//
// Works identically to the paragraph editor — inserts the merge tag node at
// the current cursor position, which may be inside a list item.

watch(mergeTagInsertQueue, (val) => {
  if (!val || val.componentId !== props.component.id) return;

  const editorInstance = editor.value;
  if (!editorInstance) return;

  // Flush any buffered typing content BEFORE the merge tag insert so the
  // store order matches the visual order the user sees in the editor.
  flushPendingContent();

  editorInstance
    .chain()
    .focus()
    .insertContent([
      {
        type: "mergeTag",
        attrs: {
          name: val.tagName,
          default: val.default ?? "",
        },
      },
      {
        type: "text",
        text: "\u00A0",
      },
    ])
    .run();

  mergeTagInsertQueue.value = null;
});

// ─── Link helpers ─────────────────────────────────────────────────────────────

const hasLinkUnderline = computed(() => {
  editorStateTick.value; // reactive dependency — see editorStateTick
  if (!editor.value?.isActive("link")) return false;
  return editor.value.isActive("underline");
});

const toggleLinkUnderline = () => {
  if (!editor.value) return;

  const attrs = editor.value.getAttributes("link");
  if (!attrs.href) return;

  const currentStyle = attrs.style ?? "";
  const isCurrentlyUnderlined = !currentStyle.includes("text-decoration: none");

  // Build new style: strip existing text-decoration, append toggled value
  const newDecl = isCurrentlyUnderlined
    ? "text-decoration: none"
    : "text-decoration: underline";
  const strippedStyle = currentStyle
    .replace(/text-decoration:\s*[^;]+;?\s*/g, "")
    .replace(/;\s*$/, "")
    .trim();
  const newStyle = strippedStyle ? `${strippedStyle}; ${newDecl}` : newDecl;

  // updateAttributes always nests a new mark — the only safe way is
  // unsetLink → setLink with the full updated attrs in one chain
  const chain = editor.value
    .chain()
    .focus()
    .extendMarkRange("link")
    .unsetLink()
    .setLink({
      href: attrs.href,
      target: attrs.target,
      rel: attrs.rel,
      style: newStyle,
    } as unknown as {
      href: string;
      target?: string | null;
      rel?: string | null;
      class?: string | null;
      title?: string | null;
    });

  if (isCurrentlyUnderlined) {
    chain.unsetMark("underline").run();
  } else {
    chain.setMark("underline").run();
  }
};

const handleToolbarFocusOut = (event: FocusEvent) => {
  if (!toolbarRef.value?.contains(event.relatedTarget as HTMLElement)) {
    editor.value?.commands.focus();
  }
};

const setLink = () => {
  showLinkDialog.value = true;
};

const handleLinkSubmit = ({ url }: { url: string }) => {
  if (!url) {
    editor.value?.chain().focus().unsetLink().run();
    return;
  }
  const existingStyle = normalizeInlineColors(
    editor.value?.getAttributes("link").style ?? "",
  );
  editor.value?.chain().focus().setLink({ href: url }).run();
};

// ─── Toolbar button styling ───────────────────────────────────────────────────
// Modern hover-bg / ring-active treatment (matches the action-bar redesign).
// Inactive: clean, no border noise; hover bg only.
// Active:   subtle purple wash + ring so the state reads instantly without
//           competing with the rest of the toolbar.
const buttonClass = (active: boolean) =>
  [
    "w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--md-toolbar-text)]",
    active
      ? "bg-[var(--md-row-selection-bg)] text-[var(--md-row-selection-fg)] ring-1 ring-[var(--md-row-selection)]/40"
      : "hover:bg-[var(--md-surface-hover)] hover:text-[var(--md-text)]",
  ].join(" ");

onBeforeUnmount(() => {
  // Flush any buffered content synchronously before the editor is destroyed,
  // otherwise a rapid "type → delete component" sequence would lose the last
  // 0-400 ms of input.
  unregisterEditor(props.component.id);
  flushPendingContent();
  editor.value?.destroy();

  window.removeEventListener("scroll", updateToolbarPosition, true);
  window.removeEventListener("resize", updateToolbarPosition);
  toolbarResizeObserver?.disconnect();
  if (toolbarRafId !== null) cancelAnimationFrame(toolbarRafId);
  if (toolbarReflowTimer !== null) clearTimeout(toolbarReflowTimer);
});
</script>

<style scoped>
:deep(a) {
  color: #2563eb;
  cursor: pointer;
}

:deep(a:not([style*="text-decoration"])) {
  text-decoration: underline;
}

:deep(a:hover) {
  opacity: 0.8;
}

/* Merge tag node — inline chip styling.
   display:inline ensures the span is exactly as wide as its text content.
   No width reservation from hidden raw-tag text since the NodeView
   writes only one text node at a time. */
:deep(.merge-tag-node) {
  display: inline;
  white-space: nowrap;
  vertical-align: baseline;
  cursor: default;
  border-radius: 3px;
  padding: 0 2px;
}

/* List styles — scoped to the editor content area */
:deep(li:not(:last-child)) {
  margin-bottom: var(--list-item-spacing, 0.25rem);
}

/* ─── Toolbar font Select sizing ─────────────────────────────────────────────
   Constrain the Select to sit flush inside the toolbar row.
   The trigger is kept compact (28px tall) and the overlay is widened so
   long font names are readable without being clipped.                       */

.toolbar-font-select :deep(.p-select) {
  height: 28px;
  min-width: 110px;
  max-width: 130px;
  border-radius: 6px;
  border-color: var(
    --md-toolbar-border
  ); /* matches other toolbar button borders */
  padding: 0 6px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
}

.toolbar-font-select :deep(.p-select-label) {
  padding: 0;
  font-size: 0.85rem;
  line-height: 1;
}

.toolbar-font-select :deep(.p-select-dropdown) {
  width: 20px;
}

/* Widen the overlay panel so long font names are not clipped */
:deep(.p-select-overlay) {
  min-width: 180px !important;
}
</style>
