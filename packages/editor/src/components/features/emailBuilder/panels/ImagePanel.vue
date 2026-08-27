<template>
  <div v-if="component" class="space-y-3">
    <Loading v-if="isUploading" message="Uploading image" />

    <DeviceTabs v-model="editMode" />

    <!-- Source (desktop only) -->
    <PropertySection v-if="editMode === 'desktop'" title="Image Source">
      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1"
          >Image URL</label
        >
        <InputText
          ref="srcInputRef"
          class="w-full mb-2"
          placeholder="https://example.com/image.jpg or {{ image_url }}"
          @click="trackCursor('src', $event)"
          :model-value="component.props.src"
          @update:model-value="onSrcInput"
          @keyup="trackCursor('src', $event)"
        />
        <PreviewBadge
          :active="linkTagPreviewActive"
          :resolved="resolvedSrc"
          :raw="component.props.src"
        />

        <div
          class="relative group w-full h-20 border border-(--md-border) rounded-lg overflow-hidden cursor-pointer hover:border-(--md-selection) transition flex items-center justify-center bg-(--md-surface-hover)/30"
          @click="triggerImageUpload"
        >
          <img
            v-if="resolvedSrc"
            :src="resolvedSrc"
            class="max-h-full object-contain"
          />
          <span v-else class="text-xs text-(--md-text-subtle)"
            >Click to upload image</span
          >
        </div>
        <input
          ref="imageInput"
          type="file"
          accept="image/*"
          @change="handleImageUpload"
          class="hidden"
        />

        <!-- Upload error feedback -->
        <p v-if="uploadError" class="mt-1 text-xs text-(--md-danger)">
          {{ uploadError }}
        </p>
      </div>

      <div>
        <label class="block text-xs font-medium text-(--md-text-muted) mb-1"
          >Alt Text</label
        >
        <InputText
          ref="altInputRef"
          class="w-full"
          placeholder="Descriptive alt text or {{ alt_text }}"
          :model-value="component.props.alt"
          @update:model-value="onAltInput"
          @click="trackCursor('alt', $event)"
          @keyup="trackCursor('alt', $event)"
        />
        <PreviewBadge
          :active="linkTagPreviewActive"
          :resolved="resolvedAlt"
          :raw="component.props.alt"
        />
      </div>

      <LinkFieldMergeTags
        :last-focused-field="lastFocusedField"
        :default-tags="imageDefaultTags"
        :available-fields="['src', 'alt']"
        :field-labels="{ src: 'Image URL', alt: 'Alt Text' }"
        @insert="handleTagInsert"
        @focus="lastFocusedField = $event"
      />
    </PropertySection>

    <!-- Link (desktop only) -->
    <PropertySection v-if="editMode === 'desktop'" title="Link">
      <PropertyToggle
        label="Enable Link"
        :model-value="component.props.enabled"
        @update:model-value="onEnableLinkToggle"
      />

      <template v-if="component.props.enabled">
        <div>
          <InputText
            ref="linkInputRef"
            placeholder="https://example.com or {{ cta_url }}"
            class="w-full"
            :model-value="component.props.link"
            @update:model-value="onLinkInput"
            @click="trackCursor('link', $event)"
            @keyup="trackCursor('link', $event)"
          />
          <PreviewBadge
            :active="linkTagPreviewActive"
            :resolved="resolvedLink"
            :raw="component.props.link"
          />
        </div>

        <LinkFieldMergeTags
          :last-focused-field="lastFocusedField"
          :default-tags="imageLinkDefaultTags"
          :available-fields="['link']"
          :field-labels="{ link: 'URL' }"
          @insert="handleTagInsert"
          @focus="lastFocusedField = $event"
        />
      </template>
    </PropertySection>

    <!-- Layout -->
    <PropertySection title="Layout">
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
      <PropertyAlignment
        :model-value="displayValue('align')"
        :is-overridden="isOverridden('align')"
        @update:model-value="setProp('align', $event)"
        @reset="resetProp('align')"
      />
    </PropertySection>

    <!-- Border -->
    <PropertySection title="Border">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-medium text-(--md-text-muted) italic">Mobile override</span>
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
        :min="0"
        :max="10"
        :step="1"
        unit="px"
        :is-overridden="isBorderPropOverridden('width')"
        @update:model-value="setBorderProp('width', $event)"
        @reset="resetBorderProp('width')"
      />
      <div class="grid grid-cols-2 gap-3">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label
              class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
            >
              Color <OverrideBadge :show="isBorderPropOverridden('color')" />
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
              Style <OverrideBadge :show="isBorderPropOverridden('style')" />
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
              'ring-1 ring-(--md-selection) rounded': isBorderPropOverridden('style'),
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

    <PropertyVisibility :visibility="component.props.visibility" />

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
import { computed, ref } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useComponentStyleEditor } from "@/composables/emailBuilder/components/useComponentStyleEditor";
import { useLinkTagInsert } from "@/composables/emailBuilder/core/link-tags/useLinkTagInsert";
import { resolveString } from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";
import { useImageUploader } from "@/composables/system/useImageUpload";

import InputText from "@/components/ui/primitives/InputText.vue";
import Select from "@/components/ui/primitives/Select.vue";

import Loading from "@/components/ui/Loading.vue";
import OverrideBadge from "./shared/OverrideBadge.vue";
import DeviceTabs from "./shared/DeviceTabs.vue";
import LinkFieldMergeTags from "./shared/LinkFieldMergeTags.vue";
import PreviewBadge from "./shared/PreviewBadge.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertyAlignment from "./ui/PropertyAlignment.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import SpacingControl from "./ui/SpacingControl.vue";



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
  displayBorderValue,
  setBorderProp,
  isBorderOverridden,
  resetBorder,
  toggleDesktopHide,
  toggleMobileHide,
} = useComponentStyleEditor(component, editMode);

// ─── Props mutation handlers (each calls saveToHistory) ─────────────────

const onSrcInput = (value: string) => {
  component.value.props.src = value.trim();
  saveToHistory("image-src");
};

const onAltInput = (value: string) => {
  component.value!.props.alt = value.trim();
  saveToHistory("image-alt");
};

const onLinkInput = (value: string) => {
  component.value!.props.link = value.trim();
  saveToHistory("image-link");
};

// ─── Enable Link toggle with history ─────────────────────────────────────────

const onEnableLinkToggle = (value: boolean) => {
  component.value!.props.enabled = value;
  saveToHistory("toggle-image-link");
};

// ─── Merge tag insert ─────────────────────────────────────────────────────────

const srcInputRef = ref<any>(null);
const altInputRef = ref<any>(null);
const linkInputRef = ref<any>(null);

const {
  lastFocusedField,
  trackCursor,
  handleTagInsert: _handleTagInsert,
} = useLinkTagInsert(component, "src");

const handleTagInsert = (payload: { tag: string; default?: string }) =>
  _handleTagInsert(payload, {
    src: srcInputRef.value,
    alt: altInputRef.value,
    link: linkInputRef.value,
  });

// ─── Live resolved values ─────────────────────────────────────────────────────

const resolve = (val: string) =>
  resolveString(
    val ?? "",
    linkTagPreviewContext.value,
    linkTagPreviewActive.value,
  );

const resolvedSrc = computed(() => resolve(component.value?.props?.src));
const resolvedAlt = computed(() => resolve(component.value?.props?.alt));
const resolvedLink = computed(() => resolve(component.value?.props?.link));

// ─── Spacing update with history ──────────────────────────────────────────────

const onSpacingUpdate = (field: "margin" | "padding", value: any) => {
  if (editMode.value === "mobile") {
    component.value!.props.mobile[field] = value;
  } else {
    component.value!.props[field] = value;
  }
  saveToHistory(`set-${field}`);
};

// ─── Options ──────────────────────────────────────────────────────────────────

const imageDefaultTags = ["image_url", "avatar_url", "banner_url", "alt_text"];
const imageLinkDefaultTags = [
  "cta_url",
  "profile_url",
  "confirmation_url",
  "promo_link",
  "unsubscribe_link",
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
  return editMode.value === "mobile"
    ? mobileValue !== undefined && mobileValue !== desktopValue
    : false;
};

const resetBorderProp = (prop: BorderProp) =>
  setBorderProp(prop, component.value?.props.border?.[prop]);

// ─── Image upload ─────────────────────────────────────────────────────────────

const imageInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);

const triggerImageUpload = () => imageInput.value?.click();

const handleImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Capture the previous URL so we can restore it on failure.
  const previousSrc = component.value!.props.src as string;

  isUploading.value = true;
  uploadError.value = null;

  await handleImageUploadFlow(
    file,
    (objectUrl) => {
      component.value!.props.src = objectUrl;
    },
    (permanentUrl, cleanup) => {
      swapOnLoad(
        permanentUrl,
        () => {
          component.value!.props.src = permanentUrl;
          saveToHistory("img-upload");
        },
        cleanup,
      );
    },
    (message) => {
      uploadError.value = message;
      // Restore the original URL instead of blanking the image.
      component.value!.props.src = previousSrc;
    },
  );

  isUploading.value = false;
  if (imageInput.value) imageInput.value.value = "";
};
</script>
