// composables/useColor.ts
import { ref, computed } from "vue";

type RGB = [number, number, number];

const clamp = (v: any, min: any, max: any) =>
  Math.min(Math.max(Number(v) || 0, min), max);

export function useColor(initial = "#ff0000") {
  const h = ref(0);
  const s = ref(1);
  const v = ref(1);
  const a = ref(1);

  // ─── Conversions ─────────────────────────────────────────────────────────

  const hsvToRgb = (hh: number, ss: number, vv: number): RGB => {
    const f = (n: number, k = (n + hh / 60) % 6) =>
      vv - vv * ss * Math.max(Math.min(k, 4 - k, 1), 0);

    return [f(5), f(3), f(1)].map((x) => Math.round(x * 255)) as RGB;
  };

  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    let hh = 0;
    if (d !== 0) {
      if (max === r) hh = ((g - b) / d) % 6;
      else if (max === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh = hh * 60;
      if (hh < 0) hh += 360;
    }
    return { h: hh, s: max === 0 ? 0 : d / max, v: max };
  };

  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

  /** Returns null on invalid input — caller shows error state */
  const hexToRgb = (hex: string): RGB | null => {
    let m = hex.replace("#", "").trim();
    if (m.length === 3)
      m = m
        .split("")
        .map((c) => c + c)
        .join("");
    if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
    const n = parseInt(m, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const ll = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: ll };
    const d = max - min;
    const ss = ll > 0.5 ? d / (2 - max - min) : d / (max + min);
    let hh = 0;
    if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) hh = ((b - r) / d + 2) * 60;
    else hh = ((r - g) / d + 4) * 60;
    return { h: hh, s: ss, l: ll };
  };

  const hslToRgb = (hh: number, ss: number, ll: number): RGB => {
    const C = (1 - Math.abs(2 * ll - 1)) * ss;
    const X = C * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = ll - C / 2;
    let r = 0,
      g = 0,
      b = 0;
    if (hh < 60) {
      r = C;
      g = X;
    } else if (hh < 120) {
      r = X;
      g = C;
    } else if (hh < 180) {
      g = C;
      b = X;
    } else if (hh < 240) {
      g = X;
      b = C;
    } else if (hh < 300) {
      r = X;
      b = C;
    } else {
      r = C;
      b = X;
    }
    return [r + m, g + m, b + m].map((x) => Math.round(x * 255)) as RGB;
  };

  // ─── Outputs ─────────────────────────────────────────────────────────────

  const rgb = computed<RGB>(() => hsvToRgb(h.value, s.value, v.value));
  const hex = computed(() => rgbToHex(...rgb.value));
  const rgba = computed(
    () => `rgba(${rgb.value[0]}, ${rgb.value[1]}, ${rgb.value[2]}, ${a.value})`,
  );
  /** hex when fully opaque, rgba() otherwise */
  const cssColor = computed(() => (a.value >= 1 ? hex.value : rgba.value));
  const hsl = computed(() => {
    const { h: hh, s: ss, l } = rgbToHsl(...rgb.value);
    return {
      h: Math.round(hh),
      s: Math.round(ss * 100),
      l: Math.round(l * 100),
    };
  });
  const hsb = computed(() => ({
    h: Math.round(h.value),
    s: Math.round(s.value * 100),
    b: Math.round(v.value * 100),
  }));

  // ─── Setters ─────────────────────────────────────────────────────────────

  /** Returns true if valid hex, false otherwise */
  const setFromHex = (hexVal: string) => {
    const result = hexToRgb(hexVal);
    if (!result) return false;
    const hsv = rgbToHsv(...result);
    h.value = hsv.h;
    s.value = hsv.s;
    v.value = hsv.v;
    return true;
  };

  const setFromRgb = (r: number, g: number, b: number) => {
    const hsv = rgbToHsv(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
    h.value = hsv.h;
    s.value = hsv.s;
    v.value = hsv.v;
  };

  const setFromHsl = (hh: number, ss: number, ll: number) => {
    const [r, g, b] = hslToRgb(
      clamp(hh, 0, 360),
      clamp(ss, 0, 100) / 100,
      clamp(ll, 0, 100) / 100,
    );
    setFromRgb(r, g, b);
  };

  const setFromHsb = (hh: number, ss: number, bb: number) => {
    h.value = clamp(hh, 0, 360);
    s.value = clamp(ss, 0, 100) / 100;
    v.value = clamp(bb, 0, 100) / 100;
  };

  // Initialise
  setFromHex(initial);

  return {
    h,
    s,
    v,
    a,
    rgb,
    hex,
    rgba,
    cssColor,
    hsl,
    hsb,
    setFromHex,
    setFromRgb,
    setFromHsl,
    setFromHsb,
  };
}
