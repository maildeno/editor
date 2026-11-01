# @maildeno/editor — Vue

A drag-and-drop email template editor for Vue 3 apps.

## Install

```bash
npm install @maildeno/editor
```

One package, no peer dependencies, no CSS import. The editor injects its own
styling when it mounts.

## Minimal usage

```vue
<script setup lang="ts">
import { EmailEditor } from "@maildeno/editor";
</script>

<template>
  <EmailEditor style="height: 100vh" />
</template>
```

## Full example

```vue
<script setup lang="ts">
import { ref } from "vue";
import { EmailEditor } from "@maildeno/editor";
import { myAdapter } from "./adapter";

const editor = ref<InstanceType<typeof EmailEditor> | null>(null);

function handleSave({ templateId }: { templateId: string | null }) {
  // Persist which template is open, however you track it
  router.replace(`/editor/${templateId}`);
}

async function handleSendTestEmail(payload: {
  to: string; subject: string; html: string;
}) {
  await fetch("/api/send-test", { method: "POST", body: JSON.stringify(payload) });
}

async function publish() {
  const html = editor.value?.getHtml();
  if (!html) return; // empty canvas
  await fetch("/api/campaigns", { method: "POST", body: JSON.stringify({ html }) });
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100vh">
    <button @click="publish">Publish</button>

    <EmailEditor
      ref="editor"
      style="flex: 1; min-height: 0"
      template-id="welcome_email"
      :storage-adapter="myAdapter"
      :theme="{ primaryColor: '#6366f1' }"
      :capabilities="{ export: ['html', 'json'] }"
      :on-send-test-email="handleSendTestEmail"
      @save="handleSave"
    />
  </div>
</template>
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

Reading content out uses a template ref:

```ts
const editor = ref();
editor.value.getHtml("prune");
editor.value.getMjml();
editor.value.getReactEmail();
editor.value.getJson();
```

Theming is reactive through the `theme` prop — change it and the editor
re-themes live; no imperative call needed.

## Styling and isolation

`<EmailEditor />` renders into your page like any other component. There is no
shadow root. Its CSS goes into `<head>` on mount and is scoped to the editor's
root element, so it can't restyle your app.

The reverse isn't true: your page's CSS can reach the editor. The editor's CSS
is built with Tailwind v4, so it lives in the cascade layers `theme`, `base`,
`components` and `utilities`, and a rule that isn't in any layer beats a layered
one whatever its specificity. A global `button { … }` or `h1 { … }` in your app
can therefore override the editor's own styling of those elements.

|                                    | `<EmailEditor />` | `init()`                                                                    |
| ---------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| Shadow root                        | No                | Yes (default)                                                               |
| Editor styles leak into your page  | No                | No                                                                          |
| Your page's CSS reaches the editor | Yes               | Selectors no; inherited properties such as `color` and `font-size` still do |
| Vue runtime                        | Yours             | A second, bundled copy                                                      |

If your global styles collide with the editor, you have two options:

- **Put your global rules in a layer that ranks below the editor's.** Declare the
  layer order before anything else in your CSS. Order is set by first
  appearance, so if Tailwind or another stylesheet declares these layers first,
  this does nothing:

  ```css
  @layer host, theme, base, components, utilities;

  @layer host {
    /* your global element rules: button, h1, input, … */
  }
  ```

  Third-party CSS can join the layer too, with
  `@import url("vendor.css") layer(host);` right after that statement. Scoping
  your selectors to a wrapper only helps if the wrapper doesn't contain the
  editor.
- **Use [`init()`](#alternative-init)**, which isolates the editor in a shadow
  root at the cost of a second Vue runtime.

## Alternative: `init()`

The same API the React and vanilla guides use also works in Vue:

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { init, type EditorHandle } from "@maildeno/editor/init";

const container = ref<HTMLDivElement | null>(null);
let handle: EditorHandle | null = null;

onMounted(async () => {
  handle = await init({ container: container.value! });
});
onBeforeUnmount(() => handle?.destroy());
</script>

<template>
  <div ref="container" style="height: 100vh" />
</template>
```

**Prefer the component unless you specifically need style isolation.** `init()`
bundles its own Vue so it can run on framework-free pages — calling it from a
Vue app ships two Vue runtimes (~60 kB gzipped plus a second reactivity graph).
The component uses the Vue you already have, and gives you reactive props,
template refs, normal event binding and devtools visibility.

The one case where `init()` wins: it renders in a shadow root, so selectors in
your app's global CSS can't reach the editor. If your stylesheets conflict with
it and you can't move them into a layer (see
[Styling and isolation](#styling-and-isolation)), that isolation is worth the
duplicate runtime.

`init({ shadowDom: false })` renders in the page instead of a shadow root. In a
Vue app that is the component's behaviour plus a second Vue runtime, so use the
component.

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

## Feature reference

Everything below is identical across frameworks. Only the mounting differs.

### The editor at a glance

- **Drag-and-drop block editor** — paragraph, heading, image, video, list, button, anchor, divider, spacer, menu, socials, plus custom blocks you register.
- **Four export formats** — HTML, MJML, React Email (`.tsx`), JSON.
- **ESP-aware conditional logic** — visibility rules compile to the right syntax for Klaviyo, Mailchimp, Braze, SFMC, HubSpot, Iterable, Handlebars and more.
- **Merge tags** with an in-editor picker.
- **Saved templates and saved rows** — reusable snippets and full documents.
- **Desktop/mobile styling** — per-block mobile overrides on components, rows, columns and row spacers.
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

Per-device styling is saved as a sparse `mobile` object that holds only the settings that change on small screens. Rows, columns and row spacers carry it on the node itself; components carry it in `props.mobile`. Only the keys you override are saved, and a block with no overrides has no `mobile` key at all, so a template that does not use mobile overrides saves exactly as it did before. A row with one column, and a row spacer, as `getJson()` returns them inside `rows`:

```json
[
  {
    "id": "6d9fa0e6da604c60",
    "type": "row",
    "name": "hero_section",
    "padding": { "top": 40, "right": 32, "bottom": 40, "left": 32 },
    "gap": 12,
    "mobileStack": true,
    "mobile": {
      "backgroundColor": "#123a63",
      "padding": { "top": 24, "right": 16, "bottom": 24, "left": 16 }
    },
    "backgroundColor": "#0a2540",
    "columns": [
      {
        "id": "23fbdff8bc7149c6-0",
        "width": 100,
        "verticalAlign": "middle",
        "mobile": { "verticalAlign": "top" },
        "backgroundColor": "transparent",
        "children": []
      }
    ]
  },
  {
    "id": "bf90d4be44174a23",
    "type": "row-spacer",
    "height": 40,
    "backgroundColor": "transparent",
    "mobile": { "height": 16 }
  }
]
```

What each block can override on mobile:

| Block | `mobile` keys |
| --- | --- |
| Row | `backgroundColor`, `backgroundGradient`, `padding`, `border`, `minHeight`, `gap` |
| Column | `backgroundColor`, `backgroundGradient`, `padding`, `border`, `verticalAlign` |
| Row spacer | `height`, `backgroundColor`, `backgroundGradient` |

A mobile `padding` or `border` replaces the desktop one as a whole. Sides you leave out are not filled in from desktop, so write all four sides and the complete border. A row's mobile `gap` only applies while the row stacks on mobile (`mobileStack`) and has a desktop `gap` above 0. `schema_version` stays `"1.0"` and there is nothing to migrate: templates saved before 0.4.13 load as they are.

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

- **The container needs a real height.** The editor fills its parent; `height: 100vh` or a sized flex child both work. A container with no height renders nothing visible.
- **`transform`, `filter`, `perspective` or `will-change` on any ancestor** breaks `position: fixed` inside it — floating toolbars and pickers will land in the wrong place. Avoid them above the mount point.
- **Desktop only.** The editor shows a notice on small screens rather than attempting a mobile drag-and-drop UI.
- **Autosave** keeps a local draft, so a refresh mid-edit recovers. "New template" clears it deliberately.