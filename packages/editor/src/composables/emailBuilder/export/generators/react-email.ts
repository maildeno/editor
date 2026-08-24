import {
  safeUrl,
  escapeAttr,
  escapeHtml,
  normalizeRichTextContent,
} from "../helpers/generatorHelpers";
import { getBlock } from "@/blocks/registry";

// generators/reactEmailGenerator.ts
// Generates React Email JSX string output for each component type.
// Mirrors HTMLGenerator structure so mobile/media-query
// overrides from useEmailBuilderMobileCSS are applied consistently.

// ─── Normalizers ──────────────────────────────────────────────────────────────
//
// These run on every style string / attribute value before it is emitted.
// They fix three classes of HTML-in-email authoring mistakes:
//
//   1. Self-closing <br> tags must be <br /> in JSX / React Email.
//   2. font-family values that wrap font names in quotes must have those
//      quotes stripped so the CSS is valid and predictable across clients.
//      e.g.  font-family: "'Roboto', Arial"  →  font-family: "Roboto, Arial"
//   3. Rich-text editor HTML emits inline styles as HTML attribute strings
//      (`style="color: rgb(87, 84, 78)"`), which are invalid in JSX.
//      normalizeInlineStylesToReact rewrites them to React object syntax
//      (`style={{ color: "rgb(87, 84, 78)" }}`), also camelCasing properties
//      and applying all other value normalizations in the process.

/**
 * Normalize self-closing `<br>` to `<br />` for JSX compatibility.
 * Handles: <br>, <br/>, <br  /> → all become <br />
 */
export const normalizeBrTags = (html: string): string => {
  return html.replace(/<br\s*\/?>/gi, "<br />");
};

/**
 * Normalize font-family CSS values by stripping wrapping single quotes
 * from individual font names.
 *
 * Examples:
 *   "'Roboto', Arial"           → "Roboto, Arial"
 *   "'Open Sans', 'Helvetica'"  → "Open Sans, Helvetica"
 *   "Arial, sans-serif"         → "Arial, sans-serif"  (unchanged)
 *
 * The pattern targets a single quote that either:
 *   - immediately follows a colon+optional-space (start of value), OR
 *   - immediately follows a comma+optional-space (subsequent font name)
 *   - immediately precedes a comma, OR
 *   - is the last character before the end of the string / semicolon
 */
export const normalizeFontFamily = (value: string): string => {
  // Remove single-quotes wrapping each font name token in a font-family string.
  // Strategy: split on comma, strip surrounding whitespace and quotes per token,
  // then rejoin — this is safer than regex on the full string.
  return value
    .split(",")
    .map((token) =>
      token
        .trim()
        .replace(/^'+|'+$/g, "")
        .trim(),
    )
    .join(", ");
};

/**
 * Apply all normalizations to a raw CSS string or inline style value.
 * Call this on any style attribute value before writing it to JSX output.
 *
 * Currently applies:
 *   - normalizeFontFamily  (strips wrapping quotes from font-family tokens)
 *
 * Note: normalizeBrTags is applied on the final HTML string, not per-style.
 */
export const normalizeStyleValue = (style: string): string => {
  // Normalize font-family declarations anywhere in the style string
  return style.replace(
    /font-family\s*:\s*([^;]+)/gi,
    (_, value) => `font-family:${normalizeFontFamily(value)}`,
  );
};

/**
 * Convert a kebab-case CSS property name to camelCase.
 *
 * Examples:
 *   "font-size"        → "fontSize"
 *   "background-color" → "backgroundColor"
 *   "color"            → "color"  (unchanged)
 */
const cssPropToCamel = (prop: string): string =>
  prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Convert a single CSS declaration string into a JSX style object literal
 * string fragment ready to be placed inside `style={{ ... }}`.
 *
 * Example:
 *   "color: rgb(87, 84, 78); font-size: 14px"
 *   → `color: "rgb(87, 84, 78)", fontSize: "14px"`
 */
const cssStringToStyleObjectLiteral = (css: string): string =>
  css
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const colon = decl.indexOf(":");
      if (colon < 0) return null;
      const prop = decl.slice(0, colon).trim();
      const rawValue = decl.slice(colon + 1).trim();
      // Apply property-specific value normalization before camelCasing the key.
      // font-family needs quote-stripping applied directly to the value token
      // (normalizeStyleValue expects a full "prop: value" string and won't match
      // when only the value portion is passed in).
      const value =
        prop.toLowerCase() === "font-family"
          ? normalizeFontFamily(rawValue)
          : normalizeStyleValue(rawValue);
      return `${cssPropToCamel(prop)}: "${value}"`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(", ");

/**
 * Normalize HTML attributes from rich-text editor format to JSX format.
 *
 * Converts React-incompatible attributes to their JSX equivalents:
 *   - contenteditable → contentEditable (camelCase for React)
 *
 * The 'name' attribute is left unchanged as it's commonly used by ESPs
 * for merge tag identification, and React warnings about unknown props
 * are safe to ignore in email contexts.
 *
 * @param html Raw HTML string from rich-text editor
 * @returns HTML string with attributes normalized for JSX compatibility
 *
 * @example
 * normalizeAttributesToReact('<span name="email" contenteditable="false">{{ email }}</span>')
 * // → '<span name="email" contentEditable="inherit" or contentEditable={false}>{{ email }}</span>'
 */
const normalizeAttributesToReact = (html: string): string => {
  // Convert contenteditable to contentEditable (case-sensitive in React).
  // Boolean values (true/false) are emitted as JSX expression syntax {true}/{false}
  // rather than string literals, which is the idiomatic React form and avoids
  // the React warning about receiving a string for a boolean prop.
  // Handles: contenteditable="false", contenteditable='false', contenteditable=false
  return html.replace(
    /\bcontenteditable\s*=\s*(["']?)([^"'\s>]+)\1/gi,
    (_, _quote, value) => {
      const lower = value.toLowerCase();
      if (lower === "true" || lower === "false") {
        return `contentEditable={${lower}}`;
      }
      // Non-boolean values (e.g. "inherit") fall back to a quoted string.
      return `contentEditable="${value}"`;
    },
  );
};

/**
 * Normalize all HTML inline `style="..."` attributes inside a rich-text HTML
 * string to JSX `style={{ ... }}` object syntax.
 *
 * This is required because content from the rich-text editor is emitted with
 * plain HTML style strings (e.g. `<span style="color: rgb(87, 84, 78);">`),
 * which are invalid in JSX. This normalizer rewrites every such attribute to
 * the React object form (e.g. `<span style={{ color: "rgb(87, 84, 78)" }}`).
 *
 * Additionally applies:
 *   - normalizeBrTags  — <br> → <br />
 *   - normalizeAttributesToReact — converts React-incompatible attributes
 *   - normalizeStyleValue per declaration (font-family quote stripping, etc.)
 *
 * Safe to call on strings that have already been br-normalized or that contain
 * no inline style attributes — both cases are handled without mutation.
 *
 * @param html  Raw HTML string from the rich-text editor
 * @returns     HTML string with all style attributes rewritten for JSX
 *
 * @example
 * normalizeInlineStylesToReact(
 *   '<span style="color: rgb(87, 84, 78); font-size: 14px;">Hello</span>'
 * )
 * // → '<span style={{ color: "rgb(87, 84, 78)", fontSize: "14px" }}>Hello</span>'
 */
export const normalizeInlineStylesToReact = (html: string): string => {
  // Decode &quot; inside style="..." attributes to single quotes BEFORE any
  // other processing. The editor emits inline font overrides like
  //   <span style="font-family: &quot;Comic Sans MS&quot;">
  // and the embedded `;` inside `&quot;` would otherwise break the
  // semicolon-split in cssStringToStyleObjectLiteral below, yielding
  // `fontFamily: "&quot"` instead of `fontFamily: "Comic Sans MS"`.
  let result = normalizeRichTextContent(html);

  // First normalize <br> tags for JSX compatibility
  result = normalizeBrTags(result);

  // Normalize React-incompatible attributes
  result = normalizeAttributesToReact(result);

  // Replace every style="..." with style={{ ... }}
  // The regex captures the full attribute value between the outermost quotes,
  // including values that contain rgb(...) commas — hence the lazy [^"]* match.
  result = result.replace(/\bstyle="([^"]*)"/g, (_, cssString: string) => {
    const objectLiteral = cssStringToStyleObjectLiteral(cssString);
    // Preserve empty style attributes as style={{}} rather than omitting them
    return `style={{ ${objectLiteral} }}`;
  });

  return result;
};

// ─── React Email generator ────────────────────────────────────────────────────

export const reactEmailGenerator = () => {
  // ─── Shared gradient resolver (mirrors HTMLGenerator) ─────────────────────
  const resolveBgCss = (bgGradient: any, bgColorFallback: string): string => {
    const hasGradient =
      bgGradient?.useGradient === true &&
      Array.isArray(bgGradient?.gradient?.colors) &&
      bgGradient.gradient.colors.length >= 2;

    if (!hasGradient) {
      const solid =
        bgGradient && typeof bgGradient === "object" && bgGradient.solid
          ? bgGradient.solid
          : bgColorFallback;
      if (!solid || solid === "transparent") return "";
      return `background-color:${solid};`;
    }

    const { type, direction, colors } = bgGradient.gradient;
    const stops = colors
      .map((c: any) => `${c.color} ${c.position}%`)
      .join(", ");
    const gradientCss =
      type === "radial"
        ? `radial-gradient(circle at center, ${stops})`
        : `linear-gradient(${direction}, ${stops})`;

    const solid = bgGradient.solid || bgColorFallback || "";
    const solidDecl =
      solid && solid !== "transparent" ? `background-color:${solid};` : "";
    return `${solidDecl}background:${gradientCss};`;
  };

  // ─── Main generator ────────────────────────────────────────────────────────
  // Returns a JSX string compatible with React Email components.
  // Structure mirrors generateComponentHTML so that mobile CSS overrides
  // (generated by useEmailBuilderMobileCSS via the same uid / class names)
  // target the correct elements in both HTML and React Email output.

  const generateReactEmailComponent = (comp: any): string => {
    // ── CRITICAL: resolve render variant — new shape uses componentType,
    // legacy shape uses type directly. Both must produce the same output.
    const type = comp.componentType ?? comp.type;
    const { props } = comp;
    let jsx = "";

    // uid and class naming must match HTMLGenerator so that
    // useEmailBuilderMobileCSS media-query overrides apply correctly.
    const uid = `eb-${comp.id}`;

    // These two aren't used by react-email's own cases (which call
    // parseMarginPaddingDiscrete directly on raw props instead), but are
    // computed here for BlockRenderContext parity with html.ts/mjml.ts.
    const marginStyle = props.margin
      ? `margin:${props.margin?.top ?? 0}px ${props.margin?.right ?? 0}px ${props.margin?.bottom ?? 0}px ${props.margin?.left ?? 0}px;`
      : "";
    const paddingStyle = props.padding
      ? `padding:${props.padding?.top ?? 0}px ${props.padding?.right ?? 0}px ${props.padding?.bottom ?? 0}px ${props.padding?.left ?? 0}px;`
      : "";
    const resolveBgVml = (
      bgGradient: any,
      bgColorFallback: string,
    ): { vmlOpen: string; vmlClose: string } => {
      const hasGradient =
        bgGradient?.useGradient === true &&
        Array.isArray(bgGradient?.gradient?.colors) &&
        bgGradient.gradient.colors.length >= 2;
      if (!hasGradient) return { vmlOpen: "", vmlClose: "" };
      return { vmlOpen: "", vmlClose: "" }; // React Email output has no VML concept
    };

    // Class list builder — identical logic to HTMLGenerator so that the
    // mobile CSS class names in the <style> block match the JSX output.
    const getResponsiveClasses = (
      desktopHide?: boolean,
      mobileHide?: boolean,
      suffix?: string,
    ): string => {
      const baseClass = suffix ? `${uid}-${suffix}` : uid;
      const classes = [baseClass];
      if (desktopHide) classes.push("desktop-hide");
      if (mobileHide) classes.push("mobile-hide");
      return classes.join(" ");
    };

    // ── Registry check ───────────────────────────────────────────────────────
    const registeredBlock = getBlock(type);
    if (registeredBlock) {
      return registeredBlock.renderEmail.reactEmail(props, {
        uid,
        marginStyle,
        paddingStyle,
        escapeHtml,
        escapeAttr,
        safeUrl,
        resolveBgCss,
        resolveBgVml,
        getResponsiveClasses,
        react: {
          parseCssString,
          parseMarginPaddingDiscrete,
          normalizeFontFamily,
          styleObj,
          normalizeInlineStylesToReact,
          buildInlineJsx,
        },
      });
    }

    switch (type) {
      // All 11 built-in types now route through the registry check above.
      // This switch is the fallback for a genuinely unregistered type —
      // currently empty, so an unknown type renders as an empty string
      // rather than throwing.
    }

    return jsx;
  };

  return { generateReactEmailComponent };
};

// ─── JSX style object helpers ─────────────────────────────────────────────────
//
// These are module-level pure functions, not exported as part of the composable.
// They convert the CSS string patterns used by HTMLGenerator into the React
// inline style object format required by React Email.

/**
 * Convert a flat CSS string ("color:red;font-size:14px") into a style record.
 * Handles standard `property:value` pairs separated by semicolons.
 * All values are stored as strings so styleObj always quotes them correctly.
 */
function parseCssString(css: string): Record<string, string> {
  const result: Record<string, string> = {};
  css
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .forEach((decl) => {
      const colon = decl.indexOf(":");
      if (colon < 0) return;
      const prop = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).trim();
      const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      result[camel] = normalizeStyleValue(value);
    });
  return result;
}

/**
 * Expand margin and padding objects into discrete side properties.
 * Uses marginTop/marginRight/... instead of the shorthand so React Email
 * can override individual sides via media-query mobile CSS without specificity
 * conflicts. Matches the pattern used in the reference output.
 */
function parseMarginPaddingDiscrete(
  margin?: any,
  padding?: any,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (margin) {
    result.marginTop = `${margin?.top ?? 0}px`;
    result.marginRight = `${margin?.right ?? 0}px`;
    result.marginBottom = `${margin?.bottom ?? 0}px`;
    result.marginLeft = `${margin?.left ?? 0}px`;
  }
  if (padding) {
    result.paddingTop = `${padding?.top ?? 0}px`;
    result.paddingRight = `${padding?.right ?? 0}px`;
    result.paddingBottom = `${padding?.bottom ?? 0}px`;
    result.paddingLeft = `${padding?.left ?? 0}px`;
  }
  return result;
}

/**
 * Serialize a style record into a JSX inline style object literal string.
 *
 * ALL values are quoted as strings — this matches React Email's expectation
 * and the reference output format (fontWeight: "normal", fontWeight: "bold",
 * fontWeight: "500" etc.). The CSS type system accepts string values for all
 * of these properties.
 */
function styleObj(obj: Record<string, any>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: "${v}"`)
    .join(", ");
}

/**
 * Build a JSX element for inline-content components (Text, Heading).
 *
 * Content from the rich-text editor is placed as JSX children directly —
 * no dangerouslySetInnerHTML. The content string may contain inline HTML
 * tags (<strong>, <em>, <br />, <a>, etc.) which React Email handles
 * correctly as JSX children when rendered as a string template.
 *
 * @param component  React Email component name: "Text" | "Heading"
 * @param className  Space-separated class string (uid + responsive classes)
 * @param styleRecord  Flat style record — all values serialized as strings
 * @param children   Inner content string (already br-normalized)
 * @param as         For Heading: the HTML tag level ("h1"–"h6")
 */
function buildInlineJsx(
  component: "Text" | "Heading",
  className: string,
  styleRecord: Record<string, any>,
  children: string,
  as?: string,
): string {
  const asProp = as ? `\n  as="${as}"` : "";
  return `<${component}${asProp}
  className="${className}"
  style={{ ${styleObj(styleRecord)} }}
>
  ${children}
</${component}>\n`;
}
