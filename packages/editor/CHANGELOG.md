# Changelog

## 0.4.5

Packaging only. No API change, no behaviour change.

### Changed

**The 15 runtime dependencies moved to devDependencies.** TipTap,
ProseMirror, reka-ui, @vueuse/core, prettier and @internationalized/date
are all bundled into `dist` at build time, so declaring them as runtime
dependencies made npm install a second, unused copy of each into every
consumer's node_modules.

`dist` imports exactly one external module — `vue` — which is already the
sole peerDependency. Verified across every emitted chunk, and by
installing the package with nothing but Vue and building a consumer:
32/32 scoped selectors present, no unresolved imports.

Installing the package now pulls **25 MB across 15 packages instead of
71 MB across 45**.

If any of these is ever externalised rather than bundled, it has to move
back. `dist` importing anything other than `vue` is the signal.

## 0.4.4

Packaging only. No API change, no behaviour change in the editor itself.
The published package drops from 8.13 MB unpacked to 5.48 MB, 32.6% smaller.

### Changed

**React Email export formats with prettier's babel-ts parser** instead of
the typescript parser. `prettier/plugins/typescript` is 900kB of source
against babel's 318kB and was the largest single file in the package.
Output is byte-identical on the TSX this package generates, verified
across generics, JSX, inline style objects and mapped children. The
typescript parser is the stricter of the two, which matters for arbitrary
user code but not for TSX `react-email.ts` generated moments earlier.
Saves 600kB.

**Both build passes are minified.** They have to agree: the two passes
share chunks by content hash, so identical output collapses to one file
and differing output ships two. Minifying only the element pass made the
package *larger* — 8.68 MB — because every prettier chunk was then
carried twice, once minified and once not. Saves 1.92MB with both on.

**`element-scoped-styles.css` is no longer emitted.** Nothing referenced
it: not `src/`, not the framework guides, not the README, not the exports
map. The shadow root reads those rules from the substituted string inside
the chunk, and Vite only extracted the file because library mode always
does. `dist/editor.css` is unaffected and `./style.css` still resolves.
Saves 72kB.

## 0.4.3

### Fixed

**Every component `<style scoped>` block was missing when installing from
npm and using the `EmailEditor` Vue component.** The editor rendered
unstyled panels — `HealthIndicator`, `DesktopOnlyNotice`, the text panel,
and 29 other scoped blocks — while Tailwind, the fonts and the icons all
applied normally. `init()` and the custom element were unaffected, and
building against a local `dist/` folder never reproduced it.

0.4.2 delivered those styles by prepending a self-executing snippet to the
entry chunk:

```js
(function(){ /* … document.head.appendChild(style) … */ })();
import { a, c, g, … } from "./index-DhFg3uKs.js";
export { a as EmailEditor, … };
```

`package.json` declares `sideEffects` as covering CSS files only, which
tells a consumer's bundler that every `.js` in the package is pure. Rollup
had emitted `dist/index.js` as a thin facade holding nothing but that
snippet and a set of re-exports — and a pure module whose exports can be
reached directly is one a bundler may delete outright. So consumer builds
dropped the file, the snippet went with it, and the CSS never ran.
Verified against the published 0.4.2 tarball: zero of 32 scoped selectors
survived a consumer build.

Whether Rollup emits that facade is a chunking decision, which is why the
same source built correctly in this repo and shipped broken. The styles
are now substituted into a value `baseStyles.ts` returns, so
`EmailEditor.vue` injects them on mount alongside Tailwind and the fonts.
Reachable from the component, they cannot be dropped without dropping the
component — the mechanism `shadowStyles.ts` has always used for the shadow
root. Confirmed surviving even under `sideEffects: false`.

Nothing changed in the public API, and no CSS import is needed.

### Changed

**A missing style substitution now fails the build instead of warning.**
Both build passes error out if the placeholder cannot be found in any
chunk. A warning in a build log was not enough to catch this before
publishing.

## 0.4.2

Docs only — no code changes. 0.4.1's `onSave` fix is confirmed working on the
`init()` path.

- **Save gating documented** in the Vanilla, React and Astro guides: `onSave`
  is what reveals the Save button, and `handle.on("save", …)` only fires when
  it was passed, because without it the editor never saves.
- **New "Reading the canvas" section** in the Nuxt and Vue guides, covering
  `getHtml` / `getMjml` / `getReactEmail` / `getJson` via a template ref —
  they are instance methods, not events or slot props, which was not written
  down anywhere.

## 0.4.1

### Fixed

**`onSave` from `init()` never fired.** `save` was a `defineEmits` entry, and
`defineCustomElement` *replaces* `instance.emit` with a DOM-event dispatcher:

```js
instance.emit = (event, ...args) => { dispatch(event, args); … }
```

So `emit("save")` dispatched a CustomEvent and never called the handler the
host had passed. The Save button appeared (the prop was present) and the
callback was unreachable — while `handle.on("save", …)` worked, because that
listens for the DOM event.

`save` is no longer an emit. The handler is a prop the component calls
directly, and the component re-dispatches a `bubbles: true, composed: true`
CustomEvent alongside it so `handle.on("save", …)` keeps working.

`init()` sets it as **`saveHandler`**, not `onSave`: Vue's custom-element
wrapper routes `on*` keys to its event machinery, so `el.onSave = fn` never
reaches the component either. Vue hosts keep using `@save`.


## 0.4.0

Gating corrections. All three came from running the editor as a guest, where
every "can the user do this?" question has a different answer.

### Changed

**The Save button now follows an `onSave` handler**, matching how
`onSendTestEmail` reveals the Send-test button. Pass it and Save appears; omit
it and the button, the save-status indicator and the autosave timer all
disappear.

```vue
<EmailEditor @save="onSave" />          <!-- Vue: @save IS the onSave prop -->
```
```ts
init({ onSave(payload) { … } })
```

0.3.0 gated this on the storage adapter having `saveTemplate`, which was
wrong: `mergeWithDefaults` fills every missing method from the localStorage
defaults, so `saveTemplate` is *always* present by the time anything reads it.
The check could never be false. Gating on an explicit handler is both correct
and more discoverable.

**The saved-templates panel button is hidden when the host omits
`listTemplates`.** Same before-merge reasoning. A guest would otherwise be
offered a template library backed by localStorage that they never saved to and
cannot reach anywhere else. `versions: true` forces the button on, since
version history comes from different adapter methods.

### Guest editors

The two above make a genuine read-only editor a one-liner, and the shape
matters:

```ts
// Right — everything unlisted falls back to localStorage
const adapter = { loadTemplate: api.loadTemplate };
```
```ts
// Wrong — every other method still points at authenticated endpoints,
// so saving a row 401s
const { saveTemplate, ...adapter } = api;
```

With the first, saved rows, image uploads and drafts all keep working against
the visitor's own browser. Exports work fully. There is no Save button and no
template library.

## 0.3.0

Four fixes from real integration, three of them things only a running app
could surface.

### Fixed

**The editor's CSS no longer leaks into the host page.** The Vue-component
path injected ~183KB into `document.head` — bare `.grid`, `.flex`, `.hidden`,
`.block` utilities plus `html`, `body` and `h1`–`h6` element rules. In an app
that also uses Tailwind, the editor's copy was injected later and won on
source order, so the host's own layout classes started behaving like the
editor's.

Every rule is now prefixed with `:where(.md-editor-scope)` at build time by a
PostCSS pass, and the editor root carries that class. `:where()` adds no
specificity, so the cascade inside the editor is unchanged. `@font-face`,
`@property`, `@keyframes` and `@import` stay global — they are document-scoped
by nature, and `@property` in particular is what makes Tailwind's `--tw-*`
variables resolve at all. `:root`, `html` and `body` are retargeted to the
editor root rather than dropped, since some carry the editor's own background
and font stack.

Verified on a real mount: 1,121 rules scoped, zero unscoped utilities or
element rules remaining.

**Save is hidden when the host can't save.** Pass a `storageAdapter` without
`saveTemplate` and the Save button, the save-status indicator and the autosave
timer all disappear — a guest session no longer fires 401s in the background
or shows a button that always errors.

Gated on `useCanSave()` rather than checking the resolved adapter, because
`mergeWithDefaults` fills every missing method from the localStorage adapter,
so `typeof adapter.saveTemplate` is *always* a function by the time anything
reads it. The signal is computed from the host's partial before merging.
Passing no adapter at all still counts as "can save" — that is the zero-config
demo path.

### Added

**`ready` event.** Fires once the canvas has actually painted its initial
content, not when the component mounts. Hosts showing a loading placeholder
were removing it on mount, which is before `loadTemplate` resolves and the rows
hydrate — so users watched blocks appear one at a time.

```vue
<EmailEditor @ready="showSkeleton = false" />
```

Emitted two ticks after the internal ready state flips, so the DOM for that
first paint exists by the time the handler runs. Fires once per mount.

### Note on layout

The editor is built around **document scroll**: its shell is `min-h-screen`
with a `sticky top-0` header, so the canvas grows past the viewport and the
page scrolls under a pinned toolbar. Giving its container a fixed height with
`overflow: hidden` clips everything below the fold and leaves no scroll
container to reach it. Give the container a minimum height, not a maximum.

The docs previously said "the editor fills its parent; give it a real height",
which is easy to read as "one viewport tall, overflow hidden". Reworded.

## 0.2.0

Adds the write half of the editor's API, version history, a shared row
library, and two host slots. Nothing in 0.1.x breaks.

### Added

**Programmatic write API.** The read side (`getHtml`, `getMjml`,
`getReactEmail`, `getJson`) has always been public; these are its counterpart,
so a host can drive the canvas from its own UI without reaching into builder
internals.

```ts
setJson(data, opts?)   // opts.history: "undoable" (default) | "reset"
getSelection()         // { id, type } | null — type is the block type
setSelection(id)       // false if no block has that id
onChange(cb)           // returns an unsubscribe function
```

`setJson` accepts exactly what `getJson()` returns, so `setJson(getJson())`
round-trips, plus the `{ canvas, content: { rows } }` shape version APIs
typically return. It defaults to a single undoable step. Available on the Vue
component ref, on `EditorHandle` from `init()`, and on the custom element.

**Version history** — `versions` prop on the component and `init()`. Replaces
the saved-templates panel and its header button with restore / delete /
delete-all / keep. Backed by five adapter methods:

```ts
listTemplateVersions(templateId)
getTemplateVersion(templateId, versionId)
deleteTemplateVersion(templateId, versionId)
deleteAllTemplateVersions(templateId)     // kept versions survive
setTemplateVersionKept(templateId, versionId, kept)
```

Each control appears only when its method exists, so an adapter that can list
and restore but not delete gets exactly that. `createLocalStorageAdapter`
implements all five, so this works with no backend.

**Shared saved rows** — `listSystemSavedRows()`. An optional read-only second
row library in its own tab beside the user's own. The tab appears only when
the call returns rows. Read-only by construction: there is no save/rename/delete
counterpart, because who may curate a shared library is a permissions question
the editor has no user model to answer.

**Assistant slot.** The editor supplies a drawer, its trigger, open/close
state, escape handling and focus return; the host supplies the contents.

```vue
<EmailEditor><template #assistant="{ editor }">…</template></EmailEditor>
```

```ts
init({ assistant: { mount(el, editor) {…}, unmount(el) {} } })
```

There is no AI in this package. Prompts, endpoints and diff strategy belong to
whoever is building the product. `mount` runs on first open rather than at
startup, so a drawer nobody opens costs nothing.

**`header-actions` slot.** Host controls beside Save, receiving
`{ templateId, isSaving, saveStatus }`. Renders nothing when unused.

**`brandName`** prop and `init()` option — the "Powered by" line in the
desktop-only notice. Pass `""` to hide the line entirely.

**New exports:** `EditorWriteApi`, `AssistantMount`, `TemplateSummary`,
`TemplateVersionSummary`.

### Fixed

**Published types were broken.** `dist/index.d.ts` re-exported `EmailEditor`
from a path that was never emitted. Consumers with `skipLibCheck: true` (Nuxt's
default) got `any` — no prop typing, no autocomplete, no error on a misspelled
prop; with it off, a hard `TS2307`.

Two independent causes, both failing silently:

1. `vite-plugin-dts` needs `processor: "vue"` to emit SFC declarations. Its own
   warning only fires when the entry or an include glob contains `.vue`, and
   neither did.
2. `unplugin-dts` gets Vue support from an optional peer on
   `@vue/language-core ^3.1.5`. The playground's `vue-tsc ^2.1.0` hoisted v2 to
   the monorepo root, failing the range check.

Fixed by setting `processor: "vue"` and aligning the playground to
`vue-tsc ^3.3.11`. Declaration coverage went 0 → 122 files.

**The typecheck wasn't checking components.** 34 SFCs used `<script setup>`
without `lang="ts"`, so `vue-shims.d.ts` declared every `*.vue` import as
`DefineComponent<{}, {}, any>` — which untyped all 121 components as
collateral. Converted, shim removed, and the 82 latent type errors it was
hiding are fixed.

**`getSelection().type` returned `"component"`** for every block. The tree
stores the structural kind in `type` and the block kind in `componentType`;
this returns the latter, which is what the field exists for.

### Removed

- `optimizeAI.ts` — AI-facing snapshot stripping, unreferenced and belonging to
  a host rather than the editor.
- `PropertyNumber.vue` — superseded by `PropertyNumberSlider`, unreferenced.

