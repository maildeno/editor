# @maildeno/editor 

A drag-and-drop email template editor.

## Install

```bash
npm install @maildeno/editor
```

One package, no peer dependencies, no CSS import. The editor injects its own
styling when it mounts.

## Minimal usage Vue

```vue
<script setup lang="ts">
import { EmailEditor } from "@maildeno/editor";
</script>

<template>
  <EmailEditor />
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

## Minimal usage React

```tsx
import { useEffect, useRef } from "react";
import { init, type EditorHandle } from "@maildeno/editor/init";

export default function Editor() {
  const container = useRef<HTMLDivElement>(null);
  const handle = useRef<EditorHandle | null>(null);

  useEffect(() => {
    let cancelled = false;

    init({ container: container.current! }).then((h) => {
      // React 18 StrictMode mounts effects twice in development. Without
      // this guard the first instance is orphaned and never destroyed.
      if (cancelled) return h.destroy();
      handle.current = h;
    });

    return () => {
      cancelled = true;
      handle.current?.destroy();
    };
  }, []);

  return <div ref={container} />;
}
```

## `EditorHandle`

`init()` resolves to this once the editor has mounted:

| Member | Description |
| --- | --- |
| `element` | The underlying `<maildeno-editor>` DOM node. |
| `on(event, fn)` / `off(event, fn)` | Subscribe to editor events. Currently `"save"`. |
| `setTheme(theme)` | Re-theme live, any time after mount. |
| `getHtml(mode?)` | Current template as an HTML email string, or `null` if empty. |
| `getMjml(mode?)` | Current template as MJML. |
| `getReactEmail(mode?)` | Current template as React Email `.tsx` source. |
| `getJson()` | Current template as a plain object. |
| `setJson(data, opts?)` | Replace the canvas. Accepts what `getJson()` returns, so `setJson(getJson())` round-trips. `opts.history` is `"undoable"` (default) or `"reset"`. |
| `getSelection()` | `{ id, type }` for the selected block, or `null`. `type` is the block type (`"paragraph"`, `"image"`…). |
| `setSelection(id)` | Select by id, or clear with `null`. Returns `false` if no block has that id. |
| `onChange(cb)` | Runs `cb` after each committed change. Returns an unsubscribe function. |
| `destroy()` | Unmount and clean up. Always call this on unmount. |


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
  renderCanvas: ProductCardCanvas,     // Vue component shown in the editor
  renderSettings: ProductCardPanel,    // Vue component for the right panel
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

- **The container needs a real height.** The editor fills its parent; `height: 100vh` or a sized flex child both work.
- **`transform`, `filter`, `perspective` or `will-change` on any ancestor** breaks `position: fixed` inside it — floating toolbars and pickers will land in the wrong place. Avoid them above the mount point.
- **Desktop only.** The editor shows a notice on small screens rather than attempting a mobile drag-and-drop UI.
- **Autosave** keeps a local draft, so a refresh mid-edit recovers. "New template" clears it deliberately.
