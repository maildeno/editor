// composables/emailBuilder/export/merge-tags/reactMergeTagMapper.ts
//
// ── v2.0 MIGRATION ──────────────────────────────────────────────────────────
// extractVisibilityTags() now walks the recursive children[] tree.
// The old flat col.components[] path is preserved via children ?? components.
//
// Transforms {{ tag }} canonical tokens → React JSX prop expressions,
// and extracts visibility rule tags → const declarations inside the component.
//
// ── Design ────────────────────────────────────────────────────────────────────
//
// React Email components are real React components. Two kinds of dynamic data
// exist in a template and are handled differently:
//
// MERGE TAGS {{ first_name }} — data the caller passes in at send time.
// These become typed props on the component's EmailProps interface
// and are destructured in the function signature.
// → interface EmailProps { first_name?: string; }
// → export default function Template({ first_name }: EmailProps)
//
// VISIBILITY TAGS rule.tag = "plan" — data used only in show/hide conditions.
// These become const declarations inside the function body so the
// JSX conditionals ({ String(plan) === "pro" && <Row> }) resolve.
// A tag that appears in both merge tags AND visibility rules is
// treated as a prop only (no duplicate const).
// → const plan = "";
// → const country = "";

import { tagToIdentifier } from "../shared/tagIdentifier";

// ─── Token → JSX expression ───────────────────────────────────────────────────

export const transformTokenForReact = (
 tagId: string,
 fallback?: string,
): string => {
 const safe = tagId.trim();
 if (!safe) return "";

 if (fallback?.trim()) {
 const escapedFallback = fallback.trim().replace(/"/g, '\\"');
 return `{${safe} ?? "${escapedFallback}"}`;
 }

 return `{${safe}}`;
};

// ─── HTML/TSX string transformer ─────────────────────────────────────────────

export const transformHTMLForReact = (tsx: string): string => {
 if (!tsx) return "";

 // ── TipTap span[data-merge] nodes ──────────────────────────────────
 let result = tsx.replace(
 /<span[^>]*\bdata-merge="([^"]+)"(?:[^>]*\bdata-merge-default="([^"]*)")?[^>]*>.*?<\/span>/gs,
 (_match, tagId: string, fallback?: string) =>
 transformTokenForReact(tagId, fallback?.trim() || undefined),
 );

 // ── Remaining {{ tag }} and {{ tag|'default' }} tokens ──────────────
 result = result.replace(
 /\{\{\s*(?:'([^']*)'|"([^"]*)"|(\w+))(?:\s*\|\s*(?:'([^']*)'|"([^"]*)"|([^'"\}\s][^'"\}]*?)))?\s*\}\}/g,
 (_match, sq1, dq1, bare1, sq2, dq2, bare2) => {
 const tagId = (sq1 ?? dq1 ?? bare1 ?? "").trim();
 const fallback = (sq2 ?? dq2 ?? bare2 ?? "").trim();
 return transformTokenForReact(tagId, fallback || undefined);
 },
 );

 // ── JSX attribute strings containing {propName} expressions ──────────
 result = result.replace(
 /(\b(?!style=)\w[\w-]*=)"([^"]*\{[^}]+\}[^"]*)"/g,
 (_match, attrEq: string, rawValue: string) => {
 const pureMatch = rawValue.match(/^\{(\w+)\}$/);
 if (pureMatch) {
 return `${attrEq}{${pureMatch[1]}}`;
 }

 const templateBody = rawValue.replace(/\{(\w+)\}/g, "${$1}");
 return `${attrEq}{\`${templateBody}\`}`;
 },
 );

 return result;
};

// ─── Props interface + defaults builder ──────────────────────────────────────

export interface ReactEmailPropsResult {
 propsInterface: string;
 propsDestructure: string;
}

export const buildReactEmailProps = (
 tags: Array<{ tagId: string; fallback?: string }>,
): ReactEmailPropsResult => {
 if (tags.length === 0) {
 return {
 propsInterface: "",
 propsDestructure: "",
 };
 }

 const seen = new Map<string, string | undefined>();
 for (const { tagId, fallback } of tags) {
 if (!seen.has(tagId)) seen.set(tagId, fallback);
 }

 const entries = [...seen.entries()];

 const interfaceLines = entries
 .map(([tagId]) => ` ${tagId}?: string;`)
 .join("\n");
 const propsInterface = `interface EmailProps {\n${interfaceLines}\n}`;

 const destructureItems = entries
 .map(([tagId, fallback]) =>
 fallback?.trim()
 ? `${tagId} = "${fallback.trim().replace(/"/g, '\\"')}"`
 : tagId,
 )
 .join(", ");

 const propsDestructure = `{ ${destructureItems} }: EmailProps`;

 return { propsInterface, propsDestructure };
};

// ─── Tag extractor ────────────────────────────────────────────────────────────

export const extractReactTags = (
 html: string,
): Array<{ tagId: string; fallback?: string }> => {
 const found = new Map<string, string | undefined>();

 const spanRe =
 /<span[^>]*\bdata-merge="([^"]+)"(?:[^>]*\bdata-merge-default="([^"]*)")?[^>]*>.*?<\/span>/gs;
 for (const m of html.matchAll(spanRe)) {
 const tagId = m[1].trim();
 if (tagId && !found.has(tagId)) found.set(tagId, m[2]?.trim() || undefined);
 }

 const tokenRe =
 /\{\{\s*(?:'([^']*)'|"([^"]*)"|(\w+))(?:\s*\|\s*(?:'([^']*)'|"([^"]*)"|([^'"\}\s][^'"\}]*?)))?\s*\}\}/g;
 for (const m of html.matchAll(tokenRe)) {
 const tagId = (m[1] ?? m[2] ?? m[3] ?? "").trim();
 const fallback = (m[4] ?? m[5] ?? m[6] ?? "").trim();
 if (tagId && !found.has(tagId)) found.set(tagId, fallback || undefined);
 }

 return [...found.entries()].map(([tagId, fallback]) => ({ tagId, fallback }));
};

// ─── Visibility tag extractor ─────────────────────────────────────────────────
// ── v2.0: Now walks the recursive children[] tree ─────────────────────────────

/**
 * Walks every row (and its columns and children) in the rows array and
 * collects every unique tag ID referenced in any VisibilityRule.
 *
 * Supports the recursive children[] tree with nested rows, row-spacers,
 * and the legacy flat col.components[] shape via children ?? components.
 *
 * @param rows The raw rows array from the email builder store.
 * @returns Deduplicated array of tag IDs found in any visibility rule.
 */
export const extractVisibilityTags = (rows: any[]): string[] => {
 const found = new Set<string>();

 const collectFromVisibility = (visibility: any) => {
 if (!visibility?.enabled) return;
 // Preserve the tag's case and sanitise it to a valid JS identifier — the
 // same mapping reactLogicWrapper uses for the conditional — so the emitted
 // `const <id> = ""` matches the `String(<id>)` reference exactly.
 for (const rule of visibility.rules ?? []) {
 if (rule.tag?.trim()) found.add(tagToIdentifier(rule.tag)); // drop .toLowerCase()
 }
 for (const group of visibility.groups ?? []) {
 for (const rule of group.rules ?? []) {
 if (rule.tag?.trim()) found.add(tagToIdentifier(rule.tag)); // drop .toLowerCase()
 }
 }
 };

 // Recursive walker for children[] arrays
 const walkChildren = (children: any[]): void => {
 for (const child of children) {
 if (child.type === "row") {
 // Nested row — check row-level visibility, then recurse into columns
 collectFromVisibility(child.visibility);
 for (const col of child.columns ?? []) {
 collectFromVisibility(col.props?.visibility);
 const kids = col.children ?? col.components ?? [];
 walkChildren(kids);
 }
 } else if (child.type === "row-spacer") {
 collectFromVisibility(child.visibility);
 } else {
 // Leaf component (type === 'component' or legacy)
 collectFromVisibility(child.props?.visibility);
 }
 }
 };

 for (const row of rows) {
 collectFromVisibility(row.visibility);
 for (const col of row.columns ?? []) {
 collectFromVisibility(col.props?.visibility);
 // ── CRITICAL: children ?? components for backward compat ─────────────
 const kids = col.children ?? col.components ?? [];
 walkChildren(kids);
 }
 }

 return [...found];
};

// ─── Const block builder ──────────────────────────────────────────────────────

export const buildReactEmailConsts = (tagIds: string[]): string => {
 if (tagIds.length === 0) return "";

 const lines = tagIds.map((id) => ` const ${id} = "";`).join("\n");
 return ` // Visibility data — replace with real values from your data source\n${lines}`;
};
