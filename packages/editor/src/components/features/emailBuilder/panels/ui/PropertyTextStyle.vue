<!-- PropertyTextStyle.vue -->
<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <label class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[.02em] text-gray-600">
        Text Style
        <OverrideBadge :show="isTransformOverridden || isDecorationOverridden" />
      </label>
      <button
        v-if="isTransformOverridden || isDecorationOverridden"
        @click="handleResetAll"
        class="text-[11px] text-green-500 hover:text-green-700 transition-colors"
      >
        Reset all
      </button>
    </div>

    <div class="flex gap-2">
      <!-- Transform group -->
      <div class="flex-1 flex flex-col gap-1.5">
        <span class="text-[10px] font-medium uppercase tracking-[.05em] text-gray-600">Transform</span>
        <div class="flex gap-1">
          <div
            v-for="opt in transformOptions"
            :key="opt.value"
            class="relative group/btn flex-1"
          >
            <button
              @click="handleTransformChange(opt.value)"
              class="toggle-btn w-full"
              :class="transformValue === opt.value ? 'toggle-btn--active' : 'toggle-btn--idle'"
            >
              <span :class="opt.glyphClass" :style="opt.glyphStyle">{{ opt.glyph }}</span>
            </button>
            <!-- Tooltip -->
            <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900">
              {{ opt.label }}
            </div>
          </div>
        </div>
      </div>

      <div class="w-px bg-gray-100 self-stretch mx-0.5" />

      <!-- Decoration group -->
      <div class="flex-1 flex flex-col gap-1.5">
        <span class="text-[10px] font-medium uppercase tracking-[.05em] text-gray-600">Decoration</span>
        <div class="flex gap-1">
          <div
            v-for="opt in decorationOptions"
            :key="opt.value"
            class="relative group/btn flex-1"
          >
            <button
              @click="handleDecorationChange(opt.value)"
              class="toggle-btn w-full"
              :class="decorationValue === opt.value ? 'toggle-btn--active' : 'toggle-btn--idle'"
            >
              <span :class="opt.glyphClass" :style="opt.glyphStyle">{{ opt.glyph }}</span>
            </button>
            <!-- Tooltip -->
            <div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900">
              {{ opt.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import OverrideBadge from '../shared/OverrideBadge.vue'

const props = defineProps({
  transformValue:         { type: String,  default: 'none'  },
  decorationValue:        { type: String,  default: 'none'  },
  isTransformOverridden:  { type: Boolean, default: false   },
  isDecorationOverridden: { type: Boolean, default: false   },
})

const emit = defineEmits(['update:transform', 'update:decoration', 'reset-transform', 'reset-decoration'])

const transformOptions = [
  { value: 'none',       label: 'None',       glyph: '—',  glyphClass: 'text-[13px] leading-none opacity-40', glyphStyle: {} },
  { value: 'uppercase',  label: 'Uppercase',  glyph: 'AA', glyphClass: 'text-[10px] font-semibold leading-none tracking-wide', glyphStyle: {} },
  { value: 'lowercase',  label: 'Lowercase',  glyph: 'aa', glyphClass: 'text-[10px] font-medium leading-none tracking-wide', glyphStyle: {} },
  { value: 'capitalize', label: 'Capitalize', glyph: 'Aa', glyphClass: 'text-[11px] font-medium leading-none', glyphStyle: {} },
]

const decorationOptions = [
  { value: 'none',         label: 'None',          glyph: '—', glyphClass: 'text-[13px] leading-none opacity-40', glyphStyle: {} },
  { value: 'underline',    label: 'Underline',     glyph: 'U', glyphClass: 'text-[11px] font-semibold leading-none', glyphStyle: { textDecoration: 'underline', textUnderlineOffset: '2px' } },
  { value: 'line-through', label: 'Strikethrough', glyph: 'S', glyphClass: 'text-[11px] font-semibold leading-none', glyphStyle: { textDecoration: 'line-through' } },
  { value: 'overline',     label: 'Overline',      glyph: 'O', glyphClass: 'text-[11px] font-semibold leading-none', glyphStyle: { textDecoration: 'overline' } },
]

const handleTransformChange = (value) => {
  emit('update:transform', value)
  if (value === 'none' && props.isTransformOverridden) emit('reset-transform')
}

const handleDecorationChange = (value) => {
  emit('update:decoration', value)
  if (value === 'none' && props.isDecorationOverridden) emit('reset-decoration')
}

const handleResetAll = () => {
  emit('update:transform', 'none')
  emit('update:decoration', 'none')
  emit('reset-transform')
  emit('reset-decoration')
}
</script>

<style scoped>
.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border-radius: 6px;
  border: 0.5px solid transparent;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  background: transparent;
  padding: 0;
  outline: none;
}
.toggle-btn--idle {
  border-color: rgba(229,231,235,0.8);
  color: #99a1af;
}
.toggle-btn--idle:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #6b7280;
}
.toggle-btn--active {
  background: #f0fdf4;
  border-color: #4ade80;
  color: #16a34a;
}
.toggle-btn--active:hover {
  background: #dcfce7;
}
</style>