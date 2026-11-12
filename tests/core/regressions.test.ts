import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/core/commands";
import { reachable } from "../../src/core/graph";
import type { Stack, StackObject } from "../../src/core/types";

const btn = (id: string, over: Partial<StackObject> = {}): StackObject =>
  ({ kind: "button", id, x: 0, y: 0, w: 16, h: 16, visible: true, label: "", actions: [], ...over }) as StackObject;

const stackOf = (n: number, objects: Record<string, StackObject[]> = {}): Stack => ({
  schemaVersion: 2, skin: "plain", title: "t", start: "c1", assets: {},
  cards: Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: "", objects: objects[`c${i + 1}`] ?? [] })),
});

describe("regressions found by property tests", () => {
  it("addCard clamps objects that arrive outside the canvas (property 8)", () => {
    const s = applyCommand(stackOf(1), {
      type: "addCard", index: 1,
      card: { id: "c2", name: "", objects: [btn("o1", { x: 780, y: 590, w: 100, h: 100 })] },
    });
    const o = s.cards[1]?.objects[0];
    expect(o && o.x + o.w <= 800 && o.y + o.h <= 600).toBe(true);
  });

  it("chained relative moves are followed in order (property 7)", () => {
    // c5 --[prev, prev]--> rests on c3, never on c4.
    const s: Stack = { ...stackOf(5, { c5: [btn("b", { actions: [{ type: "prev" }, { type: "prev" }] })] }), start: "c5" };
    expect([...reachable(s)].sort()).toEqual(["c3", "c5"]);
  });
});
