import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { clampRect, freeSpot, intersects, SPOT_LEFT, SPOT_TOP } from "../../src/core/layout";
import { CANVAS_H, CANVAS_W } from "../../src/core/types";
import { arbRect } from "../arbitraries";

const GAP = 12;
const grow = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x - GAP, y: r.y - GAP, w: r.w + GAP * 2, h: r.h + GAP * 2 });

describe("freeSpot: where a new object lands", () => {
  // Property 8 (layout stays in canvas), for new objects: a spot is always on the card, at the asked size (clamped).
  it("returns a box inside the canvas with the clamped size, or null", () => {
    fc.assert(fc.property(fc.array(arbRect, { maxLength: 12 }), arbRect, (taken, want) => {
      const r = freeSpot(taken, want.w, want.h);
      if (r === null) return;
      const size = clampRect({ x: 0, y: 0, w: want.w, h: want.h });
      expect([r.w, r.h]).toEqual([size.w, size.h]);
      expect(clampRect(r)).toEqual(r);
      expect(r.x + r.w).toBeLessThanOrEqual(CANVAS_W);
      expect(r.y + r.h).toBeLessThanOrEqual(CANVAS_H);
    }));
  });

  it("never overlaps or crowds an existing box", () => {
    fc.assert(fc.property(fc.array(arbRect, { maxLength: 12 }), arbRect, (taken, want) => {
      const r = freeSpot(taken, want.w, want.h);
      if (r !== null) for (const t of taken) expect(intersects(r, grow(t))).toBe(false);
    }));
  });

  it("finds room whenever the bottom half of the card is empty", () => {
    const top = arbRect.map((r) => ({ ...r, y: Math.max(-100, Math.min(r.y, 0)), h: Math.min(r.h, 280) }));
    fc.assert(fc.property(fc.array(top, { maxLength: 12 }), fc.integer({ min: 16, max: 400 }), fc.integer({ min: 16, max: 240 }), (taken, w, h) => {
      expect(freeSpot(taken, w, h)).not.toBeNull();
    }));
  });

  it("is pure: same answer twice and the input is untouched", () => {
    fc.assert(fc.property(fc.array(arbRect, { maxLength: 8 }), arbRect, (taken, want) => {
      const copy = structuredClone(taken);
      expect(freeSpot(taken, want.w, want.h)).toEqual(freeSpot(taken, want.w, want.h));
      expect(taken).toEqual(copy);
    }));
  });

  it("starts top-left on an empty card and stacks the next box below the first", () => {
    const first = freeSpot([], 440, 110);
    expect(first).toEqual({ x: SPOT_LEFT, y: SPOT_TOP, w: 440, h: 110 });
    const second = freeSpot([first!], 220, 64);
    expect(second?.x).toBe(SPOT_LEFT);
    expect(second!.y).toBeGreaterThanOrEqual(SPOT_TOP + 110 + GAP);
  });

  it("returns null when the card is full", () => {
    expect(freeSpot([{ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H }], 100, 50)).toBeNull();
  });
});
