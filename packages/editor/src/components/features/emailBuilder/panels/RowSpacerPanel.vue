<template>
  <div class="space-y-3">
     <!-- Row Name -->
    <PropertySection title="Name">
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
        :model-value="spacer.height"
        :min="1"
        :max="600"
        :step="5"
        unit="px"
        @update:model-value="updateHeight"
      />

      <!-- Solid / Gradient picker (replaces plain PropertyColor) -->
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5"
          >Background Color</label
        >
        <PropertyGradientColor
          :model-value="spacerBackground"
          @update:model-value="onBackgroundChange"
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
import {
  displayName,
  toRowName,
} from "@/composables/emailBuilder/core/useEmailBuilderOperations";

import InputText from "@/components/ui/primitives/InputText.vue";

import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";

const { saveToHistory } = useEmailBuilder();

const props = defineProps({
  spacer: { type: Object, required: true },
});

const updateHeight = (value: number) => {
  props.spacer.height = value;
  saveToHistory("spacer-height");
};

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
// ─── Types ───

interface BackgroundValue {
  useGradient: boolean;
  solid: string;
  gradient: {
    type: "linear" | "radial";
    direction: string;
    colors: { color: string; position: number }[];
  };
}

const DEFAULT_GRADIENT = {
  type: "linear" as const,
  direction: "to right",
  colors: [
    { color: "#ffffff", position: 0 },
    { color: "#eeeeee", position: 100 },
  ],
};

/**
 * Build the BackgroundValue the GradientPicker expects.
 * Falls back gracefully if the spacer was created before gradient support.
 */

 const getSolid = () => {
  const bg = props.spacer.backgroundGradient;

  if (bg?.solid && bg.solid !== "transparent") return bg.solid;

  if (
    props.spacer.backgroundColor &&
    props.spacer.backgroundColor !== "transparent"
  ) {
    return props.spacer.backgroundColor;
  }

  return "transparent";
};

const spacerBackground = computed<BackgroundValue>(() => {
  const bg = props.spacer.backgroundGradient;

  return {
    useGradient: bg?.useGradient ?? false,
    solid: getSolid(),
    gradient: {
      ...DEFAULT_GRADIENT,
      ...(bg?.gradient ?? {}),
    },
  };
});

/**
 * Persist the BackgroundValue back onto the spacer.
 * Keeps `backgroundColor` in sync as a plain-CSS fallback for the export.
 */
const onBackgroundChange = (value: BackgroundValue) => {
  props.spacer.backgroundGradient = value;

  // Sync the solid fallback used by the HTML exporter
  props.spacer.backgroundColor = value.useGradient
    ? (value.gradient.colors[0]?.color ?? value.solid)
    : value.solid;

  saveToHistory("spacer-background");
};
</script>
