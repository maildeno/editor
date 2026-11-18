// import/css/background.ts
// ─────────────────────────────────────────────────────────────────────────────
// Background image values as Maildeno holds them
//
// Maildeno offers size cover | contain | auto, nine positions (written
// "<vertical> <horizontal>") and four repeats. Both the page (the canvas) and
// every row and column read their image through these, so they live here.
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_WORDS = new Set(["left", "right", "top", "bottom", "center"]);

/** `background-position` as one of the nine values the editor offers. */
export const normalizePosition = (raw: string | undefined, unset = "center center"): string => {
  if (!raw) return unset;
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return unset;
  const word = (t: string, axis: "h" | "v"): string => {
    if (POSITION_WORDS.has(t)) return t;
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n)) return "center";
    if (n <= 25) return axis === "h" ? "left" : "top";
    if (n >= 75) return axis === "h" ? "right" : "bottom";
    return "center";
  };
  let h = "center";
  let v = "center";
  if (tokens.length === 1) {
    const t = word(tokens[0], "h");
    if (t === "top" || t === "bottom") v = t;
    else h = t;
  } else {
    const a = word(tokens[0], "h");
    const b = word(tokens[1], "v");
    if (a === "top" || a === "bottom" || b === "left" || b === "right") {
      v = a;
      h = b;
    } else {
      h = a;
      v = b;
    }
  }
  return `${v} ${h}`;
};

/**
 * `unset` is what the value is when the source says nothing: for an image that is the
 * CSS initial value (the browser tiles it at its own size, from the top left), not
 * Maildeno's choice for a new image.
 */
export const normalizeSize = (raw: string | undefined, unset = "cover"): string => {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return unset;
  return t === "contain" || t === "auto" || t === "cover" ? t : "cover";
};

export const normalizeRepeat = (raw: string | undefined, unset = "no-repeat"): string => {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "repeat" || t === "repeat-x" || t === "repeat-y" || t === "no-repeat") return t;
  if (t === "repeat no-repeat") return "repeat-x";
  if (t === "no-repeat repeat") return "repeat-y";
  return t ? "no-repeat" : unset;
};

/** The first url() in a background-image layer or value, or "". */
export const urlOf = (image: string | undefined): string => {
  if (!image) return "";
  const m = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/i.exec(image);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
};
