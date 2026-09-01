<template>
  <div v-if="!metrics.isEmpty" class="relative" ref="rootRef">
    <!-- ── Pulsating orb trigger ──────────────────────────────────────────── -->
    <button
      class="health-orb"
      :class="[
        `health-orb--${overallStatus}`,
        { 'health-orb--active': isOpen },
      ]"
      @click="toggle"
      aria-label="Email health indicator"
      :aria-expanded="isOpen"
    >
      <!-- Outer pulse ring -->
      <span class="orb-ring orb-ring--outer" />
      <!-- Inner pulse ring -->
      <span class="orb-ring orb-ring--inner" />
      <!-- Core dot -->
      <span class="orb-core" />
    </button>

    <!-- ── Popover panel ──────────────────────────────────────────────────── -->
    <Transition name="popover">
      <div
        v-if="isOpen"
        class="health-panel"
        :class="{ 'health-panel--expanded': isPanelExpanded }"
        role="dialog"
        aria-label="Email health details"
      >
        <!-- Header -->
        <div class="panel-header">
          <span class="panel-title">Email Health</span>
          <div class="panel-header-right">
            <span
              class="panel-status-badge"
              :class="`status-badge--${overallStatus}`"
            >
              {{ overallStatusLabel }}
            </span>
            <button
              type="button"
              class="panel-expand-btn"
              :class="{ 'panel-expand-btn--active': isPanelExpanded }"
              @click.stop="isPanelExpanded = !isPanelExpanded"
              :aria-label="
                isPanelExpanded
                  ? 'Collapse panel'
                  : 'Expand panel for more detail'
              "
              :aria-pressed="isPanelExpanded"
              title="Toggle wide view"
            >
              <!-- Double-arrow icon -->
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 6h10M8.5 3.5L11 6l-2.5 2.5M3.5 3.5L1 6l2.5 2.5"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Text : Image ratio card ─────────────────────────────────── -->
        <div
          class="metric-card"
          :class="[
            `metric-card--${metrics.ratioStatus}`,
            { 'metric-card--expanded': expandedCard === 'ratio' },
          ]"
          @click="toggleCard('ratio')"
          tabindex="0"
          @keydown.enter="toggleCard('ratio')"
          @keydown.space.prevent="toggleCard('ratio')"
          role="button"
          :aria-expanded="expandedCard === 'ratio'"
        >
          <!-- Card summary row -->
          <div class="metric-summary">
            <div class="metric-left">
              <span class="metric-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect
                    x="0.5"
                    y="0.5"
                    width="4"
                    height="11"
                    rx="1"
                    :fill="statusColor(metrics.ratioStatus)"
                    opacity="0.9"
                  />
                  <rect
                    x="6.5"
                    y="3.5"
                    width="5"
                    height="8"
                    rx="1"
                    :fill="statusColor(metrics.ratioStatus)"
                    opacity="0.4"
                  />
                </svg>
              </span>
              <span class="metric-label">Text : Image</span>
            </div>
            <div class="metric-right">
              <!-- Mini stacked bar -->
              <div class="mini-bar">
                <div
                  class="mini-bar-fill"
                  :class="`mini-bar-fill--${metrics.ratioStatus}`"
                  :style="{ width: `${metrics.textRatio}%` }"
                />
              </div>
              <span
                class="metric-value"
                :class="`metric-value--${metrics.ratioStatus}`"
              >
                {{ metrics.textRatio }}%
              </span>
              <svg
                class="chevron"
                :class="{ 'chevron--open': expandedCard === 'ratio' }"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>

          <!-- Expanded detail -->
          <Transition name="expand">
            <div v-if="expandedCard === 'ratio'" class="metric-detail">
              <p class="detail-tip">{{ metrics.ratioTip }}</p>
              <div class="detail-stats">
                <div class="stat-item">
                  <span class="stat-label">Text chars</span>
                  <span class="stat-value">{{
                    metrics.textChars.toLocaleString()
                  }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Text weight</span>
                  <span class="stat-value">{{ metrics.textRatio }}%</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Images</span>
                  <span class="stat-value">{{ metrics.imageCompCount }}</span>
                </div>
                <div class="stat-item" v-if="metrics.socialIconCount > 0">
                  <span class="stat-label">Social icons</span>
                  <span class="stat-value">{{ metrics.socialIconCount }}</span>
                </div>
                <div class="stat-item" v-if="metrics.buttonIconCount > 0">
                  <span class="stat-label">Button icons</span>
                  <span class="stat-value">{{ metrics.buttonIconCount }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Image weight</span>
                  <span class="stat-value">{{ metrics.imageRatio }}%</span>
                </div>
              </div>
              <div class="detail-thresholds">
                <span class="threshold threshold--good">≥60% text = good</span>
                <span class="threshold threshold--warn">40–59% = caution</span>
                <span class="threshold threshold--bad"
                  >&lt;40% = spam risk</span
                >
              </div>
            </div>
          </Transition>
        </div>

        <!-- ── HTML size estimate card ────────────────────────────────────── -->
        <div
          class="metric-card"
          :class="[
            `metric-card--${metrics.kbStatus}`,
            { 'metric-card--expanded': expandedCard === 'kb' },
          ]"
          @click="toggleCard('kb')"
          tabindex="0"
          @keydown.enter="toggleCard('kb')"
          @keydown.space.prevent="toggleCard('kb')"
          role="button"
          :aria-expanded="expandedCard === 'kb'"
        >
          <!-- Card summary row -->
          <div class="metric-summary">
            <div class="metric-left">
              <span class="metric-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 10V2l3 2.5L8 1l2 3v6H2z"
                    :stroke="statusColor(metrics.kbStatus)"
                    stroke-width="1.2"
                    stroke-linejoin="round"
                    fill="none"
                  />
                </svg>
              </span>
              <span class="metric-label">HTML Size</span>
            </div>
            <div class="metric-right">
              <span
                v-if="metrics.kbStatus === 'bad'"
                class="pulse-dot pulse-dot--bad"
              />
              <span
                v-else
                class="status-dot"
                :class="`status-dot--${metrics.kbStatus}`"
              />
              <span
                class="metric-value"
                :class="`metric-value--${metrics.kbStatus}`"
              >
                ~{{ metrics.estimatedLow }}–{{ metrics.estimatedHigh }} KB
              </span>
              <svg
                class="chevron"
                :class="{ 'chevron--open': expandedCard === 'kb' }"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>

          <!-- Expanded detail -->
          <Transition name="expand">
            <div v-if="expandedCard === 'kb'" class="metric-detail">
              <p class="detail-tip">{{ metrics.kbTip }}</p>

              <!-- Export format note -->
              <div class="format-note">
                <div class="format-row format-row--html">
                  <span class="format-badge">HTML</span>
                  <div class="format-info">
                    <span class="format-range"
                      >{{ metrics.estimatedLow }}–{{ metrics.estimatedHigh }} KB
                      estimated</span
                    >
                    <span class="format-caveat">
                      Prettier formatting adds ~20–30% on export (no minify
                      option). Actual exported file may be larger.
                    </span>
                  </div>
                </div>
                <div class="format-row format-row--other">
                  <span class="format-badge format-badge--muted">JSX</span>
                  <div class="format-info">
                    <span class="format-range format-range--muted"
                      >Size unpredictable</span
                    >
                    <span class="format-caveat"
                      >React Email renders its own HTML — final size depends on
                      its transformer output.</span
                    >
                  </div>
                </div>
                <div class="format-row format-row--other">
                  <span class="format-badge format-badge--muted">MJML</span>
                  <div class="format-info">
                    <span class="format-range format-range--muted"
                      >Size unpredictable</span
                    >
                    <span class="format-caveat"
                      >MJML compiles to HTML with its own markup; final size
                      varies.</span
                    >
                  </div>
                </div>
              </div>

              <div class="detail-thresholds">
                <span class="threshold threshold--good">&lt;60 KB safe</span>
                <span class="threshold threshold--warn">60–80 KB caution</span>
                <span class="threshold threshold--bad"
                  >102+ KB Gmail clips</span
                >
              </div>
            </div>
          </Transition>
        </div>

        <!-- ── Accessibility card ─────────────────────────────────────────── -->
        <div
          class="metric-card"
          :class="[
            `metric-card--${a11ySummary.status}`,
            { 'metric-card--expanded': expandedCard === 'a11y' },
          ]"
          @click="toggleCard('a11y')"
          tabindex="0"
          @keydown.enter="toggleCard('a11y')"
          @keydown.space.prevent="toggleCard('a11y')"
          role="button"
          :aria-expanded="expandedCard === 'a11y'"
        >
          <!-- Card summary row -->
          <div class="metric-summary">
            <div class="metric-left">
              <span class="metric-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle
                    cx="6"
                    cy="3"
                    r="1.4"
                    :fill="statusColor(a11ySummary.status)"
                  />
                  <path
                    d="M3 6h6M6 6v4M4.2 10l1.8-2.5L7.8 10"
                    :stroke="statusColor(a11ySummary.status)"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    fill="none"
                  />
                </svg>
              </span>
              <span class="metric-label">Accessibility</span>
            </div>
            <div class="metric-right">
              <span
                v-if="a11ySummary.status === 'bad'"
                class="pulse-dot pulse-dot--bad"
              />
              <span
                v-else
                class="status-dot"
                :class="`status-dot--${a11ySummary.status}`"
              />
              <span
                class="metric-value"
                :class="`metric-value--${a11ySummary.status}`"
              >
                {{ a11ySummary.summaryMessage }}
              </span>
              <svg
                class="chevron"
                :class="{ 'chevron--open': expandedCard === 'a11y' }"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>

          <!-- Expanded detail -->
          <Transition name="expand">
            <div
              v-if="expandedCard === 'a11y'"
              class="metric-detail a11y-detail"
              @click.stop
            >
              <!-- Tabs -->
              <div
                class="a11y-tabs"
                role="tablist"
                aria-label="Accessibility issue status"
              >
                <button
                  type="button"
                  class="a11y-tab a11y-tab--failed"
                  :class="{ 'a11y-tab--active': a11yTab === 'failed' }"
                  role="tab"
                  :aria-selected="a11yTab === 'failed'"
                  @click.stop="a11yTab = 'failed'"
                >
                  <span class="a11y-tab-label">Failed</span>
                  <span class="a11y-tab-count a11y-tab-count--failed">
                    {{ a11ySummary.failedCount }}
                  </span>
                </button>
                <button
                  type="button"
                  class="a11y-tab a11y-tab--passed"
                  :class="{ 'a11y-tab--active': a11yTab === 'passed' }"
                  role="tab"
                  :aria-selected="a11yTab === 'passed'"
                  @click.stop="a11yTab = 'passed'"
                >
                  <span class="a11y-tab-label">Passed</span>
                  <span class="a11y-tab-count a11y-tab-count--passed">
                    {{ a11ySummary.passedCount }}
                  </span>
                </button>
                <button
                  type="button"
                  class="a11y-tab a11y-tab--ignored"
                  :class="{ 'a11y-tab--active': a11yTab === 'ignored' }"
                  role="tab"
                  :aria-selected="a11yTab === 'ignored'"
                  @click.stop="a11yTab = 'ignored'"
                >
                  <span class="a11y-tab-label">Ignored</span>
                  <span class="a11y-tab-count a11y-tab-count--ignored">
                    {{ a11ySummary.ignoredCount }}
                  </span>
                </button>
              </div>

              <!-- Failed list -->
              <div
                v-if="a11yTab === 'failed'"
                class="a11y-list"
                role="tabpanel"
              >
                <p v-if="a11ySummary.failed.length === 0" class="a11y-empty">
                  No failing checks. Your email looks accessible.
                </p>
                <div
                  v-for="issue in a11ySummary.failed"
                  :key="trackByIssueId(issue)"
                  class="a11y-item"
                  :class="`a11y-item--${issue.severity}`"
                >
                  <div class="a11y-item-header">
                    <span
                      class="a11y-severity"
                      :class="`a11y-severity--${issue.severity}`"
                    >
                      {{ issue.severity }}
                    </span>
                    <span class="a11y-rule">{{ issue.rule }}</span>
                    <button
                      type="button"
                      class="a11y-action"
                      @click.stop="ignoreIssue(issue.id)"
                      :aria-label="`Ignore: ${issue.rule}`"
                    >
                      Ignore
                    </button>
                  </div>
                  <p class="a11y-message">{{ issue.message }}</p>
                  <p class="a11y-info">{{ issue.info }}</p>
                </div>
              </div>

              <!-- Passed list -->
              <div
                v-if="a11yTab === 'passed'"
                class="a11y-list"
                role="tabpanel"
              >
                <p v-if="a11ySummary.passed.length === 0" class="a11y-empty">
                  No checks have passed yet — start adding content to see
                  results.
                </p>
                <div
                  v-for="issue in a11ySummary.passed"
                  :key="trackByIssueId(issue)"
                  class="a11y-item a11y-item--passed"
                >
                  <div class="a11y-item-header">
                    <span class="a11y-severity a11y-severity--passed"
                      >passed</span
                    >
                    <span class="a11y-rule">{{ issue.rule }}</span>
                  </div>
                  <p class="a11y-message">{{ issue.message }}</p>
                </div>
              </div>

              <!-- Ignored list -->
              <div
                v-if="a11yTab === 'ignored'"
                class="a11y-list"
                role="tabpanel"
              >
                <p v-if="a11ySummary.ignored.length === 0" class="a11y-empty">
                  Nothing ignored. Use "Ignore" on a failing check to suppress
                  it here.
                </p>
                <div
                  v-for="issue in a11ySummary.ignored"
                  :key="trackByIssueId(issue)"
                  class="a11y-item a11y-item--ignored"
                >
                  <div class="a11y-item-header">
                    <span class="a11y-severity a11y-severity--ignored"
                      >ignored</span
                    >
                    <span class="a11y-rule">{{ issue.rule }}</span>
                    <button
                      type="button"
                      class="a11y-action a11y-action--restore"
                      @click.stop="restoreIssue(issue.id)"
                      :aria-label="`Restore: ${issue.rule}`"
                    >
                      Restore
                    </button>
                  </div>
                  <p class="a11y-message">{{ issue.message }}</p>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Panel footer tip -->
        <p class="panel-footer">
          Estimates based on template structure · ±8–10% variance
        </p>
      </div>
    </Transition>

    <!-- Click outside overlay -->
    <div v-if="isOpen" class="click-outside" @click="close" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { healthIndicator } from "@/composables/emailBuilder/health/healthIndicator";
import {
  accessibilityChecker,
  type AccessibilityIssue,
} from "@/composables/emailBuilder/health/accessibilityChecker";
import { useEmailBuilder } from "@/composables/emailBuilder/core/useEmailBuilder";

const {
  rows,
  canvasStyles,
  // Merge-tag preview state — used so the checker resolves tags the same way
  // RichTextEditor / AnchorRenderer / ImageRenderer do at preview time.
  mergeTagPreviewContext,
  mergeTagPreviewActive,
  linkTagPreviewContext,
  linkTagPreviewActive,
} = useEmailBuilder();
const { metrics } = healthIndicator(rows);

// Either preview being on enables tag resolution in the checker — they're
// independent toggles in the UI but for accessibility purposes "preview is
// active" means at least one context is providing values.
const previewActive = computed(
  () => !!(mergeTagPreviewActive?.value || linkTagPreviewActive?.value),
);

// Email-level metadata for document-scope rules (lang, preheader). Pass as a
// computed ref so the checker reactively re-runs when these change. The
// checker accepts multiple field names (lang/language/locale,
// preheader/preheaderText/previewText) so this stays robust if you rename
// later.
const emailMeta = computed(() => ({
  lang: canvasStyles?.value?.language,
  preheader: canvasStyles?.value?.preheaderText,
}));

const {
  summary: a11ySummary,
  ignoreIssue,
  restoreIssue,
} = accessibilityChecker(rows, {
  bodyBg: computed(() => canvasStyles?.value?.bodyBackgroundColor ?? "#ffffff"),
  emailMeta,
  mergeTagContext: mergeTagPreviewContext,
  linkTagContext: linkTagPreviewContext,
  previewActive,
});

const isOpen = ref(false);
const isPanelExpanded = ref(false);
const expandedCard = ref<"ratio" | "kb" | "a11y" | null>(null);
const a11yTab = ref<"failed" | "passed" | "ignored">("failed");
const rootRef = ref<HTMLElement | null>(null);

const overallStatus = computed(() => {
  if (
    metrics.value.ratioStatus === "bad" ||
    metrics.value.kbStatus === "bad" ||
    a11ySummary.value.status === "bad"
  )
    return "bad";
  if (
    metrics.value.ratioStatus === "warn" ||
    metrics.value.kbStatus === "warn" ||
    a11ySummary.value.status === "warn"
  )
    return "warn";
  return "good";
});

const overallStatusLabel = computed(() => {
  if (overallStatus.value === "bad") return "Needs attention";
  if (overallStatus.value === "warn") return "Review suggested";
  return "Looks healthy";
});

function statusColor(status: "good" | "warn" | "bad") {
  if (status === "good") return "#22c55e";
  if (status === "warn") return "#f59e0b";
  return "#ef4444";
}

function toggle() {
  isOpen.value = !isOpen.value;
  if (!isOpen.value) {
    expandedCard.value = null;
    isPanelExpanded.value = false;
  }
}

function close() {
  isOpen.value = false;
  expandedCard.value = null;
  isPanelExpanded.value = false;
}

function toggleCard(card: "ratio" | "kb" | "a11y") {
  expandedCard.value = expandedCard.value === card ? null : card;
}

function trackByIssueId(issue: AccessibilityIssue) {
  return issue.id;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
/* ── Orb ──────────────────────────────────────────────────────────────────── */

.health-orb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  outline: none;
  flex-shrink: 0;
}

.health-orb:focus-visible .orb-core {
  box-shadow: 0 0 0 3px rgba(66, 56, 158, 0.4);
}

/* Pulse rings */
.orb-ring {
  position: absolute;
  border-radius: 50%;
  animation: orb-pulse 2.4s ease-out infinite;
}

.orb-ring--outer {
  width: 22px;
  height: 22px;
  animation-delay: 0s;
}

.orb-ring--inner {
  width: 16px;
  height: 16px;
  animation-delay: 0.6s;
}

/* Core */
.orb-core {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
  z-index: 1;
}

.health-orb:hover .orb-core,
.health-orb--active .orb-core {
  transform: scale(1.15);
}

/* ── Status colours with brand accent ───────────────────────────────────────── */

.health-orb--good .orb-ring {
  background: rgba(34, 197, 94, 0.25);
}
.health-orb--good .orb-core {
  background: #22c55e;
  box-shadow:
    0 0 0 2px rgba(34, 197, 94, 0.2),
    0 0 8px rgba(34, 197, 94, 0.4);
}

.health-orb--warn .orb-ring {
  background: rgba(245, 158, 11, 0.28);
}
.health-orb--warn .orb-core {
  background: #f59e0b;
  box-shadow:
    0 0 0 2px rgba(245, 158, 11, 0.2),
    0 0 8px rgba(245, 158, 11, 0.4);
}

.health-orb--bad .orb-ring {
  background: rgba(239, 68, 68, 0.28);
}
.health-orb--bad .orb-core {
  background: #ef4444;
  box-shadow:
    0 0 0 2px rgba(239, 68, 68, 0.2),
    0 0 8px rgba(239, 68, 68, 0.4);
}

@keyframes orb-pulse {
  0% {
    transform: scale(0.6);
    opacity: 0.7;
  }
  60% {
    transform: scale(1.6);
    opacity: 0;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

/* ── Panel ────────────────────────────────────────────────────────────────── */

.health-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* Smooth horizontal expansion */
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.health-panel--expanded {
  width: 400px;
}

/* When expanded, stat grid uses 3 cols instead of 2 */
.health-panel--expanded .detail-stats {
  grid-template-columns: repeat(3, 1fr);
}

/* When expanded, accessibility list gets more vertical room */
.health-panel--expanded .a11y-list {
  max-height: 320px;
}

/* When expanded, format rows go side-by-side */
.health-panel--expanded .format-note {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.health-panel--expanded .format-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

/* ── Panel header with brand color ─────────────────────────────────────────── */

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Expand toggle button */
.panel-expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.panel-expand-btn:hover {
  background: rgba(66, 56, 158, 0.18);
  border-color: rgba(66, 56, 158, 0.4);
  color: #a5b4fc;
}

.panel-expand-btn:focus-visible {
  outline: 2px solid rgba(66, 56, 158, 0.5);
  outline-offset: 1px;
}

.panel-expand-btn--active {
  background: rgba(66, 56, 158, 0.2);
  border-color: rgba(66, 56, 158, 0.45);
  color: #a5b4fc;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a5b4fc;
}

.panel-status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
}

.status-badge--good {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}
.status-badge--warn {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}
.status-badge--bad {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* ── Metric cards ─────────────────────────────────────────────────────────── */

.metric-card {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
  overflow: hidden;
  user-select: none;
}

.metric-card:hover {
  background: rgba(66, 56, 158, 0.1);
  border-color: rgba(66, 56, 158, 0.3);
}

.metric-card:focus-visible {
  outline: 2px solid rgba(66, 56, 158, 0.5);
  outline-offset: 2px;
}

.metric-card--good {
  border-color: rgba(34, 197, 94, 0.15);
}
.metric-card--warn {
  border-color: rgba(245, 158, 11, 0.15);
}
.metric-card--bad {
  border-color: rgba(239, 68, 68, 0.2);
}

.metric-card--good.metric-card--expanded {
  background: rgba(34, 197, 94, 0.05);
}
.metric-card--warn.metric-card--expanded {
  background: rgba(245, 158, 11, 0.05);
}
.metric-card--bad.metric-card--expanded {
  background: rgba(239, 68, 68, 0.06);
}

/* ── Summary row ──────────────────────────────────────────────────────────── */

.metric-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 10px;
  gap: 8px;
}

.metric-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.metric-icon {
  display: flex;
  align-items: center;
  opacity: 0.8;
  flex-shrink: 0;
}

.metric-label {
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.metric-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Mini bar */
.mini-bar {
  width: 36px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s ease;
}

.mini-bar-fill--good {
  background: #22c55e;
}
.mini-bar-fill--warn {
  background: #f59e0b;
}
.mini-bar-fill--bad {
  background: #ef4444;
}

/* Status dot */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot--good {
  background: #22c55e;
}
.status-dot--warn {
  background: #f59e0b;
}
.status-dot--bad {
  background: #ef4444;
}

/* Pulsing dot for bad status */
.pulse-dot {
  position: relative;
  width: 6px;
  height: 6px;
  flex-shrink: 0;
}
.pulse-dot::before,
.pulse-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
.pulse-dot--bad::before {
  background: #ef4444;
  z-index: 1;
}
.pulse-dot--bad::after {
  background: #ef4444;
  animation: dot-ping 1.5s ease-out infinite;
}

@keyframes dot-ping {
  0% {
    transform: scale(1);
    opacity: 0.75;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.metric-value {
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.metric-value--good {
  color: #4ade80;
}
.metric-value--warn {
  color: #fbbf24;
}
.metric-value--bad {
  color: #f87171;
}

/* Chevron */
.chevron {
  color: rgba(255, 255, 255, 0.3);
  transition:
    transform 0.2s ease,
    color 0.15s ease;
  flex-shrink: 0;
}
.chevron--open {
  transform: rotate(180deg);
  color: rgba(255, 255, 255, 0.6);
}
.metric-card:hover .chevron {
  color: rgba(255, 255, 255, 0.5);
}

/* ── Expanded detail ──────────────────────────────────────────────────────── */

.metric-detail {
  padding: 0 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.detail-tip {
  font-size: 11px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.55);
  margin: 6px 0 0;
}

/* Stats grid */
.detail-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}

.stat-label {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

.stat-value {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  font-variant-numeric: tabular-nums;
}

/* Thresholds */
.detail-thresholds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.threshold {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 99px;
}

.threshold--good {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}
.threshold--warn {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}
.threshold--bad {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

/* ── Format note (KB card) ────────────────────────────────────────────────── */

.format-note {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 8px;
}

.format-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.format-badge {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 1px;
  background: rgba(66, 56, 158, 0.3);
  color: #a5b4fc;
}

.format-badge--muted {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.35);
}

.format-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.format-range {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.format-range--muted {
  color: rgba(255, 255, 255, 0.35);
  font-weight: 500;
}

.format-caveat {
  font-size: 10px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.35);
}

/* ── Accessibility card ───────────────────────────────────────────────────── */

.a11y-detail {
  cursor: default;
  padding: 8px 10px 10px;
  gap: 10px;
}

/* Tabs */
.a11y-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: rgba(0, 0, 0, 0.25);
  padding: 3px;
  border-radius: 8px;
}

.a11y-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 4px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.45);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.a11y-tab:hover {
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.04);
}

.a11y-tab:focus-visible {
  outline: 2px solid rgba(66, 56, 158, 0.5);
  outline-offset: 1px;
}

.a11y-tab--active {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.92);
}

.a11y-tab-label {
  text-transform: uppercase;
}

.a11y-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.a11y-tab-count--failed {
  background: rgba(239, 68, 68, 0.18);
  color: #f87171;
}
.a11y-tab-count--passed {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}
.a11y-tab-count--ignored {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
}

/* List */
.a11y-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
  /* Custom thin scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.a11y-list::-webkit-scrollbar {
  width: 6px;
}
.a11y-list::-webkit-scrollbar-track {
  background: transparent;
}
.a11y-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 99px;
}

.a11y-empty {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  padding: 12px 4px;
  margin: 0;
}

.a11y-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 2px solid transparent;
}

.a11y-item--critical {
  border-left-color: #ef4444;
}
.a11y-item--serious {
  border-left-color: #f59e0b;
}
.a11y-item--passed {
  border-left-color: rgba(34, 197, 94, 0.5);
}
.a11y-item--ignored {
  border-left-color: rgba(255, 255, 255, 0.18);
  opacity: 0.75;
}

.a11y-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.a11y-severity {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.a11y-severity--critical {
  background: rgba(239, 68, 68, 0.18);
  color: #f87171;
}
.a11y-severity--serious {
  background: rgba(245, 158, 11, 0.18);
  color: #fbbf24;
}
.a11y-severity--passed {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}
.a11y-severity--ignored {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.5);
}

.a11y-rule {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.a11y-action {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 2px 7px;
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
  flex-shrink: 0;
}

.a11y-action:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.2);
}

.a11y-action:focus-visible {
  outline: 2px solid rgba(66, 56, 158, 0.5);
  outline-offset: 1px;
}

.a11y-action--restore {
  border-color: rgba(165, 180, 252, 0.25);
  color: #a5b4fc;
}

.a11y-action--restore:hover {
  background: rgba(66, 56, 158, 0.15);
  border-color: rgba(165, 180, 252, 0.4);
  color: #c7d2fe;
}

.a11y-message {
  font-size: 10.5px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.65);
  margin: 0;
}

.a11y-info {
  font-size: 10px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.38);
  margin: 0;
  padding-top: 2px;
  border-top: 1px dashed rgba(255, 255, 255, 0.06);
}

/* ── Panel footer ─────────────────────────────────────────────────────────── */

.panel-footer {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.22);
  text-align: center;
  padding-top: 4px;
  margin: 0;
}

/* ── Click-outside overlay ────────────────────────────────────────────────── */

.click-outside {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* ── Transitions ──────────────────────────────────────────────────────────── */

.popover-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.popover-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.popover-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px) scale(0.97);
}
.popover-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px) scale(0.98);
}

.expand-enter-active {
  transition:
    opacity 0.18s ease,
    max-height 0.22s ease;
  max-height: 300px;
  overflow: hidden;
}
.expand-leave-active {
  transition:
    opacity 0.12s ease,
    max-height 0.18s ease;
  overflow: hidden;
}
.expand-enter-from {
  opacity: 0;
  max-height: 0;
}
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
