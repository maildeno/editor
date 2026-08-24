# Maildeno Editor

<p align="center">
  <strong>A powerful, open-source drag-and-drop email editor</strong>
</p>

<p align="center">
  Build responsive email templates visually and export them as HTML, MJML, React Email, or portable JSON.
</p>

<p align="center">
  <a href="https://github.com/maildeno/editor">GitHub</a>
  ·
  <a href="https://docs.maildeno.com">Documentation</a>
  ·
  <a href="https://www.npmjs.com/package/@maildeno/editor">npm</a>
</p>

<p align="center">
  <img src="https://maildeno.com/images/opensource-canvas.PNG" alt="Maildeno Editor" width="100%" />
</p>

---

## Open source. Built for developers.

Maildeno Editor is an **MIT-licensed, open-source email template builder** that you can embed directly into your application.

It gives your users a visual canvas for building emails while leaving storage, sending, authentication, and infrastructure completely under your control.

Use it to build:

* SaaS email builders
* Marketing campaign editors
* Transactional email editors
* Customer communication platforms
* Internal email template systems
* ESP and marketing automation products
* White-label email editors

No Maildeno backend is required.

---

## ✨ Features

### 🎨 Visual drag-and-drop editor

Build email templates visually without forcing users to write HTML.

The editor includes common email building blocks such as:

* Paragraphs
* Headings
* Images
* Videos
* Lists
* Buttons
* Links
* Dividers
* Spacers
* Menus
* Social links
* Custom blocks

Your application can also register its own blocks.

### 📱 Responsive email design

Create desktop and mobile email layouts from the same visual editor.

Individual blocks support mobile-specific styling overrides so you can control how your email behaves on smaller screens.

### 📦 Multiple export formats

The same template can be exported into multiple formats:

| Format      | Use case                                        |
| ----------- | ----------------------------------------------- |
| HTML        | Send directly through your email infrastructure |
| MJML        | Continue working with MJML-based pipelines      |
| React Email | Generate `.tsx` email components                |
| JSON        | Store and restore the portable template format  |

```ts
const html = editor.getHtml();
const mjml = editor.getMjml();
const reactEmail = editor.getReactEmail();
const json = editor.getJson();
```

### 🔀 ESP-aware conditional logic

Build conditional email content visually and export it using the syntax expected by your email provider.

Maildeno supports conditional logic for providers and template syntaxes including:

* Klaviyo
* Mailchimp
* Braze
* Salesforce Marketing Cloud
* HubSpot
* Iterable
* Handlebars
* Custom ESP syntaxes

You can also register your own ESP syntax.

### 🏷️ Merge tags

Give users an in-editor picker for dynamic values such as:

```text
{{ customer.first_name }}
{{ order.total }}
```

Your application can register its own merge tags.

### 💾 Bring your own storage

Maildeno does not force your data into a proprietary backend.

By default, templates are stored in `localStorage`.

For production applications, implement the storage adapter and connect the editor to your own:

* API
* Database
* Object storage
* Authentication system
* Image storage

You control the data.

### 🧩 Extensible by design

Add functionality without modifying the editor's built-in source.

Register:

* Custom blocks
* Custom ESP syntaxes
* Custom merge tags
* Custom storage adapters

```ts
registerBlock({
  name: "product-card",
  label: "Product Card",
  // ...
});
```

This makes the editor suitable for building specialized email experiences rather than forcing every application into the same UI.

### 🎨 Custom themes

The entire editor can be branded through a theme.

```ts
const theme = {
  primary: "#6366f1",
  background: "#f8fafc",
  surface: "#ffffff",
  text: "#111827",
  border: "#e5e7eb",
};
```

Themes are reactive, and multiple editors on the same page can use different themes.

Dark mode is supported as well.

### 📧 Test email integration

Maildeno doesn't send email itself.

Instead, it gives your application the email payload:

```ts
onSendTestEmail: async ({ to, subject, html }) => {
  await fetch("/api/send-test", {
    method: "POST",
    body: JSON.stringify({ to, subject, html }),
  });
}
```

Your server can then use Resend, Postmark, SendGrid, SES, or any other email provider.

Your provider credentials never need to reach the browser.

### 💾 Autosave and recovery

The editor automatically maintains a local draft so that a refresh during editing doesn't necessarily mean losing the user's work.

It also supports:

* Undo / redo
* Saved templates
* Saved reusable rows
* Preview
* Client-specific rendering checks

---

## Why Maildeno?

Most email editors are tightly coupled to a hosted platform.

Maildeno takes a different approach:

> **The editor belongs in your application, not the other way around.**

You control:

* Your database
* Your API
* Your authentication
* Your email provider
* Your image storage
* Your templates
* Your branding
* Your infrastructure

Maildeno provides the visual editing layer.

---

## Install

```bash
npm install @maildeno/editor
```

The package has **no peer dependencies** and does not require a separate CSS import. Its styling is injected automatically when the editor mounts.

---

## Quick start

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

```vue
<script setup lang="ts">
import { EmailEditor } from "@maildeno/editor";
</script>

<template>
  <EmailEditor :capabilities="{ export: ['html', 'react-email', 'mjml', 'json'] }" />
</template>
```

That's enough to get the editor running.

---


## Framework-free embedding

You can also mount Maildeno without creating a Vue application.

```ts
import { init } from "@maildeno/editor/init";

const editor = await init({
  container: document.querySelector("#editor"),
});
```

This makes it possible to embed the editor into applications where Vue isn't otherwise part of the host application.

The `init()` API renders the editor inside a shadow root, providing style isolation from the host page.

---

## Storage

Maildeno doesn't require a backend.

For demos and simple applications:

```text
Editor
  ↓
localStorage
```

For production:

```text
Editor
  ↓
Storage Adapter
  ↓
Your API
  ↓
Your Database / Object Storage
```

Implement only the storage methods you need.

```ts
const storageAdapter = {
  async loadTemplate(templateId) {
    const response = await fetch(`/api/templates/${templateId}`);

    if (!response.ok) {
      return null;
    }

    return response.json();
  },

  async saveTemplate(snapshot, templateId) {
    // Persist to your backend.
  },

  async uploadImage(file) {
    // Upload to your own storage.
  },
};
```

The editor never needs direct knowledge of your backend architecture.

---

## Exports

Maildeno exposes four template representations:

```ts
editor.getHtml();
editor.getMjml();
editor.getReactEmail();
editor.getJson();
```

The JSON representation is portable and contains:

```text
template_id
template_name
canvas
rows
schema_version
```

This makes templates straightforward to store, version, migrate, or move between systems.

---

## Conditional rendering

When conditional visibility is used, HTML can be generated in two modes.

### Prune

Evaluate the current preview context and output only the matching branches.

```ts
editor.getHtml("prune");
```

Useful when generating the final email for a specific recipient/context.

### Wrap

Keep all branches and emit the conditional syntax expected by the ESP.

```ts
editor.getHtml("wrap");
```

Useful when your ESP performs the conditional evaluation itself.

---

## Custom blocks

Maildeno is designed to be extended rather than forked.

```ts
registerBlock({
  name: "product-card",
  label: "Product Card",

  schema: {
    // block properties
  },

  renderCanvas: ProductCardCanvas,

  renderSettings: ProductCardPanel,

  renderEmail: {
    html: (props, ctx) => {
      return `<table>...</table>`;
    },

    mjml: (props, ctx) => {
      return `<mj-section>...</mj-section>`;
    },

    reactEmail: (props, ctx) => {
      return `<Section>...</Section>`;
    },
  },
});
```

You can therefore build blocks specifically for your own product, data model, or email workflow.

---

## Custom ESP syntax

Maildeno can also be extended to support ESPs that aren't built in.

```ts
registerESPSyntax("my-esp", {
  wrapOpenTag: (expr) => `{% if ${expr} %}`,
  wrapCloseTag: () => `{% endif %}`,

  wrapMergeTag: (key, fallback) =>
    fallback
      ? `{{ ${key} | default: "${fallback}" }}`
      : `{{ ${key} }}`,
});
```

---

## Custom merge tags

Add application-specific variables to the merge-tag picker:

```ts
registerMergeTags([
  { key: "customer.first_name" },
  { key: "customer.company" },
  { key: "order.total" },
]);
```

---

## Theming

Maildeno is designed to disappear into your product's UI rather than look like a third-party widget.

```ts
const theme = {
  primary: "#6366f1",

  background: "#f8fafc",
  surface: "#ffffff",
  text: "#111827",
  border: "#e5e7eb",

  headerBg: "#ffffff",
  headerText: "#111827",
  sidebarBg: "#ffffff",
  canvasBg: "#f1f5f9",
};
```

You can override individual surfaces, buttons, inputs, overlays, toolbars, and dark-mode values.

---

## Project structure

This repository is an npm workspace monorepo:

```text
packages/
└── editor/
    └── src/

apps/
└── playground/
```

`packages/editor` contains the published `@maildeno/editor` package.

`apps/playground` is the development environment used to run and visually test the editor.

---

## Development

Clone the repository and install dependencies:

```bash
npm install
```

Start the playground:

```bash
npm run dev
```

The playground provides two ways to run the editor:

### Vue component

```text
/
```

A normal Vue application using:

```ts
import { EmailEditor } from "@maildeno/editor";
```

### Framework-free custom element

```text
/element-demo.html
```

This demonstrates the `init()` entry point without requiring a Vue application or Tailwind CSS on the host page.

Changes inside `packages/editor/src` are picked up directly by the playground during development.

---

## Build

To build the published package:

```bash
cd packages/editor
npm run build
```

The build produces:

```text
dist/index.js
dist/element.js
dist/init.js
```

The standard Vue component uses the host application's Vue runtime, while the framework-free entry point bundles the runtime it needs.

---

## Browser considerations

The editor needs a container with a real height:

```css
#editor {
  height: 100vh;
}
```

or a sized flex container.

Also avoid placing the editor underneath ancestors using:

```css
transform
filter
perspective
will-change
```

These can interfere with fixed-position floating UI such as toolbars and pickers.

The editor is currently intended for desktop editing and displays a notice on small screens rather than attempting to provide a mobile drag-and-drop editing experience.

---

## License

Maildeno Editor is open source software licensed under the **MIT License**.

You are free to use, modify, distribute, and include it in commercial products.

See [`LICENSE`](./LICENSE) for the full license text.

---

## Contributing

Contributions, bug reports, feature requests, and improvements are welcome.

If you find a problem or have an idea for improving the editor, open an issue or pull request on GitHub.

---

<p align="center">
  <strong>Build your own email editing experience.</strong>
  <br />
  <sub>Open source. Extensible. Built for developers.</sub>
</p>
