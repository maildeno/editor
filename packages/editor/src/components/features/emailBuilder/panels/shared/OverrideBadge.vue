<template>
  <span v-if="show" class="w-1 h-1 bg-(--md-selection) rounded-full inline-block" />
</template>

<script setup>
defineProps({
  show: Boolean,
})
</script>