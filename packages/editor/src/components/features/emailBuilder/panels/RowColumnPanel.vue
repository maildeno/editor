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

    <!-- Width -->
    <PropertySection v-if="row && columnCount > 0" title="Width">
      <!-- Width is one number per column and has no mobile override, so the
           Mobile tab has nothing to set. It says what happens there instead. -->
      <p
        v-if="editMode === 'mobile'"
        class="text-[11px] text-(--md-text-subtle)"
      >
        {{ mobileWidthNote }}
      </p>

      <template v-else>
        <!-- A row from before widths were kept to 100 -->
        <Message v-if="widthsOff" severity="warn">
          <p>
            This row's columns add up to {{ formatWidth(total) }}%, so the
            canvas and the export can differ.
          </p>
          <button
            type="button"
            class="mt-1 text-xs font-medium underline underline-offset-2 hover:opacity-80"
            @click="fixWidths"
          >
            Fix to 100%
          </button>
        </Message>

        <p
          v-if="columnCount === 1 && !widthsOff"
          class="text-[11px] text-(--md-text-subtle)"
        >
          A single column always fills the row (100%).
        </p>

        <template v-else-if="columnCount > 1">
          <PropertyNumberSlider
            label="Column width"
            :model-value="draftWidth"
            :min="MIN_COLUMN_WIDTH"
            :max="maxWidth"
            :step="1"
            unit="%"
            @update:model-value="onWidthInput"
          />

          <!-- Every column's share of the row. The selected one is outlined. -->
          <div
            class="flex h-7 rounded-md border border-(--md-border)"
            role="img"
            :aria-label="stripLabel"
          >
            <div
              v-for="(seg, i) in strip"
              :key="seg.id"
              class="relative group/column flex shrink-0 items-center justify-center text-[10px] font-medium"
              :class="[
                i > 0 ? 'border-l border-(--md-surface)' : '',
                seg.selected
                  ? 'bg-(--md-selection-bg) text-(--md-selection-fg) rounded-md ring-1 ring-inset ring-(--md-selection)'
                  : 'bg-(--md-surface-muted) text-(--md-text-subtle) rounded-md',
              ]"
              :style="{ width: `${seg.width}%` }"
            >
              <div
                class="flex h-full w-full items-center justify-center overflow-hidden"
              >
                <span v-if="seg.width >= 12">{{ formatWidth(seg.width) }}</span>
              </div>

              <div
                class="pointer-events-none absolute bottom-full mb-1.5 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 translate-y-1 group-hover/column:opacity-100 group-hover/column:translate-y-0 transition-all duration-150 z-50"
                :class="{
                  'left-0': i === 0,
                  'right-0 left-auto': i === strip.length - 1,
                  'left-1/2 -translate-x-1/2': i > 0 && i < strip.length - 1,
                }"
              >
                Column {{ i + 1 }}: {{ formatWidth(seg.width) }}%
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2">
            <p
              class="min-w-0 text-[11px] tabular-nums"
              :class="
                widthsOff ? 'text-(--md-warning-fg)' : 'text-(--md-text-subtle)'
              "
            >
              {{ percentList(" + ") }}
              <span class="whitespace-nowrap">= {{ formatWidth(total) }}%</span>
            </p>
            <button
              type="button"
              class="shrink-0 rounded-md border border-(--md-border) px-2.5 py-1 text-[11px] font-medium text-(--md-text-muted) transition-colors hover:bg-(--md-surface-hover) disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              :disabled="isEqualSplit"
              @click="equalize"
            >
              Equalize
            </button>
          </div>

          <p class="text-[11px] text-(--md-text-subtle)">
            The other columns share the rest, so the row always adds up to 100%.
          </p>
        </template>
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
import { ref, computed, watch, type PropType } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useImageUploader } from "@/composables/system/useImageUpload";
import { useNodeStyleEditor } from "@/composables/emailBuilder/components/useNodeStyleEditor";
import type { EditMode } from "@/composables/emailBuilder/components/useComponentStyleEditor";
import {
  MIN_COLUMN_WIDTH,
  equalWidths,
  formatWidth,
  maxColumnWidth,
  normalizeWidths,
  readWidths,
  setColumnWidth,
  widthsAreOff,
  widthsTotal,
} from "@/composables/emailBuilder/core/columnWidths";

import InputText from "@/components/ui/primitives/InputText.vue";
import Select from "@/components/ui/primitives/Select.vue";
import Message from "@/components/ui/primitives/Message.vue";
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

const { saveToHistory, previewMode, setColumnWidths } = useEmailBuilder();
const { handleImageUploadFlow, swapOnLoad } = useImageUploader();

// The part of a row this panel needs. `row` is how it sees the column's
// siblings, which a width cannot do without: the widths in a row always add up
// to 100. It is optional; without it the Width section is left out.
interface WidthRow {
  id: string;
  mobileStack?: boolean;
  columns: Array<{ id: string; width?: unknown }>;
}

const props = defineProps({
  column: { type: Object, required: true },
  row: { type: Object as PropType<WidthRow | null>, default: null },
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

// ─── Width ────────────────────────────────────────────────────────────────────

// Everything shown is read from the row. Writing goes through setColumnWidths,
// which keeps the row at 100 (the rules are in columnWidths.ts), so the panel
// keeps no copy of its own that could drift from the canvas.
const widths = computed(() => (props.row ? readWidths(props.row.columns) : []));
const columnCount = computed(() => widths.value.length);
const columnIndex = computed(() =>
  props.row ? props.row.columns.findIndex((c) => c.id === props.column.id) : -1,
);
const currentWidth = computed(() => widths.value[columnIndex.value] ?? 0);
const total = computed(() => widthsTotal(widths.value));
// A row from before widths were kept to 100: an old template, or one edited by hand.
const widthsOff = computed(() => widthsAreOff(widths.value));
const maxWidth = computed(() => maxColumnWidth(columnCount.value));
const isEqualSplit = computed(() =>
  equalWidths(columnCount.value).every((w, i) => w === widths.value[i]),
);

const percentList = (sep: string) =>
  widths.value.map((w) => `${formatWidth(w)}%`).join(sep);
const stripLabel = computed(() => `Column widths: ${percentList(", ")}`);
const strip = computed(() =>
  (props.row?.columns ?? []).map((c, i) => ({
    id: c.id,
    width: widths.value[i],
    selected: i === columnIndex.value,
  })),
);

const mobileWidthNote = computed(() =>
  props.row?.mobileStack
    ? "Column width is a desktop setting. On mobile this row stacks, so the column is full width."
    : "Column width is set on the Desktop tab. It applies on mobile too, because this row does not stack.",
);

// The number box can hold text the row cannot take: "3" on the way to "30", or
// "95" when 90 is the most a three-column row allows. That text is kept in
// `draftWidth` and only a width the row can take is written. The box clamps
// what is left when it loses focus, which arrives here as one more input, so
// "3" ends up as 5 and "95" as 90.
const draftWidth = ref<number>(currentWidth.value);
watch([currentWidth, () => props.column.id], () => {
  draftWidth.value = currentWidth.value;
});

const onWidthInput = (value: number) => {
  draftWidth.value = value;
  const index = columnIndex.value;
  if (!props.row || index < 0) return;
  if (!(value >= MIN_COLUMN_WIDTH && value <= maxWidth.value)) return;
  // Debounced, so one drag (or one typed number) is one undo step.
  setColumnWidths(
    props.row.id,
    setColumnWidth(widths.value, index, value),
    true,
  );
  // A decimal was rounded to a whole percentage; show the width the row has.
  draftWidth.value = currentWidth.value;
};

const equalize = () => {
  if (props.row) setColumnWidths(props.row.id, equalWidths(columnCount.value));
};

const fixWidths = () => {
  if (props.row) setColumnWidths(props.row.id, normalizeWidths(widths.value));
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
