<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Enter URL"
    :style="{ width: '400px' }"
    :draggable="false"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label for="url" class="text-sm font-medium">URL</label>
        <InputText
          id="url"
          v-model="url"
          placeholder="https://example.com"
          class="w-full"
          @keyup.enter="submit"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" @click="close" severity="secondary" />
      <Button label="Apply" @click="submit" autofocus />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import InputText from "@/components/ui/primitives/InputText.vue";
import Button from "@/components/ui/primitives/Button.vue";
import Dialog from "@/components/ui/primitives/Dialog.vue";
import { ref, watch } from "vue";

const props = defineProps({
  modelValue: Boolean,
  initialUrl: String,
});

const emit = defineEmits(["update:modelValue", "submit"]);

const visible = ref(props.modelValue);
const url = ref(props.initialUrl || "");

watch(
  () => props.modelValue,
  (newVal) => {
    visible.value = newVal;
    if (newVal) {
      url.value = props.initialUrl || "";
    }
  },
);

watch(visible, (newVal) => {
  emit("update:modelValue", newVal);
});

const close = () => {
  visible.value = false;
};

const submit = () => {
  if (url.value) {
    emit("submit", {
      url: url.value,
    });
  }
  close();
};
</script>
