<script setup lang="ts">
import Button from "@/components/ui/primitives/Button.vue";
import Dialog from "@/components/ui/primitives/Dialog.vue";
import Icon from "@/components/ui/Icon.vue";
const props = defineProps<{
  visible: boolean;
  header?: string;
  message: string;
}>();

const emit = defineEmits(["update:visible"]);
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :closable="false"
    class="w-md"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <Icon name="info-circle" class="text-[var(--md-info)]" />
        <span>{{ header ?? "Info" }}</span>
      </div>
    </template>

    <p class="text-base text-[var(--md-text-muted)]">
      {{ message }}
    </p>

    <template #footer>
      <Button
        label="Ok"
        class="!bg-[var(--md-info)] !hover:opacity-90 !border-[var(--md-info)] !px-5"
        @click="emit('update:visible', false)"
      />
    </template>
  </Dialog>
</template>
