import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { match, normalize, searchDoc, type SearchDoc } from "../src/editor/search";
import type { Stack } from "../src/core/types";
import { arbStack } from "./arbitraries";

const doc = (head: string, cards: [string, string][] = []): SearchDoc => ({
  head: normalize(head), cards: cards.map(([name, text]) => ({ name, text: normalize(`${name} ${text}`) })),
});

describe("stack search", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalize("Mrs. PELL's Café")).toBe("mrs pell s cafe");
    expect(match(doc("The Midnight Train"), "MIDNIGHT").ok).toBe(true);
    expect(match(doc("Café crème"), "cafe creme").ok).toBe(true);
  });

  it("needs every word, and matches the start of words", () => {
    const d = doc("Haunted House Escape Room");
    expect(match(d, "haunt esc").ok).toBe(true);
    expect(match(d, "haunted train").ok).toBe(false);
    expect(match(d, "ouse").ok).toBe(false); // not the middle of a word
  });

  it("finds words inside the stack and says which card", () => {
    const d = doc("The Midnight Train", [["Platform 13", "missed the bus"], ["Biscuit", "a ghost dog"]]);
    expect(match(d, "dog")).toEqual({ ok: true, card: "Biscuit" });
    expect(match(d, "train dog")).toEqual({ ok: true, card: "Biscuit" });
    expect(match(d, "train")).toEqual({ ok: true }); // found on the tile itself: no card hint
    // A card named after the word wins over an earlier card that only mentions it.
    const wiki = doc("Bestiary", [["A to Z", "kitsune bat owl"], ["Kitsune", "a fox spirit"]]);
    expect(match(wiki, "kitsune")).toEqual({ ok: true, card: "Kitsune" });
  });

  it("an empty or blank query matches every stack", () => {
    fc.assert(fc.property(arbStack, fc.constantFrom("", "   ", "...", "\u2028"), (s, q) => {
      expect(match(searchDoc(s, "x", "y", []), q).ok).toBe(true);
    }));
  });

  it("any word taken from a stack's own text finds that stack, and never throws", () => {
    fc.assert(fc.property(arbStack, fc.string({ maxLength: 20 }), (s: Stack, q) => {
      const d = searchDoc(s, "label", "blurb", ["tag"]);
      expect(() => match(d, q)).not.toThrow();
      const some = d.cards.flatMap((c) => c.text.split(" ")).find(Boolean);
      if (some) expect(match(d, some).ok).toBe(true);
    }));
  });
});
