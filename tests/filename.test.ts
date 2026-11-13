import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fileSlug } from "../src/export/filename";
import { NASTY } from "./arbitraries";

describe("fileSlug", () => {
  it("keeps non-Latin titles readable", () => {
    expect(fileSlug("幽霊の家")).toBe("幽霊の家");
    expect(fileSlug("مرحبا")).toBe("مرحبا");
    expect(fileSlug("Haunted House Escape Room")).toBe("haunted-house-escape-room");
    expect(fileSlug("Привет, мир!")).toBe("привет,-мир!");
  });

  it("falls back to 'stack' only when nothing usable is left", () => {
    for (const t of ["", "   ", "///", "?*:", "\u2028\u2029", "...", "---"]) expect(fileSlug(t)).toBe("stack");
  });

  it("always yields a safe, non-empty, bounded name, for any title", () => {
    const titles = fc.oneof(fc.string({ unit: "grapheme", maxLength: 120 }), fc.string({ maxLength: 200 }), fc.constantFrom(...NASTY));
    fc.assert(fc.property(titles, (t) => {
      const s = fileSlug(t);
      expect(s.length).toBeGreaterThan(0);
      expect(Array.from(s).length).toBeLessThanOrEqual(86); // 80 + "stack-" prefix for reserved names
      expect(s).not.toMatch(/[\\/:*?"<>|\u0000-\u001f\u007f\u2028\u2029]/);
      expect(s).not.toMatch(/^[-.]|[-.]$/);
      expect(s).not.toMatch(/\s/);
      expect(s).not.toMatch(/^(con|prn|aux|nul|com\d|lpt\d)$/i);
    }));
  });
});
