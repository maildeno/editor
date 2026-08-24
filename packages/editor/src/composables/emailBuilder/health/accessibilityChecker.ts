// composables/emailBuilder/health/accessibilityChecker.ts
//
// ── Accessibility Checker (WCAG 2.1 AA aligned) ─────────────────────────────
// Walks the same row/column/component tree used by healthIndicator and produces
// a flat list of AccessibilityIssue objects.
//
// Rules are grouped by severity:
//   • critical — blocks assistive tech entirely (missing alt, empty links,
//                missing language, contrast failures on body text)
//   • serious  — significantly degrades UX for AT users (decorative img alt,
//                vague link text, heading hierarchy, small fonts, etc.)
//
// Each rule maps to a WCAG success criterion so the messaging is honest and
// actionable. Ignored issue IDs are persisted to localStorage so suppressions
// survive reloads — the same pattern axe-core / ESLint / Stylelint use.
//
// ── Merge tag awareness ─────────────────────────────────────────────────────
// Text fields may contain merge tags like `{{ first_name }}` or
// `{{ name|'Friend' }}` (with pipe-default). When preview is active, the
// checker resolves these via the same resolveString helper used by renderers,
// so length/vague/empty checks reflect what AT users will actually hear.
// We also flag merge-tag-specific risks (e.g. unguarded tag in image alt).

import { computed, ref, type Ref } from "vue";
import {
  resolveString,
  extractMergeTags,
  extractMergeTagsWithDefaults,
} from "@/composables/emailBuilder/core/merge-tags/mergeTagDefinitions";

// ── Types ───────────────────────────────────────────────────────────────────

export type Severity = "critical" | "serious";
export type IssueStatus = "failed" | "passed" | "ignored";

export interface AccessibilityIssue {
  /** Stable ID — `${ruleId}:${componentId}` so suppressions persist across runs. */
  id: string;
  ruleId: string;
  severity: Severity;
  status: IssueStatus;
  /** Short rule name, e.g. "Image missing alt text". */
  rule: string;
  /** One-line, user-facing description of what's wrong (or what passed). */
  message: string;
  /** Why it matters — WCAG reference + practical impact. */
  info: string;
  /** Component / row reference for future deep-linking. */
  componentRef?: {
    type: string;
    id?: string;
  };
}

export interface AccessibilitySummary {
  failed: AccessibilityIssue[];
  passed: AccessibilityIssue[];
  ignored: AccessibilityIssue[];
  failedCount: number;
  passedCount: number;
  ignoredCount: number;
  criticalCount: number;
  seriousCount: number;
  /** Overall status mirrors healthIndicator's good/warn/bad vocabulary. */
  status: "good" | "warn" | "bad";
  /** Short headline message for the card summary row. */
  summaryMessage: string;
}

// ── Rule catalog ────────────────────────────────────────────────────────────
// Centralizing rule metadata keeps messaging consistent and makes it easy to
// add new rules later without touching the walker.

interface RuleMeta {
  id: string;
  name: string;
  severity: Severity;
  /** WCAG criterion + practical reason. */
  info: string;
}

const RULES: Record<string, RuleMeta> = {
  IMG_ALT_MISSING: {
    id: "IMG_ALT_MISSING",
    name: "Image missing alt text",
    severity: "critical",
    info: "WCAG 1.1.1 (Level A). Screen readers announce the file name when alt is absent, which is meaningless to recipients using assistive tech.",
  },
  IMG_ALT_DECORATIVE: {
    id: "IMG_ALT_DECORATIVE",
    name: "Decorative image should use empty alt",
    severity: "serious",
    info: 'WCAG 1.1.1. Purely decorative images should have alt="" so screen readers skip them rather than announce a filename.',
  },
  IMG_ALT_REDUNDANT: {
    id: "IMG_ALT_REDUNDANT",
    name: "Alt text starts with redundant phrasing",
    severity: "serious",
    info: 'Phrases like "image of" or "picture of" are added by the screen reader automatically — including them causes duplicated announcements.',
  },
  LINK_EMPTY: {
    id: "LINK_EMPTY",
    name: "Link has no accessible text",
    severity: "critical",
    info: 'WCAG 2.4.4 (Level A). A link with no readable label is announced as "link" with no destination, leaving AT users unable to act on it.',
  },
  LINK_VAGUE: {
    id: "LINK_VAGUE",
    name: "Link text is not descriptive",
    severity: "serious",
    info: 'WCAG 2.4.4. Phrases like "click here" or "read more" lose meaning when read out of context — screen readers often list links separately.',
  },
  LINK_NO_HREF: {
    id: "LINK_NO_HREF",
    name: "Link is missing a destination URL",
    severity: "critical",
    info: "WCAG 2.4.4. A link without href is not focusable or actionable for keyboard / AT users.",
  },
  LINK_DUPLICATE_TEXT_DIFFERENT_URL: {
    id: "LINK_DUPLICATE_TEXT_DIFFERENT_URL",
    name: "Same link text points to different URLs",
    severity: "serious",
    info: "WCAG 2.4.4. Repeated link text should identify the destination. When the same link text (ignoring case and trailing punctuation) points to different URLs, screen reader users navigating a link list may not be able to distinguish the destinations.",
  },
  BUTTON_EMPTY: {
    id: "BUTTON_EMPTY",
    name: "Button has no accessible label",
    severity: "critical",
    info: "WCAG 4.1.2 (Level A). Interactive elements must expose a name to assistive technology.",
  },
  BUTTON_ICON_NO_ALT: {
    id: "BUTTON_ICON_NO_ALT",
    name: "Icon missing alt text",
    severity: "serious",
    info: "WCAG 1.1.1. When a clickable element's icon adds meaning, its alt becomes part of the element's accessible name. Leave alt empty only if the icon is purely decorative.",
  },
  CONTRAST_FAIL_NORMAL: {
    id: "CONTRAST_FAIL_NORMAL",
    name: "Text contrast below 4.5:1",
    severity: "critical",
    info: "WCAG 1.4.3 (Level AA). Normal text needs at least 4.5:1 contrast against its background to be readable for users with low vision.",
  },
  CONTRAST_FAIL_LARGE: {
    id: "CONTRAST_FAIL_LARGE",
    name: "Large text contrast below 3:1",
    severity: "critical",
    info: "WCAG 1.4.3 (Level AA). Large text (≥18pt or ≥14pt bold) needs at least 3:1 contrast.",
  },
  HEADING_HIERARCHY: {
    id: "HEADING_HIERARCHY",
    name: "Heading levels skip a step",
    severity: "serious",
    info: "WCAG 1.3.1 (Level A). Skipping from H1 to H3 confuses screen reader users who navigate by heading level.",
  },
  HEADING_MISSING: {
    id: "HEADING_MISSING",
    name: "No heading present",
    severity: "serious",
    info: "WCAG 2.4.6. Long content benefits from at least one heading so AT users can orient themselves and skim.",
  },
  FONT_TOO_SMALL: {
    id: "FONT_TOO_SMALL",
    name: "Font size below 12px",
    severity: "serious",
    info: "Below 12px, body copy becomes hard to read for users with low vision and may force pinch-zoom on mobile.",
  },
  SOCIAL_ICON_NO_LABEL: {
    id: "SOCIAL_ICON_NO_LABEL",
    name: "Social icon missing accessible name",
    severity: "serious",
    info: "WCAG 4.1.2. Each social link must announce its platform — alt text or aria-label, not just an icon.",
  },
  LANG_MISSING: {
    id: "LANG_MISSING",
    name: "Email language not specified",
    severity: "critical",
    info: "WCAG 3.1.1 (Level A). Without lang, screen readers may pronounce content using the wrong voice.",
  },
  LINK_MALFORMED: {
    id: "LINK_MALFORMED",
    name: "Link URL is malformed",
    severity: "critical",
    info: "WCAG 2.4.4. URLs without a scheme like `https://` (e.g. `app.com`) are rendered inconsistently across email clients — some treat them as plain text, breaking the link entirely.",
  },
  LINK_INSECURE_HTTP: {
    id: "LINK_INSECURE_HTTP",
    name: "Link uses insecure HTTP",
    severity: "serious",
    info: "Modern email clients flag or block `http://` links. Use `https://` so the link works reliably and recipients aren't warned about insecure destinations.",
  },
  LINK_DANGEROUS_SCHEME: {
    id: "LINK_DANGEROUS_SCHEME",
    name: "Link uses a blocked URL scheme",
    severity: "critical",
    info: "Schemes like `javascript:`, `data:`, `vbscript:`, and `file:` are stripped by every major email client. The link will be inert when delivered.",
  },
  LINK_MERGETAG_UNGUARDED: {
    id: "LINK_MERGETAG_UNGUARDED",
    name: "Link URL contains a merge tag without a fallback",
    severity: "serious",
    info: "WCAG 2.4.4. If the tag resolves to empty for a recipient, the URL becomes broken (e.g. `https://example.com/?id=`). Add a pipe-default such as `{{ user_id|'guest' }}`.",
  },
  IMG_SRC_MISSING: {
    id: "IMG_SRC_MISSING",
    name: "Image source URL is missing",
    severity: "critical",
    info: "Without a src, the image cannot load and recipients only see the alt text — or nothing if alt is also empty.",
  },
  IMG_SRC_MALFORMED: {
    id: "IMG_SRC_MALFORMED",
    name: "Image source URL is malformed",
    severity: "critical",
    info: "Image src must be an absolute URL with a scheme (http:// or https://). Relative paths and bare hostnames don't load in email clients.",
  },
  IMG_SRC_INSECURE: {
    id: "IMG_SRC_INSECURE",
    name: "Image source uses insecure HTTP",
    severity: "critical",
    info: "Most modern email clients (Gmail, Apple Mail, Outlook 365) refuse to load http:// images by default — recipients will see a broken-image placeholder. Switch to https://.",
  },
  IMG_SRC_DATAURI: {
    id: "IMG_SRC_DATAURI",
    name: "Image source uses a data: URI",
    severity: "critical",
    info: "Most email clients strip or refuse data: URIs to prevent phishing. Host the image on an HTTPS URL instead.",
  },
  IMG_SRC_MERGETAG_UNGUARDED: {
    id: "IMG_SRC_MERGETAG_UNGUARDED",
    name: "Image source contains a merge tag without a fallback",
    severity: "serious",
    info: "If the tag resolves to empty for a recipient, the image won't load. Add a pipe-default like `{{ avatar_url|'https://example.com/default-avatar.png' }}`.",
  },
  PREHEADER_MISSING: {
    id: "PREHEADER_MISSING",
    name: "Preheader text not set",
    severity: "serious",
    info: "Preheader text is the first content screen readers and inbox previews announce after the subject line. Without one, recipients see whatever raw content the email starts with — usually a 'View in browser' link or a CTA, which is unhelpful for both AT users and open rates.",
  },
  MERGETAG_IN_ALT: {
    id: "MERGETAG_IN_ALT",
    name: "Image alt depends on a merge tag without a fallback",
    severity: "serious",
    info: "WCAG 1.1.1. If the recipient has no value for the tag, the alt becomes empty and screen readers will skip the image silently. Use a pipe-default like {{ name|'Profile photo' }} to guarantee a description.",
  },
  MERGETAG_LINK_LABEL: {
    id: "MERGETAG_LINK_LABEL",
    name: "Link text is only a merge tag without a fallback",
    severity: "critical",
    info: "WCAG 2.4.4. If the tag resolves to empty for some recipients, the link will have no readable label at all. Add surrounding text or a pipe-default such as {{ cta|'View offer' }}.",
  },
  MERGETAG_RESOLVES_EMPTY: {
    id: "MERGETAG_RESOLVES_EMPTY",
    name: "Merge tag resolves to empty in preview",
    severity: "serious",
    info: "With preview active, this tag's value is empty — meaning some recipients will see nothing where this content should appear. Set a preview value or add a pipe-default to the tag.",
  },
};

// ── Storage for ignored issues ──────────────────────────────────────────────

const STORAGE_KEY = "maildeno:a11y:ignoredIssues";

function loadIgnored(): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistIgnored(ids: Set<string>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage full / disabled — non-fatal, skip persistence.
  }
}

// ── Tree walking helpers (mirrors healthIndicator's traversal) ──────────────

const MAX_DEPTH = 5;

function resolveCompType(comp: any): string {
  return comp.componentType ?? comp.type;
}

/**
 * Component ID — components in this codebase always carry a crypto-generated
 * `id`. We accept `_uid` as a secondary path for any legacy / non-canvas
 * caller, and synthesize a last-resort id only as a defensive guard against
 * malformed input (e.g. a half-constructed component mid-drop). In practice
 * the real `id` branch is the only one that fires.
 */
function getComponentId(comp: any): string {
  if (comp.id) return String(comp.id);
  if (comp._uid) return String(comp._uid);
  // Defensive fallback — should not happen in normal operation.
  return `${resolveCompType(comp) ?? "unknown"}:no-id`;
}

/**
 * Stable ID for a sub-item inside a list-like component (menu items, social
 * platforms). Mirrors how the panels key their v-for: `_id` is assigned via
 * generateId() at add-time (see MenuPanel.addItem / SocialsPanel.addPlatform),
 * so it's present for items added through the UI but absent for default-seed
 * items and items from older saved templates.
 *
 * Strategy: prefer `_id` (stable across reorder/delete), fall back to index
 * within the *enabled* slice (stable as long as the user doesn't reorder or
 * disable items). Format mirrors getComponentId's no-id fallback so all IDs
 * have the same shape in storage.
 */
function getSubitemId(
  parentId: string,
  item: any,
  prefix: string,
  index: number,
): string {
  if (item?._id) return `${parentId}::${prefix}_${item._id}`;
  return `${parentId}::${prefix}${index}`;
}

/**
 * Convert rich-text HTML to a clean single-line plaintext string suitable for
 * display in issue messages. Strips tags, decodes the common entities TipTap
 * and HTML serializers emit (`&nbsp;` chiefly, but also `&amp;` `&lt;` `&gt;`
 * `&quot;` `&#39;`), and collapses whitespace.
 *
 * Kept narrow on purpose: a full entity decoder isn't needed because we only
 * need labels readable, not faithful — anything we miss just shows up as the
 * literal entity which is still better than the broken alternative.
 */
function htmlToPlain(input: string): string {
  return (
    input
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      // Numeric entities — &#34;, &#160; etc. Decode common ones safely.
      .replace(/&#(\d+);/g, (_m, code) => {
        const n = parseInt(code, 10);
        // Skip control chars; map non-breaking space and similar to a regular space.
        if (n === 160) return " ";
        if (n < 32) return " ";
        try {
          return String.fromCharCode(n);
        } catch {
          return " ";
        }
      })
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
        const n = parseInt(hex, 16);
        if (n === 0xa0) return " ";
        if (n < 32) return " ";
        try {
          return String.fromCharCode(n);
        } catch {
          return " ";
        }
      })
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Short human-visible label for a component, used in issue messages so that
 * three failing buttons read as ["Click Me", "Wellcome", "Get Started"]
 * rather than three identical "Button contrast is X:1" rows. Without this
 * disambiguation, users can't tell which component the failure refers to,
 * even though each row carries a unique internal ID.
 */
function getComponentLabel(comp: any, fallback: string): string {
  const props = comp.props ?? {};
  const raw = props.text ?? props.label ?? props.content ?? props.alt ?? "";
  const stripped = htmlToPlain(String(raw));
  if (!stripped) return fallback;
  return stripped.length > 30 ? stripped.slice(0, 30) + "…" : stripped;
}

/**
 * Like getComponentLabel, but resolves merge tags when preview is active so
 * the label shown in messages matches what the user is currently seeing in
 * the preview pane. Falls back to raw form (with `{{ tags }}` visible) when
 * preview is off, mirroring the editor view.
 */
function getDisplayLabel(
  comp: any,
  fallback: string,
  ctx: CheckContext,
  variant: "merge" | "link" = "merge",
): string {
  if (!ctx.previewActive) return getComponentLabel(comp, fallback);
  const props = comp.props ?? {};
  const raw = props.text ?? props.label ?? props.content ?? props.alt ?? "";
  const resolved = resolveText(String(raw), ctx, variant);
  const stripped = htmlToPlain(resolved);
  if (!stripped) return getComponentLabel(comp, fallback);
  return stripped.length > 30 ? stripped.slice(0, 30) + "…" : stripped;
}

/**
 * Resolve merge tags inside a text field the same way the runtime renderers
 * do. Returns the resolved string. When preview is OFF, tags survive intact
 * (resolveString itself short-circuits) and the checker's downstream logic
 * sees the literal `{{ tag }}` text — which is correct: an unresolved tag in
 * production *will* render as `{{ tag }}` to recipients with no value, so
 * treating it as content is honest.
 *
 * Falls back to the raw input if either utility throws — defensive but
 * practically a no-op since both helpers are pure.
 */
function resolveText(
  raw: string | undefined | null,
  ctx: CheckContext,
  variant: "merge" | "link",
): string {
  if (!raw) return "";
  const context = variant === "link" ? ctx.linkTagContext : ctx.mergeTagContext;
  try {
    return resolveString(raw, context, ctx.previewActive);
  } catch {
    return String(raw);
  }
}

/**
 * Detect merge tags in a string that have NO pipe-default fallback.
 * `{{ first_name }}` → unguarded.  `{{ first_name|'Friend' }}` → guarded.
 *
 * Uses extractMergeTagsWithDefaults from the merge-tag module so the
 * detection logic stays in lock-step with what the export pipeline does.
 * Returns the list of unguarded tag names (empty = all guarded or none).
 */
function unguardedTagsIn(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const withDefaults = extractMergeTagsWithDefaults(raw); // Map<name, fallback>
    const result: string[] = [];
    withDefaults.forEach((fallback, name) => {
      if (!fallback || !fallback.trim()) result.push(name);
    });
    return result;
  } catch {
    return [];
  }
}

/**
 * True when the string is *only* one or more merge tags + whitespace —
 * no other readable text. Used to detect link/button labels that depend
 * entirely on tag resolution, which is fragile.
 */
function isOnlyMergeTags(raw: string | undefined | null): boolean {
  if (!raw) return false;
  try {
    const tags = extractMergeTags(raw);
    if (tags.length === 0) return false;
    // Strip every {{ ... }} occurrence and see if anything readable remains.
    const remainder = String(raw)
      .replace(/\{\{[^}]*\}\}/g, " ")
      .trim();
    return remainder.length === 0;
  } catch {
    return false;
  }
}

// ── Color contrast utilities (WCAG 2.1 relative luminance) ──────────────────

function parseColor(
  input: string | undefined | null,
): [number, number, number] | null {
  if (!input) return null;
  const c = input.trim().toLowerCase();
  if (c === "transparent") return null;

  // #rgb / #rrggbb
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((ch) => ch + ch)
        .join("");
    if (hex.length !== 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }

  // rgb() / rgba()
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];

  return null;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const norm = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

function contrastRatio(
  fg: string | undefined,
  bg: string | undefined,
): number | null {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return null;
  const lf = relativeLuminance(f);
  const lb = relativeLuminance(b);
  const [light, dark] = lf > lb ? [lf, lb] : [lb, lf];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Walk up the row/column ancestry to resolve the effective background color.
 * Components inherit bg from their column, then row, then the email body.
 */
function resolveBackgroundColor(
  comp: any,
  parentChain: Array<{ backgroundColor?: string }>,
  bodyBg: string,
): string {
  if (
    comp.props?.backgroundColor &&
    comp.props.backgroundColor !== "transparent"
  ) {
    return comp.props.backgroundColor;
  }
  for (let i = parentChain.length - 1; i >= 0; i--) {
    const bg = parentChain[i].backgroundColor;
    if (bg && bg !== "transparent") return bg;
  }
  return bodyBg;
}

/**
 * Extract every background color a component might paint behind its text.
 * Solid colors return one entry; gradients return both endpoints so we can
 * check contrast against each — text that's readable on the start of a
 * gradient may fail at the end. The first entry is always the "primary"
 * color used in messaging.
 */
function getBackgroundCandidates(
  comp: any,
  parentChain: Array<{ backgroundColor?: string }>,
  bodyBg: string,
): { color: string; isGradientEndpoint: boolean }[] {
  const props = comp.props ?? {};
  const grad = props.backgroundGradient;
  if (grad?.useGradient && grad.gradient?.colors?.length >= 2) {
    const colors: { color: string; position: number }[] = grad.gradient.colors;
    // Sort by position so endpoints are predictable.
    const sorted = [...colors].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    return [
      { color: sorted[0].color, isGradientEndpoint: true },
      { color: sorted[sorted.length - 1].color, isGradientEndpoint: true },
    ];
  }
  return [
    {
      color: resolveBackgroundColor(comp, parentChain, bodyBg),
      isGradientEndpoint: false,
    },
  ];
}

/**
 * Run a contrast check for a text-bearing component and emit a passed or
 * failed issue. Centralizes the logic so anchors, buttons, headings and
 * paragraphs all use identical rules and produce identically structured
 * messages — the only difference is the component-type prefix in the text.
 *
 * For gradients, checks both endpoints. The worst ratio wins for messaging;
 * if any endpoint fails, the issue is failed and we mention the gradient.
 */
function checkContrast(
  comp: any,
  id: string,
  ref: AccessibilityIssue["componentRef"],
  ctx: CheckContext,
  componentNoun: string,
  label: string,
): void {
  const fg = comp.props?.color ?? comp.props?.textColor;
  if (!fg) return;

  const bgCandidates = getBackgroundCandidates(
    comp,
    ctx.parentChain,
    ctx.bodyBg,
  );
  const isGradient = bgCandidates.length > 1;

  // Compute every ratio; pick the worst.
  const results = bgCandidates
    .map((c) => ({ bg: c.color, ratio: contrastRatio(fg, c.color) }))
    .filter((r): r is { bg: string; ratio: number } => r.ratio !== null);
  if (results.length === 0) return;

  const worst = results.reduce((a, b) => (a.ratio < b.ratio ? a : b));

  const fontSize = parseInt((comp.props?.fontSize ?? "16").toString(), 10);
  const isBold = (comp.props?.fontWeight ?? "")
    .toString()
    .match(/bold|[6-9]00/);
  const isLarge = fontSize >= 18 || (fontSize >= 14 && !!isBold);
  const required = isLarge ? 3 : 4.5;
  const ruleId = isLarge ? "CONTRAST_FAIL_LARGE" : "CONTRAST_FAIL_NORMAL";

  const labelPart = `"${label}"`;
  const gradPart = isGradient ? " (worst point of gradient)" : "";

  if (worst.ratio < required) {
    pushIssue(
      ctx,
      makeIssue(
        ruleId,
        id,
        `${componentNoun} ${labelPart} text contrast is ${worst.ratio.toFixed(2)}:1${gradPart} — needs at least ${required}:1.`,
        "failed",
        ref,
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        ruleId,
        id,
        `${componentNoun} ${labelPart} contrast (${worst.ratio.toFixed(2)}:1${gradPart}) meets WCAG AA.`,
        "passed",
        ref,
      ),
    );
  }
}

// ── Icon alt validation ─────────────────────────────────────────────────────

/**
 * Run icon-alt rules for a clickable element (button or anchor) that may
 * have an `icon` prop. Mirrors the renderer logic in AnchorRenderer.vue:
 * an empty iconAlt is intentionally decorative (sets aria-hidden), which is
 * correct *only when the element also has visible text*. An icon-only
 * element with no alt has no accessible name at all — that's the failure
 * case.
 *
 * Caller has already confirmed comp.props.icon is set.
 */
function checkIconAlt(
  comp: any,
  id: string,
  ref: AccessibilityIssue["componentRef"],
  ctx: CheckContext,
  componentNoun: string,
  label: string,
): void {
  const iconAlt = (comp.props?.iconAlt ?? "").toString().trim();
  const text = (
    comp.props?.text ??
    comp.props?.label ??
    comp.props?.content ??
    ""
  ).toString();
  // Button text resolves via the LINK context — see LinkTagTab.vue SCAN_MAP.
  const resolvedText = resolveText(text, ctx, "link").trim();
  const hasVisibleText = resolvedText.length > 0;

  if (!iconAlt) {
    if (!hasVisibleText) {
      // Icon-only — alt is the ONLY accessible name. Failing is critical here.
      pushIssue(
        ctx,
        makeIssue(
          "BUTTON_ICON_NO_ALT",
          id,
          `${componentNoun} "${label}" has only an icon (no text) but no alt — assistive tech cannot describe what this does.`,
          "failed",
          ref,
        ),
      );
    } else {
      // Has text + decorative icon — correct usage (renderer marks aria-hidden).
      pushIssue(
        ctx,
        makeIssue(
          "BUTTON_ICON_NO_ALT",
          id,
          `${componentNoun} "${label}" icon is decorative (aria-hidden); text "${resolvedText.length > 30 ? resolvedText.slice(0, 30) + "…" : resolvedText}" provides the label.`,
          "passed",
          ref,
        ),
      );
    }
    return;
  }

  // Has alt — check it isn't a noisy redundant phrase.
  const lower = iconAlt.toLowerCase();
  if (lower === "icon" || lower === "image" || lower === "img") {
    pushIssue(
      ctx,
      makeIssue(
        "BUTTON_ICON_NO_ALT",
        id,
        `${componentNoun} "${label}" icon alt is "${iconAlt}" — non-descriptive. Either describe what the icon represents (e.g. "TikTok logo") or leave alt empty for a decorative icon.`,
        "failed",
        ref,
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "BUTTON_ICON_NO_ALT",
        id,
        `${componentNoun} "${label}" icon has descriptive alt ("${iconAlt}").`,
        "passed",
        ref,
      ),
    );
  }
}

// ── URL validation ──────────────────────────────────────────────────────────

/**
 * Schemes that work in email. `mailto:` and `tel:` are first-class, `sms:`
 * is supported by iOS/macOS Mail and increasingly elsewhere. Anything else
 * needs explicit `http://` or `https://`.
 */
const VALID_URL_SCHEMES = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "sms:",
]);

/**
 * Schemes that email clients strip on delivery (or that indicate misuse).
 * Including these as separate from "malformed" because they have a different
 * remediation path — you want to *replace* the link, not fix the URL.
 */
const DANGEROUS_URL_SCHEMES = ["javascript:", "data:", "vbscript:", "file:"];

/**
 * True if the string parses as a valid URL with one of the email-safe
 * schemes. URL constructor handles edge cases (encoded chars, ports, query
 * strings, anchor tracking) better than a regex would.
 *
 * Accepts mailto:, tel:, sms: as their own valid forms — these don't need
 * a host.
 */
function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return VALID_URL_SCHEMES.has(u.protocol);
  } catch {
    return false;
  }
}

/**
 * Map a URL-kind to its rule ID family. Keeps the same checking logic but
 * lets us emit IMG_SRC_* rules for image src, LINK_* rules for hyperlinks,
 * etc., so users can ignore them independently and read accurate messaging.
 *
 * `link` — rule family for click destinations (button, anchor, image-link,
 *          video fallback link, menu items, social platforms).
 * `src`  — rule family for asset URLs that the email loads silently
 *          (image src, social icon URLs, video src/coverImage). Stricter:
 *          insecure http for src is *critical* not *serious*, because most
 *          modern clients refuse to load mixed content silently.
 */
type UrlKind = "link" | "src";

interface UrlRuleFamily {
  malformed: string;
  insecure: string;
  dangerous: string;
  unguarded: string;
  insecureSeverity: Severity;
  insecureMsg: (noun: string, label: string) => string;
  malformedMsg: (noun: string, label: string, shown: string) => string;
  dangerousMsg: (noun: string, label: string, scheme: string) => string;
  unguardedMsg: (noun: string, label: string, names: string) => string;
  passedMsg: (noun: string, label: string) => string;
}

const URL_RULES: Record<UrlKind, UrlRuleFamily> = {
  link: {
    malformed: "LINK_MALFORMED",
    insecure: "LINK_INSECURE_HTTP",
    dangerous: "LINK_DANGEROUS_SCHEME",
    unguarded: "LINK_MERGETAG_UNGUARDED",
    insecureSeverity: "serious",
    insecureMsg: (n, l) =>
      `${n} "${l}" uses http:// — switch to https:// to avoid client warnings and improve deliverability.`,
    malformedMsg: (n, l, s) =>
      `${n} "${l}" URL "${s}" is not a valid absolute URL. Add the scheme (e.g. https://).`,
    dangerousMsg: (n, l, scheme) =>
      `${n} "${l}" uses ${scheme} scheme — email clients will strip this link.`,
    unguardedMsg: (n, l, names) =>
      `${n} "${l}" URL uses merge tag${names.includes(",") ? "s" : ""} { ${names} } without a fallback.`,
    passedMsg: (n, l) => `${n} "${l}" URL is well-formed.`,
  },
  src: {
    malformed: "IMG_SRC_MALFORMED",
    insecure: "IMG_SRC_INSECURE",
    dangerous: "IMG_SRC_DATAURI",
    unguarded: "IMG_SRC_MERGETAG_UNGUARDED",
    insecureSeverity: "critical",
    insecureMsg: (n, l) =>
      `${n} "${l}" source uses http:// — most modern email clients refuse to load insecure images by default. Switch to https://.`,
    malformedMsg: (n, l, s) =>
      `${n} "${l}" source "${s}" is not a valid absolute URL. The image will not load.`,
    dangerousMsg: (n, l, scheme) =>
      `${n} "${l}" source uses ${scheme} scheme — email clients will block this image.`,
    unguardedMsg: (n, l, names) =>
      `${n} "${l}" source uses merge tag${names.includes(",") ? "s" : ""} { ${names} } without a fallback. The image will fail to load if the tag is empty.`,
    passedMsg: (n, l) => `${n} "${l}" source URL is well-formed.`,
  },
};

/**
 * Run all URL rules for a given component prop. Used by:
 *   • button.link, anchor.link, image.link, video.fallbackLink, menu items,
 *     social platform links — all UrlKind="link"
 *   • image.src, video.src, video.coverImage, social icon URLs — UrlKind="src"
 *
 * Order matters: dangerous scheme is reported first because it supersedes
 * the generic "malformed" message. We never report both for the same URL.
 */
function checkUrl(
  rawUrl: string | undefined,
  id: string,
  ref: AccessibilityIssue["componentRef"],
  ctx: CheckContext,
  componentNoun: string,
  label: string,
  urlKind: UrlKind,
): void {
  if (!rawUrl) return;
  const trimmed = rawUrl.trim();
  if (!trimmed) return;

  const family = URL_RULES[urlKind];

  // 1) Unguarded merge tags. Run on raw form so we catch production-time risk
  // regardless of preview state.
  const unguarded = unguardedTagsIn(trimmed);
  if (unguarded.length > 0) {
    pushIssue(
      ctx,
      makeIssue(
        family.unguarded,
        id,
        family.unguardedMsg(componentNoun, label, unguarded.join(", ")),
        "failed",
        ref,
      ),
    );
  }

  // For everything that follows, work with the resolved URL.
  const resolved = resolveText(trimmed, ctx, "link").trim();

  // 2) Dangerous scheme — always critical, supersedes other URL rules.
  const lower = resolved.toLowerCase();
  const dangerous = DANGEROUS_URL_SCHEMES.find((s) => lower.startsWith(s));
  if (dangerous) {
    pushIssue(
      ctx,
      makeIssue(
        family.dangerous,
        id,
        family.dangerousMsg(componentNoun, label, dangerous.replace(":", "")),
        "failed",
        ref,
      ),
    );
    return;
  }

  // 3) Malformed.
  if (!isValidUrl(resolved)) {
    pushIssue(
      ctx,
      makeIssue(
        family.malformed,
        id,
        family.malformedMsg(
          componentNoun,
          label,
          resolved.length > 40 ? resolved.slice(0, 40) + "…" : resolved,
        ),
        "failed",
        ref,
      ),
    );
    return;
  }

  // 4) Insecure HTTP. Skip localhost and similar dev hosts.
  try {
    const u = new URL(resolved);
    if (u.protocol === "http:") {
      const host = u.hostname.toLowerCase();
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local");
      if (!isLocal) {
        pushIssue(
          ctx,
          makeIssue(
            family.insecure,
            id,
            family.insecureMsg(componentNoun, label),
            "failed",
            ref,
          ),
        );
        return;
      }
    }
  } catch {
    // Already validated; unreachable in practice.
  }

  // All checks passed — emit one passed entry under the family's primary rule.
  pushIssue(
    ctx,
    makeIssue(
      family.malformed,
      id,
      family.passedMsg(componentNoun, label),
      "passed",
      ref,
    ),
  );
}

/**
 * Backwards-compatible alias: most call sites only validate hyperlinks.
 */
function checkLinkUrl(
  rawUrl: string | undefined,
  id: string,
  ref: AccessibilityIssue["componentRef"],
  ctx: CheckContext,
  componentNoun: string,
  label: string,
): void {
  checkUrl(rawUrl, id, ref, ctx, componentNoun, label, "link");
}

// ── Vague / redundant phrase lists ──────────────────────────────────────────

const VAGUE_LINK_PHRASES = [
  "click here",
  "click",
  "here",
  "read more",
  "more",
  "learn more",
  "this",
  "this link",
  "link",
  "go here",
  "go to",
  "see here",
  "check this out",
  "check it out",
  "find out more",
  "details",
  "info",
  "information",
];

/** Normalizes link-like text for comparison purposes: a screen reader
 *  doesn't voice letter case, and trailing punctuation doesn't change what's
 *  announced, so "Learn More", "learn more!", and "LEARN MORE." should all
 *  match. Shared by the VAGUE_LINK_PHRASES check (anchors, buttons, menu
 *  items) and by checkDuplicateLinkText's text grouping. */
function normalizeLinkText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[!.?…]+$/, "")
    .trim();
}

const REDUNDANT_ALT_PREFIXES = [
  "image of",
  "picture of",
  "photo of",
  "graphic of",
  "image:",
  "img:",
];

// ── Issue factory ───────────────────────────────────────────────────────────

function makeIssue(
  ruleId: string,
  componentId: string,
  message: string,
  status: IssueStatus,
  componentRef?: AccessibilityIssue["componentRef"],
): AccessibilityIssue {
  const rule = RULES[ruleId];
  return {
    id: `${ruleId}:${componentId}`,
    ruleId,
    severity: rule.severity,
    status,
    rule: rule.name,
    message,
    info: rule.info,
    componentRef,
  };
}

// ── Per-component rule checks ───────────────────────────────────────────────

/** One link-like component's (anchor, button, or menu item) resolved text +
 *  URL, collected during the walk so links can be cross-checked against
 *  each other once the full tree has been seen. */
interface LinkRecord {
  text: string;
  url: string;
  componentId: string;
  componentRef: AccessibilityIssue["componentRef"];
}

interface CheckContext {
  issues: AccessibilityIssue[];
  ignored: Set<string>;
  parentChain: Array<{ backgroundColor?: string }>;
  bodyBg: string;
  /** Tracks heading levels seen in document order. */
  headingLevels: number[];
  textComponentCount: number;
  /** Merge-tag context for general text content (paragraphs, headings, button labels, alt). */
  mergeTagContext: Record<string, string>;
  /** Merge-tag context for URL/link fields (anchor href, image src, anchor text). */
  linkTagContext: Record<string, string>;
  /** Whether the user has preview mode toggled on — controls whether tags resolve. */
  previewActive: boolean;
  /** Text/URL pairs collected from anchors, buttons, and menu items during
   *  the walk, consumed by checkDuplicateLinkText after it completes. */
  links: LinkRecord[];
}

function pushIssue(ctx: CheckContext, issue: AccessibilityIssue) {
  if (ctx.ignored.has(issue.id)) {
    issue.status = "ignored";
  }
  ctx.issues.push(issue);
}

function checkImage(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const ref = { type: "image", id };
  const altRaw = comp.props?.alt;
  // Resolve via LINK context so length / emptiness reflect what AT users hear.
  // Image alt is in LinkTagTab's SCAN_MAP — never the text-merge tab.
  const alt = resolveText(altRaw, ctx, "link");
  const isDecorative = comp.props?.decorative === true;

  if (isDecorative) {
    if (alt && alt.length > 0) {
      pushIssue(
        ctx,
        makeIssue(
          "IMG_ALT_DECORATIVE",
          id,
          "Image is marked decorative but has alt text — set alt to an empty string.",
          "failed",
          ref,
        ),
      );
    } else {
      pushIssue(
        ctx,
        makeIssue(
          "IMG_ALT_DECORATIVE",
          id,
          "Decorative image correctly uses empty alt — screen readers will skip it.",
          "passed",
          ref,
        ),
      );
    }
    return;
  }

  // Merge-tag-specific alt risk: tag without pipe-default → may resolve to
  // empty for some recipients. Flag this regardless of preview state because
  // it's a production-time risk, not a preview-time one.
  const unguarded = unguardedTagsIn(altRaw);
  if (unguarded.length > 0) {
    pushIssue(
      ctx,
      makeIssue(
        "MERGETAG_IN_ALT",
        id,
        `Alt text uses merge tag${unguarded.length === 1 ? "" : "s"} { ${unguarded.join(", ")} } without a fallback. Add a pipe-default like {{ ${unguarded[0]}|'…' }}.`,
        "failed",
        ref,
      ),
    );
  }

  if (!alt || alt.trim().length === 0) {
    pushIssue(
      ctx,
      makeIssue(
        "IMG_ALT_MISSING",
        id,
        "Image has no alt text. Add a short description of what the image conveys.",
        "failed",
        ref,
      ),
    );
  } else {
    const lower = alt.toLowerCase().trim();
    const redundant = REDUNDANT_ALT_PREFIXES.find((p) => lower.startsWith(p));
    if (redundant) {
      pushIssue(
        ctx,
        makeIssue(
          "IMG_ALT_REDUNDANT",
          id,
          `Alt text starts with "${redundant}" — remove it; screen readers already announce "image".`,
          "failed",
          ref,
        ),
      );
    } else {
      pushIssue(
        ctx,
        makeIssue(
          "IMG_ALT_MISSING",
          id,
          `Image has descriptive alt text ("${alt.length > 40 ? alt.slice(0, 40) + "…" : alt}").`,
          "passed",
          ref,
        ),
      );
    }
  }

  // ── Source URL ────────────────────────────────────────────────────────────
  // Always validated. Use alt as the label when set so messages identify the
  // image; otherwise fall back to a generic "Image".
  const srcRaw = comp.props?.src;
  const imageLabel = alt && alt.trim() ? alt.trim() : "Image";
  const trimmedLabel =
    imageLabel.length > 30 ? imageLabel.slice(0, 30) + "…" : imageLabel;

  if (!srcRaw || !srcRaw.toString().trim()) {
    pushIssue(
      ctx,
      makeIssue(
        "IMG_SRC_MISSING",
        id,
        `Image "${trimmedLabel}" has no source URL set.`,
        "failed",
        ref,
      ),
    );
  } else {
    checkUrl(srcRaw.toString(), id, ref, ctx, "Image", trimmedLabel, "src");
  }

  // ── Click-through link (only when enabled) ────────────────────────────────
  // ImageRenderer wraps in <a> only when `enabled === true && link` — so the
  // link prop is dormant otherwise. Don't flag unset/invalid links on a
  // non-enabled image; that's authored intent.
  if (comp.props?.enabled === true) {
    const link = comp.props?.link;
    if (!link || !link.toString().trim()) {
      pushIssue(
        ctx,
        makeIssue(
          "LINK_NO_HREF",
          id,
          `Image "${trimmedLabel}" is set as a clickable link but has no destination URL.`,
          "failed",
          ref,
        ),
      );
    } else {
      checkUrl(link.toString(), id, ref, ctx, "Image", trimmedLabel, "link");
    }
  }
}

function checkVideo(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const ref = { type: "video", id };
  const altRaw = comp.props?.alt;
  // Video alt is in LinkTagTab's SCAN_MAP — uses link context.
  const alt = resolveText(altRaw, ctx, "link");
  const videoLabel = alt && alt.trim() ? alt.trim() : "Video";
  const trimmedLabel =
    videoLabel.length > 30 ? videoLabel.slice(0, 30) + "…" : videoLabel;

  // ── Alt text ──────────────────────────────────────────────────────────────
  // Same logic as image: missing alt is critical (recipients with autoplay
  // disabled or video-blocking clients see only the alt). Default is "Watch
  // video" which is OK as a generic-but-present fallback, but we still want
  // to flag a truly empty one.
  if (!alt || alt.trim().length === 0) {
    pushIssue(
      ctx,
      makeIssue(
        "IMG_ALT_MISSING",
        id,
        "Video has no alt text. Add a short description of the video's purpose.",
        "failed",
        ref,
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "IMG_ALT_MISSING",
        id,
        `Video has descriptive alt text ("${trimmedLabel}").`,
        "passed",
        ref,
      ),
    );
  }

  // ── Video source ──────────────────────────────────────────────────────────
  // Only validate when set — default is "" and that's a legitimate authoring
  // state ("video block placed but URL not yet entered"). When set, treat
  // like image src: HTTPS strongly preferred, no data: URIs, etc.
  const srcRaw = comp.props?.src;
  if (srcRaw && srcRaw.toString().trim()) {
    checkUrl(srcRaw.toString(), id, ref, ctx, "Video", trimmedLabel, "src");
  }

  // ── Cover image (poster) ──────────────────────────────────────────────────
  // The poster is what recipients see in clients that block the <video> tag
  // (which is most of them). Validating its URL is at least as important as
  // the video src itself.
  const coverRaw = comp.props?.coverImage;
  if (coverRaw && coverRaw.toString().trim()) {
    checkUrl(
      coverRaw.toString(),
      id,
      ref,
      ctx,
      "Video poster",
      trimmedLabel,
      "src",
    );
  }

  // ── Fallback link ─────────────────────────────────────────────────────────
  // Where users go when they click the video in clients that can't play it.
  // Critical for accessibility: AT users who can't see the video need this
  // link to access the content.
  const fbLink = comp.props?.fallbackLink;
  if (!fbLink || !fbLink.toString().trim()) {
    pushIssue(
      ctx,
      makeIssue(
        "LINK_NO_HREF",
        id,
        `Video "${trimmedLabel}" has no fallback link — recipients in clients that can't play <video> have no way to reach the content.`,
        "failed",
        ref,
      ),
    );
  } else {
    checkUrl(fbLink.toString(), id, ref, ctx, "Video", trimmedLabel, "link");
  }
}

function checkButton(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const ref = { type: "button", id };
  const rawText = (
    comp.props?.label ??
    comp.props?.text ??
    comp.props?.content ??
    ""
  ).toString();
  // Button text resolves via LINK context — see LinkTagTab.vue SCAN_MAP.
  const resolvedText = resolveText(rawText, ctx, "link").trim();
  // Display label uses the same context for consistency.
  const label = getDisplayLabel(comp, "Button", ctx, "link");
  const link = comp.props?.link;

  // Record for the cross-link duplicate-text check (see
  // checkDuplicateLinkText). Same non-empty guard as checkAnchor — an
  // empty-label or href-less button is already covered by BUTTON_EMPTY /
  // LINK_NO_HREF below.
  if (resolvedText && link?.toString().trim()) {
    ctx.links.push({
      text: resolvedText,
      url: link.toString().trim(),
      componentId: id,
      componentRef: ref,
    });
  }

  // Empty / tag-only label checks
  if (!rawText.trim()) {
    pushIssue(
      ctx,
      makeIssue(
        "BUTTON_EMPTY",
        id,
        "Button has no visible label. Add text describing the action.",
        "failed",
        ref,
      ),
    );
  } else if (isOnlyMergeTags(rawText) && unguardedTagsIn(rawText).length > 0) {
    // Whole label is just a tag with no fallback — fragile.
    const unguarded = unguardedTagsIn(rawText);
    pushIssue(
      ctx,
      makeIssue(
        "MERGETAG_LINK_LABEL",
        id,
        `Button label is only the merge tag${unguarded.length === 1 ? "" : "s"} { ${unguarded.join(", ")} } with no fallback. If the tag is empty for a recipient, the button has no label.`,
        "failed",
        ref,
      ),
    );
  } else if (ctx.previewActive && !resolvedText) {
    // Preview ON, tag resolved to empty
    pushIssue(
      ctx,
      makeIssue(
        "MERGETAG_RESOLVES_EMPTY",
        id,
        `Button label resolves to empty in preview. Set a preview value for the tag, or add a pipe-default.`,
        "failed",
        ref,
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "BUTTON_EMPTY",
        id,
        `Button "${label}" has a clear label.`,
        "passed",
        ref,
      ),
    );
  }

  if (!link) {
    pushIssue(
      ctx,
      makeIssue(
        "LINK_NO_HREF",
        id,
        `Button "${label}" has no destination URL set.`,
        "failed",
        ref,
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "LINK_NO_HREF",
        id,
        `Button "${label}" has a destination URL.`,
        "passed",
        ref,
      ),
    );
    // URL exists — validate scheme, format, security, and merge-tag safety.
    checkLinkUrl(link, id, ref, ctx, "Button", label);
  }

  if (comp.props?.icon) {
    checkIconAlt(comp, id, ref, ctx, "Button", label);
  }

  // Contrast — handles solids, gradients, and inheritance from parent chain.
  checkContrast(comp, id, ref, ctx, "Button", label);
}

function checkAnchor(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const ref = { type: "anchor", id };
  const rawText = (
    comp.props?.content ??
    comp.props?.text ??
    comp.props?.label ??
    ""
  ).toString();
  // Anchor leaves resolve text via the LINK tag context (matches AnchorRenderer.vue).
  const resolvedText = resolveText(rawText, ctx, "link").trim();
  const link = comp.props?.link;
  const label = getDisplayLabel(comp, "Link", ctx, "link");

  // Record for the cross-link duplicate-text check (see
  // checkDuplicateLinkText). Same non-empty guard as the checks below —
  // an empty-text or href-less link is already covered by LINK_EMPTY /
  // LINK_NO_HREF, and would otherwise pollute the "" text bucket.
  if (resolvedText && link?.toString().trim()) {
    ctx.links.push({
      text: resolvedText,
      url: link.toString().trim(),
      componentId: id,
      componentRef: ref,
    });
  }

  if (!rawText.trim()) {
    pushIssue(
      ctx,
      makeIssue("LINK_EMPTY", id, "Link has no readable text.", "failed", ref),
    );
    return;
  }

  // Tag-only link label is fragile — same logic as button.
  if (isOnlyMergeTags(rawText) && unguardedTagsIn(rawText).length > 0) {
    const unguarded = unguardedTagsIn(rawText);
    pushIssue(
      ctx,
      makeIssue(
        "MERGETAG_LINK_LABEL",
        id,
        `Link text is only the merge tag${unguarded.length === 1 ? "" : "s"} { ${unguarded.join(", ")} } with no fallback. If empty, the link will have no readable label.`,
        "failed",
        ref,
      ),
    );
  } else if (ctx.previewActive && !resolvedText) {
    pushIssue(
      ctx,
      makeIssue(
        "MERGETAG_RESOLVES_EMPTY",
        id,
        `Link text resolves to empty in preview. Set a preview value or add a pipe-default to the tag.`,
        "failed",
        ref,
      ),
    );
  }

  // Vague-link check runs against resolved text — "click here" is vague
  // whether literal or via tag.
  const checkPhrase = resolvedText || rawText;
  const lower = normalizeLinkText(checkPhrase);
  if (VAGUE_LINK_PHRASES.includes(lower)) {
    pushIssue(
      ctx,
      makeIssue(
        "LINK_VAGUE",
        id,
        `Link text "${checkPhrase}" is not descriptive on its own. Use text that describes the destination.`,
        "failed",
        ref,
      ),
    );
  } else if (checkPhrase) {
    pushIssue(
      ctx,
      makeIssue(
        "LINK_VAGUE",
        id,
        `Link "${label}" has descriptive text.`,
        "passed",
        ref,
      ),
    );
  }

  if (!link) {
    pushIssue(
      ctx,
      makeIssue(
        "LINK_NO_HREF",
        id,
        `Link "${label}" has no href set.`,
        "failed",
        ref,
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "LINK_NO_HREF",
        id,
        `Link "${label}" has an href set.`,
        "passed",
        ref,
      ),
    );
    // URL exists — validate scheme, format, security, and merge-tag safety.
    checkLinkUrl(link, id, ref, ctx, "Link", label);
  }

  // Contrast against the resolved background. Anchors typically have no own
  // bg, so this check relies on the parent-chain resolution.
  checkContrast(comp, id, ref, ctx, "Link", label);
}

function checkHeading(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const ref = { type: "heading", id };
  const level = parseInt(
    (comp.props?.level ?? comp.props?.tag ?? "h2")
      .toString()
      .replace(/\D/g, ""),
    10,
  );
  const label = getDisplayLabel(
    comp,
    `H${Number.isFinite(level) ? level : "?"}`,
    ctx,
    "merge",
  );

  if (!Number.isFinite(level)) return;

  const prev = ctx.headingLevels[ctx.headingLevels.length - 1];
  if (prev === undefined) {
    // First heading in the document — should ideally be H1 to anchor outline.
    if (level !== 1) {
      pushIssue(
        ctx,
        makeIssue(
          "HEADING_HIERARCHY",
          id,
          `First heading is H${level} ("${label}"). Start the outline with H1 so screen readers know where the page begins.`,
          "failed",
          ref,
        ),
      );
    } else {
      pushIssue(
        ctx,
        makeIssue(
          "HEADING_HIERARCHY",
          id,
          `Document starts with H1 ("${label}").`,
          "passed",
          ref,
        ),
      );
    }
  } else if (level > prev + 1) {
    pushIssue(
      ctx,
      makeIssue(
        "HEADING_HIERARCHY",
        id,
        `Heading "${label}" jumps from H${prev} to H${level}. Use H${prev + 1} instead.`,
        "failed",
        ref,
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "HEADING_HIERARCHY",
        id,
        `Heading "${label}" (H${level}) follows correctly from H${prev}.`,
        "passed",
        ref,
      ),
    );
  }

  ctx.headingLevels.push(level);

  // Contrast — headings usually have no own bg.
  checkContrast(comp, id, ref, ctx, `H${level}`, label);
}

function checkParagraph(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const ref = { type: "paragraph", id };
  const ct = resolveCompType(comp);
  const componentNoun = ct === "list" ? "List" : "Text";
  const label = getDisplayLabel(comp, componentNoun, ctx, "merge");

  // Font size
  const sizeRaw = comp.props?.fontSize;
  if (sizeRaw) {
    const size = parseInt(sizeRaw.toString(), 10);
    if (Number.isFinite(size)) {
      if (size < 12) {
        pushIssue(
          ctx,
          makeIssue(
            "FONT_TOO_SMALL",
            id,
            `${componentNoun} "${label}" font size is ${size}px — below the 12px minimum for comfortable reading.`,
            "failed",
            ref,
          ),
        );
      } else {
        pushIssue(
          ctx,
          makeIssue(
            "FONT_TOO_SMALL",
            id,
            `${componentNoun} "${label}" font size (${size}px) is readable.`,
            "passed",
            ref,
          ),
        );
      }
    }
  }

  checkContrast(comp, id, ref, ctx, componentNoun, label);
}

function checkSocials(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const platforms = comp.props?.platforms ?? [];
  const enabled = platforms.filter((p: any) => p.enabled !== false);
  if (enabled.length === 0) return;

  // Accessible name — schema is `name` (e.g. "Facebook"). Other field names
  // (alt, label, platform) accepted defensively in case of legacy data.
  const missingName = enabled.filter(
    (p: any) =>
      !(
        p.name?.toString().trim() ||
        p.alt?.toString().trim() ||
        p.label?.toString().trim() ||
        p.platform?.toString().trim()
      ),
  );

  if (missingName.length > 0) {
    pushIssue(
      ctx,
      makeIssue(
        "SOCIAL_ICON_NO_LABEL",
        id,
        `${missingName.length} of ${enabled.length} social icons missing an accessible name. Set the platform name so screen readers can announce it.`,
        "failed",
        { type: "socials", id },
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "SOCIAL_ICON_NO_LABEL",
        id,
        `All ${enabled.length} social icons have accessible names.`,
        "passed",
        { type: "socials", id },
      ),
    );
  }

  // Per-platform link + icon URL validation. Each enabled platform with no
  // link is a real bug (icon renders but goes nowhere). Each platform's icon
  // URL needs validation since broken icons silently fail to load.
  enabled.forEach((p: any, i: number) => {
    const platformLabel = (
      p.name ||
      p.alt ||
      p.label ||
      p.platform ||
      `#${i + 1}`
    ).toString();
    const platformId = getSubitemId(id, p, "p", i);
    const platformRef = { type: "socials", id: platformId };

    // Link
    const link = p.link;
    if (!link || !link.toString().trim()) {
      pushIssue(
        ctx,
        makeIssue(
          "LINK_NO_HREF",
          platformId,
          `Social icon "${platformLabel}" is enabled but has no link.`,
          "failed",
          platformRef,
        ),
      );
    } else {
      checkUrl(
        link.toString(),
        platformId,
        platformRef,
        ctx,
        "Social",
        platformLabel,
        "link",
      );
    }

    // Icon URL
    const iconUrl = p.icon;
    if (iconUrl && iconUrl.toString().trim()) {
      checkUrl(
        iconUrl.toString(),
        platformId,
        platformRef,
        ctx,
        "Social icon",
        platformLabel,
        "src",
      );
    }
  });
}

/**
 * Menu — array of `{ label, link, enabled }` items. Each enabled item is
 * effectively an inline anchor; runs the same vague-text check and full URL
 * validation per item. Empty links on enabled items are a real bug.
 *
 * Also runs the menu's container-level contrast check (text color vs the
 * resolved background) since menus are text-bearing components.
 */
function checkMenu(comp: any, ctx: CheckContext) {
  const id = getComponentId(comp);
  const ref = { type: "menu", id };
  const items = comp.props?.items ?? [];
  const enabled = items.filter((it: any) => it.enabled !== false);

  // Container-level contrast — the menu has color/fontSize at the top level.
  const containerLabel = `Menu (${enabled.length} item${enabled.length === 1 ? "" : "s"})`;
  checkContrast(comp, id, ref, ctx, "Menu", containerLabel);

  if (enabled.length === 0) return;

  enabled.forEach((it: any, i: number) => {
    const itemLabelRaw = (it.label ?? "").toString();
    // Menu items aren't covered by either MergeTagTab.TEXT_TYPES or
    // LinkTagTab.SCAN_MAP — so neither preview context applies. Treat the
    // raw label as-is to avoid bleeding tag values from unrelated contexts.
    const itemLabel = itemLabelRaw.trim() || `item #${i + 1}`;
    const trimmedItemLabel =
      itemLabel.length > 30 ? itemLabel.slice(0, 30) + "…" : itemLabel;
    const itemId = getSubitemId(id, it, "i", i);
    const itemRef = { type: "menu-item", id: itemId };

    // Empty label
    if (!itemLabelRaw.trim()) {
      pushIssue(
        ctx,
        makeIssue(
          "LINK_EMPTY",
          itemId,
          `Menu item #${i + 1} has no readable text.`,
          "failed",
          itemRef,
        ),
      );
    }

    // Vague text check — same phrases that fail for anchors.
    if (itemLabelRaw.trim()) {
      const lower = normalizeLinkText(itemLabelRaw);
      if (VAGUE_LINK_PHRASES.includes(lower)) {
        pushIssue(
          ctx,
          makeIssue(
            "LINK_VAGUE",
            itemId,
            `Menu item "${trimmedItemLabel}" is not descriptive on its own.`,
            "failed",
            itemRef,
          ),
        );
      }
    }

    // Link
    const link = it.link;

    // Record for the cross-link duplicate-text check (see
    // checkDuplicateLinkText). Same non-empty guard as checkAnchor — an
    // empty-label or href-less item is already covered by LINK_EMPTY /
    // LINK_NO_HREF below. Uses the raw label (not the "item #N" fallback
    // used for display) so unlabeled items don't get lumped into one group.
    const menuItemText = itemLabelRaw.trim();
    if (menuItemText && link?.toString().trim()) {
      ctx.links.push({
        text: menuItemText,
        url: link.toString().trim(),
        componentId: itemId,
        componentRef: itemRef,
      });
    }

    if (!link || !link.toString().trim()) {
      pushIssue(
        ctx,
        makeIssue(
          "LINK_NO_HREF",
          itemId,
          `Menu item "${trimmedItemLabel}" has no link set.`,
          "failed",
          itemRef,
        ),
      );
    } else {
      checkUrl(
        link.toString(),
        itemId,
        itemRef,
        ctx,
        "Menu item",
        trimmedItemLabel,
        "link",
      );
    }
  });
}

// ── Recursive walker ────────────────────────────────────────────────────────

function walkChildren(children: any[], ctx: CheckContext, depth: number): void {
  if (depth >= MAX_DEPTH) return;

  for (const child of children) {
    const childType = child.type;

    if (childType === "row") {
      ctx.parentChain.push({ backgroundColor: child.backgroundColor });
      const cols: any[] = child.columns ?? [];
      cols.forEach((col: any) => {
        ctx.parentChain.push({ backgroundColor: col.backgroundColor });
        const kids = col.children ?? col.components ?? [];
        walkChildren(kids, ctx, depth + 1);
        ctx.parentChain.pop();
      });
      ctx.parentChain.pop();
      continue;
    }

    if (childType === "row-spacer") continue;

    const ct = resolveCompType(child);
    switch (ct) {
      case "image":
        checkImage(child, ctx);
        break;
      case "video":
        checkVideo(child, ctx);
        break;
      case "button":
        checkButton(child, ctx);
        ctx.textComponentCount++;
        break;
      case "anchor":
        checkAnchor(child, ctx);
        ctx.textComponentCount++;
        break;
      case "heading":
        checkHeading(child, ctx);
        ctx.textComponentCount++;
        break;
      case "paragraph":
      case "list":
        checkParagraph(child, ctx);
        ctx.textComponentCount++;
        break;
      case "menu":
        // Menu is a row of links, not a text component — has its own checker.
        // Still counts as a text component for the heading-presence rule
        // since it contributes navigable content.
        checkMenu(child, ctx);
        ctx.textComponentCount++;
        break;
      case "socials":
        checkSocials(child, ctx);
        break;
      case "spacer":
        // No accessibility checks apply — pure layout element.
        break;
    }
  }
}

// ── Cross-link checks (run after the full tree walk) ────────────────────────
// Some issues can't be seen by looking at one component in isolation — they
// only show up once every link in the email can be compared side by side.
// Duplicate link text pointing at different URLs is the first case of this:
// it depends on the full ctx.links list that checkAnchor, checkButton, and
// checkMenu populate during the walk, so it has to run once walkChildren
// has finished.

/** Trims a list of URLs to a short, readable inline preview for messages. */
function formatUrlList(urls: string[]): string {
  const MAX_SHOWN = 3;
  const shown = urls
    .slice(0, MAX_SHOWN)
    .map((u) => (u.length > 40 ? u.slice(0, 40) + "…" : u));
  const remaining = urls.length - shown.length;
  return remaining > 0
    ? `${shown.join(", ")}, +${remaining} more`
    : shown.join(", ");
}

function checkDuplicateLinkText(ctx: CheckContext) {
  const byText = new Map<string, LinkRecord[]>();
  for (const record of ctx.links) {
    const key = normalizeLinkText(record.text);
    const group = byText.get(key);
    if (group) {
      group.push(record);
    } else {
      byText.set(key, [record]);
    }
  }

  byText.forEach((group) => {
    const distinctUrls = [...new Set(group.map((r) => r.url))];
    const isConsistent = distinctUrls.length <= 1;

    for (const record of group) {
      if (isConsistent) {
        pushIssue(
          ctx,
          makeIssue(
            "LINK_DUPLICATE_TEXT_DIFFERENT_URL",
            record.componentId,
            group.length > 1
              ? `Link text "${record.text}" appears ${group.length} times in this email and always points to the same destination.`
              : `Link text "${record.text}" is unique in this email.`,
            "passed",
            record.componentRef,
          ),
        );
      } else {
        pushIssue(
          ctx,
          makeIssue(
            "LINK_DUPLICATE_TEXT_DIFFERENT_URL",
            record.componentId,
            `Link text "${record.text}" is used for ${distinctUrls.length} different URLs in this email (${formatUrlList(distinctUrls)}). Screen reader users scanning a link list won't be able to tell these destinations apart by text alone.`,
            "failed",
            record.componentRef,
          ),
        );
      }
    }
  });
}

// ── Document-level checks ───────────────────────────────────────────────────

function checkDocument(emailMeta: any, ctx: CheckContext) {
  // Language — accept several common field names so callers don't have to
  // re-key their canvas store to match the checker.
  const lang = emailMeta?.lang ?? emailMeta?.language ?? emailMeta?.locale;
  if (!lang || !lang.toString().trim()) {
    pushIssue(
      ctx,
      makeIssue(
        "LANG_MISSING",
        "document",
        'Email language is not set. Add a lang attribute (e.g. "en") so screen readers use the correct pronunciation.',
        "failed",
        { type: "document" },
      ),
    );
  } else {
    pushIssue(
      ctx,
      makeIssue(
        "LANG_MISSING",
        "document",
        `Email language is set ("${lang}").`,
        "passed",
        { type: "document" },
      ),
    );
  }

  // Preheader — same field-name tolerance.
  const preheader =
    emailMeta?.preheader ?? emailMeta?.preheaderText ?? emailMeta?.previewText;
  const trimmedPreheader = (preheader ?? "").toString().trim();
  if (!trimmedPreheader) {
    pushIssue(
      ctx,
      makeIssue(
        "PREHEADER_MISSING",
        "document",
        "Preheader text is not set. Add a short summary that previews the email's content.",
        "failed",
        { type: "document" },
      ),
    );
  } else {
    // Industry recommendation: keep preheader between ~40–90 chars. Below
    // that and inbox previews look thin; above it gets truncated.
    const len = trimmedPreheader.length;
    const display =
      len > 50 ? trimmedPreheader.slice(0, 50) + "…" : trimmedPreheader;
    pushIssue(
      ctx,
      makeIssue(
        "PREHEADER_MISSING",
        "document",
        `Preheader is set ("${display}", ${len} char${len === 1 ? "" : "s"}).`,
        "passed",
        { type: "document" },
      ),
    );
  }

  if (ctx.textComponentCount >= 3 && ctx.headingLevels.length === 0) {
    pushIssue(
      ctx,
      makeIssue(
        "HEADING_MISSING",
        "document",
        "No headings used. Add at least one to help screen reader users navigate.",
        "failed",
        { type: "document" },
      ),
    );
  } else if (ctx.headingLevels.length > 0) {
    pushIssue(
      ctx,
      makeIssue(
        "HEADING_MISSING",
        "document",
        `${ctx.headingLevels.length} heading${ctx.headingLevels.length === 1 ? "" : "s"} used for structure.`,
        "passed",
        { type: "document" },
      ),
    );
  }
}

// ── Main composable ─────────────────────────────────────────────────────────

export function accessibilityChecker(
  rows: Ref<any[]>,
  options: {
    /**
     * Body background color. Accept Ref<string> so contrast checks against
     * transparent rows update reactively when the user changes the canvas.
     */
    bodyBg?: Ref<string | undefined> | string;
    emailMeta?: Ref<any> | any;
    /**
     * Merge-tag context (general text). Same shape useEmailBuilder exposes
     * as `mergeTagPreviewContext`. Pass it as a Ref so resolution updates
     * reactively as the user edits preview values.
     */
    mergeTagContext?: Ref<Record<string, string>> | Record<string, string>;
    /**
     * Link-tag context (URL/href fields and anchor leaves). Same shape as
     * `linkTagPreviewContext`.
     */
    linkTagContext?: Ref<Record<string, string>> | Record<string, string>;
    /**
     * True when the user has merge/link preview toggled on. When false,
     * tag resolution is a no-op so the checker sees the raw `{{ tag }}`.
     */
    previewActive?: Ref<boolean> | boolean;
  } = {},
) {
  const ignoredIds = ref<Set<string>>(loadIgnored());

  /** Unwraps either a Ref or a plain value into the underlying value. */
  const unwrap = <T>(maybe: Ref<T> | T | undefined, fallback: T): T => {
    if (maybe === undefined) return fallback;
    if (maybe && typeof maybe === "object" && "value" in (maybe as object)) {
      return (maybe as Ref<T>).value;
    }
    return maybe as T;
  };

  const summary = computed<AccessibilitySummary>(() => {
    const ctx: CheckContext = {
      issues: [],
      ignored: ignoredIds.value,
      parentChain: [],
      bodyBg:
        unwrap(
          options.bodyBg as Ref<string | undefined> | string | undefined,
          "#ffffff",
        ) ?? "#ffffff",
      headingLevels: [],
      textComponentCount: 0,
      links: [],
      mergeTagContext: unwrap(
        options.mergeTagContext,
        {} as Record<string, string>,
      ),
      linkTagContext: unwrap(
        options.linkTagContext,
        {} as Record<string, string>,
      ),
      previewActive: unwrap(options.previewActive, false),
    };

    const rowList: any[] = rows.value ?? [];
    for (const row of rowList) {
      if (!row.columns) continue;
      ctx.parentChain.push({ backgroundColor: row.backgroundColor });
      const cols: any[] = row.columns ?? [];
      cols.forEach((col: any) => {
        ctx.parentChain.push({ backgroundColor: col.backgroundColor });
        const kids = col.children ?? col.components ?? [];
        walkChildren(kids, ctx, 0);
        ctx.parentChain.pop();
      });
      ctx.parentChain.pop();
    }

    // Cross-link checks need every anchor's text/URL, so this only runs
    // once the walk above has fully populated ctx.links.
    checkDuplicateLinkText(ctx);

    const meta = unwrap(
      options.emailMeta as Ref<any> | any | undefined,
      undefined,
    );
    checkDocument(meta, ctx);

    const failed = ctx.issues.filter((i) => i.status === "failed");
    const passed = ctx.issues.filter((i) => i.status === "passed");
    const ignored = ctx.issues.filter((i) => i.status === "ignored");

    const criticalCount = failed.filter(
      (i) => i.severity === "critical",
    ).length;
    const seriousCount = failed.filter((i) => i.severity === "serious").length;

    let status: "good" | "warn" | "bad";
    if (criticalCount > 0) status = "bad";
    else if (seriousCount > 0) status = "warn";
    else status = "good";

    let summaryMessage: string;
    if (status === "good") {
      summaryMessage =
        failed.length === 0 ? "No accessibility issues" : "Looks good";
    } else if (status === "warn") {
      summaryMessage = `${seriousCount} serious issue${seriousCount === 1 ? "" : "s"}`;
    } else {
      summaryMessage = `${criticalCount} critical issue${criticalCount === 1 ? "" : "s"}`;
    }

    return {
      failed,
      passed,
      ignored,
      failedCount: failed.length,
      passedCount: passed.length,
      ignoredCount: ignored.length,
      criticalCount,
      seriousCount,
      status,
      summaryMessage,
    };
  });

  function ignoreIssue(issueId: string) {
    const next = new Set<string>(ignoredIds.value);
    next.add(issueId);
    ignoredIds.value = next;
    persistIgnored(next);
  }

  function restoreIssue(issueId: string) {
    const next = new Set<string>(ignoredIds.value);
    next.delete(issueId);
    ignoredIds.value = next;
    persistIgnored(next);
  }

  function clearIgnored() {
    ignoredIds.value = new Set<string>();
    persistIgnored(ignoredIds.value);
  }

  return {
    summary,
    ignoreIssue,
    restoreIssue,
    clearIgnored,
  };
}
