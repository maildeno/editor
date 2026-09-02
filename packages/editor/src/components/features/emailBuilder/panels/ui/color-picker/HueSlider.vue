<template>
  <div
    class="relative h-2.5 rounded-full cursor-pointer select-none"
    style="
      background: linear-gradient(
        to right,
        #ff0000,
        #ffff00,
        #00ff00,
        #00ffff,
        #0000ff,
        #ff00ff,
        #ff0000
      );
    "
    @mousedown="startDrag"
    @touchstart.prevent="startDrag"
  >
    <div
      class="absolute top-1/2 w-3.5 h-3.5 bg-(--md-surface) rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
      :style="{
        left: `${(modelValue / 360) * 100}%`,
        boxShadow: '0 0 0 1.5px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)',
      }"
    />
  </div>
</template>

<script setup lang="ts">
defineProps({ modelValue: { type: Number, default: 0 } });
const emit = defineEmits(["update:modelValue"]);

const startDrag = (e: MouseEvent | TouchEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const getX = (ev: MouseEvent | TouchEvent) =>
    ("touches" in ev ? ev.touches[0] : ev).clientX;
  const move = (ev: MouseEvent | TouchEvent) => {
    const x = Math.min(Math.max(getX(ev) - rect.left, 0), rect.width);
    emit("update:modelValue", (x / rect.width) * 360);
  };
  move(e);
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move, { passive: false });
  const stop = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("touchmove", move);
  };
  window.addEventListener("mouseup", stop, { once: true });
  window.addEventListener("touchend", stop, { once: true });
};
</script>
