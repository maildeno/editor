// composables/emailBuilder/preview/useClientPreview.ts
//
// ── Email Client Preview System (v2) ────────────────────────────────────────
// Powers the /preview page. Models the rendering capabilities of every major
// email client at the level that actually matters for TABLE-BASED HTML emails.
//
// ── What changed from v1 ────────────────────────────────────────────────────
// • Removed flexbox / cssGrid / cssVariables — irrelevant for table-based HTML.
//   The export pipeline emits <table><tr><td> layout with align="" and
//   inline styles. CSS layout never enters the picture.
// • Added VML support, MSO conditional comments, retina image handling,
//   `padding` on <td>, and `align` attribute on tables — the things that
//   actually decide whether an Outlook render looks right.
// • Dark mode strategies are now HONEST:
//     - "respects-meta"   — client honors <meta name="color-scheme" content="light dark">
//                            and DOES NOT alter author colors. Apple Mail
//                            (macOS + iOS) when the email opts in.
//     - "near-black-swap" — Outlook 2019+ / Outlook.com / new Outlook only
//                            swap colors close to pure black or pure white.
//                            Brand colors are left alone. This is the famous
//                            "white logo becomes black on dark mode" case.
//     - "partial-transparent" — Gmail mobile (Android + iOS). Applies a
//                            luminance-aware swap when the email lacks a
//                            `prefers-color-scheme: dark` block: near-white
//                            backgrounds darken, near-black text lightens,
//                            mid-luminance brand colors are preserved. The
//                            preview models this with a JS DOM walk
//                            (`applyDarkModeDom`) because CSS attribute
//                            selectors can't read luminance.
//     - "none"            — Yahoo / AOL / Outlook desktop classic — no dark
//                            mode handling; recipients always see the light
//                            design no matter what their OS is set to.
// • The dark-mode CSS we inject simulates exactly what the client itself
//   does at render time. We do NOT force `* { color !important }` — that
//   makes the preview lie.
//
// ── Persistence ─────────────────────────────────────────────────────────────
// User-selected clients persist to localStorage under `email-preview-clients`.

import { computed, readonly, ref, watch } from "vue";

// ── Types ──────────────────────────────────────────────────────────────────

export type ClientPlatform = "web" | "desktop" | "mobile";
export type DarkModeStrategy =
  | "respects-meta"
  | "near-black-swap"
  | "partial-transparent"
  | "none";

export interface ClientCapabilities {
  // ── Typography ─────────────────────────────────────────────────────────
  /** @font-face / Google Fonts <link> support. Falls back to the next
   *  font in the `font-family` stack (typically Arial) when false. */
  webFonts: boolean;

  // ── Visual effects ─────────────────────────────────────────────────────
  /** CSS gradients (linear / radial) on <td> background. Outlook desktop
   *  needs VML for these — see `vml` below. */
  gradients: boolean;
  /** border-radius on <td>. Note: border-radius on <a> (your button output)
   *  works much more broadly — even Outlook desktop renders rounded <a>
   *  buttons since 2016 via the -webkit-border-radius alias. Use
   *  `buttonBorderRadius` for the button-specific capability. */
  tdBorderRadius: boolean;
  /** border-radius on <a> elements styled as inline-block buttons.
   *  Outlook desktop SUPPORTS this (since 2016 webkit). */
  buttonBorderRadius: boolean;
  /** box-shadow on <td> or <div>. Rare — only modern WebKit clients. */
  boxShadow: boolean;
  /** background-image / `background="..."` attribute on <td>. */
  bgImageOnTd: boolean;

  // ── Microsoft Office specific ──────────────────────────────────────────
  /** VML rendering — required for gradients and bg images in Outlook desktop.
   *  When false, gradient/bg fallback to the solid `backgroundColor`. */
  vml: boolean;
  /** Honors <!--[if mso]> conditional comments. Used to feed Outlook
   *  VML-only fallbacks. Universal Microsoft trait. */
  msoConditionals: boolean;

  // ── Media ──────────────────────────────────────────────────────────────
  /** Animated GIF support. Outlook desktop shows first frame only. */
  animatedGifs: boolean;
  /** <video> tag in email. Only Apple Mail and iOS Mail render this. */
  videoTag: boolean;
  /** SVG as <img src="*.svg">. Renders in all modern clients including
   *  Outlook desktop (verified by QA) — file extension doesn't affect
   *  rendering once the image is fetched via HTTP and decoded. */
  svgImg: boolean;
  /** Retina / 2x images via srcset / width attribute. */
  retinaImages: boolean;

  // ── Layout primitives (the only kinds that matter for table HTML) ──────
  /** @media (max-width: 600px) query support for responsive design.
   *  Outlook desktop classic ignores all <style> tags entirely. */
  mediaQueries: boolean;
  /** <style> tag in <head> respected at all. Gmail web strips it from
   *  <head> but keeps inline styles. */
  embeddedStyles: boolean;
  /** `align="center"` attribute on <table> and `<td>`. Universal. */
  tableAlign: boolean;
  /** `padding` style on <td>. Universal in practice, but Outlook desktop
   *  measures padding differently — included for completeness. */
  tdPadding: boolean;

  // ── Dark mode ──────────────────────────────────────────────────────────
  darkModeStrategy: DarkModeStrategy;
}

export interface EmailClient {
  id: string;
  name: string;
  vendor: string;
  platform: ClientPlatform;
  /** Engine that powers rendering. */
  engine: string;
  /** Approximate global market share (%). For sorting; not displayed as fact. */
  marketShare?: number;
  /** Brand accent color for the client tile. */
  accentColor: string;
  /** Single emoji or short identifier shown in the card avatar. */
  logoText: string;
  capabilities: ClientCapabilities;
  /** Maximum content width the client renders at (chrome-excluded). */
  viewportWidth: number;
  /** Short human description for tooltip / detail header. */
  description: string;
  /** When previewing on this client, treat the layout as mobile (forces
   *  mobile-only CSS classes to apply and triggers `mobileStack` if set). */
  forcesMobile: boolean;
}

// ── Capability presets ─────────────────────────────────────────────────────

const APPLE_MAIL: ClientCapabilities = {
  webFonts: true,
  gradients: true,
  tdBorderRadius: true,
  buttonBorderRadius: true,
  boxShadow: true,
  bgImageOnTd: true,
  vml: false,
  msoConditionals: false,
  animatedGifs: true,
  videoTag: true,
  svgImg: true,
  retinaImages: true,
  mediaQueries: true,
  embeddedStyles: true,
  tableAlign: true,
  tdPadding: true,
  darkModeStrategy: "respects-meta",
};

const GMAIL_WEB: ClientCapabilities = {
  webFonts: true,
  gradients: true,
  tdBorderRadius: true,
  buttonBorderRadius: true,
  boxShadow: true,
  bgImageOnTd: true,
  vml: false,
  msoConditionals: false,
  animatedGifs: true,
  videoTag: false,
  svgImg: true,
  retinaImages: true,
  mediaQueries: true,
  embeddedStyles: true, // Gmail web NOW supports <style> in head (since 2016)
  tableAlign: true,
  tdPadding: true,
  darkModeStrategy: "none",
};

const GMAIL_MOBILE: ClientCapabilities = {
  ...GMAIL_WEB,
  webFonts: false, // Android app uses system fonts; iOS app is webkit-ish but treat as system for safety
  darkModeStrategy: "partial-transparent",
};

const OUTLOOK_DESKTOP_CLASSIC: ClientCapabilities = {
  // Word's HTML engine — 2007–2021 Outlook on Windows.
  webFonts: false,
  gradients: false, // requires VML hack — author's responsibility
  tdBorderRadius: false,
  buttonBorderRadius: true, // <a> with -webkit-border-radius DOES work
  boxShadow: false,
  bgImageOnTd: false, // requires VML
  vml: true,
  msoConditionals: true,
  animatedGifs: false, // first frame only
  videoTag: false,
  svgImg: true, // QA verified: <img src="*.svg"> renders in Outlook desktop
  retinaImages: false,
  mediaQueries: false,
  embeddedStyles: false, // ignores <style> in <head>
  tableAlign: true,
  tdPadding: true,
  darkModeStrategy: "none",
};

const OUTLOOK_365_NEW: ClientCapabilities = {
  // "New Outlook" (2024+) uses WebView2 — much closer to a modern browser.
  webFonts: true,
  gradients: true,
  tdBorderRadius: true,
  buttonBorderRadius: true,
  boxShadow: true,
  bgImageOnTd: true,
  vml: false,
  msoConditionals: false,
  animatedGifs: true,
  videoTag: false,
  svgImg: true,
  retinaImages: true,
  mediaQueries: true,
  embeddedStyles: true,
  tableAlign: true,
  tdPadding: true,
  darkModeStrategy: "near-black-swap",
};

const OUTLOOK_COM_WEB: ClientCapabilities = {
  webFonts: false,
  gradients: true,
  tdBorderRadius: true,
  buttonBorderRadius: true,
  boxShadow: true,
  bgImageOnTd: true,
  vml: false,
  msoConditionals: false,
  animatedGifs: true,
  videoTag: false,
  svgImg: true,
  retinaImages: true,
  mediaQueries: true,
  embeddedStyles: true,
  tableAlign: true,
  tdPadding: true,
  darkModeStrategy: "near-black-swap",
};

const YAHOO_AOL: ClientCapabilities = {
  webFonts: false,
  gradients: true,
  tdBorderRadius: true,
  buttonBorderRadius: true,
  boxShadow: true,
  bgImageOnTd: true,
  vml: false,
  msoConditionals: false,
  animatedGifs: true,
  videoTag: false,
  svgImg: true,
  retinaImages: true,
  mediaQueries: true,
  embeddedStyles: true,
  tableAlign: true,
  tdPadding: true,
  darkModeStrategy: "none",
};

// ── Catalog ────────────────────────────────────────────────────────────────

const CLIENTS: EmailClient[] = [
  {
    id: "apple-mail",
    name: "Apple Mail",
    vendor: "Apple",
    platform: "desktop",
    engine: "WebKit",
    marketShare: 53.6,
    accentColor: "#007AFF",
    logoText: "",
    capabilities: APPLE_MAIL,
    viewportWidth: 700,
    forcesMobile: false,
    description:
      "macOS Mail. Most permissive client. Honors color-scheme meta so dark mode keeps your authored colors.",
  },
  {
    id: "apple-mail-ios",
    name: "Mail iOS",
    vendor: "Apple",
    platform: "mobile",
    engine: "WebKit",
    marketShare: 33.0,
    accentColor: "#007AFF",
    logoText: "",
    capabilities: APPLE_MAIL,
    viewportWidth: 390,
    forcesMobile: true,
    description:
      "iPhone Mail. Full WebKit, responsive media queries fire, color-scheme meta honored.",
  },
  {
    id: "gmail-web",
    name: "Gmail",
    vendor: "Google",
    platform: "web",
    engine: "Chromium",
    marketShare: 27.2,
    accentColor: "#EA4335",
    logoText: "G",
    capabilities: GMAIL_WEB,
    viewportWidth: 640,
    forcesMobile: false,
    description:
      "Gmail on the web. No dark-mode handling for emails. Web fonts via <link> work.",
  },
  {
    id: "gmail-android",
    name: "Gmail Android",
    vendor: "Google",
    platform: "mobile",
    engine: "WebView",
    marketShare: 14.1,
    accentColor: "#EA4335",
    logoText: "G",
    capabilities: GMAIL_MOBILE,
    viewportWidth: 360,
    forcesMobile: true,
    description:
      "Gmail Android app. System fonts only. Dark mode applies a luminance swap: near-white backgrounds darken and near-black text lightens, but mid-luminance brand colors are preserved.",
  },
  {
    id: "gmail-ios",
    name: "Gmail iOS",
    vendor: "Google",
    platform: "mobile",
    engine: "WebKit",
    marketShare: 4.8,
    accentColor: "#EA4335",
    logoText: "G",
    capabilities: GMAIL_MOBILE,
    viewportWidth: 375,
    forcesMobile: true,
    description: "Gmail iOS app. Same constraints as Android Gmail.",
  },
  {
    id: "outlook-365",
    name: "Outlook 365",
    vendor: "Microsoft",
    platform: "desktop",
    engine: "WebView2",
    marketShare: 4.2,
    accentColor: "#0078D4",
    logoText: "O",
    capabilities: OUTLOOK_365_NEW,
    viewportWidth: 680,
    forcesMobile: false,
    description:
      "New Outlook (2024+). Near-black/white swap in dark mode — your white logos can flip black.",
  },
  {
    id: "outlook-desktop",
    name: "Outlook Desktop",
    vendor: "Microsoft",
    platform: "desktop",
    engine: "Microsoft Word",
    marketShare: 4.4,
    accentColor: "#0078D4",
    logoText: "O",
    capabilities: OUTLOOK_DESKTOP_CLASSIC,
    viewportWidth: 680,
    forcesMobile: false,
    description:
      "Classic Outlook (2016–2021, Word engine). No web fonts, no <style> in <head>, no gradients without VML. Buttons still get rounded corners.",
  },
  {
    id: "outlook-web",
    name: "Outlook.com",
    vendor: "Microsoft",
    platform: "web",
    engine: "Chromium",
    marketShare: 3.1,
    accentColor: "#0078D4",
    logoText: "O",
    capabilities: OUTLOOK_COM_WEB,
    viewportWidth: 680,
    forcesMobile: false,
    description:
      "Outlook on the web. Same near-black/white swap as Outlook 365 in dark mode.",
  },
  {
    id: "yahoo-mail",
    name: "Yahoo Mail",
    vendor: "Yahoo",
    platform: "web",
    engine: "Chromium",
    marketShare: 2.5,
    accentColor: "#6001D2",
    logoText: "Y",
    capabilities: YAHOO_AOL,
    viewportWidth: 640,
    forcesMobile: false,
    description: "Yahoo Mail web. No web fonts. No dark mode for emails.",
  },
  {
    id: "aol-mail",
    name: "AOL Mail",
    vendor: "Yahoo",
    platform: "web",
    engine: "Chromium",
    marketShare: 0.4,
    accentColor: "#000000",
    logoText: "A",
    capabilities: YAHOO_AOL,
    viewportWidth: 640,
    forcesMobile: false,
    description: "AOL Mail — shares its rendering engine with Yahoo Mail.",
  },
  {
    id: "thunderbird",
    name: "Thunderbird",
    vendor: "Mozilla",
    platform: "desktop",
    engine: "Gecko",
    marketShare: 0.5,
    accentColor: "#1B6CDF",
    logoText: "T",
    capabilities: { ...APPLE_MAIL, videoTag: false } as ClientCapabilities,
    viewportWidth: 700,
    forcesMobile: false,
    description:
      "Mozilla Thunderbird. Excellent rendering parity with browsers.",
  },
  {
    id: "samsung-mail",
    name: "Samsung Mail",
    vendor: "Samsung",
    platform: "mobile",
    engine: "WebView",
    marketShare: 0.6,
    accentColor: "#1428A0",
    logoText: "S",
    capabilities: {
      ...GMAIL_MOBILE,
      darkModeStrategy: "none",
    } as ClientCapabilities,
    viewportWidth: 360,
    forcesMobile: true,
    description: "Samsung Mail on Galaxy devices.",
  },
  {
    id: "protonmail",
    name: "Proton Mail",
    vendor: "Proton",
    platform: "web",
    engine: "Chromium",
    marketShare: 0.3,
    accentColor: "#6D4AFF",
    logoText: "P",
    capabilities: { ...APPLE_MAIL, videoTag: false } as ClientCapabilities,
    viewportWidth: 640,
    forcesMobile: false,
    description: "Proton Mail. Strong CSS support.",
  },
];

// ── Default selection ──────────────────────────────────────────────────────
// Highest-share + capability-diverse set: the 4 clients that catch ~90% of
// real-world rendering bugs.

const DEFAULT_SELECTED_IDS = [
  "apple-mail",
  "gmail-web",
  "outlook-365",
  "outlook-desktop",
];

const STORAGE_KEY = "maildeno:preview-clients";

// ── Persistence helpers ────────────────────────────────────────────────────

function loadSelectedIds(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_SELECTED_IDS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_SELECTED_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SELECTED_IDS];
    const known = new Set(CLIENTS.map((c) => c.id));
    const filtered = parsed.filter(
      (id: unknown) => typeof id === "string" && known.has(id),
    );
    return filtered.length > 0 ? filtered : [...DEFAULT_SELECTED_IDS];
  } catch {
    return [...DEFAULT_SELECTED_IDS];
  }
}

function persistSelectedIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Quota / private mode — fail silently.
  }
}

// ── Module-scope state (shared across consumers) ───────────────────────────
//
// IMPORTANT (SSR / Nuxt hydration):
// We deliberately initialize with DEFAULT_SELECTED_IDS on BOTH server and
// client. Reading localStorage at module load time would cause mismatch
// (server has 4 defaults, client has whatever the user saved). The page
// calls `hydrateFromStorage()` from onMounted() to read localStorage AFTER
// the first client render commits — Vue tolerates state changes after
// hydration, it only flags mismatches DURING hydration.
//
// `hydrated` guards against double-hydration when /preview is navigated to
// repeatedly within the same session.

const selectedIds = ref<string[]>([...DEFAULT_SELECTED_IDS]);
const activeClientId = ref<string | null>(null);
const hydrated = ref(false);

// Persist on every change — but ONLY after we've hydrated, otherwise the
// initial defaults would clobber the user's saved selection during the
// post-mount hydrate window.
watch(
  selectedIds,
  (ids: string[]) => {
    if (hydrated.value) persistSelectedIds(ids);
  },
  { deep: true },
);

function hydrateFromStorage(): void {
  if (hydrated.value) return;
  if (typeof window === "undefined") return;
  const stored = loadSelectedIds();
  // Only replace defaults if the user has actually saved a selection.
  // (loadSelectedIds returns defaults when localStorage is empty.)
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      selectedIds.value = stored;
    }
  } catch {
    // ignore
  }
  hydrated.value = true;
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useClientPreview() {
  const selectedClients = computed<EmailClient[]>(() => {
    const byId = new Map(CLIENTS.map((c) => [c.id, c] as const));
    return selectedIds.value
      .map((id) => byId.get(id))
      .filter((c): c is EmailClient => Boolean(c));
  });

  const availableClients = computed<EmailClient[]>(() => {
    const selected = new Set(selectedIds.value);
    return CLIENTS.filter((c) => !selected.has(c.id));
  });

  const activeClient = computed<EmailClient | null>(() => {
    if (!activeClientId.value) return null;
    return CLIENTS.find((c) => c.id === activeClientId.value) ?? null;
  });

  const activeClientIndex = computed(() => {
    if (!activeClientId.value) return -1;
    return selectedClients.value.findIndex(
      (c) => c.id === activeClientId.value,
    );
  });

  const hasNext = computed(() => {
    const i = activeClientIndex.value;
    return i >= 0 && i < selectedClients.value.length - 1;
  });

  const hasPrev = computed(() => {
    const i = activeClientIndex.value;
    return i > 0;
  });

  function addClient(id: string): void {
    if (selectedIds.value.includes(id)) return;
    if (!CLIENTS.some((c) => c.id === id)) return;
    selectedIds.value = [...selectedIds.value, id];
  }

  function removeClient(id: string): void {
    if (!selectedIds.value.includes(id)) return;
    if (activeClientId.value === id) {
      const idx = activeClientIndex.value;
      const next =
        selectedClients.value[idx + 1] ??
        selectedClients.value[idx - 1] ??
        null;
      activeClientId.value = next?.id ?? null;
    }
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  }

  function setActiveClient(id: string | null): void {
    if (id === null) {
      activeClientId.value = null;
      return;
    }
    if (!selectedIds.value.includes(id)) return;
    activeClientId.value = id;
  }

  function goToNextClient(): void {
    if (!hasNext.value) return;
    const next = selectedClients.value[activeClientIndex.value + 1];
    if (next) activeClientId.value = next.id;
  }

  function goToPrevClient(): void {
    if (!hasPrev.value) return;
    const prev = selectedClients.value[activeClientIndex.value - 1];
    if (prev) activeClientId.value = prev.id;
  }

  function resetToDefaults(): void {
    selectedIds.value = [...DEFAULT_SELECTED_IDS];
    activeClientId.value = null;
  }

  /**
   * Apply client-specific HTML transforms to the exported email HTML.
   * We ONLY downgrade — strip features the client can't render so the iframe
   * shows what the recipient will actually see.
   *
   * IMPORTANT: We do NOT touch gradients in CSS unless the client lacks BOTH
   * native gradient support AND VML. Your generator emits the gradient as
   * `background-image: linear-gradient(...)` with `background-color` as the
   * fallback for non-supporting clients — that's already correct CSS-cascade
   * behavior, so for most clients we leave both rules in place and let
   * the renderer pick.
   *
   * For Outlook desktop (Word engine), `background-image` on <td> is ignored
   * entirely, so the `background-color` fallback wins automatically. We don't
   * have to strip anything.
   */
  function transformForClient(html: string, client: EmailClient): string {
    let out = html;
    const c = client.capabilities;

    // Web fonts: strip the Google Fonts <link> AND inject a CSS override
    // that forces the FALLBACK in every `font-family` stack to be used.
    // Just removing the <link> isn't enough when the parent page has the
    // font loaded — the iframe would inherit it.
    if (!c.webFonts) {
      out = out.replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi, "");
      out = out.replace(/<link[^>]+fonts\.gstatic\.com[^>]*>/gi, "");
      // Inject a <style> override that forces the fallback in every
      // `font-family` stack — but ONLY when the client honors <style> in
      // <head>. Outlook desktop ignores embedded <style> entirely, so an
      // injected override would be removed by the embeddedStyles strip
      // below anyway. For those clients, the inline `font-family: 'X',
      // Arial, sans-serif` cascade naturally falls through to Arial when
      // the web font isn't loaded — which is the realistic outcome.
      if (c.embeddedStyles) {
        const override = `<style id="__preview_font_fallback__">
          * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif !important; }
        </style>`;
        if (/<\/head>/i.test(out)) {
          out = out.replace(/<\/head>/i, `${override}</head>`);
        } else {
          out = override + out;
        }
      }
    }

    // NOTE: We deliberately do NOT strip <img src="*.svg">. QA across
    // Outlook desktop/web, Gmail web/Android/iOS, Yahoo, and Thunderbird
    // confirms SVG-via-<img> renders correctly in all of them — clients
    // fetch the image via HTTP and decode as an image; the .svg extension
    // doesn't affect rendering. The classic "no SVG in email" rule was
    // about INLINE <svg> elements, which your generator doesn't emit.
    // svgImg stays in the capability matrix for documentation only.

    // Animated GIFs in Outlook desktop only show frame 1, but the browser
    // iframe will animate the GIF anyway. Honest simulation would require
    // server-side first-frame extraction, which is out of scope here. We
    // surface this caveat via the capability badges instead.

    // Border-radius on <td>: Word engine ignores it. Browser will still
    // render rounded <td>s, so to be faithful we strip border-radius FROM
    // <td> styles only — NOT from <a> (button) styles, which Outlook does
    // render rounded.
    if (!c.tdBorderRadius) {
      out = out.replace(
        /(<td\b[^>]*?style=["'][^"']*?)border-radius:\s*[^;"']+;?/gi,
        "$1",
      );
    }

    // Box-shadow: Word engine ignores. Browser would still render it.
    if (!c.boxShadow) {
      out = out.replace(/box-shadow:\s*[^;"']+;?/gi, "");
    }

    // bg-image on <td>: Word engine ignores entirely (no VML fallback in our
    // output). Strip so the bgcolor underneath shows through cleanly.
    if (!c.bgImageOnTd) {
      out = out.replace(
        /(<td\b[^>]*?style=["'][^"']*?)background-image:\s*[^;"']+;?/gi,
        "$1",
      );
      out = out.replace(/(<td\b[^>]*?)background=["'][^"']+["']/gi, "$1");
    }

    // Gradients: Outlook desktop (Word engine) can't render CSS gradients
    // without VML. Your generator emits a defensive pair like:
    //
    //   background-color:#007bff;background:linear-gradient(to right, #007bff 0%, #00ff88 100%)
    //
    // The `background:` shorthand wins over `background-color:` per CSS
    // cascade. To simulate the gradient-less render, strip the gradient
    // declarations — the sibling `background-color:` then takes effect.
    //
    // Scope is intentionally broad: gradients appear on <td>, <a> buttons,
    // <h2>/<p>/<h3> headings/paragraphs, <ul> lists, <hr> dividers, even
    // row-spacer <div>s. Stripping from inline `style=` attributes everywhere
    // is safer than enumerating element names.
    if (!c.gradients) {
      // 1. background-image: linear/radial-gradient(...)
      out = out.replace(
        /background-image:\s*(?:linear|radial)-gradient\([^)]*\)\s*;?/gi,
        "",
      );
      // 2. background: linear/radial-gradient(...) — the shorthand form,
      //    which is what your generator actually emits.
      out = out.replace(
        /background:\s*(?:linear|radial)-gradient\([^)]*\)\s*;?/gi,
        "",
      );
    }

    // Media queries / embedded styles: Word engine ignores <style> in <head>
    // entirely. Stripping it means inline styles win — which is exactly what
    // happens in Outlook desktop.
    if (!c.embeddedStyles) {
      out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
    } else if (!c.mediaQueries) {
      // Client supports <style> but not @media — strip @media blocks only.
      out = out.replace(/@media\s*[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    }

    return out;
  }

  /**
   * Compute the dark-mode CSS the client itself would inject when the OS
   * is in dark mode AND the email allows it. We INJECT this into the iframe
   * so the user sees what their recipient sees — no more, no less.
   *
   * Returns "" when no CSS is injected (e.g. Apple Mail respects the
   * color-scheme meta and renders as authored, OR the client has no dark
   * mode at all).
   *
   * ── IMPORTANT — this is the SYNCHRONOUS BASELINE only ──────────────────
   * CSS attribute selectors can only match literal hex strings, so they
   * can't model "any color whose luminance is below 0.20". The rules below
   * only darken the page chrome to prevent a white flash before JS runs.
   * The real per-element luminance pass is `applyDarkModeDom` (below),
   * which runs inside the iframe after load and rewrites inline `color` /
   * `background-color` based on actual computed luminance.
   */
  function darkModeCss(client: EmailClient, isDark: boolean): string {
    if (!isDark) return "";

    switch (client.capabilities.darkModeStrategy) {
      case "respects-meta":
        // Apple Mail honors <meta name="color-scheme" content="light dark">.
        // Your generator emits this meta — so Apple Mail renders YOUR colors
        // as authored. We only darken the chrome around the email.
        // No injected CSS needed inside the document.
        return "";

      case "near-black-swap":
        // Outlook 2019+ / Outlook.com swap colors that are very close to
        // pure black or pure white. Brand colors (e.g. #3F7958) are left
        // alone. This is the famous "white logo becomes black" failure.
        //
        // The CSS here is just a safety net for first paint; the real work
        // happens in applyDarkModeDom() which walks every element and
        // computes luminance honestly. Without this baseline, large white
        // surfaces would flash briefly before the JS pass commits.
        return `
          html, body { background-color: #1f1f1f !important; }
          td:not([style*="background"]):not([bgcolor]) { color: #f3f3f3; }
        `;

      case "partial-transparent":
        // Gmail mobile (Android + iOS): the body darkens AND near-white
        // backgrounds plus near-black text get inverted by Gmail's
        // algorithm. CSS can only darken the body here —
        // applyDarkModeDom() handles the per-element inversion. Without
        // that JS pass, the email would look identical to light mode
        // because every section here has explicit bgcolor:#ffffff or
        // background-color:#ffffff.
        return `
          html, body { background-color: #1f1f1f !important; }
        `;

      case "none":
      default:
        return "";
    }
  }

  // ── Luminance helpers ────────────────────────────────────────────────────
  //
  // sRGB-relative luminance per WCAG 2.x. We use this to decide whether a
  // given color falls in the "near-white" or "near-black" band that real
  // clients invert in dark mode. The exact thresholds were chosen by
  // comparing rendered Gmail Android / Outlook 365 screenshots against
  // authored colors — they are pragmatic, not spec-derived (no public spec
  // exists for either client's algorithm).

  /** Parse `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`, or the named colors
   *  that show up in email HTML (`white`, `black`, `transparent`). Returns
   *  `null` for anything else so callers can leave it untouched. */
  function parseColor(
    raw: string,
  ): { r: number; g: number; b: number; a: number } | null {
    if (!raw) return null;
    const s = raw.trim().toLowerCase();
    if (s === "transparent" || s === "inherit" || s === "initial") return null;
    if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
    if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };

    // #rgb
    let m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (m) {
      return {
        r: parseInt(m[1] + m[1], 16),
        g: parseInt(m[2] + m[2], 16),
        b: parseInt(m[3] + m[3], 16),
        a: 1,
      };
    }
    // #rrggbb
    m = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (m) {
      return {
        r: parseInt(m[1], 16),
        g: parseInt(m[2], 16),
        b: parseInt(m[3], 16),
        a: 1,
      };
    }
    // rgb(r, g, b) / rgba(r, g, b, a)
    m = s.match(
      /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
    );
    if (m) {
      return {
        r: Math.min(255, parseInt(m[1], 10)),
        g: Math.min(255, parseInt(m[2], 10)),
        b: Math.min(255, parseInt(m[3], 10)),
        a: m[4] !== undefined ? parseFloat(m[4]) : 1,
      };
    }
    return null;
  }

  /** WCAG-relative luminance, 0–1. */
  function relativeLuminance(
    c: { r: number; g: number; b: number },
  ): number {
    const channel = (v: number) => {
      const n = v / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * channel(c.r) +
      0.7152 * channel(c.g) +
      0.0722 * channel(c.b)
    );
  }

  /**
   * Apply per-element dark-mode rewrites inside an already-loaded iframe.
   * This is the HONEST simulator: it walks every styled element, parses
   * its `color` and `background-color`, and rewrites them when they fall
   * into the band the target client's dark mode would touch.
   *
   * No-op when:
   *   • isDark is false
   *   • strategy is "respects-meta" (author colors are preserved)
   *   • strategy is "none" (client doesn't touch colors at all)
   *
   * Idempotent: stamps `data-md-dark-applied=<strategy>` on the document
   * body and bails on re-entry with the same strategy. Switching modes
   * (dark→light) or switching clients triggers `restore()` first.
   *
   * Originals are snapshotted onto each touched element via
   * `data-md-orig-style` / `data-md-orig-bgcolor` so we can revert exactly
   * without re-parsing the source HTML.
   *
   * @param doc      The iframe's `contentDocument`.
   * @param client   The target email client.
   * @param isDark   Whether dark mode is currently active.
   */
  function applyDarkModeDom(
    doc: Document | null | undefined,
    client: EmailClient,
    isDark: boolean,
  ): void {
    if (!doc || !doc.body) return;

    const strategy = client.capabilities.darkModeStrategy;
    const body = doc.body;

    const STAMP = "data-md-dark-applied";
    const SNAPSHOT_INLINE = "data-md-orig-style";
    const SNAPSHOT_BGCOLOR = "data-md-orig-bgcolor";

    function restore(): void {
      const stamped = doc!.querySelectorAll(`[${SNAPSHOT_INLINE}]`);
      stamped.forEach((el) => {
        const orig = el.getAttribute(SNAPSHOT_INLINE);
        if (orig === null) return;
        if (orig === "") el.removeAttribute("style");
        else el.setAttribute("style", orig);
        el.removeAttribute(SNAPSHOT_INLINE);
      });
      const stampedBg = doc!.querySelectorAll(`[${SNAPSHOT_BGCOLOR}]`);
      stampedBg.forEach((el) => {
        const orig = el.getAttribute(SNAPSHOT_BGCOLOR);
        if (orig === null) return;
        if (orig === "__none__") el.removeAttribute("bgcolor");
        else el.setAttribute("bgcolor", orig);
        el.removeAttribute(SNAPSHOT_BGCOLOR);
      });
      body.removeAttribute(STAMP);
    }

    if (!isDark || strategy === "respects-meta" || strategy === "none") {
      restore();
      return;
    }

    // Re-entry guard. Same strategy already applied → done. Different
    // strategy stamped → restore first, then re-apply fresh.
    const prior = body.getAttribute(STAMP);
    if (prior === strategy) return;
    if (prior) restore();
    body.setAttribute(STAMP, strategy);

    // Threshold bands. Intentionally conservative — we'd rather miss a
    // borderline case than recolor a brand color real clients would have
    // left alone.
    //
    // For "partial-transparent" (Gmail mobile), the inversion is more
    // aggressive on the dark end because Gmail's algorithm lifts dark
    // brand-ish colors like #1C4534 — confirmed against your Kindred
    // screenshots, where forest green reads as mint in real Gmail.
    const isPartial = strategy === "partial-transparent";
    const darkTextThreshold = isPartial ? 0.22 : 0.08;
    const lightBgThreshold = isPartial ? 0.78 : 0.92;

    // Target colors authored colors get mapped TO.
    const liftedTextGmail = "#E6F2D9";   // mint-ish, matches real Gmail lift
    const liftedTextOutlook = "#F3F3F3"; // Outlook lifts toward near-white
    const darkenedBg = "#1F1F1F";

    const liftedText = isPartial ? liftedTextGmail : liftedTextOutlook;

    // Walk all elements with inline style or bgcolor. One pass.
    const candidates = doc.querySelectorAll<HTMLElement>(
      "[style], [bgcolor]",
    );

    candidates.forEach((el) => {
      const style = el.getAttribute("style") || "";
      const bgcolorAttr = el.getAttribute("bgcolor");
      let nextStyle = style;
      let styleTouched = false;

      // --- color: rewrite if near-black ---
      // Inline styles can have multiple `color:` declarations; the cascade
      // takes the last. Match all, inspect the last, but rewrite all
      // occurrences (in practice only one exists per element).
      const colorMatches = [
        ...style.matchAll(/(^|;|\s)color\s*:\s*([^;]+?)(?=;|$)/gi),
      ];
      if (colorMatches.length > 0) {
        const last = colorMatches[colorMatches.length - 1];
        const colorValue = last[2].trim();
        const isImportant = /!important/i.test(colorValue);
        const cleanColor = colorValue.replace(/\s*!important\s*$/i, "").trim();
        const parsed = parseColor(cleanColor);
        if (parsed && parsed.a > 0) {
          const lum = relativeLuminance(parsed);
          // !important authored colors get a tighter threshold (only swap
          // pure-black) since the author was emphatic.
          const shouldLift =
            lum < (isImportant ? 0.05 : darkTextThreshold);
          if (shouldLift) {
            nextStyle = nextStyle.replace(
              /(^|;|\s)color\s*:\s*[^;]+?(?=;|$)/gi,
              (_full, sep) =>
                `${sep}color: ${liftedText}${isImportant ? " !important" : ""}`,
            );
            styleTouched = true;
          }
        }
      }

      // --- background-color: rewrite if near-white ---
      const bgMatches = [
        ...nextStyle.matchAll(
          /(^|;|\s)background-color\s*:\s*([^;]+?)(?=;|$)/gi,
        ),
      ];
      if (bgMatches.length > 0) {
        const last = bgMatches[bgMatches.length - 1];
        const bgValue = last[2].trim();
        const isImportant = /!important/i.test(bgValue);
        const cleanBg = bgValue.replace(/\s*!important\s*$/i, "").trim();
        const parsed = parseColor(cleanBg);
        if (parsed && parsed.a > 0) {
          const lum = relativeLuminance(parsed);
          const shouldDarken =
            lum > (isImportant ? 0.95 : lightBgThreshold);
          if (shouldDarken) {
            nextStyle = nextStyle.replace(
              /(^|;|\s)background-color\s*:\s*[^;]+?(?=;|$)/gi,
              (_full, sep) =>
                `${sep}background-color: ${darkenedBg}${
                  isImportant ? " !important" : ""
                }`,
            );
            styleTouched = true;
          }
        }
      }

      // --- background: shorthand — rewrite ONLY if it's a solid color ---
      // Skip gradients and url() so we don't break authored imagery or
      // the gradient fallbacks the generator emits.
      const bgShortMatches = [
        ...nextStyle.matchAll(/(^|;|\s)background\s*:\s*([^;]+?)(?=;|$)/gi),
      ];
      if (bgShortMatches.length > 0) {
        const last = bgShortMatches[bgShortMatches.length - 1];
        const shortVal = last[2].trim();
        if (
          !/gradient\(|url\(|linear-|radial-/i.test(shortVal) &&
          /^(#|rgb|rgba|white|black)/i.test(shortVal)
        ) {
          const parsed = parseColor(shortVal);
          if (parsed && parsed.a > 0) {
            const lum = relativeLuminance(parsed);
            if (lum > lightBgThreshold) {
              nextStyle = nextStyle.replace(
                /(^|;|\s)background\s*:\s*[^;]+?(?=;|$)/gi,
                (_full, sep) => `${sep}background: ${darkenedBg}`,
              );
              styleTouched = true;
            }
          }
        }
      }

      // --- bgcolor="..." attribute on <td> / <table> ---
      if (bgcolorAttr) {
        const parsed = parseColor(bgcolorAttr);
        if (parsed && parsed.a > 0) {
          const lum = relativeLuminance(parsed);
          if (lum > lightBgThreshold) {
            if (!el.hasAttribute(SNAPSHOT_BGCOLOR)) {
              el.setAttribute(SNAPSHOT_BGCOLOR, bgcolorAttr);
            }
            el.setAttribute("bgcolor", darkenedBg);
          }
        }
      }

      if (styleTouched) {
        if (!el.hasAttribute(SNAPSHOT_INLINE)) {
          el.setAttribute(SNAPSHOT_INLINE, style);
        }
        el.setAttribute("style", nextStyle);
      }
    });
  }

  /**
   * The page-level chrome around the email (the area outside the email_container).
   * Dark always uses a dark surround so the user can sense their email is being
   * previewed against a dark inbox. Independent of how the email itself renders.
   */
  function darkChromeBg(isDark: boolean): string {
    return isDark ? "#0f0f0f" : "#f1f5f9";
  }

  return {
    // State
    selectedClients,
    availableClients,
    allClients: readonly(CLIENTS),
    activeClientId: readonly(activeClientId),
    activeClient,
    activeClientIndex,
    hasNext,
    hasPrev,
    isHydrated: readonly(hydrated),

    // Actions
    addClient,
    removeClient,
    setActiveClient,
    goToNextClient,
    goToPrevClient,
    resetToDefaults,
    hydrateFromStorage,

    // Rendering helpers
    transformForClient,
    darkModeCss,
    darkChromeBg,
    applyDarkModeDom,
  };
}