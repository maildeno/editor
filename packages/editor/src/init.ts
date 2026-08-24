import { registerMaildenoEditorElement } from "./element";
import { mountLightDom } from "./lightDom";
import type { PartialStorageAdapter } from "./adapters/types";
import type { ThemeOptions } from "./theme";

/**
 * The ergonomic, no-Vue-knowledge entry point. element.ts already provides
 * everything this composes — a real custom element, complete CSS bundling,
 * live theming via CSS variables — init() just wires it up with a plain
 * options object and hands back a small handle instead of requiring the
 * caller to know defineCustomElement, prop reflection, or DOM CustomEvent
 * details themselves.
 */

export interface InitOptions {
  /** A DOM element, or a CSS selector resolved via document.querySelector. */
  container: HTMLElement | string;
  templateId?: string;
  storageAdapter?: PartialStorageAdapter;
  theme?: ThemeOptions;
  capabilities?: {
    export?: Array<"html" | "mjml" | "react" | "json">;
  };
  onSendTestEmail?: (payload: {
    to: string;
    subject: string;
    html: string;
  }) => Promise<void> | void;
  /**
   * Render inside a shadow root (default) or directly in the page.
   *
   * Shadow DOM isolates the editor's styles from the host page, which is
   * usually what you want. Set false when you'd rather have predictable
   * DOM behaviour than isolation: inside a shadow root `event.target` is
   * retargeted to the host, `document.activeElement` returns the host,
   * `document.querySelector` can't see in, and `@font-face`/`@property`
   * are ignored. This package handles all of that internally, but a host
   * page's own scripts — or a third-party library — may not, and that is
   * not fixable from inside the editor. Light DOM is the escape hatch.
   *
   * The trade-off is real in both directions: with `shadowDom: false`,
   * the host page's CSS can reach the editor and vice versa.
   */
  shadowDom?: boolean;
}

export interface EditorHandle {
  /** The underlying <maildeno-editor> element, for anything this handle
   * doesn't wrap directly — it's a real DOM element, nothing hidden. */
  readonly element: HTMLElement;
  /** Vue's defineCustomElement dispatches emits as real DOM CustomEvents
   * on the host element, with the emit payload in event.detail — this is
   * just addEventListener with that unwrapping done for you. */
  on(event: "save", handler: (payload: { templateId: string | null }) => void): void;
  off(event: "save", handler: (payload: { templateId: string | null }) => void): void;
  /** Re-themes live — sets the theme prop, which EmailEditor.vue's own
   * watch(..., {immediate: true}) picks up via useHost(), the same
   * mechanism that applies it on initial mount. Calling this again after
   * mount is the actual "live" part, not just initial configuration. */
  setTheme(theme: ThemeOptions): void;
  /** These four call EmailEditor.vue's defineExpose'd methods, which Vue's
   * own defineCustomElement implementation forwards directly onto the
   * custom element instance (confirmed: _instance.exposed is read and
   * redefined as properties on the element itself, not something Vue-
   * internal or requiring a $refs-style lookup). "prune" (default)
   * evaluates against the current preview context; "wrap" always
   * includes every ESP-conditional branch, matching the same two modes
   * the Export dropdown itself offers. */
  getHtml(mode?: "prune" | "wrap"): string | null;
  getMjml(mode?: "prune" | "wrap"): string | null;
  getReactEmail(mode?: "prune" | "wrap"): string | null;
  getJson(): Record<string, unknown> | null;
  /** Removes the element from the DOM. Vue's custom element wrapper
   * handles unmounting the internal app and cleaning up watchers/effects
   * as part of its own disconnectedCallback — not reimplemented here. */
  destroy(): void;
}

// Event names are emitted from Vue as e.g. "save" but land on the DOM as
// lowercased/kebab CustomEvents — defineCustomElement's actual behavior,
// confirmed against Vue's own emit-to-DOM-event mapping. "save" has no
// camelCase to kebab-case either way, so this is a no-op today, but is the
// correct place to add mapping if a multi-word event name is ever added.
function toDomEventName(event: string): string {
  return event;
}

export async function init(options: InitOptions): Promise<EditorHandle> {
  const container =
    typeof options.container === "string"
      ? document.querySelector<HTMLElement>(options.container)
      : options.container;

  if (!container) {
    throw new Error(
      `[maildeno-editor] init() couldn't find a container${
        typeof options.container === "string" ? ` matching "${options.container}"` : ""
      }.`,
    );
  }

  // ── Light-DOM path ──────────────────────────────────────────────────
  // Same handle API as the shadow path below, so nothing downstream needs
  // to know which mode is active.
  if (options.shadowDom === false) {
    const mount = mountLightDom(container, {
      templateId: options.templateId,
      storageAdapter: options.storageAdapter,
      theme: options.theme,
      capabilities: options.capabilities,
      onSendTestEmail: options.onSendTestEmail,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const call = <T>(name: string, ...args: unknown[]): T | null => {
      const fn = mount.exposed()?.[name];
      return typeof fn === "function" ? (fn(...args) as T) : null;
    };

    return {
      element: mount.element,
      on: (_event, handler) => mount.addSaveHandler(handler),
      off: (_event, handler) => mount.removeSaveHandler(handler),
      setTheme: (theme) => mount.setProp("theme", theme),
      getHtml: (mode = "prune") => call<string>("getHtml", mode),
      getMjml: (mode = "prune") => call<string>("getMjml", mode),
      getReactEmail: (mode = "prune") => call<string>("getReactEmail", mode),
      getJson: () => call<Record<string, unknown>>("getJson"),
      destroy: () => mount.destroy(),
    };
  }

  registerMaildenoEditorElement();

  const el = document.createElement("maildeno-editor") as HTMLElement & {
    templateId?: string;
    storageAdapter?: PartialStorageAdapter;
    theme?: ThemeOptions;
    capabilities?: InitOptions["capabilities"];
    onSendTestEmail?: InitOptions["onSendTestEmail"];
    getHtml?: (mode?: "prune" | "wrap") => string | null;
    getMjml?: (mode?: "prune" | "wrap") => string | null;
    getReactEmail?: (mode?: "prune" | "wrap") => string | null;
    getJson?: () => Record<string, unknown> | null;
  };

  // Complex values (objects, functions) go through DOM properties, not
  // attributes — attributes can only carry strings. This is standard
  // custom-element practice, not a defineCustomElement-specific quirk.
  if (options.templateId !== undefined) el.templateId = options.templateId;
  if (options.storageAdapter) el.storageAdapter = options.storageAdapter;
  if (options.theme) el.theme = options.theme;
  if (options.capabilities) el.capabilities = options.capabilities;
  if (options.onSendTestEmail) el.onSendTestEmail = options.onSendTestEmail;

  container.appendChild(el);

  // defineExpose'd methods (getHtml etc) populate once Vue's internal
  // component instance actually mounts — not guaranteed synchronous with
  // appendChild. init() is already async, so waiting a tick here means
  // the returned handle is reliably functional immediately, rather than
  // leaving every caller to independently discover and work around this
  // timing gap themselves.
  await new Promise((resolve) => setTimeout(resolve, 0));

  // removeEventListener needs the EXACT function reference passed to
  // addEventListener. on() wraps each handler in a fresh closure (to
  // unwrap e.detail) — without tracking that mapping, off() would try to
  // remove the original unwrapped handler, which was never what got
  // attached, and would silently do nothing. Real bug, caught by
  // rereading this before claiming it worked, not by running it.
  const listenerWrappers = new WeakMap<Function, EventListener>();

  const handle: EditorHandle = {
    element: el,
    on(event, handler) {
      // e.detail is the emit ARGUMENTS ARRAY, not the payload. Vue's
      // defineCustomElement dispatches emits as
      //   new CustomEvent(event, isPlainObject(args[0])
      //     ? extend({ detail: args }, args[0])
      //     : { detail: args })
      // so `emit("save", { templateId })` arrives as detail === [{ templateId }].
      // Passing it straight through handed callers an array, and destructuring
      // `{ templateId }` from an array yields undefined — which is exactly what
      // the documented `handle.on("save", ({ templateId }) => …)` usage does.
      // Only the custom-element path was affected; the Vue component emits the
      // payload directly and was always correct.
      const wrapped = ((e: CustomEvent) =>
        handler(Array.isArray(e.detail) ? e.detail[0] : e.detail)) as EventListener;
      listenerWrappers.set(handler, wrapped);
      el.addEventListener(toDomEventName(event), wrapped);
    },
    off(event, handler) {
      const wrapped = listenerWrappers.get(handler);
      if (wrapped) {
        el.removeEventListener(toDomEventName(event), wrapped);
        listenerWrappers.delete(handler);
      }
    },
    setTheme(theme) {
      el.theme = theme;
    },
    getHtml(mode = "prune") {
      return el.getHtml ? el.getHtml(mode) : null;
    },
    getMjml(mode = "prune") {
      return el.getMjml ? el.getMjml(mode) : null;
    },
    getReactEmail(mode = "prune") {
      return el.getReactEmail ? el.getReactEmail(mode) : null;
    },
    getJson() {
      return el.getJson ? el.getJson() : null;
    },
    destroy() {
      el.remove();
    },
  };

  return handle;
}

// ─── Re-exported registries ──────────────────────────────────────────────────
// These are re-exported here, not just from the package root, because the two
// entry points are separately bundled: importing registerBlock from
// "@maildeno/editor" while mounting through "@maildeno/editor/init" would
// write to a different copy of the registry module, and the block would
// silently never appear.
//
// Re-exporting from this entry keeps everything in one bundle, so
// "@maildeno/editor/init" is genuinely self-sufficient — which is what the
// React, Astro and vanilla guides promise.
export {
  registerBlock,
  getBlock,
  getAllBlocks,
} from "./blocks/registry";

export {
  registerESPSyntax,
  getRegisteredCustomESPs,
} from "./esp/registry";

export {
  registerMergeTags,
  getRegisteredMergeTagIds,
} from "./merge-tags/registry";

export { setEditorTheme, palette } from "./theme";
export { createLocalStorageAdapter } from "./adapters/localStorageAdapter";

export type { BlockDefinition } from "./blocks/types";
export type { ThemeOptions, ThemeTokens } from "./theme";
export type {
  EditorStorageAdapter,
  PartialStorageAdapter,
  TemplateSnapshot,
  TemplateSummary,
  SavedRow,
} from "./adapters/types";
