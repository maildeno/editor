<!--
 ImportHtmlDialog.vue — paste or upload HTML and turn it into rows, columns and blocks.

 Two steps in one dialog:
   input    a textarea, a file picker and a note that the import replaces the canvas
   report   what came in, and what to check: the import report, grouped

 The dialog owns the form and the wording; `run` owns what happens to the HTML
 (the header passes a function that converts it and calls setJson, which is what
 makes the replacement one undo step). Same split as SendEmail: the editor
 supplies the UI, the caller supplies the operation.

 Nothing is lost by dismissing the dialog by accident: the pasted text stays until
 an import succeeds, so reopening it brings it back.

 Props:
   visible      v-model, controls the Dialog
   hasContent   the canvas has rows, so the import will replace something
   run          converts the HTML and replaces the canvas; resolves with the report,
                rejects with an HtmlImportError when nothing could be imported

 Emits:
   update:visible
   imported     the report, after the canvas has been replaced
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/primitives/Button.vue";
import Dialog from "@/components/ui/primitives/Dialog.vue";
import Icon from "@/components/ui/Icon.vue";
import Message from "@/components/ui/primitives/Message.vue";
import {
  HtmlImportError,
  type ImportReport,
  type ReportEntry,
} from "@/composables/emailBuilder/import/types";

interface Props {
  visible: boolean;
  hasContent?: boolean;
  run: (html: string) => Promise<ImportReport>;
}

const props = withDefaults(defineProps<Props>(), { hasContent: false });

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "imported", report: ImportReport): void;
}>();

// The converter stops at 5 MB; reading a much larger file into a textarea would
// freeze the tab before it ever got the chance to say so.
const MAX_FILE_BYTES = 6 * 1024 * 1024;

const source = ref("");
const fileName = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const report = ref<ImportReport | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const canImport = computed(() => source.value.trim().length > 0 && !busy.value);

/** "1.2 KB", "340 KB", "2.1 MB": the size the pasted text will be sent through as. */
const sizeLabel = computed(() => {
  const bytes = new Blob([source.value]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

// A finished import starts fresh the next time the dialog opens; an abandoned one
// keeps what was pasted.
watch(
  () => props.visible,
  (open) => {
    if (!open) return;
    error.value = null;
    if (report.value) {
      report.value = null;
      source.value = "";
      fileName.value = null;
    }
  },
);

function close() {
  emit("update:visible", false);
}

function chooseFile() {
  fileInput.value?.click();
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (input) input.value = ""; // choosing the same file twice must fire again
  if (!file) return;
  error.value = null;
  if (file.size > MAX_FILE_BYTES) {
    error.value = "That file is larger than 5 MB, which is more than the importer reads. Trim the HTML and try again.";
    return;
  }
  try {
    source.value = await file.text();
    fileName.value = file.name;
  } catch {
    error.value = "That file could not be read.";
  }
}

function clearSource() {
  source.value = "";
  fileName.value = null;
  error.value = null;
}

async function runImport() {
  if (!canImport.value) return;
  busy.value = true;
  error.value = null;
  try {
    const result = await props.run(source.value);
    report.value = result;
    source.value = "";
    fileName.value = null;
    emit("imported", result);
  } catch (e) {
    if (e instanceof HtmlImportError) {
      error.value = e.message;
    } else {
      console.error("[maildeno-editor] HTML import failed:", e);
      error.value =
        "Something went wrong while converting this HTML" +
        (e instanceof Error && e.message ? `: ${e.message}` : ".");
    }
  } finally {
    busy.value = false;
  }
}

// ── The report ──────────────────────────────────────────────────────────────

const NAMES: Record<string, [string, string]> = {
  paragraph: ["text block", "text blocks"],
  heading: ["heading", "headings"],
  button: ["button", "buttons"],
  image: ["image", "images"],
  divider: ["divider", "dividers"],
  spacer: ["spacer", "spacers"],
  list: ["list", "lists"],
  menu: ["menu", "menus"],
  socials: ["social links block", "social links blocks"],
  video: ["video", "videos"],
};

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

const headline = computed(() => {
  const r = report.value;
  if (!r) return "";
  const blocks = Object.values(r.summary.components).reduce((a, b) => a + b, 0);
  return `Imported ${plural(r.summary.rows, ["row", "rows"])} and ${plural(blocks, ["block", "blocks"])}.`;
});

const blockList = computed(() => {
  const r = report.value;
  if (!r) return "";
  return Object.entries(r.summary.components)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => plural(n, NAMES[type] ?? [type, `${type}s`]))
    .join(", ");
});

const phoneLine = computed(() => {
  const r = report.value;
  if (!r) return "";
  const where =
    r.layout.breakpointSource === "media-query"
      ? `read from the @media rules`
      : r.layout.breakpointSource === "maildeno"
        ? "read from the Maildeno export"
        : "no @media rule switched it, so the default";
  const parts = [`Phone layout switches at ${r.layout.breakpoint}px (${where}).`];
  if (r.mobile.nodesWithOverrides > 0) {
    parts.push(`${plural(r.mobile.nodesWithOverrides, ["element has", "elements have"])} phone-specific settings.`);
  }
  if (r.mobile.mobileHidden > 0) parts.push(`${plural(r.mobile.mobileHidden, ["block is", "blocks are"])} hidden on phones.`);
  if (r.mobile.desktopHidden > 0) parts.push(`${plural(r.mobile.desktopHidden, ["block is", "blocks are"])} hidden on desktop.`);
  return parts.join(" ");
});

interface Section {
  key: string;
  title: string;
  hint: string;
  entries: ReportEntry[];
}

const sections = computed<Section[]>(() => {
  const r = report.value;
  if (!r) return [];
  return [
    { key: "warnings", title: "Check these", hint: "These imported, but may look different.", entries: r.warnings },
    { key: "fallbacks", title: "Kept in another form", hint: "The content is there, built differently.", entries: r.fallbacks },
    { key: "dropped", title: "Not carried over", hint: "Maildeno has no place for these.", entries: r.dropped },
    { key: "safety", title: "Removed for safety", hint: "Scripts, handlers and unsafe links never import.", entries: r.safety },
  ].filter((s) => s.entries.length > 0);
});

const entryText = (e: ReportEntry) => (e.count && e.count > 1 ? `${e.message} (×${e.count})` : e.message);
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    modal
    :header="report ? 'Import finished' : 'Import HTML'"
    :style="{ width: '640px' }"
    :closable="!busy"
  >
    <!-- ── Step 1: paste or choose a file ───────────────────────────────────── -->
    <form v-if="!report" class="space-y-3" @submit.prevent="runImport">
      <p class="text-sm text-(--md-text-subtle)">
        Paste the HTML of an email, or choose a file. It becomes rows, columns and blocks, and
        what the HTML does on phones (its <code>@media</code> rules, classes and inline styles)
        becomes Maildeno's mobile settings. MJML source has to be compiled to HTML first.
      </p>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label for="md-import-html-source" class="block text-sm font-medium">HTML</label>
          <span v-if="source" class="text-xs text-(--md-text-subtle)">
            <span v-if="fileName">{{ fileName }} · </span>{{ sizeLabel }}
            <button
              type="button"
              class="ml-2 underline hover:text-(--md-text)"
              :disabled="busy"
              @click="clearSource"
            >
              Clear
            </button>
          </span>
        </div>
        <textarea
          id="md-import-html-source"
          v-model="source"
          class="md-import-source"
          rows="12"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          placeholder="<!DOCTYPE html>&#10;<html>&#10;  …"
          :disabled="busy"
        />
      </div>

      <div class="flex items-center gap-2">
        <Button severity="secondary" :disabled="busy" @click="chooseFile">
          <Icon name="download" style="font-size: 13px" />
          Choose a file…
        </Button>
        <span class="text-xs text-(--md-text-subtle)">.html or .htm</span>
        <input
          ref="fileInput"
          type="file"
          accept=".html,.htm,text/html"
          class="hidden"
          @change="onFileChosen"
        />
      </div>

      <Message v-if="hasContent" severity="warn" :closable="false" class="text-sm">
        This replaces everything on the canvas. Ctrl+Z (or the Undo button) brings it back.
      </Message>

      <Message v-if="error" severity="error" :closable="false" class="text-sm">
        {{ error }}
      </Message>
    </form>

    <!-- ── Step 2: what came in ─────────────────────────────────────────────── -->
    <div v-else class="space-y-3" aria-live="polite">
      <Message severity="success" :closable="false" class="text-sm">
        {{ headline }}
        <span v-if="blockList" class="block text-xs mt-0.5 opacity-80">{{ blockList }}</span>
      </Message>
      <p class="text-sm text-(--md-text-subtle)">{{ phoneLine }}</p>

      <div v-if="sections.length" class="md-import-report space-y-3">
        <section v-for="s in sections" :key="s.key">
          <h3 class="text-sm font-semibold text-(--md-text)">
            {{ s.title }}
            <span class="font-normal text-xs text-(--md-text-subtle)"> — {{ s.hint }}</span>
          </h3>
          <ul class="mt-1 space-y-1">
            <li
              v-for="e in s.entries"
              :key="e.code + e.message"
              class="text-sm text-(--md-text-subtle)"
              :title="e.code"
            >
              {{ entryText(e) }}
            </li>
          </ul>
        </section>
      </div>
      <p v-else class="text-sm text-(--md-text-subtle)">Nothing needed a workaround.</p>

      <p class="text-xs text-(--md-text-subtle)">
        Look over spacing, colours, fonts and links before you send. Ctrl+Z undoes the import.
      </p>
    </div>

    <template #footer>
      <template v-if="!report">
        <Button label="Cancel" severity="secondary" text @click="close" :disabled="busy" />
        <Button
          :label="hasContent ? 'Replace canvas and import' : 'Import'"
          :loading="busy"
          :disabled="!canImport"
          @click="runImport"
        />
      </template>
      <Button v-else label="Done" @click="close" />
    </template>
  </Dialog>
</template>

<style scoped>
.md-import-source {
  width: 100%;
  min-height: 12rem;
  padding: 0.5rem 0.625rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--md-text);
  background: var(--md-surface);
  border: 1px solid var(--md-border);
  border-radius: 0.375rem;
  outline: none;
  resize: vertical;
  white-space: pre;
  overflow: auto;
  transition: border-color 0.15s;
}
.md-import-source::placeholder {
  color: var(--md-text-subtle);
}
.md-import-source:focus {
  border-color: var(--md-primary);
}
.md-import-source:disabled {
  background: var(--md-surface-hover);
  color: var(--md-text-subtle);
  cursor: not-allowed;
}
.md-import-report {
  max-height: 40vh;
  overflow-y: auto;
}
</style>
