import fc from "fast-check";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clearBackground, decodeGif, encodeGif, type Gif } from "../scripts/gif.ts";

/** Random small animations: a palette of up to 40 colours, some fully transparent pixels. */
const arbGif: fc.Arbitrary<Gif> = fc
  .record({ w: fc.integer({ min: 1, max: 24 }), h: fc.integer({ min: 1, max: 24 }), colours: fc.integer({ min: 1, max: 40 }), n: fc.integer({ min: 1, max: 4 }) })
  .chain(({ w, h, colours, n }) =>
    fc.record({
      width: fc.constant(w),
      height: fc.constant(h),
      frames: fc.array(
        fc.record({
          px: fc.array(fc.integer({ min: -1, max: colours - 1 }), { minLength: w * h, maxLength: w * h }),
          delay: fc.integer({ min: 0, max: 500 }),
        }).map(({ px, delay }) => {
          const rgba = new Uint8Array(w * h * 4);
          px.forEach((c, i) => { if (c >= 0) rgba.set([(c * 53) & 255, (c * 97) & 255, (c * 151) & 255, 255], i * 4); });
          return { rgba, delay };
        }),
        { minLength: n, maxLength: n },
      ),
    }));

describe("GIF codec", () => {
  it("decode(encode(gif)) gives back every frame exactly, transparency included", () => {
    fc.assert(fc.property(arbGif, (gif) => {
      const back = decodeGif(encodeGif(gif));
      expect(back.width).toBe(gif.width);
      expect(back.height).toBe(gif.height);
      expect(back.frames.map((f) => f.delay)).toEqual(gif.frames.map((f) => f.delay));
      back.frames.forEach((f, i) => expect(Buffer.from(f.rgba).equals(Buffer.from(gif.frames[i]!.rgba))).toBe(true));
    }), { numRuns: 200 });
  });

  it("handles long runs that fill the 4096-entry LZW table (dictionary reset)", () => {
    const w = 400, h = 300, rgba = new Uint8Array(w * h * 4);
    let s = 7;
    for (let i = 0; i < w * h; i++) { s = (s * 1103515245 + 12345) >>> 0; const c = (s >>> 16) % 200; rgba.set([c, 255 - c, (c * 3) & 255, 255], i * 4); }
    const back = decodeGif(encodeGif({ width: w, height: h, frames: [{ rgba, delay: 5 }] }));
    expect(Buffer.from(back.frames[0]!.rgba).equals(Buffer.from(rgba))).toBe(true);
  });

  it("clearBackground removes only background connected to the border", () => {
    // 5x5: dark border ring, a light ring inside, and a dark pixel enclosed in the middle.
    const D = [27, 20, 38, 255], L = [241, 233, 255, 255];
    const rows = ["DDDDD", "DLLLD", "DLDLD", "DLLLD", "DDDDD"];
    const rgba = new Uint8Array(rows.join("").split("").flatMap((ch) => (ch === "D" ? D : L)));
    const out = clearBackground({ width: 5, height: 5, frames: [{ rgba, delay: 1 }] }).frames[0]!.rgba;
    const alpha = (x: number, y: number): number => out[(y * 5 + x) * 4 + 3]!;
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(1, 1)).toBe(255);
    expect(alpha(2, 2)).toBe(255); // enclosed dark detail is kept
    const all = clearBackground({ width: 5, height: 5, frames: [{ rgba, delay: 1 }] }, { mode: "all" }).frames[0]!.rgba;
    expect(all[(2 * 5 + 2) * 4 + 3]).toBe(0);  // "all" clears enclosed pixels too
    expect(all[(1 * 5 + 1) * 4 + 3]).toBe(255); // and nothing else
  });
});

describe("derived media", () => {
  it("candle-flicker-transparent.gif is up to date with its source (run `npm run media`)", () => {
    const expected = encodeGif(clearBackground(decodeGif(readFileSync("media/gifs/candle-flicker.gif")), { mode: "all" }));
    expect(Buffer.from(expected).equals(readFileSync("media/gifs/candle-flicker-transparent.gif"))).toBe(true);
  });

  it("the transparent candle keeps every frame and timing, and its corners are see-through", () => {
    const src = decodeGif(readFileSync("media/gifs/candle-flicker.gif"));
    const out = decodeGif(readFileSync("media/gifs/candle-flicker-transparent.gif"));
    expect(out.frames.map((f) => f.delay)).toEqual(src.frames.map((f) => f.delay));
    for (const f of out.frames) {
      for (const [x, y] of [[0, 0], [239, 0], [0, 239], [239, 239]] as const) expect(f.rgba[(y * 240 + x) * 4 + 3]).toBe(0);
    }
    // No background-coloured specks are left anywhere (they show as dark dots on light cards).
    for (const f of out.frames) for (let p = 0; p < f.rgba.length; p += 4) {
      if (f.rgba[p + 3]) expect([f.rgba[p], f.rgba[p + 1], f.rgba[p + 2]]).not.toEqual([0x1b, 0x14, 0x26]);
    }
    // Opaque pixels are untouched copies of the source.
    out.frames.forEach((f, i) => {
      const s = src.frames[i]!.rgba;
      for (let p = 0; p < f.rgba.length; p += 4) if (f.rgba[p + 3]) expect([f.rgba[p], f.rgba[p + 1], f.rgba[p + 2]]).toEqual([s[p], s[p + 1], s[p + 2]]);
    });
  });
});
