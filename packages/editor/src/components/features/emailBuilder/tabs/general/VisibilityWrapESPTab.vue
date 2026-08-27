<template>
  <div class="border border-[var(--md-border)] rounded-lg bg-[var(--md-surface)] overflow-hidden">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-3 py-2 bg-[var(--md-surface-hover)] border-b border-[var(--md-border)]"
    >
      <div class="flex items-center gap-2">
        <Icon name="code" class="text-[var(--md-text-subtle)]" style="font-size: 11px" />
        <span class="text-xs font-medium text-[var(--md-text-muted)]">ESP Wrap Config</span>
      </div>
      <span
        class="text-[10px] px-1.5 py-0.5 rounded-full border font-mono"
        :class="syntaxBadgeClass"
      >
        {{ currentMeta.group }}
      </span>
    </div>

    <!-- Syntax selector -->
    <div class="p-3 space-y-3">
      <div>
        <label
          class="block text-[10px] text-[var(--md-text-subtle)] mb-1.5 uppercase tracking-wide"
        >
          Target ESP Syntax
        </label>
        <div class="relative">
          <select
            v-model="espConfig.syntax"
            class="w-full text-sm px-2.5 py-1.5 pr-7 outline-1 outline-[var(--md-border)] rounded-md shadow-xs focus:outline-none focus:ring-[1px] focus:ring-[var(--md-selection)] bg-[var(--md-surface)] text-[var(--md-text)] appearance-none cursor-pointer"
          >
            <optgroup
              v-for="group in syntaxGroups"
              :key="group.label"
              :label="group.label"
            >
              <option
                v-for="opt in group.options"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </optgroup>
          </select>
          <Icon
            name="chevron-down"
            class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--md-text-subtle)]"
            style="font-size: 10px"
          />
        </div>

        <!-- Description + docs link -->
        <div class="mt-1.5 flex items-center justify-between">
          <p class="text-[10px] text-[var(--md-text-subtle)] leading-relaxed">
            {{ currentMeta.description }}
          </p>
          <a
            v-if="currentMeta.docsUrl"
            :href="currentMeta.docsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[10px] text-[var(--md-info)] hover:text-[var(--md-info-fg)] flex items-center gap-0.5 ml-2 shrink-0"
          >
            docs
            <Icon name="external-link" style="font-size: 8px" />
          </a>
        </div>
      </div>

      <!-- ── Nesting / group-flattening warning ─────────────────────────────── -->
      <div
        v-if="nestingWarning"
        class="flex items-start gap-2 bg-[var(--md-warning-bg)] border border-[var(--md-warning-border)] rounded-md px-3 py-2.5"
      >
        <span class="text-[var(--md-warning)] mt-0.5 shrink-0" style="font-size: 11px"
          >⚠</span
        >
        <div class="text-[10px] text-[var(--md-warning-fg)] leading-relaxed space-y-1">
          <p>
            <strong class="font-semibold"
              >Group structure will be flattened</strong
            >
            — {{ currentMeta.label }} does not support nested boolean groups.
          </p>
          <p class="text-[var(--md-warning-fg)]/80">
            All rules inside your groups will be merged into a single flat list
            and evaluated using the top-level
            <code class="font-mono bg-[var(--md-warning-border)] rounded px-0.5">match</code>
            mode (<strong>{{ firstActiveMatchMode }}</strong
            >). Group-level
            <code class="font-mono bg-[var(--md-warning-border)] rounded px-0.5"
              >any / all</code
            >
            settings will be ignored. Simplify your rules or switch to an ESP
            that supports nesting.
          </p>
        </div>
      </div>

      <!-- ── Skipped-operators warning (none) ──────────────────────────────── -->
      <div
        v-if="skippedOperators.length > 0"
        class="flex items-start gap-2 bg-[var(--md-danger-bg)] border border-[var(--md-danger-border)] rounded-md px-3 py-2.5"
      >
        <span class="text-[var(--md-danger)] mt-0.5 shrink-0" style="font-size: 11px"
          >✕</span
        >
        <div class="text-[10px] text-[var(--md-danger-fg)] leading-relaxed space-y-0.5">
          <p>
            <strong class="font-semibold"
              >{{ skippedOperators.length }} operator{{
                skippedOperators.length > 1 ? "s" : ""
              }}
              will be skipped</strong
            >
            — not supported by {{ currentMeta.label }}:
          </p>
          <ul class="list-none space-y-0.5 mt-1">
            <li
              v-for="item in skippedOperators"
              :key="item.key"
              class="font-mono bg-[var(--md-danger-border)] rounded px-1.5 py-0.5 inline-flex items-center gap-1 mr-1"
            >
              <span class="text-[var(--md-danger)]">✕</span> {{ item.label }}
            </li>
          </ul>
          <p class="mt-1 text-[var(--md-danger)]/80">
            Rules using these operators will be silently dropped from the
            exported tags.
          </p>
        </div>
      </div>

      <!-- ── Degraded-operators warning (fallback) ────────────────────────── -->
      <div
        v-if="degradedOperators.length > 0"
        class="flex items-start gap-2 bg-[var(--md-warning-bg)] border border-[var(--md-warning-border)] rounded-md px-3 py-2.5"
      >
        <span class="text-[var(--md-warning)] mt-0.5 shrink-0" style="font-size: 11px"
          >⚠</span
        >
        <div class="text-[10px] text-[var(--md-warning-fg)] leading-relaxed space-y-0.5">
          <p>
            <strong class="font-semibold"
              >{{ degradedOperators.length }} operator{{
                degradedOperators.length > 1 ? "s" : ""
              }}
              use degraded fallback</strong
            >
            in {{ currentMeta.label }}:
          </p>
          <ul class="list-none space-y-0.5 mt-1">
            <li
              v-for="item in degradedOperators"
              :key="item.key"
              class="font-mono bg-[var(--md-warning-border)] rounded px-1.5 py-0.5 inline-flex items-center gap-1 mr-1"
            >
              <span class="text-[var(--md-warning)]">⚠</span> {{ item.label }}
            </li>
          </ul>
          <p class="mt-1 text-[var(--md-warning-fg)]/80">
            {{ degradedOperators[0]?.hint }}
          </p>
          <p
            v-if="degradedOperators.some((o) => o.key === 'date')"
            class="mt-1.5 text-[var(--md-warning-fg)] font-medium flex items-start gap-1"
          >
            <span class="shrink-0">📅</span>
            <span>
              Date fields must be in
              <code class="font-mono bg-[var(--md-warning-border)] rounded px-0.5"
                >YYYY-MM-DD</code
              >
              format. Other formats (MM/DD/YYYY, DD-MM-YYYY) will silently fail
              in {{ currentMeta.label }} date comparisons.
            </span>
          </p>
        </div>
      </div>

      <!-- ── Mailchimp OR duplicate-render notice ─────────────────────────── -->
      <div
        v-if="mailchimpOrWarning"
        class="flex items-start gap-2 bg-[var(--md-info-bg)] border border-[var(--md-info-border)] rounded-md px-3 py-2.5"
      >
        <span class="text-[var(--md-info)] mt-0.5 shrink-0" style="font-size: 11px"
          >ℹ</span
        >
        <p class="text-[10px] text-[var(--md-info-fg)] leading-relaxed">
          <strong class="font-semibold">Mailchimp OR logic:</strong> each
          condition is wrapped in its own
          <code class="font-mono bg-[var(--md-info-border)] px-0.5 rounded">*|IF|*</code>
          block. If more than one condition is true, the subscriber may see the
          content more than once. This is a Mailchimp limitation for complex OR
          rules.
        </p>
      </div>

      <!-- Live tag preview -->
      <div v-if="firstBlockPreview" class="space-y-1">
        <label class="block text-[10px] text-[var(--md-text-subtle)] uppercase tracking-wide"
          >Tag Preview</label
        >
        <div class="bg-gray-950 rounded-md p-2.5 space-y-1 overflow-x-auto">
          <p class="font-mono text-[10px] text-emerald-400 whitespace-pre">
            {{ firstBlockPreview.openTag }}
          </p>
          <p class="font-mono text-[10px] text-gray-500 pl-2">
            &lt;!-- row / component html --&gt;
          </p>
          <p class="font-mono text-[10px] text-rose-400 whitespace-pre">
            {{ firstBlockPreview.closeTag }}
          </p>
        </div>
      </div>

      <!-- No conditional blocks -->
      <div v-else class="bg-[var(--md-surface-hover)] rounded-md px-3 py-2.5 text-center">
        <p class="text-[10px] text-[var(--md-text-subtle)] leading-relaxed">
          No conditional blocks found.<br />
          Add a visibility rule to a row or component to see a preview.
        </p>
      </div>

      <!-- Info callout -->
      <div class="bg-[var(--md-warning-bg)] border border-[var(--md-warning-border)] rounded-md px-3 py-2.5">
        <p class="text-[10px] text-[var(--md-warning-fg)] leading-relaxed">
          <strong class="font-semibold">Wrap mode</strong> keeps every row in
          the exported HTML and adds ESP conditional tags so your mail server
          evaluates them at send time. Use
          <strong class="font-semibold">Snapshot (Pruned)</strong> for one-time
          audience exports instead.
        </p>
      </div>
    </div>

    <!-- Operator support matrix -->
    <div class="border-t border-[var(--md-border)]">
      <button
        @click="showMatrix = !showMatrix"
        @keydown.enter.space.prevent="showMatrix = !showMatrix"
        :aria-expanded="showMatrix"
        aria-label="Toggle operator support matrix"
        class="w-full flex items-center justify-between px-3 py-2 bg-[var(--md-surface-hover)]/50 hover:bg-[var(--md-surface-muted)] transition-colors"
      >
        <span class="text-xs font-medium text-[var(--md-text-muted)]">Operator Support</span>
        <svg
          class="w-3 h-3 text-[var(--md-text-subtle)] transition-transform"
          :class="showMatrix ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div v-if="showMatrix" class="p-3 overflow-x-auto">
        <table class="text-[10px] border-collapse min-w-full">
          <thead>
            <tr class="text-left text-[var(--md-text-subtle)]">
              <th class="pb-1.5 font-medium pr-2 sticky left-0 bg-[var(--md-surface)]">
                ESP
              </th>
              <th
                v-for="col in matrixCols"
                :key="col.key"
                class="pb-1.5 font-medium text-center px-1 whitespace-nowrap"
                :title="col.tooltip"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in OPERATOR_SUPPORT_MATRIX"
              :key="row.syntax"
              :class="[
                row.syntax === espConfig.syntax ? 'bg-[var(--md-selection-bg)]' : '',
                'hover:bg-[var(--md-surface-hover)]/50 transition-colors',
              ]"
            >
              <td
                class="py-1 font-mono text-[var(--md-text-muted)] pr-2 sticky left-0 whitespace-nowrap"
                :class="
                  row.syntax === espConfig.syntax ? 'bg-[var(--md-selection-bg)]' : 'bg-[var(--md-surface)]'
                "
              >
                {{ row.label }}
              </td>
              <td
                v-for="col in matrixCols"
                :key="col.key"
                class="py-1 text-center px-1"
                :title="supportTitle((row as any)[col.key], col.tooltip)"
              >
                <SupportBadge
                  :level="(row as any)[col.key]"
                  :highlight="
                    row.syntax === espConfig.syntax &&
                    skippedOperatorKeys.has(col.key)
                  "
                  :esp-name="
                    row.syntax === espConfig.syntax ? currentMeta.label : ''
                  "
                  :operator-label="col.tooltip"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Legend -->
        <div
          class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--md-text-subtle)]"
        >
          <span class="flex items-center gap-1">
            <span class="font-mono font-bold text-emerald-500">✓</span> Native
          </span>
          <span class="flex items-center gap-1">
            <span class="font-mono font-bold text-amber-500">~</span> Requires
            helper
          </span>
          <span class="flex items-center gap-1">
            <span class="font-mono font-bold text-orange-400">⚠</span> Degraded
            fallback
          </span>
          <span class="flex items-center gap-1">
            <span class="font-mono font-bold text-gray-300">–</span> Not
            supported
          </span>
          <span
            class="flex items-center gap-1 text-[var(--md-text-subtle)] border-t border-[var(--md-border)] pt-1 w-full mt-0.5"
          >
            Highlighted cells = operators actively used in this email
          </span>
        </div>

        <!-- Nesting support note -->
        <p
          class="mt-2 text-[10px]"
          :class="
            currentMeta.supportsNesting ? 'text-[var(--md-text-subtle)]' : 'text-[var(--md-warning)]'
          "
        >
          {{ currentMeta.label }}:
          {{
            currentMeta.supportsNesting
              ? "Boolean groups supported ✓"
              : "⚠ Nested groups not supported — rules will be flattened"
          }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/ui/Icon.vue";
import { computed, ref } from "vue";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";
import {
  ESP_SYNTAX_META,
  OPERATOR_SUPPORT_MATRIX,
  previewESPTags,
  type ESPSyntax,
  type ESPSyntaxMeta,
  type SupportLevel,
  type VisibilityConfigForESP,
} from "@/composables/emailBuilder/export/logic/espLogicWrapper";
import { getESPMetaSafe, getRegisteredCustomESPs } from "@/esp/registry";
import SupportBadge from "../../ui/visibility/SupportBadge.vue";

// ── Shared state ─────────────────────────────────────────────────────────────
const { rows, espConfig } = useEmailBuilder();

// ── Meta for selected syntax ─────────────────────────────────────────────────
const currentMeta = computed(() => getESPMetaSafe(espConfig.value.syntax, ESP_SYNTAX_META));

const syntaxBadgeClass = computed(() => {
  const map: Record<string, string> = {
    handlebars: "bg-yellow-50 text-yellow-700 border-yellow-200",
    liquid: "bg-blue-50 text-blue-700 border-blue-200",
    ampscript: "bg-purple-50 text-purple-700 border-purple-200",
    custom: "bg-gray-100 text-gray-600 border-gray-200",
    mso: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    map[currentMeta.value.group] ?? "bg-gray-100 text-gray-600 border-gray-200"
  );
});

// ── Grouped <select> options ─────────────────────────────────────────────────
const syntaxGroups = computed(() => {
  const groupOrder = ["handlebars", "liquid", "ampscript", "custom", "mso"];
  const groupLabels: Record<string, string> = {
    handlebars: "Handlebars-based",
    liquid: "Liquid-based",
    ampscript: "AMPscript",
    custom: "Custom / Proprietary",
    mso: "Outlook (MSO)",
  };

  const buckets: Record<string, { value: ESPSyntax; label: string }[]> = {};

  const allEntries: [string, ESPSyntaxMeta][] = [
    ...(Object.entries(ESP_SYNTAX_META) as [string, ESPSyntaxMeta][]),
    ...getRegisteredCustomESPs().map(
      ({ id, meta }): [string, ESPSyntaxMeta] => [id, meta],
    ),
  ];

  for (const [syntax, meta] of allEntries) {
    if (!buckets[meta.group]) buckets[meta.group] = [];
    buckets[meta.group].push({ value: syntax, label: meta.label });
  }

  return groupOrder
    .filter((g) => buckets[g]?.length)
    .map((g) => ({ label: groupLabels[g], options: buckets[g] }));
});

// ── Visibility active guard ───────────────────────────────────────────────────
const isVisibilityActive = (vis: any): boolean => {
  if (!vis?.enabled) return false;
  return (vis.rules?.length ?? 0) > 0 || (vis.groups?.length ?? 0) > 0;
};

// ── Recursive tree walker — collects from all children ───────────────────────
// Walks the children[] tree and calls callback for every leaf component's
// visibility config AND every nested row's visibility config.
const walkVisibilityConfigs = (
  children: any[],
  callback: (vis: any, isRow: boolean) => void,
): void => {
  for (const child of children) {
    if (child.type === "row") {
      // Nested row — check row-level visibility, then recurse
      callback(child.visibility, true);
      for (const col of child.columns ?? []) {
        const kids = col.children ?? col.components ?? [];
        walkVisibilityConfigs(kids, callback);
      }
    } else if (child.type === "row-spacer") {
      callback(child.visibility, false);
    } else {
      // Leaf component (type === 'component' or legacy)
      callback(child.props?.visibility, false);
    }
  }
};

// ── Collect all visibility rules in the current email ────────────────────────
const allActiveRules = computed((): Array<{ operator: string }> => {
  const collected: Array<{ operator: string }> = [];
  for (const row of rows.value as any[]) {
    const vis = row.visibility;
    if (isVisibilityActive(vis)) {
      collected.push(...(vis.rules ?? []));
      for (const g of vis.groups ?? []) collected.push(...(g.rules ?? []));
    }
    for (const col of row.columns ?? []) {
      // ── CRITICAL: children ?? components for backward compat ────────────
      const kids = col.children ?? col.components ?? [];
      walkVisibilityConfigs(kids, (cvis) => {
        if (isVisibilityActive(cvis)) {
          collected.push(...(cvis.rules ?? []));
          for (const g of cvis.groups ?? []) collected.push(...(g.rules ?? []));
        }
      });
    }
  }
  return collected;
});

// ── Detect whether any active email row/component has nested groups ───────────
const hasNestedGroups = computed((): boolean => {
  for (const row of rows.value as any[]) {
    if (
      isVisibilityActive(row.visibility) &&
      (row.visibility.groups?.length ?? 0) > 0
    )
      return true;
    for (const col of row.columns ?? []) {
      // ── CRITICAL: children ?? components for backward compat ────────────
      const kids = col.children ?? col.components ?? [];
      let found = false;
      walkVisibilityConfigs(kids, (cvis) => {
        if (found) return;
        if (isVisibilityActive(cvis) && (cvis.groups?.length ?? 0) > 0)
          found = true;
      });
      if (found) return true;
    }
  }
  return false;
});

// ── Nesting warning ──────────────────────────────────────────────────────────
const nestingWarning = computed(
  () => !currentMeta.value.supportsNesting && hasNestedGroups.value,
);

// ── First active match mode ──────────────────────────────────────────────────
const firstActiveMatchMode = computed((): string => {
  for (const row of rows.value as any[]) {
    if (isVisibilityActive(row.visibility))
      return row.visibility.match ?? "all";
    for (const col of row.columns ?? []) {
      const kids = col.children ?? col.components ?? [];
      for (const child of kids) {
        const vis =
          child.type === "component"
            ? child.props?.visibility
            : child.visibility;
        if (isVisibilityActive(vis)) {
          return vis.match ?? "all";
        }
        // Recurse into nested rows
        if (child.type === "row") {
          for (const nestedCol of child.columns ?? []) {
            const nestedKids =
              nestedCol.children ?? nestedCol.components ?? [];
            for (const nested of nestedKids) {
              const nvis =
                nested.type === "component"
                  ? nested.props?.visibility
                  : nested.visibility;
              if (isVisibilityActive(nvis)) return nvis.match ?? "all";
            }
          }
        }
      }
    }
  }
  return "all";
});

// ── Map operator string → matrix column key ──────────────────────────────────
const OPERATOR_TO_MATRIX_KEY: Record<string, string> = {
  "==": "eq",
  "!=": "neq",
  contains: "contains",
  not_contains: "not_contains",
  starts_with: "starts_with",
  ends_with: "ends_with",
  in: "in",
  not_in: "not_in",
  ">": "numeric",
  "<": "numeric",
  ">=": "numeric",
  "<=": "numeric",
  is_empty: "is_empty",
  is_not_empty: "is_empty",
  date_before: "date",
  date_after: "date",
  date_on: "date",
};

// ── Fallback hints ───────────────────────────────────────────────────────────
const FALLBACK_HINTS: Partial<Record<string, string>> = {
  starts_with:
    "Starts With has no equivalent in this ESP — rules using it will be skipped and excluded from the exported tags.",
  ends_with:
    "Ends With has no equivalent in this ESP — rules using it will be skipped and excluded from the exported tags.",
  in: "In List is approximated as multiple equality checks joined by OR. Verify the output matches your intent.",
  not_in:
    "Not In List is approximated as multiple inequality checks joined by AND. Verify the output matches your intent.",
  date: "Date fields must be stored in ISO 8601 format (YYYY-MM-DD). Formats like MM/DD/YYYY or DD-MM-YYYY will cause silent failures in date comparisons.",
  contains:
    "Contains uses a best-effort approximation for this ESP — test with real data before sending.",
  not_contains:
    "Not Contains uses a best-effort approximation for this ESP — test with real data before sending.",
  is_empty:
    "Is Empty / Is Not Empty uses string-equality approximation — blank strings and null may behave differently.",
  numeric:
    "Numeric comparison may treat values as strings in this ESP — ensure merge fields contain only numeric data.",
};

type OperatorItem = { key: string; label: string; hint: string };

const buildOperatorList = (targetLevel: SupportLevel): OperatorItem[] => {
  const syntaxRow = OPERATOR_SUPPORT_MATRIX.find(
    (r) => r.syntax === espConfig.value.syntax,
  );
  if (!syntaxRow) return [];

  const seen = new Set<string>();
  const result: OperatorItem[] = [];

  for (const rule of allActiveRules.value) {
    const matrixKey = OPERATOR_TO_MATRIX_KEY[rule.operator];
    if (!matrixKey || seen.has(matrixKey)) continue;

    const level = (syntaxRow as any)[matrixKey] as SupportLevel;
    if (level !== targetLevel) continue;

    seen.add(matrixKey);
    const colTooltip =
      matrixCols.find((c) => c.key === matrixKey)?.tooltip ?? rule.operator;
    result.push({
      key: matrixKey,
      label: colTooltip,
      hint:
        FALLBACK_HINTS[matrixKey] ??
        "Output may differ from expected behaviour.",
    });
  }
  return result;
};

const skippedOperators = computed(() => buildOperatorList("none"));
const degradedOperators = computed(() => buildOperatorList("fallback"));

const skippedOperatorKeys = computed(
  () =>
    new Set([
      ...skippedOperators.value.map((s) => s.key),
      ...degradedOperators.value.map((s) => s.key),
    ]),
);

// ── Mailchimp OR warning ──────────────────────────────────────────────────────
const visConfigHasOrRisk = (
  vis: VisibilityConfigForESP | undefined,
): boolean => {
  if (!isVisibilityActive(vis)) return false;
  if (vis!.match === "any") {
    const total =
      (vis!.rules?.length ?? 0) +
      (vis!.groups?.flatMap((g) => g.rules).length ?? 0);
    if (total > 1) return true;
  }
  for (const g of vis!.groups ?? []) {
    if (g.match === "any" && (g.rules?.length ?? 0) > 1) return true;
  }
  return false;
};

const mailchimpOrWarning = computed((): boolean => {
  if (espConfig.value.syntax !== "mailchimp") return false;
  for (const row of rows.value as any[]) {
    if (visConfigHasOrRisk(row.visibility)) return true;
    for (const col of row.columns ?? []) {
      // ── CRITICAL: children ?? components for backward compat ────────────
      const kids = col.children ?? col.components ?? [];
      let found = false;
      walkVisibilityConfigs(kids, (cvis) => {
        if (found) return;
        if (visConfigHasOrRisk(cvis)) found = true;
      });
      if (found) return true;
    }
  }
  return false;
});

// ── Live tag preview ──────────────────────────────────────────────────────────
const firstBlockPreview = computed(() => {
  for (const row of rows.value as any[]) {
    if (isVisibilityActive(row.visibility)) {
      return previewESPTags(row.visibility, espConfig.value.syntax);
    }
    for (const col of row.columns ?? []) {
      // ── CRITICAL: children ?? components for backward compat ────────────
      const kids = col.children ?? col.components ?? [];
      for (const child of kids) {
        const vis =
          child.type === "component"
            ? child.props?.visibility
            : child.visibility;
        if (isVisibilityActive(vis)) {
          return previewESPTags(vis, espConfig.value.syntax);
        }
        // Check nested row children
        if (child.type === "row") {
          for (const nestedCol of child.columns ?? []) {
            const nestedKids =
              nestedCol.children ?? nestedCol.components ?? [];
            for (const nested of nestedKids) {
              const nvis =
                nested.type === "component"
                  ? nested.props?.visibility
                  : nested.visibility;
              if (isVisibilityActive(nvis)) {
                return previewESPTags(nvis, espConfig.value.syntax);
              }
            }
          }
        }
      }
    }
  }
  return null;
});

// ── Matrix column definitions ─────────────────────────────────────────────────
const matrixCols = [
  { key: "eq", label: "==", tooltip: "Equals" },
  { key: "neq", label: "!=", tooltip: "Not equals" },
  { key: "contains", label: "⊃", tooltip: "Contains" },
  { key: "not_contains", label: "⊅", tooltip: "Not contains" },
  { key: "starts_with", label: "^=", tooltip: "Starts with" },
  { key: "ends_with", label: "=$", tooltip: "Ends with" },
  { key: "in", label: "∈", tooltip: "In list" },
  { key: "not_in", label: "∉", tooltip: "Not in list" },
  {
    key: "numeric",
    label: "> <",
    tooltip: "Numeric comparison (>, <, >=, <=)",
  },
  { key: "is_empty", label: "∅", tooltip: "Is empty / Is not empty" },
  { key: "date", label: "📅", tooltip: "Date before / after / on" },
] as const;

const supportTitle = (level: SupportLevel, operatorLabel: string): string => {
  const descriptions: Record<SupportLevel, string> = {
    native: `${operatorLabel}: natively supported`,
    helper: `${operatorLabel}: requires a registered helper or custom setup`,
    fallback: `${operatorLabel}: uses a best-effort approximation — verify output before sending`,
    none: `${operatorLabel}: not supported — rule will be silently dropped from export`,
  };
  return descriptions[level] ?? "";
};

const showMatrix = ref(false);
</script>