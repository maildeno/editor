<template>
  <div
    class="relative h-2.5 rounded-full cursor-pointer select-none overflow-hidden"
    @mousedown="startDrag"
    @touchstart.prevent="startDrag"
  >
    <!-- Checkerboard base -->
    <div
      class="absolute inset-0 rounded-full"
      style="
        background-image: linear-gradient(45deg,#ccc 25%,transparent 25%),
          linear-gradient(-45deg,#ccc 25%,transparent 25%),
          linear-gradient(45deg,transparent 75%,#ccc 75%),
          linear-gradient(-45deg,transparent 75%,#ccc 75%);
        background-size: 8px 8px;
        background-position: 0 0, 0 4px, 4px -4px, -4px 0;
        background-color: white;
      "
    />
    <!-- Color gradient overlay -->
    <div
      class="absolute inset-0 rounded-full"
      :style="{ background: `linear-gradient(to right, transparent, rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}))` }"
    />
    <!-- Thumb -->
    <div
      class="absolute top-1/2 w-3.5 h-3.5 bg-white rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
      :style="{ left: `${modelValue * 100}%`, boxShadow: '0 0 0 1.5px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)' }"
    />
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Number, default: 1 },
  rgb: { type: Array, default: () => [0, 0, 0] },
});
const emit = defineEmits(['update:modelValue']);

const startDrag = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const getX = (ev) => (ev.touches ? ev.touches[0] : ev).clientX;
  const move = (ev) => {
    const x = Math.min(Math.max(getX(ev) - rect.left, 0), rect.width);
    emit('update:modelValue', x / rect.width);
  };
  move(e);
  window.addEventListener('mousemove', move);
  window.addEventListener('touchmove', move, { passive: false });
  const stop = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('touchmove', move);
  };
  window.addEventListener('mouseup', stop, { once: true });
  window.addEventListener('touchend', stop, { once: true });
};
</script>