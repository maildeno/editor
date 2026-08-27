<template>
  <div class="bg-gray-950 rounded-xl shadow-2xl border border-white/10 overflow-hidden">

    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-white/10">
      <span class="text-[11px] font-semibold text-white">Visibility Rules</span>
      <span
        class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        :class="visibility.match === 'all'
          ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
          : 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30'"
      >
        Match {{ visibility.match?.toUpperCase() }}
      </span>
    </div>

    <!-- ── Scrollable body ───────────────────────────────────────────────── -->
    <div class="px-3 py-2.5 flex flex-col gap-2.5 overflow-y-auto" style="max-height: 260px">

      <!-- Flat rules -->
      <template v-if="visibility.rules?.length">
        <div
          v-for="(rule, i) in visibility.rules"
          :key="`rule-${i}`"
          class="flex flex-col gap-1"
        >
          <!-- AND / OR connector -->
          <div v-if="i > 0" class="text-[8px] font-bold text-gray-500 uppercase tracking-widest pl-0.5">
            {{ visibility.match === 'all' ? 'AND' : 'OR' }}
          </div>

          <!-- Rule chips -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold">
              {{ rule.tag || '?' }}
            </span>
            <span class="text-[10px] font-bold font-mono" :class="operatorColorClass(rule.operator)">
              {{ operatorSymbol(rule.operator) }}
            </span>
            <span
              v-if="!isValueless(rule.operator)"
              class="bg-gray-800 text-gray-100 ring-1 ring-white/10 rounded-md px-1.5 py-0.5 text-[10px] font-mono max-w-22.5 truncate"
              :title="rule.value"
            >
              {{ rule.value || '?' }}
            </span>
          </div>
        </div>
      </template>

      <!-- ── Groups ─────────────────────────────────────────────────────── -->
      <template v-if="visibility.groups?.length">

        <!-- Connector from flat rules to groups -->
        <div v-if="visibility.rules?.length" class="flex items-center gap-1">
          <div class="h-px flex-1 bg-white/10" />
          <span class="text-[8px] text-gray-500 uppercase font-bold px-1">
            {{ visibility.match === 'all' ? 'AND' : 'OR' }}
          </span>
          <div class="h-px flex-1 bg-white/10" />
        </div>

        <div
          v-for="(group, gi) in visibility.groups"
          :key="`group-${gi}`"
          class="border border-blue-500/20 rounded-lg bg-blue-500/5 px-2.5 py-2"
        >
          <!-- Group header -->
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-[9px] text-blue-400 font-bold uppercase tracking-wide">Group {{ gi + 1 }}</span>
            <span
              class="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
              :class="group.match === 'all'
                ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                : 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30'"
            >
              {{ group.match === 'all' ? 'AND' : 'OR' }}
            </span>
          </div>

          <!-- Group rules -->
          <div class="flex flex-col gap-1.5">
            <div
              v-for="(rule, ri) in group.rules"
              :key="ri"
              class="flex flex-col gap-0.5"
            >
              <div v-if="ri > 0" class="text-[8px] font-bold text-blue-400/50 uppercase tracking-widest pl-0.5">
                {{ group.match === 'all' ? 'AND' : 'OR' }}
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                  {{ rule.tag || '?' }}
                </span>
                <span class="text-[10px] font-bold font-mono" :class="operatorColorClass(rule.operator)">
                  {{ operatorSymbol(rule.operator) }}
                </span>
                <span
                  v-if="!isValueless(rule.operator)"
                  class="bg-gray-800 text-gray-100 ring-1 ring-white/10 rounded-md px-1.5 py-0.5 text-[10px] font-mono max-w-20 truncate"
                  :title="rule.value"
                >
                  {{ rule.value || '?' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Footer -->
    <div class="px-3 py-1.5 bg-white/3 border-t border-white/10">
      <p class="text-[10px] text-gray-500">
        Shown when
        <span class="font-semibold text-gray-400">{{ visibility.match === 'all' ? 'all' : 'any' }}</span>
        condition{{ totalRuleCount !== 1 ? 's are' : ' is' }} met
        <span class="ml-1 text-gray-600">· {{ totalRuleCount }} rule{{ totalRuleCount !== 1 ? 's' : '' }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  VALUELESS_OPERATORS,
  type VisibilityOperator,
} from "@/composables/emailBuilder/core/useEmailBuilderVisibility";

const props = defineProps({
  visibility: {
    type: Object as () => {
      enabled: boolean;
      match: "all" | "any";
      rules: { tag: string; operator: string; value: string }[];
      groups?: { match: "all" | "any"; rules: { tag: string; operator: string; value: string }[] }[];
    },
    required: true,
  },
});

// Total rule count across flat rules + all group rules
const totalRuleCount = computed(() => {
  const flatCount  = props.visibility.rules?.length ?? 0;
  const groupCount = (props.visibility.groups ?? []).reduce((sum, g) => sum + (g.rules?.length ?? 0), 0);
  return flatCount + groupCount;
});

const isValueless = (op: string) =>
  VALUELESS_OPERATORS.includes(op as VisibilityOperator);

const operatorSymbol = (op: string): string => ({
  "==": "=", "!=": "≠",
  "contains": "⊃", "not_contains": "⊅",
  "starts_with": "^=", "ends_with": "=$",
  "in": "∈", "not_in": "∉",
  ">": ">", "<": "<", ">=": "≥", "<=": "≤",
  "is_empty": "∅", "is_not_empty": "∃",
  // ✅ NEW
  "date_before": "< 📅", "date_after": "> 📅", "date_on": "= 📅",
}[op] ?? op);

const operatorColorClass = (op: string): string => {
  if (op === "==" || op === "in")                               return "text-emerald-400";
  if (op === "!=" || op === "not_in")                          return "text-red-400";
  if (["contains", "starts_with", "ends_with"].includes(op))  return "text-amber-400";
  if (op === "not_contains")                                   return "text-orange-400";
  if ([">", "<", ">=", "<="].includes(op))                    return "text-sky-400";
  if (op === "is_empty" || op === "is_not_empty")              return "text-purple-400";
  // ✅ NEW
  if (["date_before", "date_after", "date_on"].includes(op))  return "text-rose-400";
  return "text-gray-400";
};
</script>