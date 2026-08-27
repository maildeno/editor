<template>
  <div v-if="component" class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <!-- Appearance -->
    <PropertySection title="Appearance">
      <div class="mb-5">
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-medium text-(--md-text-muted)">Background</label>
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

      <PropertyNumberSlider
        label="Width (%)"
        :model-value="displayValue('width')"
        :min="8"
        :max="100"
        :step="1"
        unit="%"
        :is-overridden="isOverridden('width')"
        @update:model-value="setProp('width', $event)"
        @reset="resetProp('width')"
      />

      <PropertyNumberSlider
        label="Height (px)"
        :model-value="displayValue('height')"
        :min="1"
        :max="20"
        :step="1"
        unit="px"
        :is-overridden="isOverridden('height')"
        @update:model-value="setProp('height', $event)"
        @reset="resetProp('height')"
      />

      <PropertyAlignment
        :model-value="displayValue('align')"
        :is-overridden="isOverridden('align')"
        @update:model-value="setProp('align', $event)"
        @reset="resetProp('align')"
      />
    </PropertySection>

    <!-- Spacing -->
    <PropertySection title="Spacing">
      <SpacingControl
        label="Margin"
        :model-value="editMode === 'mobile' ? component.props.mobile.margin : component.props.margin"
        :desktop-value="component.props.margin"
        :is-mobile-edit="editMode === 'mobile'"
        @update:model-value="onSpacingUpdate('margin', $event)"
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
import { computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useComponentStyleEditor } from "@/composables/emailBuilder/components/useComponentStyleEditor";

import DeviceTabs from "./shared/DeviceTabs.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertyAlignment from "./ui/PropertyAlignment.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import SpacingControl from "./ui/SpacingControl.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";

const { rows, findComponent, selectedId, previewMode, saveToHistory } = useEmailBuilder();
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