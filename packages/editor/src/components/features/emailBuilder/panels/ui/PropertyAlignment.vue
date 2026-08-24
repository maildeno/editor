<!-- PropertyAlignment.vue -->
<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600">
        Alignment
        <OverrideBadge :show="isOverridden" />
      </label>
      <button
        v-if="isOverridden"
        @click="$emit('reset')"
        class="text-[11px] text-green-500 hover:text-green-700 transition-colors"
      >
        ↩ Reset
      </button>
    </div>

    <div class="flex gap-1">
      <div
        v-for="option in options"
        :key="option.value"
        class="relative group/btn flex-1"
      >
        <button
          @click="$emit('update:modelValue', option.value)"
          class="w-full h-7 flex items-center justify-center rounded-md border transition-all duration-100 focus:outline-none"
          :class="modelValue === option.value
            ? 'bg-green-50 border-green-400 text-green-600'
            : 'border-gray-200/80 text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-300'"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="option.value === 'left'">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
            </template>
            <template v-else-if="option.value === 'center'">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
            </template>
            <template v-else-if="option.value === 'right'">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>
            </template>
            <template v-else-if="option.value === 'justify'">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </template>
          </svg>
        </button>

        <!-- Tooltip -->
        <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900">
          {{ option.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import OverrideBadge from "../shared/OverrideBadge.vue"

defineProps({
  modelValue: { type: String, default: 'left' },
  isOverridden: { type: Boolean, default: false },
})

defineEmits(['update:modelValue', 'reset'])

const options = [
  { value: 'left',    label: 'Align left'   },
  { value: 'center',  label: 'Align center' },
  { value: 'right',   label: 'Align right'  },
  { value: 'justify', label: 'Justify'      },
]
</script>