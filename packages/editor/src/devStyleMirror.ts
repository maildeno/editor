/**
 * Mirrors `document.head` <style> tags into a shadow root.
 *
 * Only needed when running the editor from source (the playground and its
 * element-demo page). In a built bundle, every component's scoped CSS is
 * substituted into shadowStyles.ts at build time, so the shadow root is
 * self-contained and this does nothing.
 *
 * From source there is no build step, so Vite injects each `.vue` file's
 * scoped styles into `document.head` as it serves them — and a shadow root
 * does not inherit page styles. The result is a shadow root with the base
 * stylesheet but none of the component CSS: unsized icons, dialogs without
 * chrome, panels without layout. It looks like the editor is broken when in
 * fact only this one delivery path is missing.
 *
 * Gated on whether the extracted CSS actually arrived rather than on
 * `import.meta.env.DEV`, so it switches itself off the moment the real
 * styles are present — including in a dev build that does run the plugin.
 */

/** Clones we own, keyed by the head node they mirror, so HMR can update them. */
type Mirror = { source: HTMLStyleElement; clone: HTMLStyleElement };

export function mirrorHeadStylesInto(shadowRoot: ShadowRoot): () => void {
  if (typeof document === "undefined") return () => {};

  const mirrors = new Map<HTMLStyleElement, Mirror>();
  // Watches each source for HMR edits, which replace textContent in place.
  const contentObservers = new Map<HTMLStyleElement, MutationObserver>();

  const add = (source: HTMLStyleElement) => {
    if (mirrors.has(source)) return;
    const clone = document.createElement("style");
    clone.setAttribute("data-maildeno-dev-mirror", "");
    clone.textContent = source.textContent;
    shadowRoot.appendChild(clone);
    mirrors.set(source, { source, clone });

    const obs = new MutationObserver(() => {
      clone.textContent = source.textContent;
    });
    obs.observe(source, { characterData: true, childList: true, subtree: true });
    contentObservers.set(source, obs);
  };

  const remove = (source: HTMLStyleElement) => {
    mirrors.get(source)?.clone.remove();
    mirrors.delete(source);
    contentObservers.get(source)?.disconnect();
    contentObservers.delete(source);
  };

  document.head.querySelectorAll("style").forEach(add);

  // Vite adds styles lazily, as each component is first requested — so new
  // <style> tags keep appearing after mount, not just at startup.
  const headObserver = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((n) => {
        if (n instanceof HTMLStyleElement) add(n);
      });
      record.removedNodes.forEach((n) => {
        if (n instanceof HTMLStyleElement) remove(n);
      });
    }
  });
  headObserver.observe(document.head, { childList: true });

  return () => {
    headObserver.disconnect();
    contentObservers.forEach((o) => o.disconnect());
    contentObservers.clear();
    mirrors.forEach(({ clone }) => clone.remove());
    mirrors.clear();
  };
}
