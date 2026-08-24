// export/actions/download.ts
// Handles the "Execute" phase of the export pipeline.
// Generators produce strings; this module turns those strings into
// downloadable files. Swapping to "upload to API" later only requires
// changing this file, not the generators.

export type DownloadMimeType =
  | "text/html"
  | "text/plain" // used for .mjml and .tsx
  | "application/json";

interface DownloadOptions {
  content: string;
  filename: string;
  mimeType: DownloadMimeType;
}

/**
 * Triggers a browser file download with the given content.
 * Uses a short-lived object URL which is immediately revoked after the
 * anchor click to avoid memory leaks.
 */
export const downloadFile = ({
  content,
  filename,
  mimeType,
}: DownloadOptions): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Derives a safe kebab-case filename stem from a template name.
 * e.g. "My Template Name" → "my-template-name"
 */
export const toFileStem = (templateName: string): string =>
  templateName.toLowerCase().replace(/\s+/g, "-");

/**
 * Appends the export mode suffix to a filename stem.
 * "wrap" mode files are "master" templates for the ESP;
 * "prune" mode files are "snapshot" outputs for a specific audience.
 */
export const withModeSuffix = (stem: string, mode: "prune" | "wrap"): string =>
  `${stem}${mode === "wrap" ? "-master" : "-snapshot"}`;
