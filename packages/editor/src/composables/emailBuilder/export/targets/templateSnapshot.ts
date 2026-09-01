// export/targets/templateSnapshot.ts
// ─────────────────────────────────────────────────────────────────────────────
// Owns: the canonical template-snapshot shape, and normalization of every
// older shape onto it.
//
// Extracted from jsonExport.ts so there is exactly one definition of "what
// counts as a template" shared by the two ways one can enter the editor:
//   • Export → JSON → re-import of a downloaded file (jsonExport.importFn)
//   • setJson() called programmatically by a host (useEmailBuilder)
// Those two used to be able to drift — the importer accepted three legacy
// shapes that a programmatic setter would not have. Since a host may well
// feed setJson() a payload that came out of an older export, they need to
// agree, so the logic lives here rather than inside either caller.
// ─────────────────────────────────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = "1.0";

/**
 * The canonical snapshot shape — exactly what `getJson()` returns, which is
 * what makes `setJson(getJson())` a lossless round-trip.
 */
export interface TemplateSnapshotJson {
  template_id: string;
  template_name: string;
  canvas: any;
  rows: any[];
  schema_version: string;
}

export const toTemplateId = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "untitled_template";

/**
 * Normalizes any recognized template shape onto the current one.
 *
 * Throws with a specific message rather than returning null: callers surface
 * `error.message` directly to the user, and "Unrecognized template file
 * format" is more use than a silent failure. The major-version guard is the
 * one case worth failing loudly on — a newer schema may contain block types
 * this build cannot render, and silently dropping them would corrupt the
 * user's design on the next save.
 */
export function normalizeTemplateSnapshot(data: any): TemplateSnapshotJson {
  if (!data || typeof data !== "object") {
    throw new Error("Unrecognized template file format");
  }

  // Current format.
  if (
    data.template_id &&
    data.template_name &&
    data.canvas &&
    data.rows &&
    data.schema_version
  ) {
    if (data.schema_version !== CURRENT_SCHEMA_VERSION) {
      const [major] = String(data.schema_version).split(".").map(Number);
      const [currentMajor] = CURRENT_SCHEMA_VERSION.split(".").map(Number);

      if (major > currentMajor) {
        throw new Error(
          `Template schema version ${data.schema_version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
        );
      }

      data.schema_version = CURRENT_SCHEMA_VERSION;
    }

    return data as TemplateSnapshotJson;
  }

  // Legacy format (2.x): { meta: { name, ... }, canvas, content: { rows } }.
  // Also the shape a version snapshot arrives in from a host's version API,
  // which is why setJson() accepts it as well as the current format.
  if (data.meta && data.canvas && data.content?.rows) {
    const name = data.meta.name || "Untitled Template";

    return {
      template_id: toTemplateId(name),
      template_name: name,
      canvas: data.canvas,
      rows: data.content.rows,
      schema_version: CURRENT_SCHEMA_VERSION,
    };
  }

  // Same nesting as above but without `meta` — what `loadVersionSnapshot`
  // has always taken. Accepted here so a host that already had a version
  // payload working does not have to reshape it to call setJson().
  if (data.canvas && data.content?.rows) {
    return {
      template_id: toTemplateId("Untitled Template"),
      template_name: "Untitled Template",
      canvas: data.canvas,
      rows: data.content.rows,
      schema_version: CURRENT_SCHEMA_VERSION,
    };
  }

  // Oldest legacy format: raw canvasStyles + rows at the top level.
  if (!data.meta && data.canvasStyles && data.rows) {
    const name = "Untitled Template";

    return {
      template_id: toTemplateId(name),
      template_name: name,
      canvas: data.canvasStyles,
      rows: data.rows,
      schema_version: CURRENT_SCHEMA_VERSION,
    };
  }

  throw new Error("Unrecognized template file format");
}
