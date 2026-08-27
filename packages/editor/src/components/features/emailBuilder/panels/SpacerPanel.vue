<template>
  <div class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <!-- Spacer Height -->
    <PropertySection title="Spacer">
      <PropertyNumberSlider
        label="Height (px)"
        :model-value="displayValue('height')"
        :min="1"
        :max="600"
        :step="5"
        unit="px"
        :is-overridden="isOverridden('height')"
        @update:model-value="setProp('height', $event)"
        @reset="resetProp('height')"
      />

      <!-- Background: solid OR gradient -->
      <div>
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
    </PropertySection>

    <!-- Visibility -->
    <PropertyVisibility :visibility="component?.props?.visibility" />

    <!-- Device Settings -->
    <PropertySection
      :title="editMode === 'desktop' ? 'Desktop Settings' : 'Mobile Settings'"
    >
      <PropertyToggle
        v-if="editMode === 'desktop'"
        label="Hide on Desktop"
        description="Block will hide on screens ≥600px"
        :model-value="component?.props?.desktopHide"
        @update:model-value="toggleDesktopHide"
      />

      <PropertyToggle
        v-else
        label="Hide on Mobile"
        description="Block will hide on screens ≤600px"
        :model-value="component?.props?.mobileHide"
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
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";

const { rows, findComponent, selectedId, previewMode } = useEmailBuilder();

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
</script>
