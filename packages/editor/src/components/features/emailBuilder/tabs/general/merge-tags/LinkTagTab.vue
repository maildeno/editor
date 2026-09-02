<template>
  <div
    ref="rootEl"
    class="border border-(--md-border) rounded-lg bg-(--md-surface) overflow-hidden"
  >
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div
      class="flex items-center justify-between px-3 py-2 bg-(--md-surface-hover) border-b border-(--md-border)"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-(--md-text-muted)"
          >Tag Preview</span
        >
        <span
          v-if="allDetectedTags.length"
          class="text-[10px] text-(--md-text-subtle) bg-(--md-surface) px-1.5 py-0.5 rounded-full border border-(--md-border)"
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
            ? 'bg-(--md-text) text-(--md-surface)'
            : tagEntries.length === 0
              ? 'bg-(--md-surface-muted) text-(--md-text-subtle) cursor-not-allowed'
              : 'bg-(--md-surface-muted) text-(--md-text-muted) hover:bg-(--md-border)',
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
          <!-- Tag name -->
          <div class="relative flex-1">
            <span
              class="absolute left-2 top-[53%] -translate-y-1/2 text-(--md-text-subtle) text-xs pointer-events-none"
              >&#123;&#123;</span
            >
            <input
              v-model="entry.tag"
              type="text"
              placeholder="tag_name"
              class="mg-md-input pl-6!"
            />
          </div>

          <span class="text-(--md-text-subtle) text-xs shrink-0">→</span>

          <!-- Preview value -->
          <div class="relative flex-1">
            <input
              v-model="entry.value"
              data-link-tag-value
              type="text"
              :placeholder="
                entry.tag ? `Value for ${entry.tag}` : 'Preview value'
              "
              class="mg-md-input"
            />
            <span
              v-if="entry.value"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-(--md-selection-fg)"
              >✓</span
            >
          </div>

          <button
            @click="removeEntry(i)"
            class="opacity-0 group-hover:opacity-100 transition-opacity text-(--md-text-subtle) hover:text-(--md-danger) shrink-0"
          >
            <Icon name="times" style="font-size: 10px" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="tagEntries.length === 0 && allDetectedTags.length === 0"
      class="p-6 text-center"
    >
      <span class="text-[11px] text-(--md-text-subtle) block mb-1"
        >No link tags found</span
      >
      <span class="text-[11px] text-(--md-text-subtle)"
        >Add &#123;&#123; tag &#125;&#125; to any link, image, or video
        field</span
      >
    </div>
    <div
      v-if="tagEntries.length === 0 && allDetectedTags.length > 0"
      class="py-2 text-center border-t border-(--md-border)"
    >
      <span class="text-[11px] text-(--md-text-subtle)"
        >Add preview values for detected tags</span
      >
    </div>

    <!-- ── Auto-detected tags ────────────────────────────────────────────── -->
    <div
      v-if="allDetectedTags.length > 0"
      class="border-t border-(--md-border)"
    >
      <button
        @click="showDetectedSummary = !showDetectedSummary"
        class="w-full flex items-center justify-between px-3 py-2 bg-(--md-surface-hover)/50 hover:bg-(--md-surface-muted) transition-colors"
      >
        <span
          class="text-[10px] font-medium text-(--md-text-subtle)/75 uppercase tracking-wider"
          >Detected in canvas</span
        >
        <svg
          class="w-3 h-3 text-(--md-text-subtle) transition-transform"
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
                ? 'bg-(--md-text) text-(--md-surface) border-(--md-text)'
                : 'bg-(--md-surface) text-(--md-text-muted) border-(--md-border) hover:border-(--md-border-strong) hover:bg-(--md-surface-hover)'
            "
          >
            &#123;&#123; {{ tag }} &#125;&#125;
            <span
              v-if="isTagDefined(tag)"
              class="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
            >
              Preview: "{{ linkTagPreviewContext[tag] }}"
            </span>
          </button>
        </div>
        <p
          class="text-[11px] text-(--md-text-subtle) mt-2 flex items-center gap-1"
        >
          <Icon name="info-circle" style="font-size: 8px" />
          Click a tag to add a preview value
        </p>
      </div>
    </div>

    <!-- ── Tag origins ───────────────────────────────────────────────────── -->
    <div
      v-if="tagOrigins.size > 0"
      class="border-t border-(--md-border) px-3 py-2"
    >
      <span
        class="text-[10px] font-medium text-(--md-text-subtle)/75 uppercase tracking-wider"
        >Tag origins</span
      >
      <div class="mt-1.5 space-y-1">
        <div
          v-for="[tag, origins] in tagOrigins"
          :key="tag"
          class="flex items-start gap-2 text-[10px] text-(--md-text-subtle)"
        >
          <span class="font-mono text-(--md-text-muted) shrink-0">{{
            tag
          }}</span>
          <span class="text-(--md-text-subtle)">—</span>
          <span>{{ origins.join(", ") }}</span>
        </div>
      </div>
    </div>

    <!-- ── ESP token preview ─────────────────────────────────────────────── -->
    <div
      v-if="tagEntries.some((e) => e.tag.trim())"
      class="border-t border-(--md-border)"
    >
      <button
        @click="showESPPreview = !showESPPreview"
        class="w-full flex items-center justify-between px-3 py-2 bg-(--md-surface-hover)/50 hover:bg-(--md-surface-muted) transition-colors"
      >
        <div class="flex items-center gap-2">
          <span
            class="text-[10px] font-medium text-(--md-text-subtle)/75 uppercase tracking-wider"
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
          class="w-3 h-3 text-(--md-text-subtle) transition-transform"
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
            <!-- Snapshot row -->
            <div class="flex items-center gap-2 text-[10px]">
              <span class="text-(--md-text-subtle) shrink-0 w-14 text-right"
                >snapshot</span
              >
              <span class="font-mono text-(--md-text-subtle) shrink-0"
                >&#123;&#123; {{ entry.tag
                }}{{
                  detectedDefaults.get(entry.tag)
                    ? `|'${detectedDefaults.get(entry.tag)}'`
                    : ""
                }}
                &#125;&#125;</span
              >
              <span class="text-(--md-text-subtle) shrink-0">→</span>
              <span
                class="font-mono bg-(--md-info-bg) text-(--md-info-fg) px-1.5 py-0.5 rounded border border-(--md-info-border) truncate"
              >
                {{ previewValueFor(entry) }}
              </span>
            </div>
            <!-- Master row -->
            <div class="flex items-center gap-2 text-[10px]">
              <span class="text-(--md-text-subtle) shrink-0 w-14 text-right"
                >master</span
              >
              <span class="font-mono text-(--md-text-subtle) shrink-0"
                >&#123;&#123; {{ entry.tag
                }}{{
                  detectedDefaults.get(entry.tag)
                    ? `|'${detectedDefaults.get(entry.tag)}'`
                    : ""
                }}
                &#125;&#125;</span
              >
              <span class="text-(--md-text-subtle) shrink-0">→</span>
              <span
                class="font-mono text-(--md-info-fg) bg-(--md-info-bg) px-1.5 py-0.5 rounded border border-(--md-info-border) truncate"
              >
                {{ espTokenFor(entry.tag) }}
              </span>
            </div>
          </div>
          <p class="text-[9px] text-(--md-text-subtle) leading-relaxed pt-1">
            <strong>snapshot</strong> = literal preview value (or inline
            default). <strong>master</strong> = ESP token sent to your mail
            server.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import {
  extractMergeTags,
  extractMergeTagsWithDefaults,
} from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";
import { transformToken } from "@/composables/emailBuilder/export/merge-tags/mergeTagMapper";
import { ESP_SYNTAX_META } from "@/composables/emailBuilder/export/logic/espLogicWrapper";
import { getESPMetaSafe } from "@/esp/registry";
import { queryAllFromRoot } from "@/utils/shadowDom";
import Icon from "@/components/ui/Icon.vue";

// Anchors the input lookups below to this component's own root node, so
// they resolve inside the shadow root as well as the light DOM.
const rootEl = ref<HTMLElement | null>(null);

const { linkTagPreviewContext, linkTagPreviewActive, rows, espConfig } =
  useEmailBuilder();

// ─── Persistent state ─────────────────────────────────────────────────────────

interface TagEntry {
  tag: string;
  value: string;
  default: string;
}

const tagEntries = ref<TagEntry[]>([]);
const isPreviewActive = ref<boolean>(false);
const showDetectedSummary = ref<boolean>(true);
const showESPPreview = ref<boolean>(true);

// ─── ESP display helpers ──────────────────────────────────────────────────────

const currentSyntaxLabel = computed(
  () => getESPMetaSafe(espConfig.value.syntax, ESP_SYNTAX_META).label,
);

const syntaxBadgeClass = computed(() => {
  const groupMap: Record<string, string> = {
    handlebars:
      "bg-(--md-warning-bg) text-(--md-warning-fg) border-(--md-warning-border)",
    liquid: "bg-(--md-info-bg) text-(--md-info-fg) border-(--md-info-border)",
    ampscript:
      "bg-(--md-accent-soft) text-(--md-accent) border-(--md-accent-border)",
    custom:
      "bg-(--md-surface-muted) text-(--md-text-muted) border-(--md-border)",
    mso: "bg-(--md-surface-muted) text-(--md-text-muted) border-(--md-border)",
  };
  const group = getESPMetaSafe(espConfig.value.syntax, ESP_SYNTAX_META).group;
  return groupMap[group] ?? groupMap.custom;
});

// ─── Detected link tag defaults ─────────────────────────────────────────────

const detectedDefaults = computed<Map<string, string>>(() => {
  const merged = new Map<string, string>();
  for (const { value } of scannedFields.value) {
    extractMergeTagsWithDefaults(value).forEach((fallback, name) => {
      if (!merged.has(name)) merged.set(name, fallback);
    });
  }
  return merged;
});

const espTokenFor = (tagId: string): string =>
  transformToken(
    tagId,
    espConfig.value.syntax,
    detectedDefaults.value.get(tagId) || undefined,
  );

const previewValueFor = (entry: { tag: string; value: string }): string => {
  if (entry.value.trim()) return entry.value.trim();
  const d = detectedDefaults.value.get(entry.tag);
  if (d) return d;
  return `{{ ${entry.tag} }}`;
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
  linkTagPreviewActive.value = isPreviewActive.value;
  linkTagPreviewContext.value = isPreviewActive.value ? buildContext() : {};
};

watch(
  tagEntries,
  () => {
    if (isPreviewActive.value) linkTagPreviewContext.value = buildContext();
  },
  { deep: true },
);

watch(linkTagPreviewActive, (val) => {
  isPreviewActive.value = val;
});

// ─── Entry management ─────────────────────────────────────────────────────────

const removeEntry = (i: number) => {
  tagEntries.value.splice(i, 1);
  if (tagEntries.value.length === 0 && isPreviewActive.value) {
    isPreviewActive.value = false;
    linkTagPreviewActive.value = false;
    linkTagPreviewContext.value = {};
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
        "[data-link-tag-value]",
      );
      inputs[idx]?.focus();
    });
    return;
  }
  tagEntries.value.push({ tag, value: "", default: "" });
  nextTick(() => {
    const inputs = queryAllFromRoot<HTMLInputElement>(
      rootEl.value,
      "[data-link-tag-value]",
    );
    inputs[inputs.length - 1]?.focus();
  });
};

const isTagDefined = (tag: string): boolean =>
  !!linkTagPreviewContext.value[tag]?.trim();

// ─── Auto-detection ───────────────────────────────────────────────────────────

interface ScanField {
  value: string;
  label: string;
}

const SCAN_MAP: Record<string, (props: Record<string, any>) => ScanField[]> = {
  anchor: (p) => [
    { value: p.text ?? "", label: "anchor text" },
    { value: p.link ?? "", label: "anchor URL" },
  ],
  button: (p) => [
    { value: p.text ?? "", label: "button text" },
    { value: p.link ?? "", label: "button URL" },
  ],
  image: (p) => [
    { value: p.src ?? "", label: "image src" },
    { value: p.alt ?? "", label: "image alt" },
    ...(p.enabled ? [{ value: p.link ?? "", label: "image link" }] : []),
  ],
  video: (p) => [
    { value: p.src ?? "", label: "video URL" },
    { value: p.alt ?? "", label: "video alt" },
    { value: p.fallbackLink ?? "", label: "video fallback link" },
    { value: p.coverImage ?? "", label: "video cover image" },
  ],
};

// ── Recursive tree walker for scanning link-tag fields ───────────────────────
const walkLeafComponents = (
  children: any[],
  callback: (comp: any) => void,
): void => {
  for (const child of children) {
    if (child.type === "row") {
      for (const col of child.columns ?? []) {
        const kids = col.children ?? col.components ?? [];
        walkLeafComponents(kids, callback);
      }
      continue;
    }
    if (child.type === "row-spacer") continue;
    // Leaf component (type === 'component' or legacy flat shape)
    callback(child);
  }
};

const scannedFields = computed<ScanField[]>(() => {
  const fields: ScanField[] = [];
  for (const row of rows.value ?? []) {
    for (const col of row.columns ?? []) {
      // ── CRITICAL: children ?? components for backward compat ────────────
      const kids = col.children ?? col.components ?? [];
      walkLeafComponents(kids, (comp: any) => {
        // Resolve component type: componentType (new shape) ?? type (legacy)
        const ct = comp.componentType ?? comp.type;
        const scanner = SCAN_MAP[ct];
        if (scanner) fields.push(...scanner(comp.props ?? {}));
      });
    }
  }
  return fields;
});

const allDetectedTags = computed<string[]>(() => {
  const tags = new Set<string>();
  for (const { value } of scannedFields.value) {
    extractMergeTags(value).forEach((t) => tags.add(t));
  }
  return [...tags].sort();
});

const tagOrigins = computed<Map<string, string[]>>(() => {
  const map = new Map<string, string[]>();
  for (const { value, label } of scannedFields.value) {
    extractMergeTags(value).forEach((t) => {
      const prev = map.get(t) ?? [];
      if (!prev.includes(label)) map.set(t, [...prev, label]);
    });
  }
  return map;
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
  background: var(--md-surface-muted);
  border-radius: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background: var(--md-border-strong);
  border-radius: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: var(--md-text-subtle);
}
</style>
