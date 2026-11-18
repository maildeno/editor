// import/intake.ts
// ─────────────────────────────────────────────────────────────────────────────
// Stage 0: take the text in, make it safe, say what it is
//
// The HTML is parsed into an inert document (DOMParser runs no scripts and
// fetches nothing), then everything that could run or phone home is removed
// before any other stage looks at it. After this the importer only ever reads
// the DOM, and nothing it writes is derived from markup that was allowed to
// execute.
//
// Removed: <script>, frames, <object>/<embed>, <svg>, <canvas>, media players,
// form controls, <link rel=stylesheet> (it cannot be fetched), <meta refresh>,
// every on* attribute, and javascript:, vbscript: and data: URLs on links.
// Kept: <style>, which the cascade needs, and data: URLs on images.
//
// It also decides which reader to use: the Maildeno export carries hook classes
// the fast lane understands, and MJML output has its own column classes.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReportBuilder } from "./report";
import {
  HtmlImportError,
  type HtmlImportOptions,
  type ImportFlavour,
} from "./types";

export interface Intake {
  doc: Document;
  flavour: ImportFlavour;
  title: string;
  /** A valid BCP-47-ish tag from <html lang>, or null. */
  lang: string | null;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const REMOVE_ALWAYS = [
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "svg",
  "canvas",
  "audio",
  "input",
  "button",
  "select",
  "textarea",
  "base",
];

const URL_ATTRS = ["href", "src", "background", "poster", "action", "formaction", "xlink:href"];

const stripControl = (value: string): string => value.replace(/[\u0000- \u007f-\u009f]+/g, "");

const defaultParse = (html: string): Document => {
  if (typeof DOMParser === "undefined") {
    throw new HtmlImportError(
      "No DOM parser is available here. Pass `parseHtml` (for example one built on jsdom).",
      "no-dom",
    );
  }
  return new DOMParser().parseFromString(html, "text/html");
};

/** Parses and sanitises. Throws HtmlImportError when there is nothing to import. */
export const intake = (
  html: unknown,
  options: HtmlImportOptions,
  report: ReportBuilder,
): Intake => {
  if (typeof html !== "string" || !html.trim()) {
    throw new HtmlImportError("There is no HTML to import.", "empty");
  }
  const max = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (html.length > max) {
    throw new HtmlImportError(
      `The HTML is larger than ${Math.round(max / 1024 / 1024)} MB. Email HTML this large will not send; trim it and try again.`,
      "too-large",
    );
  }
  if (/^\s*(<\?xml[^>]*>\s*)?<mjml[\s>]/i.test(html)) {
    throw new HtmlImportError(
      "This is MJML source, not HTML. Compile it to HTML first (for example with the MJML CLI), then import the result.",
      "mjml-source",
    );
  }

  const doc = (options.parseHtml ?? defaultParse)(html);
  if (!doc.body) {
    throw new HtmlImportError("The HTML has no body to import.", "no-content");
  }

  sanitize(doc, report);

  const flavour = detectFlavour(doc);
  report.flavour = flavour;

  const langAttr = doc.documentElement.getAttribute("lang")?.trim().replace(/_/g, "-") ?? "";
  return {
    doc,
    flavour,
    title: (doc.title ?? "").replace(/\s+/g, " ").trim(),
    // "und" (undetermined) is what MJML writes when no language is set; it says nothing
    lang: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(langAttr) && !/^(und|zxx|mul|mis)\b/i.test(langAttr) ? langAttr : null,
  };
};

// ─── Sanitising ───────────────────────────────────────────────────────────────

const sanitize = (doc: Document, report: ReportBuilder): void => {
  const removed = new Map<string, number>();
  const bump = (tag: string): void => {
    removed.set(tag, (removed.get(tag) ?? 0) + 1);
  };

  for (const tag of REMOVE_ALWAYS) {
    for (const el of Array.from(doc.querySelectorAll(tag))) {
      bump(tag);
      el.remove();
    }
  }
  // <form> keeps its content; only the wrapper goes.
  for (const form of Array.from(doc.querySelectorAll("form"))) {
    bump("form");
    form.replaceWith(...Array.from(form.childNodes));
  }
  for (const link of Array.from(doc.querySelectorAll("link"))) {
    const rel = (link.getAttribute("rel") ?? "").toLowerCase();
    if (rel.includes("stylesheet")) {
      report.warn(
        "external-stylesheet",
        "An external stylesheet is linked and could not be loaded; its rules are not applied.",
      );
    }
    link.remove();
  }
  for (const meta of Array.from(doc.querySelectorAll("meta"))) {
    if ((meta.getAttribute("http-equiv") ?? "").toLowerCase() === "refresh") {
      bump("meta refresh");
      meta.remove();
    }
  }

  let handlers = 0;
  let scriptUrls = 0;
  let dataLinks = 0;
  let cssScript = 0;
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        handlers++;
        continue;
      }
      if (name === "srcdoc") {
        el.removeAttribute(attr.name);
        continue;
      }
      if (URL_ATTRS.includes(name)) {
        const v = stripControl(attr.value).toLowerCase();
        // An <a> keeps an empty href: it is still a link element, so a styled button stays a
        // button, just without a target. Anything else loses the attribute.
        const unlink = (): void => {
          if (name === "href" && el.localName === "a") el.setAttribute(attr.name, "");
          else el.removeAttribute(attr.name);
        };
        if (v.startsWith("javascript:") || v.startsWith("vbscript:")) {
          unlink();
          scriptUrls++;
        } else if (v.startsWith("data:") && name !== "src" && name !== "background") {
          unlink();
          dataLinks++;
        }
      }
      if (name === "style" && /expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding/i.test(attr.value)) {
        cssScript++;
      }
    }
  }
  for (const style of Array.from(doc.querySelectorAll("style"))) {
    if (/expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding/i.test(style.textContent ?? "")) cssScript++;
  }

  const total = (tags: string[]): number => tags.reduce((n, t) => n + (removed.get(t) ?? 0), 0);
  const scripts = total(["script"]);
  if (scripts) report.safety("script", "Removed <script> elements.", scripts);
  const embeds = total(["iframe", "frame", "frameset", "object", "embed", "applet"]);
  if (embeds) report.safety("embed", "Removed frames and embedded objects.", embeds);
  if (handlers) report.safety("event-handler", "Removed inline event handler attributes (onclick and similar).", handlers);
  if (scriptUrls) report.safety("script-url", "Removed javascript: and vbscript: URLs.", scriptUrls);
  if (dataLinks) report.safety("data-link", "Removed data: URLs from links.", dataLinks);
  if (cssScript) report.safety("css-script", "Dropped CSS that can run code (expression(), behavior, binding).", cssScript);
  const refresh = removed.get("meta refresh");
  if (refresh) report.safety("meta-refresh", "Removed a meta refresh redirect.", refresh);
  const svg = removed.get("svg");
  if (svg) report.drop("svg", "Inline SVG is not supported in email and was left out.", svg);
  const controls = total(["input", "button", "select", "textarea", "canvas", "audio"]);
  if (controls) report.drop("interactive", "Form controls, canvas and audio were left out.", controls);
  const forms = removed.get("form");
  if (forms) report.fallback("form", "A <form> wrapper was removed; its content was kept.", forms);
};

// ─── Flavour ──────────────────────────────────────────────────────────────────

const EB_CLASS = /(^|\s)eb-[0-9a-f]{16}(-[a-z-]+)?(\s|$)/;

const detectFlavour = (doc: Document): ImportFlavour => {
  const hasContainer = !!doc.querySelector("table.email-container, .email-container");
  const styleText = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
  const hasHooks =
    Array.from(doc.querySelectorAll("[class]")).some((el) => EB_CLASS.test(el.getAttribute("class") ?? ""));
  const hasHeadClasses = /\.mobile-stack\b/.test(styleText) && /\.desktop-hide\b/.test(styleText);
  if (hasContainer && (hasHooks || hasHeadClasses)) return "maildeno";
  if (/\.mj-column-(per|px)-\d+|mj-outlook-group-fix/.test(styleText) || doc.querySelector("[class*='mj-column-']")) {
    return "mjml";
  }
  return "generic";
};
