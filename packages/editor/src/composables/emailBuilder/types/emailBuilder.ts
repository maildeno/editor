// types/emailBuilder.ts
// ─── Shared primitives ────────────────────────────────────────────────────────

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface Border {
  width: number;
  style: string;
  color: string;
  radius: number;
}
export interface GradientStop {
  color: string;
  position: number;
}
export interface Gradient {
  type: "linear" | "radial";
  direction: string;
  colors: GradientStop[];
}
export interface BackgroundGradient {
  useGradient: boolean;
  solid: string;
  gradient: Gradient;
}
export interface Visibility {
  [conditionKey: string]: any;
}

// ─── Mobile overrides on structural nodes ─────────────────────────────────────
// Rows, columns and row-spacers have no `props`, so their per-device overrides
// live on the node as `mobile` — the same sparse shape components keep in
// `props.mobile`. null (or a missing key) means "no override". A node that
// never went through hydrate (a saved row, a freshly added row) may have no
// `mobile` at all, so always read it with `?.`.

export interface CanvasRowMobile {
  backgroundColor?: string | null;
  backgroundGradient?: BackgroundGradient | null;
  padding?: Padding | null;
  border?: Border | null;
  minHeight?: number | null;
  gap?: number | null;
}
export interface CanvasColumnMobile {
  backgroundColor?: string | null;
  backgroundGradient?: BackgroundGradient | null;
  padding?: Padding | null;
  border?: Border | null;
  verticalAlign?: CanvasColumn["verticalAlign"] | null;
}
export interface CanvasSpacerMobile {
  height?: number | null;
  backgroundColor?: string | null;
  backgroundGradient?: BackgroundGradient | null;
}

// ─── Discriminated union — the heart of the recursive model ──────────────────

export type CanvasChild =
  CanvasComponentNode | CanvasRowNode | CanvasSpacerNode;

// A leaf: atomic content block (text, image, button, divider …)
export interface CanvasComponentNode {
  id: string;
  type: "component";
  componentType: string; // e.g. 'text' | 'image' | 'button'
  props: Record<string, any>;
  visibility?: Visibility;
}

// An intermediate container — mirrors a top-level row but lives inside a column
export interface CanvasRowNode {
  id: string;
  type: "row";
  name: string;
  columns: CanvasColumn[];
  backgroundColor: string;
  backgroundGradient: BackgroundGradient;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  padding: Padding;
  border: Border;
  minHeight: number;
  gap: number;
  mobileStack: boolean;
  visibility: Visibility;
  mobile?: CanvasRowMobile;
  // ← NO `components` anymore. Columns own children.
}

export interface CanvasSpacerNode {
  id: string;
  type: "row-spacer";
  name: string;
  height: number;
  backgroundColor: string;
  backgroundGradient: BackgroundGradient;
  visibility: Visibility;
  mobile?: CanvasSpacerMobile;
}

// A column always uses `children` — never `components`
export interface CanvasColumn {
  id: string;
  width: number;
  children: CanvasChild[]; // ← was `components: any[]`
  backgroundColor: string;
  backgroundGradient: BackgroundGradient;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  padding: Padding;
  border: Border;
  verticalAlign: "top" | "middle" | "bottom";
  mobile?: CanvasColumnMobile;
}

// Top-level rows array is CanvasRowNode | CanvasSpacerNode (same as nested)
export type TopLevelRow = CanvasRowNode | CanvasSpacerNode;
