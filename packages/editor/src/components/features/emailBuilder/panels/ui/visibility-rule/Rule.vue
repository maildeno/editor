<template>
  <div
    class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center px-3 py-3.25 text-xs min-w-75 sm:min-w-105 mb-2"
  >
    <!-- Tag -->
    <div class="flex sm:hidden text-[10px] text-(--md-text-subtle) -mb-1">
      Tag
    </div>
    <div class="sm:col-span-3">
      <input
        :value="rule.tag"
        type="text"
        placeholder="tag"
        class="mg-md-input"
        @input="rule.tag = ($event.target as HTMLInputElement).value"
        @blur="$emit('change')"
      />
    </div>

    <!-- Operator -->
    <div class="flex sm:hidden text-[10px] text-(--md-text-subtle) -mb-1">
      Operator
    </div>
    <div class="sm:col-span-4 relative">
      <Select
        :model-value="rule.operator"
        :options="OPERATOR_OPTIONS"
        optionLabel="label"
        optionValue="value"
        class="w-full text-sm"
        placeholder="operator"
        @update:model-value="onOperatorChange($event)"
      />
      <p
        v-if="isNumeric(rule.operator)"
        class="absolute -bottom-3.5 text-[9px] text-(--md-info) leading-snug"
      >
        numeric comparison
      </p>
      <p
        v-else-if="isList(rule.operator)"
        class="absolute -bottom-5.5 text-[9px] text-(--md-accent) leading-snug"
      >
        comma, semicolon, or newline separated
      </p>
      <p
        v-else-if="isDate(rule.operator)"
        class="absolute -bottom-3.5 text-[9px] text-rose-400 leading-snug"
      >
        date YYYY-MM-DD
      </p>
      <p
        v-else-if="isValueless(rule.operator)"
        class="absolute -bottom-3.5 text-[9px] text-(--md-text-subtle) leading-snug"
      >
        no value required
      </p>
    </div>

    <!-- Value -->
    <div
      class="flex sm:hidden text-[10px] text-(--md-text-subtle) -mb-1"
      v-if="!isValueless(rule.operator)"
    >
      Value
    </div>
    <div
      class="sm:col-span-4"
      :class="{ 'opacity-30 pointer-events-none': isValueless(rule.operator) }"
    >
      <!-- Date picker for date operators -->
      <DatePicker
        v-if="isDate(rule.operator)"
        :model-value="rule.value ? new Date(rule.value) : null"
        @update:model-value="onDateChange($event)"
        dateFormat="yy-mm-dd"
        placeholder="YYYY-MM-DD"
        showIcon
        iconDisplay="input"
        inputClass="w-full h-[32px] py-[8px] px-2 text-[13px] outline-1 outline-(--md-border) rounded-md focus:outline-none focus:ring-[1px] focus:ring-(--md-selection) text-sm"
        class="w-full"
      />
      <!-- Standard input for all other operators -->
      <input
        v-else
        :value="rule.value"
        :type="inputType(rule.operator)"
        :placeholder="valuePlaceholder(rule.operator)"
        :disabled="isValueless(rule.operator)"
        class="mg-md-input"
        @input="rule.value = ($event.target as HTMLInputElement).value"
        @blur="$emit('change')"
      />
    </div>

    <!-- Delete -->
    <div class="sm:col-span-1 flex justify-end sm:justify-center mt-1 sm:mt-0">
      <div class="relative group/btn">
        <button
          type="button"
          @click="$emit('remove')"
          class="w-7 h-7 flex items-center justify-center text-(--md-text-subtle) hover:text-(--md-danger) hover:bg-(--md-danger-bg) rounded-md transition-colors focus:outline-none"
          aria-label="Remove rule"
        >
          <Icon name="times" style="font-size: 13px" />
        </button>
        <div
          class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-(--md-tooltip-bg)"
        >
          Remove rule
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import {
  OPERATOR_OPTIONS,
  VALUELESS_OPERATORS,
  LIST_OPERATORS,
  NUMERIC_OPERATORS,
  DATE_OPERATORS,
  type VisibilityOperator,
} from "@/composables/emailBuilder/core/useEmailBuilderVisibility";
import Select from "@/components/ui/primitives/Select.vue";
// Lazy: the only DatePicker in the app, and it pulls all of
const DatePicker = defineAsyncComponent(
  () => import("@/components/ui/primitives/DatePicker.vue"),
);
import Icon from "@/components/ui/Icon.vue";

const props = defineProps({
  rule: {
    type: Object as () => {
      tag: string;
      operator: VisibilityOperator;
      value: string;
    },
    required: true,
  },
});

// FIX: added 'change' emit so PropertyVisibility can call saveToHistory
// after the user finishes editing a field (blur/select) rather than on
// every single keystroke, keeping history entries to one per logical edit.
const emit = defineEmits<{
  (e: "remove"): void;
  (e: "change"): void;
}>();

// ── Operator classification helpers ──────────────────────────────────────────

const isValueless = (op: string) =>
  VALUELESS_OPERATORS.includes(op as VisibilityOperator);
const isList = (op: string) =>
  LIST_OPERATORS.includes(op as VisibilityOperator);
const isNumeric = (op: string) =>
  NUMERIC_OPERATORS.includes(op as VisibilityOperator);
const isDate = (op: string) =>
  DATE_OPERATORS.includes(op as VisibilityOperator);

// ── Input type ────────────────────────────────────────────────────────────────

const inputType = (op: string): string => {
  if (isNumeric(op)) return "number";
  return "text";
};

// ── Placeholder text ──────────────────────────────────────────────────────────

const valuePlaceholder = (op: string): string => {
  if (isValueless(op)) return "—";
  if (isList(op)) return "uk, usa; ca";
  if (isNumeric(op)) return "0";
  if (isDate(op)) return "YYYY-MM-DD";
  if (op === "starts_with") return "prefix…";
  if (op === "ends_with") return "…suffix";
  return "value";
};

// ── Handlers — emit 'change' after every logical edit so the parent can
//    call saveToHistory at the right granularity (not per keystroke) ──────────

// Operator is a select — change fires immediately on selection
const onOperatorChange = (value: unknown) => {
  props.rule.operator = value as VisibilityOperator;
  emit("change");
};

// DatePicker emits a Date object — convert to string then notify parent
const onDateChange = (date: Date | null) => {
  props.rule.value = formatDate(date);
  emit("change");
};

// ── Date formatter ────────────────────────────────────────────────────────────

const formatDate = (date: Date | null): string => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
</script>
