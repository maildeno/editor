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

/**
 * What the user has typed into the search box since the list opened, and
 * nothing else. It is also the list filter (`filteredOptions`), so anything
 * that is not the user typing must never land in it.
 */
const search = ref("");

/**
 * What the search input actually displays.
 *
 * Closed, it shows the selected label, so it tracks modelValue like the
 * non-filter branch does. Open, it shows what is being typed.
 *
 * The input is bound one way, and `search` follows the native `input` event
 * only (`onSearchInput`). Reka also writes into the input's model on its own:
 * `resetSearchTerm()` runs on mount, on every selection and shortly after it
 * closes the list, and ends by re-emitting whatever the box is bound to, which
 * is the current label. Taking those writes turned `search` into a snapshot of
 * the label as of the last reset. Nothing refreshed it when the parent changed
 * modelValue (another block selected, undo, Reset), so the next open showed the
 * previous value in the box, and `filteredOptions` cut the list down to that
 * one match. Ignoring them only while the list is closed is not enough: in the
 * custom-element build the first click makes Reka close the list and this
 * component reopen it, so a reset can land while it is open.
 */
const inputValue = computed(() =>
  open.value ? search.value : displayLabel.value,
);

function onSearchInput(event: Event) {
  search.value = (event.target as HTMLInputElement).value;
}

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

/**
 * The option that matches modelValue, handed to ComboboxRoot below.
 *
 * Without it Reka keeps its own, uncontrolled copy of the selection: whatever
 * was last picked in this instance. The check mark and the highlighted row read
 * that copy, and the properties panel reuses one Select while the selected block
 * changes, so both pointed at the previous block's value.
 *
 * `null`, not `undefined`, for "no match": Reka decides once, at setup, whether
 * the root is controlled by checking for `undefined`.
 */
const selectedOption = computed(
  () =>
    props.options.find((option) => valueOf(option) === props.modelValue) ??
    null,
);

/** Compared by value, so an options array that is rebuilt still matches. */
const sameOption = (a: unknown, b: unknown) => valueOf(a) === valueOf(b);

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

  // Clear on open as well as on close, so nothing left over can seed the query.
  search.value = "";
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
    :model-value="selectedOption"
    :by="sameOption"
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
        :model-value="inputValue"
        class="md-sel__input"
        :placeholder="props.filterPlaceholder || props.placeholder"
        @input="onSearchInput"
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