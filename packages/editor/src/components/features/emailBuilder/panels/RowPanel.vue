<template>
  <div class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <Loading v-if="isBgUploading" message="Uploading image" />

    <!-- Row Name (desktop only: a name is not a per-device setting) -->
    <PropertySection v-if="editMode === 'desktop'" title="Name">
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5">
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
        <p class="mt-1 text-[10px] text-(--md-text-subtle) font-mono">
          {{ row.name || "—" }}
        </p>
      </div>
    </PropertySection>

    <!-- Background -->
    <PropertySection title="Background">
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

      <!-- The image is not a mobile setting; say what happens to it there. -->
      <p
        v-if="editMode === 'mobile' && row.backgroundImage"
        class="text-[11px] text-(--md-text-subtle)"
      >
        This row has a background image. On mobile the image stays and paints
        over the colour, and a gradient is not applied.
      </p>

      <!-- Background Image (desktop only) -->
      <div v-if="editMode === 'desktop'">
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1.5">
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
            class="relative group w-full h-20 border border-(--md-border) rounded-lg overflow-hidden cursor-pointer hover:border-(--md-selection) transition flex items-center justify-center bg-(--md-surface-hover)/30"
            @click="triggerBodyBgUpload"
          >
            <img
              v-if="row.backgroundImage"
              :src="row.backgroundImage"
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
      <template v-if="editMode === 'desktop' && row.backgroundImage">
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
                row.backgroundSize === opt.value
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
                row.backgroundRepeat === opt.value
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
                row.backgroundPosition === pos.value
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
      <PropertyNumberSlider
        label="Min Height (px)"
        :model-value="displayValue('minHeight')"
        :min="0"
        :max="600"
        :step="1"
        unit="px"
        :is-overridden="isOverridden('minHeight')"
        @update:model-value="setProp('minHeight', $event)"
        @reset="resetProp('minHeight')"
      />

      <div v-if="gapEditable">
        <PropertyNumberSlider
          label="Gap (px)"
          :model-value="displayValue('gap')"
          :min="0"
          :max="32"
          :step="4"
          unit="px"
          :is-overridden="isOverridden('gap')"
          @update:model-value="setProp('gap', $event)"
          @reset="resetProp('gap')"
        />
      </div>
      <p v-else-if="gapHint" class="text-[11px] text-(--md-text-subtle)">
        {{ gapHint }}
      </p>
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
          editMode === 'mobile' ? (row.mobile?.padding ?? null) : row.padding
        "
        :desktop-value="row.padding"
        :is-mobile-edit="editMode === 'mobile'"
        @update:model-value="setProp('padding', $event)"
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
        active-color="bg-(--md-selection)"
        @update:model-value="onMobileStackChange"
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
import {
  displayName,
  toRowName,
} from "@/composables/emailBuilder/core/useEmailBuilderOperations";

import InputText from "@/components/ui/primitives/InputText.vue";
import Select from "@/components/ui/primitives/Select.vue";
import Icon from "@/components/ui/Icon.vue";

import Loading from "@/components/ui/Loading.vue";
import DeviceTabs from "./shared/DeviceTabs.vue";
import OverrideBadge from "./shared/OverrideBadge.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import SpacingControl from "./ui/SpacingControl.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";

// ─── Setup ────────────────────────────────────────────────────────────────────

const { saveToHistory, previewMode } = useEmailBuilder();
const { handleImageUploadFlow, swapOnLoad } = useImageUploader();

const props = defineProps({
  row: { type: Object, required: true },
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

// A row has no `props`: its style sits on the node and its overrides on
// `node.mobile`. The adapter gives it the same API the component panels use.
const node = computed(() => props.row);

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

// The picker's value for the current mode. setBackground writes the gradient
// object and the plain `backgroundColor` fallback together, in one history step.
const background = computed(() => displayBackground());

// ─── Gap ──────────────────────────────────────────────────────────────────────

// The gap is the cell between two columns. When the columns stack on mobile it
// becomes a spacer between them, and the email only has that cell when the
// desktop gap is above zero. So the mobile gap is editable only then; the
// override is kept, but not drawn, while the row does not stack.
const hasSeveralColumns = computed(() => (props.row.columns?.length ?? 0) > 1);

const gapEditable = computed(() => {
  if (!hasSeveralColumns.value) return false;
  if (editMode.value === "desktop") return true;
  return !!props.row.mobileStack && (props.row.gap ?? 0) > 0;
});

const gapHint = computed(() => {
  if (editMode.value !== "mobile" || !hasSeveralColumns.value) return "";
  if (!props.row.mobileStack) {
    return "The mobile gap applies when the columns stack. Turn on “Stack Columns on Mobile” below to set it.";
  }
  if ((props.row.gap ?? 0) <= 0) {
    return "This row has no gap on desktop, so there is no gap to change on mobile. Set a desktop gap first.";
  }
  return "";
});

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

const onBorderStyleChange = (value: unknown) => {
  if (typeof value !== "string") return;
  setBorderProp("style", value);
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
