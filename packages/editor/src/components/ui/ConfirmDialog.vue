<script setup lang="ts">
/**
 * Renders whatever useConfirm().require() most recently queued. Mounted
 * once at the EmailEditor root; call sites never touch it directly.
 *
 * Built on the local Dialog primitive, so it inherits the correct portal
 * target and stays inside the shadow root.
 */
import Dialog from "./primitives/Dialog.vue";
import Button from "./primitives/Button.vue";
import Icon from "./Icon.vue";
import {
  activeConfirm,
  confirmVisible,
  acceptActive,
  rejectActive,
} from "@/composables/ui/useConfirm";
</script>

<template>
  <Dialog
    :visible="confirmVisible"
    :header="activeConfirm?.header"
    @update:visible="
      (v: boolean) => {
        if (!v) rejectActive();
      }
    "
  >
    <div class="md-confirm__body">
      <Icon name="exclamation-triangle" class="md-confirm__icon" />
      <p class="md-confirm__message">{{ activeConfirm?.message }}</p>
    </div>
    <template #footer>
      <Button
        severity="secondary"
        :class="activeConfirm?.rejectClass"
        :label="activeConfirm?.rejectLabel ?? 'Cancel'"
        @click="rejectActive"
      />
      <Button
        severity="danger"
        :class="activeConfirm?.acceptClass"
        :label="activeConfirm?.acceptLabel ?? 'Yes'"
        @click="acceptActive"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.md-confirm__body {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.md-confirm__icon {
  font-size: 22px;
  color: var(--md-warning);
  flex-shrink: 0;
  margin-top: 0.125rem;
}
.md-confirm__message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-text);
}
</style>
