<!-- PropertyTextStylePanel.vue -->
<template>
  <div class="panel">
    <!-- Weight + Style row -->
    <div :class="showFontStyle ? 'grid grid-cols-2 gap-2 mb-3' : 'mb-3'">
      <div>
        <PropertySelect
          label="Weight"
          :model-value="fontWeight"
          :options="fontWeightOptions"
          placeholder="Search weight..."
          :is-overridden="isOverridden('fontWeight')"
          @update:model-value="$emit('update:fontWeight', $event)"
          @reset="$emit('reset', 'fontWeight')"
        />
      </div>
      <div v-if="showFontStyle">
        <PropertySelect
          label="Style"
          :model-value="fontStyle"
          :options="fontStyleOptions"
          placeholder="Search style..."
          :is-overridden="isOverridden('fontStyle')"
          @update:model-value="$emit('update:fontStyle', $event)"
          @reset="$emit('reset', 'fontStyle')"
        />
      </div>
    </div>

    <div class="separator mb-3" />

    <PropertyTextStyle
      :transform-value="transform"
      :decoration-value="decoration"
      :is-transform-overridden="isOverridden('textTransform')"
      :is-decoration-overridden="isOverridden('textDecoration')"
      @update:transform="$emit('update:transform', $event)"
      @update:decoration="$emit('update:decoration', $event)"
      @reset-transform="$emit('reset', 'textTransform')"
      @reset-decoration="$emit('reset', 'textDecoration')"
    />
  </div>
</template>

<script setup lang="ts">
import PropertySelect from "./PropertySelect.vue";
import PropertyTextStyle from "./PropertyTextStyle.vue";

const props = defineProps({
  fontWeight: { type: String, default: "normal" },
  fontStyle: { type: String, default: "normal" },
  transform: { type: String, default: "none" },
  decoration: { type: String, default: "none" },
  overrides: { type: Set, default: () => new Set() },
  showFontStyle: { type: Boolean, default: true },
});

const emit = defineEmits([
  "update:fontWeight",
  "update:fontStyle",
  "update:transform",
  "update:decoration",
  "reset",
]);

const isOverridden = (key: string) => props.overrides.has(key);

const fontWeightOptions = [
  { label: "Thin", value: "100" },
  { label: "Light", value: "300" },
  { label: "Regular", value: "normal" },
  { label: "Medium", value: "500" },
  { label: "SemiBold", value: "600" },
  { label: "Bold", value: "bold" },
  { label: "ExtraBold", value: "800" },
  { label: "Black", value: "900" },
];

const fontStyleOptions = [
  { label: "Normal", value: "normal" },
  { label: "Italic", value: "italic" },
];
</script>

<style scoped>
.panel {
  padding: 10px 12px;
  background: var(--md-surface);
  border: 0.5px solid color-mix(in srgb, var(--md-border) 80%, transparent);
  border-radius: 10px;
}
.separator {
  height: 0.5px;
  background: color-mix(in srgb, var(--md-border) 80%, transparent);
  margin-left: -12px;
  margin-right: -12px;
}
</style>
