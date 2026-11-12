import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyCommand, exec, newHistory, redo, undo, type History } from "../../src/core/commands";
import { dangling } from "../../src/core/graph";
import { usedIds } from "../../src/core/ids";
import { validateStack } from "../../src/core/validate";
import type { Stack } from "../../src/core/types";
import { CANVAS_H, CANVAS_W } from "../../src/core/types";
import { arbSeeds, arbStack, resolveSeed, type CommandSeed } from "../arbitraries";

/** Run seeds against a history, resolving each against the current stack. */
function run(start: Stack, seeds: readonly CommandSeed[], only?: (s: CommandSeed) => boolean): History {
  let h = newHistory(start);
  seeds.forEach((s, i) => {
    if (only && !only(s)) return;
    h = exec(h, resolveSeed(h.present, s, i));
  });
  return h;
}

const frozen = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe("commands", () => {
  it("never mutates its input (pure)", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      const before = frozen(stack);
      run(stack, seeds);
      expect(stack).toEqual(before);
    }));
  });

  it("keeps the stack structurally valid after any edit sequence", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      const r = validateStack(run(stack, seeds).present);
      expect(r.ok ? [] : r.errors).toEqual([]);
    }));
  });

  // Property 3: referential integrity.
  it("never leaves dangling goto/show/hide targets after edits that start valid", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      expect(dangling(stack)).toEqual([]);
      // "bad" seeds deliberately point at missing ids; the doctor must flag those (below).
      expect(dangling(run(stack, seeds, (s) => !s.bad).present)).toEqual([]);
    }));
  });

  it("the doctor flags every dangling target a bad edit introduces", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      const end = run(stack, seeds).present;
      const cards = new Set(end.cards.map((c) => c.id));
      const objs = new Set(end.cards.flatMap((c) => c.objects.map((o) => o.id)));
      const reported = new Set(dangling(end).map((d) => `${d.kind}:${d.target}`));
      for (const c of end.cards) for (const o of c.objects) for (const a of o.actions) {
        const flat = a.type === "if" ? [...a.then, ...a.else] : [a];
        for (const x of flat) {
          if (x.type === "goto" && !cards.has(x.card)) expect(reported).toContain(`card:${x.card}`);
          if ((x.type === "show" || x.type === "hide") && !objs.has(x.object)) expect(reported).toContain(`object:${x.object}`);
        }
      }
    }));
  });

  // Property 4: undo is an inverse.
  it("undo(exec(cmd)) returns the previous stack", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      let h = newHistory(stack);
      seeds.forEach((s, i) => {
        const before = h.present;
        const next = exec(h, resolveSeed(before, s, i));
        // A no-op command leaves history untouched, so there is nothing to invert.
        if (next !== h) expect(undo(next).present).toEqual(before);
        h = next;
      });
    }));
  });

  it("undoing everything then redoing everything is the identity", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      const done = run(stack, seeds);
      let h = done;
      while (h.past.length > 0) h = undo(h);
      expect(h.present).toEqual(stack);
      while (h.future.length > 0) h = redo(h);
      expect(h.present).toEqual(done.present);
    }));
  });

  // Property 8: layout stays inside the canvas.
  it("keeps every object inside the canvas after any edits", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      for (const c of run(stack, seeds).present.cards) for (const o of c.objects) {
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.x + o.w).toBeLessThanOrEqual(CANVAS_W);
        expect(o.y + o.h).toBeLessThanOrEqual(CANVAS_H);
      }
    }));
  });

  it("keeps ids unique", () => {
    fc.assert(fc.property(arbStack, arbSeeds, (stack, seeds) => {
      const end = run(stack, seeds).present;
      const all = [...end.cards.flatMap((c) => [c.id, ...c.objects.map((o) => o.id)])];
      expect(new Set(all).size).toBe(all.length);
      expect(usedIds(end).size).toBeGreaterThanOrEqual(all.length);
    }));
  });

  it("returns the same reference for no-op commands", () => {
    fc.assert(fc.property(arbStack, (stack) => {
      expect(applyCommand(stack, { type: "deleteCard", card: "nope" })).toBe(stack);
      expect(applyCommand(stack, { type: "deleteObject", object: "nope" })).toBe(stack);
      expect(applyCommand(stack, { type: "setTitle", title: stack.title })).toBe(stack);
    }));
  });

  it("never deletes the last card", () => {
    fc.assert(fc.property(arbStack, (stack) => {
      let s = stack;
      for (const c of stack.cards) s = applyCommand(s, { type: "deleteCard", card: c.id });
      expect(s.cards).toHaveLength(1);
      expect(s.cards.some((c) => c.id === s.start)).toBe(true);
    }));
  });
});
