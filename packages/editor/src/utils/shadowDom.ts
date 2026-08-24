/**
 * Shadow-DOM-safe replacements for the two DOM lookups that silently do
 * the wrong thing inside a shadow root.
 *
 * Both are easy to get wrong because they fail *quietly* and only in the
 * custom-element build — the plain Vue path keeps working, so the bug
 * looks framework-specific when it is really about the shadow boundary.
 */

/**
 * `document.activeElement` returns the shadow **host** for anything
 * focused inside a shadow root, never the element that actually has
 * focus. This walks down through nested shadow roots to the real one.
 *
 * Without it, any `container.contains(document.activeElement)` check
 * reads as false for every element inside the editor — which is what made
 * the rich-text toolbar tear itself down the moment you clicked its font
 * Select, merge-tag picker, or colour picker.
 */
export function deepActiveElement(): Element | null {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

/**
 * `document.querySelector` cannot see into a shadow root. Querying from
 * an element's own root node instead returns the ShadowRoot when mounted
 * inside one and the Document otherwise, so the same call is correct for
 * both usage paths with no branching.
 */
export function queryFromRoot<E extends Element = Element>(
  from: Element | null | undefined,
  selector: string,
): E | null {
  if (!from) return null;
  const root = from.getRootNode() as Document | ShadowRoot;
  return root.querySelector<E>(selector);
}

/**
 * `document.querySelectorAll` equivalent of {@link queryFromRoot}.
 */
export function queryAllFromRoot<E extends Element = Element>(
  from: Element | null | undefined,
  selector: string,
): E[] {
  const root = (from?.getRootNode() ?? document) as Document | ShadowRoot;
  return Array.from(root.querySelectorAll<E>(selector));
}
