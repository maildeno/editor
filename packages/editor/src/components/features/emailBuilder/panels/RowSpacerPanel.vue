<template>
  <div class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <!-- Row Name (desktop only: a name is not a per-device setting) -->
    <PropertySection v-if="editMode === 'desktop'" title="Name">
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5">
          Row Spacer Name
        </label>
        <InputText
          :model-value="nameDisplayValue"
          class="w-full text-xs"
          placeholder="e.g. Hero Section Spacer"
          @update:model-value="onNameInput"
          @blur="onNameBlur"
          @keydown.enter="onNameBlur"
        />
        <p class="mt-1 text-[10px] text-(--md-text-subtle) font-mono">
          {{ spacer.name || "—" }}
        </p>
      </div>
    </PropertySection>

    <!-- Height -->
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

      <!-- Solid / Gradient picker (replaces plain PropertyColor) -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label
            class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
          >
            Background Color
            <OverrideBadge :show="isBackgroundOverridden()" />
          </label>
          <button
            v-if="isBackgroundOverridden()"
            type="button"
            @click="resetBackground"
            class="text-[11px] text-(--md-selection-fg) hover:opacity-80"
          >
            ↩ Reset
          </button>
        </div>
        <!-- The badge and Reset above cover Solid and Gradient alike, so the
             picker's own (Solid only) are left off: one of each, never two. -->
        <PropertyGradientColor
          :model-value="background"
          @update:model-value="setBackground($event)"
        />
      </div>
    </PropertySection>

    <!-- Visibility -->
    <PropertyVisibility :visibility="spacer.visibility" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useNodeStyleEditor } from "@/composables/emailBuilder/components/useNodeStyleEditor";
import type { EditMode } from "@/composables/emailBuilder/components/useComponentStyleEditor";
import {
  displayName,
  toRowName,
} from "@/composables/emailBuilder/core/useEmailBuilderOperations";

import InputText from "@/components/ui/primitives/InputText.vue";

import DeviceTabs from "./shared/DeviceTabs.vue";
import OverrideBadge from "./shared/OverrideBadge.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";

const { saveToHistory, previewMode } = useEmailBuilder();

const props = defineProps({
  spacer: { type: Object, required: true },
});

// ─── Desktop / Mobile ─────────────────────────────────────────────────────────

// Writable computed over the global preview mode, as in the component panels:
// the tabs, the canvas and this panel always agree, and no watcher is needed.
const editMode = computed<EditMode>({
  get: () => previewMode.value as EditMode,
  set: (v: EditMode) => {
    previewMode.value = v;
  },
});

// A row-spacer has no `props`: its style sits on the node and its overrides on
// `node.mobile`. The adapter gives it the same API the component panels use,
// and its writes commit history themselves.
const node = computed(() => props.spacer);

const {
  displayValue,
  isOverridden,
  setProp,
  resetProp,
  displayBackground,
  setBackground,
  isBackgroundOverridden,
  resetBackground,
} = useNodeStyleEditor(node, editMode);

// ─── Row Spacer Name ─────────────────────────────────────────────────────────────────

/**
 * Two-phase name editing:
 * - `rowDisplayName` drives the input's visible value (human-readable while typing)
 * - On blur we convert to snake_case and persist, then save history
 *
 * We use a local `ref` so the input stays responsive while the user types,
 * and we only commit on blur (same UX pattern as Figma / Framer layer names).
 */
const rowDisplayName = computed(() =>
  props.spacer.name ? displayName(props.spacer.name) : "",
);

// Tracks the live input value while the user is actively editing
const nameInputValue = ref<string | null>(null);

/**
 * While typing, keep a local draft. We display `nameInputValue` when set,
 * falling back to the computed `rowDisplayName` when not editing.
 * Because InputText uses :model-value (not v-model), we bind the getter
 * to a unified computed that prefers the draft.
 */
const nameDisplayValue = computed(() =>
  nameInputValue.value !== null ? nameInputValue.value : rowDisplayName.value,
);

const onNameInput = (value: string | undefined) => {
  // Buffer the raw input — don't convert yet so the cursor doesn't jump
  nameInputValue.value = value ?? "";
};

const onNameBlur = () => {
  const trimmed = (nameInputValue.value ?? "").trim();
  if (trimmed) {
    props.spacer.name = toRowName(trimmed);
    saveToHistory("row-spacer-rename");
  }
  // Clear the draft so the field snaps back to the formatted display name
  nameInputValue.value = null;
};

// ─── Background ───────────────────────────────────────────────────────────────

// The picker's value for the current mode. Falls back gracefully if the spacer
// was created before gradient support. setBackground writes the gradient object
// and the plain `backgroundColor` fallback together, in one history step.
const background = computed(() => displayBackground());
</script>
