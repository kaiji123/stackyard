import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { KEEP_MAX_BYTES, MAX_SIDE, reencodeType, shouldKeepOriginal } from "../src/editor/images";

describe("image upload policy", () => {
  it("keeps small PNG and GIF files untouched", () => {
    expect(shouldKeepOriginal("image/png", 4_000, 256, 256)).toBe(true);
    expect(shouldKeepOriginal("image/gif", 50_000, 640, 160)).toBe(true);
    expect(shouldKeepOriginal("image/png", KEEP_MAX_BYTES, MAX_SIDE, 10)).toBe(true); // limits are inclusive
  });

  it("re-encodes everything else", () => {
    expect(shouldKeepOriginal("image/png", KEEP_MAX_BYTES + 1, 100, 100)).toBe(false); // too heavy
    expect(shouldKeepOriginal("image/png", 1000, MAX_SIDE + 1, 10)).toBe(false);        // too large to display sensibly
    expect(shouldKeepOriginal("image/jpeg", 1000, 10, 10)).toBe(false);
    expect(shouldKeepOriginal("image/webp", 1000, 10, 10)).toBe(false);
    expect(shouldKeepOriginal("image/svg+xml", 1000, 10, 10)).toBe(false);
    expect(shouldKeepOriginal("", 1000, 10, 10)).toBe(false);
  });

  it("only ever keeps png/gif within both limits, for any input", () => {
    fc.assert(fc.property(fc.string(), fc.nat(1_000_000), fc.nat(4000), fc.nat(4000), (t, bytes, w, h) => {
      if (shouldKeepOriginal(t, bytes, w, h)) {
        expect(["image/png", "image/gif"]).toContain(t);
        expect(bytes).toBeLessThanOrEqual(KEEP_MAX_BYTES);
        expect(Math.max(w, h)).toBeLessThanOrEqual(MAX_SIDE);
      }
    }));
  });

  it("falls back to PNG, never JPEG, so transparency survives", () => {
    expect(reencodeType(true)).toBe("image/webp");
    expect(reencodeType(false)).toBe("image/png");
  });
});
