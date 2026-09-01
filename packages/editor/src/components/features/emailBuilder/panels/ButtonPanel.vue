<template>
  <div v-if="component" class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <!-- Content (desktop only) -->
    <PropertySection v-if="editMode === 'desktop'" title="Content">
      <!-- Button text -->
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1">
          Button Text
        </label>
        <div class="relative">
          <InputText
            ref="textInputRef"
            class="w-full"
            :model-value="component.props.text"
            @update:model-value="onTextInput"
            @click="trackCursor('text', $event)"
            @keyup="trackCursor('text', $event)"
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

      <LinkFieldMergeTags
        :last-focused-field="lastFocusedField"
        :default-tags="buttonDefaultTags"
        @insert="handleTagInsert"
        @focus="lastFocusedField = $event"
      />

      <!-- ── Icon ───────────────────────────────────────────────────── -->
      <div class="pt-3 border-t border-(--md-border)">
        <label class="block text-xs font-medium text-(--md-text-muted) mb-2">
          Button Icon
        </label>

        <!-- Preview + clear -->
        <div
          v-if="component.props.icon"
          class="flex items-center gap-2 mb-2 px-2 py-1.5 bg-[var(--md-surface-hover)] border border-(--md-border) rounded"
        >
          <div class="w-6 h-6 overflow-hidden bg-(--md-surface) shrink-0">
            <img
              :src="component.props.icon"
              alt="icon preview"
              class="w-full h-full object-contain"
              @error="component.props.icon = ''"
            />
          </div>
          <span class="text-[10px] text-(--md-text-subtle) truncate flex-1">
            {{
              component.props.icon.startsWith("data:")
                ? "✓ Image uploaded"
                : component.props.icon
            }}
          </span>
          <button
            @click="onIconClear"
            class="text-(--md-text-subtle) hover:text-(--md-danger) text-xs shrink-0"
            title="Remove icon"
          >
            <Icon name="times" style="font-size: 8px" />
          </button>
        </div>

        <!-- URL input -->
        <InputText
          type="url"
          :model-value="component.props.icon"
          @update:model-value="onIconUrlInput"
          placeholder="Paste icon URL…"
          class="w-full text-xs mb-2"
        />

        <!-- Upload button -->
        <button
          type="button"
          :disabled="isIconUploading"
          @click="openIconPicker"
          class="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] border border-dashed border-(--md-border) rounded hover:border-(--md-selection) hover:bg-(--md-selection-bg) hover:text-(--md-selection-fg) text-(--md-text-subtle) transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          <span
            v-if="isIconUploading"
            name="spinner"
            class="animate-spin"
            style="font-size: 10px"
          />
          <Icon v-else name="image" style="font-size: 10px" />
          {{ isIconUploading ? "Uploading…" : "Click to upload icon image" }}
        </button>

        <!-- Icon-only controls — hidden when no icon is set -->
        <template v-if="component.props.icon">
          <!-- Alt text (accessibility) -->
          <div class="mb-3">
            <label
              class="text-xs font-medium text-(--md-text-muted) mb-1 block"
            >
              Alt Text
              <span class="text-(--md-text-subtle) font-normal"
                >(leave empty if decorative)</span
              >
            </label>
            <InputText
              :model-value="component.props.iconAlt"
              @update:model-value="onIconAltInput"
              placeholder="e.g. Arrow icon"
              class="w-full text-xs"
            />
          </div>

          <!-- Position: Before / After -->
          <div class="mb-3">
            <label
              class="text-xs font-medium text-(--md-text-muted) mb-1.5 block"
              >Icon Position</label
            >
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="pos in iconPositionOptions"
                :key="pos.value"
                type="button"
                @click="onIconPositionChange(pos.value)"
                class="flex items-center justify-center gap-1 py-1 text-xs rounded border transition-colors"
                :class="
                  component.props.iconPosition === pos.value
                    ? 'bg-(--md-selection-bg) border-(--md-selection) text-(--md-selection-fg) font-medium'
                    : 'border-(--md-border) text-(--md-text-subtle) hover:border-(--md-border-strong)'
                "
              >
                <Icon :name="pos.icon" style="font-size: 10px" />
                {{ pos.label }}
              </button>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <!-- Icon Size -->
            <PropertyNumberSlider
              label="Icon Size"
              :model-value="component.props.iconSize"
              :min="12"
              :max="64"
              :step="1"
              unit="px"
              @update:model-value="onIconSizeChange"
            />

            <!-- Gap between icon and text -->
            <PropertyNumberSlider
              label="Icon Gap"
              :model-value="component.props.iconGap"
              :min="0"
              :max="32"
              :step="1"
              unit="px"
              @update:model-value="onIconGapChange"
            />
          </div>
        </template>
      </div>
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
        placeholder="Search weight..."
        :is-overridden="isOverridden('fontWeight')"
        @update:model-value="setProp('fontWeight', $event)"
        @reset="resetProp('fontWeight')"
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

    <!-- Appearance -->
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

    <!-- Layout -->
    <PropertySection title="Layout">
      <PropertyAlignment
        :model-value="displayValue('align')"
        :is-overridden="isOverridden('align')"
        @update:model-value="setProp('align', $event)"
        @reset="resetProp('align')"
      />

      <!-- min=0: sharp corners (0 px radius) are a valid design choice -->
      <PropertyNumberSlider
        label="Border Radius (px)"
        :model-value="displayValue('borderRadius')"
        :min="0"
        :max="100"
        :step="1"
        unit="px"
        :is-overridden="isOverridden('borderRadius')"
        @update:model-value="setProp('borderRadius', $event)"
        @reset="resetProp('borderRadius')"
      />
    </PropertySection>

    <!-- Border -->
    <PropertySection title="Border">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-medium text-(--md-text-muted) italic"
          >Mobile override</span
        >
        <button
          v-if="isBorderOverridden()"
          @click="resetBorder"
          class="text-xs text-(--md-text-subtle) hover:text-(--md-text-muted)"
        >
          Reset All
        </button>
      </div>

      <PropertyNumberSlider
        label="Width"
        :model-value="displayBorderValue('width') ?? 0"
        @update:model-value="setBorderProp('width', $event)"
        @reset="resetBorderProp('width')"
        :is-overridden="isBorderPropOverridden('width')"
        :min="0"
        :max="10"
        :step="1"
        unit="px"
      />

      <div class="grid grid-cols-2 gap-3">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label
              class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
            >
              Color
              <OverrideBadge :show="isBorderPropOverridden('color')" />
            </label>
            <button
              v-if="isBorderPropOverridden('color')"
              @click="resetBorderProp('color')"
              class="text-xs text-(--md-selection-fg) hover:opacity-80"
            >
              Reset
            </button>
          </div>
          <PropertyColor
            bare
            show-input
            :model-value="displayBorderValue('color') ?? '#111111'"
            @update:model-value="setBorderProp('color', $event)"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label
              class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
            >
              Style
              <OverrideBadge :show="isBorderPropOverridden('style')" />
            </label>
            <button
              v-if="isBorderPropOverridden('style')"
              @click="resetBorderProp('style')"
              class="text-xs text-(--md-selection-fg) hover:opacity-80"
            >
              Reset
            </button>
          </div>
          <Select
            :model-value="displayBorderValue('style') ?? 'solid'"
            @update:model-value="setBorderProp('style', $event)"
            :options="borderStyleOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select style"
            class="w-full text-sm capitalize"
            :class="{
              'ring-1 ring-(--md-selection) rounded':
                isBorderPropOverridden('style'),
            }"
          />
        </div>
      </div>
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
import { ref, shallowRef, onUnmounted, computed, watch } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useGoogleFonts } from "@/composables/system/useGoogleFonts";
import { useComponentStyleEditor } from "@/composables/emailBuilder/components/useComponentStyleEditor";
import { useLinkTagInsert } from "@/composables/emailBuilder/core/link-tags/useLinkTagInsert";
import { resolveString } from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";
import { useImageUploader } from "@/composables/system/useImageUpload";

import InputText from "@/components/ui/primitives/InputText.vue";
import Select from "@/components/ui/primitives/Select.vue";
import Icon from "@/components/ui/Icon.vue";

import OverrideBadge from "./shared/OverrideBadge.vue";
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
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";

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
const { handleImageUploadFlow, swapOnLoad } = useImageUploader();

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

// ─── Defaults backfill ────────────────────────────────────────────────────────
// Ensures older documents (saved before a field existed) get the new fields
// without needing a migration script. Runs whenever the selected component
// changes.

watch(
  component,
  (comp) => {
    if (!comp) return;

    // Icon defaults — backfill for documents saved before icon feature existed
    if (comp.props.icon === undefined) comp.props.icon = "";
    if (comp.props.iconAlt === undefined) comp.props.iconAlt = "";
    if (comp.props.iconPosition === undefined)
      comp.props.iconPosition = "before";
    if (comp.props.iconSize === undefined) comp.props.iconSize = 20;
    if (comp.props.iconGap === undefined) comp.props.iconGap = 8;
  },
  { immediate: true },
);

const {
  displayValue,
  isOverridden,
  setProp,
  resetProp,
  displayBorderValue,
  setBorderProp,
  isBorderOverridden,
  resetBorder,
  displayBackground,
  setBackground,
  isBackgroundOverridden,
  resetBackground,
  toggleDesktopHide,
  toggleMobileHide,
} = useComponentStyleEditor(component, editMode);

watch(
  () => displayValue("fontFamily"),
  (font) => loadGoogleFont(font),
  { immediate: true },
);

// ─── Props mutation handlers (each calls saveToHistory) ─────────────────

const onTextInput = (value: string) => {
  component.value!.props.text = value.trim();
  saveToHistory("anchor-text");
};

const onUrlInput = (value: string) => {
  component.value!.props.link = value.trim();
  saveToHistory("anchor-url");
};

// ─── Icon handlers ────────────────────────────────────────────────────────────

const isIconUploading = ref(false);
const bodyFileInput = shallowRef<HTMLInputElement | null>(null);

const onIconUrlInput = (value: string) => {
  component.value!.props.icon = value.trim();
  saveToHistory("button-icon-url");
};

const onIconAltInput = (value: string) => {
  component.value!.props.iconAlt = value;
  saveToHistory("button-icon-alt");
};

const onIconClear = () => {
  component.value!.props.icon = "";
  saveToHistory("button-icon-clear");
};

const onIconPositionChange = (value: "before" | "after") => {
  component.value!.props.iconPosition = value;
  saveToHistory("icon-position");
};

const onIconSizeChange = (value: number) => {
  component.value!.props.iconSize = value;
  saveToHistory("icon-size");
};

const onIconGapChange = (value: number) => {
  component.value!.props.iconGap = value;
  saveToHistory("icon-gap");
};

const ensureBodyInput = (): HTMLInputElement => {
  if (bodyFileInput.value) return bodyFileInput.value;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    isIconUploading.value = true;

    await handleImageUploadFlow(
      file,
      // Optimistic preview with object URL
      (objectUrl) => {
        component.value!.props.icon = objectUrl;
      },
      // Swap to permanent URL once loaded
      (permanentUrl, cleanup) => {
        swapOnLoad(
          permanentUrl,
          () => {
            component.value!.props.icon = permanentUrl;
            saveToHistory("button-icon-upload");
          },
          cleanup,
        );
      },
      // Error
      () => {
        component.value!.props.icon = "";
      },
    );

    isIconUploading.value = false;
  });

  document.body.appendChild(input);
  bodyFileInput.value = input;
  return input;
};

const openIconPicker = () => ensureBodyInput().click();

onUnmounted(() => {
  bodyFileInput.value?.remove();
  bodyFileInput.value = null;
});

// ── Static options ────────────────────────────────────────────────────────────

const iconPositionOptions = [
  { value: "before" as const, label: "Before", icon: "arrow-left" },
  { value: "after" as const, label: "After", icon: "arrow-right" },
];

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

const buttonDefaultTags = [
  "confirmation_url",
  "reset_token",
  "unsubscribe_link",
  "referral_link",
  "first_name",
];

const fontWeightOptions = [
  { label: "Normal", value: "normal" },
  { label: "Medium", value: "medium" },
  { label: "Bold", value: "bold" },
];

const borderStyleOptions = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
];

// ─── Border override helpers (with null guards) ───────────────────────────────

type BorderProp = Parameters<typeof setBorderProp>[0];

const isBorderPropOverridden = (prop: BorderProp): boolean => {
  const desktopValue = component.value?.props.border?.[prop];
  const mobileValue = component.value?.props.mobile?.border?.[prop];
  if (editMode.value === "mobile") {
    return mobileValue !== undefined && mobileValue !== desktopValue;
  }
  return false;
};

const resetBorderProp = (prop: BorderProp) => {
  const desktopValue = component.value?.props.border?.[prop];
  setBorderProp(prop, desktopValue);
};
</script>
