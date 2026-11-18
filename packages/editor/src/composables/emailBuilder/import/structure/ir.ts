// import/structure/ir.ts
// ─────────────────────────────────────────────────────────────────────────────
// The importer's intermediate representation
//
// The analyzer turns a DOM into a vertical list of Items, using the desktop
// view. It decides what the structure is: which text is a paragraph, which
// table is a button, where the columns are. It records no styles. Every item
// keeps references to the elements its styles come from, and the emitter reads
// those elements once per view, which is how the same structure gets both its
// base props and its mobile overrides.
//
//   Leaf   one Maildeno block
//   Box    a wrapper that has padding or paint (a <td>, a <div>, a table)
//   Cols   several cells side by side
//
// Boxes and Cols are merged and turned into Maildeno rows, columns and nested
// rows by structure/plan.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type BlockType =
  | "button"
  | "anchor"
  | "paragraph"
  | "heading"
  | "list"
  | "image"
  | "video"
  | "divider"
  | "spacer"
  | "menu"
  | "socials";

/** Hidden on desktop / hidden on phone. Both true means the node is dropped. */
export interface Hide {
  d: boolean;
  p: boolean;
}

/**
 * Spacing contributed by a wrapper the leaf sits in: the wrapper's padding (or
 * margin) on the flagged sides. It is added to the leaf's margin when the
 * wrapper itself cannot become a row or column.
 */
export interface WrapPad {
  el: Element;
  /**
   * "spacing": the element's padding (and margin, where a margin takes effect)
   * on the flagged sides. "width": the element's declared width, for an empty
   * table cell that only pushes the content in from the left or the right.
   */
  kind: "spacing" | "width";
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

/** One link of a menu or a socials block. */
export interface LinkItem {
  a: Element;
  label: string;
  href: string;
  /** The <img> inside the link, for socials. */
  img: Element | null;
  /** The table cell or span holding the link, whose padding spaces the items. */
  cell: Element | null;
}

export interface Leaf {
  kind: "leaf";
  type: BlockType;
  /** Owns margin, padding and background: a <p>, <h1>, <ul>, <hr>, <img>. Null when a wrapper Box owns them. */
  own: Element | null;
  /** `own` is a wrapper (a filled cell) that a text block took over, not the block's own element. */
  ownWrapper?: boolean;
  /** Typography is read from here, after single-child style wrappers are peeled off. */
  text: Element | null;
  /** The inline content of text blocks. */
  nodes: Node[];
  /** h1 to h6, for a heading. */
  level?: string;
  link?: Element | null;
  img?: Element | null;
  video?: Element | null;
  /** Elements that paint a button when it is built from a table or a cell. */
  shell?: Element[];
  items?: LinkItem[];
  /** A menu had separator characters between its links. */
  separators?: boolean;
  /** The element a spacer's or divider's height and colour come from. */
  src?: Element | null;
  hide: Hide;
  wrap: WrapPad[];
}

export interface Box {
  kind: "box";
  el: Element;
  inner: Item[];
  hide: Hide;
  /** Spacing pushed onto this box from wrappers that were taken apart. */
  wrap: WrapPad[];
  /** Only the element's spacing counts: its fill belongs to the canvas. */
  plain?: boolean;
}

export interface GapInfo {
  px: number | null;
  pct: number | null;
  /** The empty cells the gap came from, to read what they do on a phone. */
  els: Element[];
}

/** A column's declared width: a percentage, pixels, or nothing. */
export interface WidthSpec {
  kind: "pct" | "px" | "auto";
  n: number;
}

export interface Cell {
  el: Element;
  body: Item[];
  hide: Hide;
  width: WidthSpec;
}

export interface Cols {
  kind: "cols";
  /** The row element, or the container of the inline-block columns. */
  el: Element;
  cells: Cell[];
  gap: GapInfo | null;
  hide: Hide;
  /** "table": <td> cells. "inline": inline-block or floated blocks. "flex": a flex container. */
  layout: "table" | "inline" | "flex";
  /** Edge spacers and pushed-down wrapper spacing, added to the row's padding. */
  wrap: WrapPad[];
}

export type Item = Leaf | Box | Cols;
