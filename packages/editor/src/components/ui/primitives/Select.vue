<script setup lang="ts">
import { computed, ref } from "vue";

import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxEmpty,
} from "reka-ui";

import Icon from "@/components/ui/Icon.vue";
import { usePortalTarget } from "@/composables/ui/useTeleportTarget";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: any[];
    optionLabel?: string | null;
    optionValue?: string | null;
    placeholder?: string;
    disabled?: boolean;
    filter?: boolean;
    filterPlaceholder?: string;
  }>(),
  {
    options: () => [],
    placeholder: "",
    disabled: false,
    filter: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

/*
 * Keep the dropdown inside the editor's shadow root.
 */
const portalTarget = usePortalTarget();

const open = ref(false);
const search = ref("");

/**
 * What the search input actually displays.
 *
 * The input cannot simply be bound to `search`. Reka writes the chosen item's
 * text back into the input on selection, so `search` keeps holding the old
 * label — and an input's value always wins over its placeholder. That made the
 * field show a stale font after undo/redo/Reset: `displayLabel` (bound to the
 * placeholder) updated correctly underneath, but stayed invisible behind the
 * leftover text.
 *
 * Closed, it shows the selected label, so it tracks modelValue like the
 * non-filter branch already did. Open, it shows whatever is being typed.
 */
const inputValue = computed({
  get: () => (open.value ? search.value : displayLabel.value),
  set: (v: string) => {
    search.value = v;
  },
});

/* ---------------------------------------------------------
 * Option helpers
 * --------------------------------------------------------- */

function labelOf(option: any): string {
  if (option === null || option === undefined) {
    return "";
  }

  /*
   * Primitive option:
   *
   * "Arial"
   * "Roboto"
   * "Inter"
   */
  if (typeof option !== "object") {
    return String(option);
  }

  /*
   * Object option:
   *
   * { label: "H1", value: "h1" }
   *
   * or custom optionLabel.
   */
  if (props.optionLabel) {
    return String(option[props.optionLabel] ?? "");
  }

  return String(option.label ?? option);
}

function valueOf(option: any): unknown {
  if (option === null || option === undefined) {
    return option;
  }

  /*
   * Primitive option.
   */
  if (typeof option !== "object") {
    return option;
  }

  /*
   * Object option.
   */
  if (props.optionValue) {
    return option[props.optionValue];
  }

  return option.value ?? option;
}

/* ---------------------------------------------------------
 * Selected value
 * --------------------------------------------------------- */

const displayLabel = computed(() => {
  const selected = props.options.find(
    (option) => valueOf(option) === props.modelValue,
  );

  return selected ? labelOf(selected) : "";
});

/* ---------------------------------------------------------
 * Filtering
 * --------------------------------------------------------- */

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase();

  /*
   * No filtering.
   */
  if (!props.filter || !query) {
    return props.options;
  }

  return props.options.filter((option) =>
    labelOf(option).toLowerCase().includes(query),
  );
});

/* ---------------------------------------------------------
 * Selection
 * --------------------------------------------------------- */

function onSelect(option: unknown) {
  if (option === undefined) {
    return;
  }

  emit("update:modelValue", valueOf(option));

  open.value = false;
  search.value = "";
}

/* ---------------------------------------------------------
 * Open / close
 * --------------------------------------------------------- */

function onOpenChange(value: boolean) {
  open.value = value;

  if (!value) {
    search.value = "";
  }
}

function openDropdown() {
  if (props.disabled) {
    return;
  }

  open.value = true;
}
</script>

<template>
  <ComboboxRoot
    :open="open"
    :disabled="props.disabled"
    :ignore-filter="true"
    @update:open="onOpenChange"
    @update:model-value="onSelect"
  >
    <!-- =====================================================
         SELECT FIELD
         ===================================================== -->

    <ComboboxAnchor
      class="md-sel__anchor"
      :class="{
        'md-sel__anchor--disabled': props.disabled,
        'md-sel__anchor--open': open,
      }"
    >
      <!-- ===================================================
           SEARCHABLE INPUT
           =================================================== -->

      <ComboboxInput
        v-if="props.filter"
        v-model="inputValue"
        class="md-sel__input"
        :placeholder="props.filterPlaceholder || props.placeholder"
        @focus="openDropdown"
        @click="openDropdown"
      />

      <!-- ===================================================
           NON-FILTERED SELECT
           =================================================== -->

      <ComboboxTrigger v-else class="md-sel__triggerText">
        <span
          :class="{
            'md-sel__ph': !displayLabel,
          }"
        >
          {{ displayLabel || props.placeholder }}
        </span>
      </ComboboxTrigger>

      <!-- ===================================================
           CHEVRON
           =================================================== -->

      <ComboboxTrigger
        class="md-sel__chev"
        :class="{
          'md-sel__chev--open': open,
        }"
        tabindex="-1"
        type="button"
        aria-label="Open options"
      >
        <Icon name="chevron-down" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <!-- =====================================================
         DROPDOWN

         IMPORTANT:
         Keep this inside the editor shadow root.
         ===================================================== -->

    <ComboboxPortal :to="portalTarget">
      <!--
        @mousedown.prevent is load-bearing, not decoration.

        When `filter` is on, the search input holds focus. Pressing the
        mouse down on an option would otherwise blur that input before the
        click completes — the list closes on blur, so the click lands on
        nothing and no selection is made. Preventing the default mousedown
        action suppresses only the focus shift; the click event still
        fires normally, so the option is selected.

        This is exactly why the symptom was so specific: keyboard
        selection always worked (arrow keys never blur the input), and the
        filterless selects — visibility rules, the date picker — worked by
        mouse too, because they have no focused input to lose.
      -->
      <ComboboxContent
        class="md-sel__content"
        position="popper"
        :side-offset="4"
        @mousedown.prevent
      >
        <ComboboxViewport class="md-sel__viewport">
          <!-- Empty state -->

          <ComboboxEmpty class="md-sel__empty"> No results </ComboboxEmpty>

          <!-- Options -->

          <ComboboxItem
            v-for="option in filteredOptions"
            :key="String(valueOf(option))"
            :value="option"
            :text-value="labelOf(option)"
            class="md-sel__item"
          >
            <span class="md-sel__itemLabel">
              {{ labelOf(option) }}
            </span>

            <ComboboxItemIndicator class="md-sel__check">
              <Icon name="check" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<!--
  IMPORTANT:

  DO NOT use "scoped" here.

  The ComboboxContent is rendered through a portal.
  These styles need to apply directly to the portaled
  dropdown elements.
-->

<style>
/* =========================================================
   SELECT ROOT
   ========================================================= */

.md-sel__anchor {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
  min-height: 32px;
  box-sizing: border-box;
  padding: 0 0.375rem 0 0.5rem;
  background: var(--md-surface);
  border: 1px solid var(--md-border);
  border-radius: 0.375rem;
  font-size: 13px;
  color: var(--md-text);
}

.md-sel__anchor:focus-within {
  border-color: var(--md-primary);
}

.md-sel__anchor--open {
  border-color: var(--md-primary);
}

.md-sel__anchor--disabled {
  background: var(--md-surface-hover);
  color: var(--md-text-subtle);
}

/* =========================================================
   SEARCH INPUT
   ========================================================= */

.md-sel__input {
  flex: 1;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 0.375rem 0;
  border: 0;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.25rem;
  color: var(--md-text);
}

.md-sel__input::placeholder {
  color: var(--md-text-subtle);
}

/* =========================================================
   NON-FILTERED TRIGGER
   ========================================================= */

.md-sel__triggerText {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.375rem 0;
  border: 0;
  outline: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: var(--md-text);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md-sel__ph {
  color: var(--md-text-subtle);
}

/* =========================================================
   CHEVRON
   ========================================================= */

.md-sel__chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  cursor: pointer;
  color: var(--md-text-muted);
  transition:
    transform 150ms ease,
    color 150ms ease;
}

.md-sel__chev--open {
  transform: rotate(180deg);
  color: var(--md-text);
}

/* =========================================================
   DROPDOWN
   ========================================================= */

.md-sel__content {
  position: relative;
  z-index: 999999;
  width: var(--reka-combobox-trigger-width);
  min-width: 180px;
  max-width: 320px;
  box-sizing: border-box;
  background: var(--md-surface);
  border: 1px solid var(--md-border);
  border-radius: 0.5rem;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.12),
    0 4px 6px -4px rgb(0 0 0 / 0.12);
  overflow: hidden;
}

/* =========================================================
   DROPDOWN VIEWPORT
   ========================================================= */

.md-sel__viewport {
  width: 100%;
  max-height: 240px;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px;
  background: var(--md-surface);
}

/* =========================================================
   EMPTY
   ========================================================= */

.md-sel__empty {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  background: var(--md-surface);
  font-family: inherit;
  font-size: 12px;
  color: var(--md-text-subtle);
  text-align: center;
}

/* =========================================================
   OPTION
   ========================================================= */

.md-sel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  box-sizing: border-box;
  gap: 8px;
  padding: 6px 8px;
  background: var(--md-surface);
  border: 0;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 18px;
  color: var(--md-text);
  cursor: pointer;
  outline: none;
  user-select: none;
}

.md-sel__item:hover {
  background: var(--md-surface-muted);
}

.md-sel__item[data-highlighted] {
  background: var(--md-surface-muted);
}

.md-sel__item[data-state="checked"] {
  background: var(--md-success-bg);
  color: var(--md-success-fg);
  font-weight: 500;
}

.md-sel__item[data-state="checked"][data-highlighted] {
  background: color-mix(in srgb, var(--md-success) 20%, var(--md-success-bg));
}

/* =========================================================
   OPTION TEXT
   ========================================================= */

.md-sel__itemLabel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* =========================================================
   CHECK
   ========================================================= */

.md-sel__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  font-size: 12px;
  color: currentColor;
}
</style>
