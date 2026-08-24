<script setup lang="ts">
/**
 * Date picker — a calendar popover built on Reka UI.
 *
 * External API:
 *   modelValue: Date | string | null
 *
 * Internally:
 *   Reka UI uses @internationalized/date CalendarDate.
 *
 * The conversion happens only at the component boundary so the
 * rest of Maildeno can continue working with normal JavaScript Dates.
 */

import { computed, ref } from "vue";
import { CalendarDate } from "@internationalized/date";

import {
  DatePickerRoot,
  DatePickerField,
  DatePickerInput,
  DatePickerTrigger,
  DatePickerContent,
  DatePickerCalendar,
  DatePickerHeader,
  DatePickerPrev,
  DatePickerHeading,
  DatePickerNext,
  DatePickerGrid,
  DatePickerGridHead,
  DatePickerGridRow,
  DatePickerHeadCell,
  DatePickerGridBody,
  DatePickerCell,
  DatePickerCellTrigger,
} from "reka-ui";

import Icon from "@/components/ui/Icon.vue";
import { usePortalTarget } from "@/composables/ui/useTeleportTarget";

const props = withDefaults(
  defineProps<{
    modelValue?: Date | string | null;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: null,
    placeholder: "",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: Date | null];
}>();

/*
 * The editor is rendered inside a ShadowRoot.
 *
 * Reka's DatePickerContent supports portal configuration,
 * so we keep the popover inside that same shadow root.
 */
const portalTarget = usePortalTarget();

const open = ref(false);

/* =========================================================
   JS Date / string -> CalendarDate
   ========================================================= */

const calendarValue = computed<CalendarDate | undefined>(() => {
  const value = props.modelValue;

  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  /*
   * Deliberately use LOCAL date parts.
   *
   * Do not use toISOString(), because that can move the date
   * backward/forward depending on timezone.
   */
  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
});

/* =========================================================
   CalendarDate -> JS Date
   ========================================================= */

function onChange(value: any) {
  if (!value) {
    emit("update:modelValue", null);
    return;
  }

  /*
   * Reka gives us a CalendarDate:
   *
   * {
   *   year,
   *   month,
   *   day
   * }
   */

  const date = new Date(value.year, value.month - 1, value.day);

  emit("update:modelValue", date);
}

/* =========================================================
   OPEN STATE
   ========================================================= */

function onOpenChange(value: boolean) {
  open.value = value;
}
</script>

<template>
  <DatePickerRoot
    :model-value="calendarValue"
    :open="open"
    :disabled="props.disabled"
    :close-on-select="true"
    granularity="day"
    @update:model-value="onChange"
    @update:open="onOpenChange"
  >
    <!-- ===================================================
         DATE FIELD
         =================================================== -->

    <DatePickerField v-slot="{ segments }" class="md-dp__field">
      <template v-for="item in segments" :key="item.part">
        <!-- Literal separators -->

        <DatePickerInput
          v-if="item.part === 'literal'"
          :part="item.part"
          class="md-dp__lit"
        >
          {{ item.value }}
        </DatePickerInput>

        <!-- Day / month / year segments -->

        <DatePickerInput v-else :part="item.part" class="md-dp__seg">
          {{ item.value }}
        </DatePickerInput>
      </template>

      <!-- Calendar trigger -->

      <DatePickerTrigger
        class="md-dp__trigger"
        type="button"
        aria-label="Open date picker"
      >
        <Icon name="chevron-down" />
      </DatePickerTrigger>
    </DatePickerField>

    <!-- ===================================================
         CALENDAR POPOVER
         =================================================== -->

    <DatePickerContent
      class="md-dp__content"
      :side-offset="4"
      :portal="{
        to: portalTarget,
      }"
    >
      <DatePickerCalendar v-slot="{ weekDays, grid }" class="md-dp__cal">
        <!-- =================================================
             HEADER
             ================================================= -->

        <DatePickerHeader class="md-dp__header">
          <!-- Previous month -->

          <DatePickerPrev class="md-dp__nav" aria-label="Previous month">
            <Icon name="chevron-right" style="transform: rotate(180deg)" />
          </DatePickerPrev>

          <!-- Current month / year -->

          <DatePickerHeading class="md-dp__heading" />

          <!-- Next month -->

          <DatePickerNext class="md-dp__nav" aria-label="Next month">
            <Icon name="chevron-right" />
          </DatePickerNext>
        </DatePickerHeader>

        <!-- =================================================
             MONTH GRID
             ================================================= -->

        <DatePickerGrid
          v-for="month in grid"
          :key="month.value.toString()"
          class="md-dp__grid"
        >
          <!-- =================================================
               WEEKDAY HEADER
               ================================================= -->

          <DatePickerGridHead>
            <DatePickerGridRow class="md-dp__row">
              <DatePickerHeadCell
                v-for="day in weekDays"
                :key="day"
                class="md-dp__headCell"
              >
                {{ day }}
              </DatePickerHeadCell>
            </DatePickerGridRow>
          </DatePickerGridHead>

          <!-- =================================================
               DATES
               ================================================= -->

          <DatePickerGridBody>
            <DatePickerGridRow
              v-for="(weekDates, index) in month.rows"
              :key="`${month.value}-${index}`"
              class="md-dp__row"
            >
              <DatePickerCell
                v-for="weekDate in weekDates"
                :key="weekDate.toString()"
                :date="weekDate"
              >
                <!--
                  IMPORTANT:

                  Explicitly render the trigger as a button.

                  Reka handles the selection behavior, while the
                  button guarantees that pointer interaction works
                  correctly inside the editor/shadow DOM.
                -->
                <DatePickerCellTrigger
                  as="button"
                  type="button"
                  :day="weekDate"
                  :month="month.value"
                  class="md-dp__day"
                >
                  {{ weekDate.day }}
                </DatePickerCellTrigger>
              </DatePickerCell>
            </DatePickerGridRow>
          </DatePickerGridBody>
        </DatePickerGrid>
      </DatePickerCalendar>
    </DatePickerContent>
  </DatePickerRoot>
</template>

<style>
/* =========================================================
   FIELD
   ========================================================= */

.md-dp__field {
  display: flex;
  align-items: center;
  gap: 0.0625rem;
  width: 100%;
  min-height: 32px;
  box-sizing: border-box;
  padding: 0.375rem 0.375rem 0.375rem 0.5rem;
  background: var(--md-surface);
  border: 1px solid var(--md-border);
  border-radius: 0.375rem;
  font-family: inherit;
  font-size: 13px;
  color: var(--md-text);
}

.md-dp__field:focus-within {
  border-color: var(--md-primary);
  box-shadow: 0 0 0 1px var(--md-primary);
}

/* =========================================================
   DATE SEGMENTS
   ========================================================= */

.md-dp__seg {
  padding: 0 0.0625rem;
  border-radius: 0.125rem;
  outline: none;
  font-family: inherit;
  font-size: 13px;
}

.md-dp__seg:focus {
  background: var(--md-primary);
  color: var(--md-surface);
}

.md-dp__seg[data-placeholder] {
  color: var(--md-text-subtle);
}

.md-dp__lit {
  color: var(--md-text-subtle);
}

/* =========================================================
   CALENDAR TRIGGER
   ========================================================= */

.md-dp__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  width: 20px;
  height: 20px;
  padding: 0.125rem;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  color: var(--md-text-subtle);
}

.md-dp__trigger:hover {
  color: var(--md-text-muted);
}

/* =========================================================
   CALENDAR POPOVER
   ========================================================= */

.md-dp__content {
  z-index: 999999;
  padding: 0.625rem;
  box-sizing: border-box;
  background: var(--md-surface);
  border: 1px solid var(--md-border);
  border-radius: 0.625rem;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.12),
    0 4px 6px -4px rgb(0 0 0 / 0.12);
}

/* =========================================================
   CALENDAR
   ========================================================= */

.md-dp__cal {
  width: max-content;
}

/* =========================================================
   HEADER
   ========================================================= */

.md-dp__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.md-dp__heading {
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--md-text);
}

/* =========================================================
   PREVIOUS / NEXT
   ========================================================= */

.md-dp__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0.25rem;
  border: 0;
  background: transparent;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 12px;
  color: var(--md-text-muted);
}

.md-dp__nav:hover {
  background: var(--md-surface-muted);
  color: var(--md-text);
}

.md-dp__nav:disabled {
  opacity: 0.4;
  cursor: default;
}

/* =========================================================
   GRID
   ========================================================= */

.md-dp__grid {
  width: 100%;
  border-collapse: collapse;
}

.md-dp__row {
  display: flex;
}

/* =========================================================
   WEEKDAY HEADER
   ========================================================= */

.md-dp__headCell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  color: var(--md-text-subtle);
}

/* =========================================================
   DAY BUTTON
   ========================================================= */

.md-dp__day {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  color: var(--md-text);
  border-radius: 0.3125rem;
  cursor: pointer;
  outline: none;
  transition:
    background 100ms ease,
    color 100ms ease;
}

.md-dp__day:hover {
  background: var(--md-surface-muted);
}

.md-dp__day:focus-visible {
  outline: 2px solid var(--md-primary);
  outline-offset: -2px;
}

/* =========================================================
   SELECTED DAY
   ========================================================= */

.md-dp__day[data-selected] {
  background: var(--md-primary);
  color: var(--md-surface);
  font-weight: 600;
}

.md-dp__day[data-selected]:hover {
  background: var(--md-primary);
}

/* =========================================================
   TODAY
   ========================================================= */

.md-dp__day[data-today]:not([data-selected]) {
  font-weight: 700;
  color: var(--md-primary);
}

/* =========================================================
   OUTSIDE / DISABLED
   ========================================================= */

.md-dp__day[data-outside-view] {
  color: var(--md-border-strong);
}

.md-dp__day[data-disabled] {
  color: var(--md-border-strong);

  cursor: default;
}

.md-dp__day[data-disabled]:hover {
  background: transparent;
}
</style>
