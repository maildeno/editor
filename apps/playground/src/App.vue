<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { EmailEditor } from "@maildeno/editor";
import { theme } from "./theme";

const editor = ref<InstanceType<typeof EmailEditor> | null>(null);

/**
 * Theme switcher.
 *
 * This exists because its absence hid three real bugs. The playground had no
 * dark mode at all, so the `dark` half of theme/index.ts was never once
 * evaluated — and neither was the package's own dark palette, which turned out
 * not to apply anywhere.
 *
 * It is deliberately the dumbest possible switcher: it toggles a `dark` class
 * on <html> and does nothing else. No prop is passed to <EmailEditor>, no
 * watcher bridges the two. That is the integration contract being tested — a
 * host with any Tailwind-style switcher should get a themed editor for free,
 * because useColorScheme.ts inside the package mirrors that class onto the
 * editor root. If this file ever needs to tell the editor about the theme,
 * something in the package has regressed.
 *
 * Three states rather than two: "system" is a real preference, and a two-state
 * toggle pins the user the moment they touch it.
 */
type Pref = "light" | "dark" | "system";

const pref = ref<Pref>("system");
const systemIsDark = ref(false);

const resolved = computed<"light" | "dark">(() =>
  pref.value === "system"
    ? systemIsDark.value
      ? "dark"
      : "light"
    : pref.value,
);

watch(
  resolved,
  (mode) => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    // Native form controls, scrollbars and the canvas iframe's default
    // background follow this, not the class.
    document.documentElement.style.colorScheme = mode;
  },
  { immediate: true },
);

let mql: MediaQueryList | null = null;
const onSystemChange = (e: MediaQueryListEvent) => {
  systemIsDark.value = e.matches;
};

onMounted(() => {
  mql = window.matchMedia("(prefers-color-scheme: dark)");
  systemIsDark.value = mql.matches;
  mql.addEventListener("change", onSystemChange);
});

onUnmounted(() => mql?.removeEventListener("change", onSystemChange));

// The playground has no real ESP to send through — this just shows what the
// button looks like when a host provides the callback. The "Send test" button
// in the header only renders at all when onSendTestEmail is given (see
// EmailEditor's capability-gating docs), which is why it wasn't visible before
// this was wired up here.
async function handleSendTestEmail(payload: {
  to: string;
  subject: string;
  html: string;
}) {
  console.log("[playground] onSendTestEmail called:", payload);
  // A real host would call their own ESP/API here instead, e.g.:
  //   await fetch("/api/send-test-email", { method: "POST", body: JSON.stringify(payload) });
}

function handleSave({ templateId }: { templateId: string | null }) {
  const html = editor.value?.getHtml();
  console.log("templateId:", templateId);
  console.log(html);
}
</script>

<template>
  <main style="height: 100vh">
    <!-- Fixed rather than in a header bar: the editor owns the full viewport,
         and adding chrome around it would stop the playground demonstrating
         the layout a real host gets. -->
    <div class="pg-theme-switch" role="group" aria-label="Colour theme">
      <button
        v-for="opt in ['light', 'dark', 'system'] as Pref[]"
        :key="opt"
        type="button"
        :class="['pg-theme-switch__btn', { 'is-active': pref === opt }]"
        :aria-pressed="pref === opt"
        @click="pref = opt"
      >
        {{ opt }}
      </button>
    </div>

    <!-- No theme-related prop. The editor picks the class up off <html>
         itself; see the docblock above. -->
    <EmailEditor
      ref="editor"
      :on-send-test-email="handleSendTestEmail"
      :theme="theme"
      @save="handleSave"
    />
  </main>
</template>

<style>
/* Unscoped, and using its own `pg-` prefix rather than the editor's tokens:
   this control has to stay readable even if a theme change breaks every
   --md-* variable, which is the failure it exists to catch. */
.pg-theme-switch {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 2147483000;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #d4d4d8;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
  font-family: system-ui, sans-serif;
}

.dark .pg-theme-switch {
  background: #18181b;
  border-color: #3f3f46;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.5);
}

.pg-theme-switch__btn {
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #52525b;
  font-size: 12px;
  line-height: 1;
  text-transform: capitalize;
  cursor: pointer;
}

.dark .pg-theme-switch__btn {
  color: #a1a1aa;
}

.pg-theme-switch__btn:hover {
  background: #f4f4f5;
}

.dark .pg-theme-switch__btn:hover {
  background: #27272a;
}

.pg-theme-switch__btn.is-active {
  background: #18181b;
  color: #fafafa;
}

.dark .pg-theme-switch__btn.is-active {
  background: #fafafa;
  color: #18181b;
}
</style>
