import fc from "fast-check";
import type { Command } from "../src/core/commands";
import type {
  Action, Cond, SimpleAction, Stack, StackObject, TextAlign,
} from "../src/core/types";
import { CANVAS_H, CANVAS_W, SCHEMA_VERSION } from "../src/core/types";

/** Strings that have broken (or would break) HTML export and renderers. */
export const NASTY: readonly string[] = [
  "</script>",
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<!-- -->",
  "]]>",
  "\u2028\u2029",
  "😀👨‍👩‍👧‍👦",
  "שלום עולם \u202Eabc",
  "&amp; &lt; \"quotes\" 'single'",
  "\u0000\u0007",
  "__proto__",
  "",
];

export const arbText: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.string({ maxLength: 20 }) },
  { weight: 2, arbitrary: fc.constantFrom(...NASTY) },
  { weight: 1, arbitrary: fc.string({ unit: "grapheme", maxLength: 10 }) },
);

/** Names for flags/items. Excludes "__proto__" so plain objects stay safe as maps. */
export const arbFlagName: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom("hasKey", "lampOn", "door", "</script>", "k"),
  fc.string({ minLength: 1, maxLength: 6 }).filter((s) => s !== "__proto__"),
);

const arbAlign: fc.Arbitrary<TextAlign> = fc.constantFrom("left", "center", "right");

interface Ids {
  readonly cards: readonly string[];
  readonly objects: readonly string[];
}

const arbCond = (): fc.Arbitrary<Cond> =>
  fc.oneof(
    arbFlagName.map((flag): Cond => ({ flag })),
    arbFlagName.map((item): Cond => ({ item })),
  );

const arbSimple = (ids: Ids): fc.Arbitrary<SimpleAction> => {
  const options: fc.Arbitrary<SimpleAction>[] = [
    fc.constant({ type: "next" }),
    fc.constant({ type: "prev" }),
    fc.constant({ type: "back" }),
    fc.record({ type: fc.constant("setFlag" as const), flag: arbFlagName, value: fc.boolean() }),
    fc.record({ type: fc.constant("addItem" as const), item: arbFlagName }),
    fc.record({ type: fc.constant("goto" as const), card: fc.constantFrom(...ids.cards) }),
  ];
  if (ids.objects.length > 0) {
    options.push(
      fc.record({ type: fc.constant("show" as const), object: fc.constantFrom(...ids.objects) }),
      fc.record({ type: fc.constant("hide" as const), object: fc.constantFrom(...ids.objects) }),
    );
  }
  return fc.oneof(...options);
};

export const arbActions = (ids: Ids): fc.Arbitrary<Action[]> =>
  fc.array(
    fc.oneof(
      { weight: 4, arbitrary: arbSimple(ids) as fc.Arbitrary<Action> },
      {
        weight: 1,
        arbitrary: fc.record({
          type: fc.constant("if" as const),
          cond: arbCond(),
          then: fc.array(arbSimple(ids), { maxLength: 3 }),
          else: fc.array(arbSimple(ids), { maxLength: 3 }),
        }) as fc.Arbitrary<Action>,
      },
    ),
    { maxLength: 4 },
  );

const arbObject = (id: string, ids: Ids): fc.Arbitrary<StackObject> => {
  const geom = fc
    .record({
      w: fc.integer({ min: 16, max: CANVAS_W }),
      h: fc.integer({ min: 16, max: CANVAS_H }),
      fx: fc.double({ min: 0, max: 1, noNaN: true }),
      fy: fc.double({ min: 0, max: 1, noNaN: true }),
    })
    .map(({ w, h, fx, fy }) => ({
      w, h, x: Math.floor(fx * (CANVAS_W - w)), y: Math.floor(fy * (CANVAS_H - h)),
    }));
  const base = fc.record({ id: fc.constant(id), visible: fc.boolean(), actions: arbActions(ids) });
  return fc.oneof(
    fc.record({
      b: base, g: geom, text: arbText, fontSize: fc.integer({ min: 8, max: 72 }),
      bold: fc.boolean(), align: arbAlign,
    }).map(({ b, g, text, fontSize, bold, align }): StackObject =>
      ({ kind: "text", ...b, ...g, text, fontSize, bold, align })),
    fc.record({ b: base, g: geom, asset: fc.constantFrom("a0", "a1"), alt: arbText })
      .map(({ b, g, asset, alt }): StackObject => ({ kind: "image", ...b, ...g, asset, alt })),
    fc.record({ b: base, g: geom, label: arbText })
      .map(({ b, g, label }): StackObject => ({ kind: "button", ...b, ...g, label })),
  );
};

/** Random structurally valid stack. All ids unique; all action targets exist. */
export const arbStack: fc.Arbitrary<Stack> = fc
  .array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 5 })
  .chain((counts) => {
    const cardIds = counts.map((_, i) => `c${i + 1}`);
    const objIds = counts.map((n, i) => Array.from({ length: n }, (_, j) => `o${i + 1}_${j + 1}`));
    const ids: Ids = { cards: cardIds, objects: objIds.flat() };
    const cards = counts.map((_, i) =>
      fc.record({
        id: fc.constant(cardIds[i] as string),
        name: arbText,
        objects: fc.tuple(...(objIds[i] ?? []).map((id) => arbObject(id, ids))),
      }));
    return fc.record({
      schemaVersion: fc.constant(SCHEMA_VERSION),
      title: arbText,
      skin: fc.constantFrom("plain", "haunted"),
      start: fc.constantFrom(...cardIds),
      cards: fc.tuple(...cards),
      assets: fc.record({
        a0: fc.record({ mime: fc.constant("image/png"), data: fc.base64String({ maxLength: 24 }) }),
        a1: fc.record({ mime: fc.constant("image/webp"), data: fc.base64String({ maxLength: 24 }) }),
      }),
    });
  })
  .map((s): Stack => s as unknown as Stack);

/**
 * A command "seed" resolved against the CURRENT stack at run time, so long edit sequences keep
 * hitting real ids even after earlier edits deleted things.
 */
export interface CommandSeed {
  readonly kind: number;
  readonly a: number;
  readonly b: number;
  readonly text: string;
  readonly bool: boolean;
  readonly bad: boolean;
}

export const arbSeed: fc.Arbitrary<CommandSeed> = fc.record({
  kind: fc.integer({ min: 0, max: 13 }),
  a: fc.nat({ max: 50 }),
  b: fc.nat({ max: 50 }),
  text: arbText,
  bool: fc.boolean(),
  bad: fc.integer({ min: 0, max: 9 }).map((n) => n === 0),
});

export const arbSeeds: fc.Arbitrary<CommandSeed[]> = fc.array(arbSeed, { maxLength: 25 });

const pick = <T>(xs: readonly T[], n: number): T | undefined => xs[n % Math.max(1, xs.length)];

export function resolveSeed(stack: Stack, s: CommandSeed, fresh: number): Command {
  const cards = stack.cards;
  const objs = cards.flatMap((c) => c.objects);
  const card = s.bad ? "missing" : (pick(cards, s.a)?.id ?? "missing");
  const obj = s.bad ? "missing" : (pick(objs, s.a)?.id ?? "missing");
  const target = pick(objs, s.b)?.id ?? "missing";
  // New objects only reference things that exist: an existing card, and themselves.
  const mk = (id: string): StackObject => ({
    kind: "button", id, x: s.a * 20, y: s.b * 20, w: 100, h: 40,
    visible: true, label: s.text,
    actions: [{ type: "goto", card: pick(cards, s.b)?.id ?? "c1" }, { type: "show", object: id }],
  });
  const newObj = mk(`n${fresh}`);
  switch (s.kind) {
    case 0: return s.bool ? { type: "setTitle", title: s.text } : { type: "setSkin", skin: s.a % 2 === 0 ? "plain" : "haunted" };
    case 1: return { type: "setStart", card };
    case 2: return { type: "addCard", index: s.a % 7 - 1, card: { id: `n${fresh}`, name: s.text, objects: [mk(`n${fresh}o`)] } };
    case 3: return { type: "deleteCard", card };
    case 4: return { type: "renameCard", card, name: s.text };
    case 5: return { type: "moveCard", card, to: s.b % 7 - 1 };
    case 6: {
      const src = cards.find((c) => c.id === card);
      const objectIds = Object.fromEntries((src?.objects ?? []).map((o, i) => [o.id, `n${fresh}x${i}`]));
      return { type: "duplicateCard", card, newId: `n${fresh}`, objectIds };
    }
    case 7: return { type: "addObject", card, object: newObj };
    case 8: return { type: "deleteObject", object: obj };
    case 9: return { type: "updateObject", object: obj, patch: { x: s.a * 40 - 100, y: s.b * 40 - 100, w: s.a * 30, h: s.b * 30, visible: s.bool, label: s.text, text: s.text } };
    case 10: return { type: "reorderObject", object: obj, to: s.b % 6 - 1 };
    case 11: return { type: "setActions", object: obj, actions: [{ type: "if", cond: { flag: "k" }, then: [{ type: "goto", card: pick(cards, s.b)?.id ?? "c1" }], else: [{ type: "hide", object: target }] }] };
    case 12: return { type: "setActions", object: obj, actions: [{ type: "goto", card: s.bad ? "missing" : (pick(cards, s.b)?.id ?? "c1") }] };
    default: return { type: "setActions", object: obj, actions: [] };
  }
}
