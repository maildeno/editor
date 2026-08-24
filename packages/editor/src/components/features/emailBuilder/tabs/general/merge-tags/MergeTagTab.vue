<template>
  <div
    ref="rootEl"
    class="border border-gray-200 rounded-lg bg-white overflow-hidden"
  >
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div
      class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-gray-600">Tag Preview</span>
        <span
          v-if="allDetectedTags.length"
          class="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded-full border border-gray-200"
        >
          {{ allDetectedTags.length }} tags
        </span>
      </div>

      <button
        v-if="tagEntries.length !== 0 || allDetectedTags.length !== 0"
        @click="togglePreview"
        :disabled="tagEntries.length === 0"
        class="text-xs px-2 py-1 rounded-md transition-all flex items-center gap-1.5"
        :class="[
          isPreviewActive
            ? 'bg-gray-900 text-white'
            : tagEntries.length === 0
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        ]"
      >
        <Icon
          :name="isPreviewActive ? 'eye' : 'eye-slash'"
          style="font-size: 10px"
        />
        {{ isPreviewActive ? "Preview ON" : "Preview OFF" }}
      </button>
    </div>

    <!-- ── Tag value entries ─────────────────────────────────────────────── -->
    <div v-if="tagEntries.length" class="p-3 space-y-2">
      <div v-for="(entry, i) in tagEntries" :key="i" class="space-y-1.5 group">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <span
              class="absolute left-2 top-[53%] -translate-y-1/2 text-gray-400 text-xs pointer-events-none"
              >&#123;&#123;</span
            >
            <input
              v-model="entry.tag"
              type="text"
              placeholder="tag_name"
              class="mg-md-input !pl-6"
            />
          </div>

          <span class="text-gray-300 text-xs shrink-0">→</span>

          <div class="relative flex-1">
            <input
              v-model="entry.value"
              data-merge-tag-value
              type="text"
              :placeholder="
                entry.tag ? `Preview for ${entry.tag}` : 'Preview value'
              "
              class="mg-md-input"
            />
            <span
              v-if="entry.value"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-green-500"
              >✓</span
            >
          </div>

          <button
            @click="removeEntry(i)"
            class="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
          >
            <Icon name="times" style="font-size: 10px" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty states -->
    <div
      v-if="tagEntries.length === 0 && allDetectedTags.length === 0"
      class="p-6 text-center"
    >
      <span class="text-[11px] text-gray-500 block mb-1"
        >No merge tags found</span
      >
      <span class="text-[11px] text-gray-500"
        >Add &#123;&#123; tag &#125;&#125; to any text block</span
      >
    </div>
    <div
      v-if="tagEntries.length === 0 && allDetectedTags.length > 0"
      class="px-3 py-2 text-center border-t border-gray-100"
    >
      <span class="text-[11px] text-gray-500"
        >Add preview values for detected tags</span
      >
    </div>

    <!-- ── Auto-detected tags ────────────────────────────────────────────── -->
    <div v-if="allDetectedTags.length > 0" class="border-t border-gray-200">
      <button
        @click="showDetectedSummary = !showDetectedSummary"
        class="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 hover:bg-gray-100 transition-colors"
      >
        <span
          class="text-[10px] font-medium text-gray-400/75 uppercase tracking-wider"
          >Detected in canvas</span
        >
        <svg
          class="w-3 h-3 text-gray-400 transition-transform"
          :class="showDetectedSummary ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div v-if="showDetectedSummary" class="p-3">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tag in allDetectedTags"
            :key="tag"
            @click="quickAddTag(tag)"
            class="group relative px-2 py-1 text-xs rounded-md border transition-all"
            :class="
              isTagDefined(tag)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            "
          >
            &#123;&#123; {{ tag
            }}{{
              detectedDefaults.get(tag) ? `|'${detectedDefaults.get(tag)}'` : ""
            }}
            &#125;&#125;
            <span
              v-if="isTagDefined(tag)"
              class="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
            >
              Preview: "{{ mergeTagPreviewContext[tag] }}"
            </span>
          </button>
        </div>
        <p class="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
          <Icon name="info-circle" style="font-size: 8px" />
          Click a tag to add a preview value
        </p>
      </div>
    </div>

    <!-- ── Export Tokens preview ─────────────────────────────────────────── -->
    <div
      v-if="tagEntries.some((e) => e.tag.trim())"
      class="border-t border-gray-200"
    >
      <button
        @click="showESPPreview = !showESPPreview"
        class="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 hover:bg-gray-100 transition-colors"
      >
        <div class="flex items-center gap-2">
          <span
            class="text-[10px] font-medium text-gray-400/75 uppercase tracking-wider"
            >Export Tokens</span
          >
          <span
            class="text-[9px] px-1.5 py-0.5 rounded-full border font-mono"
            :class="syntaxBadgeClass"
          >
            {{ currentSyntaxLabel }}
          </span>
        </div>
        <svg
          class="w-3 h-3 text-gray-400 transition-transform"
          :class="showESPPreview ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div v-if="showESPPreview" class="p-3 space-y-1.5 overflow-x-auto">
        <div class="min-w-max">
          <div
            v-for="entry in tagEntries.filter((e) => e.tag.trim())"
            :key="entry.tag"
            class="space-y-1"
          >
            <div class="flex items-center gap-2 text-[10px]">
              <span class="text-gray-400 shrink-0 w-14 text-right"
                >snapshot</span
              >
              <span class="font-mono text-gray-500 shrink-0"
                >&#123;&#123; {{ entry.tag
                }}{{
                  entry.fallback || detectedDefaults.get(entry.tag)
                    ? `|'${entry.fallback || detectedDefaults.get(entry.tag)}'`
                    : ""
                }}
                &#125;&#125;</span
              >
              <span class="text-gray-300 shrink-0">→</span>
              <span
                class="font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-100 truncate"
              >
                {{ previewValueFor(entry) }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-[10px]">
              <span class="text-gray-400 shrink-0 w-14 text-right">master</span>
              <span class="font-mono text-gray-500 shrink-0"
                >&#123;&#123; {{ entry.tag
                }}{{
                  entry.fallback || detectedDefaults.get(entry.tag)
                    ? `|'${entry.fallback || detectedDefaults.get(entry.tag)}'`
                    : ""
                }}
                &#125;&#125;</span
              >
              <span class="text-gray-300 shrink-0">→</span>
              <span
                class="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate"
              >
                {{ espTokenFor(entry) }}
              </span>
            </div>
          </div>
          <p class="text-[9px] text-gray-400 leading-relaxed pt-1">
            <strong>snapshot</strong> = literal preview value (or inline
            default). <strong>master</strong> = ESP token sent to your mail
            server.
          </p>
        </div>
      </div>
    </div>

    <!-- ── System tags picker ────────────────────────────────────────────── -->
    <div class="border-t border-gray-200">
      <button
        @click="showSystemTags = !showSystemTags"
        class="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 hover:bg-gray-100 transition-colors"
      >
        <div class="flex items-center gap-2">
          <span
            class="text-[10px] font-medium text-gray-400/75 uppercase tracking-wider"
            >System Tags</span
          >
          <span
            class="text-[9px] text-gray-400 bg-white px-1.5 py-0.5 rounded-full border border-gray-200"
          >
            {{ systemTagIds.length }}
          </span>
        </div>
        <svg
          class="w-3 h-3 text-gray-400 transition-transform"
          :class="showSystemTags ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div v-if="showSystemTags" class="p-3 space-y-2">
        <p class="text-[9px] text-gray-400 leading-relaxed">
          System tags are automatically translated to your target ESP's native
          token on export. Click to copy.
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="id in systemTagIds"
            :key="id"
            @click="copySystemTag(id)"
            class="group relative flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all"
            :title="systemTagPreview(id)"
          >
            <Icon name="tag" class="text-gray-400" style="font-size: 8px" />
            {{ id }}
            <span
              class="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 font-mono"
            >
              {{ systemTagPreview(id) }}
            </span>
          </button>
        </div>
        <p
          v-if="copiedTag"
          class="text-[9px] text-green-500 flex items-center gap-1"
        >
          <Icon name="check" style="font-size: 8px" />
          Copied {{ copiedTag }} to clipboard
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { queryAllFromRoot } from "@/utils/shadowDom";
import Icon from "@/components/ui/Icon.vue";
import { computed, watch, nextTick, ref } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import {
  extractMergeTags,
  extractMergeTagsWithDefaults,
} from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";
import {
  transformToken,
  getSystemTagIds,
  getSystemToken,
} from "@/composables/emailBuilder/export/merge-tags/mergeTagMapper";
import { ESP_SYNTAX_META } from "@/composables/emailBuilder/export/logic/espLogicWrapper";
import type { ESPSyntax } from "@/composables/emailBuilder/export/logic/espLogicWrapper";
import { getESPMetaSafe } from "@/esp/registry";

// Anchors the input lookups below to this component's own root node, so
// they resolve inside the shadow root as well as the light DOM.
const rootEl = ref<HTMLElement | null>(null);

const { mergeTagPreviewContext, mergeTagPreviewActive, rows, espConfig } =
  useEmailBuilder();

// ─── Persistent state ─────────────────────────────────────────────────────────

interface TagEntry {
  tag: string;
  fallback: string;
  value: string;
}

const tagEntries = ref<TagEntry[]>([]);
const isPreviewActive = ref<boolean>(false);
const showDetectedSummary = ref<boolean>(true);
const showSystemTags = ref<boolean>(false);
const showESPPreview = ref<boolean>(true);

// ─── ESP display helpers ──────────────────────────────────────────────────────

const currentSyntaxLabel = computed(
  () => getESPMetaSafe(espConfig.value.syntax, ESP_SYNTAX_META).label,
);

const syntaxBadgeClass = computed(() => {
  const groupMap: Record<string, string> = {
    handlebars: "bg-yellow-50 text-yellow-700 border-yellow-200",
    liquid: "bg-blue-50 text-blue-700 border-blue-200",
    ampscript: "bg-purple-50 text-purple-700 border-purple-200",
    custom: "bg-gray-100 text-gray-600 border-gray-200",
    mso: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const group = getESPMetaSafe(espConfig.value.syntax, ESP_SYNTAX_META).group;
  return groupMap[group] ?? groupMap.custom;
});

// ── Recursive tree walker — visits leaf text components ──────────────────────
const TEXT_TYPES = new Set(["paragraph", "heading", "list"]);

const walkTextComponents = (
  children: any[],
  callback: (comp: any) => void,
): void => {
  for (const child of children) {
    if (child.type === "row") {
      for (const col of child.columns ?? []) {
        const kids = col.children ?? col.components ?? [];
        walkTextComponents(kids, callback);
      }
      continue;
    }
    if (child.type === "row-spacer") continue;
    // Leaf component — resolve type via componentType ?? type (discriminated union + legacy)
    const ct = child.componentType ?? child.type;
    if (TEXT_TYPES.has(ct)) {
      callback(child);
    }
  }
};

// ─── Detected tags + their inline defaults ────────────────────────────────────

const detectedDefaults = computed<Map<string, string>>(() => {
  const merged = new Map<string, string>();
  for (const row of rows.value ?? []) {
    for (const col of row.columns ?? []) {
      // ── CRITICAL: children ?? components for backward compat ────────────
      const kids = col.children ?? col.components ?? [];
      walkTextComponents(kids, (comp: any) => {
        const text =
          comp.props?.content ?? comp.props?.html ?? comp.props?.text ?? "";
        extractMergeTagsWithDefaults(text).forEach((fallback, name) => {
          if (!merged.has(name)) merged.set(name, fallback);
        });
      });
    }
  }
  return merged;
});

const espTokenFor = (entry: TagEntry): string => {
  const fallback =
    entry.fallback.trim() || detectedDefaults.value.get(entry.tag) || undefined;
  return transformToken(entry.tag, espConfig.value.syntax, fallback);
};

const previewValueFor = (entry: TagEntry): string => {
  if (entry.value.trim()) return entry.value.trim();
  if (entry.fallback.trim()) return entry.fallback.trim();
  const d = detectedDefaults.value.get(entry.tag);
  if (d) return d;
  return `{{ ${entry.tag} }}`;
};

// ─── System tags ──────────────────────────────────────────────────────────────

const systemTagIds = computed(() => getSystemTagIds());

const systemTagPreview = (id: string): string =>
  getSystemToken(id, espConfig.value.syntax) ?? `{{ ${id} }}`;

const copiedTag = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout>;

const copySystemTag = async (id: string) => {
  try {
    await navigator.clipboard.writeText(`${id}`);
  } catch {
    /* silent */
  }
  copiedTag.value = id;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copiedTag.value = null;
  }, 2000);
};

// ─── Context builder ──────────────────────────────────────────────────────────

const buildContext = (): Record<string, string> =>
  Object.fromEntries(
    tagEntries.value
      .filter((e) => e.tag.trim())
      .map((e) => [
        e.tag.trim().toLowerCase().replace(/\s+/g, "_"),
        e.value.trim(),
      ]),
  );

// ─── Preview toggle ───────────────────────────────────────────────────────────

const togglePreview = () => {
  if (tagEntries.value.length === 0) return;
  isPreviewActive.value = !isPreviewActive.value;
  mergeTagPreviewActive.value = isPreviewActive.value;
  mergeTagPreviewContext.value = isPreviewActive.value ? buildContext() : {};
};

watch(
  tagEntries,
  () => {
    if (isPreviewActive.value) mergeTagPreviewContext.value = buildContext();
  },
  { deep: true },
);

watch(mergeTagPreviewActive, (val) => {
  isPreviewActive.value = val;
});

// ─── Entry management ─────────────────────────────────────────────────────────

const removeEntry = (i: number) => {
  tagEntries.value.splice(i, 1);
  if (tagEntries.value.length === 0 && isPreviewActive.value) {
    isPreviewActive.value = false;
    mergeTagPreviewActive.value = false;
    mergeTagPreviewContext.value = {};
  }
};

const quickAddTag = (tag: string) => {
  const key = tag.trim().toLowerCase().replace(/\s+/g, "_");
  const exists = tagEntries.value.some(
    (e) => e.tag.trim().toLowerCase().replace(/\s+/g, "_") === key,
  );
  if (exists) {
    nextTick(() => {
      const idx = tagEntries.value.findIndex(
        (e) => e.tag.trim().toLowerCase().replace(/\s+/g, "_") === key,
      );
      const inputs = queryAllFromRoot<HTMLInputElement>(
        rootEl.value,
        "[data-merge-tag-value]",
      );
      inputs[idx]?.focus();
    });
    return;
  }
  tagEntries.value.push({ tag, value: "", fallback: "" });
  nextTick(() => {
    const inputs = queryAllFromRoot<HTMLInputElement>(
      rootEl.value,
      "[data-merge-tag-value]",
    );
    inputs[inputs.length - 1]?.focus();
  });
};

const isTagDefined = (tag: string): boolean =>
  !!mergeTagPreviewContext.value[tag]?.trim();

// ─── Auto-detect tags ─────────────────────────────────────────────────────────

const allDetectedTags = computed<string[]>(() => {
  const tags = new Set<string>();
  for (const row of rows.value ?? []) {
    for (const col of row.columns ?? []) {
      // ── CRITICAL: children ?? components for backward compat ────────────
      const kids = col.children ?? col.components ?? [];
      walkTextComponents(kids, (comp: any) => {
        const text =
          comp.props?.content ?? comp.props?.html ?? comp.props?.text ?? "";
        extractMergeTags(text).forEach((t) => tags.add(t));
      });
    }
  }
  return [...tags].sort();
});
</script>

<style scoped>
.overflow-x-auto {
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}
.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}
.overflow-x-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>