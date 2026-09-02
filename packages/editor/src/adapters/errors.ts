/**
 * adapters/errors.ts — the one thing the editor and a host adapter need to
 * agree on about failure.
 *
 * The editor has no user, role, plan or HTTP model, deliberately (see the
 * README's "Positioning" section, and the comment at the top of
 * SavedRowsPanel.vue). So it cannot say anything useful about a 403, a 402 or
 * an expired session — only the host knows what its own statuses mean and
 * what the user should do about them.
 *
 * That leaves a gap. A host adapter that catches its own 403 and shows a
 * precise message ("your role can't delete saved rows — ask an admin") gets a
 * second, vaguer toast from the editor's own catch block a moment later
 * ("Delete failed"). Two toasts for one click, the less useful one last.
 *
 * `handled` closes it without teaching the editor anything about permissions.
 * The host marks an error it has already surfaced; the editor only asks "did
 * someone already tell the user?" and stays quiet if so. It still gets the
 * rejection — which matters, because every optimistic update in this package
 * is applied on resolve, so a swallowed failure would leave the UI showing a
 * delete or rename that never happened.
 *
 * Hosts that don't use this lose nothing: unmarked errors take the editor's
 * generic message exactly as before.
 */

/**
 * Marks an error as already reported to the user, and returns it for
 * rethrowing:
 *
 * ```ts
 * catch (err) {
 *   toast.add({ severity: "warn", summary: "Not allowed", detail });
 *   throw markHandled(err);
 * }
 * ```
 *
 * Mutates in place when it can, so `err.status` / `err.data` and any other
 * fields the host reads downstream survive. Some rejections can't be mutated
 * — ofetch's FetchError is frozen, and a thrown string isn't an object at all
 * — so those get a fresh Error carrying the original as `cause` rather than
 * throwing a TypeError from inside a catch block, which would replace the
 * real failure with a confusing one.
 */
export function markHandled(err: unknown): unknown {
  if (typeof err === "object" && err !== null) {
    try {
      (err as Record<string, unknown>).handled = true;
      return err;
    } catch {
      // Frozen or sealed — fall through to the wrapper below.
    }
  }

  return Object.assign(
    new Error(String((err as { message?: unknown })?.message ?? err)),
    { handled: true, cause: err },
  );
}

/**
 * Whether the host already showed the user a message for this failure.
 *
 * Guard the editor's own toast with it, never the recovery logic — a handled
 * error is still an error, and state that was rolled back or a panel that was
 * left open must behave identically either way:
 *
 * ```ts
 * catch (err) {
 *   console.error("[maildeno-editor] failed to delete version:", err);
 *   if (!isHandled(err)) toast.add({ severity: "error", summary: "Delete failed" });
 * }
 * ```
 */
export function isHandled(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { handled?: unknown }).handled === true
  );
}
