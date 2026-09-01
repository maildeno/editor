// composables/system/useGoogleFonts.ts
//
// Google Fonts loading — two surfaces:
//
// loadGoogleFont(family) ← legacy per-font loader.
// Kept for back-compat; still used by
// property-panel font previews and
// anywhere else calling it one-at-a-time.
//
// syncFontsForTemplate(fonts[]) ← NEW, preferred path for the canvas.
// Batches an entire template's fonts
// into ONE <link> request, diffs against
// already-loaded set, injects only the
// delta. Append-only — never replaces an
// existing <link> so there's no reflow.
//
// getGoogleFontImports(fonts[]) ← pure URL builder. Used by the export
// engine (htmlExport / mjmlExport /
// reactEmailExport) to embed a single
// stylesheet URL in the exported email.
// Untouched.
//
// preconnectGoogleFonts() ← NEW. Fire-once at app startup to open
// TLS connections to fonts.googleapis.com
// and fonts.gstatic.com in parallel with
// HTML parsing. Shaves 100–300 ms off the
// first font request. Idempotent.
//
// ─── Performance notes ───────────────────────────────────────────────────────
// Before: CanvasComponent watched fontFamily and called loadGoogleFont(family)
// per component on mount. A 62-component template with 6 unique fonts meant 6
// separate blocking <link> requests scheduled sequentially as Vue mounted the
// tree — a dominant LCP contributor.
//
// After: useEmailBuilder runs ONE batched watchEffect that scans the whole
// tree and calls syncFontsForTemplate with all unique families. The first
// sync fires ONE combined request for all 6 fonts. Later edits only append
// a <link> when the font set grows (a user picks a new font).

import { ref } from "vue";

// True module-level singleton — see the comment inside useGoogleFonts()
// below for why this one genuinely should be shared across every editor
// instance on the page, not scoped per-instance like canvas state.
const loadedFonts = ref<Set<string>>(new Set());

export const useGoogleFonts = () => {
  const googleFonts = ref<string[]>([
    // ─── Web-safe fonts ───────────────────────────────────────────────────────
    "Arial",
    "Arial Black",
    "Comic Sans MS",
    "Courier New",
    "Georgia",
    "Helvetica",
    "Impact",
    "Lucida Console",
    "Lucida Sans Unicode",
    "Palatino Linotype",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",

    // ─── Google Fonts (alphabetical) ─────────────────────────────────────────
    "ABeeZee",
    "Abel",
    "Abril Fatface",
    "Adamina",
    "Alegreya",
    "Alegreya Sans",
    "Alfa Slab One",
    "Alice",
    "Amatic SC",
    "Amiri",
    "Anton",
    "Archivo",
    "Archivo Black",
    "Archivo Narrow",
    "Arimo",
    "Arvo",
    "Asap",
    "Asap Condensed",
    "Assistant",
    "Atkinson Hyperlegible",
    "Barlow",
    "Barlow Condensed",
    "Barlow Semi Condensed",
    "Be Vietnam Pro",
    "Bebas Neue",
    "BioRhyme",
    "Bitter",
    "Bodoni Moda",
    "Bree Serif",
    "Bricolage Grotesque",
    "Cabin",
    "Cabin Condensed",
    "Cairo",
    "Cal Sans",
    "Cardo",
    "Catamaran",
    "Caveat",
    "Chivo",
    "Comfortaa",
    "Commissioner",
    "Cormorant",
    "Cormorant Garamond",
    "Courier Prime",
    "Crimson Pro",
    "Crimson Text",
    "DM Mono",
    "DM Sans",
    "DM Serif Display",
    "DM Serif Text",
    "Dancing Script",
    "Domine",
    "Dosis",
    "EB Garamond",
    "Eczar",
    "Epilogue",
    "Exo",
    "Exo 2",
    "Figtree",
    "Fira Code",
    "Fira Mono",
    "Fira Sans",
    "Fira Sans Condensed",
    "Fjalla One",
    "Frank Ruhl Libre",
    "Fraunces",
    "Fredoka",
    "Funnel Sans",
    "Geist Mono",
    "Geologica",
    "Hanken Grotesk",
    "Heebo",
    "Hind",
    "Hind Madurai",
    "Hind Siliguri",
    "IBM Plex Mono",
    "IBM Plex Sans",
    "IBM Plex Sans Condensed",
    "IBM Plex Serif",
    "Inconsolata",
    "Inknut Antiqua",
    "Instrument Sans",
    "Instrument Serif",
    "Inter",
    "Inter Tight",
    "JetBrains Mono",
    "Josefin Sans",
    "Josefin Slab",
    "Jost",
    "Kalam",
    "Kanit",
    "Karla",
    "Khand",
    "Kumbh Sans",
    "Lato",
    "Lexend",
    "Lexend Deca",
    "Libre Baskerville",
    "Libre Bodoni",
    "Libre Caslon Text",
    "Libre Franklin",
    "Lobster",
    "Lora",
    "Manrope",
    "Marcellus",
    "Maven Pro",
    "Merriweather",
    "Merriweather Sans",
    "Mohave",
    "Montserrat",
    "Montserrat Alternates",
    "Mukta",
    "Mulish",
    "Neuton",
    "Newsreader",
    "Noticia Text",
    "Noto Sans",
    "Noto Sans Display",
    "Noto Sans Mono",
    "Noto Serif",
    "Noto Serif Display",
    "Nunito",
    "Nunito Sans",
    "Old Standard TT",
    "Onest",
    "Open Sans",
    "Oswald",
    "Outfit",
    "Overpass",
    "Overpass Mono",
    "Oxygen",
    "PT Mono",
    "PT Sans",
    "PT Sans Narrow",
    "PT Serif",
    "Pacifico",
    "Padauk",
    "Petrona",
    "Philosopher",
    "Piazzolla",
    "Playfair",
    "Playfair Display",
    "Playfair Display SC",
    "Plus Jakarta Sans",
    "Poppins",
    "Prata",
    "Prompt",
    "Proza Libre",
    "Public Sans",
    "Quattrocento",
    "Quattrocento Sans",
    "Questrial",
    "Quicksand",
    "REM",
    "Radio Canada",
    "Raleway",
    "Readex Pro",
    "Recursive",
    "Red Hat Display",
    "Red Hat Mono",
    "Red Hat Text",
    "Roboto",
    "Roboto Condensed",
    "Roboto Flex",
    "Roboto Mono",
    "Roboto Serif",
    "Roboto Slab",
    "Rokkitt",
    "Rubik",
    "Saira",
    "Saira Condensed",
    "Sanchez",
    "Sansita",
    "Sarabun",
    "Sen",
    "Signika",
    "Signika Negative",
    "Sintony",
    "Smooch Sans",
    "Sofia Sans",
    "Sono",
    "Sora",
    "Source Code Pro",
    "Source Sans 3",
    "Source Sans Pro",
    "Source Serif 4",
    "Source Serif Pro",
    "Space Grotesk",
    "Space Mono",
    "Spectral",
    "Syne",
    "Tajawal",
    "Teko",
    "Tenor Sans",
    "TikTok Sans",
    "Tinos",
    "Titillium Web",
    "Ubuntu",
    "Ubuntu Mono",
    "Unbounded",
    "Urbanist",
    "Vazirmatn",
    "Vollkorn",
    "Wix Madefor Display",
    "Wix Madefor Text",
    "Work Sans",
    "Yanone Kaffeesatz",
    "Yrsa",
    "Zilla Slab",
  ]);

  // ─── Web-safe fonts (no Google Fonts request needed) ───────────────────────
  const WEB_SAFE_FONTS = new Set([
    "Arial",
    "Arial Black",
    "Comic Sans MS",
    "Courier New",
    "Georgia",
    "Helvetica",
    "Impact",
    "Lucida Console",
    "Lucida Sans Unicode",
    "Palatino Linotype",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",
  ]);

  /**
   * Google Fonts that ship a true italic (ital) axis.
   *
   * IMPORTANT: Only add a font here after verifying it has an "Italic" style
   * on fonts.google.com. Requesting `ital` for a font that lacks it causes
   * a 400 Bad Request and the entire font fails to load.
   */
  const FONTS_WITH_ITALICS = new Set([
    "Alegreya",
    "Alegreya Sans",
    "Archivo",
    "Archivo Narrow",
    "Arimo",
    "Arvo",
    "Asap",
    "Asap Condensed",
    "Assistant",
    "Atkinson Hyperlegible",
    "Barlow",
    "Barlow Condensed",
    "Barlow Semi Condensed",
    "Be Vietnam Pro",
    "Bitter",
    "Bree Serif",
    "Cabin",
    "Cabin Condensed",
    "Cardo",
    "Catamaran",
    "Chivo",
    "Commissioner",
    "Cormorant",
    "Cormorant Garamond",
    "Courier Prime",
    "Crimson Pro",
    "Crimson Text",
    "DM Sans",
    "DM Serif Text",
    "Domine",
    "EB Garamond",
    "Eczar",
    "Epilogue",
    "Exo",
    "Exo 2",
    "Figtree",
    "Fira Code",
    "Fira Sans",
    "Fira Sans Condensed",
    "Frank Ruhl Libre",
    "Fraunces",
    "Hanken Grotesk",
    "Heebo",
    "IBM Plex Mono",
    "IBM Plex Sans",
    "IBM Plex Sans Condensed",
    "IBM Plex Serif",
    "Inconsolata",
    "Instrument Sans",
    "Instrument Serif",
    "Inter",
    "Inter Tight",
    "JetBrains Mono",
    "Josefin Sans",
    "Josefin Slab",
    "Jost",
    "Karla",
    "Lato",
    "Libre Baskerville",
    "Libre Bodoni",
    "Libre Caslon Text",
    "Libre Franklin",
    "Lora",
    "Manrope",
    "Maven Pro",
    "Merriweather",
    "Merriweather Sans",
    "Montserrat",
    "Mulish",
    "Neuton",
    "Newsreader",
    "Noticia Text",
    "Noto Sans",
    "Noto Sans Display",
    "Noto Serif",
    "Noto Serif Display",
    "Nunito",
    "Nunito Sans",
    "Open Sans",
    "Oswald",
    "Outfit",
    "Overpass",
    "Overpass Mono",
    "Oxygen",
    "PT Sans",
    "PT Serif",
    "Petrona",
    "Piazzolla",
    "Playfair",
    "Playfair Display",
    "Plus Jakarta Sans",
    "Poppins",
    "Proza Libre",
    "Public Sans",
    "Quattrocento",
    "Quattrocento Sans",
    "Quicksand",
    "Radio Canada",
    "Raleway",
    "Readex Pro",
    "Recursive",
    "Red Hat Display",
    "Red Hat Mono",
    "Red Hat Text",
    "Roboto",
    "Roboto Condensed",
    "Roboto Mono",
    "Roboto Serif",
    "Roboto Slab",
    "Rokkitt",
    "Rubik",
    "Saira",
    "Saira Condensed",
    "Sansita",
    "Sarabun",
    "Signika Negative",
    "Source Code Pro",
    "Source Sans 3",
    "Source Sans Pro",
    "Source Serif 4",
    "Source Serif Pro",
    "Spectral",
    "Tajawal",
    "Tinos",
    "Titillium Web",
    "Ubuntu",
    "Ubuntu Mono",
    "Vazirmatn",
    "Vollkorn",
    "Wix Madefor Display",
    "Wix Madefor Text",
    "Work Sans",
    "Yrsa",
    "Zilla Slab",
  ]);

  const DEFAULT_WEIGHTS = [400, 500, 600, 700];

  // Persist loaded fonts across the whole page, not just one editor instance.
  // unlike canvas/selection state, this is correct to keep as
  // a true module-level singleton (declared below, outside this function) —
  // it tracks <link> tags actually injected into document.head, a real
  // global browser resource. Two <EmailEditor> instances on one page should
  // share this, not each re-request the same font.

  const isWebSafeFont = (font: string) => WEB_SAFE_FONTS.has(font);

  const toGoogleFontParam = (font: string) => font.trim().replace(/\s+/g, "+");

  /**
   * Builds the weight parameter string for a given font.
   *
   * Fonts WITH italics use the `ital,wght` axis syntax (axes must be
   * alphabetical per the Google Fonts v2 API spec):
   * ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700
   *
   * Fonts WITHOUT italics use the simpler `wght` syntax:
   * wght@400;500;600;700
   */
  const buildWeightParam = (fontFamily: string): string => {
    if (FONTS_WITH_ITALICS.has(fontFamily)) {
      const normal = DEFAULT_WEIGHTS.map((w) => `0,${w}`);
      const italic = DEFAULT_WEIGHTS.map((w) => `1,${w}`);
      return `ital,wght@${[...normal, ...italic].join(";")}`;
    }
    return `wght@${DEFAULT_WEIGHTS.join(";")}`;
  };

  // ─── Legacy single-font loader ──────────────────────────────────────────────
  // Still exported for backwards compatibility — property-panel font previews
  // and anywhere else that loads one font at a time. New canvas code should
  // use syncFontsForTemplate() instead for batching + diffing.
  const loadGoogleFont = (fontFamily?: string) => {
    if (!fontFamily) return;
    if (isWebSafeFont(fontFamily)) return;
    if (loadedFonts.value.has(fontFamily)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${toGoogleFontParam(
      fontFamily,
    )}:${buildWeightParam(fontFamily)}&display=swap`;

    document.head.appendChild(link);
    loadedFonts.value.add(fontFamily);
  };

  // ─── URL builder for export pipeline ────────────────────────────────────────
  // Used by htmlExport / mjmlExport / reactEmailExport to embed a single
  // stylesheet URL in the exported email. Also reused below by
  // syncFontsForTemplate — the URL format is identical.
  const getGoogleFontImports = (fonts: string[]) => {
    const uniqueFonts = Array.from(new Set(fonts)).filter(
      (f) => f && !isWebSafeFont(f),
    );

    if (!uniqueFonts.length) return "";

    const params = uniqueFonts
      .map((f) => `family=${toGoogleFontParam(f)}:${buildWeightParam(f)}`)
      .join("&");

    return `https://fonts.googleapis.com/css2?${params}&display=swap`;
  };

  // ─── NEW — batched canvas loader ───────────────────────────────────────────
  /**
   * Load every font a template uses in a SINGLE network request, and only
   * request the fonts that haven't been loaded already.
   *
   * Called by useEmailBuilder's watchEffect whenever the set of fonts in the
   * template changes (load template, pick a new font, undo/redo).
   *
   * Append-only semantics: never removes an existing <link>. If a user picks
   * a new font that expands the set from {Inter} → {Inter, Lora}, we append
   * a second <link> loading just {Lora}. The existing {Inter} stylesheet is
   * untouched, so no text reflows mid-session.
   *
   * If every font in `fonts` is already loaded, this is a no-op — cheap to
   * call from a watchEffect that fires on every font-family change.
   *
   * @param fonts All font families referenced by the current template.
   * Duplicates and web-safe fonts are filtered internally.
   */
  const syncFontsForTemplate = (fonts: string[]): void => {
    if (!fonts || fonts.length === 0) return;

    // Filter to (a) truthy, (b) non-web-safe, (c) not already loaded.
    const toLoad: string[] = [];
    const seen = new Set<string>();
    for (const f of fonts) {
      if (!f) continue;
      if (seen.has(f)) continue;
      seen.add(f);
      if (isWebSafeFont(f)) continue;
      if (loadedFonts.value.has(f)) continue;
      toLoad.push(f);
    }

    if (toLoad.length === 0) return;

    // Build one combined URL for the whole delta.
    const url = getGoogleFontImports(toLoad);
    if (!url) return;

    // Inject a single <link> for the batch.
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    // Mark so we can find canvas-managed links later if needed (debugging,
    // teardown in tests, etc). Not required for correctness.
    link.dataset.canvasFonts = toLoad.join(",");
    document.head.appendChild(link);

    // Record all as loaded so subsequent syncs don't duplicate them.
    for (const f of toLoad) loadedFonts.value.add(f);
  };

  // ─── NEW — preconnect helper ───────────────────────────────────────────────
  /**
   * Open TLS connections to Google Fonts hosts in parallel with HTML parsing.
   * Call once at app startup (e.g. from app.vue onMounted).
   *
   * fonts.googleapis.com — serves the CSS
   * fonts.gstatic.com — serves the actual woff2 font files (crossorigin)
   *
   * Idempotent: checks document.head for existing preconnect tags and bails
   * if they're already present.
   */
  const preconnectGoogleFonts = (): void => {
    if (typeof document === "undefined") return;

    const ensurePreconnect = (href: string, crossorigin = false): void => {
      const selector = `link[rel="preconnect"][href="${href}"]`;
      if (document.head.querySelector(selector)) return;

      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = href;
      if (crossorigin) link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    };

    ensurePreconnect("https://fonts.googleapis.com");
    // gstatic MUST be crossorigin — fonts are fetched with CORS. Without this
    // attribute the preconnect hint is ignored by the browser for the actual
    // font fetch and you get zero benefit.
    ensurePreconnect("https://fonts.gstatic.com", true);
  };

  return {
    googleFonts,
    loadGoogleFont,
    getGoogleFontImports,
    syncFontsForTemplate,
    preconnectGoogleFonts,
    isWebSafeFont,
    WEB_SAFE_FONTS,
    FONTS_WITH_ITALICS,
    DEFAULT_WEIGHTS,
  };
};
