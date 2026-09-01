<template>
  <!-- Single root element, deliberately: this template previously had two
    root nodes (DesktopOnlyNotice plus the conditional div below),
    making it a fragment — and Vue can't auto-inherit attributes onto a
    fragment, so any style/class a consumer passed (e.g. the
    style="height: 100vh" in every usage example) was silently dropped
    with only a console warning. With one root, those fall through and
    apply normally. -->
  <!-- md-editor-scope is what the injected stylesheet is scoped to. Every
    rule in it is prefixed with :where(.md-editor-scope), so without this
    class the editor renders completely unstyled — and with it, none of
    those rules can reach the host page. :where() adds no specificity, so
    the cascade inside the editor is unchanged.

    Teleported content (dialogs, toasts, the assistant drawer, colour
    pickers) leaves this subtree, which is why useTeleportTarget points at
    an element INSIDE the editor rather than document.body. -->
  <div ref="rootEl" class="md-editor-scope">
    <DesktopOnlyNotice :brand-name="brandName" />
    <div v-if="isDesktop" class="flex flex-col min-h-screen">
      <!-- Mounted first, deliberately, before Header/Toast/ConfirmDialog and
        everything else — the teleportTargetEl ref this populates needs to
        exist before any component that might read it via
        useTeleportTarget() or :append-to mounts. Vue mounts template
        children in document order, so position here is what guarantees
        that, not just the ref existing in script setup. Landing spot for
        every <Teleport :to="useTeleportTarget()"> across this package
        (color pickers, merge-tag picker, loading overlay, canvas action
        bar, preview client picker/screen) and the toast/confirm layers
        below — see
        useTeleportTarget.ts for the full story. Lives inside the same DOM
        subtree as everything else here, so it's inside the shadow root
        for the custom-element path and in normal light DOM otherwise,
        matching whichever this component itself is in. No positioning
        needed on this div itself — each teleported panel already carries
        its own fixed/absolute positioning and z-index. -->
      <div ref="teleportTargetEl"></div>
      <Header
        @save="
          notifySave({
            templateId:
              $event.templateId == null ? null : String($event.templateId),
          })
        "
        :on-send-test-email="onSendTestEmail"
        :capabilities="props.capabilities"
        :saved-templates-open="savedTemplatesOpen"
        :versions="props.versions"
        :can-save="canSave"
        @toggle-saved-templates="savedTemplatesOpen = !savedTemplatesOpen"
        @new-template="handleNewTemplate"
      >
        <!-- Forwarded so hosts reach it as <EmailEditor #header-actions>
             rather than having to know Header exists. v-if on the host's own
             slot, not on this component's — a forwarded slot always looks
             present to the child, which would render an empty wrapper and a
             stray gap in the header. -->
        <template v-if="slots['header-actions']" #header-actions="hp">
          <slot name="header-actions" v-bind="hp" />
        </template>
      </Header>
      <div
        :style="getBodyStyles()"
        class="flex flex-1 relative 2xl:container 2xl:mx-auto"
      >
        <!-- ─── Builder Loading Overlay ────────────────────────────────────────
        Sits above the entire workspace (z-50). Fades out via <Transition>
        once isReady flips to true (after nextTick inside
        initForCreate / loadTemplate / initFromStorage).
        opacity-0 + pointer-events-none ensures the canvas below is
        completely invisible and non-interactive during hydration, preventing
        any flash of stale/empty content.
        ──────────────────────────────────────────────────────────────────── -->
        <Loader v-if="!isReady" />
        <SidebarLeft />
        <!--
        Saved Rows panel — sits between the left sidebar and the canvas.
        Controlled by isOpen from useSavedRowsPanel(). The <Transition> lives
        inside SavedRowsPanel itself, so this mounts/unmounts smoothly without
        any extra logic here.
        -->
        <VersionHistoryPanel
          v-if="props.versions"
          :open="savedTemplatesOpen"
          :template-id="templateId"
          @close="savedTemplatesOpen = false"
          @restore="handleRestoreVersion"
        />
        <SavedTemplatesPanel
          v-else
          :open="savedTemplatesOpen"
          :current-template-id="templateId"
          @close="savedTemplatesOpen = false"
          @select="handleSelectTemplate"
        />
        <SavedRowsPanel />
        <Canvas />
        <SidebarRight />
        <InfoDialog
          :visible="infoDialog.visible.value"
          :header="infoDialog.header.value"
          :message="infoDialog.message.value"
          @update:visible="infoDialog.visible.value = $event"
        />
        <AssistantPanel
          v-if="props.assistant || !!slots.assistant"
          :assistant="props.assistant"
          :has-slot="!!slots.assistant"
          :editor="editorWriteApi"
        >
          <template v-if="slots.assistant" #assistant="slotProps">
            <slot name="assistant" v-bind="slotProps" />
          </template>
        </AssistantPanel>
        <ShadowSafeToast />
        <ConfirmDialog />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  watch,
  getCurrentInstance,
  ref,
  useSlots,
  nextTick,
} from "vue";
import { useDeviceDetection } from "@/composables/system/useDeviceDetection";
import { provideEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { provideSavedRowsPanel } from "@/composables/system/useSavedRowsPanel";
import { provideLayoutDrag } from "@/composables/emailBuilder/core/ui/useLayoutDrag";
import { provideProductRows } from "@/composables/emailBuilder/components/useProductRows";
import { provideSystemRows } from "@/composables/emailBuilder/components/useSystemRows";
import { provideInfoDialog } from "@/composables/ui/useInfoDialog";
import { provideTeleportTarget } from "@/composables/ui/useTeleportTarget";
import { useConfirm } from "@/composables/ui/useConfirm";
import { injectBaseStylesIntoHead } from "@/baseStyles";
import { hasExtractedScopedCss } from "@/shadowStyles";
import { mirrorHeadStylesInto } from "@/devStyleMirror";
import { registerBuiltInBlocks } from "@/blocks";
import DesktopOnlyNotice from "@/components/DesktopOnlyNotice.vue";
import Canvas from "./canvas/Canvas.vue";
import SidebarLeft from "./layout/SidebarLeft.vue";
import SavedRowsPanel from "./product/SavedRowsPanel.vue";
import SidebarRight from "./layout/SidebarRight.vue";
import Loader from "./ui/canvas/Loader.vue";
import InfoDialog from "@/components/ui/InfoDialog.vue";
import SavedTemplatesPanel from "@/components/features/emailBuilder/product/SavedTemplatesPanel.vue";
import VersionHistoryPanel from "@/components/features/emailBuilder/product/VersionHistoryPanel.vue";
import ShadowSafeToast from "@/components/ui/ShadowSafeToast.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Header from "./layout/Header.vue";
import { provideStorageAdapter } from "@/adapters";
import type { PartialStorageAdapter } from "@/adapters/types";
import { setEditorTheme, type ThemeOptions } from "@/theme";
import { provideCanSave } from "@/adapters";
import AssistantPanel from "./assistant/AssistantPanel.vue";
import type { AssistantMount, EditorWriteApi } from "@/types/assistant";

// No prop passed = true (create page), prop passed = use that value
const props = withDefaults(
  defineProps<{
    isReady?: boolean;
    storageAdapter?: PartialStorageAdapter;
    /** If given, loaded via the adapter on mount. Omit to start blank
     * (create mode) — matches the original app's /create vs /edit split,
     * now driven by a prop instead of a route. */
    templateId?: string;
    /** Applied on mount via CSS custom properties (see theme.ts) — works
     * whether this component is used directly or wrapped by element.ts's
     * defineCustomElement. `host` below (a direct instance.ce read, see
     * its own comment) is the shadow host when running as a custom
     * element, null otherwise, so the right target (:host vs :root) is
     * picked automatically — the consumer never needs to know which mode
     * they're in. */
    theme?: ThemeOptions;
    /** If provided, the "Send test" button appears in the header. Editor
     * owns the form/validation UI; this callback owns what actually
     * happens on submit (SMTP, an API, anything) — same host-owns-the-
     * operation pattern as the storage adapter. */
    /**
     * Called after a successful save. Its presence is what reveals the Save
     * button — same idiom as onSendTestEmail below.
     *
     * Gating on an explicit handler rather than on the storage adapter,
     * because the adapter can't answer the question: PartialStorageAdapter
     * is merged with the localStorage defaults, so `saveTemplate` always
     * exists by the time anything reads it. A host that wants a read-only or
     * guest editor simply omits this.
     *
     * The `save` event still fires alongside, so `@save` keeps working — and
     * because Vue compiles `@save="fn"` to an `onSave` prop, writing the
     * listener is itself enough to reveal the button.
     */
    onSave?: (payload: { templateId: string | null }) => void;
    /**
     * The same handler, under a name that doesn't begin with "on".
     *
     * For the custom-element path only. Vue's defineCustomElement treats
     * `on*` keys as event listeners rather than props, so `el.onSave = fn`
     * never reaches this component — the button appeared and the callback
     * never fired. init() sets this instead. Vue hosts should use `@save`.
     */
    saveHandler?: (payload: { templateId: string | null }) => void;
    onSendTestEmail?: (payload: {
      to: string;
      subject: string;
      html: string;
    }) => Promise<void> | void;
    /** Explicit UI restrictions, layered on top of the implicit ones
     * (e.g. onSendTestEmail's mere presence/absence already gates that
     * button — capabilities doesn't replace that, it adds to it).
     * Omit any key to leave that area fully enabled — this restricts,
     * it never grants something that wasn't already possible. */
    capabilities?: {
      /** Which formats appear in the Export dropdown. Omit for all four. */
      export?: Array<"html" | "mjml" | "react" | "json">;
    };
    /** Name shown in the desktop-only notice's "Powered by" line.
     *
     * Deliberately a prop rather than a theme token: `theme` carries
     * colours, and this is text, so it has no sensible home in the token
     * map. It is also the one piece of chrome a host cannot restyle away,
     * since the notice replaces the entire editor on small screens.
     *
     * No default is declared here on purpose — DesktopOnlyNotice.vue owns
     * it, so there is one place to change it rather than two that can
     * drift. Omit for the package default; pass an empty string to drop
     * the attribution line entirely. */
    brandName?: string;
    /** Replaces the saved-templates panel (and its header button) with
     * version history.
     *
     * A swap rather than an addition, because the two answer different
     * questions — "which template?" versus "which state of this template?"
     * — and a host that has its own template browser elsewhere in its app
     * has no use for the former inside the editor. Two panels competing for
     * the same slot would also mean two header buttons and a layout
     * decision the editor shouldn't be making.
     *
     * Top-level rather than a `capabilities` key on purpose: capabilities
     * documents itself as only ever restricting, never granting, and this
     * grants.
     *
     * The panel still degrades per-method — see the version methods on
     * EditorStorageAdapter. Setting this with an adapter that can't list
     * versions gets an honest "not supported" message, not a broken panel. */
    versions?: boolean;
    /** Fills the assistant drawer from a non-Vue host (init(), React,
     * vanilla). Vue hosts use the #assistant slot instead; either one being
     * present reveals the trigger button, and neither means no assistant UI
     * renders at all.
     *
     * The editor supplies the drawer, its trigger, open/close state, escape
     * handling, focus return and shadow-DOM-safe teleporting. What goes
     * inside is entirely the host's — see the AssistantPanel comment for
     * why the assistant itself isn't in this package. */
    assistant?: AssistantMount;
  }>(),
  {
    isReady: true,
  },
);

// Header currently exposes this action as a no-argument callback, while the
// public editor API accepts the submitted test-email payload.
const onSendTestEmail = props.onSendTestEmail as (() => void) | undefined;

/**
 * Whether the host opted into saving.
 *
 * Read from vnode.props rather than props.onSave because `save` is declared
 * in defineEmits: Vue routes `@save` / `:on-save` to the emit machinery, so
 * it never lands in props. vnode.props is where the raw listener actually is,
 * and it re-evaluates on re-render, so a host that adds the handler
 * conditionally still gets the right button state.
 */
const saveHandler = computed(() => props.onSave ?? props.saveHandler ?? null);
const canSave = computed(() => typeof saveHandler.value === "function");

/**
 * Calls the host's onSave, then re-dispatches as a DOM event.
 *
 * `save` used to be a defineEmits entry. That works for the Vue path but is
 * silently broken for custom elements: defineCustomElement REPLACES
 * instance.emit with a DOM-event dispatcher, so `emit("save")` fired a
 * CustomEvent and never called the handler the host had passed. The button
 * appeared (the prop was there) and the callback never ran.
 *
 * Calling the prop directly works on every path. The dispatch is kept
 * alongside it so `handle.on("save", …)` from init() still receives the
 * event — that listener is registered after mount, so it cannot be a prop.
 *
 * bubbles + composed so the event escapes the shadow root and reaches the
 * <maildeno-editor> host element, which is where init() attaches.
 */
const rootEl = ref<HTMLElement | null>(null);

function notifySave(payload: { templateId: string | null }) {
  saveHandler.value?.(payload);
  rootEl.value?.dispatchEvent(
    new CustomEvent("save", {
      detail: [payload],
      bubbles: true,
      composed: true,
    }),
  );
}
// Shared with useEmailBuilder so the autosave timer stops too — otherwise a
// guest session keeps firing saves in the background with no button in sight.
provideCanSave(canSave);

const emit = defineEmits<{
  /** Fires after a successful save. The host decides what to do with the
   * templateId — persist it in their own URL/state/DB, however they track
   * "which template is open." The editor doesn't own that decision. */
  /**
   * Fires once the canvas has actually rendered its initial content.
   *
   * Exists because "the component mounted" and "the user can look at it" are
   * different moments: on mount the editor still has to resolve the host's
   * loadTemplate, hydrate the returned rows and paint them. A host that
   * removes its loading placeholder on mount shows the canvas mid-hydration —
   * blocks appearing one after another — which reads as the page breaking.
   *
   * Emitted after the internal ready state flips AND a tick has passed, so
   * the DOM for that first paint exists by the time the handler runs. Fires
   * exactly once per mount; switching templates afterwards does not re-emit,
   * since the canvas is already on screen.
   */
  ready: [];
}>();

const { isDesktop } = useDeviceDetection();
// null unless running inside element.ts's custom element. Reads the same
// underlying instance.ce Vue's own useHost() checks internally, but
// without calling that helper directly — useHost() unconditionally warns
// whenever it's not inside a custom element, which is the expected,
// correct case for the plain Vue-component usage path (this file, most of
// the time) — not something worth a console warning on every normal
// mount. `ce` is a real property at runtime (confirmed against Vue's own
// useHost() source) but isn't part of ComponentInternalInstance's public
// type surface, hence the cast.
const host = (getCurrentInstance() as { ce?: HTMLElement } | null)?.ce ?? null;

// The real fix this exists for: makes "just import EmailEditor" genuinely
// enough for styling, with zero separate CSS import needed — matching how
// the custom-element path (element.ts) already worked, and matching what
// a consumer reasonably expects from installing one package. Only runs
// for the plain Vue-component path (host is null) — the custom-element
// path already gets this same CSS correctly, via shadowStyles.ts
// injecting into the shadow root instead of document.head here.
// injectBaseStylesIntoHead() is itself idempotent (see baseStyles.ts) —
// safe to call on every mount, whether that's one instance or several.
if (!host) injectBaseStylesIntoHead();

// Running inside a shadow root from source (the playground and its
// element-demo page) means component scoped CSS was never substituted into
// the bundle — Vite put it in document.head instead, which a shadow root
// does not inherit. Mirroring it in is what stops the editor rendering
// with unsized icons and chrome-less dialogs there. In a built bundle the
// styles are already present, so this is skipped entirely.
if (host && !hasExtractedScopedCss()) {
  const stopMirror = mirrorHeadStylesInto(host.shadowRoot as ShadowRoot);
  onUnmounted(stopMirror);
}

const storageAdapter = provideStorageAdapter(props.storageAdapter);
const infoDialog = provideInfoDialog();
// A dedicated element (see the template) rather than the shadow root
// itself directly — a concrete, predictable Element to target, and a
// natural landing spot in the DOM tree for teleported content. Doesn't
// exist yet here (template refs populate post-mount) — see
// useTeleportTarget.ts's own comment for why providing the Ref itself,
// not .value, is what makes that not matter.
const teleportTargetEl = ref<HTMLElement | null>(null);

// Saved-templates panel. Kept here rather than in a composable because it is a
// single boolean with one consumer — the Header toggles it, the panel reads it.
const savedTemplatesOpen = ref(false);
const confirm = useConfirm();

/**
 * Both actions below replace the whole canvas, so they ask first when there is
 * something to lose.
 *
 * Gated on "the canvas has rows" rather than a dirty flag, deliberately: there
 * is no dirty tracking in the builder, and inventing one here would be a
 * bigger change than this warrants. The heuristic errs toward asking — a
 * needless prompt is a minor annoyance, silently discarding someone's work is
 * not. An empty canvas skips the prompt entirely, so the common
 * open-editor-then-pick-a-template flow stays one click.
 */
function confirmIfCanvasHasContent(message: string, onAccept: () => void) {
  if (!rows.value?.length) return onAccept();
  confirm.require({
    header: "Discard current template?",
    message,
    acceptLabel: "Discard",
    rejectLabel: "Cancel",
    accept: onAccept,
  });
}

/**
 * Loads a template chosen from the panel, reusing the same loadTemplateById the
 * editor already uses on mount — so hydration, history reset and auto-save
 * stamping all behave identically to opening a template directly.
 */
function handleSelectTemplate(templateId: string) {
  confirmIfCanvasHasContent(
    "Opening a saved template will replace what's currently on the canvas.",
    async () => {
      savedTemplatesOpen.value = false;
      try {
        await loadTemplateById(templateId);
      } catch (e) {
        console.error("[maildeno-editor] failed to load template:", e);
      }
    },
  );
}

/**
 * Restores a version into the canvas.
 *
 * Goes through setJson's default "undoable" path rather than
 * loadTemplateById, which matters: the panel's confirm dialog promises the
 * user they can undo afterwards, and only the undoable path keeps that
 * true. It also leaves templateId untouched, so the next save still
 * overwrites the same template — restoring an old state must not fork a
 * new document.
 *
 * No confirmIfCanvasHasContent here, unlike handleSelectTemplate: the panel
 * has already confirmed, and a second dialog for one action reads like a bug.
 */
async function handleRestoreVersion(versionId: string) {
  if (!templateId.value) return;
  savedTemplatesOpen.value = false;
  try {
    const snapshot = await storageAdapter.getTemplateVersion(
      templateId.value,
      versionId,
    );
    if (!snapshot) {
      console.warn("[maildeno-editor] version not found:", versionId);
      return;
    }
    // TemplateSnapshot uses canvasStyles; setJson takes the export shape.
    // Mapped here rather than widening normalizeTemplateSnapshot, which
    // describes the on-disk template format — the adapter's in-memory type
    // is a separate concern and conflating them would let one drift into
    // the other.
    setJson({
      canvas: snapshot.canvasStyles,
      content: { rows: snapshot.rows },
    });
  } catch (e) {
    console.error("[maildeno-editor] failed to restore version:", e);
  }
}

/**
 * Starts a blank template — clears the canvas, drops the autosaved draft, and
 * resets templateId/builderMode so the header shows "Save" again and the next
 * save creates a new template instead of overwriting the one that was open.
 */
function handleNewTemplate() {
  confirmIfCanvasHasContent(
    "Starting a new template will clear what's currently on the canvas.",
    () => {
      savedTemplatesOpen.value = false;
      startNewTemplate();
    },
  );
}
provideTeleportTarget(teleportTargetEl);
// Passed directly rather than left for provideEmailBuilder/provideProductRows
// to re-inject internally: inject() never sees a component's own provides,
// only its parent's — a component can never inject what it itself just
// provided, regardless of call order within its own setup(). Both of
// these run inside EmailEditor.vue's own setup, the same instance that
// just called provideStorageAdapter/provideInfoDialog above.
const {
  rows,
  templateId,
  canvasStyles,
  isBuilderReady,
  initForCreate,
  startNewTemplate,
  loadTemplateById,
  savedTemplateName,
  getExportedHTML,
  getExportedMJML,
  getExportedReactEmail,
  getExportedJSON,
  setJson,
  getSelection,
  setSelection,
  onChange,
} = provideEmailBuilder(storageAdapter, infoDialog);
provideSavedRowsPanel();
provideProductRows(storageAdapter);
// One shared instance, same reasoning as provideProductRows — the panel and
// any future consumer read one fetched list rather than each fetching again.
provideSystemRows(storageAdapter);
provideLayoutDrag();
registerBuiltInBlocks();

// Exposed for programmatic access — defineExpose'd methods on a component
// wrapped by defineCustomElement (element.ts) become directly callable on
// the custom element instance itself (el.getHtml(), not el.$refs or
// anything Vue-internal), which is what init.ts's EditorHandle.getHtml()
// forwards to. Also directly usable if EmailEditor is mounted as a plain
// Vue component and the host has a template ref to it.
// Read rather than $slots in the template: a parent that forwards a slot
// always yields a truthy entry in the CHILD's $slots, so AssistantPanel
// can't tell "host gave me a slot" from "parent forwarded an empty one".
// Deciding here, where the host's own slots are visible, is the only place
// the answer is accurate.
const slots = useSlots();

/**
 * The canvas API handed to assistant panels — the same object for both the
 * slot prop and assistant.mount(), so the two paths cannot diverge.
 *
 * Built from the same functions defineExpose publishes below rather than
 * re-deriving them: a second definition would be a second thing to keep in
 * sync every time the write API grows.
 */
const editorWriteApi: EditorWriteApi = {
  getJson: () => getExportedJSON(savedTemplateName.value ?? undefined),
  setJson,
  getSelection,
  setSelection,
  onChange,
};

defineExpose({
  getHtml: (mode: "prune" | "wrap" = "prune") =>
    getExportedHTML(mode, savedTemplateName.value ?? undefined),
  getMjml: (mode: "prune" | "wrap" = "prune") =>
    getExportedMJML(mode, savedTemplateName.value ?? undefined),
  getReactEmail: (mode: "prune" | "wrap" = "prune") =>
    getExportedReactEmail(mode, savedTemplateName.value ?? undefined),
  getJson: () => getExportedJSON(savedTemplateName.value ?? undefined),

  // ── Write side ──────────────────────────────────────────────────────────
  // Mirrors the getters above. Hosts that need to drive the canvas (version
  // restore, AI assistant) go through these rather than reaching into
  // builder internals, which is what keeps hydration, history and the id
  // registry correct without the caller reimplementing any of it.
  setJson,
  getSelection,
  setSelection,
  onChange,
});

watch(
  () => props.theme,
  (theme) => {
    if (theme) setEditorTheme(theme, host ?? undefined);
  },
  { immediate: true, deep: true },
);

onMounted(async () => {
  if (props.templateId) {
    await loadTemplateById(props.templateId);
  } else {
    initForCreate();
  }
});

// isReady combines the host's prop (defaults true — an override, not the
// normal signal) with the internal load-completion state. Previously this
// only ever reflected the static prop default, so the Loader would never
// actually show while loadTemplateById's fetch was in flight.
const isReady = computed(() => props.isReady && isBuilderReady.value);

// Deliberately watches the computed rather than emitting at the end of
// onMounted: loadTemplateById resolving is not the same as the rows being
// painted, and isBuilderReady is the flag the Loader itself uses. Two ticks
// — one for the v-if to swap the Loader out for the canvas, one for the
// canvas subtree to render — so a host hiding its own skeleton on this event
// swaps into a canvas that is already there.
let readyEmitted = false;
watch(
  () => isReady.value,
  async (ready) => {
    if (!ready || readyEmitted) return;
    readyEmitted = true;
    await nextTick();
    await nextTick();
    emit("ready");
  },
  { immediate: true },
);

const getBodyStyles = () => {
  const styles: Record<string, string> = {
    backgroundColor: canvasStyles.value.bodyBackgroundColor,
  };

  if (canvasStyles.value.bodyBackgroundImage) {
    styles.backgroundImage = `url(${canvasStyles.value.bodyBackgroundImage})`;
    styles.backgroundSize = canvasStyles.value.bodyBackgroundSize;
    styles.backgroundPosition = canvasStyles.value.bodyBackgroundPosition;
    styles.backgroundRepeat = canvasStyles.value.bodyBackgroundRepeat;
  }

  return styles;
};
</script>
