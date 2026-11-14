<!-- PropertyBoxShadow.vue -->
<!--
  The Shadow control: a switch, five presets, the four numbers, a colour and
  (where it applies) inset. It edits one whole BoxShadow and emits the whole
  object, so the panel can write it in one step (see useBoxShadowEditor).

  `isOverridden` and `isMobile` are for the Mobile tab: the shadow is then an
  override of the desktop one, and "Reset" goes back to it.
-->
<template>
  <div class="space-y-3">
    <div v-if="isMobile" class="flex items-center justify-between">
      <span
        class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted) italic"
      >
        Mobile override
        <OverrideBadge :show="isOverridden" />
      </span>
      <button
        v-if="isOverridden"
        type="button"
        @click="$emit('reset')"
        class="text-[11px] text-(--md-selection-fg) hover:opacity-80 transition-colors"
      >
        ↩ Reset
      </button>
    </div>

    <PropertyToggle
      label="Box shadow"
      :model-value="modelValue.enabled"
      @update:model-value="update({ enabled: $event })"
    />

    <template v-if="modelValue.enabled">
      <!-- Preview: independent of the canvas, which may clip the shadow -->
      <div
        class="h-16 rounded-lg bg-(--md-surface-hover) flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          class="w-20 h-9 rounded-md bg-(--md-surface) border border-(--md-border)"
          :style="{ boxShadow: previewShadow }"
        />
      </div>

      <!-- Presets -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-(--md-text-muted)"
          >Presets</label
        >
        <div class="flex gap-1">
          <button
            v-for="preset in presets"
            :key="preset.id"
            type="button"
            @click="applyPreset(preset)"
            :aria-pressed="activePresetId === preset.id"
            class="flex-1 h-7 px-1 rounded-md border text-[11px] font-medium transition-all duration-100 focus:outline-none"
            :class="
              activePresetId === preset.id
                ? 'bg-(--md-selection-bg) border-(--md-selection) text-(--md-selection-fg)'
                : 'border-(--md-border)/80 text-(--md-text-subtle) hover:bg-(--md-surface-hover) hover:text-(--md-text-muted) hover:border-(--md-border-strong)'
            "
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <PropertyNumberSlider
        label="Offset X"
        :model-value="modelValue.offsetX"
        :min="limits.offset.min"
        :max="limits.offset.max"
        :step="1"
        unit="px"
        @update:model-value="update({ offsetX: $event })"
      />
      <PropertyNumberSlider
        label="Offset Y"
        :model-value="modelValue.offsetY"
        :min="limits.offset.min"
        :max="limits.offset.max"
        :step="1"
        unit="px"
        @update:model-value="update({ offsetY: $event })"
      />
      <PropertyNumberSlider
        label="Blur"
        :model-value="modelValue.blur"
        :min="limits.blur.min"
        :max="limits.blur.max"
        :step="1"
        unit="px"
        @update:model-value="update({ blur: $event })"
      />
      <PropertyNumberSlider
        label="Spread"
        :model-value="modelValue.spread"
        :min="limits.spread.min"
        :max="limits.spread.max"
        :step="1"
        unit="px"
        @update:model-value="update({ spread: $event })"
      />

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-(--md-text-muted)">Color</label>
        <PropertyColor
          bare
          show-input
          :model-value="modelValue.color"
          placeholder="rgba(0, 0, 0, 0.15)"
          @update:model-value="update({ color: $event })"
        />
      </div>

      <PropertyToggle
        v-if="allowInset"
        label="Inset"
        description="Draw the shadow inside the box."
        :model-value="modelValue.inset"
        @update:model-value="update({ inset: $event })"
      />

      <p class="text-[11px] leading-snug text-(--md-text-subtle)">
        A rounded row or column cuts off a shadow inside it when its content
        touches the corners, so give it some padding. Classic Outlook for
        Windows, Gmail, Yahoo and AOL do not draw shadows.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import {
  BOX_SHADOW_LIMITS,
  BOX_SHADOW_PRESETS,
  boxShadowFromPreset,
  boxShadowValue,
  matchBoxShadowPreset,
} from "@/composables/emailBuilder/core/boxShadow";
import type {
  BoxShadow,
  BoxShadowPreset,
} from "@/composables/emailBuilder/core/boxShadow";
import OverrideBadge from "../shared/OverrideBadge.vue";
import PropertyColor from "./PropertyColor.vue";
import PropertyNumberSlider from "./PropertyNumberSlider.vue";
import PropertyToggle from "./PropertyToggle.vue";

const props = defineProps({
  /** The whole shadow, already normalized (see useBoxShadowEditor). */
  modelValue: { type: Object as PropType<BoxShadow>, required: true },
  /** Mobile tab: the shadow is an override and can be reset. */
  isMobile: { type: Boolean, default: false },
  isOverridden: { type: Boolean, default: false },
  /** False for an image, which has no inside to draw an inset shadow in. */
  allowInset: { type: Boolean, default: true },
});

const emit = defineEmits<{
  "update:modelValue": [value: BoxShadow];
  reset: [];
}>();

const limits = BOX_SHADOW_LIMITS;

const presets = computed(() =>
  BOX_SHADOW_PRESETS.filter((p) => props.allowInset || !p.shadow.inset),
);

const activePresetId = computed(
  () => matchBoxShadowPreset(props.modelValue)?.id ?? null,
);

// Drawn even for a shadow that has sized down to nothing: "none" is valid.
const previewShadow = computed(
  () =>
    boxShadowValue(props.modelValue, { allowInset: props.allowInset }) ||
    "none",
);

const update = (patch: Partial<BoxShadow>) =>
  emit("update:modelValue", { ...props.modelValue, ...patch });

const applyPreset = (preset: BoxShadowPreset) =>
  emit("update:modelValue", boxShadowFromPreset(preset));
</script>
