import { defineCustomElement } from "vue";
import EmailEditorComponent from "./components/features/emailBuilder/EmailEditor.vue";
import { buildShadowStyles } from "./shadowStyles";
import { injectDocumentScopedRules } from "./documentScopedStyles";

/**
 * `<maildeno-editor>` — a real, native custom element. Usable from React,
 * Angular, plain HTML, anywhere — Shadow DOM isolation doesn't depend on
 * Vue being present on the host page at all once this file is loaded.
 *
 * Props/emits on EmailEditor.vue (templateId, storageAdapter, save, etc)
 * carry through automatically — defineCustomElement reflects props as
 * both attributes (for primitives) and DOM properties (for objects like
 * storageAdapter, which can't round-trip through an HTML attribute string
 * and must be set via the element's JS property instead, e.g.
 * `el.storageAdapter = myAdapter` rather than an attribute).
 *
 * No configureApp hook is needed: nothing in the UI depends on a
 * plugin-registered service. Toasts and confirmations are plain
 * module-level stores, reachable without provide/inject, so the internal
 * app instance defineCustomElement creates needs no setup.
 */
const shadowStyles = buildShadowStyles();

// @font-face / @property / @import are document-scoped at-rules — browsers
// silently ignore them inside a shadow root, which is why Tailwind's
// border/shadow/transform utilities stopped applying. See
// documentScopedStyles.ts for the full explanation. Everything still goes
// into the shadow root below as well; this only additionally places the
// handful of rules that can't work there into document.head.
injectDocumentScopedRules(shadowStyles);

export const MaildenoEditorElement = defineCustomElement(EmailEditorComponent, {
  styles: shadowStyles,
  shadowRoot: true,
});

/**
 * Defines the custom element, exactly once. init() calls this; consumers
 * using the element tag directly can call it themselves.
 */
export function registerMaildenoEditorElement(tag = "maildeno-editor"): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tag)) return;
  customElements.define(tag, MaildenoEditorElement);
}
