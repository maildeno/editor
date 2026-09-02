<template>
  <div v-if="!isDesktop" class="desktop-gate">
    <div class="gate-container">
      <!-- Animated brand badge -->
      <div class="brand-badge">
        <div class="badge-ring"></div>
        <div class="badge-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 4L4 10V22L16 28L28 22V10L16 4Z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
            <path
              d="M16 16L28 10M16 16L4 10M16 16V28"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="16" cy="16" r="3" fill="currentColor" />
          </svg>
        </div>
      </div>

      <!-- Main content -->
      <div class="gate-content">
        <h1 class="gate-title">
          <span class="brand-gradient">Desktop Experience</span>
          <span> Required</span>
        </h1>

        <p class="gate-description">
          This application is optimized for desktop and laptop devices to
          deliver the full experience.
        </p>

        <!-- Feature highlights -->
        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect
                  x="2"
                  y="4"
                  width="16"
                  height="12"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
                <path
                  d="M6 16L4 18M14 16L16 18M2 8H18"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
              </svg>
            </div>
            <span>Template Builder</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 13L7 9L10 12L17 5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
                <path
                  d="M3 17H17"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <span>Visual Debugger</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 6L10 3L16 6L10 9L4 6Z"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
                <path
                  d="M4 10L10 13L16 10"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
                <path
                  d="M4 14L10 17L16 14"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
              </svg>
            </div>
            <span>Development</span>
          </div>
        </div>

        <!-- Device detection status -->
        <div class="detection-status">
          <span class="status-dot"></span>
          <span>Detected: Mobile / Tablet</span>
        </div>
      </div>

      <!-- Footer with brand link.
        Hidden entirely when brandName is an empty string. That is the same
        presence/absence gating used elsewhere in the package (onSendTestEmail's
        mere presence is what reveals the Send-test button), so a white-label
        host can drop the attribution line without a second prop existing just
        to control it. Omitting brandName keeps the default instead — an
        absent prop and a deliberately blank one are different intents. -->
      <div v-if="brandName" class="gate-footer">
        <span class="footer-text">Powered by</span>
        <span class="brand-text">{{ brandName }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDeviceDetection } from "@/composables/system/useDeviceDetection";
import { DEFAULT_BRAND_NAME } from "@/brand";

interface Props {
  /**
   * Name shown in the "Powered by" line at the bottom of the notice.
   *
   * EmailEditor.vue forwards the prop through without redeclaring a default
   * of its own, so an undefined value arriving from any of the three mount
   * paths (Vue component, custom element, light DOM) lands here and resolves
   * the same way. Pass an empty string to hide the line entirely.
   *
   * The default itself now lives in brand.ts — Loader.vue renders the same
   * name, and two inline copies of the string would be two things to keep in
   * step. Behaviour here is unchanged.
   */
  brandName?: string;
}

withDefaults(defineProps<Props>(), {
  brandName: DEFAULT_BRAND_NAME,
});

const { isDesktop } = useDeviceDetection();
</script>

<style scoped>
/* ===== DESIGN SYSTEM TOKENS =====
 * Each token reads from the shared --md-* custom properties (see theme.ts)
 * and falls back to this component's original hardcoded value when the
 * host hasn't set that property. That means an untouched app looks exactly
 * as before, and a host calling setEditorTheme() re-themes this notice too,
 * without editing this file again. */
.desktop-gate {
  --brand-primary: var(--md-primary, #4a7c59);
  --brand-primary-dark: var(--md-primary-hover, #3a5a40);
  --brand-primary-light: var(--md-primary-hover, #3a5a40);
  --brand-gradient-start: var(--md-primary, #4a7c59);
  --brand-gradient-end: var(--md-primary-hover, #3a5a40);
  --gate-surface: var(--md-surface, #ffffff);
  --gate-backdrop: var(--md-background, #f9fafb);
  --gate-on-primary: var(--md-on-primary, #ffffff);
  --gate-warning: var(--md-warning, #f59e0b);
  --gray-50: var(--md-background, #f9fafb);
  --gray-100: var(--md-surface-muted, #f3f4f6);
  --gray-200: var(--md-border, #e5e7eb);
  --gray-300: var(--md-border-strong, #d1d5db);
  --gray-400: var(--md-text-subtle, #9ca3af);
  --gray-500: var(--md-text-subtle, #6b7280);
  --gray-600: var(--md-text-muted, #4b5563);
  --gray-700: var(--md-text-muted, #374151);
  --gray-800: var(--md-text, #1f2937);
  --gray-900: var(--md-text, #111827);
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg:
    0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl:
    0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
}

/* ===== MAIN LAYOUT ===== */
.desktop-gate {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--gate-backdrop) 98%, transparent);
  backdrop-filter: blur(2px);
  padding: 1.5rem;
}

.gate-container {
  max-width: 520px;
  width: 100%;
  background: var(--gate-surface);
  border-radius: 2rem;
  padding: 2.5rem;
  text-align: center;
  box-shadow: var(--shadow-2xl);
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--gray-200);
}

/* ===== BRAND BADGE ===== */
.brand-badge {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    var(--brand-gradient-start),
    var(--brand-gradient-end)
  );
  animation: pulseRing 2s ease-out infinite;
}

.badge-icon {
  position: relative;
  width: 56px;
  height: 56px;
  background: var(--gate-surface);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-primary);
  box-shadow: var(--shadow-md);
  transition: transform 0.2s ease;
}

.gate-container:hover .badge-icon {
  transform: scale(1.02);
}

/* ===== TYPOGRAPHY ===== */
.gate-title {
  font-size: 1.875rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 1rem 0;
  color: var(--gray-900);
}

.brand-gradient {
  background: linear-gradient(
    135deg,
    var(--brand-gradient-start),
    var(--brand-gradient-end)
  );
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.gate-description {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--gray-600);
  margin: 0 0 1.75rem 0;
}

/* ===== FEATURE GRID ===== */
.feature-grid {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1rem 0;
  border-top: 1px solid var(--gray-200);
  border-bottom: 1px solid var(--gray-200);
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-700);
}

.feature-icon {
  width: 36px;
  height: 36px;
  background: var(--gray-100);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-primary);
  transition: all 0.2s ease;
}

.feature-item:hover .feature-icon {
  background: var(--brand-primary);
  color: var(--gate-on-primary);
  transform: translateY(-2px);
}

/* ===== STATUS ===== */
.detection-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--gray-100);
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-600);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: var(--gate-warning);
  border-radius: 50%;
  animation: pulse 1.5s ease-out infinite;
}

/* ===== FOOTER ===== */
.gate-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--gray-400);
}

.brand-text {
  font-weight: 600;
  background: linear-gradient(
    135deg,
    var(--brand-gradient-start),
    var(--brand-gradient-end)
  );
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

/* ===== ANIMATIONS ===== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulseRing {
  0% {
    opacity: 1;
    transform: scale(0.95);
  }
  70% {
    opacity: 0.4;
    transform: scale(1.15);
  }
  100% {
    opacity: 0;
    transform: scale(1.25);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* ===== RESPONSIVE TOUCH-UPS ===== */
@media (max-width: 480px) {
  .gate-container {
    padding: 2rem 1.5rem;
  }

  .gate-title {
    font-size: 1.5rem;
  }

  .feature-grid {
    gap: 1.25rem;
  }
}
</style>
