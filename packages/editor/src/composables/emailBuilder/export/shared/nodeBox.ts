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

/** One CSS declaration: property in kebab-case, value as a string. */
export type Decl = [prop: string, value: string];

export interface Layer {
  classes: string[];
  decls: Decl[];
}

export interface RowBox {
  /**
   * The background element (<td> or <Section>). Holds the radius, the clip
   * and the hook class; the exporter adds the background itself.
   */
  td: Layer;
  /**
   * Border, radius and clip. Present for a radius with a border, and whenever
   * the row has a mobile border, so a border override always has an element
   * to attach to.
   */
  outer: Layer | null;
  /** Padding, and the simple border when there is no outer element. */
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
  radius?: number;
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
  minHeight?: number | null;
  gap?: number | null;
}

export interface RowLike extends MobileNode {
  border?: BorderLike | null;
  padding?: SpacingLike | null;
  minHeight?: number;
  mobileStack?: boolean;
  gap?: number;
  mobile?: RowMobileLike | null;
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
  const r = row.border?.radius ?? 0;
  const hooks = nodeHooks(row);

  // The one place that decides the DOM shape: a single div normally, or an
  // outer div (border, radius, clip) around an inner div (padding) when the
  // row has both a radius and a border. A mobile border forces the outer
  // element, so a border override always has something to attach to, even
  // when the desktop row has no border.
  const needsOuter = (r > 0 && w > 0) || !!row.mobile?.border;

  const td: Layer = {
    classes: hooks.root,
    decls: [
      ...(r > 0 ? [["border-radius", `${r}px`] as Decl] : []),
      ["overflow", "hidden"],
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
          ...(w > 0 && r === 0 && row.border ? [borderDecl(row.border)] : []),
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
        ["border-radius", `${r}px`],
        ["overflow", "hidden"],
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
