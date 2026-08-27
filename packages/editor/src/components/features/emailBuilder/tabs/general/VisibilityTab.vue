<template>
  <div class="border border-[var(--md-border)] rounded-lg bg-[var(--md-surface)] overflow-hidden flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 bg-[var(--md-surface-hover)] border-b border-[var(--md-border)] shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-[var(--md-text-muted)]">Preview Context</span>
        <span class="text-[10px] text-[var(--md-text-subtle)] bg-[var(--md-surface)] px-1.5 py-0.5 rounded-full border border-[var(--md-border)]">
          {{ activeCount }} active
        </span>
      </div>
      <button @click="addContextEntry" class="text-[var(--md-text-subtle)] hover:text-[var(--md-text-muted)] text-xs flex items-center gap-1">
        <Icon name="plus" style="font-size: 8px" />
        Add tag
      </button>
    </div>

    <!-- Context entries -->
    <div class="p-3 space-y-2 shrink-0">
      <div v-if="contextEntries.length > 0" class="grid grid-cols-2 gap-1.5 px-0.5">
        <span class="text-[11px] text-[var(--md-text-subtle)]">Tag</span>
        <span class="text-[11px] text-[var(--md-text-subtle)]">Value</span>
      </div>
      <div v-for="(entry, i) in contextEntries" :key="i" class="flex items-center gap-2 group">
        <div class="flex-1 grid grid-cols-2 gap-1.5">
          <input v-model="entry.key" type="text" placeholder="e.g. plan"
            class="mg-md-input" />
          <input v-model="entry.value" type="text" placeholder="e.g. pro"
            class="mg-md-input" />
        </div>
        <button @click="removeEntry(i)"
          class="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--md-text-subtle)] hover:text-[var(--md-danger)] shrink-0">
          <Icon name="times" style="font-size: 10px" />
        </button>
      </div>
      <div v-if="activeCount === 0" class="text-center py-3">
        <span class="text-[11px] text-[var(--md-text-subtle)]">No active context tags — add one to preview visibility rules</span>
      </div>
    </div>

    <!-- Conditional Blocks -->
    <div v-if="conditionalBlocks.length > 0" class="border-t border-[var(--md-border)] flex flex-col min-h-0">
      <button @click="showConditionalSummary = !showConditionalSummary"
        class="w-full flex items-center justify-between px-3 py-2 bg-[var(--md-surface-hover)]/50 hover:bg-[var(--md-surface-muted)] transition-colors shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-[var(--md-text-muted)]">Conditional Blocks</span>
          <span class="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
            {{ conditionalBlocks.length }}
          </span>
        </div>
        <svg class="w-3 h-3 text-[var(--md-text-subtle)] transition-transform" :class="showConditionalSummary ? 'rotate-180' : ''"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-if="showConditionalSummary" class="overflow-y-auto divide-y divide-[var(--md-border)]" style="max-height: 320px">
        <div v-for="block in conditionalBlocks" :key="block.id" class="p-3 hover:bg-[var(--md-surface-hover)]/40 transition-colors">
           <h4 class="text-[10px] text-[var(--md-text-muted)] font-mono flex-1 mb-1">{{ block.label }}</h4>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0" :class="
              block.kind === 'row'
                ? 'bg-purple-50 text-purple-600 border-purple-200'
                : block.kind === 'nested-row'
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                  : 'bg-blue-50 text-blue-600 border-blue-200'
            ">
              {{ block.kind === 'row' ? 'Row' : block.kind === 'nested-row' ? 'Nested Row' : 'Component' }}
            </span>
            <!-- Depth badge for nested elements -->
            <span v-if="block.depth > 0"
              class="text-[9px] text-[var(--md-text-subtle)] bg-[var(--md-surface-muted)] px-1 py-0.5 rounded font-mono shrink-0">
              depth {{ block.depth }}
            </span>
           
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0" :class="
              block.match === 'all'
                ? 'bg-sky-50 text-sky-600 border-sky-200'
                : 'bg-amber-50 text-amber-600 border-amber-200'
            ">
              {{ block.match === 'all' ? 'AND' : 'OR' }}
            </span>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" :class="
              block.passing ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
            ">
              {{ block.passing ? '✓ pass' : '✗ fail' }}
            </span>
          </div>

          <!-- Flat rules -->
          <div v-if="block.rules.length > 0" class="space-y-1.5 pl-1">
            <div v-for="(rule, ri) in block.rules" :key="ri" class="flex flex-col gap-0.5">
              <div v-if="ri > 0" class="text-[8px] font-bold text-[var(--md-text-subtle)] uppercase tracking-widest pl-0.5">
                {{ block.match === 'all' ? 'AND' : 'OR' }}
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="bg-purple-50 text-purple-700 ring-1 ring-purple-200 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                  {{ rule.tag || '?' }}
                </span>
                <span class="text-[10px] font-bold font-mono" :class="operatorColorClass(rule.operator)">
                  {{ operatorSymbol(rule.operator) }}
                </span>
                <span v-if="!isValueless(rule.operator)"
                  class="bg-gray-100 text-gray-700 ring-1 ring-gray-200 rounded px-1.5 py-0.5 text-[10px] font-mono max-w-25 truncate"
                  :title="rule.value">
                  {{ rule.value || '?' }}
                </span>
                <span v-if="rule.tag" class="flex items-center gap-0.5 text-[9px] font-medium ml-auto shrink-0"
                  :class="isRuleMatched(rule) ? 'text-emerald-600' : 'text-gray-300'">
                  <Icon :name="isRuleMatched(rule) ? 'check-circle' : 'circle'" style="font-size: 9px" />
                  {{ isRuleMatched(rule) ? 'matched' : 'no match' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Groups -->
          <div v-if="block.groups?.length" class="mt-2 space-y-2">
            <div v-if="block.rules.length > 0" class="flex items-center gap-1 pl-1">
              <div class="h-px flex-1 bg-[var(--md-border)]" />
              <span class="text-[8px] text-[var(--md-text-subtle)] uppercase font-bold px-1">
                {{ block.match === 'all' ? 'AND' : 'OR' }}
              </span>
              <div class="h-px flex-1 bg-[var(--md-border)]" />
            </div>
            <div v-for="(group, gi) in block.groups" :key="gi"
              class="border border-[var(--md-border)] rounded-md p-2 bg-[var(--md-surface-hover)]/30">
              <div class="text-[8px] font-bold text-[var(--md-text-subtle)] uppercase tracking-widest mb-1.5">
                Group · {{ group.match === 'all' ? 'AND' : 'OR' }}
              </div>
              <div class="space-y-1.5">
                <div v-for="(rule, ri) in group.rules" :key="ri" class="flex flex-col gap-0.5">
                  <div v-if="ri > 0" class="text-[8px] font-bold text-[var(--md-text-subtle)] uppercase tracking-widest pl-0.5">
                    {{ group.match === 'all' ? 'AND' : 'OR' }}
                  </div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="bg-purple-50 text-purple-700 ring-1 ring-purple-200 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                      {{ rule.tag || '?' }}
                    </span>
                    <span class="text-[10px] font-bold font-mono" :class="operatorColorClass(rule.operator)">
                      {{ operatorSymbol(rule.operator) }}
                    </span>
                    <span v-if="!isValueless(rule.operator)"
                      class="bg-gray-100 text-gray-700 ring-1 ring-gray-200 rounded px-1.5 py-0.5 text-[10px] font-mono max-w-25 truncate"
                      :class="isDate(rule.operator) ? 'text-rose-600' : ''" :title="rule.value">
                      {{ rule.value || '?' }}
                    </span>
                    <span v-if="rule.tag" class="flex items-center gap-0.5 text-[9px] font-medium ml-auto shrink-0"
                      :class="isRuleMatched(rule) ? 'text-emerald-600' : 'text-gray-300'">
                      <Icon :name="isRuleMatched(rule) ? 'check-circle' : 'circle'"
                        style="font-size: 9px" />
                      {{ isRuleMatched(rule) ? 'matched' : 'no match' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No conditional blocks -->
    <div v-else class="px-3 py-4 text-center border-t border-[var(--md-border)]">
      <Icon name="eye-slash" class="text-[var(--md-text-subtle)] block mb-1" style="font-size: 18px" />
      <p class="text-[11px] text-[var(--md-text-subtle)]">No visibility rules configured yet</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/ui/Icon.vue";
import { ref } from "vue";
import { computed, watch } from 'vue'
import { useEmailBuilder } from '@/composables/emailBuilder/core/useEmailBuilder'
import {
  VALUELESS_OPERATORS,
  DATE_OPERATORS,
  useEmailBuilderVisibility,
  type VisibilityOperator,
} from '@/composables/emailBuilder/core/useEmailBuilderVisibility'
import { displayName } from '@/composables/emailBuilder/core/useEmailBuilderOperations'
import type { CanvasChild } from '@/composables/emailBuilder/types/emailBuilder'

const { visibilityPreviewContext, rows } = useEmailBuilder()
const { evaluateVisibility, evaluateRule } = useEmailBuilderVisibility()

const showConditionalSummary = ref(true)

const contextEntries = ref<{ key: string; value: string }[]>(
  Object.keys(visibilityPreviewContext.value).length > 0
    ? Object.entries(visibilityPreviewContext.value).map(([key, value]) => ({ key, value }))
    : [{ key: '', value: '' }],
)

const activeCount = computed(() => contextEntries.value.filter((e) => e.key.trim()).length)

// ── Operator helpers ──────────────────────────────────────────────────────────

const isValueless = (op: string) => VALUELESS_OPERATORS.includes(op as VisibilityOperator)
const isDate = (op: string) => DATE_OPERATORS.includes(op as VisibilityOperator)

const operatorSymbol = (op: string): string =>
  ({
    '==': '=', '!=': '≠', contains: '⊃', not_contains: '⊅',
    starts_with: '^=', ends_with: '=$', in: '∈', not_in: '∉',
    '>': '>', '<': '<', '>=': '≥', '<=': '≤',
    is_empty: '∅', is_not_empty: '∃',
    date_before: '< 📅', date_after: '> 📅', date_on: '= 📅',
  })[op] ?? op

const operatorColorClass = (op: string): string => {
  if (op === '==' || op === 'in') return 'text-emerald-600'
  if (op === '!=' || op === 'not_in') return 'text-red-500'
  if (['contains', 'starts_with', 'ends_with'].includes(op)) return 'text-amber-600'
  if (op === 'not_contains') return 'text-orange-500'
  if (['>', '<', '>=', '<='].includes(op)) return 'text-blue-600'
  if (op === 'is_empty' || op === 'is_not_empty') return 'text-purple-600'
  if (['date_before', 'date_after', 'date_on'].includes(op)) return 'text-rose-500'
  return 'text-gray-500'
}

const isRuleMatched = (rule: { tag: string; operator: string; value: string }): boolean =>
  evaluateRule(rule as any, visibilityPreviewContext.value)

// ── Conditional blocks — recursive tree walker ────────────────────────────────

interface ConditionalBlock {
  id: string
  kind: 'row' | 'nested-row' | 'component'
  label: string
  depth: number
  match: 'all' | 'any'
  rules: { tag: string; operator: string; value: string }[]
  groups?: { match: 'all' | 'any'; rules: { tag: string; operator: string; value: string }[] }[]
  passing: boolean
}

const getRowLabel = (row: any, index: number): string => {
  if (row.name) return displayName(row.name)
  return row.type === 'row-spacer' ? 'Spacer' : `Row ${index + 1}`
}

/**
 * Recursively collects all elements with visibility rules from the tree.
 * Walks: top-level rows → columns → children (which may contain nested rows).
 */
function collectBlocks(
  children: CanvasChild[],
  parentLabel: string,
  depth: number,
  blocks: ConditionalBlock[],
) {
  children.forEach((child, i) => {
    if (child.type === 'row' || child.type === 'row-spacer') {
      const vis = (child as any).visibility
      const hasRules = vis?.enabled && vis?.rules?.length > 0
      const hasGroups = vis?.enabled && vis?.groups?.length > 0

      if (hasRules || hasGroups) {
        blocks.push({
          id: `row-${child.id}`,
          kind: depth === 0 ? 'row' : 'nested-row',
          label: `${getRowLabel(child, i)} (in ${parentLabel})`,
          depth,
          match: vis.match,
          rules: vis.rules ?? [],
          groups: vis.groups ?? [],
          passing: evaluateVisibility(vis, visibilityPreviewContext.value),
        })
      }

      // Recurse into columns
      if (child.type === 'row') {
        child.columns?.forEach((col: any) => {
          collectBlocks(col.children ?? col.components ?? [], getRowLabel(child, i), depth + 1, blocks)
        })
      }
    } else if (child.type === 'component') {
      const cvis = (child as any).props?.visibility
      const hasRules = cvis?.enabled && cvis?.rules?.length > 0
      const hasGroups = cvis?.enabled && cvis?.groups?.length > 0

      if (hasRules || hasGroups) {
        blocks.push({
          id: `comp-${child.id}`,
          kind: 'component',
          label: `${(child as any).componentType ?? (child as any).type} — ${parentLabel}`,
          depth,
          match: cvis.match,
          rules: cvis.rules ?? [],
          groups: cvis.groups ?? [],
          passing: evaluateVisibility(cvis, visibilityPreviewContext.value),
        })
      }
    }
  })
}

const conditionalBlocks = computed(() => {
  const blocks: ConditionalBlock[] = []

  rows.value.forEach((row: any, rowIndex: number) => {
    const vis = row.visibility
    const hasRules = vis?.enabled && vis?.rules?.length > 0
    const hasGroups = vis?.enabled && vis?.groups?.length > 0

    if (hasRules || hasGroups) {
      blocks.push({
        id: `row-${row.id}`,
        kind: 'row',
        label: getRowLabel(row, rowIndex),
        depth: 0,
        match: vis.match,
        rules: vis.rules ?? [],
        groups: vis.groups ?? [],
        passing: evaluateVisibility(vis, visibilityPreviewContext.value),
      })
    }

    // Walk columns and their children recursively
    row.columns?.forEach((col: any) => {
      const children: CanvasChild[] = col.children ?? col.components ?? []
      collectBlocks(children, getRowLabel(row, rowIndex), 1, blocks)
    })
  })

  return blocks
})

// ── Context sync ──────────────────────────────────────────────────────────────

const syncContext = () => {
  visibilityPreviewContext.value = Object.fromEntries(
    contextEntries.value
      .filter((e) => e.key.trim())
      .map((e) => [e.key.trim().toLowerCase(), e.value.trim().toLowerCase()]),
  )
}

const addContextEntry = () => contextEntries.value.push({ key: '', value: '' })
const removeEntry = (i: number) => { contextEntries.value.splice(i, 1); syncContext() }

watch(contextEntries, syncContext, { deep: true })
</script>