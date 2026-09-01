<template>
  <div v-if="component" class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <!-- Content (desktop only) -->
    <PropertySection v-if="editMode === 'desktop'" title="Content">
      <!-- Link Text -->
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1">
          Link Text
        </label>
        <div class="relative">
          <InputText
            ref="textInputRef"
            class="w-full"
            @click="trackCursor('text', $event)"
            @keyup="trackCursor('text', $event)"
            :model-value="component.props.text"
            @update:model-value="onTextInput"
          />
        </div>
        <PreviewBadge
          :active="linkTagPreviewActive"
          :resolved="resolvedText"
          :raw="component.props.text"
        />
      </div>

      <!-- URL -->
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1"
          >URL</label
        >
        <div class="relative">
          <InputText
            ref="linkInputRef"
            class="w-full"
            placeholder="https://example.com"
            :model-value="component.props.link"
            @update:model-value="onUrlInput"
            @click="trackCursor('link', $event)"
            @keyup="trackCursor('link', $event)"
          />
        </div>
        <PreviewBadge
          :active="linkTagPreviewActive"
          :resolved="resolvedLink"
          :raw="component.props.link"
        />
      </div>

      <!-- Merge tags -->
      <LinkFieldMergeTags
        :last-focused-field="lastFocusedField"
        :default-tags="anchorDefaultTags"
        @insert="handleTagInsert"
        @focus="lastFocusedField = $event"
      />
    </PropertySection>

    <!-- Typography -->
    <PropertySection title="Typography">
      <PropertySelect
        label="Font Family"
        :model-value="displayValue('fontFamily')"
        :options="googleFonts"
        :option-label="null"
        :option-value="null"
        placeholder="Search fonts..."
        :is-overridden="isOverridden('fontFamily')"
        @update:model-value="setProp('fontFamily', $event)"
        @reset="resetProp('fontFamily')"
      />

      <PropertyNumberSlider
        label="Font Size"
        :model-value="displayValue('fontSize')"
        :min="8"
        :max="72"
        :step="1"
        unit="px"
        :is-overridden="isOverridden('fontSize')"
        @update:model-value="setProp('fontSize', $event)"
        @reset="resetProp('fontSize')"
      />

      <PropertyNumberSlider
        label="Letter Spacing"
        :model-value="displayValue('letterSpacing')"
        :min="0"
        :max="10"
        :step="0.5"
        unit="px"
        :is-overridden="isOverridden('letterSpacing')"
        @update:model-value="setProp('letterSpacing', $event)"
        @reset="resetProp('letterSpacing')"
      />

      <PropertySelect
        label="Font Weight"
        :model-value="displayValue('fontWeight')"
        :options="fontWeightOptions"
        :is-overridden="isOverridden('fontWeight')"
        placeholder="Search weight..."
        @update:model-value="setProp('fontWeight', $event)"
        @reset="resetProp('fontWeight')"
      />

      <PropertyColor
        label="Link Color"
        :model-value="displayValue('color')"
        placeholder="#000000"
        :is-overridden="isOverridden('color')"
        @update:model-value="setProp('color', $event)"
        @reset="resetProp('color')"
      />

      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-(--md-text-muted)"
            >Text Decoration</span
          >
          <button
            v-if="isOverridden('textDecoration')"
            @click="resetProp('textDecoration')"
            class="text-xs text-(--md-selection) hover:text-(--md-selection-fg)"
          >
            ↩ Reset
          </button>
        </div>
        <div class="flex gap-1">
          <button
            v-for="opt in textDecorationOptions"
            :key="opt.value"
            :title="opt.label"
            @click="setProp('textDecoration', opt.value)"
            class="toggle-btn flex-1"
            :class="
              displayValue('textDecoration') === opt.value
                ? 'toggle-btn--active'
                : 'toggle-btn--idle'
            "
          >
            <span
              class="text-[11px] font-semibold leading-none"
              :style="opt.style"
            >
              {{ opt.glyph }}
            </span>
          </button>
        </div>
      </div>

      <PropertyAlignment
        :model-value="displayValue('align')"
        :is-overridden="isOverridden('align')"
        @update:model-value="setProp('align', $event)"
        @reset="resetProp('align')"
      />
    </PropertySection>

    <PropertySection title="Spacing">
      <SpacingControl
        label="Margin"
        :model-value="
          editMode === 'mobile'
            ? component.props.mobile.margin
            : component.props.margin
        "
        :desktop-value="component.props.margin"
        :is-mobile-edit="editMode === 'mobile'"
        @update:model-value="onSpacingUpdate('margin', $event)"
      />
      <SpacingControl
        label="Padding"
        :model-value="
          editMode === 'mobile'
            ? component.props.mobile.padding
            : component.props.padding
        "
        :desktop-value="component.props.padding"
        :is-mobile-edit="editMode === 'mobile'"
        @update:model-value="onSpacingUpdate('padding', $event)"
      />
    </PropertySection>

    <PropertyVisibility :visibility="component.props.visibility" />

    <PropertySection
      :title="editMode === 'desktop' ? 'Desktop Settings' : 'Mobile Settings'"
    >
      <PropertyToggle
        v-if="editMode === 'desktop'"
        label="Hide on Desktop"
        description="Block will hide on screens ≥600px"
        :model-value="component.props.desktopHide"
        @update:model-value="toggleDesktopHide"
      />
      <PropertyToggle
        v-else
        label="Hide on Mobile"
        description="Block will hide on screens ≤600px"
        :model-value="component.props.mobileHide"
        @update:model-value="toggleMobileHide"
      />
    </PropertySection>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useGoogleFonts } from "@/composables/system/useGoogleFonts";
import { useComponentStyleEditor } from "@/composables/emailBuilder/components/useComponentStyleEditor";
import { useLinkTagInsert } from "@/composables/emailBuilder/core/link-tags/useLinkTagInsert";
import { resolveString } from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";

import InputText from "@/components/ui/primitives/InputText.vue";

import DeviceTabs from "./shared/DeviceTabs.vue";
import LinkFieldMergeTags from "./shared/LinkFieldMergeTags.vue";
import PreviewBadge from "./shared/PreviewBadge.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertySelect from "./ui/PropertySelect.vue";
import PropertyAlignment from "./ui/PropertyAlignment.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import SpacingControl from "./ui/SpacingControl.vue";

// ─── Store ────────────────────────────────────────────────────────────────────

const {
  rows,
  findComponent,
  selectedId,
  previewMode,
  saveToHistory,
  linkTagPreviewContext,
  linkTagPreviewActive,
} = useEmailBuilder();

const { googleFonts, loadGoogleFont } = useGoogleFonts();
const component = computed(() => {
  // Reactive dep on tree so this computed re-evaluates after structural ops
  // (drag-drop, undo/redo) which can swap the node reference under our ID.
  void rows.value;
  return findComponent(selectedId.value);
});

// Writable computed — always in sync with the global preview mode, no watcher needed.
type EditMode = "desktop" | "mobile";

const editMode = computed<EditMode>({
  get: () => previewMode.value as EditMode,
  set: (v: EditMode) => {
    previewMode.value = v;
  },
});

const {
  displayValue,
  isOverridden,
  setProp,
  resetProp,
  toggleDesktopHide,
  toggleMobileHide,
} = useComponentStyleEditor(component, editMode);

watch(
  () => displayValue("fontFamily"),
  (font) => loadGoogleFont(font),
  { immediate: true },
);

// ─── Link tag insert ──────────────────────────────────────────────────────────

const { lastFocusedField, trackCursor, handleTagInsert } =
  useLinkTagInsert(component);

// ─── Live preview resolved values ─────────────────────────────────────────────

const resolvedText = computed(() =>
  resolveString(
    component.value?.props?.text ?? "",
    linkTagPreviewContext.value,
    linkTagPreviewActive.value,
  ),
);

const resolvedLink = computed(() =>
  resolveString(
    component.value?.props?.link ?? "",
    linkTagPreviewContext.value,
    linkTagPreviewActive.value,
  ),
);

// ─── Props mutation handlers (each calls saveToHistory) ─────────────────

const onTextInput = (value: string) => {
  component.value.props.text = value.trim();
  saveToHistory("anchor-text");
};

const onUrlInput = (value: string) => {
  component.value!.props.link = value.trim();
  saveToHistory("anchor-url");
};

// ─── Spacing update with history ──────────────────────────────────────────────

const onSpacingUpdate = (field: "margin" | "padding", value: any) => {
  if (editMode.value === "mobile") {
    component.value!.props.mobile[field] = value;
  } else {
    component.value!.props[field] = value;
  }
  saveToHistory(`set-${field}`);
};

// ─── Static options ───────────────────────────────────────────────────────────

const anchorDefaultTags = [
  "unsubscribe_link",
  "reset_token",
  "confirmation_url",
  "first_name",
  "email",
];

const fontWeightOptions = [
  { label: "Normal", value: "normal" },
  { label: "Medium", value: "medium" },
  { label: "Bold", value: "bold" },
];

const textDecorationOptions = [
  { label: "None", value: "none", glyph: "—", style: { opacity: 0.4 } },
  {
    label: "Underline",
    value: "underline",
    glyph: "U",
    style: { textDecoration: "underline", textUnderlineOffset: "2px" },
  },
  {
    label: "Strikethrough",
    value: "line-through",
    glyph: "S",
    style: { textDecoration: "line-through" },
  },
  {
    label: "Overline",
    value: "overline",
    glyph: "O",
    style: { textDecoration: "overline" },
  },
];
</script>

<style scoped>
.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border-radius: 6px;
  border: 0.5px solid transparent;
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
  background: transparent;
  padding: 0;
  outline: none;
}
.toggle-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--md-selection);
}
.toggle-btn--idle {
  border-color: var(--md-border);
  color: var(--md-text-subtle);
}
.toggle-btn--idle:hover {
  background: var(--md-surface-hover);
  border-color: var(--md-border-strong);
}
.toggle-btn--active {
  background: var(--md-selection-bg);
  border-color: var(--md-selection);
  color: var(--md-selection-fg);
}
.toggle-btn--active:hover {
  background: color-mix(
    in srgb,
    var(--md-selection) 20%,
    var(--md-selection-bg)
  );
}
</style>
