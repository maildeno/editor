// import/selfCheck.ts
// ─────────────────────────────────────────────────────────────────────────────
// Stage 5: does the result look like something the editor made?
//
// The importer builds every node from scratch, so a slip in one mapper would
// not throw; it would produce a template that loads and then misrenders, or
// exports CSS with "NaNpx" in it. This module walks the finished snapshot and
// lists everything the editor would not produce itself: unknown block types,
// column widths that do not add up, colours in a form the exporters do not
// understand, numbers that are not numbers, `mobile` keys a block has no
// override for, duplicate ids.
//
// It never throws and never repairs. The importer reports what it found as a
// warning; the tests require that the list is empty.
// ─────────────────────────────────────────────────────────────────────────────

import type { TemplateSnapshotJson } from "../export/targets/templateSnapshot";
import { COLUMN_MOBILE_KEYS, MOBILE_KEYS, ROW_MOBILE_KEYS, SPACER_MOBILE_KEYS } from "./map/diff";
import { MAX_NESTED_DEPTH } from "./structure/plan";
import type { BlockType } from "./structure/ir";

const COLOR = /^(#[0-9a-f]{6}|transparent|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+|1\.0+)\s*)?\))$/i;

const COLOR_KEYS = new Set([
  "backgroundColor",
  "color",
  "solid",
  "bodyBackgroundColor",
]);

const SIDE_OBJECTS = new Set(["padding", "margin"]);

/** The number of px or a percentage that must be finite and not negative. */
const NONNEG_KEYS = new Set([
  "fontSize",
  "lineHeight",
  "itemSpacing",
  "iconSize",
  "iconGap",
  "spacing",
  "minHeight",
  "gap",
  "height",
  "width",
]);

const KNOWN: ReadonlySet<string> = new Set<BlockType>([
  "button",
  "anchor",
  "paragraph",
  "heading",
  "list",
  "image",
  "video",
  "divider",
  "spacer",
  "menu",
  "socials",
]);

class Problems {
  readonly list: string[] = [];
  add(where: string, what: string): void {
    if (this.list.length < 200) this.list.push(`${where}: ${what}`);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Every number and colour inside `value`, checked against the key it sits under. */
const checkValue = (key: string, value: unknown, where: string, out: Problems, inMobile: boolean): void => {
  if (value === null || value === undefined) {
    if (!inMobile) out.add(where, `${key} is missing`);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) out.add(where, `${key} is not a finite number`);
    else if (NONNEG_KEYS.has(key) && value < 0) out.add(where, `${key} is negative (${value})`);
    return;
  }
  if (typeof value === "string") {
    if (COLOR_KEYS.has(key) && !COLOR.test(value)) out.add(where, `${key} is not a colour the exporters read: "${value}"`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkValue(`${key}[${i}]`, v, where, out, inMobile));
    return;
  }
  if (isRecord(value)) {
    if (SIDE_OBJECTS.has(key)) {
      for (const side of ["top", "right", "bottom", "left"]) {
        const n = value[side];
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0) out.add(where, `${key}.${side} is not a non-negative number`);
      }
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      // gradient stops and lists of items are plain data; only numbers and colours are checked
      checkValue(k, v, where, out, inMobile);
    }
  }
};

const checkPair = (node: Record<string, unknown>, where: string, out: Problems): void => {
  const hasColor = "backgroundColor" in node;
  const hasGradient = "backgroundGradient" in node;
  if (hasColor !== hasGradient) {
    out.add(where, "backgroundColor and backgroundGradient must come together");
    return;
  }
  const g = node.backgroundGradient;
  if (hasGradient && g !== null && g !== undefined) {
    if (!isRecord(g) || typeof g.useGradient !== "boolean" || typeof g.solid !== "string" || !isRecord(g.gradient)) {
      out.add(where, "backgroundGradient is not {useGradient, solid, gradient}");
    }
  }
};

const checkMobile = (
  mobile: unknown,
  allowed: readonly string[],
  where: string,
  out: Problems,
): void => {
  if (mobile === undefined) return;
  if (!isRecord(mobile)) {
    out.add(where, "mobile is not an object");
    return;
  }
  if (!Object.keys(mobile).length) out.add(where, "mobile is empty and should be left out");
  for (const [k, v] of Object.entries(mobile)) {
    if (!allowed.includes(k)) out.add(where, `mobile.${k} is not an override this node has`);
    checkValue(k, v, `${where} mobile`, out, true);
  }
  checkPair(mobile, `${where} mobile`, out);
};

const checkComponent = (node: Record<string, unknown>, where: string, ids: Set<string>, out: Problems): void => {
  if (typeof node.id !== "string" || !node.id) out.add(where, "component has no id");
  else if (ids.has(node.id)) out.add(where, `id ${node.id} is used twice`);
  else ids.add(node.id);

  const type = node.componentType;
  if (typeof type !== "string" || !KNOWN.has(type)) {
    out.add(where, `unknown component type "${String(type)}"`);
    return;
  }
  const props = node.props;
  if (!isRecord(props)) {
    out.add(where, "component has no props");
    return;
  }
  const w = `${where} ${type}`;
  const { mobile, visibility, desktopHide, mobileHide, ...rest } = props;
  void visibility;
  if (typeof desktopHide !== "boolean" || typeof mobileHide !== "boolean") out.add(w, "desktopHide and mobileHide must be booleans");
  for (const [k, v] of Object.entries(rest)) {
    if (k === "content" || k === "src" || k === "alt" || k === "link" || k === "text") {
      if (typeof v !== "string") out.add(w, `${k} must be a string`);
      continue;
    }
    checkValue(k, v, w, out, false);
  }
  checkPair(rest, w, out);
  if (type === "image") {
    const link = typeof rest.link === "string" ? rest.link : "";
    if ((link !== "") !== (rest.enabled === true)) out.add(w, "image `enabled` must be true exactly when there is a link");
    if (typeof rest.width !== "number" || rest.width < 1 || rest.width > 100) out.add(w, "image width must be a percentage from 1 to 100");
  }
  if (type === "button" && (typeof rest.text !== "string" || rest.text === "")) out.add(w, "button has no text");
  checkMobile(mobile, MOBILE_KEYS[type as BlockType], w, out);
};

const checkColumns = (
  columns: unknown,
  depth: number,
  where: string,
  ids: Set<string>,
  out: Problems,
): void => {
  if (!Array.isArray(columns) || columns.length === 0) {
    out.add(where, "row has no columns");
    return;
  }
  const widths = columns.map((c) => (isRecord(c) ? c.width : undefined));
  if (widths.some((w) => typeof w !== "number" || !Number.isInteger(w) || w < 5 || w > 100)) {
    out.add(where, `column widths must be whole numbers from 5 to 100, got [${widths.join(", ")}]`);
  } else if ((widths as number[]).reduce((a, b) => a + b, 0) !== 100) {
    out.add(where, `column widths add up to ${(widths as number[]).reduce((a, b) => a + b, 0)}, not 100`);
  }
  columns.forEach((col, i) => {
    const cw = `${where} column ${i + 1}`;
    if (!isRecord(col)) {
      out.add(cw, "column is not an object");
      return;
    }
    if (typeof col.id !== "string" || !col.id) out.add(cw, "column has no id");
    else if (ids.has(col.id)) out.add(cw, `id ${col.id} is used twice`);
    else ids.add(col.id);
    const { children, mobile, ...rest } = col;
    for (const [k, v] of Object.entries(rest)) {
      if (k === "id" || k === "width") continue;
      if (k === "verticalAlign") {
        if (v !== "top" && v !== "middle" && v !== "bottom") out.add(cw, `verticalAlign "${String(v)}" is not top, middle or bottom`);
        continue;
      }
      if (k.startsWith("background") && typeof v === "string" && k !== "backgroundColor") continue;
      checkValue(k, v, cw, out, false);
    }
    checkPair(rest, cw, out);
    checkMobile(mobile, COLUMN_MOBILE_KEYS, cw, out);
    if (!Array.isArray(children)) {
      out.add(cw, "column has no children array");
      return;
    }
    for (const child of children) {
      if (!isRecord(child)) {
        out.add(cw, "child is not an object");
      } else if (child.type === "component") checkComponent(child, cw, ids, out);
      else if (child.type === "row") checkRow(child, depth + 1, ids, out);
      else if (child.type === "row-spacer") checkSpacer(child, cw, ids, out);
      else out.add(cw, `unknown child type "${String(child.type)}"`);
    }
  });
};

const checkSpacer = (node: Record<string, unknown>, where: string, ids: Set<string>, out: Problems): void => {
  const w = `${where} spacer`;
  if (typeof node.id !== "string" || !node.id) out.add(w, "spacer has no id");
  else if (ids.has(node.id)) out.add(w, `id ${node.id} is used twice`);
  else ids.add(node.id);
  if (typeof node.height !== "number" || !Number.isFinite(node.height) || node.height < 1) out.add(w, "spacer height must be at least 1");
  if (typeof node.backgroundColor === "string" && !COLOR.test(node.backgroundColor)) out.add(w, `backgroundColor "${node.backgroundColor}"`);
  checkPair(node, w, out);
  checkMobile(node.mobile, SPACER_MOBILE_KEYS, w, out);
};

const checkRow = (row: Record<string, unknown>, depth: number, ids: Set<string>, out: Problems): void => {
  const where = `row ${String(row.name ?? row.id)}`;
  if (depth > MAX_NESTED_DEPTH) out.add(where, `nested ${depth} deep; the exporters stop at ${MAX_NESTED_DEPTH + 1}`);
  if (typeof row.id !== "string" || !row.id) out.add(where, "row has no id");
  else if (ids.has(row.id)) out.add(where, `id ${row.id} is used twice`);
  else ids.add(row.id);
  if (typeof row.name !== "string" || !row.name) out.add(where, "row has no name");
  const { columns, mobile, visibility, name, id, type, ...rest } = row;
  void visibility;
  void name;
  void id;
  void type;
  if (typeof rest.mobileStack !== "boolean") out.add(where, "mobileStack must be a boolean");
  for (const [k, v] of Object.entries(rest)) {
    if (k === "mobileStack" || (k.startsWith("background") && typeof v === "string" && k !== "backgroundColor")) continue;
    checkValue(k, v, where, out, false);
  }
  checkPair(rest, where, out);
  checkMobile(mobile, ROW_MOBILE_KEYS, where, out);
  checkColumns(columns, depth, where, ids, out);
};

/** Everything wrong with `snapshot`, as short sentences. Empty means it looks like the editor's own output. */
export const selfCheck = (snapshot: TemplateSnapshotJson): string[] => {
  const out = new Problems();
  const ids = new Set<string>();
  const canvas = snapshot.canvas as Record<string, unknown> | undefined;

  if (!isRecord(canvas)) {
    out.add("canvas", "is missing");
  } else {
    const w = canvas.width;
    if (typeof w !== "number" || !Number.isInteger(w) || w < 360 || w > 720) out.add("canvas", `width ${String(w)} is outside 360 to 720`);
    const bp = canvas.mobileBreakpoint;
    if (typeof bp !== "number" || !Number.isInteger(bp) || bp < 360 || bp > 600) {
      out.add("canvas", `mobileBreakpoint ${String(bp)} is outside 360 to 600`);
    }
    for (const key of ["backgroundColor", "bodyBackgroundColor"]) {
      const c = canvas[key];
      if (typeof c !== "string" || !COLOR.test(c)) out.add("canvas", `${key} "${String(c)}" is not a colour the exporters read`);
    }
    const p = canvas.padding;
    if (!isRecord(p) || ["top", "right", "bottom", "left"].some((s) => typeof p[s] !== "number" || !Number.isFinite(p[s]) || (p[s] as number) < 0)) {
      out.add("canvas", "padding must have four non-negative numbers");
    }
    for (const key of ["language", "preheaderText", "bodyBackgroundImage", "bodyBackgroundSize", "bodyBackgroundPosition", "bodyBackgroundRepeat"]) {
      if (typeof canvas[key] !== "string") out.add("canvas", `${key} must be a string`);
    }
  }

  if (!Array.isArray(snapshot.rows) || snapshot.rows.length === 0) {
    out.add("rows", "there are no rows");
    return out.list;
  }
  snapshot.rows.forEach((row: unknown, i: number) => {
    if (!isRecord(row)) {
      out.add(`row ${i + 1}`, "is not an object");
    } else if (row.type === "row") checkRow(row, 0, ids, out);
    else if (row.type === "row-spacer") checkSpacer(row, `row ${i + 1}`, ids, out);
    else out.add(`row ${i + 1}`, `unknown type "${String(row.type)}"`);
  });
  return out.list;
};
