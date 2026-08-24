// export/useExportSettings.ts
// ─────────────────────────────────────────────────────────────────────────────
// Global state for export-pipeline preferences.
//
// Currently owns:
//   minifyOutput  — when true, the post-format step runs whitespace compaction
//                   on the generated string before it is handed to downloadFile.
//
// Persistence
// -----------
// The toggle is persisted to localStorage under the key below so it survives
// page reloads.  The value is read once on first composable call and written
// on every toggle.  SSR-safe: localStorage access is guarded by typeof window.
// ─────────────────────────────────────────────────────────────────────────────

import { ref, watch } from "vue";

const STORAGE_KEY = "maildeno:export:minify";

// ── Module-level singleton (shared across all composable call sites) ──────────
const _minifyOutput = ref<boolean>(_readPersistedMinify());

function _readPersistedMinify(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// Persist every change
watch(_minifyOutput, (value) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage quota exceeded or private-browsing restriction — silently ignore.
  }
});

// ── Composable ────────────────────────────────────────────────────────────────

export function useExportSettings() {
  const toggleMinify = () => {
    _minifyOutput.value = !_minifyOutput.value;
  };

  return {
    /** When true, exported output is whitespace-compacted before download. */
    minifyOutput: _minifyOutput,
    toggleMinify,
  };
}
