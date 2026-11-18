// import/report.ts
// ─────────────────────────────────────────────────────────────────────────────
// Collects what the importer did and did not do
//
// Every stage records into one ReportBuilder. Entries with the same code and
// message are merged into one with a count, so "3 hover rules ignored" is one
// line instead of three, and the report stays short enough to read.
// ─────────────────────────────────────────────────────────────────────────────

import type { ImportFlavour, ImportLane, ImportReport, ReportEntry } from "./types";

type Bucket = "fallbacks" | "dropped" | "warnings" | "safety";

export class ReportBuilder {
  private readonly buckets: Record<Bucket, Map<string, ReportEntry>> = {
    fallbacks: new Map(),
    dropped: new Map(),
    warnings: new Map(),
    safety: new Map(),
  };

  lane: ImportLane = "generic";
  flavour: ImportFlavour = "generic";

  private add(bucket: Bucket, code: string, message: string, count = 1): void {
    const key = `${code}\u0000${message}`;
    const map = this.buckets[bucket];
    const hit = map.get(key);
    if (hit) hit.count = (hit.count ?? 1) + count;
    else map.set(key, count > 1 ? { code, message, count } : { code, message });
  }

  fallback(code: string, message: string, count = 1): void {
    this.add("fallbacks", code, message, count);
  }
  drop(code: string, message: string, count = 1): void {
    this.add("dropped", code, message, count);
  }
  warn(code: string, message: string, count = 1): void {
    this.add("warnings", code, message, count);
  }
  safety(code: string, message: string, count = 1): void {
    this.add("safety", code, message, count);
  }

  has(code: string): boolean {
    return (Object.values(this.buckets) as Map<string, ReportEntry>[]).some((m) =>
      Array.from(m.values()).some((e) => e.code === code),
    );
  }

  entries(bucket: Bucket): ReportEntry[] {
    return Array.from(this.buckets[bucket].values());
  }

  /** The four entry lists, for assembling the final ImportReport. */
  lists(): Pick<ImportReport, "fallbacks" | "dropped" | "warnings" | "safety"> {
    return {
      fallbacks: this.entries("fallbacks"),
      dropped: this.entries("dropped"),
      warnings: this.entries("warnings"),
      safety: this.entries("safety"),
    };
  }
}

/** The report as plain text, for a log or a toast. One line per finding. */
export const formatReport = (report: ImportReport): string => {
  const lines: string[] = [];
  const s = report.summary;
  const comps = Object.entries(s.components)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  lines.push(
    `Imported ${s.rows} row${s.rows === 1 ? "" : "s"}, ${s.columns} column${s.columns === 1 ? "" : "s"}` +
      (s.nestedRows ? `, ${s.nestedRows} nested` : "") +
      (comps ? ` (${comps})` : "") +
      ".",
  );
  lines.push(
    `Canvas ${report.layout.canvasWidth}px, mobile breakpoint ${report.layout.breakpoint}px` +
      ` (${report.layout.breakpointSource}).`,
  );
  if (report.mobile.nodesWithOverrides || report.mobile.stackedRows) {
    lines.push(
      `Mobile: ${report.mobile.nodesWithOverrides} node(s) with overrides, ${report.mobile.stackedRows} stacked row(s)` +
        (report.mobile.mobileHidden ? `, ${report.mobile.mobileHidden} hidden on mobile` : "") +
        (report.mobile.desktopHidden ? `, ${report.mobile.desktopHidden} hidden on desktop` : "") +
        ".",
    );
  }
  const section = (title: string, entries: ReportEntry[]): void => {
    for (const e of entries) {
      lines.push(`${title}: ${e.message}${e.count && e.count > 1 ? ` (×${e.count})` : ""}`);
    }
  };
  section("Fallback", report.fallbacks);
  section("Dropped", report.dropped);
  section("Warning", report.warnings);
  section("Safety", report.safety);
  return lines.join("\n");
};
