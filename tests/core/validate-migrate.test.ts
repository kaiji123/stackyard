import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { migrate, type Migration } from "../../src/core/migrate";
import { SCHEMA_VERSION } from "../../src/core/types";
import { validateStack } from "../../src/core/validate";
import { arbStack } from "../arbitraries";

describe("validateStack", () => {
  it("accepts every generated stack", () => {
    fc.assert(fc.property(arbStack, (s) => {
      const r = validateStack(JSON.parse(JSON.stringify(s)));
      expect(r.ok).toBe(true);
    }));
  });

  it("never throws on arbitrary JSON", () => {
    fc.assert(fc.property(fc.jsonValue(), (v) => {
      expect(() => validateStack(v)).not.toThrow();
    }));
  });

  it("rejects duplicate ids and a missing start card", () => {
    fc.assert(fc.property(arbStack, (s) => {
      const bad = { ...s, start: "nope" };
      expect(validateStack(bad).ok).toBe(false);
      const dupCard = { ...s, cards: [...s.cards, s.cards[0]] };
      expect(validateStack(dupCard).ok).toBe(false);
    }));
  });
});

describe("migrate", () => {
  // Property 6: idempotent.
  it("leaves a current document unchanged", () => {
    fc.assert(fc.property(arbStack, (s) => {
      const r = migrate(s);
      expect(r).toEqual({ ok: true, doc: s });
      if (r.ok) expect(migrate(r.doc)).toEqual(r);
    }));
  });

  it("upgrades older versions to a valid current document, once", () => {
    // Synthetic history: v0 documents named the start card "first" and had no assets.
    const migrations: Record<number, Migration> = {
      0: (d) => ({ ...d, start: d["first"], assets: {} }),
    };
    fc.assert(fc.property(arbStack, (s) => {
      const { start, assets: _assets, ...rest } = s;
      const old = { ...rest, schemaVersion: 0, first: start };
      const before = JSON.stringify(old);
      const r = migrate(old, migrations, 1);
      expect(JSON.stringify(old)).toBe(before);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.doc).toMatchObject({ schemaVersion: 1, start });
        expect(migrate(r.doc, migrations, 1)).toEqual(r);
      }
    }));
  });

  it("rejects newer, malformed and unmigratable documents without throwing", () => {
    fc.assert(fc.property(fc.jsonValue(), (v) => {
      expect(() => migrate(v)).not.toThrow();
    }));
    expect(migrate({ schemaVersion: SCHEMA_VERSION + 1 }).ok).toBe(false);
    expect(migrate({ schemaVersion: 0 }).ok).toBe(false);
    expect(migrate([]).ok).toBe(false);
  });
});
