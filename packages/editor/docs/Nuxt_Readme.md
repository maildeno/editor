# @maildeno/editor — Nuxt

A drag-and-drop email template editor for Nuxt 3 apps.

## Install

```bash
npm install @maildeno/editor
```

One package, no peer dependencies, no CSS import.

## The one Nuxt-specific rule

The editor is browser-only — it uses drag-and-drop, canvas measurement and
`localStorage`, none of which exist during SSR. Wrap it in `<ClientOnly>`:

```vue
<script setup lang="ts">
import { EmailEditor } from "@maildeno/editor";
</script>

<template>
  <ClientOnly>
    <EmailEditor style="height: 100vh" />
    <template #fallback>
      <div style="height: 100vh; display: grid; place-items: center">
        Loading editor…
      </div>
    </template>
  </ClientOnly>
</template>
```

Without `<ClientOnly>` you'll get hydration errors on first render.

## Full example

Nuxt server routes pair naturally with the adapter and the test-send handler,
so your ESP key and database credentials stay server-side.

```vue
<!-- pages/editor/[[id]].vue -->
<script setup lang="ts">
import { ref } from "vue";
import { EmailEditor } from "@maildeno/editor";
import { myAdapter } from "~/utils/editor-adapter";

const route = useRoute();
const editor = ref();

function handleSave({ templateId }: { templateId: string | null }) {
  if (templateId) navigateTo(`/editor/${templateId}`, { replace: true });
}

async function handleSendTestEmail(payload: {
  to: string; subject: string; html: string;
}) {
  await $fetch("/api/send-test", { method: "POST", body: payload });
}

async function publish() {
  const html = editor.value?.getHtml();
  if (!html) return;
  await $fetch("/api/campaigns", { method: "POST", body: { html } });
}
</script>

<template>
  <ClientOnly>
    <div style="display: flex; flex-direction: column; height: 100vh">
      <button @click="publish">Publish</button>
      <EmailEditor
        ref="editor"
        style="flex: 1; min-height: 0"
        :template-id="route.params.id as string | undefined"
        :storage-adapter="myAdapter"
        :theme="{ primaryColor: '#6366f1' }"
        :on-send-test-email="handleSendTestEmail"
        @save="handleSave"
      />
    </div>
  </ClientOnly>
</template>
```

```ts
// server/api/send-test.post.ts
import { Resend } from "resend";

export default defineEventHandler(async (event) => {
  const { to, subject, html } = await readBody(event);
  const resend = new Resend(useRuntimeConfig().resendApiKey);
  await resend.emails.send({ from: "you@yourdomain.com", to, subject, html });
  return { ok: true };
});
```

An adapter built on `$fetch` against your own server routes:

```ts
// utils/editor-adapter.ts
import type { EditorStorageAdapter } from "@maildeno/editor";

export const myAdapter: EditorStorageAdapter = {
  loadTemplate: (id) => (id ? $fetch(`/api/templates/${id}`).catch(() => null) : Promise.resolve(null)),
  saveTemplate: async (snapshot, id) => {
    const saved = await $fetch(`/api/templates/${id ?? ""}`, {
      method: id ? "PUT" : "POST", body: snapshot,
    });
    return { templateId: saved.id };
  },
  listTemplates: () => $fetch("/api/templates"),
  // …remaining methods — see the adapter section below
} as EditorStorageAdapter;
```

## Props and events

| Prop | Type |
| --- | --- |
| `templateId` | `string` |
| `storageAdapter` | `EditorStorageAdapter` |
| `theme` | `{ primaryColor?, surfaceColor? }` |
| `capabilities` | `{ export?: Array<"html"\|"mjml"\|"react"\|"json"> }` |
| `onSendTestEmail` | `(payload) => Promise<void>` |
| `brandName` | `string` |
| `versions` | `boolean` |
| `assistant` | `AssistantMount` |

| Event | Payload |
| --- | --- |
| `@save` | `{ templateId: string \| null }` |

Content getters go through a template ref: `editor.value.getHtml()`,
`getMjml()`, `getReactEmail()`, `getJson()`.

The write side goes through the same ref: `setJson(data, opts?)`,
`getSelection()`, `setSelection(id)`, `onChange(cb)`. `setJson` accepts what
`getJson()` returns, so `setJson(getJson())` round-trips, and defaults to a
single undoable step — the user can Ctrl+Z back to what they had.

## Reading the canvas

Content getters live on the component instance, so you need a template ref —
they are not events or slot props.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { EmailEditor } from "@maildeno/editor";

const editor = ref<InstanceType<typeof EmailEditor> | null>(null);

function exportAll() {
  editor.value?.getHtml();        // production-ready HTML email
  editor.value?.getHtml("wrap");  // "prune" (default) | "wrap"
  editor.value?.getMjml();
  editor.value?.getReactEmail();  // .tsx source
  editor.value?.getJson();        // portable template object
}
</script>

<template>
  <EmailEditor ref="editor" @save="onSave" />
</template>
```

All five return `null` when the canvas is empty. `getJson()` returns the
portable format — `template_id`, `template_name`, `canvas`, `rows`,
`schema_version` — and `setJson()` accepts exactly that, so
`setJson(getJson())` round-trips.

The write side is on the same ref: `setJson`, `getSelection`, `setSelection`,
`onChange`.

> **Saving is opt-in.** `@save` is what reveals the Save button — writing the
> listener is the opt-in, since Vue compiles `@save="fn"` to an `onSave` prop.
> Omit it and the button, the save-status indicator and the autosave timer are
> all absent, which is what you want for a guest editor.

```vue
<EmailEditor
  ref="editor"
  @save="({ templateId }) => console.log('saved', templateId, editor.value?.getHtml())"
/>
```

## Version history

```vue
<EmailEditor :versions="true" :storage-adapter="adapter" />
```

Replaces the saved-templates panel and its header button with version
history: restore, delete, delete-all, and "keep" to pin a version so
delete-all spares it.

Your adapter supplies the data through five optional methods —
`listTemplateVersions`, `getTemplateVersion`, `deleteTemplateVersion`,
`deleteAllTemplateVersions`, `setTemplateVersionKept`. Each control appears
only when its method exists, so an adapter that can list and restore but not
delete gets exactly that. The built-in localStorage adapter implements all
five, so this works with no backend at all.

Nothing in the adapter *creates* versions. When a save produces one is your
policy, and you already own `saveTemplate` — decide there.

## Header actions

Put your own controls beside Save — a plan-gated toggle, an ownership label,
a fork button:

```vue
<EmailEditor>
  <template #header-actions="{ templateId, isSaving, saveStatus }">
    <MyHeaderControls :template-id="templateId" :is-saving="isSaving" />
  </template>
</EmailEditor>
```

Renders nothing when unused — no wrapper, no gap. `saveStatus` is the
editor's own autosave state: `"idle" | "saving" | "saved" | "error"`.

The slot is for chrome that belongs *to the save*. To drive the canvas from a
host control, use the write API on the component ref.

## Assistant panel

The editor supplies a drawer, its trigger button, open/close state, escape
handling and focus return. You supply what goes inside. There's no AI in this
package: prompts, endpoints and diff strategy belong to your product, not to
an MIT dependency.

```vue
<EmailEditor>
  <template #assistant="{ editor }">
    <MyAssistant :editor="editor" />
  </template>
</EmailEditor>
```

The `editor` slot prop is a small canvas API — `getJson`, `setJson`,
`getSelection`, `setSelection`, `onChange` — so your panel can read the
canvas, apply a generated design, and react to changes without reaching into
editor internals. Applying through `setJson` keeps the result undoable.

The trigger only appears when you supply a slot (or the `assistant` prop, for
non-Vue hosts), so there is no dead button when you don't.

## Feature reference

Everything below is identical across frameworks. Only the mounting differs.

### The editor at a glance

- **Drag-and-drop block editor** — paragraph, heading, image, video, list, button, anchor, divider, spacer, menu, socials, plus custom blocks you register.
- **Four export formats** — HTML, MJML, React Email (`.tsx`), JSON.
- **ESP-aware conditional logic** — visibility rules compile to the right syntax for Klaviyo, Mailchimp, Braze, SFMC, HubSpot, Iterable, Handlebars and more.
- **Merge tags** with an in-editor picker.
- **Saved templates and saved rows** — reusable snippets and full documents.
- **Desktop/mobile styling** — per-block mobile overrides.
- **Undo/redo**, autosave draft recovery, and a preview with client-specific rendering checks.
- **Zero backend required** — defaults to `localStorage`; bring an adapter to use your own.

### Configuration

| Option | Type | Purpose |
| --- | --- | --- |
| `templateId` | `string` | Load an existing template on mount. Omit to start blank. |
| `storageAdapter` | `EditorStorageAdapter` | Where templates, rows and images persist. Omit for `localStorage`. |
| `theme` | `{ primaryColor?, surfaceColor? }` | Brand colour, expanded into a full 50–950 shade scale. |
| `capabilities` | `{ export?: Array<"html"\|"mjml"\|"react"\|"json"> }` | Restrict which export formats appear. Omit for all four. |
| `onSendTestEmail` | `(payload) => Promise<void>` | Enables the "Send test" button. Hidden entirely when omitted. |
| `brandName` | `string` | Name in the desktop-only notice's "Powered by" line. Omit for the default; pass `""` to hide the line. |
| `versions` | `boolean` | Replaces the saved-templates panel with version history. Needs the version adapter methods; the built-in localStorage adapter has them. |
| `assistant` | `{ mount, unmount? }` | Fills the assistant drawer from a non-Vue host. Vue hosts can use the `#assistant` slot instead. |

### Getting content out

Four getters, available on the handle (`init()`) or a template ref (Vue component):

```ts
getHtml(mode?)        // production-ready HTML email
getMjml(mode?)        // MJML source
getReactEmail(mode?)  // React Email .tsx source
getJson()             // the template as a plain object
```

`mode` is `"prune"` (default) or `"wrap"`, and only matters if you use ESP conditional visibility:

- **`"prune"`** evaluates conditions against the current preview context and outputs only the branches that match. Use it for a concrete send.
- **`"wrap"`** keeps every branch, wrapped in your ESP's conditional syntax. Use it when handing the HTML to an ESP that will do the evaluation itself.

They all return `null` when the canvas is empty, so check before using:

```ts
const html = handle.getHtml();
if (!html) return; // nothing built yet
```

`getJson()` returns the portable template format — `template_id`, `template_name`, `canvas`, `rows`, `schema_version`. Store it and pass it back via your adapter's `loadTemplate` to restore exactly.

### Storage adapter

The editor never talks to your backend directly. Implement this and it uses your storage for everything:

```ts
import type { EditorStorageAdapter } from "@maildeno/editor";

const adapter: EditorStorageAdapter = {
  // ── Templates ──────────────────────────────────────────────
  async loadTemplate(templateId) {
    if (!templateId) return null;               // null = start blank
    const res = await fetch(`/api/templates/${templateId}`);
    if (!res.ok) return null;
    const t = await res.json();
    return { rows: t.rows, canvasStyles: t.canvasStyles, name: t.name };
  },
  async saveTemplate(snapshot, templateId) {
    const res = await fetch(`/api/templates/${templateId ?? ""}`, {
      method: templateId ? "PUT" : "POST",
      body: JSON.stringify(snapshot),
    });
    return { templateId: (await res.json()).id }; // editor stamps this for later saves
  },

  // ── Optional: powers the "Saved templates" panel ───────────
  // Return summaries, not full documents — listing shouldn't fetch every
  // template's rows. Omit both and the panel says listing isn't supported.
  async listTemplates() {
    return fetch("/api/templates").then((r) => r.json());
    // -> [{ templateId, name, updatedAt }]
  },
  async deleteTemplate(id) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
  },

  // ── Saved rows (reusable snippets) ─────────────────────────
  // Optional second, read-only row library — an org's shared blocks.
  // Shown in a "Shared" tab beside the user's own rows, and only when
  // this returns something, so omitting it changes nothing. There is no
  // save/rename/delete counterpart: curating a shared library is an admin
  // concern the editor has no user model to express.
  async listSystemSavedRows() {
    return api.get("/org/saved-rows");
  },

  async listSavedRows() {
    return fetch("/api/saved-rows").then((r) => r.json());
  },
  async saveSavedRow(row, name) {
    return fetch("/api/saved-rows", {
      method: "POST", body: JSON.stringify({ row, name }),
    }).then((r) => r.json());
  },
  async deleteSavedRow(id) {
    await fetch(`/api/saved-rows/${id}`, { method: "DELETE" });
  },
  async renameSavedRow(id, name) {
    await fetch(`/api/saved-rows/${id}`, {
      method: "PATCH", body: JSON.stringify({ name }),
    });
  },
  // Synchronous — it runs during a drag, so it can't await. Read from
  // whatever you already have client-side (e.g. your last listSavedRows result).
  cloneSavedRowForCanvas(id) {
    return structuredClone(rowCache.get(id) ?? null);
  },

  // ── Images ─────────────────────────────────────────────────
  // Called when a user drops or picks an image. Return a public URL.
  async uploadImage(file) {
    const form = new FormData();
    form.append("file", file);
    const { url } = await fetch("/api/upload", { method: "POST", body: form })
      .then((r) => r.json());
    return url;
  },
};
```

Without an adapter, everything persists to `localStorage` — fine for demos, but images are stored as base64 data URIs, which will hit the ~5 MB quota quickly on image-heavy templates.

### Partial adapters

Every method is optional. Anything you leave out falls back to the built-in
localStorage adapter, so you can override only the parts you need:

```ts
// Upload images to your own storage; keep everything else local.
init({
  storageAdapter: {
    async uploadImage(file) {
      const form = new FormData();
      form.append("file", file);
      const { url } = await fetch("/api/upload", { method: "POST", body: form })
        .then((r) => r.json());
      return url;
    },
  },
});
```

The fallback is per-method, not per-area. If you implement `saveTemplate`
against your own backend but leave `listTemplates` out, the saved-templates
panel will list localStorage templates rather than yours — the editor warns
about that specific mismatch in development. Implement `listTemplates` and
`deleteTemplate` alongside `loadTemplate`/`saveTemplate` to keep them
consistent.

### Sending email

The editor hands you `{ to, subject, html }` and stops there. Your ESP key must never reach the browser, so the send happens on your server:

```ts
// client
onSendTestEmail: async ({ to, subject, html }) => {
  await fetch("/api/send-test", {
    method: "POST",
    body: JSON.stringify({ to, subject, html }),
  });
}
```

```ts
// server — Resend shown; Postmark/SendGrid are the same shape
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  const { to, subject, html } = await req.json();
  await resend.emails.send({ from: "you@yourdomain.com", to, subject, html });
}
```

This is the **test-send** button only — one recipient, manual click. For a real campaign, pull the HTML yourself (`getHtml()`) and drive your own send to a list.

### Theming

One hex re-themes the whole editor coherently:

```ts
setTheme({ primary: "#6366f1" });
```

Every surface reads from semantic tokens, so you can override just the parts
you care about without redefining the rest:

```ts
setTheme({
  // Core — everything else derives from these
  primary: "#e11d48",
  background: "#f8fafc",
  surface: "#ffffff",
  text: "#111827",
  border: "#e5e7eb",

  // Individual surfaces
  headerBg: "#111827",
  headerText: "#f9fafb",
  sidebarBg: "#ffffff",
  canvasBg: "#f1f5f9",
  inputBg: "#ffffff",
  inputText: "#111827",
  overlayBg: "#ffffff",     // dialogs, toasts, dropdowns, date picker
  toolbarBg: "#ffffff",     // floating + rich-text toolbars

  // The Save / Update button
  buttonPrimaryBg: "#e11d48",
  buttonPrimaryText: "#ffffff",
  buttonPrimaryHoverBg: "#be123c",

  // Dark mode — has its own complete defaults, so override only what differs
  dark: {
    primary: "#fb7185",
    headerBg: "#0b0f19",
    buttonPrimaryText: "#1e1b4b",
  },
});
```

Dark mode activates when the editor element carries the `dark` class:

```ts
handle.element.classList.toggle("dark");
```

**Anything you leave out keeps its default**, so a partial theme is always
coherent rather than half-applied. Two things worth knowing:

- Set `onPrimary` (or `buttonPrimaryText`) when using a light brand colour, or
  the primary button's label will be low-contrast against it.
- Severity tints for toasts and messages (`successBg`, `dangerFg`, …) have
  separate dark defaults, so they don't leave pale panels sitting on a dark
  surface.

Multiple editors on one page theme independently.


### Extension points

All three are additive — no need to fork or edit built-ins.

```ts
import { registerBlock, registerESPSyntax, registerMergeTags } from "@maildeno/editor";

// A custom block type
registerBlock({
  name: "product-card",
  label: "Product Card",
  icon: "<svg …>",
  schema: { /* default props */ },
  renderCanvas: ProductCardCanvas,     // component shown in the editor
  renderSettings: ProductCardPanel,    // component for the right panel
  renderEmail: {
    html: (props, ctx) => `<table>…</table>`,
    mjml: (props, ctx) => `<mj-section>…</mj-section>`,
    reactEmail: (props, ctx) => `<Section>…</Section>`,
  },
});

// Conditional syntax for an ESP that isn't built in
registerESPSyntax("my-esp", {
  wrapOpenTag: (expr) => `{% if ${expr} %}`,
  wrapCloseTag: () => `{% endif %}`,
  wrapMergeTag: (key, fallback) =>
    fallback ? `{{ ${key} | default: "${fallback}" }}` : `{{ ${key} }}`,
});

// Extra merge tags in the picker
registerMergeTags([
  { key: "customer.first_name" },
  { key: "order.total" },
]);
```

Call these **before** the editor mounts.

### Persisting which template is open

The editor doesn't own that decision. Listen for `save` and store the id however you track it:

```ts
handle.on("save", ({ templateId }) => {
  router.replace(`/editor/${templateId}`);   // or your DB, or app state
});
```

Pass it back as `templateId` next time to reopen.

### Practical notes

- **The container needs a minimum height, not a maximum.** The editor scrolls the *document*: its shell is `min-height: 100vh` with a `sticky` header, so the canvas grows past the viewport and the page scrolls under a pinned toolbar. `min-height: 100vh` on the container is right. A fixed `height` with `overflow: hidden` clips everything below the fold and leaves no scroll container to reach it.
- **`transform`, `filter`, `perspective` or `will-change` on any ancestor** breaks `position: fixed` inside it — floating toolbars and pickers will land in the wrong place. Avoid them above the mount point.
- **Desktop only.** The editor shows a notice on small screens rather than attempting a mobile drag-and-drop UI.
- **Autosave** keeps a local draft, so a refresh mid-edit recovers. "New template" clears it deliberately.
