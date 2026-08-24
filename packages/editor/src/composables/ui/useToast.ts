import { ref } from "vue";

/**
 * Toast notification store.
 *
 * Module-level store for the same reasons as useConfirm — no injection
 * key, no service registration, and no dependency on where in the
 * component tree the caller sits.
 */

export interface ToastMessage {
  id: number;
  severity?: "success" | "info" | "warn" | "error" | string;
  summary?: string;
  detail?: string;
  life?: number;
}

export const toasts = ref<ToastMessage[]>([]);

let nextId = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function removeToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

export function useToast() {
  return {
    add(message: Omit<ToastMessage, "id">) {
      const id = nextId++;
      toasts.value = [...toasts.value, { ...message, id }];
      timers.set(
        id,
        setTimeout(() => removeToast(id), message.life ?? 3000),
      );
    },
    removeAll() {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      toasts.value = [];
    },
  };
}
