<script setup lang="ts">
import { ref } from "vue";
import { EmailEditor } from "@maildeno/editor";
import { theme } from "./theme";

const editor = ref<InstanceType<typeof EmailEditor> | null>(null);

// The playground has no real ESP to send through — this just shows what
// the button looks like when a host provides the callback. The "Send
// test" button in the header only renders at all when onSendTestEmail is
// given (see EmailEditor's capability-gating docs), which is why it
// wasn't visible before this was wired up here.
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
  console.log("templateId:", templateId)
  console.log(html)
}
</script>

<template>
  <main style="height: 100vh">
    <EmailEditor ref="editor" :on-send-test-email="handleSendTestEmail" :theme="theme" @save="handleSave" />
  </main>
</template>