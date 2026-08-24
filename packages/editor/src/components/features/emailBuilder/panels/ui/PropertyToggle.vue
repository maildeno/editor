<template>
  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div class="flex-1">
      <label class="block text-xs font-medium text-gray-600">{{ label }}</label>
      <p v-if="description" class="text-xs text-gray-500 mt-1">{{ description }}</p>
    </div>
    <button
      @click="$emit('update:modelValue', !modelValue)"
      :class="[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ml-3',
        modelValue ? activeColor : 'bg-gray-300',
      ]"
    >
      <span
        :class="[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
          modelValue ? 'translate-x-5' : 'translate-x-0.75',
        ]"
      />
    </button>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  description: { type: String, default: null },
  modelValue: { type: Boolean, default: false },
  activeColor: { type: String, default: 'bg-green-400' },
})

defineEmits(['update:modelValue'])
</script>