import { provide, inject, type InjectionKey, type Ref } from "vue";

/**
 * Fixes a real, confirmed bug: every <Teleport to="body"> throughout this
 * package (7 separate files — color pickers, the merge-tag picker, loading
 * overlay, canvas action bar, preview client picker/screen) was hardcoded
 * to the literal string "body". Vue resolves a string `to` target via
 * document.querySelector() internally, which cannot see past a shadow
 * root boundary at all — so for the custom-element usage path, every one
 * of these was teleporting its content to the actual page body, entirely
 * outside the shadow root where all of this package's CSS lives. The teleported content still
 * rendered, just completely unstyled, and this doubles as the mechanism
 * behind a second, related bug: click-outside handlers elsewhere in this
 * package querying document.querySelector('[data-color-panel]') for that
 * same teleported content could never find it either, for the identical
 * reason.
 *
 * The fix has to be an actual DOM element reference, not a selector
 * string — a string target re-triggers the exact document.querySelector
 * problem this exists to solve. EmailEditor.vue provides this once, at
 * its own root, pointing at a dedicated element it renders for exactly
 * this purpose — every other file across the package just injects it and
 * hands it straight to :to, with zero per-file conditional logic for
 * which usage path (Vue component vs custom element) is active.
 *
 * A Ref, not a plain value: the target element is a template ref inside
 * EmailEditor.vue, so it doesn't exist yet at the moment provide() runs
 * during setup() — only after mount. Providing the Ref object itself
 * (not .value) means every injecting component's own :to="target" template
 * binding re-evaluates automatically once it populates, with no extra
 * wiring needed anywhere else.
 */

export type TeleportTarget = Ref<HTMLElement | null>;
const TeleportTargetKey: InjectionKey<TeleportTarget> = Symbol(
  "maildeno-editor:teleport-target",
);

/** Called once, at the EmailEditor root, with the ref it renders a container element into. */
export function provideTeleportTarget(target: TeleportTarget) {
  provide(TeleportTargetKey, target);
}

/**
 * Every other file calls this and hands the result straight to
 * <Teleport :to="...">. Falls back to "body" (Vue's own default) rather
 * than throwing — matches useInfoDialog/useStorageAdapter's reasoning. A
 * component used in isolation, outside EmailEditor.vue's tree entirely,
 * should still degrade to Vue's normal behavior rather than crash.
 */
export function useTeleportTarget(): TeleportTarget | "body" {
  const target = inject(TeleportTargetKey, undefined);
  if (target === undefined) {
    console.warn(
      "[maildeno-editor] useTeleportTarget() couldn't find a provided " +
        "target — falling back to \"body\". If this is running inside " +
        "the custom-element (Shadow DOM) path, teleported content will " +
        "render unstyled.",
    );
    return "body";
  }
  return target;
}

import { computed, type ComputedRef } from "vue";

/**
 * The same target, typed for the `to` prop of Reka UI's portal components
 * (and Vue's own Teleport), which accept `string | HTMLElement` but not
 * `null`. Normalises the not-yet-mounted case to undefined so the portal
 * falls back to its own default instead of erroring on a null target.
 */
export function usePortalTarget(): ComputedRef<string | HTMLElement | undefined> {
  const target = useTeleportTarget();
  return computed(() =>
    typeof target === "string" ? target : (target.value ?? undefined),
  );
}
