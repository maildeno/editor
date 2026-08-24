<script setup lang="ts">
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";

interface Props {
  message?: string;
}

defineProps<Props>();
const teleportTarget = useTeleportTarget();
</script>

<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
  <div
    class="fixed inset-0 flex items-center justify-center bg-black/70"
    style="z-index: 100;"
  >
    <div class="text-center px-4">
      <div class="spinner"></div>
      <!-- <div class="mt-4 text-xl font-semibold text-green-400">
        {{ message }}
      </div> -->
    </div>
  </div>
</Teleport>
</template>

<style scoped>
.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(0, 0, 0, 0.2);
  border-top-color: #05df72;
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
