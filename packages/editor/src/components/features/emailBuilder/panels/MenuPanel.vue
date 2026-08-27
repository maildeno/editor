<template>
  <div v-if="component" class="space-y-3">
    <DeviceTabs v-model="editMode" />

    <!-- Menu Items (desktop only — content editing) -->
    <PropertySection v-if="editMode === 'desktop'" title="Menu Items">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-[var(--md-text-subtle)]">
          {{ component.props.items.length }}
          {{ component.props.items.length === 1 ? "item" : "items" }}
        </span>
        <button
          @click="addItem"
          class="text-xs text-[var(--md-selection)] hover:text-[var(--md-selection-fg)] flex items-center gap-1 transition-colors"
        >
          <Icon name="plus" style="font-size: 9px" /> Add
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="(item, index) in component.props.items"
          :key="item._id ?? index"
          class="border border-[var(--md-border)] rounded-lg shadow-xs overflow-hidden"
        >
          <!-- Header row with toggle and controls -->
          <div
            class="flex items-center justify-between p-2 bg-[var(--md-surface)] hover:bg-[var(--md-selection-bg)] transition-colors"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <button
                @click="onItemEnabledToggle(item)"
                class="relative w-7 h-4 rounded-full transition-colors shrink-0"
                :class="item.enabled ? 'bg-[var(--md-selection)]/75' : 'bg-[var(--md-border)]'"
              >
                <span
                  class="absolute top-0.5 h-3 w-3 rounded-full bg-[var(--md-surface)] shadow-sm transition-all"
                  :class="item.enabled ? 'left-3.5' : 'left-0.5'"
                />
              </button>

              <button
                @click="toggleItemCollapse(Number(index))"
                class="flex items-center gap-1.5 flex-1 min-w-0 text-left"
              >
                <Icon
                  class="text-[var(--md-text-subtle)] transition-transform"
                  :name="isItemCollapsed(Number(index))
                      ? 'chevron-right'
                      : 'chevron-down'"
                  style="font-size: 12px"
                />
                <span class="text-xs font-medium truncate text-[var(--md-text-muted)]">
                  {{ item.label || "Untitled" }}
                </span>
              </button>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                @click="moveItem(Number(index), -1)"
                :disabled="index === 0"
                class="w-6 h-6 flex items-center justify-center text-[var(--md-text-subtle)] hover:text-[var(--md-text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move up"
              >
                <Icon name="chevron-up" style="font-size: 10px" />
              </button>
              <button
                @click="moveItem(Number(index), 1)"
                :disabled="index === component.props.items.length - 1"
                class="w-6 h-6 flex items-center justify-center text-[var(--md-text-subtle)] hover:text-[var(--md-text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move down"
              >
                <Icon name="chevron-down" style="font-size: 10px" />
              </button>
              <button
                @click="removeItem(Number(index))"
                class="p-1.25 text-[var(--md-text-subtle)] hover:text-[var(--md-danger)] rounded-md hover:bg-[var(--md-danger-bg)] transition-colors"
                title="Delete item"
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

          <!-- Collapsible content -->
          <div
            v-show="!isItemCollapsed(Number(index))"
            class="p-3 pt-0 space-y-2 border-t border-[var(--md-border)]"
          >
            <div class="mt-2">
              <label class="text-[10px] text-[var(--md-text-subtle)] mb-1 block">Label</label>
              <InputText
                :model-value="item.label"
                @update:model-value="(value) => onLabelInput(value, Number(index))"
                placeholder="e.g., Home"
                class="w-full text-xs"
              />
            </div>
            <div>
              <label class="text-[10px] text-[var(--md-text-subtle)] mb-1 block">URL</label>
              <InputText
                :model-value="item.link"
                @update:model-value="(value) => onUrlInput(value, Number(index))"
                type="url"
                placeholder="https://…"
                class="w-full text-xs"
              />
            </div>
          </div>
        </div>

        <div
          v-if="component.props.items.length === 0"
          class="text-center py-6 text-[10px] text-[var(--md-text-subtle)]"
        >
          No items. Click "Add" to get started.
        </div>
      </div>
    </PropertySection>

    <!-- Layout -->
    <PropertySection title="Layout">
      <PropertyNumberSlider
        label="Item Spacing (px)"
        :model-value="displayValue('spacing')"
        :min="3"
        :max="40"
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
        label="Line Height"
        :model-value="displayValue('lineHeight')"
        :min="1"
        :max="3"
        :step="0.1"
        :is-overridden="isOverridden('lineHeight')"
        @update:model-value="setProp('lineHeight', $event)"
        @reset="resetProp('lineHeight')"
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

      <TextStylePanel
        :font-weight="displayValue('fontWeight')"
        :font-style="displayValue('fontStyle')"
        :transform="displayValue('textTransform')"
        :decoration="displayValue('textDecoration')"
        :overrides="activeOverrides"
        @update:font-weight="setProp('fontWeight', $event)"
        @update:font-style="setProp('fontStyle', $event)"
        @update:transform="setProp('textTransform', $event)"
        @update:decoration="setProp('textDecoration', $event)"
        @reset="resetProp($event)"
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
          <label class="text-xs font-medium text-[var(--md-text-muted)]">Background</label>
          <button
            v-if="isBackgroundOverridden()"
            type="button"
            @click="resetBackground"
            class="text-xs text-[var(--md-selection-fg)] hover:opacity-80"
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
      <PropertyToggle
        label="Stack Menu on Mobile"
        description="Menu will stack vertically on screens ≤600px"
        :model-value="component.props.mobileStack"
        active-color="bg-[var(--md-selection)]"
        @update:model-value="onMobileStackChange"
      />
    </PropertySection>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useGoogleFonts } from "@/composables/system/useGoogleFonts";
import { useComponentStyleEditor } from "@/composables/emailBuilder/components/useComponentStyleEditor";
import { generateId } from "@/utils/generateId";

import InputText from "@/components/ui/primitives/InputText.vue";
import Icon from "@/components/ui/Icon.vue";

import DeviceTabs from "./shared/DeviceTabs.vue";
import PropertySection from "./ui/PropertySection.vue";
import PropertyNumberSlider from "./ui/PropertyNumberSlider.vue";
import PropertySelect from "./ui/PropertySelect.vue";
import PropertyAlignment from "./ui/PropertyAlignment.vue";
import PropertyColor from "./ui/PropertyColor.vue";
import PropertyGradientColor from "./ui/PropertyGradientColor.vue";
import PropertyVisibility from "./ui/PropertyVisibility.vue";
import SpacingControl from "./ui/SpacingControl.vue";
import PropertyToggle from "./ui/PropertyToggle.vue";
import TextStylePanel from "./ui/PropertyTextStylePanel.vue";

const { rows, findComponent, selectedId, previewMode, saveToHistory } =
  useEmailBuilder();
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

// Collapse state for menu items
const collapsedItems = ref<Set<number>>(new Set());

const isItemCollapsed = (index: number) => collapsedItems.value.has(index);

const toggleItemCollapse = (index: number) => {
  if (collapsedItems.value.has(index)) {
    collapsedItems.value.delete(index);
  } else {
    collapsedItems.value.add(index);
  }
};


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

watch(
  () => displayValue("fontFamily"),
  (font) => loadGoogleFont(font),
  { immediate: true },
);

const activeOverrides = computed(() => {
  const keys = ["fontWeight", "fontStyle", "textTransform", "textDecoration"];
  return new Set(keys.filter((k) => isOverridden(k)));
});


// ─── Props mutation handlers (each calls saveToHistory) ─────────────────

const items = computed(() => component.value?.props.items || []);

const onLabelInput = (value: string, index: number) => {
  if (items.value[index]) {
    items.value[index].label = value.trim();
    saveToHistory("anchor-label");
  }
};

const onUrlInput = (value: string, index: number) => {
  if (items.value[index]) {
    items.value[index].link = value.trim();
    saveToHistory("anchor-url");
  }
};

// ─── Spacing update with history ──────────────────────────────────────────────

const onSpacingUpdate = (field: "margin" | "padding", value: any) => {
  if (editMode.value === "mobile") {
    component.value!.props.mobile[field] = value;
  } else {
    component.value!.props[field] = value;
  }
  saveToHistory(`set-${field}`);
};

// ─── mobileStack toggle with history ─────────────────────────────────────────

const onMobileStackChange = (value: boolean) => {
  component.value!.props.mobileStack = value;
  saveToHistory("toggle-menu-mobile-stack");
};

// ─── Item enabled toggle with history ────────────────────────────────────────

const onItemEnabledToggle = (item: any) => {
  item.enabled = !item.enabled;
  saveToHistory("toggle-menu-item-enabled");
};

// ─── Item CRUD with collapse state management ─────────────────────────────────

const addItem = () => {
  component.value!.props.items.push({
    _id: generateId(),
    label: "New Item",
    link: "https://example.com",
    enabled: true,
  });
  saveToHistory("add-menu-item");
};

const removeItem = (index: number) => {
  component.value!.props.items.splice(index, 1);

  const newCollapsed = new Set<number>();
  collapsedItems.value.forEach((collapsedIndex) => {
    if (collapsedIndex > index) {
      newCollapsed.add(collapsedIndex - 1);
    } else if (collapsedIndex < index) {
      newCollapsed.add(collapsedIndex);
    }
  });
  collapsedItems.value = newCollapsed;

  saveToHistory("remove-menu-item");
};

const moveItem = (index: number, direction: number) => {
  const items = component.value!.props.items;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= items.length) return;
  [items[index], items[newIndex]] = [items[newIndex], items[index]];

  const collapsed = new Set(collapsedItems.value);
  if (collapsed.has(index)) {
    collapsed.delete(index);
    collapsed.add(newIndex);
  }
  if (collapsed.has(newIndex)) {
    collapsed.delete(newIndex);
    collapsed.add(index);
  }
  collapsedItems.value = collapsed;

  saveToHistory("move-menu-item");
};
</script>
