import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { click, initState, runActions, visibleObjects, type PlayState } from "../../src/core/engine";
import { edges, reachable } from "../../src/core/graph";
import type { Stack } from "../../src/core/types";
import { arbStack } from "../arbitraries";

/** Explore every card the player can really reach by clicking, over full play states. */
function exploreReachable(stack: Stack, limit = 400): Set<string> {
  const cards = new Set<string>();
  const seen = new Set<string>();
  const queue: PlayState[] = [initState(stack)];
  while (queue.length > 0 && seen.size < limit) {
    const s = queue.shift() as PlayState;
    const key = JSON.stringify([s.card, s.flags, s.items, s.visibility]);
    if (seen.has(key)) continue;
    seen.add(key);
    cards.add(s.card);
    for (const o of visibleObjects(stack, s)) queue.push(click(stack, s, o.id));
  }
  return cards;
}

/** `back` depends on history, so static analysis treats it as "stay"; tests compare without it. */
function withoutBack(stack: Stack): Stack {
  const keep = <T extends { type: string }>(xs: readonly T[]): T[] => xs.filter((a) => a.type !== "back");
  return {
    ...stack,
    cards: stack.cards.map((c) => ({
      ...c,
      objects: c.objects.map((o) => ({
        ...o,
        actions: keep(o.actions).map((a) => (a.type === "if" ? { ...a, then: keep(a.then), else: keep(a.else) } : a)),
      })),
    })),
  };
}

describe("engine", () => {
  // Property 5: the player never crashes.
  it("a random walk of clicks never throws and never lands on a missing card", () => {
    fc.assert(fc.property(arbStack, fc.array(fc.nat(), { maxLength: 60 }), (stack, picks) => {
      let s = initState(stack);
      for (const p of picks) {
        const visible = visibleObjects(stack, s);
        const o = visible[p % Math.max(1, visible.length)];
        s = o ? click(stack, s, o.id) : click(stack, s, "nope");
        expect(stack.cards.some((c) => c.id === s.card)).toBe(true);
      }
    }));
  });

  it("does not mutate the stack or the previous state", () => {
    fc.assert(fc.property(arbStack, (stack) => {
      const before = JSON.stringify(stack);
      const s0 = initState(stack);
      const s0json = JSON.stringify(s0);
      for (const o of visibleObjects(stack, s0)) click(stack, s0, o.id);
      expect(JSON.stringify(stack)).toBe(before);
      expect(JSON.stringify(s0)).toBe(s0json);
    }));
  });

  // Property 7: graph analysis agrees with play (soundness: play never leaves static reachability).
  it("every card the player can reach is statically reachable", () => {
    fc.assert(fc.property(arbStack, (raw) => {
      const stack = withoutBack(raw);
      const staticSet = reachable(stack);
      for (const c of exploreReachable(stack)) expect(staticSet.has(c)).toBe(true);
    }));
  });

  it("static reachability is an over-approximation that equals play when no conditions or hiding exist", () => {
    fc.assert(fc.property(arbStack, (stack) => {
      // Strip conditions, hiding and back, and make everything visible: then every click is
      // available and static reachability must equal what play can reach.
      const open: Stack = {
        ...stack,
        cards: stack.cards.map((c) => ({
          ...c,
          objects: c.objects.map((o) => ({
            ...o,
            visible: true,
            actions: o.actions.flatMap((a) => (a.type === "if" || a.type === "hide" || a.type === "back" ? [] : [a])),
          })),
        })),
      };
      expect([...exploreReachable(open)].sort()).toEqual([...reachable(open)].sort());
    }));
  });

  it("graph edges only point at existing cards", () => {
    fc.assert(fc.property(arbStack, (stack) => {
      const ids = new Set(stack.cards.map((c) => c.id));
      for (const [from, tos] of edges(stack)) {
        expect(ids.has(from)).toBe(true);
        for (const t of tos) expect(ids.has(t)).toBe(true);
      }
    }));
  });

  it("if-branches follow flags and items", () => {
    const stack: Stack = {
      schemaVersion: 1, title: "t", start: "c1", assets: {},
      cards: [
        { id: "c1", name: "a", objects: [] },
        { id: "c2", name: "b", objects: [] },
      ],
    };
    const prog = [{ type: "if", cond: { item: "key" }, then: [{ type: "goto", card: "c2" }], else: [{ type: "setFlag", flag: "locked", value: true }] }] as const;
    const without = runActions(stack, initState(stack), prog);
    expect(without.card).toBe("c1");
    expect(without.flags["locked"]).toBe(true);
    const withKey = runActions(stack, runActions(stack, initState(stack), [{ type: "addItem", item: "key" }]), prog);
    expect(withKey.card).toBe("c2");
    expect(runActions(stack, withKey, [{ type: "back" }]).card).toBe("c1");
  });
});
