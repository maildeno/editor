<template>
  <!-- Bare mode: swatch only, or swatch + hex input -->
  <template v-if="bare">
    <div class="flex items-center gap-2">
      <button
        ref="triggerRef"
        class="w-5.25 h-5.25 rounded-full border border-(--md-text)/10 shrink-0 cursor-pointer transition-all hover:scale-110 hover:shadow-sm focus:outline-none"
        :class="isTransparent ? 'transparent-swatch' : ''"
        :style="!isTransparent ? { background: modelValue } : {}"
        :aria-label="`Color: ${modelValue}`"
        @click="togglePicker"
      />
      <input
        v-if="showInput"
        type="text"
        class="w-full h-8 py-2 px-2 text-[13px] text-(--md-text-muted) border border-(--md-border-strong)/80 rounded-md bg-(--md-surface) shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none transition-all"
        :value="modelValue"
        :placeholder="placeholder"
        spellcheck="false"
        @change="
          $emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
    </div>
  </template>

  <!-- Full mode: label + reset + swatch + hex input -->
  <div v-else class="space-y-1.5">
    <div class="flex items-center justify-between">
      <label
        class="flex items-center gap-1.5 text-xs font-medium text-(--md-text-muted)"
      >
        {{ label }}
        <OverrideBadge :show="isOverridden" />
      </label>
      <button
        v-if="isOverridden"
        class="text-[11px] text-(--md-selection-fg) hover:opacity-80 transition-colors"
        @click="$emit('reset')"
      >
        ↩ Reset
      </button>
    </div>

    <div v-if="allowTransparent" class="flex items-center gap-2">
      <button
        class="relative w-7.5 h-4.25 rounded-full transition-colors duration-200 shrink-0 focus:outline-none"
        :class="isTransparent ? 'bg-(--md-selection)' : 'bg-(--md-border)'"
        role="switch"
        :aria-checked="isTransparent"
        @click="onTransparentToggle(!isTransparent)"
      >
        <span
          class="absolute top-0.5 h-3.25 w-3.5 rounded-full bg-(--md-surface) shadow-sm transition-all duration-200"
          :class="isTransparent ? 'left-3.5' : 'left-0.75'"
        />
      </button>
      <span class="text-xs text-(--md-text-muted)">Transparent</span>
    </div>

    <div v-if="!isTransparent" class="flex items-center gap-2">
      <button
        ref="triggerRef"
        class="w-5.25 h-5.25 rounded-full border border-(--md-text)/10 shrink-0 cursor-pointer transition-all hover:scale-110 hover:shadow-sm focus:outline-none"
        :style="{ background: modelValue }"
        :aria-label="`Pick color: ${modelValue}`"
        @click="togglePicker"
      />
      <input
        type="text"
        class="w-full h-8 py-2 px-2 text-[13px] text-(--md-text-muted) border border-(--md-border-strong)/80 rounded-md bg-(--md-surface) shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none transition-all"
        :value="modelValue"
        :placeholder="placeholder"
        spellcheck="false"
        @change="
          $emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
    </div>
  </div>

  <!-- Picker panel -->
  <ColorPickerPanel
    v-if="pickerOpen"
    :model-value="modelValue"
    :anchor="triggerRef"
    @update:modelValue="$emit('update:modelValue', $event)"
    @close="closePicker"
  />
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import OverrideBadge from "../shared/OverrideBadge.vue";
import ColorPickerPanel from "./color-picker/ColorPickerPanel.vue";

const props = defineProps({
  label: { type: String, default: "" },
  modelValue: { type: String, default: "#000000" },
  placeholder: { type: String, default: "#000000" },
  allowTransparent: { type: Boolean, default: false },
  isOverridden: { type: Boolean, default: false },
  bare: { type: Boolean, default: false },
  showInput: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "reset"]);

const triggerRef = ref(null);
const pickerOpen = ref(false);

const isTransparent = computed(() => props.modelValue === "transparent");

// e.target (not composedPath()) is the bug here — see Header.vue's
// handleClickOutside for the full explanation; same fix, same reason.
// document.querySelector('[data-color-panel]') is a second, separate bug
// on top of that: it can't see past a shadow root at all regardless of
// where within it the panel lives, so panelEl was always null for the
// custom-element usage path. Checking composedPath() directly for the
// data-color-panel attribute sidesteps needing to locate the element via
// a global query in the first place.
const onDocPointerDown = (e: Event) => {
  const path = e.composedPath();
  if (triggerRef.value && path.includes(triggerRef.value)) return;
  if (
    path.some(
      (el: EventTarget) =>
        el instanceof Element && el.hasAttribute("data-color-panel"),
    )
  )
    return;
  closePicker();
};

const closePicker = () => {
  pickerOpen.value = false;
  document.removeEventListener("pointerdown", onDocPointerDown, true);
};

const togglePicker = () => {
  if (pickerOpen.value) {
    closePicker();
  } else {
    pickerOpen.value = true;
    setTimeout(
      () => document.addEventListener("pointerdown", onDocPointerDown, true),
      0,
    );
  }
};

const onTransparentToggle = (val: boolean) => {
  closePicker();
  emit("update:modelValue", val ? "transparent" : "#ffffff");
};

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown, true);
});
</script>

<style scoped>
.transparent-swatch {
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 6px 6px;
  background-position:
    0 0,
    0 3px,
    3px -3px,
    -3px 0;
  background-color: white;
}
</style>
