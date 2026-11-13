import { CANVAS_H, CANVAS_W } from "./types";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const MIN_SIZE = 16;

/** Force a rectangle fully inside the logical canvas. Non-finite numbers fall back to safe values. */
export function clampRect(r: Rect): Rect {
  const fin = (n: number, d: number): number => (Number.isFinite(n) ? n : d);
  const w = Math.min(CANVAS_W, Math.max(MIN_SIZE, fin(r.w, MIN_SIZE)));
  const h = Math.min(CANVAS_H, Math.max(MIN_SIZE, fin(r.h, MIN_SIZE)));
  const x = Math.min(CANVAS_W - w, Math.max(0, fin(r.x, 0)));
  const y = Math.min(CANVAS_H - h, Math.max(0, fin(r.y, 0)));
  return { x, y, w, h };
}

/** Uniform scale that fits the logical canvas into a viewport. Always finite and > 0. */
export function fitScale(viewW: number, viewH: number): number {
  const s = Math.min(viewW / CANVAS_W, viewH / CANVAS_H);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

/** True when two rectangles share area. Touching edges do not count as overlap. */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Where new objects start: right of the card's red margin line, near the top. */
export const SPOT_LEFT = 80, SPOT_TOP = 40;
const SPOT_STEP = 20, SPOT_GAP = 12;

/**
 * A place for a new `w`×`h` box that keeps at least SPOT_GAP px clear of every rectangle in `taken`.
 * Searches a 20 px grid column by column from the top-left, so new things stack downwards like lines on a
 * card. Returns null when nothing fits; the caller picks a fallback. The size is clamped to the canvas.
 */
export function freeSpot(taken: readonly Rect[], w: number, h: number): Rect | null {
  const size = clampRect({ x: 0, y: 0, w, h });
  const blocked = taken.map((t) => ({ x: t.x - SPOT_GAP, y: t.y - SPOT_GAP, w: t.w + SPOT_GAP * 2, h: t.h + SPOT_GAP * 2 }));
  for (let x = SPOT_LEFT; x + size.w <= CANVAS_W; x += SPOT_STEP) {
    for (let y = SPOT_TOP; y + size.h <= CANVAS_H; y += SPOT_STEP) {
      const r = { x, y, w: size.w, h: size.h };
      if (!blocked.some((b) => intersects(r, b))) return r;
    }
  }
  return null;
}
