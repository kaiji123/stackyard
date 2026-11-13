// Pure pixel operations for the drawing tool. No DOM: a drawing is a small grid of colours.
// A colour is 0xRRGGBB (24-bit) or TRANSPARENT. Functions never mutate their input.

export const TRANSPARENT = -1;

export interface Pixels {
  readonly w: number;
  readonly h: number;
  /** Row-major, one entry per pixel: 0xRRGGBB, or TRANSPARENT. */
  readonly px: Int32Array;
}

export type Cell = readonly [number, number];

export const blank = (w: number, h: number): Pixels => ({ w, h, px: new Int32Array(w * h).fill(TRANSPARENT) });

export const inside = (p: Pixels, x: number, y: number): boolean => x >= 0 && y >= 0 && x < p.w && y < p.h;

export const colourAt = (p: Pixels, x: number, y: number): number => (inside(p, x, y) ? p.px[y * p.w + x] ?? TRANSPARENT : TRANSPARENT);

export const isEmpty = (p: Pixels): boolean => p.px.every((c) => c === TRANSPARENT);

/** Paint a list of cells (off-grid cells are ignored). */
export function paint(p: Pixels, cells: Iterable<Cell>, colour: number): Pixels {
  const px = p.px.slice();
  for (const [x, y] of cells) if (inside(p, x, y)) px[y * p.w + x] = colour;
  return { w: p.w, h: p.h, px };
}

/** Every cell on a straight line, both ends included (Bresenham). */
export function lineCells(x0: number, y0: number, x1: number, y1: number): Cell[] {
  const out: Cell[] = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** A filled box between two corners, in any order. */
export function boxCells(x0: number, y0: number, x1: number, y1: number): Cell[] {
  const out: Cell[] = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]);
  return out;
}

/** Grow cells into square brush dabs of `size` (1 = single pixel). */
export function brush(cells: readonly Cell[], size: number): Cell[] {
  if (size <= 1) return [...cells];
  const out = new Map<string, Cell>(), a = Math.floor((size - 1) / 2), b = size - 1 - a;
  for (const [x, y] of cells) for (let j = -a; j <= b; j++) for (let i = -a; i <= b; i++) out.set(`${x + i},${y + j}`, [x + i, y + j]);
  return [...out.values()];
}

/** Add the left-right mirror image of every cell (for symmetric sprites). */
export function mirror(cells: readonly Cell[], w: number): Cell[] {
  const out = new Map<string, Cell>();
  for (const [x, y] of cells) { out.set(`${x},${y}`, [x, y]); out.set(`${w - 1 - x},${y}`, [w - 1 - x, y]); }
  return [...out.values()];
}

/** Flood fill the region connected (4-way) to (x, y) that has the same colour. */
export function fill(p: Pixels, x: number, y: number, colour: number): Pixels {
  if (!inside(p, x, y)) return p;
  const target = colourAt(p, x, y);
  if (target === colour) return p;
  const px = p.px.slice(), stack = [y * p.w + x];
  while (stack.length > 0) {
    const i = stack.pop() as number;
    if (px[i] !== target) continue;
    px[i] = colour;
    const cx = i % p.w, cy = (i - cx) / p.w;
    if (cx > 0) stack.push(i - 1);
    if (cx < p.w - 1) stack.push(i + 1);
    if (cy > 0) stack.push(i - p.w);
    if (cy < p.h - 1) stack.push(i + p.w);
  }
  return { w: p.w, h: p.h, px };
}

/** To browser RGBA (for a canvas). Transparent pixels are fully transparent. */
export function toRGBA(p: Pixels): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(p.w * p.h * 4));
  p.px.forEach((c, i) => {
    if (c === TRANSPARENT) return;
    out[i * 4] = (c >> 16) & 255; out[i * 4 + 1] = (c >> 8) & 255; out[i * 4 + 2] = c & 255; out[i * 4 + 3] = 255;
  });
  return out;
}

/** From browser RGBA. Mostly-transparent pixels (alpha < 128) become transparent. */
export function fromRGBA(w: number, h: number, rgba: ArrayLike<number>): Pixels {
  const px = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    px[i] = (rgba[i * 4 + 3] ?? 0) < 128 ? TRANSPARENT : (((rgba[i * 4] ?? 0) << 16) | ((rgba[i * 4 + 1] ?? 0) << 8) | (rgba[i * 4 + 2] ?? 0));
  }
  return { w, h, px };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * The size of the "big pixels" in pixel art that was scaled up (e.g. 16 for a 256 px sprite drawn on a
 * 16×16 grid): the greatest common divisor of every run of equal pixels, along rows and columns.
 */
export function blockSize(p: Pixels): number {
  let g = 0;
  for (let y = 0; y < p.h; y++) {
    let run = 1;
    for (let x = 1; x <= p.w; x++) {
      if (x < p.w && colourAt(p, x, y) === colourAt(p, x - 1, y)) run++;
      else { g = gcd(g, run); run = 1; if (g === 1) return 1; }
    }
  }
  for (let x = 0; x < p.w; x++) {
    let run = 1;
    for (let y = 1; y <= p.h; y++) {
      if (y < p.h && colourAt(p, x, y) === colourAt(p, x, y - 1)) run++;
      else { g = gcd(g, run); run = 1; if (g === 1) return 1; }
    }
  }
  return Math.max(1, g);
}

/** Shrink pixel art by its block size: one cell per big pixel. */
export function downscale(p: Pixels, k: number): Pixels {
  if (k <= 1) return p;
  const w = Math.floor(p.w / k), h = Math.floor(p.h / k), px = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = colourAt(p, x * k, y * k);
  return { w, h, px };
}

/** The distinct colours used, most used first (to extend the palette when editing someone's art). */
export function coloursUsed(p: Pixels): number[] {
  const n = new Map<number, number>();
  for (const c of p.px) if (c !== TRANSPARENT) n.set(c, (n.get(c) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
export const fromHex = (h: string): number => parseInt(h.replace("#", ""), 16);
