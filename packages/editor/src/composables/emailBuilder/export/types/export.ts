// export/types/export.ts
// Shared types for the email export pipeline

/**
 * "prune"  — Evaluate visibility against the current preview context and
 *            OMIT rows / columns / components that do not match.
 *            Use this for one-time audience snapshots.
 *
 * "wrap"   — Include ALL rows / components regardless of visibility and
 *            WRAP matching rows in ESP conditional tags so the mail server
 *            evaluates them at send time.
 *            Use this for master templates uploaded to your ESP.
 */
export type ExportMode = "prune" | "wrap";

// ─── Tag substitution options ─────────────────────────────────────────────────
//
// Passed as a single object so the function signature stays stable as new
// preview features are added — just extend this interface, not the function
// parameter list.

export interface TagSubstitutionOptions {
  /** Values from MergeTagTab. Only applied when mergeTagActive is true. */
  mergeTagContext: Record<string, string>;
  mergeTagActive: boolean;
  /** Values from LinkTagTab. Only applied when linkTagActive is true. */
  linkTagContext: Record<string, string>;
  linkTagActive: boolean;
}

// ─── Generator bundle ─────────────────────────────────────────────────────────
//
// Passed from useEmailBuilder so the engine never imports generators directly.
// This decouples the orchestrator from individual generator implementations.

export interface GeneratorBundle {
  html: (comp: any) => string;
  react: (comp: any) => string;
  mjml: (comp: any) => string;
}
