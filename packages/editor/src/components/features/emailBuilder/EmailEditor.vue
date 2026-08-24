<template>
  <!-- Single root element, deliberately: this template previously had two
    root nodes (DesktopOnlyNotice plus the conditional div below),
    making it a fragment — and Vue can't auto-inherit attributes onto a
    fragment, so any style/class a consumer passed (e.g. the
    style="height: 100vh" in every usage example) was silently dropped
    with only a console warning. With one root, those fall through and
    apply normally. -->
  <div>
    <DesktopOnlyNotice />
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
          emit('save', {
            templateId:
              $event.templateId == null ? null : String($event.templateId),
          })
        "
        :on-send-test-email="onSendTestEmail"
        :capabilities="props.capabilities"
        :saved-templates-open="savedTemplatesOpen"
        @toggle-saved-templates="savedTemplatesOpen = !savedTemplatesOpen"
        @new-template="handleNewTemplate"
      />
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
        <SavedTemplatesPanel
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
} from "vue";
import { useDeviceDetection } from "@/composables/system/useDeviceDetection";
import { provideEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import { provideSavedRowsPanel } from "@/composables/system/useSavedRowsPanel";
import { provideLayoutDrag } from "@/composables/emailBuilder/core/ui/useLayoutDrag";
import { provideProductRows } from "@/composables/emailBuilder/components/useProductRows";
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
import ShadowSafeToast from "@/components/ui/ShadowSafeToast.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Header from "./layout/Header.vue";
import { provideStorageAdapter } from "@/adapters";
import type { PartialStorageAdapter } from "@/adapters/types";
import { setEditorTheme, type ThemeOptions } from "@/theme";

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
  }>(),
  {
    isReady: true,
  },
);

// Header currently exposes this action as a no-argument callback, while the
// public editor API accepts the submitted test-email payload.
const onSendTestEmail = props.onSendTestEmail as (() => void) | undefined;

const emit = defineEmits<{
  /** Fires after a successful save. The host decides what to do with the
   * templateId — persist it in their own URL/state/DB, however they track
   * "which template is open." The editor doesn't own that decision. */
  save: [payload: { templateId: string | null }];
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
} = provideEmailBuilder(storageAdapter, infoDialog);
provideSavedRowsPanel();
provideProductRows(storageAdapter);
provideLayoutDrag();
registerBuiltInBlocks();

// Exposed for programmatic access — defineExpose'd methods on a component
// wrapped by defineCustomElement (element.ts) become directly callable on
// the custom element instance itself (el.getHtml(), not el.$refs or
// anything Vue-internal), which is what init.ts's EditorHandle.getHtml()
// forwards to. Also directly usable if EmailEditor is mounted as a plain
// Vue component and the host has a template ref to it.
defineExpose({
  getHtml: (mode: "prune" | "wrap" = "prune") =>
    getExportedHTML(mode, savedTemplateName.value ?? undefined),
  getMjml: (mode: "prune" | "wrap" = "prune") =>
    getExportedMJML(mode, savedTemplateName.value ?? undefined),
  getReactEmail: (mode: "prune" | "wrap" = "prune") =>
    getExportedReactEmail(mode, savedTemplateName.value ?? undefined),
  getJson: () => getExportedJSON(savedTemplateName.value ?? undefined),
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
