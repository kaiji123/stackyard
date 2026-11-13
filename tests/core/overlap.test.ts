import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { diagnose } from "../../src/core/doctor";
import { intersects } from "../../src/core/layout";
import { liveTextOverlaps, staticTextOverlaps } from "../../src/core/overlap";
import type { Stack, StackObject } from "../../src/core/types";
import { arbStack } from "../arbitraries";

const text = (id: string, y: number, over: Partial<StackObject> = {}): StackObject =>
  ({ kind: "text", id, x: 10, y, w: 200, h: 50, visible: true, actions: [], motion: "none", text: id, fontSize: 20, bold: false, align: "left", ...over }) as StackObject;
const btn = (id: string, actions: StackObject["actions"]): StackObject =>
  ({ kind: "button", id, x: 600, y: 500, w: 100, h: 40, visible: true, actions, motion: "none", label: id }) as StackObject;
const one = (objects: StackObject[]): Stack => ({
  schemaVersion: 4, skin: "plain", title: "t", start: "c1", assets: {}, cards: [{ id: "c1", name: "A", objects }],
});

describe("text overlap", () => {
  it("touching edges are not an overlap, shared area is", () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });

  it("flags two texts that are visible together", () => {
    const s = one([text("a", 100), text("b", 120)]);
    expect(liveTextOverlaps(s).overlaps).toHaveLength(1);
    expect(diagnose(s).some((i) => i.code === "text-overlap")).toBe(true);
  });

  it("ignores alternatives that are never shown together, but catches the ones that can be", () => {
    // The Study pattern: in the dark you see "dark"; with the lamp on, opening the drawer shows "key".
    const alt = (hideDark: boolean): Stack => one([
      text("dark", 100, { visible: false }), text("key", 110, { visible: false }),
      { ...btn("lamp", [{ type: "setFlag", flag: "lamp", value: true }]), x: 10 },
      btn("drawer", [{
        type: "if", cond: { flag: "lamp" },
        then: hideDark ? [{ type: "hide", object: "dark" }, { type: "show", object: "key" }] : [{ type: "show", object: "key" }],
        else: [{ type: "show", object: "dark" }],
      }]),
    ]);
    expect(liveTextOverlaps(alt(true)).overlaps).toHaveLength(0);
    expect(liveTextOverlaps(alt(false)).overlaps).toHaveLength(1); // drawer in the dark, lamp, drawer again
  });

  it("checks cards that nothing links to yet", () => {
    const s: Stack = { ...one([]), cards: [
      { id: "c1", name: "A", objects: [] },
      { id: "c2", name: "B", objects: [text("a", 100), text("b", 120)] },
    ] };
    expect(liveTextOverlaps(s).overlaps).toHaveLength(1);
  });

  // Soundness: texts visible at start that overlap are always reported.
  it("always reports overlapping texts that are visible at the start", () => {
    fc.assert(fc.property(arbStack, (stack) => {
      const live = new Set(liveTextOverlaps(stack).overlaps.map((o) => [o.card, ...[o.a, o.b].sort()].join("|")));
      for (const o of staticTextOverlaps(stack)) {
        const card = stack.cards.find((c) => c.id === o.card);
        const vis = (id: string): boolean => card?.objects.find((x) => x.id === id)?.visible === true;
        if (vis(o.a) && vis(o.b)) expect(live.has([o.card, ...[o.a, o.b].sort()].join("|"))).toBe(true);
      }
    }), { numRuns: 150 });
  });

  // No false positives: if no rectangles intersect, nothing is reported.
  it("reports nothing when no text rectangles intersect", () => {
    fc.assert(fc.property(arbStack, (stack) => {
      if (staticTextOverlaps(stack).length === 0) {
        expect(liveTextOverlaps(stack).overlaps).toEqual([]);
        expect(diagnose(stack).some((i) => i.code === "text-overlap")).toBe(false);
      }
    }), { numRuns: 150 });
  });
});
