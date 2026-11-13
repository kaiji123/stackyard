import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PALETTE as ART_PALETTE } from "../scripts/art/grid.ts";
import { PALETTE } from "../src/editor/palette";
import {
  blank, blockSize, boxCells, brush, colourAt, coloursUsed, downscale, fill, fromRGBA, isEmpty, lineCells, mirror, paint,
  toRGBA, TRANSPARENT, type Pixels,
} from "../src/editor/pixels";

const arbPixels: fc.Arbitrary<Pixels> = fc.record({ w: fc.integer({ min: 1, max: 12 }), h: fc.integer({ min: 1, max: 12 }) })
  .chain(({ w, h }) => fc.array(fc.constantFrom(TRANSPARENT, 0x112233, 0xff9d3c, 0xffffff), { minLength: w * h, maxLength: w * h })
    .map((cs) => ({ w, h, px: Int32Array.from(cs) })));

describe("drawing: pixel operations", () => {
  it("the drawing palette is exactly the shared art palette", () => {
    expect(PALETTE.map((c) => c.hex).sort()).toEqual(Object.values(ART_PALETTE).map((h) => h.toLowerCase()).sort());
  });

  it("never mutate their input", () => {
    fc.assert(fc.property(arbPixels, fc.nat(), fc.nat(), (p, x, y) => {
      const copy = p.px.slice();
      paint(p, [[x % p.w, y % p.h]], 0x123456);
      fill(p, x % p.w, y % p.h, 0x123456);
      expect(p.px).toEqual(copy);
    }));
  });

  it("lines include both ends and are 8-connected without gaps", () => {
    fc.assert(fc.property(fc.integer({ min: -20, max: 20 }), fc.integer({ min: -20, max: 20 }), fc.integer({ min: -20, max: 20 }), fc.integer({ min: -20, max: 20 }), (x0, y0, x1, y1) => {
      const cells = lineCells(x0, y0, x1, y1);
      expect(cells[0]).toEqual([x0, y0]);
      expect(cells[cells.length - 1]).toEqual([x1, y1]);
      expect(cells.length).toBe(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1);
      for (let i = 1; i < cells.length; i++) {
        const [ax, ay] = cells[i - 1]!, [bx, by] = cells[i]!;
        expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by))).toBe(1);
      }
    }));
  });

  it("fill recolours exactly the connected region of the clicked colour, and is idempotent", () => {
    fc.assert(fc.property(arbPixels, fc.nat(), fc.nat(), (p, a, b) => {
      const x = a % p.w, y = b % p.h, target = colourAt(p, x, y), colour = 0x00ff00;
      const out = fill(p, x, y, colour);
      // Region via a plain BFS, to compare with.
      const seen = new Set<number>([y * p.w + x]), queue = [[x, y] as const];
      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h || seen.has(ny * p.w + nx) || colourAt(p, nx, ny) !== target) continue;
          seen.add(ny * p.w + nx); queue.push([nx, ny]);
        }
      }
      for (let i = 0; i < p.px.length; i++) expect(out.px[i]).toBe(seen.has(i) ? colour : p.px[i]);
      expect(fill(out, x, y, colour)).toBe(out);
    }));
  });

  it("boxes, brushes and mirroring cover the right cells", () => {
    expect(boxCells(3, 1, 1, 2)).toHaveLength(6);
    expect(brush([[5, 5]], 2)).toHaveLength(4);
    expect(brush([[5, 5]], 4)).toHaveLength(16);
    expect(mirror([[0, 3]], 10).map(String).sort()).toEqual(["0,3", "9,3"]);
    expect(mirror([[4, 0]], 9).map(String)).toEqual(["4,0"]); // the centre column mirrors onto itself
  });

  it("RGBA round trip is exact for opaque and transparent pixels", () => {
    fc.assert(fc.property(arbPixels, (p) => {
      expect(fromRGBA(p.w, p.h, toRGBA(p)).px).toEqual(p.px);
    }));
  });

  it("finds the block size of scaled-up art and shrinks it back exactly", () => {
    fc.assert(fc.property(arbPixels, fc.integer({ min: 2, max: 6 }), (p, k) => {
      fc.pre(new Set(p.px).size > 1); // a single flat colour has no meaningful block size
      const big = { w: p.w * k, h: p.h * k, px: new Int32Array(p.w * k * p.h * k) };
      for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) big.px[y * big.w + x] = colourAt(p, Math.floor(x / k), Math.floor(y / k));
      const found = blockSize(big);
      expect(found % k).toBe(0); // k, or a multiple when the small art itself is blocky
      expect(downscale(big, k).px).toEqual(p.px);
    }));
  });

  it("knows when a drawing is empty and which colours it uses", () => {
    const p = blank(3, 2);
    expect(isEmpty(p)).toBe(true);
    const q = paint(paint(p, [[0, 0], [1, 0]], 0xaa0000), [[2, 1]], 0x00bb00);
    expect(isEmpty(q)).toBe(false);
    expect(coloursUsed(q)).toEqual([0xaa0000, 0x00bb00]);
  });
});
