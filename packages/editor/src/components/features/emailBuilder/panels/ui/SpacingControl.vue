<template>
  <div class="bg-[var(--md-surface)] border border-[var(--md-border)] rounded-xl p-4 space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="text-xs font-medium text-[var(--md-text-muted)]">{{ label }}</h4>
      <div class="flex items-center gap-3">
        <!-- Lock / Unlock with tooltip -->
        <div class="relative group/btn">
          <button
            type="button"
            @click="linked = !linked"
            class="w-7 h-7 flex items-center justify-center text-[var(--md-text-subtle)] hover:text-[var(--md-selection)] hover:bg-[var(--md-surface-hover)] rounded-md transition-colors focus:outline-none"
            :aria-label="linked ? 'Unlink sides' : 'Link all sides'"
            :aria-pressed="linked"
          >
            <Icon :name="linked ? 'lock' : 'lock-open'" style="font-size: 13px" />
          </button>

          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[var(--md-tooltip-bg)] text-[var(--md-tooltip-text)] text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[var(--md-tooltip-bg)]"
          >
            {{ linked ? "Unlink sides" : "Link all sides" }}
          </div>
        </div>
        <button
          v-if="isMobileEdit && hasOverride"
          type="button"
          @click="$emit('update:modelValue', null)"
          class="text-xs text-[var(--md-selection-fg)] hover:opacity-80 hover:underline transition-colors focus:outline-none"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- 3×3 Box Model Layout -->
    <div class="grid grid-cols-3 gap-2 text-center text-xs items-center">
      <!-- Row 1 -->
      <div />
      <SpacingSideInput :value="local.top" @update="setSide('top', $event)" />
      <div />

      <!-- Row 2 -->
      <SpacingSideInput :value="local.left" @update="setSide('left', $event)" />
      <div
        class="border border-[var(--md-border-strong)] border-dashed rounded-lg py-2.75 text-[var(--md-text-subtle)] text-xs capitalize tracking-wide font-medium"
      >
        {{ label?.slice(0, 3).toLowerCase() }}
      </div>
      <SpacingSideInput
        :value="local.right"
        @update="setSide('right', $event)"
      />

      <!-- Row 3 -->
      <div />
      <SpacingSideInput
        :value="local.bottom"
        @update="setSide('bottom', $event)"
      />
      <div />
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/ui/Icon.vue";
import { h, ref, computed } from "vue";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * SpacingControl
 * modelValue shape: { top, right, bottom, left } (numbers, px units)
 * When isMobileEdit=true and modelValue is null, it falls back to desktopValue for display.
 */

// Inline sub-component using render function (no runtime template compiler needed)
const SpacingSideInput = {
  props: { value: { type: Number, default: 0 } },
  emits: ["update"],
  setup(
    props: { value: number },
    { emit }: { emit: (event: string, ...args: any[]) => void },
  ) {
    return () =>
      h(
        "div",
        {
          class:
            "flex items-center border border-[var(--md-border)] hover:border-[var(--md-border-strong)] rounded-md overflow-hidden transition-colors bg-[var(--md-surface)]",
        },
        [
          h(
            "button",
            {
              type: "button",
              class:
                "px-1.5 py-0.5 hover:bg-[var(--md-surface-hover)] active:bg-[var(--md-surface-muted)] transition-colors focus:outline-none",
              onClick: () => emit("update", Math.max(0, props.value - 1)),
              "aria-label": "Decrease",
            },
            [
              h(Icon, {
                name: "minus",
                class: "text-[var(--md-text-subtle)]",
                style: "font-size:10px",
              }),
            ],
          ),

          h("input", {
            value: props.value,
            type: "number",
            min: 0,
            class:
              "w-7 py-0.5 text-xs text-center border-l border-r border-[var(--md-border)] focus:outline-none bg-transparent text-[var(--md-text)]",
            onInput: (e: Event) =>
              emit("update", Number((e.target as HTMLInputElement).value)),
          }),

          h(
            "button",
            {
              type: "button",
              class:
                "px-1.5 py-0.5 hover:bg-[var(--md-selection-bg)] active:bg-[var(--md-selection)]/20 transition-colors focus:outline-none",
              onClick: () => emit("update", props.value + 1),
              "aria-label": "Increase",
            },
            [
              h(Icon, {
                name: "plus",
                class: "text-[var(--md-text-subtle)]",
                style: "font-size:10px",
              }),
            ],
          ),
        ],
      );
  },
};

const props = defineProps<{
  label?: string;
  modelValue: SpacingValue | null;
  desktopValue?: SpacingValue | null;
  isMobileEdit?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: SpacingValue | null): void;
}>();

const linked = ref(false);

// Resolved display value (falls back to desktop when mobile has no override)
const resolved = computed<SpacingValue | null>(() => {
  if (props.isMobileEdit && !props.modelValue)
    return props.desktopValue ?? null;
  return props.modelValue;
});

const hasOverride = computed(() => props.isMobileEdit && !!props.modelValue);

const local = computed<SpacingValue>(
  () => resolved.value ?? { top: 0, right: 0, bottom: 0, left: 0 },
);

const setSide = (side: keyof SpacingValue, value: number) => {
  const base: SpacingValue = { ...local.value };
  if (linked.value) {
    base.top = base.right = base.bottom = base.left = value;
  } else {
    base[side] = value;
  }
  emit("update:modelValue", base);
};
</script>