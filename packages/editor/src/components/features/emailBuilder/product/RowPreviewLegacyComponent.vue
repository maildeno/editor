<template>
  <!-- ── Heading ──────────────────────────────────────────────────────────── -->
  <component
    :is="comp.props?.level || 'h2'"
    v-if="compType === 'heading'"
    :style="headingStyle(comp.props)"
    class="truncate"
    v-html="resolvePreviewHtml(comp.props?.content) || 'Heading'"
  />

  <!-- ── Paragraph ────────────────────────────────────────────────────────── -->
  <p
    v-else-if="compType === 'paragraph'"
    :style="paragraphStyle(comp.props)"
    class="overflow-hidden"
    style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"
    v-html="resolvePreviewHtml(comp.props?.content) || 'Text'"
  />

  <!-- ── Image ────────────────────────────────────────────────────────────── -->
  <div v-else-if="compType === 'image'" :style="imageContainerStyle(comp.props)">
    <img
      :src="comp.props?.src"
      :alt="comp.props?.alt || ''"
      :style="imageStyle(comp.props)"
    />
  </div>

  <!-- ── Video ────────────────────────────────────────────────────────────── -->
  <div v-else-if="compType === 'video'" :style="videoContainerStyle(comp.props)">
    <div :style="videoThumbnailStyle(comp.props)">
      <img
        v-if="comp.props?.coverImage"
        :src="comp.props.coverImage"
        :alt="comp.props?.alt || 'Video'"
        :style="videoImageStyle()"
      />
      <div v-else :style="videoPlaceholderStyle()">
        <svg style="width: 30%; height: 30%; color: #9ca3af" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
  </div>

  <!-- ── Button ───────────────────────────────────────────────────────────── -->
<div v-else-if="compType === 'button'" :style="buttonContainerStyle(comp.props)">
  <span :style="buttonStyle(comp.props)" class="inline-block truncate">
    <!-- Icon before text -->
    <img
      v-if="comp.props?.icon && comp.props?.iconPosition !== 'after'"
      :src="comp.props.icon"
      :alt="comp.props?.iconAlt || ''"
      :style="buttonIconStyle(comp.props)"
      @error="onIconError"
    />
    {{ comp.props?.text || "Button" }}
    <!-- Icon after text -->
    <img
      v-if="comp.props?.icon && comp.props?.iconPosition === 'after'"
      :src="comp.props.icon"
      :alt="comp.props?.iconAlt || ''"
      :style="buttonIconStyle(comp.props)"
      @error="onIconError"
    />
  </span>
</div>

  <!-- ── Anchor ───────────────────────────────────────────────────────────── -->
  <div v-else-if="compType === 'anchor'" :style="anchorContainerStyle(comp.props)">
    <span :style="anchorStyle(comp.props)" class="truncate block">
      {{ comp.props?.text || "Link" }}
    </span>
  </div>

  <!-- ── List ─────────────────────────────────────────────────────────────── -->
  <div
    v-else-if="compType === 'list'"
    :style="listWrapStyle(comp.props)"
    v-html="resolvePreviewHtml(comp.props?.content) || '<ul><li>Item</li></ul>'"
  />

  <!-- ── Divider ───────────────────────────────────────────────────────────── -->
  <div v-else-if="compType === 'divider'" :style="dividerContainerStyle(comp.props)">
    <hr :style="dividerStyle(comp.props)" />
  </div>

  <!-- ── Spacer (inline component, not row-spacer) ─────────────────────────── -->
  <div v-else-if="compType === 'spacer'">
    <div :style="spacerStyle(comp.props)" />
  </div>

  <!-- ── Menu ─────────────────────────────────────────────────────────────── -->
  <div v-else-if="compType === 'menu'" :style="menuContainerStyle(comp.props)">
    <div
      v-if="!comp.props?.items?.some((i: any) => i.enabled && i.label)"
      
    >
      Menu
    </div>
    <template v-else>
      <span
        v-for="(item, idx) in comp.props.items.filter((i: any) => i.enabled && i.label)"
        :key="item._id || idx"
        :style="menuItemStyle(comp.props, Number(idx), comp.props.items.filter((i: any) => i.enabled && i.label).length)"
      >
        {{ item.label }}
      </span>
    </template>
  </div>

  <!-- ── Socials ───────────────────────────────────────────────────────────── -->
  <div v-else-if="compType === 'socials'" :style="socialsContainerStyle(comp.props)">
    <template v-if="comp.props?.platforms?.some((p: any) => p.enabled && p.link)">
      <span
        v-for="platform in comp.props.platforms.filter((p: any) => p.enabled && p.link)"
        :key="platform.name"
        :style="{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }"
      >
        <img
          :src="platform.icon"
          :alt="platform.name"
          :style="{
            width: (comp.props?.iconSize || 24) + 'px',
            height: (comp.props?.iconSize || 24) + 'px',
            display: 'block',
          }"
        />
      </span>
    </template>
    <span v-else style="font-size: 7px; color: #9ca3af; font-style: italic">Socials</span>
  </div>

  <!-- ── Unknown fallback ─────────────────────────────────────────────────── -->
  <div
    v-else
    class="rounded truncate"
    style="font-size: 7px; color: #9ca3af; background: #f3f4f6; padding: 1px 3px;"
  >
    {{ compType }}
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /**
   * The component node to render.
   * Accepts both new-shape (type:'component', componentType:'paragraph')
   * and legacy-shape (type:'paragraph') nodes.
   * The caller should already have normalised `type` to the componentType
   * value when passing new-shape nodes.
   */
  comp: Record<string, any>;
  scale?: number;
}>();

// ── Resolve render variant ────────────────────────────────────────────────────
// New shape: { type: 'component', componentType: 'paragraph' }
// Legacy shape: { type: 'paragraph' }

const compType = computed(
  () => props.comp.componentType ?? props.comp.type,
);

// ── HTML preview helper ───────────────────────────────────────────────────────

function resolvePreviewHtml(html: string): string {
  if (!html) return "";
  return html.replace(
    /<span[^>]*\bdata-merge="([^"]+)"(?:[^>]*\bdata-merge-default="([^"]*)")?[^>]*>.*?<\/span>/gs,
    (_, name, fallback) => {
      const tag = name.trim();
      const def = fallback?.trim();
      return def ? `{{ ${tag}|'${def}' }}` : `{{ ${tag} }}`;
    },
  );
}

// ── Background helper ─────────────────────────────────────────────────────────

function resolveBackground(item: any): string {
  const bg = item?.backgroundGradient;
  const hasGradient =
    bg?.useGradient === true &&
    Array.isArray(bg?.gradient?.colors) &&
    bg.gradient.colors.length >= 2;

  if (hasGradient) {
    const { type, direction, colors } = bg.gradient;
    const stops = colors.map((c: any) => `${c.color} ${c.position}%`).join(", ");
    return type === "radial"
      ? `radial-gradient(circle at center, ${stops})`
      : `linear-gradient(${direction}, ${stops})`;
  }

  return item?.backgroundColor || "transparent";
}

// ── Google font loader ────────────────────────────────────────────────────────

function loadGoogleFont(fontFamily?: string) {
  if (!fontFamily) return;
  const knownGoogleFonts = [
    "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
    "Nunito", "Raleway", "Plus Jakarta Sans",
  ];
  const isGoogle =
    fontFamily.includes(" ") ||
    knownGoogleFonts.some((f) => fontFamily.includes(f));
  if (isGoogle && typeof document !== "undefined") {
    const formatted = fontFamily.replace(/ /g, "+");
    const href = `https://fonts.googleapis.com/css2?family=${formatted}:wght@300;400;500;600;700;800&display=swap`;
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link");
      link.href = href;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }
}

// ── Style helpers (mirrors RowPreview.vue) ────────────────────────────────────

function headingStyle(p: any) {
  if (p?.fontFamily) loadGoogleFont(p.fontFamily);
  return {
    fontSize: Math.max(7, p?.fontSize || 24) + "px",
    color: p?.color || "#111111",
    fontWeight: p?.fontWeight || "bold",
    fontFamily: p?.fontFamily || "Arial, sans-serif",
    textAlign: p?.align || "left",
    lineHeight: String(p?.lineHeight ?? 1.2),
    letterSpacing: `${p?.letterSpacing ?? 0}px`,
    textTransform: p?.textTransform || "none",
    textDecoration: p?.textDecoration || "none",
    background: resolveBackground(p),
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 4}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
  };
}

function paragraphStyle(p: any) {
  if (p?.fontFamily) loadGoogleFont(p.fontFamily);
  return {
    fontSize: Math.max(6, p?.fontSize || 16) + "px",
    color: p?.color || "#111111",
    fontFamily: p?.fontFamily || "Arial, sans-serif",
    fontWeight: p?.fontWeight || "normal",
    fontStyle: p?.fontStyle || "normal",
    textAlign: p?.align || "left",
    lineHeight: String(p?.lineHeight ?? 1.5),
    letterSpacing: `${p?.letterSpacing ?? 0}px`,
    textTransform: p?.textTransform || "none",
    textDecoration: p?.textDecoration || "none",
    background: resolveBackground(p),
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 4}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
  };
}

function imageContainerStyle(p: any) {
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 0}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
    textAlign: p?.align || "left",
  };
}

function imageStyle(p: any) {
  const align = p?.align || "left";
  return {
    width: (p?.width || 100) + "%",
    height: p?.height || "auto",
    borderRadius: (p?.borderRadius || 0) + "px",
    border: `${p?.border?.width || 0}px ${p?.border?.style || "solid"} ${p?.border?.color || "#000000"}`,
    display: "block",
    margin: align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0",
  };
}

function videoContainerStyle(p: any) {
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 0}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
    textAlign: p?.align || "left",
    maxWidth: "100%",
  };
}

function videoThumbnailStyle(p: any): CSSProperties {
  const align = p?.align || "left";
  return {
    width: "100%",
    maxWidth: "100%",
    paddingBottom: "56.25%",
    height: "0",
    position: "relative",
    display: "inline-block",
    borderRadius: (p?.borderRadius || 0) + "px",
    border: `${p?.border?.width || 0}px ${p?.border?.style || "solid"} ${p?.border?.color || "#000000"}`,
    overflow: "hidden",
    marginLeft: align === "center" ? "auto" : align === "right" ? "auto" : "0",
    marginRight: align === "center" ? "auto" : "0",
    boxSizing: "border-box",
  };
}

function videoImageStyle(): CSSProperties {
  return { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", objectFit: "cover", display: "block" };
}

function videoPlaceholderStyle(): CSSProperties {
  return { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" };
}

function buttonContainerStyle(p: any) {
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 4}px ${p?.margin?.left ?? 0}px`,
    textAlign: p?.align || "center",
  };
}

function buttonStyle(p: any) {
  if (p?.fontFamily) loadGoogleFont(p.fontFamily);
  const hasIcon = !!p?.icon;
  return {
    background: resolveBackground(p),
    color: p?.color || "#ffffff",
    fontSize: Math.max(5, p?.fontSize || 16) + "px",
    fontWeight: p?.fontWeight || "500",
    fontFamily: p?.fontFamily || "Arial, sans-serif",
    letterSpacing: `${p?.letterSpacing ?? 0}px`,
    padding: `${p?.padding?.top ?? 8}px ${p?.padding?.right ?? 16}px ${p?.padding?.bottom ?? 8}px ${p?.padding?.left ?? 16}px`,
    borderRadius: (p?.borderRadius || 4) + "px",
    border: `${p?.border?.width || 0}px ${p?.border?.style || "solid"} ${p?.border?.color || "#000000"}`,
    // Icon branch uses inline-flex so icon + text align cleanly on one row.
    // Plain branch stays inline-block (unchanged behaviour).
    ...(hasIcon
      ? { display: "inline-flex", alignItems: "center", verticalAlign: "middle" }
      : { display: "inline-block" }),
    lineHeight: "1.2",
    textDecoration: "none",
  };
}

// Icon sizing — scaled down slightly so 20px (canvas default) still fits
// comfortably in the truncated preview row. Gap is margin on the image.
function buttonIconStyle(p: any) {
  const size = Math.max(4, (p?.iconSize ?? 20));
  const gap = p?.iconGap ?? 8;
  const isBefore = p?.iconPosition !== "after";
  return {
    display: "block",
    width: size + "px",
    height: size + "px",
    flexShrink: "0",
    marginRight: isBefore ? gap + "px" : "0",
    marginLeft: isBefore ? "0" : gap + "px",
  };
}

// Hide the icon if its URL fails to load — previews should degrade
// gracefully to text-only rather than showing a broken image glyph.
function onIconError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.style.display = "none";
}

function anchorContainerStyle(p: any) {
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 4}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
    textAlign: p?.align || "left",
  };
}

function anchorStyle(p: any) {
  if (p?.fontFamily) loadGoogleFont(p.fontFamily);
  return {
    color: p?.color || "#007bff",
    fontSize: Math.max(6, p?.fontSize || 16) + "px",
    fontWeight: p?.fontWeight || "normal",
    fontFamily: p?.fontFamily || "Arial, sans-serif",
    letterSpacing: `${p?.letterSpacing ?? 0}px`,
    textDecoration: p?.textDecoration || "underline",
  };
}

function listWrapStyle(p: any) {
  if (p?.fontFamily) loadGoogleFont(p.fontFamily);
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 0}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 16}px`,
    fontSize: Math.max(6, p?.fontSize || 16) + "px",
    fontFamily: p?.fontFamily || "Arial, sans-serif",
    lineHeight: String(p?.lineHeight ?? 1.5),
    letterSpacing: `${p?.letterSpacing ?? 0}px`,
    color: p?.color || "#111111",
    background: resolveBackground(p),
  };
}

function dividerContainerStyle(p: any) {
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 0}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
    textAlign: p?.align || "left",
  };
}

function dividerStyle(p: any) {
  const align = p?.align || "left";
  return {
    width: (p?.width || 100) + "%",
    height: (p?.height || 1) + "px",
    background: resolveBackground(p),
    border: "none",
    margin: align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0",
  };
}

function spacerStyle(p: any) {
  return { width: "100%", height: (p?.height || 16) + "px", background: resolveBackground(p) };
}

function menuContainerStyle(p: any) {
  if (p?.fontFamily) loadGoogleFont(p.fontFamily);
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 0}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
    textAlign: p?.align || "left",
    lineHeight: "0",
    background: resolveBackground(p),
  };
}

function menuItemStyle(p: any, index: number, total: number) {
  if (p?.fontFamily) loadGoogleFont(p.fontFamily);
  const isStacked = p?.mobileStack === true;
  const spacing = p?.spacing ?? 8;

  const isFirst = index === 0;
  const isLast = index === total - 1

  return {
     // display is always block, used for showcase
    display: "inline-block",
    marginLeft: isFirst ? "0px" : `${spacing / 2}px`,
    marginRight: isLast ? "0px" : `${spacing / 2}px`,
    // marginBottom: isStacked && !isLast ? `${spacing}px` : "0",
    fontSize: Math.max(6, p?.fontSize ?? 14) + "px",
    lineHeight: String(p?.lineHeight ?? 1.4),
    letterSpacing: (p?.letterSpacing ?? 0) + "px",
    color: p?.color || "#111111",
    fontWeight: p?.fontWeight || "normal",
    fontFamily: p?.fontFamily
      ? `'${p.fontFamily}', Arial, sans-serif`
      : "Arial, sans-serif",
    fontStyle: p?.fontStyle || "normal",
    textTransform: (p?.textTransform || "none") as string,
    textDecoration: p?.textDecoration || "none",
    whiteSpace: isStacked ? "normal" : "nowrap",
    cursor: "default",
  };
}

function socialsContainerStyle(p: any): CSSProperties {
  return {
    margin: `${p?.margin?.top ?? 0}px ${p?.margin?.right ?? 0}px ${p?.margin?.bottom ?? 0}px ${p?.margin?.left ?? 0}px`,
    padding: `${p?.padding?.top ?? 0}px ${p?.padding?.right ?? 0}px ${p?.padding?.bottom ?? 0}px ${p?.padding?.left ?? 0}px`,
    textAlign: p?.align || "left",
    display: "flex",
    flexWrap: "wrap",
    gap: (p?.spacing ?? 8) + "px",
    justifyContent:
      p?.align === "center" ? "center" : p?.align === "right" ? "flex-end" : "flex-start",
  };
}
</script>
