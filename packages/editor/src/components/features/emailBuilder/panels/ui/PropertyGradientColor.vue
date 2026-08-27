<template>
  <div class="space-y-4">
    <!-- Solid / Gradient toggle -->
    <div class="flex bg-(--md-surface-muted) p-0.5 rounded-lg">
      <button
        type="button"
        @click="setMode('solid')"
        class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
        :class="!localValue.useGradient ? 'bg-(--md-surface) shadow-sm' : 'text-(--md-text-subtle)'"
      >
        Solid
      </button>
      <button
        type="button"
        @click="setMode('gradient')"
        class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
        :class="localValue.useGradient ? 'bg-(--md-surface) shadow-sm' : 'text-(--md-text-subtle)'"
      >
        Gradient
      </button>
    </div>

    <!-- Solid Mode -->
    <div v-if="!localValue.useGradient">
      <PropertyColor
        label="Color"
        :model-value="localValue.solid"
        placeholder="#ffffff"
        :allow-transparent="true"
        :is-overridden="isOverridden"
        @update:model-value="updateSolid"
        @reset="$emit('reset')"
      />
    </div>

    <!-- Gradient Mode -->
    <div v-else class="space-y-3">
      <!-- Preview bar -->
      <div
        class="h-8 rounded-lg border border-(--md-border)"
        :style="{ background: previewStyle }"
      />

      <!-- Type & Direction -->
      <div class="flex items-center gap-2">
        <div class="flex bg-(--md-surface-muted) rounded-lg p-1.25">
          <button
            @click="updateGradientField('type', 'linear')"
            class="px-3 py-0.75 text-xs rounded-md transition-all"
            :class="localValue.gradient.type === 'linear' ? 'bg-(--md-surface) shadow-sm' : 'text-(--md-text-subtle)'"
          >
            Linear
          </button>
          <button
            @click="updateGradientField('type', 'radial')"
            class="px-3 py-0.75 text-xs rounded-md transition-all"
            :class="localValue.gradient.type === 'radial' ? 'bg-(--md-surface) shadow-sm' : 'text-(--md-text-subtle)'"
          >
            Radial
          </button>
        </div>

        <div v-if="localValue.gradient.type === 'linear'" class="flex-1">
          <Select
            :model-value="localValue.gradient.direction"
            @update:model-value="updateGradientField('direction', $event)"
            :options="directionOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full text-sm"
            placeholder="Direction"
          />
        </div>
      </div>

      <!-- Color stops -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-medium text-(--md-text-subtle)">Color stops</label>
          <button
            @click="addStop"
            class="text-xs text-(--md-text-subtle) hover:text-(--md-text-muted) flex items-center gap-1"
          >
            <Icon name="plus" style="font-size: 9px" />
            Add stop
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <div
            v-for="(stop, index) in localValue.gradient.colors"
            :key="index"
            class="flex items-center gap-1 bg-(--md-surface) border border-(--md-border) rounded-full pl-1 pr-2 py-0.5 shadow-sm hover:border-(--md-border-strong) transition-colors"
          >
            <PropertyColor
              :bare="true"
              :model-value="stop.color"
              @update:model-value="updateStopColor(index, $event)"
            />

            <!-- Position input -->
            <div class="flex items-center">
              <input
                type="number"
                :value="stop.position"
                @input="updateStopPosition(index, ($event.target as HTMLInputElement).value)"
                @blur="validatePosition(index)"
                min="0"
                max="100"
                step="1"
                class="w-10 px-1 py-0 text-xs text-center border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span class="text-xs text-(--md-text-subtle)">%</span>
            </div>

            <!-- Remove (only when > 2 stops) -->
            <button
              v-if="localValue.gradient.colors.length > 2"
              @click.stop="removeStop(index)"
              class="flex items-center text-(--md-text-subtle) hover:text-(--md-danger) ml-0.5 transition-colors leading-none"
            >
              <Icon name="times" style="font-size: 8px" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import PropertyColor from "./PropertyColor.vue";
import Select from "@/components/ui/primitives/Select.vue";
import Icon from "@/components/ui/Icon.vue";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GradientStop {
  color: string;
  position: number;
}

export interface GradientConfig {
  type: "linear" | "radial";
  direction: string;
  colors: GradientStop[];
}

export interface BackgroundValue {
  useGradient: boolean;
  solid: string;
  gradient: GradientConfig;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_BG: BackgroundValue = {
  useGradient: false,
  solid: "#007bff",
  gradient: {
    type: "linear",
    direction: "to right",
    colors: [
      { color: "#007bff", position: 0 },
      { color: "#00ff88", position: 100 },
    ],
  },
};

// ─── Props / Emits ───────────────────────────────────────────────────────────

const props = defineProps<{
  modelValue?: BackgroundValue;
  isOverridden?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: BackgroundValue): void;
  (e: "reset"): void;
}>();

// ─── Local state ─────────────────────────────────────────────────────────────

const localValue = ref<BackgroundValue>(deepClone(props.modelValue ?? DEFAULT_BG));
const isInternalUpdate = ref(false);

const previewStyle = computed(() => {
  const { type, direction, colors } = localValue.value.gradient;
  const stops = colors.map((c) => `${c.color} ${c.position}%`).join(", ");
  return type === "linear"
    ? `linear-gradient(${direction}, ${stops})`
    : `radial-gradient(circle at center, ${stops})`;
});

// ─── Watchers ────────────────────────────────────────────────────────────────

// Sync external → local (parent pushes a new value in, e.g. on reset)
watch(
  () => props.modelValue,
  (v) => {
    if (!isInternalUpdate.value && v) {
      localValue.value = deepClone(v);
    }
  },
  { deep: true },
);

// Sync local → parent (only when the value actually changed)
watch(
  localValue,
  (newVal) => {
    if (isInternalUpdate.value) return;

    const isDifferent =
      JSON.stringify(newVal) !== JSON.stringify(props.modelValue ?? DEFAULT_BG);

    if (isDifferent) {
      isInternalUpdate.value = true;
      emit("update:modelValue", deepClone(newVal));
      nextTick(() => {
        isInternalUpdate.value = false;
      });
    }
  },
  { deep: true },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Handlers ────────────────────────────────────────────────────────────────

function setMode(mode: "solid" | "gradient") {
  localValue.value.useGradient = mode === "gradient";
}

function updateSolid(color: string) {
  localValue.value.solid = color;
}

function updateGradientField(field: keyof GradientConfig, value: any) {
  (localValue.value.gradient as any)[field] = value;
}

function updateStopColor(index: number, color: string) {
  localValue.value.gradient.colors[index].color = color;
}

function updateStopPosition(index: number, raw: string) {
  localValue.value.gradient.colors[index].position =
    Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
}

function validatePosition(index: number) {
  const stop = localValue.value.gradient.colors[index];
  stop.position = Math.min(100, Math.max(0, stop.position));
}

function addStop() {
  const colors = localValue.value.gradient.colors;
  const lastPos = colors[colors.length - 1]?.position ?? 80;
  colors.push({ color: "#888888", position: Math.min(100, lastPos + 10) });
}

function removeStop(index: number) {
  localValue.value.gradient.colors.splice(index, 1);
}

// ─── Direction options ───────────────────────────────────────────────────────

const directionOptions = [
  { label: "Left → Right", value: "to right" },
  { label: "Right → Left", value: "to left" },
  { label: "Top → Bottom", value: "to bottom" },
  { label: "Bottom → Top", value: "to top" },
  { label: "Diagonal ↘",   value: "135deg" },
  { label: "Diagonal ↗",   value: "45deg" },
];
</script>