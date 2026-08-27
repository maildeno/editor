<template>
  <div v-if="component" class="space-y-3">
    <Loading v-if="isIconUploading" message="Uploading image" />
    <DeviceTabs v-model="editMode" />

    <!-- Layout -->
    <PropertySection title="Layout">
      <PropertyNumberSlider
        label="Icon Size (px)"
        :model-value="displayValue('iconSize')"
        :min="20"
        :max="40"
        :step="1"
        unit="px"
        :is-overridden="isOverridden('iconSize')"
        @update:model-value="setProp('iconSize', $event)"
        @reset="resetProp('iconSize')"
      />

      <PropertyNumberSlider
        label="Spacing (px)"
        :model-value="displayValue('spacing')"
        :min="1"
        :max="100"
        :step="1"
        unit="px"
        :is-overridden="isOverridden('spacing')"
        @update:model-value="setProp('spacing', $event)"
        @reset="resetProp('spacing')"
      />

      <PropertyAlignment
        :model-value="displayValue('align')"
        :is-overridden="isOverridden('align')"
        @update:model-value="setProp('align', $event)"
        @reset="resetProp('align')"
      />
    </PropertySection>

    <!-- Social Platforms (desktop only — content editing) -->
    <PropertySection v-if="editMode === 'desktop'" title="Social Platforms">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-(--md-text-subtle)">
          {{ component.props.platforms.length }}
          {{
            component.props.platforms.length === 1 ? "platform" : "platforms"
          }}
        </span>
        <button
          @click="addPlatform"
          class="text-xs text-(--md-selection) hover:text-(--md-selection-fg) flex items-center gap-1 transition-colors"
        >
          <Icon name="plus" style="font-size: 9px" /> Add
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="(platform, index) in component.props.platforms"
          :key="platform._id ?? index"
          class="border border-(--md-border) rounded-lg shadow-xs overflow-hidden"
        >
          <div
            class="flex items-center justify-between p-2 bg-(--md-surface) hover:bg-(--md-selection-bg) transition-colors"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <button
                @click="onPlatformEnabledToggle(platform)"
                class="relative w-7 h-4 rounded-full transition-colors shrink-0"
                :class="platform.enabled ? 'bg-(--md-selection)/75' : 'bg-(--md-border)'"
              >
                <span
                  class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all"
                  :class="platform.enabled ? 'left-3.5' : 'left-0.5'"
                />
              </button>

              <button
                @click="togglePlatformCollapse(Number(index))"
                class="flex items-center gap-1.5 flex-1 min-w-0 text-left"
              >
                <Icon
                  class="text-(--md-text-subtle) transition-transform"
                  :name="
                    isPlatformCollapsed(Number(index))
                      ? 'chevron-right'
                      : 'chevron-down'
                  "
                  style="font-size: 12px"
                />
                <div
                  v-if="platform.icon"
                  class="w-4 h-4 overflow-hidden bg-(--md-surface-hover) shrink-0"
                >
                  <img
                    :src="platform.icon"
                    :alt="platform.name"
                    class="w-full h-full object-cover"
                    @error="platform.icon = ''"
                  />
                </div>
                <div
                  v-else
                  class="w-4 h-4 rounded-full bg-(--md-surface-muted) flex items-center justify-center shrink-0"
                >
                  <Icon
                    name="image"
                    class="text-(--md-text-subtle)"
                    style="font-size: 8px"
                  />
                </div>
                <span class="text-xs font-medium truncate text-(--md-text-muted)">
                  {{ platform.name || "Untitled" }}
                </span>
              </button>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                @click="movePlatform(Number(index), -1)"
                :disabled="index === 0"
                class="w-6 h-6 flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-text-muted) disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move up"
              >
                <Icon name="chevron-up" style="font-size: 10px" />
              </button>
              <button
                @click="movePlatform(Number(index), 1)"
                :disabled="index === component.props.platforms.length - 1"
                class="w-6 h-6 flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-text-muted) disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move down"
              >
                <Icon name="chevron-down" style="font-size: 10px" />
              </button>
              <button
                @click="removePlatform(Number(index))"
                class="p-1.25 text-(--md-text-subtle) hover:text-(--md-danger) rounded-md hover:bg-(--md-danger-bg) transition-colors"
                title="Delete platform"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current"
                >
                  <path
                    d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div
            v-show="!isPlatformCollapsed(Number(index))"
            class="p-3 pt-0 space-y-2 border-t border-(--md-border)"
          >
            <div class="mt-2">
              <label class="text-[10px] text-(--md-text-subtle) mb-1 block"
                >Platform Name</label
              >
              <InputText
                :model-value="platform.name"
                @update:model-value="
                  (value) => onPlatformNameInput(value, Number(index))
                "
                placeholder="e.g., Facebook"
                class="w-full text-xs"
              />
            </div>
            <div>
              <label class="text-[10px] text-(--md-text-subtle) mb-1 block"
                >Profile URL</label
              >
              <InputText
                type="url"
                :model-value="platform.link"
                @update:model-value="
                  (value) => onPlatformLinkInput(value, Number(index))
                "
                placeholder="https://…"
                class="w-full text-xs"
              />
            </div>
            <div>
              <label class="text-[10px] text-(--md-text-subtle) mb-1 block">Icon</label>

              <div
                v-if="platform.icon"
                class="flex items-center gap-2 mb-2 px-2 py-1.5 bg-(--md-surface-hover) border border-(--md-border) rounded"
              >
                <div class="w-6 h-6 overflow-hidden bg-(--md-surface) shrink-0">
                  <img
                    :src="platform.icon"
                    :alt="platform.name"
                    class="w-full h-full object-cover"
                    @error="platform.icon = ''"
                  />
                </div>
                <span class="text-[10px] text-(--md-text-subtle) truncate flex-1">
                  {{
                    platform.icon.startsWith("data:")
                      ? "✓ Image uploaded"
                      : platform.icon
                  }}
                </span>
                <button
                  @click="onPlatformIconClear(Number(index))"
                  class="text-(--md-text-subtle) hover:text-(--md-danger) text-xs shrink-0"
                  title="Clear"
                >
                  <Icon name="times" style="font-size: 8px" />
                </button>
              </div>

              <InputText
                type="url"
                :model-value="platform.icon"
                @update:model-value="
                  (value) => onPlatformIconInput(value, Number(index))
                "
                placeholder="Paste icon URL…"
                class="w-full text-xs mb-2"
              />

              <button
                type="button"
                :disabled="isIconUploading"
                @click="openIconPicker(Number(index))"
                class="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] border border-dashed border-(--md-border-strong) rounded hover:border-(--md-selection) hover:bg-(--md-selection-bg) hover:text-(--md-selection-fg) text-(--md-text-subtle) transition-colors"
              >
                <Icon name="image" style="font-size: 10px" />
                Click to upload icon image
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="component.props.platforms.length === 0"
          class="text-center py-6 text-[10px] text-(--md-text-subtle)"
        >
          No platforms. Click "Add" to get started.
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
import { computed, ref, shallowRef, onUnmounted } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useComponentStyleEditor } from "@/composables/emailBuilder/components/useComponentStyleEditor";
import { useImageUploader } from "@/composables/system/useImageUpload";
import { generateId } from "@/utils/generateId";

import InputText from "@/components/ui/primitives/InputText.vue";
import Icon from "@/components/ui/Icon.vue";

import Loading from "@/components/ui/Loading.vue";
import DeviceTabs from "./shared/DeviceTabs.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertyAlignment from "./ui/PropertyAlignment.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import SpacingControl from "./ui/SpacingControl.vue";

const { rows, findComponent, selectedId, previewMode, saveToHistory } =
  useEmailBuilder();
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

const collapsedPlatforms = ref<Set<number>>(new Set());

const isPlatformCollapsed = (index: number) =>
  collapsedPlatforms.value.has(index);

const togglePlatformCollapse = (index: number) => {
  if (collapsedPlatforms.value.has(index)) {
    collapsedPlatforms.value.delete(index);
  } else {
    collapsedPlatforms.value.add(index);
  }
};

const {
  displayValue,
  isOverridden,
  setProp,
  resetProp,
  toggleDesktopHide,
  toggleMobileHide,
} = useComponentStyleEditor(component, editMode);

// Computed ref for platforms
const platforms = computed(() => component.value?.props.platforms || []);

// ─── Spacing update with history ──────────────────────────────────────────────

const onSpacingUpdate = (field: "margin" | "padding", value: any) => {
  if (editMode.value === "mobile") {
    component.value!.props.mobile[field] = value;
  } else {
    component.value!.props[field] = value;
  }
  saveToHistory(`set-${field}`);
};

// ─── Platform enabled toggle with history ─────────────────────────────────────

const onPlatformEnabledToggle = (platform: any) => {
  platform.enabled = !platform.enabled;
  saveToHistory("toggle-platform-enabled");
};

// ─── Platform input handlers with history ─────────────────────────────────────

const onPlatformNameInput = (value: string, index: number) => {
  if (platforms.value[index]) {
    platforms.value[index].name = value.trim();
    saveToHistory("platform-name-input");
  }
};

const onPlatformLinkInput = (value: string, index: number) => {
  if (platforms.value[index]) {
    platforms.value[index].link = value.trim();
    saveToHistory("platform-link-input");
  }
};

const onPlatformIconInput = (value: string, index: number) => {
  if (platforms.value[index]) {
    platforms.value[index].icon = value.trim();
    saveToHistory("platform-icon-input");
  }
};

const onPlatformIconClear = (index: number) => {
  if (platforms.value[index]) {
    platforms.value[index].icon = "";
    saveToHistory("platform-icon-clear");
  }
};

// ─── Platform CRUD ─────────────────────────────────────────────────────────────

const movePlatform = (index: number, direction: number) => {
  const platforms = component.value!.props.platforms;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= platforms.length) return;
  [platforms[index], platforms[newIndex]] = [
    platforms[newIndex],
    platforms[index],
  ];

  const collapsed = new Set(collapsedPlatforms.value);
  if (collapsed.has(index)) {
    collapsed.delete(index);
    collapsed.add(newIndex);
  }
  collapsedPlatforms.value = collapsed;

  saveToHistory("move-platform");
};

const addPlatform = () => {
  component.value!.props.platforms.push({
    _id: generateId(),
    name: "new-platform",
    link: "",
    enabled: true,
    icon: "",
  });
  saveToHistory("add-platform");
};

const removePlatform = (index: number) => {
  component.value!.props.platforms.splice(index, 1);

  const collapsed = new Set(collapsedPlatforms.value);
  collapsed.delete(index);
  const newCollapsed = new Set<number>();
  collapsed.forEach((i) => {
    if (i > index) newCollapsed.add(i - 1);
    else newCollapsed.add(i);
  });
  collapsedPlatforms.value = newCollapsed;

  saveToHistory("remove-platform");
};

// ─── Social Icon Upload ───────────────────────────────────────────────────────

const bodyFileInput = shallowRef<HTMLInputElement | null>(null);
const pendingUploadIndex = ref<number | null>(null);
const iconUploadError = ref<string | null>(null);
const uploadingIconIndex = ref<number | null>(null);
const isIconUploading = computed(() => uploadingIconIndex.value !== null);

const ensureBodyInput = (): HTMLInputElement => {
  if (bodyFileInput.value) return bodyFileInput.value;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    const idx = pendingUploadIndex.value;

    input.value = "";
    pendingUploadIndex.value = null;

    if (!file || idx === null) return;

    uploadingIconIndex.value = idx;
    iconUploadError.value = null;

    await handleImageUploadFlow(
      file,
      (objectUrl) => {
        const platform = component.value?.props?.platforms?.[idx];
        if (platform) platform.icon = objectUrl;
      },
      (permanentUrl, cleanup) => {
        const platform = component.value?.props?.platforms?.[idx];
        if (!platform) {
          cleanup();
          return;
        }
        swapOnLoad(
          permanentUrl,
          () => {
            platform.icon = permanentUrl;
            saveToHistory("icon-upload");
          },
          cleanup,
        );
      },
      (message) => {
        iconUploadError.value = message;
        const platform = component.value?.props?.platforms?.[idx];
        if (platform) platform.icon = "";
      },
    );

    uploadingIconIndex.value = null;
  });

  document.body.appendChild(input);
  bodyFileInput.value = input;
  return input;
};

const openIconPicker = (index: number) => {
  pendingUploadIndex.value = index;
  ensureBodyInput().click();
};

onUnmounted(() => {
  bodyFileInput.value?.remove();
  bodyFileInput.value = null;
});
</script>
