<template>
  <div class="space-y-3">
    <Loading v-if="isBgUploading" message="Uploading image" />

    <!-- Background -->
    <PropertySection title="Background">
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1">Background Color</label>
        <PropertyGradientColor
          :model-value="columnBackground"
          @update:model-value="onBackgroundChange"
        />
      </div>

      <!-- Background Image -->
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5">
          Background Image
        </label>
        <div class="space-y-2">
          <InputText
            :model-value="column.backgroundImage"
            class="w-full text-xs"
            placeholder="https://example.com/image.jpg"
            @update:model-value="onBackgroundImageInput"
          />

          <div
            class="relative group w-full h-20 border border-(--md-border) rounded-lg overflow-hidden cursor-pointer hover:border-(--md-selection) transition flex items-center justify-center bg-(--md-surface-hover)/30"
            @click="triggerBodyBgUpload"
          >
            <img
              v-if="column.backgroundImage"
              :src="column.backgroundImage"
              class="max-h-full object-contain"
            />
            <div v-else class="flex flex-col items-center gap-1">
              <Icon name="image" class="text-(--md-text-subtle)" style="font-size: 16px" />
              <span class="text-[9px] text-(--md-text-subtle)">Click to upload</span>
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
          <p v-if="bgUploadError" class="text-xs text-(--md-danger)">{{ bgUploadError }}</p>
        </div>
      </div>

      <!-- Image options (only when image is set) -->
      <template v-if="column.backgroundImage">
        <!-- Background Size -->
        <div>
          <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5">Size</label>
          <div class="flex gap-1">
            <button
              v-for="opt in bgSizeOptions"
              :key="opt.value"
              @click="onBgSizeChange(opt.value)"
              class="flex-1 flex flex-col items-center gap-1 px-2 py-1.5 border rounded-md transition-all text-[10px]"
              :class="
                column.backgroundSize === opt.value
                  ? 'border-(--md-selection) bg-(--md-surface-hover) text-(--md-text-muted)'
                  : 'border-(--md-border)/75 text-(--md-text-subtle) hover:border-(--md-border) hover:bg-(--md-surface-hover)'
              "
            >
              <Icon :name="getSizeIcon(opt.value)" style="font-size: 13px" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- Background Repeat -->
        <div class="mt-3">
          <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5">Repeat</label>
          <div class="flex gap-1">
            <button
              v-for="opt in bgRepeatOptions"
              :key="opt.value"
              @click="onBgRepeatChange(opt.value)"
              class="flex-1 flex flex-col items-center gap-1 px-0.5 py-1.5 border rounded-md transition-all text-[10px]"
              :class="
                column.backgroundRepeat === opt.value
                  ? 'border-(--md-selection) bg-(--md-surface-hover) text-(--md-text-muted)'
                  : 'border-(--md-border)/75 text-(--md-text-subtle) hover:border-(--md-border) hover:bg-(--md-surface-hover)'
              "
            >
              <Icon :name="getRepeatIcon(opt.value)" style="font-size: 13px" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- Background Position -->
        <div class="mt-3">
          <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5">Position</label>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="pos in backgroundPositions"
              :key="pos.value"
              @click="onBgPositionChange(pos.value)"
              class="px-2 py-1.5 text-sm border rounded-md transition-all flex items-center justify-center"
              :class="
                column.backgroundPosition === pos.value
                  ? 'border-(--md-selection) bg-(--md-surface-hover) text-(--md-text-muted)'
                  : 'border-(--md-border)/75 text-(--md-text-subtle) hover:border-(--md-border) hover:bg-(--md-surface-hover)'
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
      <PropertySelect
        label="Vertical Align"
        :model-value="column.verticalAlign"
        :options="verticalAlignOptions"
         placeholder="Search vertical align..."
        @update:model-value="onVerticalAlignChange"
      />
    </PropertySection>

    <!-- Border -->
    <PropertySection title="Border">
      <PropertyNumberSlider
        label="Width (px)"
        :model-value="column.border.width"
        :min="0"
        :max="100"
        :step="1"
        unit="px"
        @update:model-value="onBorderWidthChange"
      />
      <PropertyNumberSlider
        label="Border Radius (px)"
        :model-value="column.border.radius"
        :min="0"
        :max="100"
        :step="1"
        unit="px"
        @update:model-value="onBorderRadiusChange"
      />
      <div class="grid grid-cols-4 gap-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-(--md-text-muted)">Color</label>
          <PropertyColor
            label="Color"
            bare
            show-input
            :model-value="column.border.color"
            @update:model-value="onBorderColorChange"
          />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-(--md-text-muted)">Style</label>
          <Select
            :model-value="column.border.style"
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
        :model-value="column.padding"
        @update:model-value="onPaddingChange"
      />
    </PropertySection>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useImageUploader } from "@/composables/system/useImageUpload";

import InputText from "@/components/ui/primitives/InputText.vue";
import Select from "@/components/ui/primitives/Select.vue";
import Icon from "@/components/ui/Icon.vue";

import Loading from "@/components/ui/Loading.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertySelect from "./ui/PropertySelect.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import SpacingControl from "./ui/SpacingControl.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";



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
  column: { type: Object, required: true },
});

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
const columnBackground = computed<BackgroundValue>(() => {
  const bg = props.column.backgroundGradient;

  // Resolve solid colour reactively (was previously a plain function called outside computed)
  const solid = (() => {
    if (bg?.solid && bg.solid !== "transparent") return bg.solid;
    if (
      props.column.backgroundColor &&
      props.column.backgroundColor !== "transparent"
    ) {
      return props.column.backgroundColor;
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
 * Persist the BackgroundValue back onto the column.
 * Keeps backgroundColor in sync as a plain-CSS fallback for the HTML exporter.
 */
const onBackgroundChange = (value: BackgroundValue) => {
  props.column.backgroundGradient = value;
  props.column.backgroundColor = value.useGradient
    ? (value.gradient.colors[0]?.color ?? value.solid)
    : value.solid;
  saveToHistory("column-background");
};

// ─── Inline prop mutation handlers (each calls saveToHistory) ─────────────────

const onBackgroundImageInput = (value: string) => {
  props.column.backgroundImage = value;
  saveToHistory("column-bg-image");
};

const onBgSizeChange = (value: string) => {
  props.column.backgroundSize = value;
  saveToHistory("column-bg-size");
};

const onBgRepeatChange = (value: string) => {
  props.column.backgroundRepeat = value;
  saveToHistory("column-bg-repeat");
};

const onBgPositionChange = (value: string) => {
  props.column.backgroundPosition = value;
  saveToHistory("column-bg-position");
};

const onVerticalAlignChange = (value: string) => {
  props.column.verticalAlign = value;
  saveToHistory("column-vertical-align");
};

const onBorderWidthChange = (value: number) => {
  props.column.border.width = value;
  saveToHistory("column-border-width");
};

const onBorderRadiusChange = (value: number) => {
  props.column.border.radius = value;
  saveToHistory("column-border-radius");
};

const onBorderColorChange = (value: string) => {
  props.column.border.color = value;
  saveToHistory("column-border-color");
};

const onBorderStyleChange = (value: unknown) => {
  props.column.border.style = value as string;
  saveToHistory("column-border-style");
};

const onPaddingChange = (value: any) => {
  props.column.padding = value;
  saveToHistory("column-padding");
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
  const previousUrl = props.column.backgroundImage as string;

  isBgUploading.value = true;
  bgUploadError.value = null;

  await handleImageUploadFlow(
    file,
    (objectUrl) => {
      props.column.backgroundImage = objectUrl;
    },
    (permanentUrl, cleanup) => {
      swapOnLoad(
        permanentUrl,
        () => {
          props.column.backgroundImage = permanentUrl;
          saveToHistory("column-bg-img-upload");
        },
        cleanup,
      );
    },
    (message) => {
      bgUploadError.value = message;
      // Restore the original image instead of blanking it.
      props.column.backgroundImage = previousUrl;
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

const verticalAlignOptions = [
  { label: "Top", value: "top" },
  { label: "Middle", value: "middle" },
  { label: "Bottom", value: "bottom" },
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