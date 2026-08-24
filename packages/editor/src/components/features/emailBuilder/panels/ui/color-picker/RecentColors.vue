<template>
  <div v-if="colors.length" class="mt-3">
    <p class="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-1.5">Recent</p>
    <div class="flex gap-1 flex-wrap">
      <button
        v-for="c in colors"
        :key="c"
        class="w-5 h-5 rounded border border-black/10 cursor-pointer transition-transform hover:scale-110 hover:shadow-sm shrink-0"
        :class="c === 'transparent' ? 'transparent-swatch' : ''"
        :style="c !== 'transparent' ? { background: c } : {}"
        :title="c"
        @click="$emit('select', c)"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({ colors: { type: Array, default: () => [] } });
defineEmits(['select']);
</script>

<style scoped>
.transparent-swatch {
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 6px 6px;
  background-position: 0 0, 0 3px, 3px -3px, -3px 0;
  background-color: white;
}
</style>