// composables/emailBuilder/export/merge-tags/mergeTagMapper.ts
//
// Transforms {{ tag }} internal tokens → ESP-native merge tag syntax.
//
// ── Design principle: Zero Vendor Lock-in ────────────────────────────────────
//
// Templates are always stored in the canonical {{ tag }} format.
// This file is the single translation layer between that canonical form and
// any specific ESP's wire format.
//
// Migration path:
// AWS SES (Handlebars) → Klaviyo (Liquid) → Braze → SFMC
// At no point do templates need to be re-authored. Only the export target
// changes.
//
// ── System tags ──────────────────────────────────────────────────────────────
//
// Some tags (unsubscribe_url, webview_url, etc.) have ESP-specific hard-coded
// tokens that are not data-driven. They are mapped in SYSTEM_TAG_MAP and
// resolved before any custom tag logic runs.
//
// ── Custom tags ──────────────────────────────────────────────────────────────
//
// All other tags are transformed via transformCustomTag. Default/fallback
// values are propagated where the ESP syntax supports them; for ESPs that
// don't (e.g. ActiveCampaign has no inline default), the fallback is silently
// dropped so output is still valid.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//
// import { transformToken, transformHTML } from "./mergeTagMapper";
//
// // Single token
// transformToken("first_name", "klaviyo", "Friend")
// // → "{{ first_name | default: 'Friend' }}"
//
// // Full HTML round-trip (replaces all {{ tag }} placeholders)
// transformHTML(exportedHtml, "sfmc")
// // → replaces every {{ tag }} with %%=v(@tag)=%% (or fallback form)

import type { ESPSyntax } from "../logic/espLogicWrapper";
import {
  getRegisteredMergeTagIds,
  getRegisteredMergeTagToken,
} from "@/merge-tags/registry";

// ─── System tag map ───────────────────────────────────────────────────────────
//
// Keys: canonical tag IDs used inside {{ … }}
// Values: partial Record<ESPSyntax, string> — missing keys fall through to
// the generic custom-tag transformer.
//
// Sources:
// Mailchimp https://mailchimp.com/help/all-the-merge-tags-cheat-sheet/
// Klaviyo https://help.klaviyo.com/hc/en-us/articles/115005082927
// Braze https://www.braze.com/docs/user_guide/personalization_and_dynamic_content/liquid/
// SFMC https://help.salesforce.com/s/articleView?id=sf.mc_es_content_areas.htm
// HubSpot https://knowledge.hubspot.com/email/personalization-tokens-overview
// Iterable https://support.iterable.com/hc/en-us/articles/205480365
// Marketo https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/using-tokens
// ActiveCampaign https://help.activecampaign.com/hc/en-us/articles/220557207

type SystemTagMap = Partial<Record<ESPSyntax, string>>;

const SYSTEM_TAG_MAP: Record<string, SystemTagMap> = {
  // ── Unsubscribe ──────────────────────────────────────────────────────────
  unsubscribe_url: {
    handlebars: "{{{unsubscribe_url}}}",
    sendgrid: "{{{unsubscribe_url}}}",
    iterable: "{{unsubscribeUrl}}",
    mailchimp: "*|UNSUB|*",
    klaviyo: "{% unsubscribe_link %}",
    liquid: "{{ unsubscribe_url }}",
    braze: "{{${set_user_to_unsubscribed_url}}}",
    hubspot: "{{ unsubscribe_link_url }}",
    sfmc: "%%unsub_center_url%%",
    activecampaign: "%UNSUBSCRIBELINK%",
    marketo: "{{system.unsubscribeLink}}",
    pardot: "%%unsubscribe%%",
    campaign_monitor: "<unsubscribe>Unsubscribe</unsubscribe>",
  },

  // ── View in browser ──────────────────────────────────────────────────────
  webview_url: {
    handlebars: "{{{webview_url}}}",
    sendgrid: "{{{webview_url}}}",
    iterable: "{{webViewUrl}}",
    mailchimp: "*|ARCHIVE|*",
    klaviyo: "{% web_view_link %}",
    liquid: "{{ webview_url }}",
    braze: "{{ webview_url }}",
    hubspot: "{{ view_as_page_url }}",
    sfmc: "%%view_email_url%%",
    activecampaign: "%VIEWINBROWSERLINK%",
    marketo: "{{system.viewAsWebpageLink}}",
    pardot: "%%view_online%%",
    campaign_monitor: "<webversion>View online</webversion>",
  },

  // ── Email address ────────────────────────────────────────────────────────
  email: {
    handlebars: "{{ email }}",
    sendgrid: "{{ email }}",
    iterable: "{{email}}",
    mailchimp: "*|EMAIL|*",
    klaviyo: "{{ email }}",
    liquid: "{{ email }}",
    braze: "{{${email_address}}}",
    hubspot: "{{ contact.email }}",
    sfmc: "%%emailaddr%%",
    activecampaign: "%EMAIL%",
    marketo: "{{lead.Email Address}}",
    pardot: "%%email%%",
    campaign_monitor: "[email]",
  },

  // ── First name ───────────────────────────────────────────────────────────
  first_name: {
    handlebars: "{{ first_name }}",
    sendgrid: "{{ first_name }}",
    iterable: "{{firstName}}",
    mailchimp: "*|FNAME|*",
    klaviyo: "{{ first_name }}",
    liquid: "{{ first_name }}",
    braze: "{{${first_name}}}",
    hubspot: "{{ contact.firstname }}",
    sfmc: "%%First Name%%",
    activecampaign: "%FIRSTNAME%",
    marketo: "{{lead.First Name}}",
    pardot: "%%first_name%%",
    campaign_monitor: "[firstname]",
  },

  // ── Last name ────────────────────────────────────────────────────────────
  last_name: {
    handlebars: "{{ last_name }}",
    sendgrid: "{{ last_name }}",
    iterable: "{{lastName}}",
    mailchimp: "*|LNAME|*",
    klaviyo: "{{ last_name }}",
    liquid: "{{ last_name }}",
    braze: "{{${last_name}}}",
    hubspot: "{{ contact.lastname }}",
    sfmc: "%%Last Name%%",
    activecampaign: "%LASTNAME%",
    marketo: "{{lead.Last Name}}",
    pardot: "%%last_name%%",
    campaign_monitor: "[lastname]",
  },

  // ── Full name ────────────────────────────────────────────────────────────
  full_name: {
    handlebars: "{{ full_name }}",
    sendgrid: "{{ full_name }}",
    iterable: "{{firstName}} {{lastName}}",
    mailchimp: "*|FNAME|* *|LNAME|*",
    klaviyo: "{{ first_name }} {{ last_name }}",
    liquid: "{{ full_name }}",
    braze: "{{${first_name}}} {{${last_name}}}",
    hubspot: "{{ contact.firstname }} {{ contact.lastname }}",
    sfmc: "%%First Name%% %%Last Name%%",
    activecampaign: "%FIRSTNAME% %LASTNAME%",
    marketo: "{{lead.Full Name}}",
    pardot: "%%full_name%%",
  },

  // ── Company ──────────────────────────────────────────────────────────────
  company: {
    handlebars: "{{ company }}",
    sendgrid: "{{ company }}",
    iterable: "{{company}}",
    mailchimp: "*|COMPANY|*",
    klaviyo: "{{ organization }}",
    liquid: "{{ company }}",
    braze: "{{custom_attribute.${company}}}",
    hubspot: "{{ contact.company }}",
    sfmc: "%%Company%%",
    activecampaign: "%ORG%",
    marketo: "{{lead.Company Name}}",
    pardot: "%%company%%",
  },

  // ── Current date ─────────────────────────────────────────────────────────
  current_date: {
    handlebars: "{{ current_date }}",
    sendgrid: "{{ current_date }}",
    iterable: "{{now}}",
    mailchimp: "*|DATE:d F Y|*",
    klaviyo: "{{ 'now' | date: '%B %d, %Y' }}",
    liquid: "{{ 'now' | date: '%B %d, %Y' }}",
    braze: "{{ 'now' | date: '%B %d, %Y' }}",
    hubspot: "{{ today }}",
    sfmc: "%%=Format(Now(),'M/d/yyyy')=%%",
  },
};

// ─── Custom tag transformer ───────────────────────────────────────────────────

/**
 * Transforms a custom (non-system) tag + optional fallback into the
 * ESP-native merge token string.
 *
 * Fallback support summary:
 * Liquid / Klaviyo / HubSpot → {{ tag | default: 'fallback' }}
 * Braze → {{custom_attribute.tag | default: 'fallback'}}
 * Iterable → {{tag|default:fallback}}
 * Mailchimp → *|TAG:fallback|*
 * SFMC AMPscript → %%=IIF(Empty(@tag),'fallback',@tag)=%%
 * Handlebars / SendGrid → {{ tag }}{{!-- default: fallback --}} (comment)
 * Marketo → {{lead.tag:default fallback}}
 * ActiveCampaign / Pardot /
 * Campaign Monitor → tag only (no inline default mechanism)
 */
const transformCustomTag = (
  tag: string,
  syntax: ESPSyntax,
  fallback?: string,
): string => {
  const hasFallback = !!fallback?.trim();
  const f = fallback?.trim() ?? "";

  switch (syntax) {
    // ── Liquid family ────────────────────────────────────────────────────────
    case "liquid":
    case "klaviyo":
    case "hubspot":
      return hasFallback ? `{{ ${tag} | default: '${f}' }}` : `{{ ${tag} }}`;

    // Braze uses Liquid but custom attributes have a distinct accessor pattern
    case "braze":
      return hasFallback
        ? `{{custom_attribute.${tag} | default: '${f}'}}`
        : `{{custom_attribute.${tag}}}`;

    // ── Handlebars family ────────────────────────────────────────────────────
    // Standard Handlebars has no inline default for variable output. Emit a
    // Handlebars comment so the developer can see the intended fallback.
    case "handlebars":
    case "sendgrid":
      return hasFallback
        ? `{{ ${tag} }}{{!-- default: ${f} --}}`
        : `{{ ${tag} }}`;

    // Iterable supports |default: filter
    case "iterable":
      return hasFallback ? `{{${tag}|default:${f}}}` : `{{${tag}}}`;

    // ── Mailchimp ────────────────────────────────────────────────────────────
    // The *|TAG:fallback|* syntax sets a display fallback when MERGE is empty.
    case "mailchimp":
      return hasFallback
        ? `*|${tag.toUpperCase()}:${f}|*`
        : `*|${tag.toUpperCase()}|*`;

    // ── SFMC AMPscript ───────────────────────────────────────────────────────
    // Simple output: %%=v(@tag)=%%
    // With fallback: %%=IIF(Empty(@tag),'fallback',@tag)=%%
    case "sfmc":
      return hasFallback
        ? `%%=IIF(Empty(@${tag}),'${f}',@${tag})=%%`
        : `%%=v(@${tag})=%%`;

    // ── ActiveCampaign ───────────────────────────────────────────────────────
    // No inline default mechanism — emit the tag token only
    case "activecampaign":
      return `%${tag.toUpperCase()}%`;

    // ── Marketo Velocity ─────────────────────────────────────────────────────
    // Marketo token default syntax: {{lead.tag:default value}}
    case "marketo":
      return hasFallback ? `{{lead.${tag}:default ${f}}}` : `{{lead.${tag}}}`;

    // ── Pardot ───────────────────────────────────────────────────────────────
    case "pardot":
      return `%%${tag}%%`;

    // ── Campaign Monitor ─────────────────────────────────────────────────────
    case "campaign_monitor":
      return `[${tag}]`;

    default:
      return `{{ ${tag} }}`;
  }
};

// ─── System token fallback wrapper ───────────────────────────────────────────
//
// System tags resolve to fixed ESP tokens (e.g. *|FNAME|*{{lead.First Name}})
// whose base form is defined in SYSTEM_TAG_MAP. When the author has written an
// inline default ({{ first_name|'Friend' }}) we need to embed that fallback
// into the already-resolved token using the ESP's own default syntax.
//
// ESPs that do NOT support inline defaults (ActiveCampaign, Pardot, Campaign
// Monitor) receive the bare system token — the fallback is silently dropped,
// which is correct behaviour (those ESPs have no wire format for it).
//
// Fallback embedding rules per ESP:
// Mailchimp *|TOKEN:fallback|*
// Marketo {{lead.Field:default fallback}} — strip outer {{ }}
// Liquid / Klaviyo /
// HubSpot {{ token | default: 'fallback' }} — strip outer {{ }}
// Braze {{${field} | default: 'fallback'}} — strip outer {{ }}
// Iterable {{field|default:fallback}} — strip outer {{ }}
// SFMC %%=IIF(Empty(%%TOKEN%%),'fallback',%%TOKEN%%)=%%
// Handlebars /
// SendGrid token{{!-- default: fallback --}} (comment annotation)
//
// Tags where the system token is a multi-token expansion (e.g. full_name →
// *|FNAME|* *|LNAME|*) are returned as-is even with a fallback, since there
// is no single-value wire format to inject the default into.

const applyFallbackToSystemToken = (
  token: string,
  syntax: ESPSyntax,
  fallback: string,
): string => {
  const f = fallback.trim();
  if (!f) return token;

  switch (syntax) {
    // ── Mailchimp: *|TOKEN|* → *|TOKEN:fallback|* ────────────────────────────
    case "mailchimp": {
      // Guard against multi-token expansions like *|FNAME|* *|LNAME|*
      const singleToken = /^\*\|[\w:]+\|\*$/.test(token);
      if (!singleToken) return token;
      return token.replace(/\|\*$/, `:${f}|*`);
    }

    // ── Marketo: {{lead.Field}} → {{lead.Field:default fallback}} ────────────
    case "marketo": {
      const singleToken = /^\{\{[^}]+\}\}$/.test(token);
      if (!singleToken) return token;
      // Strip trailing }} and append :default value
      return token.replace(/\}\}$/, `:default ${f}}}`);
    }

    // ── Liquid family: {{ field }} → {{ field | default: 'fallback' }} ───────
    case "liquid":
    case "klaviyo":
    case "hubspot": {
      const singleToken = /^\{\{\s*[^}]+\s*\}\}$/.test(token);
      if (!singleToken) return token;
      return token.replace(/\s*\}\}$/, ` | default: '${f}'}}`);
    }

    // ── Braze: {{${field}}} → {{${field} | default: 'fallback'}} ────────────
    case "braze": {
      const singleToken = /^\{\{[^}]+\}\}$/.test(token);
      if (!singleToken) return token;
      return token.replace(/\}\}$/, ` | default: '${f}'}}`);
    }

    // ── Iterable: {{field}} → {{field|default:fallback}} ─────────────────────
    case "iterable": {
      const singleToken = /^\{\{[^}]+\}\}$/.test(token);
      if (!singleToken) return token;
      return token.replace(/\}\}$/, `|default:${f}}}`);
    }

    // ── SFMC: %%token%% → %%=IIF(Empty(%%token%%),'fallback',%%token%%)=%% ───
    case "sfmc": {
      const singleToken = /^%%[^%]+%%$/.test(token);
      if (!singleToken) return token;
      return `%%=IIF(Empty(${token}),'${f}',${token})=%%`;
    }

    // ── Handlebars / SendGrid: annotate with a comment ───────────────────────
    case "handlebars":
    case "sendgrid":
      return `${token}{{!-- default: ${f} --}}`;

    // ── No inline default mechanism for these ESPs ────────────────────────────
    case "activecampaign":
    case "pardot":
    case "campaign_monitor":
    default:
      return token;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Transforms a single canonical tag ID into the target ESP's native token.
 *
 * Resolution order:
 * 1. SYSTEM_TAG_MAP lookup — use the ESP-specific hard-coded token as the
 * base, then embed any inline fallback using applyFallbackToSystemToken.
 * 2. transformCustomTag — generic rules for unknown/custom tags (includes
 * full fallback support).
 *
 * Previously, returned the bare system token and silently discarded
 * the fallback. Now the fallback is threaded through for all ESPs that have
 * a wire-format mechanism for it.
 *
 * @param tagId Canonical tag name as stored inside {{ … }}.
 * @param syntax Target ESP.
 * @param fallback Optional default value to embed where the ESP supports it.
 */
export const transformToken = (
  tagId: string,
  syntax: ESPSyntax,
  fallback?: string,
): string => {
  const systemEntry = SYSTEM_TAG_MAP[tagId];
  if (systemEntry) {
    const token = systemEntry[syntax];
    if (token) {
      // System token found — apply the inline fallback if one was provided.
      // Tags with no default mechanism (e.g. *|UNSUB|*) are returned as-is.
      return fallback?.trim()
        ? applyFallbackToSystemToken(token, syntax, fallback)
        : token;
    }
  }

  // Registered custom tag with an explicit per-ESP override — most
  // registered tags won't have one, which is intentional (see
  // src/merge-tags/registry.ts); the generic transform below already
  // handles arbitrary tag names correctly for ordinary data fields.
  const customToken = getRegisteredMergeTagToken(tagId, syntax);
  if (customToken) {
    return fallback?.trim()
      ? applyFallbackToSystemToken(customToken, syntax, fallback)
      : customToken;
  }

  return transformCustomTag(tagId, syntax, fallback);
};

/**
 * Transforms ALL {{ tag }} / {{ tag|'default' }} placeholders in an HTML
 * string to the target ESP's native merge tag syntax in one pass.
 *
 * Also handles TipTap-produced
 * <span data-merge="tag" data-merge-default="value">…</span> nodes.
 *
 * The `//s` flag on the span regex handles multiline rich-text nodes.
 *
 * @param html Raw HTML string (from the email builder export).
 * @param syntax Target ESP syntax.
 */
export const transformHTML = (html: string, syntax: ESPSyntax): string => {
  if (!html) return "";

  // ── TipTap span[data-merge] nodes ──────────────────────────────
  // More specific than the plain-token regex — process first.
  // Reads the default from data-merge-default (the attribute TipTap writes).
  let result = html.replace(
    /<span[^>]*\bdata-merge="([^"]+)"(?:[^>]*\bdata-merge-default="([^"]*)")?[^>]*>.*?<\/span>/gs,
    (_match, tagId: string, fallback?: string) =>
      transformToken(tagId, syntax, fallback?.trim() || undefined),
  );

  // ── Remaining {{ tag }} and {{ tag|'default' }} tokens ──────────
  // Supports bare-word tags and quoted tag names: {{ 'hero'|'Superman' }}
  result = result.replace(
    /\{\{\s*(?:'([^']*)'|"([^"]*)"|(\w+))(?:\s*\|\s*(?:'([^']*)'|"([^"]*)"|([^'"\}\s][^'"\}]*?)))?\s*\}\}/g,
    (_match, sq1, dq1, bare1, sq2, dq2, bare2) => {
      const tagId = (sq1 ?? dq1 ?? bare1 ?? "").trim();
      const fallback = (sq2 ?? dq2 ?? bare2 ?? "").trim();
      return transformToken(tagId, syntax, fallback || undefined);
    },
  );

  return result;
};

/**
 * Returns the list of all system tag canonical IDs.
 * Use this to render a "Common tags" palette in the UI.
 */
export const getSystemTagIds = (): string[] => [
  ...Object.keys(SYSTEM_TAG_MAP),
  ...getRegisteredMergeTagIds(),
];

/**
 * Returns the system token for a tag + syntax pair, or null if not a system
 * tag for that ESP. Useful for tooltip/preview rendering.
 */
export const getSystemToken = (
  tagId: string,
  syntax: ESPSyntax,
): string | null => SYSTEM_TAG_MAP[tagId]?.[syntax] ?? null;
