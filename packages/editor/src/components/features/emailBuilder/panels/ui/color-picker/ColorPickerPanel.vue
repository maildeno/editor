<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      ref="panelRef"
      data-color-panel
      class="fixed z-[9999] w-[272px] bg-white border border-black/10 rounded-xl shadow-2xl p-3 select-none"
      :style="positionStyle"
    >
      <SVPanel v-model:s="s" v-model:v="v" :h="h" />

      <div class="flex flex-col gap-1.5 mt-2">
        <HueSlider v-model="h" />
        <AlphaSlider v-model="a" :rgb="rgb" />
      </div>

      <div class="flex gap-1.5 mt-2.5">
        <div
          class="flex-1 h-6 rounded border border-black/10 relative group/btn"
          :style="{ background: cssColor }"
        >
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
          >
            Current color
          </div>
        </div>
        <div
          class="flex-1 h-6 rounded border border-black/10 opacity-50 cursor-pointer hover:opacity-100 transition-opacity relative group/btn"
          :style="{ background: initialColor }"
          @click="revertToInitial"
        >
          <div
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
          >
            Click to revert
          </div>
        </div>
      </div>

      <div class="flex mt-2.5 border-b border-gray-100" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab"
          role="tab"
          :aria-selected="activeTab === tab"
          class="relative pb-1.5 px-2 text-[10px] font-semibold tracking-wider transition-colors"
          :class="
            activeTab === tab
              ? 'text-gray-900'
              : 'text-gray-400 hover:text-gray-600'
          "
          @click="activeTab = tab"
        >
          {{ tab }}
          <span
            v-if="activeTab === tab"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-full"
          />
        </button>
      </div>

      <div class="flex gap-1 mt-2 items-end">
        <!-- HEX -->
        <template v-if="activeTab === 'HEX'">
          <div class="flex flex-col-reverse flex-[2] min-w-0">
            <input
              class="mg-md-input font-mono"
              :class="hexError ? 'ring-[1px] ring-red-400 outline-none' : ''"
              :value="hexInputValue"
              @input="onHexInput"
              @blur="onHexBlur"
              @keydown.enter="onHexBlur"
              @focus="hexInputValue = hex"
              spellcheck="false"
              maxlength="7"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >HEX</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="Math.round(a * 100)"
              @change="a = clamp($event.target.value, 0, 100) / 100"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >A%</label
            >
          </div>
        </template>

        <!-- RGB -->
        <template v-if="activeTab === 'RGB'">
          <div
            v-for="(ch, i) in ['R', 'G', 'B']"
            :key="ch"
            class="flex flex-col-reverse flex-1 min-w-0"
          >
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="255"
              :value="rgb[i]"
              @change="onRgbChange(i, $event.target.value)"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >{{ ch }}</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="Math.round(a * 100)"
              @change="a = clamp($event.target.value, 0, 100) / 100"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >A%</label
            >
          </div>
        </template>

        <!-- HSL -->
        <template v-if="activeTab === 'HSL'">
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="360"
              :value="hsl.h"
              @change="setFromHsl($event.target.value, hsl.s, hsl.l)"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >H°</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="hsl.s"
              @change="setFromHsl(hsl.h, $event.target.value, hsl.l)"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >S%</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="hsl.l"
              @change="setFromHsl(hsl.h, hsl.s, $event.target.value)"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >L%</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="Math.round(a * 100)"
              @change="a = clamp($event.target.value, 0, 100) / 100"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >A%</label
            >
          </div>
        </template>

        <!-- HSB -->
        <template v-if="activeTab === 'HSB'">
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="360"
              :value="hsb.h"
              @change="setFromHsb($event.target.value, hsb.s, hsb.b)"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >H°</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="hsb.s"
              @change="setFromHsb(hsb.h, $event.target.value, hsb.b)"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >S%</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="hsb.b"
              @change="setFromHsb(hsb.h, hsb.s, $event.target.value)"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >B%</label
            >
          </div>
          <div class="flex flex-col-reverse flex-1 min-w-0">
            <input
              class="mg-md-input font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number"
              min="0"
              max="100"
              :value="Math.round(a * 100)"
              @change="a = clamp($event.target.value, 0, 100) / 100"
            />
            <label
              class="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 pl-0.5"
              >A%</label
            >
          </div>
        </template>
      </div>

      <RecentColors :colors="recent" @select="onRecentSelect" />
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useColor } from "@/composables/system/useColor";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";
import SVPanel from "./SVPanel.vue";
import HueSlider from "./HueSlider.vue";
import AlphaSlider from "./AlphaSlider.vue";
import RecentColors from "./RecentColors.vue";

const props = defineProps({
  modelValue: { type: String, default: "#ff0000" },
  anchor: { type: Object, default: null },
});
const emit = defineEmits(["update:modelValue", "close"]);
const teleportTarget = useTeleportTarget();

const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);

const {
  h,
  s,
  v,
  a,
  rgb,
  hex,
  cssColor,
  hsl,
  hsb,
  setFromHex,
  setFromRgb,
  setFromHsl,
  setFromHsb,
} = useColor(props.modelValue);

const initialColor = ref(props.modelValue);
const revertToInitial = () => setFromHex(initialColor.value);

watch(cssColor, (val) => emit("update:modelValue", val));

const hexInputValue = ref(hex.value);
const hexError = ref(false);

watch(hex, (val) => {
  hexInputValue.value = val;
  hexError.value = false;
});

const onHexInput = (e) => {
  hexInputValue.value = e.target.value;
  hexError.value = false;
};
const onHexBlur = () => {
  const ok = setFromHex(hexInputValue.value);
  hexError.value = !ok;
  if (!ok) hexInputValue.value = hex.value;
};

const onRgbChange = (index, rawVal) => {
  const arr = [...rgb.value];
  arr[index] = clamp(rawVal, 0, 255);
  setFromRgb(...arr);
};

const RECENT_KEY = "maildeno_cp:recentColors";
const loadRecent = () => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const recent = ref(loadRecent());

const persistRecent = (val) => {
  const updated = [val, ...recent.value.filter((c) => c !== val)].slice(0, 16);
  recent.value = updated;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    /* storage full or unavailable — keep in-memory state, fail silently */
  }
};

const onRecentSelect = (color) => {
  if (color === "transparent") {
    emit("update:modelValue", "transparent");
    return;
  }
  const rgbaMatch = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (rgbaMatch) {
    setFromRgb(
      Number(rgbaMatch[1]),
      Number(rgbaMatch[2]),
      Number(rgbaMatch[3]),
    );
    a.value = rgbaMatch[4] !== undefined ? clamp(rgbaMatch[4], 0, 1) : 1;
    return;
  }
  setFromHex(color);
};

const tabs = ["HEX", "RGB", "HSL", "HSB"];
const activeTab = ref("HEX");

const GAP = 6;
const MARGIN = 8;
const panelRef = ref(null);
const positionStyle = ref({ top: "0px", left: "0px", visibility: "hidden" });

const computePosition = () => {
  if (!props.anchor || !panelRef.value) return;
  const anchor = props.anchor.getBoundingClientRect();
  const panelH = panelRef.value.offsetHeight;
  const panelW = panelRef.value.offsetWidth;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = anchor.bottom + GAP;
  let left = anchor.left;
  if (top + panelH > vh - MARGIN) {
    const aboveTop = anchor.top - panelH - GAP;
    if (aboveTop >= MARGIN) top = aboveTop;
    else top = Math.max(MARGIN, vh - panelH - MARGIN);
  }
  if (left + panelW > vw - MARGIN) left = vw - panelW - MARGIN;
  if (left < MARGIN) left = MARGIN;
  positionStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    visibility: "visible",
  };
};

const onEsc = (e) => {
  if (e.key === "Escape") {
    // Persist happens in onBeforeUnmount once the parent unmounts the panel.
    emit("close");
  }
};

onMounted(async () => {
  await nextTick();
  computePosition();
  document.addEventListener("keydown", onEsc);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onEsc);
  // Persist on every close path (click-outside, trigger toggle, parent unmount,
  // transparent toggle). Skip if the user never actually changed the color.
  if (cssColor.value !== initialColor.value) {
    persistRecent(cssColor.value);
  }
});
</script>
