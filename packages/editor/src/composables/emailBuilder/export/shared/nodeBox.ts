// export/shared/nodeBox.ts
// ─────────────────────────────────────────────────────────────────────────────
// Row shell and hook classes shared by every exporter
//
// HTML, MJML and React Email all render a row as a background element (a <td>
// or <Section>) around one or two wrapper divs that carry the padding and the
// border. This module is the single place that knows that shape, so the three
// exporters cannot drift apart, and so the hook classes that mobile overrides
// attach to are decided once, from the node itself.
//
// Format-neutral: it returns declarations and class lists. Each exporter
// serializes them with the helpers at the bottom (CSS strings for HTML and
// MJML, style entries for React).
//
// Hook classes (`eb-<id>`, `eb-<id>-box`, `eb-<id>-outer`, `eb-<id>-gap`) are
// emitted only on nodes that carry mobile overrides, so a template without
// overrides keeps exactly the markup it had before.
// ─────────────────────────────────────────────────────────────────────────────

import type { BorderRadius } from "../../types/emailBuilder";
import { borderRadiusValue, hasBorderRadius } from "../../core/borderRadius";
import {
  boxShadowValue,
  clipsOverflow,
  hasActiveShadow,
} from "../../core/boxShadow";

/** One CSS declaration: property in kebab-case, value as a string. */
export type Decl = [prop: string, value: string];

export interface Layer {
  classes: string[];
  decls: Decl[];
}

export interface RowBox {
  /**
   * The background element (<td> or <Section>). Holds the radius, the shadow
   * and the hook class; the exporter adds the background itself. It also holds
   * the clip, except when the row has a shadow of its own (see buildRowBox).
   */
  td: Layer;
  /**
   * Border, radius and clip. Present for a radius with a border, and whenever
   * the row has a mobile border, so a border override always has an element
   * to attach to.
   */
  outer: Layer | null;
  /**
   * Padding, and the simple border when there is no outer element. When the row
   * has a shadow of its own and no outer element, it also holds the clip.
   */
  inner: Layer;
  /** HTML and MJML put it on the td; React does not emit it today. */
  minHeight: number;
}

interface SpacingLike {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

interface BorderLike {
  width?: number;
  style?: string;
  color?: string;
  /** A number, or one per corner. Read through core/borderRadius. */
  radius?: BorderRadius;
}

/** Anything that can carry a sparse `mobile` object: rows, columns, spacers. */
export interface MobileNode {
  id: string;
  mobile?: object | null;
}

/** The keys a row can override on mobile. Only `border` and `gap` are read here. */
interface RowMobileLike {
  backgroundColor?: string | null;
  backgroundGradient?: unknown;
  padding?: unknown;
  border?: BorderLike | null;
  boxShadow?: unknown;
  minHeight?: number | null;
  gap?: number | null;
}

export interface RowLike extends MobileNode {
  border?: BorderLike | null;
  /** A BoxShadow, or nothing. Read through boxShadowValue, so any value is safe. */
  boxShadow?: unknown;
  padding?: SpacingLike | null;
  minHeight?: number;
  mobileStack?: boolean;
  gap?: number;
  mobile?: RowMobileLike | null;
  /** Read to find out whether a shadow inside the row needs room (clipsOverflow). */
  columns?: unknown[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** True when at least one mobile override is set. */
export const hasNodeMobile = (
  node: { mobile?: object | null } | null | undefined,
): boolean =>
  !!node?.mobile &&
  Object.values(node.mobile).some((v) => v !== null && v !== undefined);

/** Hook classes for a node. Every list is empty unless the node has overrides. */
export const nodeHooks = (node: MobileNode) => {
  const on = hasNodeMobile(node);
  const uid = `eb-${node.id}`;
  return {
    root: on ? [uid] : [],
    box: on ? [`${uid}-box`] : [],
    outer: on ? [`${uid}-outer`] : [],
  };
};

// ─── Row shell ────────────────────────────────────────────────────────────────

const spacing = (p?: SpacingLike | null): string =>
  `${p?.top ?? 0}px ${p?.right ?? 0}px ${p?.bottom ?? 0}px ${p?.left ?? 0}px`;

const borderDecl = (b: BorderLike): Decl => [
  "border",
  `${b.width}px ${b.style} ${b.color}`,
];

export const buildRowBox = (row: RowLike): RowBox => {
  const w = row.border?.width ?? 0;
  const rounded = hasBorderRadius(row.border?.radius);
  const radius = borderRadiusValue(row.border?.radius);
  const hooks = nodeHooks(row);

  // The one place that decides the DOM shape: a single div normally, or an
  // outer div (border, radius, clip) around an inner div (padding) when the
  // row has both a radius and a border. A mobile border forces the outer
  // element, so a border override always has something to attach to, even
  // when the desktop row has no border.
  const needsOuter = (rounded && w > 0) || !!row.mobile?.border;

  // The shadow goes on the <td> (or <Section>), the element that carries the
  // background and the radius, so it follows the row's rounded corners. The
  // row clips its contents (overflow:hidden) unless a shadow inside it would be
  // cut off and no rounded corner needs the clip: see clipsOverflow in
  // core/boxShadow.ts. Every element that can clip follows that one rule.
  //
  // One more rule decides which element clips. A table cell that has an overflow
  // does not show its own shadow when its table is border-collapse:collapse,
  // which is where every nested row sits (browsers cut the shadow off at the
  // cell's edge). So a row with a shadow of its own, on desktop or on mobile,
  // leaves the clip to a div inside the cell: the outer div, or the inner div
  // when there is no outer one. The curve they clip is the same one, and the
  // shadow is drawn by the cell, outside both.
  const shadow = boxShadowValue(row.boxShadow);
  const clips = clipsOverflow(row);
  const cellClips = clips && !hasActiveShadow(row);
  const td: Layer = {
    classes: hooks.root,
    decls: [
      ...(rounded ? [["border-radius", radius] as Decl] : []),
      ...(cellClips ? [["overflow", "hidden"] as Decl] : []),
      ...(shadow ? [["box-shadow", shadow] as Decl] : []),
    ],
  };
  const pad: Decl = ["padding", spacing(row.padding)];
  const clip: Decl[] = [
    ["line-height", "0"],
    ["font-size", "0"],
  ];
  const minHeight = row.minHeight ?? 0;

  if (!needsOuter) {
    return {
      td,
      outer: null,
      minHeight,
      inner: {
        // One element carries both hooks.
        classes: [...hooks.box, ...hooks.outer],
        decls: [
          pad,
          ...(w > 0 && !rounded && row.border ? [borderDecl(row.border)] : []),
          // The clip the cell gave up (see above), with the cell's curve.
          ...(clips && !cellClips
            ? [
                ...(rounded ? [["border-radius", radius] as Decl] : []),
                ["overflow", "hidden"] as Decl,
              ]
            : []),
          ...clip,
        ],
      },
    };
  }

  return {
    td,
    minHeight,
    outer: {
      classes: hooks.outer,
      decls: [
        ["border-radius", radius],
        ...(clips ? [["overflow", "hidden"] as Decl] : []),
        ...clip,
        ...(w > 0 && row.border ? [borderDecl(row.border)] : []),
      ],
    },
    inner: { classes: hooks.box, decls: [pad, ...clip] },
  };
};

// ─── Serializers ──────────────────────────────────────────────────────────────

const camel = (s: string): string =>
  s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** `["padding:0px", ...]` for HTML and MJML. */
export const cssDecls = (decls: Decl[]): string[] =>
  decls.map(([p, v]) => `${p}:${v}`);

/** `['padding:"0px"', ...]` for a React `style={{ ... }}` object. */
export const reactEntries = (decls: Decl[]): string[] =>
  decls.map(([p, v]) => `${camel(p)}:"${v}"`);

/** ` class="a b"`, or nothing when there are no classes. */
export const classAttr = (classes: string[]): string =>
  classes.length ? ` class="${classes.join(" ")}"` : "";

/** ` className="a b"`. Always emitted: React's Column writes it even when empty. */
export const classNameAttr = (classes: string[]): string =>
  ` className="${classes.join(" ")}"`;

const openDiv = (layer: Layer): string =>
  `<div${classAttr(layer.classes)} style="${cssDecls(layer.decls).join(";")}">`;

/** The wrapper divs around a row's inner table, as HTML (also used by MJML). */
export const renderBoxHtml = (box: RowBox, content: string): string =>
  box.outer
    ? `${openDiv(box.outer)}${openDiv(box.inner)}${content}</div></div>`
    : `${openDiv(box.inner)}${content}</div>`;

const openDivJsx = (layer: Layer): string =>
  `<div${layer.classes.length ? classNameAttr(layer.classes) : ""} style={{ ${reactEntries(layer.decls).join(", ")} }}>`;

/** The wrapper divs around a row's inner table, as React Email JSX. */
export const renderBoxJsx = (box: RowBox, content: string): string =>
  box.outer
    ? `${openDivJsx(box.outer)}${openDivJsx(box.inner)}${content}</div></div>`
    : `${openDivJsx(box.inner)}${content}</div>`;

// ─── Column, gap and spacer classes ───────────────────────────────────────────
// The class lists the exporters assemble by hand today, plus the hooks.

export const columnClasses = (row: RowLike, col: MobileNode): string[] => [
  ...(row.mobileStack ? ["mobile-stack"] : []),
  ...nodeHooks(col).root,
];

export const gapClasses = (row: RowLike): string[] => [
  `gap-${row.gap}`,
  ...(row.mobileStack ? ["mobile-stack"] : []),
  // Only meaningful when stacked: the gap cell is then a vertical spacer.
  ...(row.mobileStack && row.mobile?.gap != null ? [`eb-${row.id}-gap`] : []),
];

export const spacerClasses = (spacer: MobileNode): string[] =>
  nodeHooks(spacer).root;
