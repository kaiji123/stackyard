import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTE } from "../scripts/art/grid.ts";
import { ART, render } from "../scripts/make-art.ts";
import { decodeGif } from "../scripts/gif.ts";
import { decodePng, encodePng } from "../scripts/png.ts";
import fc from "fast-check";

const allowed = new Set(Object.values(PALETTE).map((h) => h.toLowerCase()));
const hex = (r: number, g: number, b: number): string => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

describe("PNG codec", () => {
  it("decode(encode(bitmap)) is exact for any small RGBA bitmap", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 20 }), fc.integer(), (w, h, seed) => {
      const rgba = new Uint8Array(w * h * 4);
      let s = seed;
      for (let i = 0; i < rgba.length; i++) { s = (s * 1103515245 + 12345) | 0; rgba[i] = (s >>> 16) & 255; }
      const back = decodePng(encodePng({ width: w, height: h, rgba }));
      expect([back.width, back.height]).toEqual([w, h]);
      expect(Buffer.from(back.rgba).equals(Buffer.from(rgba))).toBe(true);
    }), { numRuns: 100 });
  });

  it("reads the original media the same way a browser would (sizes and corners)", () => {
    const bg = decodePng(readFileSync("media/backgrounds/bg-hall.png"));
    expect([bg.width, bg.height]).toEqual([800, 600]);
    const ghost = decodePng(readFileSync("media/sprites/ghost.png"));
    expect(ghost.rgba[3]).toBe(0); // transparent corner
  });
});

describe("story art (npm run art)", () => {
  for (const a of ART) {
    it(`${a.file} is up to date, uses only the shared palette, and has the right size`, () => {
      const onDisk = readFileSync(a.file);
      expect(Buffer.from(render(a)).equals(onDisk), "run `npm run art`").toBe(true);
      const name = a.file.split("/").pop() ?? "";
      const frames = a.frames ? decodeGif(onDisk).frames.map((f) => f.rgba) : [decodePng(onDisk).rgba];
      const size = a.frames ? (({ width, height }) => [width, height])(decodeGif(onDisk)) : (({ width, height }) => [width, height])(decodePng(onDisk));
      const kind = name.startsWith("bg-") ? "bg" : a.file.includes("/pumpkin-steps/") ? "pumpkin" : a.frames ? "animation" : "sprite";
      if (kind === "bg") expect(size).toEqual([800, 600]);
      if (kind === "pumpkin") expect(size).toEqual([288, 288]);
      if (kind === "sprite") expect(size).toEqual([256, 256]);
      if (kind === "animation") {
        expect(frames.length).toBeGreaterThan(1);
        expect(new Set(frames.map((f) => Buffer.from(f).toString("base64"))).size, "every frame differs").toBe(frames.length);
      }
      const seen = new Set<string>();
      let soft = 0;
      for (const rgba of frames) for (let i = 0; i < rgba.length; i += 4) {
        const alpha = rgba[i + 3] ?? 0;
        if (alpha !== 0 && alpha !== 255) soft++;
        if (alpha) seen.add(hex(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0));
      }
      expect(soft, "hard pixels only, like the original art").toBe(0);
      for (const c of seen) expect(allowed.has(c), `${c} is not in the palette`).toBe(true);
      const first = frames[0] as Uint8Array;
      if (kind === "bg") expect(first.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true); // backgrounds are opaque
      if (kind === "sprite" || kind === "pumpkin") expect(first[3]).toBe(0);                  // sprites have see-through corners
    });
  }
});
