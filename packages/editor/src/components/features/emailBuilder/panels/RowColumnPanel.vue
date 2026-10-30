<template>
  <div class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <Loading v-if="isBgUploading" message="Uploading image" />

    <!-- Background -->
    <PropertySection title="Background">
      <div>
        <div class="flex items-center justify-between mb-1">
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

      <!-- The image is not a mobile setting; say what happens to it there. -->
      <p
        v-if="editMode === 'mobile' && column.backgroundImage"
        class="text-[11px] text-(--md-text-subtle)"
      >
        This column has a background image. On mobile the image stays and paints
        over the colour, and a gradient is not applied.
      </p>

      <!-- Background Image (desktop only) -->
      <div v-if="editMode === 'desktop'">
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
              <Icon
                name="image"
                class="text-(--md-text-subtle)"
                style="font-size: 16px"
              />
              <span class="text-[9px] text-(--md-text-subtle)"
                >Click to upload</span
              >
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
          <p v-if="bgUploadError" class="text-xs text-(--md-danger)">
            {{ bgUploadError }}
          </p>
        </div>
      </div>

      <!-- Image options (desktop only, and only when image is set) -->
      <template v-if="editMode === 'desktop' && column.backgroundImage">
        <!-- Background Size -->
        <div>
          <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5"
            >Size</label
          >
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
          <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5"
            >Repeat</label
          >
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
          <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5"
            >Position</label
          >
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
        :model-value="displayValue('verticalAlign')"
        :options="verticalAlignOptions"
        placeholder="Search vertical align..."
        :is-overridden="isOverridden('verticalAlign')"
        @update:model-value="setProp('verticalAlign', $event)"
        @reset="resetProp('verticalAlign')"
      />
    </PropertySection>

    <!-- Border -->
    <PropertySection title="Border">
      <div v-if="isBorderOverridden()" class="flex justify-end -mb-1">
        <button
          type="button"
          @click="resetBorder"
          class="text-xs text-(--md-text-subtle) hover:text-(--md-text-muted)"
        >
          Reset All
        </button>
      </div>
      <PropertyNumberSlider
        label="Width (px)"
        :model-value="displayBorderValue('width') ?? 0"
        :min="0"
        :max="100"
        :step="1"
        unit="px"
        :is-overridden="isBorderPropOverridden('width')"
        @update:model-value="setBorderProp('width', $event)"
        @reset="resetBorderProp('width')"
      />
      <PropertyNumberSlider
        label="Border Radius (px)"
        :model-value="displayBorderValue('radius') ?? 0"
        :min="0"
        :max="100"
        :step="1"
        unit="px"
        :is-overridden="isBorderPropOverridden('radius')"
        @update:model-value="setBorderProp('radius', $event)"
        @reset="resetBorderProp('radius')"
      />
      <div class="grid grid-cols-4 gap-2">
        <div class="col-span-2">
          <div class="flex items-center justify-between">
            <label
              class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
            >
              Color <OverrideBadge :show="isBorderPropOverridden('color')" />
            </label>
            <button
              v-if="isBorderPropOverridden('color')"
              type="button"
              @click="resetBorderProp('color')"
              class="text-[11px] text-(--md-selection-fg) hover:opacity-80"
            >
              ↩ Reset
            </button>
          </div>
          <PropertyColor
            label="Color"
            bare
            show-input
            :model-value="displayBorderValue('color') ?? '#000000'"
            @update:model-value="setBorderProp('color', $event)"
          />
        </div>
        <div class="col-span-2">
          <div class="flex items-center justify-between">
            <label
              class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
            >
              Style <OverrideBadge :show="isBorderPropOverridden('style')" />
            </label>
            <button
              v-if="isBorderPropOverridden('style')"
              type="button"
              @click="resetBorderProp('style')"
              class="text-[11px] text-(--md-selection-fg) hover:opacity-80"
            >
              ↩ Reset
            </button>
          </div>
          <Select
            :model-value="displayBorderValue('style') ?? 'solid'"
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
        :model-value="
          editMode === 'mobile'
            ? (column.mobile?.padding ?? null)
            : column.padding
        "
        :desktop-value="column.padding"
        :is-mobile-edit="editMode === 'mobile'"
        @update:model-value="setProp('padding', $event)"
      />
    </PropertySection>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useImageUploader } from "@/composables/system/useImageUpload";
import { useNodeStyleEditor } from "@/composables/emailBuilder/components/useNodeStyleEditor";
import type { EditMode } from "@/composables/emailBuilder/components/useComponentStyleEditor";

import InputText from "@/components/ui/primitives/InputText.vue";
import Select from "@/components/ui/primitives/Select.vue";
import Icon from "@/components/ui/Icon.vue";

import Loading from "@/components/ui/Loading.vue";
import DeviceTabs from "./shared/DeviceTabs.vue";
import OverrideBadge from "./shared/OverrideBadge.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertySelect from "./ui/PropertySelect.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import SpacingControl from "./ui/SpacingControl.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";

// ─── Setup ────────────────────────────────────────────────────────────────────

const { saveToHistory, previewMode } = useEmailBuilder();
const { handleImageUploadFlow, swapOnLoad } = useImageUploader();

const props = defineProps({
  column: { type: Object, required: true },
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

// A column has no `props`: its style sits on the node and its overrides on
// `node.mobile`. The adapter gives it the same API the component panels use.
const node = computed(() => props.column);

const {
  displayValue,
  isOverridden,
  setProp,
  resetProp,
  displayBorderValue,
  setBorderProp,
  isBorderPropOverridden,
  resetBorderProp,
  isBorderOverridden,
  resetBorder,
  displayBackground,
  setBackground,
  isBackgroundOverridden,
  resetBackground,
} = useNodeStyleEditor(node, editMode);

// ─── Background ───────────────────────────────────────────────────────────────

// The picker's value for the current mode. setBackground writes the gradient
// object and the plain `backgroundColor` fallback together, in one history step.
const background = computed(() => displayBackground());

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

const onBorderStyleChange = (value: unknown) => {
  if (typeof value !== "string") return;
  setBorderProp("style", value);
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
