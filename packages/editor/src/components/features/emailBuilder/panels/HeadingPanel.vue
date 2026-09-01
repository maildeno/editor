<template>
  <div v-if="component" class="space-y-3">
    <!-- Device switcher -->
    <DeviceTabs v-model="editMode" />

    <!-- Content (desktop only) -->
    <PropertySection v-if="editMode === 'desktop'" title="Content">
      <PropertySelect
        label="Heading Level"
        :model-value="component.props.level"
        :options="levelOptions"
        placeholder="Search heading level..."
        @update:model-value="onLevelChange"
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
        :max="200"
        :step="1"
        unit="px"
        :is-overridden="isOverridden('fontSize')"
        @update:model-value="setProp('fontSize', $event)"
        @reset="resetProp('fontSize')"
      />

      <PropertyNumberSlider
        label="Line Height"
        :model-value="displayValue('lineHeight')"
        :min="1"
        :max="3"
        :step="0.1"
        :is-overridden="isOverridden('lineHeight')"
        @update:model-value="setProp('lineHeight', $event)"
        @reset="resetProp('lineHeight')"
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

      <!-- fontStyle excluded — TextStylePanel renders with :show-font-style="false" -->
      <TextStylePanel
        :show-font-style="false"
        :font-weight="displayValue('fontWeight')"
        :transform="displayValue('textTransform')"
        :decoration="displayValue('textDecoration')"
        :overrides="activeOverrides"
        @update:font-weight="setProp('fontWeight', $event)"
        @update:transform="setProp('textTransform', $event)"
        @update:decoration="setProp('textDecoration', $event)"
        @reset="resetProp($event)"
      />

      <PropertyAlignment
        :model-value="displayValue('align')"
        :is-overridden="isOverridden('align')"
        @update:model-value="setProp('align', $event)"
        @reset="resetProp('align')"
      />

      <PropertyColor
        label="Text Color"
        :model-value="displayValue('color')"
        placeholder="#000000"
        :is-overridden="isOverridden('color')"
        @update:model-value="setProp('color', $event)"
        @reset="resetProp('color')"
      />
    </PropertySection>

    <PropertySection title="Appearance">
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-medium text-(--md-text-muted)"
            >Background</label
          >
          <button
            v-if="isBackgroundOverridden()"
            type="button"
            @click="resetBackground"
            class="text-xs text-(--md-selection-fg) hover:opacity-80"
          >
            ↩ Reset
          </button>
        </div>
        <PropertyGradientColor
          :model-value="displayBackground()"
          :is-overridden="isBackgroundOverridden()"
          @update:model-value="setBackground($event)"
          @reset="resetBackground"
        />
      </div>
    </PropertySection>

    <!-- Box Styling — applies to the selected text -->
    <PropertySection title="Box Styling">
      <BoxStylingSection :editor="inlineEditor" />
    </PropertySection>

    <!-- Merge Tags -->
    <PropertySection title="Merge Tags">
      <TextFieldMergeTags
        :tag-defaults="{ first_name: 'Friend', company: 'Acme' }"
        @insert="
          ({ tag, default: def }) =>
            triggerMergeTagInsert(component.id, tag, def)
        "
      />
    </PropertySection>

    <!-- Spacing -->
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

    <!-- Visibility -->
    <PropertyVisibility :visibility="component.props.visibility" />

    <!-- Device settings -->
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
import { useRichTextEditors } from "@/composables/emailBuilder/core/ui/useRichTextEditors";

import DeviceTabs from "./shared/DeviceTabs.vue";
import BoxStylingSection from "./ui/BoxStylingSection.vue";
import TextFieldMergeTags from "./shared/TextFieldMergeTags.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertySelect from "./ui/PropertySelect.vue";
import PropertyAlignment from "./ui/PropertyAlignment.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import SpacingControl from "./ui/SpacingControl.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";
import TextStylePanel from "./ui/PropertyTextStylePanel.vue";

const {
  rows,
  findComponent,
  selectedId,
  previewMode,
  saveToHistory,
  triggerMergeTagInsert,
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
  displayBackground,
  setBackground,
  isBackgroundOverridden,
  resetBackground,
  toggleDesktopHide,
  toggleMobileHide,
} = useComponentStyleEditor(component, editMode);

const { editorFor } = useRichTextEditors();
const inlineEditor = computed(() => editorFor(selectedId.value));

watch(
  () => displayValue("fontFamily"),
  (font) => loadGoogleFont(font),
  { immediate: true },
);

// ─── Options ──────────────────────────────────────────────────────────────────

const levelOptions = [
  { label: "H1", value: "h1" },
  { label: "H2", value: "h2" },
  { label: "H3", value: "h3" },
  { label: "H4", value: "h4" },
  { label: "H5", value: "h5" },
  { label: "H6", value: "h6" },
];

// fontStyle excluded: TextStylePanel is rendered with :show-font-style="false"
const activeOverrides = computed(() => {
  const keys = ["fontWeight", "textTransform", "textDecoration"];
  return new Set(keys.filter((k) => isOverridden(k)));
});

// ─── Heading level change with history ────────────────────────────────────────

const onLevelChange = (value: string) => {
  component.value!.props.level = value;
  saveToHistory("set-heading-level");
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
</script>
