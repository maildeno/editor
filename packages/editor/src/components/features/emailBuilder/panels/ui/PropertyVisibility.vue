<template>
  <PropertySection title="Visibility Rules">
    <!-- ── Status row ───────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-600">Status:</span>
        <button
          @click="toggleEnabled"
          class="text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap"
          :class="
            props.visibility.enabled
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          "
        >
          {{ props.visibility.enabled ? "Active" : "Inactive" }}
        </button>
      </div>
    </div>

    <template v-if="props.visibility.enabled">
      <!-- ════════════════════════════════════════════════════════════════════
           TOP-LEVEL BLOCK
           ════════════════════════════════════════════════════════════════════ -->
      <div class="mt-3 border border-gray-200 rounded-md overflow-hidden">
        <!-- Block header — Match selector -->
        <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <div class="flex flex-row items-center justify-between gap-2">
            <span class="text-xs text-gray-500 shrink-0">Match:</span>
            <div class="w-44">
              <Select
                :model-value="props.visibility.match"
                :options="MATCH_OPTIONS"
                optionLabel="label"
                optionValue="value"
                class="w-full text-sm"
                placeholder="Select match"
                @update:model-value="onMatchChange($event)"
              />
            </div>
          </div>
          <div class="text-[10px] text-gray-400 mt-1">
            {{
              props.visibility.match === "all"
                ? "— ALL rules must pass (AND)"
                : "— ANY rule must pass (OR)"
            }}
          </div>
        </div>

        <!-- Scrollable rules table -->
        <div class="rules-scroll">
          <!-- Column headers (desktop) -->
          <div
            class="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-medium text-gray-400 border-b border-gray-100 bg-white min-w-[420px]"
          >
            <div class="col-span-3">Tag</div>
            <div class="col-span-4">Operator</div>
            <div class="col-span-4">Value</div>
            <div class="col-span-1"></div>
          </div>

          <!-- Flat rules -->
          <div class="divide-y divide-gray-100">
            <Rule
              v-for="(rule, i) in props.visibility.rules"
              :key="i"
              :rule="rule"
              @remove="removeRule(props.visibility.rules, i)"
              @change="saveToHistory('visibility-rule')"
            />
          </div>
        </div>

        <!-- Add flat rule -->
        <div class="px-3 py-2 bg-white border-t border-gray-100">
          <button
            @click="addRule(props.visibility.rules)"
            class="flex items-center gap-1 text-xs text-green-500 hover:text-green-700"
          >
            <Icon name="plus" style="font-size: 10px" />
            Add rule
          </button>
        </div>

        <!-- Empty state -->
        <div
          v-if="
            !props.visibility.rules.length && !props.visibility.groups?.length
          "
          class="px-3 pb-2 text-xs text-gray-400 italic"
        >
          No rules yet. Add a rule or a group below.
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           GROUPS
           ════════════════════════════════════════════════════════════════════ -->
      <div v-if="props.visibility.groups?.length" class="mt-3 space-y-3">
        <div class="text-[10px] text-gray-400 uppercase tracking-wide">
          Groups — combined with top-level rules using
          <span class="font-semibold text-gray-600">
            {{ props.visibility.match === "all" ? "AND" : "OR" }}
          </span>
        </div>

        <div
          v-for="(group, gi) in props.visibility.groups"
          :key="gi"
          class="border border-blue-200 rounded-md overflow-hidden"
        >
          <!-- Group header -->
          <div
            class="flex items-start justify-between gap-2 bg-blue-50 px-3 py-2 border-b border-blue-200"
          >
            <div class="flex items-center gap-2 rules-scroll pb-1">
              <span class="text-xs text-blue-600 font-medium shrink-0">
                Group {{ gi + 1 }} Match:
              </span>
              <div class="w-44">
                <Select
                  :model-value="group.match"
                  :options="MATCH_OPTIONS"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full text-sm"
                  placeholder="Select match"
                  @update:model-value="onGroupMatchChange(group, $event)"
                />
              </div>
              <span class="text-[10px] text-blue-400 ml-1 shrink-0">
                {{ group.match === "all" ? "— AND" : "— OR" }}
              </span>
            </div>
            <div class="relative group/btn">
              <button
                @click="removeGroup(gi)"
                class="mt-1 w-6 h-6 flex items-center justify-center text-blue-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current"
                >
                  <path
                    d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>

              <div
                class="pointer-events-none absolute top-full right-0 mt-2 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 -translate-y-1 group-hover/btn:translate-y-0 transition-all duration-150 z-50 after:content-[''] after:absolute after:bottom-full after:right-3 after:border-4 after:border-transparent after:border-b-gray-900"
              >
                Remove group
              </div>
            </div>
          </div>

          <!-- Scrollable group rules table -->
          <div class="rules-scroll">
            <!-- Group column headers (desktop) -->
            <div
              class="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-medium text-gray-400 border-b border-blue-100 bg-white min-w-[420px]"
            >
              <div class="col-span-3">Tag</div>
              <div class="col-span-4">Operator</div>
              <div class="col-span-4">Value</div>
              <div class="col-span-1"></div>
            </div>

            <!-- Group rules -->
            <div class="divide-y divide-gray-100">
              <Rule
                v-for="(rule, ri) in group.rules"
                :key="ri"
                :rule="rule"
                @remove="removeRule(group.rules, ri)"
                @change="saveToHistory('visibility-group-rule')"
              />
            </div>
          </div>

          <!-- Add rule to group -->
          <div class="px-3 py-2 bg-white border-t border-blue-100">
            <button
              @click="addRule(group.rules)"
              class="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            >
              <Icon name="plus" style="font-size: 10px" />
              Add rule to group
            </button>
          </div>

          <div
            v-if="!group.rules.length"
            class="px-3 pb-2 text-xs text-gray-400 italic"
          >
            Empty group — add at least one rule.
          </div>
        </div>
      </div>

      <!-- Add group -->
      <button
        @click="addGroup"
        class="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-3"
      >
        <Icon name="plus" style="font-size: 10px" />
        Add group
      </button>
    </template>
  </PropertySection>
</template>

<script setup lang="ts">
import Select from "@/components/ui/primitives/Select.vue";
import Icon from "@/components/ui/Icon.vue";
import PropertySection from "./PropertySection.vue";
import Rule from "./visibility-rule/Rule.vue";
import {
  type VisibilityOperator,
  type VisibilityGroup,
} from "@/composables/emailBuilder/core/useEmailBuilderVisibility";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";

const { saveToHistory } = useEmailBuilder();

// ── Props ────────────────────────────────────────────────────────────────────

const props = defineProps({
  visibility: {
    type: Object as () => {
      enabled: boolean;
      match: "all" | "any";
      rules: { tag: string; operator: VisibilityOperator; value: string }[];
      groups?: VisibilityGroup[];
    },
    required: true,
  },
});

// ── Static options ───────────────────────────────────────────────────────────

const MATCH_OPTIONS = [
  { label: "All rules (AND)", value: "all" },
  { label: "Any rule (OR)", value: "any" },
];

// ── Handlers — every mutation calls saveToHistory ────────────────────────────

// FIX: was `props.visibility.enabled = !props.visibility.enabled` inline in template
const toggleEnabled = () => {
  props.visibility.enabled = !props.visibility.enabled;
  saveToHistory("visibility-toggle");
};

// FIX: was v-model directly on Select — replaced with explicit handler
const onMatchChange = (value: unknown) => {
  if (value !== "all" && value !== "any") return;
  props.visibility.match = value;
  saveToHistory("visibility-match");
};

// FIX: was v-model directly on group Select
const onGroupMatchChange = (group: VisibilityGroup, value: unknown) => {
  if (value !== "all" && value !== "any") return;
  group.match = value;
  saveToHistory("visibility-group-match");
};

const addRule = (
  rules: { tag: string; operator: VisibilityOperator; value: string }[],
) => {
  rules.push({ tag: "", operator: "==", value: "" });
  saveToHistory("visibility-add-rule");
};

// FIX: was `props.visibility.rules.splice(i, 1)` inline in template
const removeRule = (
  rules: { tag: string; operator: VisibilityOperator; value: string }[],
  index: number,
) => {
  rules.splice(index, 1);
  saveToHistory("visibility-remove-rule");
};

const addGroup = () => {
  if (!props.visibility.groups) {
    props.visibility.groups = [];
  }
  props.visibility.groups.push({ match: "all", rules: [] });
  saveToHistory("visibility-add-group");
};

// FIX: was `props.visibility.groups!.splice(gi, 1)` inline in template
const removeGroup = (index: number) => {
  props.visibility.groups!.splice(index, 1);
  saveToHistory("visibility-remove-group");
};
</script>

<style scoped>
.rules-scroll {
  overflow-x: auto;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}
.rules-scroll::-webkit-scrollbar {
  height: 6px;
}
.rules-scroll::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}
.rules-scroll::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}
.rules-scroll::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
