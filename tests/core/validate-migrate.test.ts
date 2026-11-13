import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrate, type Migration } from "../../src/core/migrate";
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

describe("real migrations", () => {
  it("v1 documents gain a plain skin and validate as the current version", () => {
    fc.assert(fc.property(arbStack, (s) => {
      const { skin: _skin, ...rest } = s;
      const v1 = JSON.parse(JSON.stringify({ ...rest, schemaVersion: 1 }));
      const before = JSON.stringify(v1);
      const r = migrate(v1);
      expect(JSON.stringify(v1)).toBe(before); // input untouched
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.doc).toMatchObject({ schemaVersion: SCHEMA_VERSION, skin: "plain" });
        expect(validateStack(r.doc).ok).toBe(true);
        expect(migrate(r.doc)).toEqual(r); // idempotent
      }
    }));
  });

  it("has a migration for every version below the current one", () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf("function");
  });
});

describe("v2 -> v3 migration (text tone, image crisp)", () => {
  it("fills in tone=dark and crisp=false, validates, keeps everything else, and is idempotent", () => {
    fc.assert(fc.property(arbStack, (s) => {
      // Rebuild what a real v2 file looked like: no tone on text, no crisp on images.
      const v2 = JSON.parse(JSON.stringify({
        ...s, schemaVersion: 2,
        cards: s.cards.map((c) => ({ ...c, objects: c.objects.map((o) => {
          if (o.kind === "text") { const { tone: _t, ...rest } = o; return rest; }
          if (o.kind === "image") { const { crisp: _c, ...rest } = o; return rest; }
          return o;
        }) })),
      }));
      const before = JSON.stringify(v2);
      const r = migrate(v2);
      expect(JSON.stringify(v2)).toBe(before); // input untouched
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const v = validateStack(r.doc);
      expect(v.ok).toBe(true);
      if (v.ok) {
        for (const [i, c] of v.stack.cards.entries()) for (const [j, o] of c.objects.entries()) {
          const orig = s.cards[i]?.objects[j];
          if (o.kind === "text") expect(o.tone).toBe("dark");
          if (o.kind === "image") expect(o.crisp).toBe(false);
          expect(o.id).toBe(orig?.id);
        }
      }
      expect(migrate(r.doc)).toEqual(r);
    }));
  });

  it("does not overwrite values a v3-shaped object already has", () => {
    const doc = { schemaVersion: 2, title: "t", skin: "plain", start: "c1", assets: {}, cards: [{ id: "c1", name: "n", objects: [{ kind: "text", tone: "panel" }, { kind: "image", crisp: true }] }] };
    const r = migrate(doc);
    expect(r.ok && JSON.stringify(r.doc)).toContain('"tone":"panel"');
    expect(r.ok && JSON.stringify(r.doc)).toContain('"crisp":true');
  });
});

describe("v3 -> v4 migration (object motion)", () => {
  it("gives every object motion 'none', validates, keeps everything else, and is idempotent", () => {
    fc.assert(fc.property(arbStack, (s) => {
      const v3 = JSON.parse(JSON.stringify({
        ...s, schemaVersion: 3,
        cards: s.cards.map((c) => ({ ...c, objects: c.objects.map(({ motion: _m, ...rest }) => rest) })),
      }));
      const before = JSON.stringify(v3);
      const r = migrate(v3);
      expect(JSON.stringify(v3)).toBe(before);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const v = validateStack(r.doc);
      expect(v.ok).toBe(true);
      if (v.ok) for (const c of v.stack.cards) for (const o of c.objects) expect(o.motion).toBe("none");
      expect(migrate(r.doc)).toEqual(r);
    }));
  });

  it("a v1 stack migrates all the way to v4", () => {
    const v1 = { schemaVersion: 1, title: "old", start: "c1", assets: {}, cards: [{ id: "c1", name: "A", objects: [
      { kind: "text", id: "t", x: 0, y: 0, w: 100, h: 40, visible: true, actions: [], text: "hi", fontSize: 20, bold: false, align: "left" },
    ] }] };
    const r = migrate(v1);
    expect(r.ok && validateStack(r.doc).ok).toBe(true);
    expect(r.ok && JSON.stringify(r.doc)).toContain('"motion":"none"');
  });

  it("rejects an unknown motion", () => {
    fc.assert(fc.property(arbStack, (s) => {
      const first = s.cards.find((c) => c.objects.length > 0);
      if (!first) return;
      const bad = { ...s, cards: s.cards.map((c) => (c === first ? { ...c, objects: [{ ...c.objects[0]!, motion: "teleport" }, ...c.objects.slice(1)] } : c)) };
      expect(validateStack(bad).ok).toBe(false);
    }));
  });
});
