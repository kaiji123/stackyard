// Pixel-art toolkit for Stackyard's own art. Everything is drawn on a small grid using ONLY the shared
// palette below (22 colours measured from the original media, plus 5 added for the Midnight Train:
// navy uniforms, dark velvet, lamp-lit wood and steam), then scaled up with hard edges:
// backgrounds 200×150 ×4 = 800×600, sprites 16×16 ×16 = 256, pumpkin steps 24×24 ×12 = 288.
import type { Bitmap } from "../png.ts";

export const PALETTE = {
  ink: "#0d0814", night: "#1b1426", panel: "#241a35", panel2: "#2d2142", slate: "#2a2633",
  stone: "#4a4458", stoneL: "#7d7590", violetD: "#4a3470", violet: "#6a4fa0", lilac: "#b79cff",
  white: "#f1e9ff", cream: "#fff3c4", yellow: "#ffd66b", orange: "#ff9d3c", rust: "#c4621a",
  woodD: "#3d2a1a", wood: "#6b4a2b", greenD: "#1d4a30", green: "#2f7a4a", mint: "#6be08f",
  red: "#8a2b3a", redL: "#ff6b6b",
  navy: "#262850", navyL: "#454a85", redD: "#4e1626", woodL: "#9c6b3c", mist: "#cfc6e6",
} as const;
export type Colour = keyof typeof PALETTE;
const NAMES = Object.keys(PALETTE) as Colour[];
const INDEX = new Map(NAMES.map((n, i) => [n, i]));
const RGB = NAMES.map((n) => {
  const h = PALETTE[n];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;
});

/** 4×4 ordered-dither thresholds (0..15). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)] ?? 0;

/** Small deterministic PRNG, so the art is identical on every run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Grid {
  readonly px: Int8Array; // palette index, -1 = transparent
  readonly w: number;
  readonly h: number;
  constructor(w: number, h: number, fill: Colour | null = null) {
    this.w = w;
    this.h = h;
    this.px = new Int8Array(w * h).fill(fill === null ? -1 : (INDEX.get(fill) ?? -1));
  }

  set(x: number, y: number, c: Colour | null): this {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c === null ? -1 : (INDEX.get(c) ?? -1);
    return this;
  }
  get(x: number, y: number): Colour | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = this.px[y * this.w + x] ?? -1;
    return i < 0 ? null : (NAMES[i] ?? null);
  }

  rect(x: number, y: number, w: number, h: number, c: Colour | null): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  /** Outline of a rectangle. */
  frame(x: number, y: number, w: number, h: number, c: Colour): this {
    this.rect(x, y, w, 1, c).rect(x, y + h - 1, w, 1, c).rect(x, y, 1, h, c).rect(x + w - 1, y, 1, h, c);
    return this;
  }
  /** Blend two colours over a rectangle: `amount` 0 = all a, 16 = all b, ordered dither in between. */
  dither(x: number, y: number, w: number, h: number, a: Colour, b: Colour, amount: number): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, bayer(i, j) < amount ? b : a);
    return this;
  }
  /** Vertical gradient through a list of colours, dithered between neighbours. */
  vgrad(x: number, y: number, w: number, h: number, stops: readonly Colour[]): this {
    const n = stops.length - 1;
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * n;
      const k = Math.min(n - 1, Math.floor(t));
      const f = Math.round((t - k) * 16);
      const a = stops[k] as Colour, b = stops[k + 1] as Colour;
      for (let i = x; i < x + w; i++) this.set(i, y + j, bayer(i, y + j) < f ? b : a);
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Colour | null): this {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  disc(cx: number, cy: number, r: number, c: Colour | null): this {
    for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++)
      for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++)
        if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) this.set(i, j, c);
    return this;
  }
  /** Soft glow: a dithered halo from `inner` to `outer` radius over whatever is there. */
  glow(cx: number, cy: number, inner: number, outer: number, c: Colour, strength = 10): this {
    for (let j = Math.floor(cy - outer); j <= Math.ceil(cy + outer); j++)
      for (let i = Math.floor(cx - outer); i <= Math.ceil(cx + outer); i++) {
        const d = Math.hypot(i - cx, j - cy);
        if (d > outer) continue;
        const f = d <= inner ? 16 : Math.round(((outer - d) / (outer - inner)) * strength);
        if (bayer(i, j) < f) this.set(i, j, c);
      }
    return this;
  }
  /** Filled polygon (even-odd scanline). */
  poly(points: readonly (readonly [number, number])[], c: Colour | null): this {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i] as readonly [number, number];
        const [x1, y1] = points[(i + 1) % points.length] as readonly [number, number];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k] as number); x < Math.round(xs[k + 1] as number); x++) this.set(x, y, c);
    }
    return this;
  }
  /** Darken toward the edges with ink, like the original backgrounds. */
  vignette(margin: number, c: Colour = "ink"): this {
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const d = Math.min(i, j, this.w - 1 - i, this.h - 1 - j);
      if (d >= margin) continue;
      if (bayer(i, j) < Math.round(((margin - d) / margin) * 14)) this.set(i, j, c);
    }
    return this;
  }
  stars(seed: number, count: number, x: number, y: number, w: number, h: number, colours: readonly Colour[] = ["lilac", "white"]): this {
    const r = rng(seed);
    for (let k = 0; k < count; k++) this.set(x + Math.floor(r() * w), y + Math.floor(r() * h), colours[Math.floor(r() * colours.length)] ?? "white");
    return this;
  }
  /**
   * Stamp ASCII pixel art. Each character is one pixel looked up in `legend`; "." (or any character
   * not in the legend) is left unchanged, so stamps can be layered.
   */
  stamp(x: number, y: number, rows: readonly string[], legend: Readonly<Record<string, Colour | null>>, flip = false): this {
    rows.forEach((row, j) => {
      const chars = flip ? [...row].reverse() : [...row];
      chars.forEach((ch, i) => { if (ch in legend) this.set(x + i, y + j, legend[ch] ?? null); });
    });
    return this;
  }

  /** Like stamp, but each row is the LEFT half and is mirrored to make a symmetric figure. */
  stampSym(x: number, y: number, halfRows: readonly string[], legend: Readonly<Record<string, Colour | null>>): this {
    return this.stamp(x, y, halfRows.map((r) => r + [...r].reverse().join("")), legend);
  }
  /** Write capitals and digits in a 3×5 pixel font (for signs and tickets). Returns the width used. */
  text(x: number, y: number, s: string, c: Colour): number {
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const glyph = FONT[ch];
      if (glyph) glyph.forEach((row, j) => [...row].forEach((p, i) => { if (p === "#") this.set(cx + i, y + j, c); }));
      cx += ch === " " ? 2 : 4;
    }
    return cx - x - 1;
  }
  /** A copy, for drawing animation frames on top of a shared base. */
  clone(): Grid {
    const g = new Grid(this.w, this.h);
    g.px.set(this.px);
    return g;
  }

  /** Scale up with hard edges. */
  toBitmap(scale: number): Bitmap {
    const W = this.w * scale, H = this.h * scale, rgba = new Uint8Array(W * H * 4);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = this.px[y * this.w + x] ?? -1;
      if (i < 0) continue;
      const [r, g, b] = RGB[i] as readonly [number, number, number];
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const o = ((y * scale + dy) * W + x * scale + dx) * 4;
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
      }
    }
    return { width: W, height: H, rgba };
  }
}

const FONT: Readonly<Record<string, readonly string[]>> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"], M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", "#.#", ".#."], P: ["##.", "#.#", "##.", "#..", "#.."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"], S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"], W: ["#.#", "#.#", "###", "###", "#.#"], Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."], "5": ["###", "#..", "##.", "..#", "##."], "9": ["###", "#.#", "###", "..#", "##."],
  ":": ["...", ".#.", "...", ".#.", "..."], ".": ["...", "...", "...", "...", ".#."],
};
