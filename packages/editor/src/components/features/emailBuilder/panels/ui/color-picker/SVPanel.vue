<template>
  <div
    class="relative h-37.5 rounded-md overflow-hidden cursor-crosshair select-none"
    :style="{ background: `hsl(${h}, 100%, 50%)` }"
    @mousedown="startDrag"
    @touchstart.prevent="startDrag"
  >
    <div class="absolute inset-0" style="background: linear-gradient(to right, #fff, transparent)" />
    <div class="absolute inset-0" style="background: linear-gradient(to top, #000, transparent)" />
    <div
      class="absolute w-3 h-3 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
      :style="{
        left: `${s * 100}%`,
        top: `${(1 - v) * 100}%`,
        border: '2px solid white',
        boxShadow: '0 0 0 1.5px rgba(0,0,0,0.35)',
      }"
    />
  </div>
</template>

<script setup>
defineProps({ h: Number, s: Number, v: Number });
const emit = defineEmits(['update:s', 'update:v']);

const startDrag = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const coords = (ev) => ev.touches ? ev.touches[0] : ev;
  const move = (ev) => {
    const { clientX, clientY } = coords(ev);
    emit('update:s', Math.min(Math.max(clientX - rect.left, 0), rect.width) / rect.width);
    emit('update:v', 1 - Math.min(Math.max(clientY - rect.top, 0), rect.height) / rect.height);
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