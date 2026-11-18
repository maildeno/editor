// import/map/urls.ts
// ─────────────────────────────────────────────────────────────────────────────
// Links, image sources and text props
//
// Maildeno's exporters write some props into the HTML as they are: an image's
// `src` and `alt`, for example, are not escaped. A value with a quote in it
// would break the markup, so props that go in unescaped are cleaned here. Links
// are checked against what the exporter's safeUrl does: it leaves http(s),
// mailto, tel and merge-tag URLs alone and puts https:// in front of everything
// else, so a relative or hash link would come out broken. Those are kept (the
// person may fix them) and reported.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReportBuilder } from "../report";
import { normText } from "../structure/dom";

const MERGE = /\{\{\s*([^{}|]+?)\s*(\|[^{}]*)?\}\}/g;

/** `{{tag}}` written as `{{ tag }}`, which is the form every exporter converts. */
export const canonicalMerge = (s: string): string =>
  s.replace(MERGE, (_m, name: string, rest?: string) => `{{ ${name.trim()}${rest ? rest.trim() : ""} }}`);

/** Text for a prop that holds plain text: one line, no markup characters, merge tags in canonical form. */
export const plainProp = (s: string | null | undefined): string => canonicalMerge(normText(s ?? "").replace(/[<>]/g, ""));

/** Alt text goes into an attribute unescaped, so it cannot hold a double quote. */
export const altText = (s: string | null | undefined): string => plainProp(s).replace(/"/g, "'");

const BAD_SCHEME = /^[\s\u0000-\u001f]*(javascript|vbscript|data):/i;
const KNOWN_SCHEME = /^(https?:|mailto:|tel:)/i;

const encode = (url: string): string =>
  url
    .replace(/\s/g, "%20")
    .replace(/"/g, "%22")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E");

/** A link target. Empty when it cannot be kept safely. */
export const linkUrl = (raw: string | null | undefined, report: ReportBuilder): string => {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (BAD_SCHEME.test(t)) {
    report.safety("link-unsafe", "Links that run script or embed data (javascript:, data:, vbscript:) were removed.");
    return "";
  }
  if (/\{\{.*\}\}/.test(t)) return canonicalMerge(t);
  if (t.startsWith("//")) return encode(`https:${t}`);
  if (KNOWN_SCHEME.test(t)) return encode(t);
  if (t.startsWith("#")) {
    report.warn("url-hash", "Links that point inside the page (#…) were kept. The export turns them into broken https:// links; replace them.");
    return encode(t);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    report.warn("url-scheme", "Links with a scheme other than http, mailto or tel were kept, but the export may not leave them alone.");
    return encode(t);
  }
  report.warn("url-relative", "Relative links were kept. The export puts https:// in front of them; replace them with full URLs.");
  return encode(t);
};

/** An image or video source. Relative, data and cid sources are kept and reported. */
export const mediaUrl = (raw: string | null | undefined, report: ReportBuilder): string => {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (/^javascript:|^vbscript:/i.test(t)) {
    report.safety("link-unsafe", "Links that run script or embed data (javascript:, data:, vbscript:) were removed.");
    return "";
  }
  if (/^data:/i.test(t)) {
    report.warn("image-data", "Images embedded in the HTML (data: URLs) were kept. Gmail does not show them; upload the images and replace them.");
    return encode(t);
  }
  if (/^cid:/i.test(t)) {
    report.warn("image-cid", "Images that refer to attachments (cid:) were kept but will not load; upload the images and replace them.");
    return encode(t);
  }
  if (t.startsWith("//")) return encode(`https:${t}`);
  if (/^https?:/i.test(t) || /\{\{.*\}\}/.test(t)) return encode(t);
  report.warn("image-relative", "Images with relative paths were kept but will not load; upload the images and replace them.");
  return encode(t);
};
