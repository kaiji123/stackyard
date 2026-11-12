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
