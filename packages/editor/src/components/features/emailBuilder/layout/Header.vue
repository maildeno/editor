<script setup lang="ts">
import Icon from "@/components/ui/Icon.vue";
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  useSlots,
  defineAsyncComponent,
} from "vue";
import { useToast } from "@/composables/ui/useToast";
import { useHasTemplateLibrary } from "@/adapters";
import { isHandled } from "@/adapters/errors";
import { useTeleportTarget } from "@/composables/ui/useTeleportTarget";

interface ExportCapabilities {
  export?: string[];
  [key: string]: unknown;
}

interface HeaderProps {
  savedTemplatesOpen?: boolean;
  /** Mirrors EmailEditor's `versions`. Only changes this button's icon,
   *  label and tooltip — the panel swap itself happens in EmailEditor, and
   *  the toggle event is shared, since only one panel occupies the slot. */
  versions?: boolean;
  /** Mirrors EmailEditor's onSave presence — see the note there. */
  canSave?: boolean;
  /** If provided, the "Send test" button appears and calls this on submit.
   * If omitted, the button doesn't render at all — this is the
   * "capability" pattern for this feature: derived from whether the host
   * gave the editor a way to actually send, not a hardcoded plan/tier
   * check the way the original's auth.user.subscription.plan gate was. */
  onSendTestEmail?: (() => void) | null;
  capabilities?: ExportCapabilities;
}

interface SavePayload {
  templateId: string | number | null;
}

const emit = defineEmits<{
  save: [payload: SavePayload];
  "toggle-saved-templates": [];
  "new-template": [];
}>();

const props = withDefaults(defineProps<HeaderProps>(), {
  savedTemplatesOpen: false,
  versions: false,
  canSave: false,
  onSendTestEmail: null,
  capabilities: () => ({}) as ExportCapabilities,
});

const exportFormats = computed(
  () => props.capabilities?.export ?? ["html", "mjml", "react", "json"],
);
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { useExportSettings } from "@/composables/emailBuilder/export/useExportSettings";
// Lazy: opened from the header, and drags in the accessibility checker.
const HealthIndicator = defineAsyncComponent(
  () => import("@/components/features/emailBuilder/health/HealthIndicator.vue"),
);
import PreviewScreen from "@/components/features/emailBuilder/preview/PreviewScreen.vue";
import SendEmail from "@/components/features/emailBuilder/layout/SendEmail.vue";
import {
  optimizeCanvas,
  optimizeRows,
} from "@/composables/emailBuilder/transform/pipeline/optimize";

const toast = useToast();

const {
  rows,
  canvasStyles,
  templateTags,
  savedTemplateName,
  exportHTML,
  getExportedHTML,
  exportReactEmail,
  exportMJML,
  exportJSON,
  importJSON,
  clearTemplate,
  previewMode,
  undo,
  redo,
  canUndo,
  canRedo,
  saveStatus,
  lastSaved,
  initFromStorage,
  clearLocal,
  linksActive,
  builderMode,
  templateId,
  saveTemplate,
  // historyStatus, // Using for Debug
} = useEmailBuilder();

// Two-way alias for the builder's shared savedTemplateName state.
// Reading it populates the input on initial load (set by loadTemplate or
// initFromStorage before the header mounts); writing it keeps savedTemplateName
// in sync as the user types, so handleSave and the autosave pipeline always
// see the current value without any extra watchers.
const templateName = computed({
  get: () => savedTemplateName.value ?? "",
  set: (v) => {
    savedTemplateName.value = v || null;
  },
});

// ── Export settings (minify toggle) ──────────────────────────────────────────
const { minifyOutput: minifyEnabled, toggleMinify } = useExportSettings();

// ── Host header actions ──────────────────────────────────────────────────────
//
// Read via useSlots rather than $slots in the template so the v-if can be a
// plain boolean expression, and so the reason for the guard is stated once
// here rather than inline.
const slots = useSlots();

/**
 * Whether saving is possible at all.
 *
 * Gated on the adapter implementing saveTemplate rather than on a separate
 * prop, because that is the same presence/absence idiom the rest of the
 * package uses (onSendTestEmail's presence reveals the Send-test button) and
 * because it cannot get out of sync: a Save button that is shown while the
 * adapter has no way to save is a button that always errors.
 *
 * A guest-facing host passes a PartialStorageAdapter with loadTemplate but no
 * saveTemplate, and gets a read/export-only editor — no Save button, no save
 * status, and no autosave attempts firing 401s in the background.
 */
const canSave = computed(() => props.canSave === true);

/**
 * The saved-templates / version-history panel button.
 *
 * `versions` forces it on — a host asking for version history obviously wants
 * the button that opens it, and versions come from their own adapter methods
 * rather than the template library. Otherwise it follows whether the host
 * gave us a template library at all.
 */
const hasTemplateLibrary = useHasTemplateLibrary();
const showPanelButton = computed(
  () => props.versions === true || hasTemplateLibrary,
);

/**
 * State a host control almost certainly needs, passed to the slot so it
 * doesn't have to reach for a template ref or duplicate the editor's own
 * save state.
 *
 * Deliberately small and read-only. A host wanting to *drive* the editor uses
 * the write API on the component ref; this is for rendering a label or
 * disabling a button while a save is in flight.
 */
const headerSlotProps = computed(() => ({
  templateId: templateId.value ?? null,
  isSaving: isSaving.value,
  // The editor's own autosave status: "idle" | "saving" | "saved" | "error".
  // Passed through as-is rather than reduced to a dirty boolean — there is no
  // such flag here, and deriving one would mean inventing a fifth state the
  // editor doesn't actually track.
  saveStatus: saveStatus.value,
}));

// ── Preview overlay ──────────────────────────────────────────────────────────
// PreviewScreen is rendered
// once via <Teleport to="body"> and toggled with v-show, so it preserves
// selectedClients hydration, activeClient choice, and exportedHtml cache
// across close/open cycles.
const previewOverlayOpen = ref(false);

function togglePreviewOverlay() {
  previewOverlayOpen.value = !previewOverlayOpen.value;
}

function closePreviewOverlay() {
  previewOverlayOpen.value = false;
}

// Esc closes the overlay. Listener is attached only while open so it doesn't
// compete with builder-level shortcuts (Cmd+Z, etc.) when the overlay isn't
// visible. The keydown is captured early via { capture: true } so it beats
// any nested handlers inside PreviewScreen that might stopPropagation.
function onPreviewKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closePreviewOverlay();
  }
}

// Body-scroll lock while open — matches Notion / Linear modal behaviour. The
// builder underneath would otherwise scroll behind the overlay when the user
// tries to scroll inside it (especially on macOS rubber-banding).
watch(previewOverlayOpen, (open) => {
  if (typeof window === "undefined") return;

  if (open) {
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onPreviewKeydown, { capture: true });
  } else {
    document.body.style.overflow = "";
    window.removeEventListener("keydown", onPreviewKeydown, { capture: true });
  }
});

// Defensive cleanup: if Header itself ever unmounts while the overlay is
// open (e.g. layout swap, hot reload), restore body scroll and detach the
// listener so we don't leak state across the unmount boundary.
onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  document.body.style.overflow = "";
  window.removeEventListener("keydown", onPreviewKeydown, { capture: true });
});

const isSaving = ref<boolean>(false);
const isSaved = ref<boolean>(false);
let _savedTimer: ReturnType<typeof setTimeout> | null = null;

// Flash the "Saved" checkmark for 2.5 s then revert to normal label
watch(isSaved, (v) => {
  if (v) {
    if (_savedTimer !== null) {
      clearTimeout(_savedTimer);
    }
    _savedTimer = setTimeout(() => {
      isSaved.value = false;
    }, 2500);
  }
});

// ── Derived save-button label ────────────────────────────────────────────────
const saveLabel = computed(() => {
  if (isSaved.value) return "Saved";
  return builderMode.value === "create" ? "Save" : "Update";
});

function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ""); // Remove any other special characters
}

function normalizeTags(tags: string[]): string[] {
  return [
    ...new Set(tags.map(normalizeTag).filter((tag) => tag.length > 0)), // Remove duplicates
  ];
}

async function handleSave() {
  if (isSaving.value) return;

  isSaving.value = true;

  // Captured before saveTemplate() runs — it transitions builderMode from
  // "create" to "edit" as a side effect, so checking builderMode.value
  // for the toast *after* the call would always read "edit", even on the
  // very first save. Declared outside the try so the catch below can word
  // its own message the same way.
  const wasCreating = builderMode.value === "create";

  try {
    // Deep-clone before optimizing so the live canvas state is never mutated.
    const optimizedCanvas = optimizeCanvas(
      JSON.parse(JSON.stringify(canvasStyles.value)),
    );
    const optimizedRows = optimizeRows(JSON.parse(JSON.stringify(rows.value)));

    await saveTemplate({
      // templateName is a computed alias for savedTemplateName, so both are
      // always the same value. Fall back to "Untitled Template" if empty.
      name: templateName.value || "Untitled Template",
      canvasStyles: optimizedCanvas,
      rows: optimizedRows,
      tags: normalizeTags(templateTags.value),
    });

    emit("save", { templateId: templateId.value });

    clearLocal();
    isSaved.value = true;

    toast.add({
      severity: "success",
      summary: wasCreating ? "Template saved" : "Template updated",
      life: 3000,
    });
  } catch (err) {
    // Previously a bare try/finally: a rejecting adapter left isSaving reset
    // and nothing else — no toast, no emit, an unhandled rejection in the
    // console, and a user who has every reason to think the save worked. The
    // most common cause is the least visible one: a host whose backend
    // refuses the write (a read-only role, a plan limit, an expired session).
    //
    // Deliberately does NOT clearLocal() or set isSaved — the autosaved draft
    // is now the only copy of this work, and the header must keep offering
    // Save rather than settling into its saved state.
    console.error("[maildeno-editor] failed to save template:", err);
    if (!isHandled(err)) {
      toast.add({
        severity: "error",
        summary: wasCreating ? "Save failed" : "Update failed",
        detail: "Your work is still here. Please try again.",
        life: 5000,
      });
    }
  } finally {
    isSaving.value = false;
  }
}

// ── Send test email ──────────────────────────────────────────────────────────
// SendEmail modal needs ready-to-send HTML. getExportedHTML runs the full
// htmlExport pipeline (prepare → generate → tag-transform → minify) and
// returns the string instead of triggering a download.
//
// Mode is always "prune" for sends — the recipient sees only what matches the
// current preview context, never the full master template with conditional
// wrappers.
//
// Throws on empty template; <SendEmail> swallows the error and leaves the
// modal open so the user can close it normally.
const sendEmailVisible = ref<boolean>(false);

async function getHtmlForSending(): Promise<string> {
  const html = getExportedHTML("prune", templateName.value);
  if (!html) {
    throw new Error("Template is empty — add at least one row before sending.");
  }
  return html;
}

// ── Auto-save: reactive "X ago" clock ─────────────────────────────────────────
const _now = ref<number>(Date.now());
let _tickInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  _tickInterval = setInterval(() => {
    _now.value = Date.now();
  }, 30_000);
});
onUnmounted(() => {
  if (_tickInterval) clearInterval(_tickInterval);
  if (_savedTimer !== null) clearTimeout(_savedTimer);
});

const lastSavedDisplay = computed(() => {
  if (!lastSaved.value) return null;

  const diffMs = _now.value - lastSaved.value.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  return lastSaved.value.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
});

// ── Auto-save: restore draft on mount ─────────────────────────────────────────
onMounted(() => {
  // The Header lives in the `designer` layout, so this onMounted fires on every
  // builder route. Only the CREATE page should use this generic restore: edit
  // routes are owned entirely by loadTemplate() (pages/templates/[id].vue),
  // which reconciles the stored draft against the route's templateId. Running
  // initFromStorage() here on an edit route is redundant and, if a stray
  // create-draft (templateId: null) is in storage, would momentarily paint it
  // onto the edit canvas before loadTemplate clears it. Bail on non-create
  // routes. (builderMode is set synchronously by each page's setup, and the
  // create page's create-draft is restored by initForCreate regardless, so
  // nothing is lost by gating here.)
  if (builderMode.value !== "create") return;

  const restoredAt = initFromStorage();
  if (restoredAt) {
    _now.value = Date.now();
  }
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "y" || (e.key === "z" && e.shiftKey))
    ) {
      e.preventDefault();
      redo();
    }
  };
  window.addEventListener("keydown", handleKeydown);
  onUnmounted(() => window.removeEventListener("keydown", handleKeydown));
});

// ── Dropdown + export tab state ───────────────────────────────────────────────
const isDropdownOpen = ref<boolean>(false);
const exportTab = ref<"snap" | "master">("snap"); // "snap" | "master"
const dropdownRef = ref<HTMLElement | null>(null);
const teleportTarget = useTeleportTarget();

// ── Import handler ────────────────────────────────────────────────────────────
const handleImportFn = (event: Event): void => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (file) importJSON(file);
  isDropdownOpen.value = false;
  if (input) input.value = "";
};

// ── Export handlers ───────────────────────────────────────────────────────────
const exportHTMLSnapshotFn = () => {
  exportHTML("prune", templateName.value);
  isDropdownOpen.value = false;
};
const exportHTMLMasterFn = () => {
  exportHTML("wrap", templateName.value);
  isDropdownOpen.value = false;
};
const exportReactSnapshotFn = () => {
  exportReactEmail("prune", templateName.value);
  isDropdownOpen.value = false;
};
const exportReactMasterFn = () => {
  exportReactEmail("wrap", templateName.value);
  isDropdownOpen.value = false;
};
const exportMJMLSnapshotFn = () => {
  exportMJML("prune", templateName.value);
  isDropdownOpen.value = false;
};
const exportMJMLMasterFn = () => {
  exportMJML("wrap", templateName.value);
  isDropdownOpen.value = false;
};
const exportJSONFn = () => {
  exportJSON(templateName.value);
  isDropdownOpen.value = false;
};
const clearTemplateFn = () => {
  clearTemplate();
  isDropdownOpen.value = false;
};

// ── Click-outside + Escape ────────────────────────────────────────────────────
// e.target (not composedPath()) is the bug here specifically: this listener
// is on document, outside the shadow root the custom-element path renders
// into. Any event that crosses a shadow boundary gets its .target
// *retargeted* to the shadow host element — never the actual element that
// was clicked inside — so dropdownRef.value.contains(e.target) was always
// false for every single click anywhere inside the editor, closing the
// dropdown on the very mousedown that was meant to select an export option
// (mousedown fires before click). composedPath() returns the real,
// un-retargeted path, including elements inside shadow roots, and is
// unaffected by this — the standard fix for click-outside detection
// anywhere Shadow DOM might be in play.
const handleClickOutside = (e: MouseEvent): void => {
  if (dropdownRef.value && !e.composedPath().includes(dropdownRef.value))
    isDropdownOpen.value = false;
};
const handleEscapeKey = (e: KeyboardEvent): void => {
  if (e.key === "Escape") isDropdownOpen.value = false;
};

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("keydown", handleEscapeKey);
});
onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  document.removeEventListener("keydown", handleEscapeKey);
});
</script>

<template>
  <header
    class="2xl:container 2xl:mx-auto px-3 w-full fixed lg:sticky top-0 lg:left-0 -left-full z-100 flex flex-col lg:flex-row items-start lg:items-center justify-center lg:justify-between gap-4 h-screen lg:h-13 overflow-y-auto lg:overflow-visible md-surface-header"
  >
    <!-- ── Left: Template name + Anchor lock + Preview ────────────────────────────────────── -->
    <div class="flex items-center gap-3 w-[30%]">
      <!-- <div class="flex items-center shrink-0">
        No hardcoded Maildeno branding — this used to point at /builder-logo.svg
        (an asset that doesn't exist in this architecture). Beyond the broken
        path, an embeddable open-source editor shouldn't force its own logo on a
        host's product. Slot, empty by default.
        <slot name="logo" />
      </div> -->
      <input
        id="templateName"
        name="templateName"
        v-model="templateName"
        type="text"
        placeholder="New Template"
        class="w-50 px-2.5 py-1.25 outline-1 outline-(--md-surface-hover) rounded-lg shadow-xs focus:outline-none focus:ring-[1px] focus:ring-(--md-selection) placeholder:text-sm bg-(--md-surface-hover) text-(--md-text)"
      />
      <button
        @click="linksActive = !linksActive"
        class="relative group flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full transition-all"
        :class="
          linksActive
            ? 'bg-(--md-selection-bg) text-(--md-selection-fg)'
            : 'bg-(--md-surface-muted)/75 text-(--md-text-subtle)'
        "
      >
        <Icon :name="linksActive ? 'link' : 'lock'" style="font-size: 10px" />
        <span>{{ linksActive ? "Links" : "Locked" }}</span>

        <!-- Tooltip below -->
        <div
          class="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.75 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-[10px] rounded shadow-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          {{ linksActive ? "Lock links" : "Enable links" }}
          <div
            class="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-(--md-tooltip-bg) rotate-45"
          ></div>
        </div>
      </button>

      <button
        type="button"
        :aria-pressed="previewOverlayOpen"
        :aria-label="previewOverlayOpen ? 'Close preview' : 'Open preview'"
        @click="togglePreviewOverlay"
        class="relative group flex items-center justify-center rounded-md text-(--md-text-subtle) hover:text-(--md-text) hover:bg-(--md-surface-muted) p-1 transition-colors"
        :class="
          previewOverlayOpen
            ? 'bg-(--md-accent-soft) text-(--md-accent) hover:bg-(--md-accent-soft) hover:text-(--md-accent)'
            : ''
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="size-4"
        >
          <path
            d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>

        <!-- Tooltip below — same shape/timing as the Links/Locked button -->
        <div
          class="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.75 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-[10px] rounded shadow-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          {{ previewOverlayOpen ? "Close preview" : "Preview" }}
          <div
            class="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-(--md-tooltip-bg) rotate-45"
          ></div>
        </div>
      </button>
    </div>

    <!-- <div class="flex flex-row">
      {{ historyStatus }}
    </div>
    <template #fallback>
      <div class="flex flex-row">0 / 0</div>
    </template> -->

    <!-- ── Center: Health + Preview toggle + Undo/Redo + templates + New template ───────────────────── -->
    <div class="w-[30%] flex flex-row items-center justify-between">
      <HealthIndicator />

      <div class="flex bg-(--md-surface-hover) rounded-lg p-1">
        <button
          @click="previewMode = 'desktop'"
          :class="[
            'px-3 py-1 text-sm rounded transition-colors',
            previewMode === 'desktop'
              ? 'bg-(--md-surface) shadow text-(--md-text)'
              : 'text-(--md-text-muted)',
          ]"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </button>
        <button
          @click="previewMode = 'mobile'"
          :class="[
            'px-3 py-1 text-sm rounded transition-colors',
            previewMode === 'mobile'
              ? 'bg-(--md-surface) shadow text-(--md-text)'
              : 'text-(--md-text-muted)',
          ]"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </button>
      </div>
      <!-- AIAssistant deferred — see top-of-file note -->

      <div class="flex items-center gap-1">
        <button
          @click="undo"
          :disabled="!canUndo"
          :class="[
            'p-1.25 rounded transition-colors',
            canUndo
              ? 'hover:bg-(--md-surface-muted) text-(--md-text-muted)'
              : 'text-(--md-text-subtle) cursor-not-allowed',
          ]"
        >
          <svg
            class="w-4.5 h-4.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
        <button
          @click="redo"
          :disabled="!canRedo"
          :class="[
            'p-1.25 rounded transition-colors',
            canRedo
              ? 'hover:bg-(--md-surface-muted) text-(--md-text-muted)'
              : 'text-(--md-text-subtle) cursor-not-allowed',
          ]"
        >
          <svg
            class="w-4.5 h-4.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
            />
          </svg>
        </button>
      </div>

      <!-- Saved templates + New template. Grouped with a tighter gap than the
      surrounding controls so they read as one pair, and placed beside "Send
      test" where the other document-level actions live. -->
      <div v-if="showPanelButton" class="flex items-center gap-3">
        <button
          type="button"
          :aria-pressed="props.savedTemplatesOpen"
          :aria-label="props.versions ? 'Version history' : 'Saved templates'"
          @click="emit('toggle-saved-templates')"
          class="relative group flex items-center justify-center rounded-md text-(--md-text-subtle) hover:text-(--md-text) hover:bg-(--md-surface-muted) p-1 transition-colors"
          :class="
            props.savedTemplatesOpen
              ? 'bg-(--md-accent-soft) text-(--md-accent) hover:bg-(--md-accent-soft) hover:text-(--md-accent)'
              : ''
          "
        >
          <Icon
            :name="props.versions ? 'history' : 'th-large'"
            style="font-size: 14px"
          />
          <div
            class="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.75 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-[10px] rounded shadow-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            {{ props.versions ? "Version history" : "Saved templates" }}
            <div
              class="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-(--md-tooltip-bg) rotate-45"
            ></div>
          </div>
        </button>

        <!-- Starts a blank template. Without this there is no way back to a
 new document once a saved template has been opened. -->
        <button
          type="button"
          aria-label="New template"
          @click="emit('new-template')"
          class="relative group flex items-center justify-center rounded-md text-(--md-text-subtle) hover:text-(--md-text) hover:bg-(--md-surface-muted) p-1 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="size-3.5"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          <div
            class="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.75 py-1 bg-(--md-tooltip-bg) text-(--md-tooltip-text) text-[10px] rounded shadow-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            New template
            <div
              class="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-(--md-tooltip-bg) rotate-45"
            ></div>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Right: Auto-save indicator + Send test + DB Save + Export dropdown ─── -->
    <div class="flex items-center gap-4 w-[40%] justify-end">
      <!-- ── Auto-save status pill ──────────────────────────────────────────
      Four states. Uses Vue's <Transition mode="out-in"> so the pill
      cross-fades cleanly without layout shift.
      aria-live keeps screen readers informed without being disruptive.
      ─────────────────────────────────────────────────────────────────────── -->
      <Transition name="autosave-fade" mode="out-in">
        <!-- SAVING: spinner + label -->
        <div
          v-if="saveStatus === 'saving'"
          key="saving"
          class="flex items-center gap-1.5 text-[11px] font-medium text-(--md-text-subtle) select-none"
          aria-live="polite"
          aria-label="Saving draft…"
        >
          <svg
            class="w-3 h-3 animate-spin text-(--md-text-subtle)"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="3"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Saving…</span>
        </div>

        <!-- SAVED: green check + "Saved · X ago" -->
        <div
          v-else-if="saveStatus === 'saved'"
          key="saved"
          class="flex items-center gap-1.5 text-[11px] font-medium text-(--md-selection-fg) select-none"
          aria-live="polite"
          aria-label="Draft saved"
        >
          <svg
            class="w-3 h-3 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span
            >Saved<template v-if="lastSavedDisplay">
              · {{ lastSavedDisplay }}</template
            ></span
          >
        </div>

        <!-- ERROR: red warning -->
        <div
          v-else-if="saveStatus === 'error'"
          key="error"
          class="flex items-center gap-1.5 text-[11px] font-medium text-(--md-danger) select-none"
          aria-live="assertive"
          aria-label="Auto-save failed"
        >
          <svg
            class="w-3 h-3 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <span>Save failed</span>
        </div>

        <!-- IDLE + last save time: very subtle floppy icon + "X ago" -->
        <div
          v-else-if="saveStatus === 'idle' && lastSavedDisplay"
          key="idle"
          class="flex items-center gap-1 text-[11px] text-(--md-text-subtle) select-none"
          :aria-label="`Last saved ${lastSavedDisplay}`"
        >
          <svg
            class="w-2.5 h-2.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
            />
            <polyline
              stroke="white"
              stroke-width="2"
              fill="none"
              points="7 3 7 8 15 8"
            />
          </svg>
          <span>{{ lastSavedDisplay }}</span>
        </div>

        <!-- IDLE + never saved: render nothing (no orphan whitespace) -->
        <div
          v-else
          key="blank"
          class="w-0 overflow-hidden"
          aria-hidden="true"
        />
      </Transition>

      <!-- ── Send test email button ────────────────────────────────────────
      Original had `v-if="auth.user && auth.user.subscription?.plan
      !== 'free'"` — Maildeno's own auth/tier check. Replaced with the
      capability pattern: visible only if the host actually wired up
      a way to send (onSendTestEmail prop), not a hardcoded plan check.
      Visual: secondary action, sits between auto-save pill and Save.
      Uses pure Tailwind, matching the Export button styling.
      ─────────────────────────────────────────────────────────────────────── -->
      <button
        v-if="props.onSendTestEmail"
        @click="sendEmailVisible = true"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-(--md-text-muted) hover:text-(--md-text) rounded-md bg-(--md-surface-hover) hover:bg-(--md-surface-muted) transition-colors"
      >
        <svg
          class="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
          />
        </svg>
        Send test
      </button>

      <!-- ── Host actions ───────────────────────────────────────────────────
        Anything the host wants beside Save: a plan-gated control, an
        ownership label, a fork button.

        Immediately before Save rather than at the far end of the bar, because
        these are almost always about the save itself ("save as a system
        template", "saving as: alice@…") and reading them after the button
        they qualify is backwards.

        Renders nothing when unused — no wrapper, no gap — so a host that
        passes no slot sees the header exactly as it is today.
      ───────────────────────────────────────────────────────────────────── -->
      <div v-if="!!slots['header-actions']" class="flex items-center gap-2">
        <slot name="header-actions" v-bind="headerSlotProps" />
      </div>

      <!-- Save button. Absent entirely when the adapter can't save — see
        canSave. Hidden rather than disabled: a permanently greyed-out Save
        tells a guest the feature exists and they're not allowed it, which is
        a worse answer than not raising the question. -->
      <div v-if="canSave" class="flex items-center gap-2">
        <!-- ── DB Save button ─────────────────────────────────────────────────
        Label: create mode → "Save", edit mode → "Save" / "Saved" flash.
        ──────────────────────────────────────────────────────────────────────── -->
        <button
          @click="handleSave"
          :disabled="isSaving || builderMode === 'view'"
          class="md-btn-primary group relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <!-- Saving spinner -->
          <svg
            v-if="isSaving"
            class="w-3.5 h-3.5 animate-spin shrink-0"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>

          <!-- Saved checkmark flash -->
          <svg
            v-else-if="isSaved"
            class="w-3.5 h-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>

          <!-- Dynamic label -->
          <span>{{ saveLabel }}</span>
        </button>
      </div>

      <!-- ── Export dropdown ───────────────────────────────────────────────── -->
      <div class="relative" ref="dropdownRef">
        <button
          @click="isDropdownOpen = !isDropdownOpen"
          :aria-expanded="isDropdownOpen"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-(--md-text-muted) hover:text-(--md-text) rounded-md bg-(--md-surface-hover) transition-colors"
        >
          Export
          <svg
            class="w-3.25 h-3.25 transition-transform duration-150"
            :class="isDropdownOpen ? 'rotate-180' : ''"
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

        <div
          v-if="isDropdownOpen"
          class="absolute right-0 mt-2 w-72 md-surface-overlay rounded-xl py-1.5 z-50"
        >
          <div>
            <!-- Import -->
            <label
              class="flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) cursor-pointer transition-colors text-sm text-(--md-text-subtle)"
            >
              <Icon name="download" class="shrink-0" style="font-size: 13px" />
              Import JSON
              <input
                type="file"
                accept=".json,application/json"
                @change="handleImportFn"
                class="hidden"
              />
            </label>

            <div class="border-t border-(--md-border) mx-3 my-1.5"></div>
          </div>

          <!-- Minify toggle -->
          <div class="flex items-center justify-between px-3.5 py-2">
            <div class="flex items-center gap-2">
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-surface-muted) shrink-0"
              >
                <svg
                  class="w-3.5 h-3.5 text-(--md-text-subtle)"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="4 7 4 4 20 4" />
                  <polyline points="4 20 4 17" />
                  <line x1="4" y1="10.5" x2="20" y2="10.5" />
                  <line x1="4" y1="13.5" x2="14" y2="13.5" />
                  <line x1="4" y1="17" x2="9" y2="17" />
                </svg>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >Minify output</span
                >
                <span class="text-[11px] text-(--md-text-subtle)"
                  >Strip whitespace before download</span
                >
              </div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="minifyEnabled"
              @click="toggleMinify"
              :class="[
                'relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                minifyEnabled ? 'bg-(--md-selection)' : 'bg-(--md-border)',
              ]"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-(--md-surface) shadow transition-transform duration-200',
                  minifyEnabled ? 'translate-x-3.5' : 'translate-x-0',
                ]"
              />
            </button>
          </div>

          <div class="border-t border-(--md-border) mx-3 my-1.5"></div>

          <!-- Snapshot / Master tabs -->
          <div
            class="flex mx-3 mb-2 bg-(--md-surface-hover) rounded-lg p-0.5 gap-0.5"
          >
            <button
              @click="exportTab = 'snap'"
              :class="[
                'flex-1 py-1 text-[11px] font-medium rounded-md transition-all',
                exportTab === 'snap'
                  ? 'bg-(--md-surface) text-(--md-text) shadow-sm'
                  : 'text-(--md-text-subtle)',
              ]"
            >
              Snapshot · prune
            </button>
            <button
              @click="exportTab = 'master'"
              :class="[
                'flex-1 py-1 text-[11px] font-medium rounded-md transition-all',
                exportTab === 'master'
                  ? 'bg-(--md-surface) text-(--md-text) shadow-sm'
                  : 'text-(--md-text-subtle)',
              ]"
            >
              Master · wrap
            </button>
          </div>

          <!-- Snapshot pane -->
          <template v-if="exportTab === 'snap'">
            <!-- HTML snapshot -->
            <button
              v-if="exportFormats.includes('html')"
              @click="exportHTMLSnapshotFn"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) transition-colors text-left"
            >
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-warning-bg) shrink-0"
              >
                <svg
                  class="size-4 text-(--md-warning-fg)"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >HTML</span
                >
                <span class="text-[11px] text-(--md-text-subtle) line-clamp-3"
                  >Strips rows, comps that don't match preview context</span
                >
              </div>
            </button>
            <!-- React snapshot -->
            <button
              v-if="exportFormats.includes('react')"
              @click="exportReactSnapshotFn"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) transition-colors text-left"
            >
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-info-bg) shrink-0"
              >
                <div class="size-4.25">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="134.74"
                    height="120"
                    viewBox="0 0 256 228"
                    class="w-full h-full"
                  >
                    <path
                      fill="#00d8ff"
                      d="M210.483 73.824a172 172 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171 171 0 0 0-6.375 5.848a156 156 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a171 171 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a146 146 0 0 0 6.921 2.165a168 168 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a146 146 0 0 0 5.342-4.923a168 168 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145 145 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844m-6.365 70.984q-2.102.694-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14m-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a157 157 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345q.785 3.162 1.386 6.193M87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a157 157 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a135 135 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94M50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a135 135 0 0 1-6.318-1.979m12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144 144 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160 160 0 0 1-1.76-7.887m110.427 27.268a348 348 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381 381 0 0 0-7.365-13.322m-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322 322 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18M82.802 87.83a323 323 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a322 322 0 0 0-7.848 12.897m8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321 321 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147m37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486m52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382 382 0 0 0 7.859-13.026a347 347 0 0 0 7.425-13.565m-16.898 8.101a359 359 0 0 1-12.281 19.815a329 329 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310 310 0 0 1-12.513-19.846h.001a307 307 0 0 1-10.923-20.627a310 310 0 0 1 10.89-20.637l-.001.001a307 307 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329 329 0 0 1 12.335 19.695a359 359 0 0 1 11.036 20.54a330 330 0 0 1-11 20.722m22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026q-.518 2.504-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a161 161 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3M128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86"
                    />
                  </svg>
                </div>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >React Email
                  <span class="font-normal text-(--md-text-subtle) text-[11px]"
                    >.tsx</span
                  ></span
                >
                <span class="text-[11px] text-(--md-text-subtle) line-clamp-3"
                  >Strips rows, comps that don't match preview context</span
                >
              </div>
            </button>
            <!-- MJML snapshot -->
            <button
              v-if="exportFormats.includes('mjml')"
              @click="exportMJMLSnapshotFn"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) transition-colors text-left"
            >
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-danger-bg) shrink-0"
              >
                <div class="size-4.25">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="120"
                    height="120"
                    viewBox="0 0 120 120"
                    class="w-full h-full"
                  >
                    <g transform="translate(9.943 14.253)scale(.8026)">
                      <path
                        fill="#ff5722"
                        d="M14.5 0h57.3c8 0 14.5 6.5 14.5 14.5S79.8 29 71.8 29H14.5C6.5 29 0 22.5 0 14.5S6.5 0 14.5 0"
                      />
                      <ellipse
                        cx="109.2"
                        cy="14.5"
                        fill="#ff5722"
                        rx="14.8"
                        ry="14.5"
                      />
                      <path
                        fill="#ff5722"
                        d="M52.6 43.3h56.6c8-.6 14.9 5.5 15.5 13.5s-5.5 14.9-13.5 15.5H52.6c-8 .6-14.9-5.5-15.5-13.5s5.5-14.9 13.5-15.5H52z"
                      />
                      <path
                        fill="#ff1744"
                        d="M14.8 43c8.2 0 14.8 6.6 14.8 14.8S23 72.6 14.8 72.6C6.6 72.5 0 65.9 0 57.8C0 49.6 6.6 43 14.8 43"
                      />
                      <path
                        fill="#ff5722"
                        d="M14.5 85h57.3c8 0 14.5 6.5 14.5 14.5S79.8 114 71.8 114H14.5C6.5 114 0 107.5 0 99.5S6.5 85 14.5 85"
                      />
                      <ellipse
                        cx="109.2"
                        cy="99.5"
                        fill="#ff5722"
                        rx="14.8"
                        ry="14.5"
                      />
                    </g>
                  </svg>
                </div>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >MJML</span
                >
                <span class="text-[11px] text-(--md-text-subtle) line-clamp-3"
                  >Strips rows, comps that don't match preview context</span
                >
              </div>
            </button>
          </template>

          <!-- Master pane -->
          <template v-else>
            <!-- HTML master -->
            <button
              v-if="exportFormats.includes('html')"
              @click="exportHTMLMasterFn"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) transition-colors text-left"
            >
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-warning-bg) shrink-0"
              >
                <svg
                  class="size-4 text-(--md-warning-fg)"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >HTML</span
                >
                <span class="text-[11px] text-(--md-text-subtle) line-clamp-3"
                  >All rows, comps kept, ESP conditional tags added</span
                >
              </div>
            </button>
            <!-- React master -->
            <button
              v-if="exportFormats.includes('react')"
              @click="exportReactMasterFn"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) transition-colors text-left"
            >
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-info-bg) shrink-0"
              >
                <div class="size-4.25">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="134.74"
                    height="120"
                    viewBox="0 0 256 228"
                    class="w-full h-full"
                  >
                    <path
                      fill="#00d8ff"
                      d="M210.483 73.824a172 172 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171 171 0 0 0-6.375 5.848a156 156 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a171 171 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a146 146 0 0 0 6.921 2.165a168 168 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a146 146 0 0 0 5.342-4.923a168 168 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145 145 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844m-6.365 70.984q-2.102.694-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14m-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a157 157 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345q.785 3.162 1.386 6.193M87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a157 157 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a135 135 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94M50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a135 135 0 0 1-6.318-1.979m12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144 144 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160 160 0 0 1-1.76-7.887m110.427 27.268a348 348 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381 381 0 0 0-7.365-13.322m-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322 322 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18M82.802 87.83a323 323 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a322 322 0 0 0-7.848 12.897m8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321 321 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147m37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486m52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382 382 0 0 0 7.859-13.026a347 347 0 0 0 7.425-13.565m-16.898 8.101a359 359 0 0 1-12.281 19.815a329 329 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310 310 0 0 1-12.513-19.846h.001a307 307 0 0 1-10.923-20.627a310 310 0 0 1 10.89-20.637l-.001.001a307 307 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329 329 0 0 1 12.335 19.695a359 359 0 0 1 11.036 20.54a330 330 0 0 1-11 20.722m22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026q-.518 2.504-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a161 161 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3M128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86"
                    />
                  </svg>
                </div>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >React Email
                  <span class="font-normal text-(--md-text-subtle) text-[11px]"
                    >.tsx</span
                  ></span
                >
                <span class="text-[11px] text-(--md-text-subtle) line-clamp-3"
                  >JSX conditionals via props, all rows, comps kept</span
                >
              </div>
            </button>

            <!-- MJML master -->
            <button
              v-if="exportFormats.includes('mjml')"
              @click="exportMJMLMasterFn"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) transition-colors text-left"
            >
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-danger-bg) shrink-0"
              >
                <div class="size-4.25">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="120"
                    height="120"
                    viewBox="0 0 120 120"
                    class="w-full h-full"
                  >
                    <g transform="translate(9.943 14.253)scale(.8026)">
                      <path
                        fill="#ff5722"
                        d="M14.5 0h57.3c8 0 14.5 6.5 14.5 14.5S79.8 29 71.8 29H14.5C6.5 29 0 22.5 0 14.5S6.5 0 14.5 0"
                      />
                      <ellipse
                        cx="109.2"
                        cy="14.5"
                        fill="#ff5722"
                        rx="14.8"
                        ry="14.5"
                      />
                      <path
                        fill="#ff5722"
                        d="M52.6 43.3h56.6c8-.6 14.9 5.5 15.5 13.5s-5.5 14.9-13.5 15.5H52.6c-8 .6-14.9-5.5-15.5-13.5s5.5-14.9 13.5-15.5H52z"
                      />
                      <path
                        fill="#ff1744"
                        d="M14.8 43c8.2 0 14.8 6.6 14.8 14.8S23 72.6 14.8 72.6C6.6 72.5 0 65.9 0 57.8C0 49.6 6.6 43 14.8 43"
                      />
                      <path
                        fill="#ff5722"
                        d="M14.5 85h57.3c8 0 14.5 6.5 14.5 14.5S79.8 114 71.8 114H14.5C6.5 114 0 107.5 0 99.5S6.5 85 14.5 85"
                      />
                      <ellipse
                        cx="109.2"
                        cy="99.5"
                        fill="#ff5722"
                        rx="14.8"
                        ry="14.5"
                      />
                    </g>
                  </svg>
                </div>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >MJML</span
                >
                <span class="text-[11px] text-(--md-text-subtle) line-clamp-3"
                  >All rows, comps kept, ESP conditional tags added</span
                >
              </div>
            </button>
          </template>

          <div class="border-t border-(--md-border) mx-3 my-1.5"></div>

          <div>
            <!-- JSON export -->
            <button
              v-if="exportFormats.includes('json')"
              @click="exportJSONFn"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-surface-hover) transition-colors text-left"
            >
              <span
                class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-accent-soft) shrink-0"
              >
                <svg
                  class="w-3.5 h-3.5 text-(--md-accent)"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <div>
                <span class="block text-sm font-medium text-(--md-text)"
                  >Export JSON</span
                >
                <span class="text-[11px] text-(--md-text-subtle) line-clamp-3"
                  >Raw template, merge tags intact</span
                >
              </div>
            </button>

            <div class="border-t border-(--md-border) mx-3 my-1.5"></div>
          </div>

          <!-- Clear -->
          <button
            @click="clearTemplateFn"
            class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-(--md-danger-bg) transition-colors text-left"
          >
            <span
              class="flex items-center justify-center w-7 h-7 rounded-md bg-(--md-danger-bg) shrink-0"
            >
              <Icon
                name="trash"
                class="text-(--md-danger)"
                style="font-size: 13px"
              />
            </span>
            <span class="text-sm font-medium text-(--md-danger)"
              >Clear template</span
            >
          </button>
        </div>
      </div>
    </div>

    <!-- Send test email modal — mounted at the header level so it's always available
    regardless of context. The modal owns the form and validation; onSend (the
    host's onSendTestEmail) owns what actually happens on submit. -->
    <SendEmail
      v-if="props.onSendTestEmail"
      v-model:visible="sendEmailVisible"
      :get-html="getHtmlForSending"
      :default-subject="templateName"
      :on-send="props.onSendTestEmail"
    />
  </header>

  <!-- ── Preview overlay (Teleport to body) ────────────────────────────────
  Teleported so the overlay escapes the header's sticky/fixed stacking
  context and any parent `transform` / `filter` / `contain` that would
  otherwise pin it. Mounted ONCE and toggled with v-show — closing the
  overlay doesn't unmount PreviewScreen, so its internal state
  (selectedClients, activeClient, exportedHtml cache) survives across
  open/close cycles. That's the whole point of moving away from
  NuxtLink to="/preview": no remount → no template re-fetch.

  z-9000 sits above the header (which uses z-100) and any
  any overlay that doesn't reach into the four-figure range.

  The wrapper is a fixed inset-0 host; PreviewScreen itself uses
  absolute inset-0 within it, so we can resize/animate the host
  without touching the screen component. -->
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      v-show="previewOverlayOpen"
      class="fixed inset-0 z-9000"
      aria-hidden="false"
    >
      <PreviewScreen @close="closePreviewOverlay" />
    </div>
  </Teleport>
</template>

<style scoped>
/* Auto-save pill: fade + 4px vertical drift on enter/leave */
.autosave-fade-enter-active,
.autosave-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.autosave-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.autosave-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
