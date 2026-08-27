<!--
 SendEmail.vue — modal for sending the current template HTML.

 ported from the original (see project notes) with useEmail()'s
 Maildeno-specific quota tracking and $api call replaced by a host-provided
 onSend callback — same pattern as the storage adapter: the editor owns
 the form/validation/UX, the host owns what actually happens on send.
 Quota display removed entirely (a Maildeno business-model concern, not
 something a generic editor should hardcode); ProgressBar/quota-Message
 UI from the original dropped along with it.

 Props:
 visible v-model — controls Dialog visibility.
 getHtml Async function that returns ready-to-send HTML.
 onSend Host-provided callback — actually sends the email.
 Editor doesn't know or care how (SMTP, an API, anything).
 defaultSubject Optional pre-fill for subject (e.g. template name).

 Emits:
 update:visible
 sent — fires after a successful send (parent can close, show a toast).
-->
<script setup lang="ts">
import InputText from "@/components/ui/primitives/InputText.vue";
import Button from "@/components/ui/primitives/Button.vue";
import Message from "@/components/ui/primitives/Message.vue";
import Dialog from "@/components/ui/primitives/Dialog.vue";
import { ref, computed, watch } from "vue";

interface Props {
 visible: boolean;
 getHtml: () => string | Promise<string>;
 onSend: (payload: {
 to: string;
 subject: string;
 html: string;
 }) => Promise<void> | void;
 defaultSubject?: string;
}

const props = withDefaults(defineProps<Props>(), {
 defaultSubject: "",
});

const emit = defineEmits<{
 (e: "update:visible", value: boolean): void;
 (e: "sent"): void;
}>();

// ── Form state ──────────────────────────────────────────────────────────────
const toEmail = ref("");
const subject = ref(props.defaultSubject);
const submitted = ref(false); // for inline validation feedback
const isSending = ref(false);
const sendError = ref<string | null>(null);

// Simple email regex — a host's own onSend can validate more strictly if
// they need to; this just stops obvious typos before calling out.
const emailValid = computed(
 () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.value.trim()),
);
const subjectValid = computed(() => subject.value.trim().length > 0);
const formValid = computed(() => emailValid.value && subjectValid.value);

// ── Reset form whenever the dialog opens ────────────────────────────────────
watch(
 () => props.visible,
 (open) => {
 if (open) {
 toEmail.value = "";
 subject.value = props.defaultSubject;
 submitted.value = false;
 sendError.value = null;
 }
 },
);

// ── Handlers ────────────────────────────────────────────────────────────────
function close() {
 emit("update:visible", false);
}

async function handleSubmit() {
 submitted.value = true;
 sendError.value = null;
 if (!formValid.value) return;

 let html: string;
 try {
 html = await props.getHtml();
 } catch (err) {
 sendError.value =
 err instanceof Error
 ? err.message
 : "Template is empty — add at least one row before sending.";
 return;
 }
 if (!html) return;

 isSending.value = true;
 try {
 await props.onSend({
 to: toEmail.value.trim(),
 subject: subject.value.trim(),
 html,
 });
 emit("sent");
 close();
 } catch (err) {
 // Host's onSend threw — surface it and leave the modal open so the
 // user can retry, same recovery behaviour as the original.
 sendError.value =
 err instanceof Error ? err.message : "Failed to send. Please try again.";
 } finally {
 isSending.value = false;
 }
}
</script>

<template>
 <Dialog
 :visible="visible"
 @update:visible="$emit('update:visible', $event)"
 modal
 header="Send test email"
 :style="{ width: '480px' }"
 :closable="!isSending"
 >
 <form @submit.prevent="handleSubmit" class="space-y-3">
 <div>
 <label for="to-email" class="block text-sm font-medium mb-1">
 Recipient email
 </label>
 <InputText
 id="to-email"
 v-model="toEmail"
 type="email"
 class="w-full"
 placeholder="recipient@example.com"
 :disabled="isSending"
 :invalid="submitted && !emailValid"
 autofocus
 />
 <small v-if="submitted && !emailValid" class="text-[var(--md-danger)] text-xs">
 Enter a valid email address.
 </small>
 </div>

 <div>
 <label for="subject" class="block text-sm font-medium mb-1">
 Subject
 </label>
 <InputText
 id="subject"
 v-model="subject"
 class="w-full"
 placeholder="Your subject line"
 :disabled="isSending"
 :invalid="submitted && !subjectValid"
 />
 <small v-if="submitted && !subjectValid" class="text-[var(--md-danger)] text-xs">
 Subject is required.
 </small>
 </div>

 <Message v-if="sendError" severity="error" :closable="false" class="text-sm">
 {{ sendError }}
 </Message>
 </form>

 <template #footer>
 <Button
 label="Cancel"
 severity="secondary"
 text
 @click="close"
 :disabled="isSending"
 />
 <Button
 label="Send"
 :loading="isSending"
 :disabled="isSending"
 @click="handleSubmit"
 />
 </template>
 </Dialog>
</template>
