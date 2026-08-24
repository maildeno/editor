<template>
  <div class="relative group">
    <!-- Tooltip -->
    <div
      class="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ease-out"
    >
      <div
        class="relative bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg"
      >
        {{ label }}
        <!-- Arrow -->
        <span
          class="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-gray-900 rotate-45"
        />
      </div>
    </div>

    <!-- Block Button -->
    <button
      @click="handleClick"
      draggable="true"
      @dragstart="handleDragStart"
      :disabled="!canAdd && !isDragging"
      :class="[
        'size-11 rounded-xl border-2 transition-all duration-150 grid place-content-center group/inner',
        'border-gray-200/80 hover:border-green-400 hover:bg-green-50',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'active:scale-95',
      ]"
      :aria-label="label"
    >
      <!-- Icon wrapper — subtle color shift on hover -->
      <div
        class="size-[18px] text-gray-500/85 group-hover/inner:text-green-600 transition-colors duration-150"
      >
        <slot />
      </div>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useInfoDialog } from "@/composables/ui/useInfoDialog";

const props = defineProps({
  /** Human-readable label used in the tooltip and info dialog */
  label: { type: String, required: true },
  /** Component type string passed to addComponent / dataTransfer */
  componentType: { type: String, required: true },
});

const { open } = useInfoDialog();
const { addComponent, selectedColumn } = useEmailBuilder();

const isDragging = ref(false);
const canAdd = computed(() => selectedColumn.value !== null);

const handleClick = () => {
  if (!selectedColumn.value) {
    open(
      "Please select a column in the canvas first or drag and drop component",
      props.label,
    );
    return;
  }
  addComponent(
    selectedColumn.value.rowId,
    selectedColumn.value.columnId,
    props.componentType,
  );
};

const handleDragStart = (e) => {
  isDragging.value = true;
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("text/plain", "new-component");
  e.dataTransfer.setData("componentType", props.componentType);
  e.dataTransfer.setData("isNewComponent", "true");

  const ghost = e.target.cloneNode(true);
  ghost.style.opacity = "0.5";
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 0, 0);
  setTimeout(() => document.body.removeChild(ghost), 0);
};
</script>