<template>
  <div class="space-y-3">
    <Loading v-if="isBgUploading" message="Uploading image" />

    <!-- Row Name -->
    <PropertySection title="Name">
      <div>
        <label class="block text-xs font-medium text-[var(--md-text-muted)] mb-1.5">
          Row Name
        </label>
        <InputText
          :model-value="nameDisplayValue"
          class="w-full text-xs"
          placeholder="e.g. Hero Section"
          @update:model-value="onNameInput"
          @blur="onNameBlur"
          @keydown.enter="onNameBlur"
        />
        <p class="mt-1 text-[10px] text-[var(--md-text-subtle)] font-mono">
          {{ row.name || "—" }}
        </p>
      </div>
    </PropertySection>

    <!-- Background -->
    <PropertySection title="Background">
      <div>
        <label class="block text-xs font-medium text-[var(--md-text-muted)] mb-1.5"
          >Background Color</label
        >
        <PropertyGradientColor
          :model-value="rowBackground"
          @update:model-value="onBackgroundChange"
        />
      </div>

      <!-- Background Image -->
      <div>
        <label class="block text-xs font-medium text-[var(--md-text-muted)] mb-1.5">
          Background Image
        </label>
        <div class="space-y-2">
          <InputText
            :model-value="row.backgroundImage"
            class="w-full text-xs"
            placeholder="https://example.com/image.jpg"
            @update:model-value="onBackgroundImageInput"
          />

          <div
            class="relative group w-full h-20 border border-[var(--md-border)] rounded-lg overflow-hidden cursor-pointer hover:border-[var(--md-selection)] transition flex items-center justify-center bg-[var(--md-surface-hover)]/30"
            @click="triggerBodyBgUpload"
          >
            <img
              v-if="row.backgroundImage"
              :src="row.backgroundImage"
              class="max-h-full object-contain"
            />
            <div v-else class="flex flex-col items-center gap-1">
              <Icon name="image" class="text-[var(--md-text-subtle)]" style="font-size: 16px" />
              <span class="text-[9px] text-[var(--md-text-subtle)]">Click to upload</span>
            </div>
          </div>
          <input
            ref="bodyBgInput"
            type="file"
            accept="image/*"
            @change="handleBackgroundImageUpload"
            class="hidden"
          />

          <!-- Upload error feedback -->
          <p v-if="bgUploadError" class="text-xs text-[var(--md-danger)]">
            {{ bgUploadError }}
          </p>
        </div>
      </div>

      <!-- Image options (only when image is set) -->
      <template v-if="row.backgroundImage">
        <!-- Background Size -->
        <div>
          <label class="block text-xs font-medium text-[var(--md-text-muted)] mb-1.5"
            >Size</label
          >
          <div class="flex gap-1">
            <button
              v-for="opt in bgSizeOptions"
              :key="opt.value"
              @click="onBgSizeChange(opt.value)"
              class="flex-1 flex flex-col items-center gap-1 px-2 py-1.5 border rounded-md transition-all text-[10px]"
              :class="
                row.backgroundSize === opt.value
                  ? 'border-[var(--md-selection)] bg-[var(--md-surface-hover)] text-[var(--md-text-muted)]'
                  : 'border-[var(--md-border)]/75 text-[var(--md-text-subtle)] hover:border-[var(--md-border)] hover:bg-[var(--md-surface-hover)]'
              "
            >
              <Icon :name="getSizeIcon(opt.value)" style="font-size: 13px" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- Background Repeat -->
        <div class="mt-3">
          <label class="block text-xs font-medium text-[var(--md-text-muted)] mb-1.5"
            >Repeat</label
          >
          <div class="flex gap-1">
            <button
              v-for="opt in bgRepeatOptions"
              :key="opt.value"
              @click="onBgRepeatChange(opt.value)"
              class="flex-1 flex flex-col items-center gap-1 px-0.5 py-1.5 border rounded-md transition-all text-[10px]"
              :class="
                row.backgroundRepeat === opt.value
                  ? 'border-[var(--md-selection)] bg-[var(--md-surface-hover)] text-[var(--md-text-muted)]'
                  : 'border-[var(--md-border)]/75 text-[var(--md-text-subtle)] hover:border-[var(--md-border)] hover:bg-[var(--md-surface-hover)]'
              "
            >
              <Icon :name="getRepeatIcon(opt.value)" style="font-size: 13px" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- Background Position -->
        <div class="mt-3">
          <label class="block text-xs font-medium text-[var(--md-text-muted)] mb-1.5"
            >Position</label
          >
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="pos in backgroundPositions"
              :key="pos.value"
              @click="onBgPositionChange(pos.value)"
              class="px-2 py-1.5 text-sm border rounded-md transition-all flex items-center justify-center"
              :class="
                row.backgroundPosition === pos.value
                  ? 'border-[var(--md-selection)] bg-[var(--md-surface-hover)] text-[var(--md-text-muted)]'
                  : 'border-[var(--md-border)]/75 text-[var(--md-text-subtle)] hover:border-[var(--md-border)] hover:bg-[var(--md-surface-hover)]'
              "
            >
              {{ pos.symbol }}
            </button>
          </div>
        </div>
      </template>
    </PropertySection>

    <!-- Layout -->
    <PropertySection title="Layout">
      <PropertyNumberSlider
        label="Min Height (px)"
        :model-value="row.minHeight"
        :min="0"
        :max="600"
        :step="1"
        unit="px"
        @update:model-value="onMinHeightChange"
      />

      <div v-if="row.columns && row.columns.length > 1">
        <PropertyNumberSlider
          label="Gap (px)"
          :model-value="row.gap"
          :min="0"
          :max="32"
          :step="4"
          unit="px"
          @update:model-value="onGapChange"
        />
      </div>

    </PropertySection>

    <!-- Border -->
    <PropertySection title="Border">
      <PropertyNumberSlider
        label="Width (px)"
        :model-value="row.border.width"
        :min="0"
        :max="100"
        :step="1"
        unit="px"
        @update:model-value="onBorderWidthChange"
      />
      <PropertyNumberSlider
        label="Border Radius (px)"
        :model-value="row.border.radius"
        :min="0"
        :max="100"
        :step="1"
        unit="px"
        @update:model-value="onBorderRadiusChange"
      />
      <div class="grid grid-cols-4 gap-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-[var(--md-text-muted)]">Color</label>
          <PropertyColor
            label="Color"
            bare
            show-input
            :model-value="row.border.color"
            @update:model-value="onBorderColorChange"
          />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-[var(--md-text-muted)]">Style</label>
          <Select
            :model-value="row.border.style"
            :options="borderStyleOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full text-sm capitalize"
            @update:model-value="onBorderStyleChange"
          />
        </div>
      </div>
    </PropertySection>

    <!-- Spacing -->
    <PropertySection title="Spacing">
      <SpacingControl
        label="Padding"
        :model-value="row.padding"
        @update:model-value="onPaddingChange"
      />
    </PropertySection>

    <!-- Visibility -->
    <PropertyVisibility :visibility="row.visibility" />

    <!-- Mobile Settings (multi-column only) -->
    <PropertySection
      v-if="row.columns && row.columns.length > 1"
      title="Mobile Settings"
    >
      <PropertyToggle
        label="Stack Columns on Mobile"
        description="Columns will stack vertically on screens ≤600px"
        :model-value="row.mobileStack"
        active-color="bg-[var(--md-selection)]"
        @update:model-value="onMobileStackChange"
      />
    </PropertySection>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useImageUploader } from "@/composables/system/useImageUpload";
import {
  displayName,
  toRowName,
} from "@/composables/emailBuilder/core/useEmailBuilderOperations";

import InputText from "@/components/ui/primitives/InputText.vue";
import Select from "@/components/ui/primitives/Select.vue";
import Icon from "@/components/ui/Icon.vue";

import Loading from "@/components/ui/Loading.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import SpacingControl from "./ui/SpacingControl.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";



// ─── Types ────────────────────────────────────────────────────────────────────

interface BackgroundValue {
  useGradient: boolean;
  solid: string;
  gradient: {
    type: "linear" | "radial";
    direction: string;
    colors: { color: string; position: number }[];
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const { saveToHistory } = useEmailBuilder();
const { handleImageUploadFlow, swapOnLoad } = useImageUploader();

const props = defineProps({
  row: { type: Object, required: true },
});

// ─── Row Name ─────────────────────────────────────────────────────────────────

/**
 * Two-phase name editing:
 * - `rowDisplayName` drives the input's visible value (human-readable while typing)
 * - On blur we convert to snake_case and persist, then save history
 *
 * We use a local `ref` so the input stays responsive while the user types,
 * and we only commit on blur (same UX pattern as Figma / Framer layer names).
 */
const rowDisplayName = computed(() =>
  props.row.name ? displayName(props.row.name) : "",
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
    props.row.name = toRowName(trimmed);
    saveToHistory("row-rename");
  }
  // Clear the draft so the field snaps back to the formatted display name
  nameInputValue.value = null;
};

// ─── Background ───────────────────────────────────────────────────────────────

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
 * getSolid is inlined inside the computed so it stays reactive.
 */
const rowBackground = computed<BackgroundValue>(() => {
  const bg = props.row.backgroundGradient;

  // Resolve solid colour reactively (was previously a plain function called outside computed)
  const solid = (() => {
    if (bg?.solid && bg.solid !== "transparent") return bg.solid;
    if (
      props.row.backgroundColor &&
      props.row.backgroundColor !== "transparent"
    ) {
      return props.row.backgroundColor;
    }
    return "transparent";
  })();

  return {
    useGradient: bg?.useGradient ?? false,
    solid,
    gradient: {
      ...DEFAULT_GRADIENT,
      ...(bg?.gradient ?? {}),
    },
  };
});

/**
 * Persist the BackgroundValue back onto the row.
 * Keeps `backgroundColor` in sync as a plain-CSS fallback for the export.
 */
const onBackgroundChange = (value: BackgroundValue) => {
  props.row.backgroundGradient = value;
  props.row.backgroundColor = value.useGradient
    ? (value.gradient.colors[0]?.color ?? value.solid)
    : value.solid;
  saveToHistory("row-background");
};

// ─── Inline prop mutation handlers (each calls saveToHistory) ─────────────────

const onBackgroundImageInput = (value: string) => {
  props.row.backgroundImage = value;
  saveToHistory("row-bg-image");
};

const onBgSizeChange = (value: string) => {
  props.row.backgroundSize = value;
  saveToHistory("row-bg-size");
};

const onBgRepeatChange = (value: string) => {
  props.row.backgroundRepeat = value;
  saveToHistory("row-bg-repeat");
};

const onBgPositionChange = (value: string) => {
  props.row.backgroundPosition = value;
  saveToHistory("row-bg-position");
};

const onMinHeightChange = (value: number) => {
  props.row.minHeight = value;
  saveToHistory("row-min-height");
};

const onGapChange = (value: number) => {
  props.row.gap = value;
  saveToHistory("row-gap");
};

const onBorderWidthChange = (value: number) => {
  props.row.border.width = value;
  saveToHistory("row-border-width");
};

const onBorderRadiusChange = (value: number) => {
  props.row.border.radius = value;
  saveToHistory("row-border-radius");
};

const onBorderColorChange = (value: string) => {
  props.row.border.color = value;
  saveToHistory("row-border-color");
};

const onBorderStyleChange = (value: unknown) => {
  if (typeof value !== "string") return;
  props.row.border.style = value;
  saveToHistory("row-border-style");
};

const onPaddingChange = (value: any) => {
  props.row.padding = value;
  saveToHistory("row-padding");
};

const onMobileStackChange = (value: boolean) => {
  props.row.mobileStack = value;
  saveToHistory("row-mobile-stack");
};

// ─── Background image upload ──────────────────────────────────────────────────

const bodyBgInput = ref<HTMLInputElement | null>(null);
const isBgUploading = ref(false);
const bgUploadError = ref<string | null>(null);

const triggerBodyBgUpload = () => bodyBgInput.value?.click();

const handleBackgroundImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Capture previous URL so we can restore it on failure.
  const previousUrl = props.row.backgroundImage as string;

  isBgUploading.value = true;
  bgUploadError.value = null;

  await handleImageUploadFlow(
    file,
    (objectUrl) => {
      props.row.backgroundImage = objectUrl;
    },
    (permanentUrl, cleanup) => {
      swapOnLoad(
        permanentUrl,
        () => {
          props.row.backgroundImage = permanentUrl;
          saveToHistory("bg-row-img-upload");
        },
        cleanup,
      );
    },
    (message) => {
      bgUploadError.value = message;
      // Restore the original image instead of blanking it.
      props.row.backgroundImage = previousUrl;
    },
  );

  isBgUploading.value = false;
  if (bodyBgInput.value) bodyBgInput.value.value = "";
};

// ─── Options ──────────────────────────────────────────────────────────────────

const bgSizeOptions = [
  { label: "Cover", value: "cover" },
  { label: "Contain", value: "contain" },
  { label: "Auto", value: "auto" },
];

const bgRepeatOptions = [
  { label: "No Repeat", value: "no-repeat" },
  { label: "Repeat", value: "repeat" },
  { label: "X", value: "repeat-x" },
  { label: "Y", value: "repeat-y" },
];

const borderStyleOptions = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
];

const backgroundPositions = [
  { value: "top left", symbol: "↖" },
  { value: "top center", symbol: "↑" },
  { value: "top right", symbol: "↗" },
  { value: "center left", symbol: "←" },
  { value: "center center", symbol: "●" },
  { value: "center right", symbol: "→" },
  { value: "bottom left", symbol: "↙" },
  { value: "bottom center", symbol: "↓" },
  { value: "bottom right", symbol: "↘" },
];

const getSizeIcon = (value: string) => {
  const icons: Record<string, string> = {
    cover: "arrows-alt",
    contain: "arrow-right",
    auto: "circle",
  };
  return icons[value] || "circle";
};

const getRepeatIcon = (value: string) => {
  const icons: Record<string, string> = {
    "no-repeat": "circle",
    repeat: "th-large",
    "repeat-x": "arrow-right",
    "repeat-y": "arrow-down",
  };
  return icons[value] || "circle";
};
</script>
