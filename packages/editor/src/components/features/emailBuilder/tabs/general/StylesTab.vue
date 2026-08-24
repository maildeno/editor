<template>
  <div class="space-y-3">
    <Loading v-if="isBgUploading" message="Uploading image" />

    <!-- Email Settings -->
    <PropertySection title="Settings">
      <PropertySelect
        label="Language"
        :model-value="canvasStyles?.language"
        :options="languageOptions"
        placeholder="Search language..."
        @update:model-value="onLanguageChange"
      />

      <label class="block text-xs font-medium text-gray-600 mb-1.25">
        Preheader Text
      </label>
      <InputText
        :model-value="canvasStyles?.preheaderText"
        class="w-full text-xs"
        placeholder="Hello there..."
        @update:model-value="onPreheaderTextChange"
      />

      <!-- Tags Input Section -->
      <div class="mb-2">
        <div class="relative">
          <!-- Input with md-input class -->
          <input
            v-model="tagInput"
            type="text"
            class="mg-md-input"
            placeholder="Enter category / Tags here... (Press Enter, Tab, or Comma to add)"
            @keydown.enter.prevent="addTag"
            @keydown.tab.prevent="addTag"
            @keydown.backspace="handleBackspace"
            @keydown="handleCommaKey"
          />

          <!-- Suggestions Dropdown with md styling -->
          <div
            v-if="showSuggestions && filteredSuggestions.length > 0"
            class="md-dropdown"
          >
            <div
              v-for="(suggestion, index) in filteredSuggestions"
              :key="suggestion"
              :class="[
                'md-dropdown-item',
                index === selectedSuggestionIndex
                  ? 'md-dropdown-item--active'
                  : '',
              ]"
              @click="selectSuggestion(suggestion)"
            >
              {{ suggestion }}
            </div>
          </div>
        </div>

        <!-- Selected Tags Display with md styling -->
        <div v-if="templateTags.length > 0" class="flex flex-wrap gap-2 mt-2">
          <span
            v-for="(tag, index) in templateTags"
            :key="index"
            class="md-tag"
          >
            {{ tag }}
            <button class="md-tag-remove" @click="removeTag(index)">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </span>
        </div>
      </div>

    </PropertySection>

    <!-- Body Background -->
    <PropertySection title="Body Background">
      <PropertyColor
        label="Body Background Color"
        :model-value="canvasStyles.bodyBackgroundColor"
        placeholder="#fafafa"
        :allow-transparent="true"
        @update:model-value="onBodyBgColorChange"
      />

      <div v-if="canvasStyles.bodyBackgroundColor === 'transparent'">
        <label class="block text-xs font-medium text-gray-600 mb-1">
          Background Image URL
        </label>
        <InputText
          :value="canvasStyles.bodyBackgroundImage"
          class="w-full mb-2"
          placeholder="https://example.com/image.jpg"
          @change="
            onBodyBgImageUrlChange(($event.target as HTMLInputElement).value)
          "
        />

        <!-- Upload area -->
        <div
          class="relative group w-full h-20 border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-green-200 transition flex items-center justify-center bg-gray-50/30"
          @click="triggerBodyBgUpload"
        >
          <img
            v-if="canvasStyles.bodyBackgroundImage"
            :src="canvasStyles.bodyBackgroundImage"
            class="max-h-full object-contain"
          />
          <div v-else class="flex flex-col items-center gap-1">
            <Icon name="image" class="text-gray-300" style="font-size: 16px" />
            <span class="text-[9px] text-gray-500">Click to upload</span>
          </div>
        </div>

        <!-- FIX: show upload error so user gets feedback on failure -->
        <p v-if="bgUploadError" class="mt-1 text-xs text-red-500">
          {{ bgUploadError }}
        </p>

        <input
          ref="bodyBgInput"
          type="file"
          accept="image/*"
          @change="handleBodyBackgroundImageUpload"
          class="hidden"
        />
      </div>

      <template v-if="canvasStyles.bodyBackgroundImage">
        <!-- Background Size -->
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1.5"
            >Size</label
          >
          <div class="flex gap-1">
            <button
              v-for="opt in bgSizeOptions"
              :key="opt.value"
              @click="onBodyBgSizeChange(opt.value)"
              class="flex-1 flex flex-col items-center gap-1 px-2 py-1.5 border rounded-md transition-all text-[10px]"
              :class="
                canvasStyles.bodyBackgroundSize === opt.value
                  ? 'border-green-400 bg-gray-50 text-gray-600'
                  : 'border-gray-200/75 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
              "
            >
              <Icon :name="getSizeIcon(opt.value)" style="font-size: 13px" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- Background Repeat -->
        <div class="mt-3">
          <label class="block text-xs font-medium text-gray-600 mb-1.5"
            >Repeat</label
          >
          <div class="flex gap-1">
            <button
              v-for="opt in bgRepeatOptions"
              :key="opt.value"
              @click="onBodyBgRepeatChange(opt.value)"
              class="flex-1 flex flex-col items-center gap-1 px-0.5 py-1.5 border rounded-md transition-all text-[10px]"
              :class="
                canvasStyles.bodyBackgroundRepeat === opt.value
                  ? 'border-green-400 bg-gray-50 text-gray-600'
                  : 'border-gray-200/75 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
              "
            >
              <Icon :name="getRepeatIcon(opt.value)" style="font-size: 13px" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- Background Position -->
        <div class="mt-3">
          <label class="block text-xs font-medium text-gray-600 mb-1.5"
            >Position</label
          >
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="pos in bodyBackgroundPosition"
              :key="pos.value"
              @click="onBodyBgPositionChange(pos.value)"
              class="px-2 py-1.5 text-sm border rounded-md transition-all flex items-center justify-center"
              :class="
                canvasStyles.bodyBackgroundPosition === pos.value
                  ? 'border-green-400 bg-gray-50 text-gray-600'
                  : 'border-gray-200/75 text-gray-400 hover:border-gray-200 hover:bg-gray-50'
              "
            >
              {{ pos.symbol }}
            </button>
          </div>
        </div>
      </template>
    </PropertySection>

    <!-- Canvas Background -->
    <PropertySection title="Canvas Background">
      <PropertyColor
        label="Background Color"
        :model-value="canvasStyles.backgroundColor"
        placeholder="#fafafa"
        :allow-transparent="true"
        @update:model-value="onBgColorChange"
      />
    </PropertySection>

    <!-- Canvas Layout -->
    <PropertySection title="Canvas Layout">
      <PropertyNumberSlider
        label="Canvas Width (px)"
        :model-value="canvasStyles.width"
        :min="360"
        :max="700"
        :step="10"
        unit="px"
        @update:model-value="onWidthChange"
      />

      <PropertyNumberSlider
        label="Mobile Breakpoint Width (px)"
        :model-value="canvasStyles.mobileBreakpoint"
        :min="360"
        :max="600"
        :step="10"
        unit="px"
        @update:model-value="onMobileBreakpointChange"
      />

      <SpacingControl
        label="Padding"
        :model-value="canvasStyles.padding"
        @update:model-value="onPaddingChange"
      />
    </PropertySection>
  </div>
</template>

<script setup lang="ts">
import InputText from "@/components/ui/primitives/InputText.vue";
import Icon from "@/components/ui/Icon.vue";
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useToast } from "@/composables/ui/useToast";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useImageUploader } from "@/composables/system/useImageUpload";

import Loading from "@/components/ui/Loading.vue";
import PropertySection from "../../panels/ui/PropertySection.vue";
import PropertySelect from "../../panels/ui/PropertySelect.vue";
import PropertyNumberSlider from "../../panels/ui/PropertyNumberSlider.vue";
import PropertyColor from "../../panels/ui/PropertyColor.vue";
import SpacingControl from "../../panels/ui/SpacingControl.vue";

const toast = useToast();

const { canvasStyles, saveToHistory, templateTags } = useEmailBuilder();
const { handleImageUploadFlow, swapOnLoad } = useImageUploader();

const onLanguageChange = (value: string) => {
  canvasStyles.value.language = value;
  saveToHistory("canvas-language");
};

const onPreheaderTextChange = (value: string) => {
  canvasStyles.value.preheaderText = value;
  saveToHistory("preheader-text");
};

const tagInput = ref<string>("");
const showSuggestions = ref<boolean>(false);
const selectedSuggestionIndex = ref<number>(-1);

const tagSuggestions = ref<string[]>([
  // General
  "welcome",
  "marketing",
  "newsletter",
  "transactional",
  "promotional",
  "sales",
  "events",
  "ecommerce",
  "saas",
  "feedback",
  "hr",
  "education",
]);

// Computed properties
const filteredSuggestions = computed(() => {
  if (!tagInput.value.trim()) return [];

  const input = tagInput.value.toLowerCase().trim();
  return tagSuggestions.value.filter(
    (tag: any) =>
      tag.toLowerCase().includes(input) && !templateTags.value.includes(tag),
  );
});

// Methods
const addTag = (): void => {
  const tag = tagInput.value.trim().toLowerCase();

  if (tag && !templateTags.value.includes(tag)) {
    templateTags.value.push(tag);
    tagInput.value = "";
    showSuggestions.value = false;
    selectedSuggestionIndex.value = -1;
  }
};

const removeTag = (index: number): void => {
  templateTags.value.splice(index, 1);
};

const selectSuggestion = (suggestion: string): void => {
  if (!templateTags.value.includes(suggestion)) {
    templateTags.value.push(suggestion);
    tagInput.value = "";
    showSuggestions.value = false;
    selectedSuggestionIndex.value = -1;
  }
};

const handleBackspace = (): void => {
  if (tagInput.value === "" && templateTags.value.length > 0) {
    removeTag(templateTags.value.length - 1);
  }
};

const handleCommaKey = (event: KeyboardEvent): void => {
  if (event.key === ",") {
    event.preventDefault();
    addTag();
  }
};

// Watchers

watch(tagInput, (newValue) => {
  showSuggestions.value = newValue.trim().length > 0;
  selectedSuggestionIndex.value = -1;
});

// Keyboard navigation for suggestions
const handleKeyNavigation = (event: KeyboardEvent): void => {
  if (!showSuggestions.value || filteredSuggestions.value.length === 0) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      selectedSuggestionIndex.value = Math.min(
        selectedSuggestionIndex.value + 1,
        filteredSuggestions.value.length - 1,
      );
      break;
    case "ArrowUp":
      event.preventDefault();
      selectedSuggestionIndex.value = Math.max(
        selectedSuggestionIndex.value - 1,
        -1,
      );
      break;
    case "Enter":
      if (selectedSuggestionIndex.value >= 0) {
        event.preventDefault();
        selectSuggestion(
          filteredSuggestions.value[selectedSuggestionIndex.value],
        );
      }
      break;
    case "Escape":
      showSuggestions.value = false;
      selectedSuggestionIndex.value = -1;
      break;
  }
};

// Lifecycle
onMounted(() => {
  document.addEventListener("keydown", handleKeyNavigation);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyNavigation);
});

// ─── Canvas background color ──────────────────────────────────────────────────

const onBodyBgColorChange = (value: string) => {
  canvasStyles.value.bodyBackgroundColor = value;
  saveToHistory("canvas-body-bg-color");
};

const onBgColorChange = (value: string) => {
  canvasStyles.value.backgroundColor = value;
  saveToHistory("canvas-bg-color");
};

// ─── Body background image — URL typed manually ───────────────────────────────
// FIX: was v-model which fired saveToHistory on every keystroke.
// Now uses @change (fires on blur/Enter) so one history entry per URL edit.

const onBodyBgImageUrlChange = (value: string) => {
  canvasStyles.value.bodyBackgroundImage = value;
  saveToHistory("canvas-body-bg-image-url");
};

// ─── Body background image options ───────────────────────────────────────────
// FIX: all three were inline mutations with no saveToHistory call.

const onBodyBgSizeChange = (value: string) => {
  canvasStyles.value.bodyBackgroundSize = value;
  saveToHistory("canvas-body-bg-size");
};

const onBodyBgRepeatChange = (value: string) => {
  canvasStyles.value.bodyBackgroundRepeat = value;
  saveToHistory("canvas-body-bg-repeat");
};

const onBodyBgPositionChange = (value: string) => {
  canvasStyles.value.bodyBackgroundPosition = value;
  saveToHistory("canvas-body-bg-position");
};

// ─── Canvas layout ────────────────────────────────────────────────────────────
// FIX: both sliders and padding were inline mutations with no saveToHistory.

const onWidthChange = (value: number) => {
  canvasStyles.value.width = value;
  saveToHistory("canvas-width");
};

const onMobileBreakpointChange = (value: number) => {
  canvasStyles.value.mobileBreakpoint = value;
  saveToHistory("canvas-mobile-breakpoint");
};

const onPaddingChange = (value: any) => {
  canvasStyles.value.padding = value;
  saveToHistory("canvas-padding");
};

// ─── Background image upload ──────────────────────────────────────────────────

const bodyBgInput = ref<HTMLInputElement | null>(null);
const isBgUploading = ref(false);
const bgUploadError = ref<string | null>(null);

const triggerBodyBgUpload = () => bodyBgInput.value?.click();

const handleBodyBackgroundImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // FIX: save original so we can restore on failure instead of blanking it
  const previousImage = canvasStyles.value.bodyBackgroundImage;

  isBgUploading.value = true;
  bgUploadError.value = null;

  await handleImageUploadFlow(
    file,
    (objectUrl) => {
      canvasStyles.value.bodyBackgroundImage = objectUrl; // instant blob preview
    },
    (permanentUrl, cleanup) => {
      swapOnLoad(
        permanentUrl,
        () => {
          canvasStyles.value.bodyBackgroundImage = permanentUrl;
          saveToHistory("canvas-body-bg-image-upload");
        },
        cleanup,
      );
    },
    (message) => {
      bgUploadError.value = message;
      // FIX: restore original URL on failure rather than blanking it
      canvasStyles.value.bodyBackgroundImage = previousImage;
    },
  );

  isBgUploading.value = false;
  if (bodyBgInput.value) bodyBgInput.value.value = "";
};

// ─── Options ──────────────────────────────────────────────────────────────────

const languageOptions = [
  { label: "🇺🇸 English (US)", value: "en-US" },
  { label: "🇬🇧 English (UK)", value: "en-GB" },
  { label: "🇦🇺 English (AU)", value: "en-AU" },
  { label: "🇨🇦 English (CA)", value: "en-CA" },

  { label: "🇫🇷 Français", value: "fr-FR" },
  { label: "🇪🇸 Español", value: "es-ES" },
  { label: "🇩🇪 Deutsch", value: "de-DE" },
  { label: "🇮🇹 Italiano", value: "it-IT" },

  { label: "🇧🇷 Português (Brasil)", value: "pt-BR" },
  { label: "🇵🇹 Português (Portugal)", value: "pt-PT" },

  { label: "🇳🇱 Nederlands", value: "nl-NL" },
  { label: "🇵🇱 Polski", value: "pl-PL" },
  { label: "🇷🇺 Русский", value: "ru-RU" },
  { label: "🇹🇷 Türkçe", value: "tr-TR" },

  { label: "🇨🇳 中文 (简体)", value: "zh-CN" },
  { label: "🇹🇼 中文 (繁體)", value: "zh-TW" },
  { label: "🇯🇵 日本語", value: "ja-JP" },
  { label: "🇰🇷 한국어", value: "ko-KR" },

  { label: "🇸🇦 العربية", value: "ar-SA" },
  { label: "🇮🇳 हिन्दी", value: "hi-IN" },

  { label: "🇹🇭 ไทย", value: "th-TH" },
  { label: "🇻🇳 Tiếng Việt", value: "vi-VN" },
  { label: "🇮🇩 Bahasa Indonesia", value: "id-ID" },
  { label: "🇲🇾 Bahasa Melayu", value: "ms-MY" },

  { label: "🇸🇪 Svenska", value: "sv-SE" },
  { label: "🇳🇴 Norsk", value: "no-NO" },
  { label: "🇩🇰 Dansk", value: "da-DK" },
  { label: "🇫🇮 Suomi", value: "fi-FI" },

  { label: "🇨🇿 Čeština", value: "cs-CZ" },
  { label: "🇭🇺 Magyar", value: "hu-HU" },
  { label: "🇷🇴 Română", value: "ro-RO" },
  { label: "🇬🇷 Ελληνικά", value: "el-GR" },

  { label: "🇺🇦 Українська", value: "uk-UA" },
  { label: "🇮🇱 עברית", value: "he-IL" },

  { label: "🇳🇬 English (Nigeria)", value: "en-NG" },
  { label: "🇿🇦 English (South Africa)", value: "en-ZA" },
];

const bgSizeOptions = [
  { label: "Cover", value: "cover" },
  { label: "Contain", value: "contain" },
  { label: "Auto", value: "auto" },
];

const bgRepeatOptions = [
  { label: "No Repeat", value: "no-repeat" },
  { label: "Repeat", value: "repeat" },
  { label: "X", value: "repeat-x" },
  { label: "Y", value: "repeat-y" },
];

const bodyBackgroundPosition = [
  { value: "top left", symbol: "↖" },
  { value: "top center", symbol: "↑" },
  { value: "top right", symbol: "↗" },
  { value: "center left", symbol: "←" },
  { value: "center center", symbol: "●" },
  { value: "center right", symbol: "→" },
  { value: "bottom left", symbol: "↙" },
  { value: "bottom center", symbol: "↓" },
  { value: "bottom right", symbol: "↘" },
];

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const getSizeIcon = (value: string) => {
  const icons: Record<string, string> = {
    cover: "arrows-alt",
    contain: "arrow-right",
    auto: "circle",
  };
  return icons[value] || "circle";
};

const getRepeatIcon = (value: string) => {
  const icons: Record<string, string> = {
    "no-repeat": "circle",
    repeat: "th-large",
    "repeat-x": "arrow-right",
    "repeat-y": "arrow-down",
  };
  return icons[value] || "circle";
};
</script>

<style scoped>
/* ============================================================
   md-dropdown – suggestion list
   ============================================================ */
.md-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--md-surface);
  border: 1px solid var(--md-border);
  border-radius: 0.375rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
  max-height: 12rem;
  overflow-y: auto;
}

.md-dropdown-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  color: var(--md-text);
  transition: background 0.1s;
}
.md-dropdown-item:hover {
  background: var(--md-surface-hover);
}
.md-dropdown-item--active {
  background: var(--md-primary);
  color: #fff;
}

/* ============================================================
   md-tag – selected tag pills
   ============================================================ */
.md-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.75rem; 
  border-radius: 9999px;
  font-size: 0.875rem; 
  font-weight: 500;
  background: var(--md-primary);
  color: #fff;
  line-height: 1.5;
}

.md-tag-remove {
  margin-left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  border-radius: 9999px;
  transition:
    background 0.15s,
    color 0.15s;
  padding: 0;
}
.md-tag-remove:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.md-tag-remove svg {
  width: 100%;
  height: 100%;
}

/* ============================================================
   Scrollbar styling for dropdown (optional, keeps it clean)
   ============================================================ */
.md-dropdown::-webkit-scrollbar {
  width: 4px;
}
.md-dropdown::-webkit-scrollbar-track {
  background: transparent;
}
.md-dropdown::-webkit-scrollbar-thumb {
  background: var(--md-border);
  border-radius: 8px;
}
.md-dropdown::-webkit-scrollbar-thumb:hover {
  background: var(--md-text-subtle);
}
</style>
