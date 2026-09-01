// composables/emailBuilder/export/logic/espLogicWrapper.ts
//
// Converts a VisibilityConfig into ESP-native conditional wrapping tags.
// ✅ Now supports nested groups in addition to flat rules.
// ✅ Liquid date rules use {% assign %} preludes for safe timestamp comparison
// ✅ Mailchimp uses nested *|IF|* blocks instead of inline AND/OR
//
// Supported syntaxes
// ──────────────────
// handlebars Handlebars.js / custom helpers {{#if …}}…{{/if}}
// sendgrid SendGrid (Handlebars) {{#if …}}…{{/if}}
// iterable Iterable (Handlebars-like) {{#if …}}…{{/if}}
// mailchimp Mailchimp merge-tag conditionals *|IF:…|* … *|END:IF|*
// klaviyo Klaviyo (Liquid) {% if … %} … {% endif %}
// liquid Generic Liquid (Braze, Shopify) {% if … %} … {% endif %}
// braze Braze (Liquid + Connected Content){% if … %} … {% endif %}
// hubspot HubSpot (HubL — Liquid-based) {% if … %} … {% endif %}
// sfmc Salesforce MC (AMPscript) %%[IF … THEN]%% … %%[ENDIF]%%
// activecampaign ActiveCampaign (custom tags) %IF …% … %/IF%
// marketo Marketo (Velocity) #if(…) … #end
// campaign_monitor Campaign Monitor (custom) <singleline:…>…</singleline>
// pardot Pardot / MCAE %%if … %% … %%endif%%
// mso Outlook VML Conditional Comments <!--[if …]>…<![endif]-->

import type { VisibilityOperator } from "../../core/useEmailBuilderVisibility";
import { tagToIdentifier } from "../shared/tagIdentifier";
import { getESPMetaSafe, getESPOverrides } from "@/esp/registry";

export type KnownESPSyntax =
  | "handlebars"
  | "sendgrid"
  | "mailchimp"
  | "klaviyo"
  | "liquid"
  | "braze"
  | "sfmc"
  | "hubspot"
  | "iterable"
  | "activecampaign"
  | "marketo"
  | "campaign_monitor"
  | "pardot"
  | "mso";

// widened for the ESP registry (src/esp/registry.ts). Every known
// literal still autocompletes; (string & {}) additionally accepts a
// registered custom syntax id without losing that autocomplete — the
// standard TS "open union" pattern.
export type ESPSyntax = KnownESPSyntax | (string & {});

export interface ESPSyntaxMeta {
  label: string;
  group: "handlebars" | "liquid" | "ampscript" | "custom" | "mso";
  description: string;
  docsUrl?: string;
  /**
   * Whether this ESP supports boolean nesting / parenthesised sub-expressions.
   * When false, buildFullExpression flattens all rules to a single level and
   * the UI should warn the user that nested groups are not supported.
   */
  supportsNesting: boolean;
}

export const ESP_SYNTAX_META: Record<KnownESPSyntax, ESPSyntaxMeta> = {
  handlebars: {
    label: "Handlebars (Generic)",
    group: "handlebars",
    description: "Generic Handlebars.js template syntax",
    supportsNesting: true,
  },
  sendgrid: {
    label: "SendGrid",
    group: "handlebars",
    description: "SendGrid Dynamic Templates (Handlebars)",
    docsUrl:
      "https://docs.sendgrid.com/for-developers/sending-email/using-handlebars",
    supportsNesting: true,
  },
  iterable: {
    label: "Iterable",
    group: "handlebars",
    description: "Iterable templating (Handlebars-compatible)",
    docsUrl: "https://support.iterable.com/hc/en-us/articles/205480365",
    supportsNesting: true,
  },
  mailchimp: {
    label: "Mailchimp",
    group: "custom",
    description: "Mailchimp merge tag conditionals *|IF:…|*",
    docsUrl: "https://mailchimp.com/help/use-conditional-merge-tag-blocks/",
    supportsNesting: false, // *|IF|* tags must be nested, not joined with AND/OR
  },
  klaviyo: {
    label: "Klaviyo",
    group: "liquid",
    description: "Klaviyo (Liquid templating)",
    docsUrl: "https://help.klaviyo.com/hc/en-us/articles/115002775012",
    supportsNesting: true,
  },
  liquid: {
    label: "Liquid (Generic)",
    group: "liquid",
    description: "Generic Liquid template syntax (Shopify, etc.)",
    supportsNesting: true,
  },
  braze: {
    label: "Braze",
    group: "liquid",
    description: "Braze (Liquid + Connected Content)",
    docsUrl:
      "https://www.braze.com/docs/user_guide/personalization_and_dynamic_content/liquid/",
    supportsNesting: true,
  },
  hubspot: {
    label: "HubSpot",
    group: "liquid",
    description: "HubSpot (HubL — Liquid-based)",
    docsUrl: "https://developers.hubspot.com/docs/cms/hubl/intro-to-hubl",
    supportsNesting: true,
  },
  sfmc: {
    label: "Salesforce Marketing Cloud",
    group: "ampscript",
    description: "SFMC AMPscript conditionals",
    docsUrl: "https://ampscript.guide/if/",
    supportsNesting: true,
  },
  activecampaign: {
    label: "ActiveCampaign",
    group: "custom",
    description: "ActiveCampaign conditional content tags",
    docsUrl: "https://help.activecampaign.com/hc/en-us/articles/220358207",
    supportsNesting: true,
  },
  marketo: {
    label: "Marketo",
    group: "custom",
    description: "Marketo Velocity Script conditionals",
    docsUrl:
      "https://nation.marketo.com/t5/product-blogs/velocity-scripting/ba-p/232782",
    supportsNesting: true,
  },
  campaign_monitor: {
    label: "Campaign Monitor",
    group: "custom",
    description: "Campaign Monitor conditional merge tags",
    docsUrl:
      "https://help.campaignmonitor.com/custom-fields-and-personalization",
    supportsNesting: false, // only supports basic Tag=Value logic
  },
  pardot: {
    label: "Pardot / MCAE",
    group: "custom",
    description: "Pardot (Marketing Cloud Account Engagement) conditionals",
    docsUrl:
      "https://help.salesforce.com/s/articleView?id=pardot_variable_tags.htm",
    supportsNesting: false, // only supports basic Tag=Value logic
  },
  mso: {
    label: "Outlook (MSO)",
    group: "mso",
    description: "Microsoft Office VML conditional comments for Outlook",
    supportsNesting: false, // VML comments have no runtime boolean logic
  },
};

// ─── Operator support matrix ──────────────────────────────────────────────────

export type SupportLevel = "native" | "helper" | "fallback" | "none";

export interface OperatorSupportRow {
  syntax: ESPSyntax;
  label: string;
  eq: SupportLevel;
  neq: SupportLevel;
  contains: SupportLevel;
  not_contains: SupportLevel;
  starts_with: SupportLevel;
  ends_with: SupportLevel;
  in: SupportLevel;
  not_in: SupportLevel;
  numeric: SupportLevel;
  is_empty: SupportLevel;
  /** date_before / date_after / date_on */
  date: SupportLevel;
}

export const OPERATOR_SUPPORT_MATRIX: OperatorSupportRow[] = [
  {
    syntax: "handlebars",
    label: "Handlebars",
    eq: "native",
    neq: "helper",
    contains: "helper",
    not_contains: "helper",
    starts_with: "helper",
    ends_with: "helper",
    in: "helper",
    not_in: "helper",
    numeric: "helper",
    is_empty: "helper",
    date: "helper", // requires a custom {{dateBefore}} / {{dateAfter}} helper
  },
  {
    syntax: "sendgrid",
    label: "SendGrid",
    eq: "native",
    neq: "none",
    contains: "none",
    not_contains: "none",
    starts_with: "none",
    ends_with: "none",
    in: "none",
    not_in: "none",
    numeric: "none",
    is_empty: "none",
    date: "none",
  },
  {
    syntax: "iterable",
    label: "Iterable",
    eq: "native",
    neq: "helper",
    contains: "helper",
    not_contains: "helper",
    starts_with: "helper",
    ends_with: "helper",
    in: "helper",
    not_in: "helper",
    numeric: "helper",
    is_empty: "helper",
    date: "helper", // requires a custom {{dateBefore}} / {{dateAfter}} helper
  },
  {
    syntax: "liquid",
    label: "Liquid",
    eq: "native",
    neq: "native",
    contains: "native",
    not_contains: "native",
    starts_with: "none",
    ends_with: "none",
    in: "fallback",
    not_in: "fallback",
    numeric: "native",
    is_empty: "native",
    date: "native", // uses prelude + timestamp comparison
  },
  {
    syntax: "klaviyo",
    label: "Klaviyo",
    eq: "native",
    neq: "native",
    contains: "native",
    not_contains: "native",
    starts_with: "none",
    ends_with: "none",
    in: "fallback",
    not_in: "fallback",
    numeric: "native",
    is_empty: "native",
    date: "native", // uses prelude + timestamp comparison
  },
  {
    syntax: "braze",
    label: "Braze",
    eq: "native",
    neq: "native",
    contains: "native",
    not_contains: "native",
    starts_with: "none",
    ends_with: "none",
    in: "fallback",
    not_in: "fallback",
    numeric: "native",
    is_empty: "native",
    date: "native", // uses prelude + timestamp comparison
  },
  {
    syntax: "hubspot",
    label: "HubSpot",
    eq: "native",
    neq: "native",
    contains: "native",
    not_contains: "native",
    starts_with: "none",
    ends_with: "none",
    in: "fallback",
    not_in: "fallback",
    numeric: "native",
    is_empty: "native",
    date: "native", // uses prelude + timestamp comparison
  },
  {
    syntax: "sfmc",
    label: "SFMC",
    eq: "native",
    neq: "native",
    contains: "native",
    not_contains: "native",
    starts_with: "native",
    ends_with: "native",
    in: "fallback",
    not_in: "fallback",
    numeric: "native",
    is_empty: "native",
    date: "native", // DateParse() + DateDiff() comparison
  },
  {
    syntax: "activecampaign",
    label: "ActiveCampaign",
    eq: "native",
    neq: "native",
    contains: "native",
    not_contains: "native",
    starts_with: "none",
    ends_with: "none",
    in: "native",
    not_in: "fallback",
    numeric: "native",
    is_empty: "native",
    date: "fallback", // string comparison — no native date type
  },
  {
    syntax: "marketo",
    label: "Marketo",
    eq: "native",
    neq: "native",
    contains: "native",
    not_contains: "native",
    starts_with: "native",
    ends_with: "native",
    in: "fallback",
    not_in: "fallback",
    numeric: "native",
    is_empty: "native",
    date: "native", // Velocity $date.parse() comparison
  },
  {
    syntax: "mailchimp",
    label: "Mailchimp",
    eq: "native",
    neq: "native",
    contains: "fallback",
    not_contains: "fallback",
    starts_with: "fallback",
    ends_with: "fallback",
    in: "fallback",
    not_in: "fallback",
    numeric: "native",
    is_empty: "fallback",
    date: "fallback", // ISO string comparison via numeric operators
  },
  {
    syntax: "pardot",
    label: "Pardot",
    eq: "native",
    neq: "native",
    contains: "none",
    not_contains: "none",
    starts_with: "none",
    ends_with: "none",
    in: "none",
    not_in: "none",
    numeric: "none",
    is_empty: "none",
    date: "none",
  },
  {
    syntax: "campaign_monitor",
    label: "Campaign Monitor",
    eq: "native",
    neq: "native",
    contains: "none",
    not_contains: "none",
    starts_with: "none",
    ends_with: "none",
    in: "none",
    not_in: "none",
    numeric: "none",
    is_empty: "none",
    date: "none",
  },
  {
    syntax: "mso",
    label: "MSO/Outlook",
    eq: "native",
    neq: "none",
    contains: "none",
    not_contains: "none",
    starts_with: "none",
    ends_with: "none",
    in: "none",
    not_in: "none",
    numeric: "none",
    is_empty: "none",
    date: "none",
  },
];

// ─── Tag name resolver ────────────────────────────────────────────────────────

const resolveTag = (tag: string, syntax: ESPSyntax): string => {
  // Sanitise to a valid identifier first so a tag with spaces/dots ("is Premium")
  // can't break a bare field reference like `(eq is Premium 'true')`. No-op for
  // tags that are already valid identifiers, and matches the mapping
  // reactLogicWrapper uses, so a field is named consistently across exports.
  const id = tagToIdentifier(tag);
  switch (syntax) {
    // AttributeValue() safely returns an empty string when the DE attribute is
    // absent, preventing AMPscript runtime errors on missing fields.
    case "sfmc":
      return `AttributeValue("${id}")`;
    // $!{tag} is Velocity's "silent formal reference" — evaluates to an empty
    // string instead of throwing when the variable is null or undefined.
    case "marketo":
      return `$!{${id}}`;
    case "mailchimp":
      return id.toUpperCase();
    default:
      return id;
  }
};

// ─── Rule → expression builder ────────────────────────────────────────────────

const buildRuleExpression = (
  rule: { tag: string; operator: VisibilityOperator | string; value: string },
  syntax: ESPSyntax,
): string | null => {
  const { operator, value } = rule;
  const t = resolveTag(rule.tag, syntax);

  switch (syntax) {
    case "handlebars":
    case "sendgrid":
    case "iterable": {
      switch (operator as VisibilityOperator) {
        case "==":
          return `(eq ${t} '${value}')`;
        case "!=":
          return `(neq ${t} '${value}')`;
        case "contains":
          return `(contains ${t} '${value}')`;
        case "not_contains":
          return `(not (contains ${t} '${value}'))`;
        case "starts_with":
          return `(startsWith ${t} '${value}')`;
        case "ends_with":
          return `(endsWith ${t} '${value}')`;
        case "in": {
          const vals = value
            .split(",")
            .map((v) => `'${v.trim()}'`)
            .join(" ");
          return `(in ${t} ${vals})`;
        }
        case "not_in": {
          const vals = value
            .split(",")
            .map((v) => `'${v.trim()}'`)
            .join(" ");
          return `(not (in ${t} ${vals}))`;
        }
        case ">":
          return `(gt ${t} ${value})`;
        case "<":
          return `(lt ${t} ${value})`;
        case ">=":
          return `(gte ${t} ${value})`;
        case "<=":
          return `(lte ${t} ${value})`;
        case "is_empty":
          return `(isEmpty ${t})`;
        case "is_not_empty":
          return `(not (isEmpty ${t}))`;
        case "date_before":
          return `(dateBefore ${t} '${value}')`;
        case "date_after":
          return `(dateAfter ${t} '${value}')`;
        case "date_on":
          return `(dateOn ${t} '${value}')`;
        default:
          return `(eq ${t} '${value}')`;
      }
    }

    case "liquid":
    case "klaviyo":
    case "braze":
    case "hubspot": {
      switch (operator as VisibilityOperator) {
        case "==":
          return `${t} == '${value}'`;
        case "!=":
          return `${t} != '${value}'`;
        case "contains":
          return `${t} contains '${value}'`;
        // ✅ Fixed: `not (x contains y)` is the correct idiomatic form
        case "not_contains":
          return `not (${t} contains '${value}')`;
        // ✅ Fixed: starts_with / ends_with have no equivalent in Liquid
        // Return null to skip the rule entirely
        case "starts_with":
        case "ends_with":
          return null;
        case "in": {
          const vals = value.split(",").map((v) => `${t} == '${v.trim()}'`);
          return vals.join(" or ");
        }
        case "not_in": {
          const vals = value.split(",").map((v) => `${t} != '${v.trim()}'`);
          return vals.join(" and ");
        }
        case ">":
          return `${t} > ${value}`;
        case "<":
          return `${t} < ${value}`;
        case ">=":
          return `${t} >= ${value}`;
        case "<=":
          return `${t} <= ${value}`;
        case "is_empty":
          return `${t} == blank`;
        case "is_not_empty":
          return `${t} != blank`;
        // ── Date (Liquid) ──────────────────────────────────────────────────────
        // Liquid filters cannot be compared inline — expressions like
        // `tag | date: '%s' < '2026-01-01' | date: '%s'`
        // are misparse by every major Liquid engine. Instead, the prelude
        // system (buildLiquidDatePreludes) emits {% assign %} lines before
        // the {% if %} tag, capturing unix timestamps in stable variables.
        //
        // The variable names here MUST match what buildLiquidDatePreludes
        // emits — both use liquidVarName() / liquidCmpVarName() so they are
        // always in sync even if the naming scheme changes in future.
        //
        // date_on uses %F (%Y-%m-%d) string equality — no prelude needed
        // because ISO date strings compare correctly as plain strings.
        case "date_before":
          return `${liquidVarName(rule.tag)} < ${liquidCmpVarName(rule.tag, value)}`;
        case "date_after":
          return `${liquidVarName(rule.tag)} > ${liquidCmpVarName(rule.tag, value)}`;
        case "date_on":
          return `${t} | date: '%F' == '${value}'`;
        default:
          return `${t} == '${value}'`;
      }
    }

    case "mailchimp": {
      switch (operator as VisibilityOperator) {
        case "==":
          return `${t}='${value}'`;
        case "!=":
          return `${t}!='${value}'`;
        case ">":
        case "<":
        case ">=":
        case "<=": {
          const num = Number(value);
          if (!Number.isNaN(num)) {
            return `${t}${operator}${num}`;
          }
          return `${t}='${value}'`;
        }
        // ── Date ── Mailchimp has no native date type; ISO strings (YYYY-MM-DD)
        // sort correctly as plain strings.
        case "date_before":
          return `${t}<'${value}'`;
        case "date_after":
          return `${t}>'${value}'`;
        case "date_on":
          return `${t}='${value}'`;
        default:
          return `${t}='${value}'`;
      }
    }

    case "sfmc": {
      switch (operator as VisibilityOperator) {
        case "==":
          return `${t} == '${value}'`;
        case "!=":
          return `${t} != '${value}'`;
        case "contains":
          return `Contains(${t}, '${value}')`;
        case "not_contains":
          return `Not Contains(${t}, '${value}')`;
        case "starts_with":
          return `IndexOf(${t}, '${value}') == 1`;
        case "ends_with":
          return `Substring(${t}, Subtract(Length(${t}), Subtract(Length('${value}'), 1)), Length('${value}')) == '${value}'`;
        case "in": {
          return value
            .split(",")
            .map((v) => `${t} == '${v.trim()}'`)
            .join(" OR ");
        }
        case "not_in": {
          return value
            .split(",")
            .map((v) => `${t} != '${v.trim()}'`)
            .join(" AND ");
        }
        case ">":
          return `${t} > ${value}`;
        case "<":
          return `${t} < ${value}`;
        case ">=":
          return `${t} >= ${value}`;
        case "<=":
          return `${t} <= ${value}`;
        case "is_empty":
          return `Empty(${t})`;
        case "is_not_empty":
          return `Not Empty(${t})`;
        // ── Date ── AMPscript DateParse + DateDiff comparison
        case "date_before":
          return `DateDiff(DateParse(${t}), DateParse('${value}'), "D") < 0`;
        case "date_after":
          return `DateDiff(DateParse(${t}), DateParse('${value}'), "D") > 0`;
        case "date_on":
          return `DateDiff(DateParse(${t}), DateParse('${value}'), "D") == 0`;
        default:
          return `${t} == '${value}'`;
      }
    }

    case "activecampaign": {
      switch (operator as VisibilityOperator) {
        case "==":
          return `${t} EQUALS ${value}`;
        case "!=":
          return `${t} NOT EQUALS ${value}`;
        case "contains":
          return `${t} CONTAINS ${value}`;
        case "not_contains":
          return `${t} NOT CONTAINS ${value}`;
        // ✅ starts_with / ends_with have no equivalent in ActiveCampaign.
        // Degrading to CONTAINS introduces false positives (a rule checking
        // "starts with he" would also pass for "spaghetti" via CONTAINS).
        // Return null to skip the rule so the output is never silently wrong.
        case "starts_with":
        case "ends_with":
          return null;
        case "in":
          return `${t} IN ${value
            .split(",")
            .map((v) => v.trim())
            .join(",")}`;
        case "not_in":
          return `${t} NOT IN ${value
            .split(",")
            .map((v) => v.trim())
            .join(",")}`;
        case ">":
          return `${t} GREATER THAN ${value}`;
        case "<":
          return `${t} LESS THAN ${value}`;
        case ">=":
          return `${t} GREATER THAN OR EQUAL TO ${value}`;
        case "<=":
          return `${t} LESS THAN OR EQUAL TO ${value}`;
        case "is_empty":
          return `${t} IS EMPTY`;
        case "is_not_empty":
          return `${t} IS NOT EMPTY`;
        // ── Date ── ActiveCampaign stores dates as ISO strings; lexicographic
        // comparison works correctly for YYYY-MM-DD formatted values.
        case "date_before":
          return `${t} LESS THAN ${value}`;
        case "date_after":
          return `${t} GREATER THAN ${value}`;
        case "date_on":
          return `${t} EQUALS ${value}`;
        default:
          return `${t} EQUALS ${value}`;
      }
    }

    case "marketo": {
      switch (operator as VisibilityOperator) {
        case "==":
          return `${t} == '${value}'`;
        case "!=":
          return `${t} != '${value}'`;
        // $!{tag} (already resolved by resolveTag) prevents null reference errors
        case "contains":
          return `${t} && ${t}.contains('${value}')`;
        case "not_contains":
          return `!${t} || !${t}.contains('${value}')`;
        case "starts_with":
          return `${t}.startsWith('${value}')`;
        case "ends_with":
          return `${t}.endsWith('${value}')`;
        case "in":
          return value
            .split(",")
            .map((v) => `${t} == '${v.trim()}'`)
            .join(" || ");
        case "not_in":
          return value
            .split(",")
            .map((v) => `${t} != '${v.trim()}'`)
            .join(" && ");
        case ">":
          return `${t}.toInteger() > ${value}`;
        case "<":
          return `${t}.toInteger() < ${value}`;
        case ">=":
          return `${t}.toInteger() >= ${value}`;
        case "<=":
          return `${t}.toInteger() <= ${value}`;
        case "is_empty":
          return `!${t} || ${t} == ''`;
        case "is_not_empty":
          return `${t} && ${t} != ''`;
        // ── Date ── Velocity $date.parse() comparison
        case "date_before":
          return `$date.parse('yyyy-MM-dd', ${t}).before($date.parse('yyyy-MM-dd', '${value}'))`;
        case "date_after":
          return `$date.parse('yyyy-MM-dd', ${t}).after($date.parse('yyyy-MM-dd', '${value}'))`;
        case "date_on":
          return `$date.parse('yyyy-MM-dd', ${t}).equals($date.parse('yyyy-MM-dd', '${value}'))`;
        default:
          return `${t} == '${value}'`;
      }
    }

    case "campaign_monitor":
    case "pardot": {
      switch (operator as VisibilityOperator) {
        case "==":
          return `${t}='${value}'`;
        case "!=":
          return `${t}!='${value}'`;
        case "date_before":
        case "date_after":
        case "date_on":
          return `${t}='${value}'`; // best-effort string fallback
        default:
          return `${t}='${value}'`;
      }
    }

    case "mso":
      return "mso | IE";

    default:
      return `${t} == '${value}'`;
  }
};

// ─── Condition joiner ─────────────────────────────────────────────────────────

const joinExpressions = (
  expressions: string[],
  match: "all" | "any",
  syntax: ESPSyntax,
): string => {
  if (expressions.length === 1) return expressions[0];

  switch (syntax) {
    case "handlebars":
    case "sendgrid":
    case "iterable":
      return match === "all"
        ? `(and ${expressions.join(" ")})`
        : `(or ${expressions.join(" ")})`;

    case "sfmc":
    case "activecampaign":
    case "mailchimp":
    case "campaign_monitor":
    case "pardot":
      return expressions.join(match === "all" ? " AND " : " OR ");

    case "marketo":
      return expressions.join(match === "all" ? " && " : " || ");

    case "liquid":
    case "klaviyo":
    case "braze":
    case "hubspot":
      return expressions.join(match === "all" ? " and " : " or ");

    default:
      return expressions.join(match === "all" ? " && " : " || ");
  }
};

// ─── Open / close tag builders ────────────────────────────────────────────────

const buildOpenTag = (expression: string, syntax: ESPSyntax): string => {
  const override = getESPOverrides(syntax)?.wrapOpenTag;
  if (override) return override(expression);

  switch (syntax) {
    case "handlebars":
    case "sendgrid":
    case "iterable":
      return `{{#if ${expression}}}`;
    case "liquid":
    case "klaviyo":
    case "braze":
    case "hubspot":
      return `{% if ${expression} %}`;
    case "mailchimp":
      return `*|IF:${expression}|*`;
    case "sfmc":
      return `%%[ IF ${expression} THEN ]%%`;
    case "activecampaign":
      return `%IF ${expression}%`;
    case "marketo":
      return `#if(${expression})`;
    case "campaign_monitor":
      return `<singleline:${expression}>`;
    case "pardot":
      return `%%if ${expression}%%`;
    case "mso":
      return `<!--[if ${expression}]>`;
    default:
      return `{{#if ${expression}}}`;
  }
};

const buildCloseTag = (syntax: ESPSyntax): string => {
  const override = getESPOverrides(syntax)?.wrapCloseTag;
  if (override) return override();

  switch (syntax) {
    case "handlebars":
    case "sendgrid":
    case "iterable":
      return `{{/if}}`;
    case "liquid":
    case "klaviyo":
    case "braze":
    case "hubspot":
      return `{% endif %}`;
    case "mailchimp":
      return `*|END:IF|*`;
    case "sfmc":
      return `%%[ ENDIF ]%%`;
    case "activecampaign":
      return `%/IF%`;
    case "marketo":
      return `#end`;
    case "campaign_monitor":
      return `</singleline>`;
    case "pardot":
      return `%%endif%%`;
    case "mso":
      return `<![endif]-->`;
    default:
      return `{{/if}}`;
  }
};

// ─── Public types ─────────────────────────────────────────────────────────────

export interface VisibilityRuleForESP {
  tag: string;
  operator: string;
  value: string;
}

export interface VisibilityGroupForESP {
  match: "all" | "any";
  rules: VisibilityRuleForESP[];
}

export interface VisibilityConfigForESP {
  enabled: boolean;
  match: "all" | "any";
  rules: VisibilityRuleForESP[];
  groups?: VisibilityGroupForESP[];
}

// ─── Liquid date prelude helpers ─────────────────────────────────────────────

/**
 * Generates a safe, deterministic Liquid variable name from a field tag.
 *
 * Liquid variable names must be alphanumeric + underscores. We prefix with
 * __esp_ (two underscores to minimise collision with real field names; a
 * user with a field literally named __esp_start_date would still collide,
 * but this is an extreme edge case vs. the __ts_ prefix which was more
 * likely to clash with e.g. __ts_created fields).
 *
 * Used for both the tag-side and value-side assign variable names so the
 * expression string and the prelude always refer to the exact same variable.
 */
const liquidVarName = (tag: string): string =>
  `__esp_ts_${tag.replace(/[^a-zA-Z0-9]/g, "_")}`;

/**
 * Generates the comparison-side variable name. The slug encodes both the
 * tag name and the comparison value so that two date rules on the same field
 * with different target dates each get their own assign variable.
 *
 * date_field date_before 2026-01-01 → __esp_cmp_date_field_2026_01_01
 * date_field date_before 2026-06-30 → __esp_cmp_date_field_2026_06_30
 *
 * Without encoding the value, the second rule would silently overwrite the
 * first cmp variable, making both conditions evaluate against the same date.
 */
const liquidCmpVarName = (tag: string, value: string): string =>
  `__esp_cmp_${tag.replace(/[^a-zA-Z0-9]/g, "_")}_${value.replace(/[^a-zA-Z0-9]/g, "_")}`;

/**
 * Collects {% assign %} prelude lines needed before a {% if %} tag for any
 * Liquid-based ESP date rules. Liquid filters cannot be used inline inside
 * {% if %} comparisons — they must be captured into variables first.
 *
 * For date_before / date_after: emits two {% assign %} lines that convert
 * both the tag value and the comparison date to unix timestamps (%s).
 * For date_on: no prelude needed (string comparison via %F in the expression).
 *
 * Deduplication is keyed on the full variable name (which encodes tag + value)
 * so multiple rules on the same tag with different dates each get their own
 * assign, and genuinely identical rules don't emit duplicate assigns.
 */
const buildLiquidDatePreludes = (rules: VisibilityRuleForESP[]): string[] => {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const rule of rules) {
    const op = rule.operator as VisibilityOperator;
    if (op !== "date_before" && op !== "date_after") continue;

    const tagVar = liquidVarName(rule.tag);
    const cmpVar = liquidCmpVarName(rule.tag, rule.value);

    // Tag-side: one assign per unique field (same field used in multiple date
    // rules only needs one assign — the field value doesn't change per rule).
    if (!seen.has(tagVar)) {
      seen.add(tagVar);
      lines.push(
        `{%- assign ${tagVar} = ${tagToIdentifier(rule.tag)} | date: '%s' -%}`,
      );
    }
    // Cmp-side: keyed on tag + value so different target dates each get their
    // own variable. Same tag + same value = genuinely identical rule → deduped.
    if (!seen.has(cmpVar)) {
      seen.add(cmpVar);
      lines.push(`{%- assign ${cmpVar} = '${rule.value}' | date: '%s' -%}`);
    }
  }
  return lines;
};

const isLiquidSyntax = (syntax: ESPSyntax): boolean =>
  syntax === "liquid" ||
  syntax === "klaviyo" ||
  syntax === "braze" ||
  syntax === "hubspot";

// ─── Mailchimp nested IF builder ─────────────────────────────────────────────

/**
 * Mailchimp does not reliably support AND / OR inside a single *|IF:…|* tag,
 * especially with complex operators (contains, numeric, date). We use nesting
 * instead.
 *
 * AND (all) strategy — nest each condition inside the previous one:
 * *|IF:A|*
 * *|IF:B|*
 * content
 * *|END:IF|*
 * *|END:IF|*
 *
 * OR (any) strategy — emit sibling blocks, each wrapping the same content:
 * *|IF:A|* content *|END:IF|*
 * *|IF:B|* content *|END:IF|*
 *
 * ⚠ If more than one condition is true, the subscriber sees the content
 * multiple times. This is an inherent Mailchimp limitation for complex OR
 * logic. Simple OR equality checks could use *|IF:A=x OR B=y|*but that
 * parser is unreliable for non-equality operators, so we accept the
 * duplicate-render trade-off for safety. Document this in user-facing UI.
 *
 * Group awareness — each group's own `match` is respected:
 * Top-level match: "all", group match: "any" → group rules become OR
 * siblings, the whole group is then AND-nested into the outer block.
 *
 * This function returns the complete wrapped string rather than just the tag.
 */
const buildMailchimpWrapped = (
  content: string,
  config: VisibilityConfigForESP,
): string => {
  // Wraps content in nested AND blocks (innermost first).
  const wrapAnd = (exprs: string[], inner: string): string => {
    if (exprs.length === 0) return inner;
    // Reverse so we build inside-out: last condition is the innermost wrapper
    return [...exprs]
      .reverse()
      .reduce((acc, e) => `*|IF:${e}|*\n${acc}\n*|END:IF|*`, inner);
  };

  // Wraps content in sibling OR blocks.
  const wrapOr = (exprs: string[], inner: string): string => {
    if (exprs.length === 0) return inner;
    return exprs.map((e) => `*|IF:${e}|*\n${inner}\n*|END:IF|*`).join("\n");
  };

  // Convert a set of rules + their join mode to a wrapped string.
  // Returns null when no valid expressions exist (all rules skipped).
  const wrapRules = (
    rules: VisibilityRuleForESP[],
    match: "all" | "any",
    inner: string,
  ): string | null => {
    const exprs = rules
      .map((r) => buildRuleExpression(r as any, "mailchimp"))
      .filter((e): e is string => e !== null);
    if (exprs.length === 0) return null;
    return match === "all" ? wrapAnd(exprs, inner) : wrapOr(exprs, inner);
  };

  const flatExprs = (config.rules ?? [])
    .map((r) => buildRuleExpression(r as any, "mailchimp"))
    .filter((e): e is string => e !== null);

  if (config.match === "all") {
    // ── AND strategy ────────────────────────────────────────────────────────
    // Collect all expressions: flat rules + every group's rules (each group's
    // internal match is respected — "any" groups produce OR sibling blocks
    // that are then AND-nested inside the outer structure).
    //
    // For a group with match "any": we generate its OR-wrapped block first,
    // then that block's *existence* acts as the AND condition at the outer
    // level. Mailchimp can't express "(A OR B) AND C" in one tag, so we
    // nest: *|IF:C|* [OR block for A/B] *|END:IF|*
    let result = content;

    // Apply groups from inside out (last group is innermost)
    for (const group of [...(config.groups ?? [])].reverse()) {
      const groupExprs = group.rules
        .map((r) => buildRuleExpression(r as any, "mailchimp"))
        .filter((e): e is string => e !== null);
      if (groupExprs.length === 0) continue;
      result =
        group.match === "all"
          ? wrapAnd(groupExprs, result) // AND group: more nesting
          : wrapOr(groupExprs, result); // OR group: sibling blocks inside outer AND
    }

    // Finally wrap with flat rules (outermost AND layer)
    return flatExprs.length > 0 ? wrapAnd(flatExprs, result) : result;
  } else {
    // ── OR strategy ─────────────────────────────────────────────────────────
    // Each flat rule becomes a sibling block. Each group is also resolved
    // respecting its own match and added as sibling block(s).
    //
    // ⚠ If multiple conditions are true the subscriber sees content multiple
    // times — unavoidable with Mailchimp's tag model for complex OR logic.
    const orBlocks: string[] = [
      ...flatExprs.map((e) => `*|IF:${e}|*\n${content}\n*|END:IF|*`),
      ...(config.groups ?? [])
        .map((group) => wrapRules(group.rules, group.match, content))
        .filter((b): b is string => b !== null),
    ];
    return orBlocks.length > 0 ? orBlocks.join("\n") : content;
  }
};

// ─── Full expression builder (rules + groups → expression string + preludes) ──

/**
 * Builds the complete ESP expression string from a VisibilityConfig.
 *
 * Strategy:
 * 1. Convert each flat rule to an expression string (null = unsupported, skip).
 * 2. For ESPs that support nesting, convert each group to a single
 * parenthesised expression; for ESPs that don't, flatten group rules into
 * the top-level list.
 * 3. Join all results with the top-level match (AND / OR).
 * 4. For Liquid ESPs, collect {% assign %} date preludes from all rules.
 *
 * Returns null when no valid expressions could be built.
 */
const buildFullExpression = (
  config: VisibilityConfigForESP,
  syntax: ESPSyntax,
): { expression: string; preludes: string[] } | null => {
  const meta = getESPMetaSafe(syntax, ESP_SYNTAX_META);

  // Flat rule expressions
  const ruleExpressions = (config.rules ?? [])
    .map((rule) => buildRuleExpression(rule as any, syntax))
    .filter((e): e is string => e !== null);

  let groupExpressions: string[];

  if (meta.supportsNesting) {
    // Each group collapses to one parenthesised expression
    groupExpressions = (config.groups ?? [])
      .map((group): string | null => {
        const exprs = group.rules
          .map((rule) => buildRuleExpression(rule as any, syntax))
          .filter((e): e is string => e !== null);
        if (exprs.length === 0) return null;
        const joined = joinExpressions(exprs, group.match, syntax);
        return exprs.length > 1 ? `(${joined})` : joined;
      })
      .filter((e): e is string => e !== null);
  } else {
    // Flatten group rules into top-level — nesting not supported for this ESP
    groupExpressions = (config.groups ?? [])
      .flatMap((group) => group.rules)
      .map((rule) => buildRuleExpression(rule as any, syntax))
      .filter((e): e is string => e !== null);
  }

  const all = [...ruleExpressions, ...groupExpressions];
  if (all.length === 0) return null;

  const expression = joinExpressions(all, config.match, syntax);

  // Collect Liquid date preludes from all rules (flat + group)
  const preludes = isLiquidSyntax(syntax)
    ? buildLiquidDatePreludes([
        ...(config.rules ?? []),
        ...(config.groups ?? []).flatMap((g) => g.rules),
      ])
    : [];

  return { expression, preludes };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Wraps `content` in ESP conditional tags derived from `config`.
 *
 * Returns `content` unchanged when:
 * • config is undefined / null
 * • config.enabled is false
 * • config has no rules and no groups (or all produce null expressions)
 *
 * Mailchimp: emits nested *|IF|* blocks instead of inline AND/OR because
 * Mailchimp's parser does not reliably support complex boolean expressions.
 *
 * Liquid ESPs (Klaviyo, Braze, HubSpot, generic Liquid): for date_before /
 * date_after rules, emits {% assign %} prelude lines before the {% if %} tag
 * so that the unix-timestamp filter is captured in a variable rather than
 * evaluated inline (which most Liquid engines do not support).
 */
export const wrapWithESPLogic = (
  content: string,
  config: VisibilityConfigForESP | undefined | null,
  syntax: ESPSyntax = "handlebars",
): string => {
  if (!config?.enabled) return content;

  const hasRules = (config.rules?.length ?? 0) > 0;
  const hasGroups = (config.groups?.length ?? 0) > 0;
  if (!hasRules && !hasGroups) return content;

  // Mailchimp requires nested *|IF|* instead of inline AND/OR
  if (syntax === "mailchimp") return buildMailchimpWrapped(content, config);

  const result = buildFullExpression(config, syntax);
  if (!result) return content;

  const { expression, preludes } = result;
  const openTag = buildOpenTag(expression, syntax);
  const closeTag = buildCloseTag(syntax);

  // Prepend Liquid date assign preludes (empty array for non-Liquid ESPs)
  const preludeBlock = preludes.length > 0 ? `${preludes.join("\n")}\n` : "";

  return `${preludeBlock}${openTag}\n${content}\n${closeTag}`;
};

/**
 * Preview the generated open/close tags without actual content.
 * Useful for rendering a live preview in the VisibilityWrapESP component.
 *
 * For Mailchimp the openTag preview shows the first *|IF:…|* expression.
 * For Liquid date rules the openTag includes any {% assign %} preludes.
 */
export const previewESPTags = (
  config: VisibilityConfigForESP | undefined | null,
  syntax: ESPSyntax = "handlebars",
): { openTag: string; closeTag: string } | null => {
  if (!config?.enabled) return null;

  const hasRules = (config.rules?.length ?? 0) > 0;
  const hasGroups = (config.groups?.length ?? 0) > 0;
  if (!hasRules && !hasGroups) return null;

  // Mailchimp: show the first nested *|IF|* as the open-tag preview
  if (syntax === "mailchimp") {
    const allRules = [
      ...(config.rules ?? []),
      ...(config.groups ?? []).flatMap((g) => g.rules),
    ];
    const firstExpr = allRules
      .map((r) => buildRuleExpression(r as any, "mailchimp"))
      .find((e): e is string => e !== null);
    if (!firstExpr) return null;
    const suffix =
      allRules.length > 1 && config.match === "all" ? " …nested…" : "";
    return {
      openTag: `*|IF:${firstExpr}|*${suffix}`,
      closeTag: `*|END:IF|*`,
    };
  }

  const result = buildFullExpression(config, syntax);
  if (!result) return null;

  const { expression, preludes } = result;
  const baseOpenTag = buildOpenTag(expression, syntax);
  const preludeBlock = preludes.length > 0 ? `${preludes.join("\n")}\n` : "";

  return {
    openTag: `${preludeBlock}${baseOpenTag}`,
    closeTag: buildCloseTag(syntax),
  };
};
