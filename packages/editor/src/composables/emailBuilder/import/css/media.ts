// import/css/media.ts
// ─────────────────────────────────────────────────────────────────────────────
// @media evaluation for the HTML importer
//
// The importer reads a document twice, once at a desktop width and once at a
// phone width, and a rule inside @media takes part in a view only when its
// query holds at that width. This module answers that for the queries email
// uses and says "ignored" for the rest, so the rule is skipped and counted
// instead of guessed at.
//
//   yes       the query holds in this view
//   no        it does not
//   ignored   it cannot be evaluated (a device-pixel-ratio hack, dark mode, a
//             feature this reader does not model); the rules inside are skipped
//
// It also reads the width thresholds out of a query, which is how the importer
// finds the template's mobile breakpoint.
// ─────────────────────────────────────────────────────────────────────────────

export interface Viewport {
  width: number;
  height: number;
}

export type MediaResult = "yes" | "no" | "ignored";

const MEDIA_TYPES_TRUE = new Set(["all", "screen"]);
const MEDIA_TYPES_FALSE = new Set(["print", "speech", "tty", "tv", "projection", "handheld", "braille", "embossed", "aural"]);

const cssPx = (text: string): number | null => {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))(px|em|rem|pt)?\s*$/i.exec(text);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch ((m[2] ?? "px").toLowerCase()) {
    case "px":
      return n;
    case "em":
    case "rem":
      return n * 16;
    case "pt":
      return (n * 4) / 3;
    default:
      return null;
  }
};

type Op = "<" | "<=" | ">" | ">=" | "=";

const compare = (left: number, op: Op, right: number): boolean => {
  switch (op) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    default:
      return left === right;
  }
};

const SIZE_FEATURES: Record<string, "width" | "height"> = {
  width: "width",
  "device-width": "width",
  height: "height",
  "device-height": "height",
};

/** One `( … )` condition against the viewport. */
const evalCondition = (inner: string, vp: Viewport): MediaResult => {
  const text = inner.trim();

  // Range syntax: (width >= 600px), (600px <= width), (400px <= width <= 800px)
  const range = /^(?:(.+?)\s*(<=|>=|<|>|=)\s*)?([a-z-]+)\s*(?:(<=|>=|<|>|=)\s*(.+))?$/i.exec(text);
  if (range && !text.includes(":") && (range[2] || range[4])) {
    const [, leftVal, leftOp, feature, rightOp, rightVal] = range;
    const dim = SIZE_FEATURES[feature.toLowerCase()];
    if (!dim) return "ignored";
    const actual = dim === "width" ? vp.width : vp.height;
    let ok = true;
    if (leftVal && leftOp) {
      const v = cssPx(leftVal);
      if (v === null) return "ignored";
      ok = ok && compare(v, leftOp as Op, actual);
    }
    if (rightVal && rightOp) {
      const v = cssPx(rightVal);
      if (v === null) return "ignored";
      ok = ok && compare(actual, rightOp as Op, v);
    }
    return ok ? "yes" : "no";
  }

  const colon = text.indexOf(":");
  const feature = (colon === -1 ? text : text.slice(0, colon)).trim().toLowerCase();
  const value = colon === -1 ? "" : text.slice(colon + 1).trim();

  const prefixed = /^(min|max)-(.+)$/.exec(feature);
  const base = prefixed ? prefixed[2] : feature;

  const dim = SIZE_FEATURES[base];
  if (dim) {
    const actual = dim === "width" ? vp.width : vp.height;
    if (!value) return actual > 0 ? "yes" : "no";
    const v = cssPx(value);
    if (v === null) return "ignored";
    if (prefixed?.[1] === "min") return actual >= v ? "yes" : "no";
    if (prefixed?.[1] === "max") return actual <= v ? "yes" : "no";
    return actual === v ? "yes" : "no";
  }

  switch (feature) {
    case "orientation":
      if (value === "portrait") return vp.width <= vp.height ? "yes" : "no";
      if (value === "landscape") return vp.width > vp.height ? "yes" : "no";
      return "ignored";
    case "prefers-color-scheme":
      return value === "light" ? "yes" : "ignored";
    case "color":
      return "yes";
    default:
      // device-pixel-ratio and resolution (retina targeting), hover, pointer,
      // prefers-reduced-motion, -ms-high-contrast, …
      return "ignored";
  }
};

const andResults = (results: MediaResult[]): MediaResult => {
  if (results.includes("ignored")) return "ignored";
  return results.every((r) => r === "yes") ? "yes" : "no";
};

/** The `( … )` groups of a query, outermost only. */
const groups = (query: string): { conditions: string[]; rest: string } => {
  const conditions: string[] = [];
  let rest = "";
  let depth = 0;
  let cur = "";
  for (const ch of query) {
    if (ch === "(") {
      if (depth === 0) cur = "";
      else cur += ch;
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) conditions.push(cur);
      else cur += ch;
    } else if (depth > 0) {
      cur += ch;
    } else {
      rest += ch;
    }
  }
  return { conditions, rest };
};

const evalQuery = (query: string, vp: Viewport): MediaResult => {
  let q = query.trim().toLowerCase();
  if (!q) return "yes";
  let negate = false;
  if (q.startsWith("not ")) {
    negate = true;
    q = q.slice(4).trim();
  }
  if (q.startsWith("only ")) q = q.slice(5).trim();

  const { conditions, rest } = groups(q);
  const words = rest.split(/\s+/).filter((w) => w && w !== "and");
  const results: MediaResult[] = [];
  for (const w of words) {
    if (MEDIA_TYPES_TRUE.has(w)) results.push("yes");
    else if (MEDIA_TYPES_FALSE.has(w)) results.push("no");
    else results.push("ignored");
  }
  for (const c of conditions) results.push(evalCondition(c, vp));

  const combined = andResults(results);
  if (negate) {
    if (combined === "ignored") return "ignored";
    return combined === "yes" ? "no" : "yes";
  }
  return combined;
};

/** A media prelude: comma-separated queries, any of which may hold. */
export const evalMedia = (prelude: string, vp: Viewport): MediaResult => {
  const queries = prelude.split(",");
  let sawIgnored = false;
  for (const query of queries) {
    const r = evalQuery(query, vp);
    if (r === "yes") return "yes";
    if (r === "ignored") sawIgnored = true;
  }
  return sawIgnored ? "ignored" : "no";
};

/** A stack of nested preludes: all of them must hold. */
export const evalMediaStack = (stack: readonly string[], vp: Viewport): MediaResult => {
  let ignored = false;
  for (const prelude of stack) {
    const r = evalMedia(prelude, vp);
    if (r === "no") return "no";
    if (r === "ignored") ignored = true;
  }
  return ignored ? "ignored" : "yes";
};

// ─── Breakpoint candidates ────────────────────────────────────────────────────

/**
 * The widths at which a query switches on or off, as the largest viewport width
 * that is still "mobile": max-width: 600px gives 600; min-width: 601px gives
 * 600; a range such as (width <= 600px) gives 600. Queries that do not look at
 * the width give nothing.
 */
export const mediaWidthThresholds = (prelude: string): number[] => {
  const out: number[] = [];
  for (const query of prelude.split(",")) {
    const { conditions } = groups(query.toLowerCase());
    for (const c of conditions) {
      const t = c.trim();
      const prefixed = /^(min|max)-(?:device-)?width\s*:\s*(.+)$/.exec(t);
      if (prefixed) {
        const v = cssPx(prefixed[2]);
        if (v === null) continue;
        out.push(prefixed[1] === "max" ? v : v - 1);
        continue;
      }
      const range = /^(?:(.+?)\s*(<=|>=|<|>)\s*)?(?:device-)?width\s*(?:(<=|>=|<|>)\s*(.+))?$/.exec(t);
      if (range && !t.includes(":")) {
        const [, leftVal, leftOp, rightOp, rightVal] = range;
        if (rightOp && rightVal) {
          const v = cssPx(rightVal);
          if (v !== null) {
            if (rightOp === "<=") out.push(v);
            else if (rightOp === "<") out.push(v - 1);
            else if (rightOp === ">=") out.push(v - 1);
            else if (rightOp === ">") out.push(v);
          }
        }
        if (leftVal && leftOp) {
          const v = cssPx(leftVal);
          if (v !== null) {
            // 600px <= width  reads as width >= 600
            if (leftOp === "<=") out.push(v - 1);
            else if (leftOp === "<") out.push(v);
            else if (leftOp === ">=") out.push(v);
            else if (leftOp === ">") out.push(v - 1);
          }
        }
      }
    }
  }
  return out;
};
