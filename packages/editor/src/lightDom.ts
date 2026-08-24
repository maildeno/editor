import { createApp, h, reactive, ref, type App } from "vue";
import EmailEditorComponent from "./components/features/emailBuilder/EmailEditor.vue";
import { buildShadowStyles } from "./shadowStyles";

/**
 * Mounts the editor directly into the page, with no shadow root.
 *
 * This is the `shadowDom: false` path. Shadow DOM buys style isolation,
 * but it costs real behaviour: `event.target` is retargeted to the host,
 * `document.activeElement` returns the host rather than the focused
 * element, `document.querySelector` cannot see inside, and `@font-face`
 * and `@property` are ignored entirely. Every one of those has caused a
 * concrete bug in this package, and third-party libraries hit them too —
 * Reka UI's own internals use `document.activeElement` and never
 * `composedPath()`, so anything built on it can misbehave inside a shadow
 * root in ways that cannot be fixed from the outside.
 *
 * Light DOM trades isolation for predictability: the host page's CSS can
 * reach the editor (and vice versa), but every browser API behaves
 * normally. It is the right choice when the host page's styles are known
 * and controlled, and the escape hatch when something in the shadow path
 * misbehaves.
 */

export interface LightDomMount {
  /** The element the editor was mounted into. */
  element: HTMLElement;
  /** Reads EmailEditor.vue's defineExpose'd methods. */
  exposed: () => Record<string, any> | null;
  setProp: (key: string, value: unknown) => void;
  addSaveHandler: (fn: (payload: any) => void) => void;
  removeSaveHandler: (fn: (payload: any) => void) => void;
  destroy: () => void;
}

let stylesInjected = false;

/**
 * The shadow path hands these strings to defineCustomElement, which turns
 * them into <style> tags inside the shadow root. Here they go to
 * document.head instead — same content, different destination. Guarded so
 * multiple editors on one page inject once.
 */
function injectStylesIntoHead(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  for (const css of buildShadowStyles()) {
    if (!css) continue;
    const style = document.createElement("style");
    style.setAttribute("data-maildeno-light-dom", "");
    style.textContent = css;
    document.head.appendChild(style);
  }
}

export function mountLightDom(
  container: HTMLElement,
  initialProps: Record<string, unknown>,
): LightDomMount {
  injectStylesIntoHead();

  const props = reactive({ ...initialProps });
  const saveHandlers = new Set<(payload: any) => void>();
  const editorRef = ref<any>(null);

  const mountEl = document.createElement("div");
  mountEl.style.height = "100%";
  container.appendChild(mountEl);

  // A wrapper render function rather than mounting EmailEditor directly:
  // it keeps a ref to the child (so defineExpose'd methods stay reachable)
  // and fans `save` out to a mutable handler set, so on()/off() can add and
  // remove listeners after mount — which a plain prop could not do.
  const app: App = createApp({
    setup() {
      return () =>
        h(EmailEditorComponent as any, {
          ...props,
          ref: editorRef,
          onSave: (payload: any) => saveHandlers.forEach((fn) => fn(payload)),
        });
    },
  });

  app.mount(mountEl);

  return {
    element: mountEl,
    exposed: () => editorRef.value ?? null,
    setProp: (key, value) => {
      (props as Record<string, unknown>)[key] = value;
    },
    addSaveHandler: (fn) => saveHandlers.add(fn),
    removeSaveHandler: (fn) => saveHandlers.delete(fn),
    destroy: () => {
      app.unmount();
      mountEl.remove();
    },
  };
}
