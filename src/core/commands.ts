import { clampRect } from "./layout";
import { nextId, usedIds } from "./ids";
import type {
  Action, Asset, AssetId, Card, CardId, ObjectId, SimpleAction, Skin, Stack, StackObject, TextAlign,
} from "./types";

/** Editable fields of an object. Fields that do not apply to the object's kind are ignored. */
export interface ObjectPatch {
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly visible?: boolean;
  readonly text?: string;
  readonly fontSize?: number;
  readonly bold?: boolean;
  readonly align?: TextAlign;
  readonly label?: string;
  readonly alt?: string;
}

export type Command =
  | { readonly type: "setTitle"; readonly title: string }
  | { readonly type: "setSkin"; readonly skin: Skin }
  | { readonly type: "setStart"; readonly card: CardId }
  | { readonly type: "addAsset"; readonly id: AssetId; readonly asset: Asset }
  | { readonly type: "addCard"; readonly card: Card; readonly index: number }
  | { readonly type: "deleteCard"; readonly card: CardId }
  | { readonly type: "renameCard"; readonly card: CardId; readonly name: string }
  | { readonly type: "moveCard"; readonly card: CardId; readonly to: number }
  | { readonly type: "duplicateCard"; readonly card: CardId; readonly newId: CardId; readonly objectIds: Readonly<Record<ObjectId, ObjectId>> }
  | { readonly type: "addObject"; readonly card: CardId; readonly object: StackObject }
  | { readonly type: "deleteObject"; readonly object: ObjectId }
  | { readonly type: "updateObject"; readonly object: ObjectId; readonly patch: ObjectPatch }
  | { readonly type: "reorderObject"; readonly object: ObjectId; readonly to: number }
  | { readonly type: "setActions"; readonly object: ObjectId; readonly actions: readonly Action[] };

const clampIndex = (i: number, max: number): number => Math.min(max, Math.max(0, Math.trunc(Number.isFinite(i) ? i : 0)));

/** Rewrite every object's actions. `fn` returns null to drop an action. */
function rewriteActions(stack: Stack, fn: (a: SimpleAction) => SimpleAction | null): Stack {
  const simple = (list: readonly SimpleAction[]): SimpleAction[] =>
    list.flatMap((a) => { const r = fn(a); return r ? [r] : []; });
  const top = (list: readonly Action[]): Action[] =>
    list.flatMap((a): Action[] => {
      if (a.type === "if") return [{ ...a, then: simple(a.then), else: simple(a.else) }];
      const r = fn(a);
      return r ? [r] : [];
    });
  return {
    ...stack,
    cards: stack.cards.map((c) => ({
      ...c,
      objects: c.objects.map((o) => ({ ...o, actions: top(o.actions) })),
    })),
  };
}

function mapObject(stack: Stack, id: ObjectId, fn: (o: StackObject) => StackObject): Stack {
  return {
    ...stack,
    cards: stack.cards.map((c) =>
      c.objects.some((o) => o.id === id) ? { ...c, objects: c.objects.map((o) => (o.id === id ? fn(o) : o)) } : c),
  };
}

function patchObject(o: StackObject, p: ObjectPatch): StackObject {
  const g = { ...clampRect({ x: p.x ?? o.x, y: p.y ?? o.y, w: p.w ?? o.w, h: p.h ?? o.h }), visible: p.visible ?? o.visible };
  switch (o.kind) {
    case "text":
      return { ...o, ...g, text: p.text ?? o.text, fontSize: p.fontSize ?? o.fontSize, bold: p.bold ?? o.bold, align: p.align ?? o.align };
    case "image":
      return { ...o, ...g, alt: p.alt ?? o.alt };
    case "button":
      return { ...o, ...g, label: p.label ?? o.label };
  }
}

function duplicate(stack: Stack, cmd: Extract<Command, { type: "duplicateCard" }>): Stack {
  const i = stack.cards.findIndex((c) => c.id === cmd.card);
  const src = stack.cards[i];
  if (!src) return stack;
  const used = usedIds(stack);
  const newIds = src.objects.map((o) => cmd.objectIds[o.id]);
  const fresh = [cmd.newId, ...newIds];
  if (fresh.some((id) => id === undefined || used.has(id)) || new Set(fresh).size !== fresh.length) return stack;
  const remap = (a: SimpleAction): SimpleAction =>
    (a.type === "show" || a.type === "hide") && cmd.objectIds[a.object] !== undefined && src.objects.some((o) => o.id === a.object)
      ? { ...a, object: cmd.objectIds[a.object] as string }
      : a;
  const copy: Card = {
    id: cmd.newId,
    name: `${src.name} copy`,
    objects: src.objects.map((o) => ({
      ...o,
      id: cmd.objectIds[o.id] as string,
      actions: o.actions.map((a): Action =>
        a.type === "if" ? { ...a, then: a.then.map(remap), else: a.else.map(remap) } : remap(a)),
    })),
  };
  return { ...stack, cards: [...stack.cards.slice(0, i + 1), copy, ...stack.cards.slice(i + 1)] };
}

/** Allocate fresh ids for a duplicateCard command. Pure helper for the UI. */
export function planDuplicate(stack: Stack, card: CardId): Command | undefined {
  const src = stack.cards.find((c) => c.id === card);
  if (!src) return undefined;
  const used = usedIds(stack);
  const newId = nextId("c", used);
  used.add(newId);
  const objectIds: Record<ObjectId, ObjectId> = {};
  for (const o of src.objects) {
    const id = nextId("o", used);
    used.add(id);
    objectIds[o.id] = id;
  }
  return { type: "duplicateCard", card, newId, objectIds };
}

/**
 * Apply one edit. Pure and total: invalid commands (unknown ids, duplicate ids, deleting the last
 * card) return the SAME stack reference, so callers can detect no-ops with `===`.
 * Deleting a card or object removes every action that targeted it, so nothing dangles.
 */
export function applyCommand(stack: Stack, cmd: Command): Stack {
  switch (cmd.type) {
    case "setTitle":
      return cmd.title === stack.title ? stack : { ...stack, title: cmd.title };
    case "setSkin":
      return cmd.skin === stack.skin ? stack : { ...stack, skin: cmd.skin };
    case "setStart":
      return stack.cards.some((c) => c.id === cmd.card) && cmd.card !== stack.start ? { ...stack, start: cmd.card } : stack;
    case "addAsset":
      return Object.prototype.hasOwnProperty.call(stack.assets, cmd.id) || usedIds(stack).has(cmd.id)
        ? stack
        : { ...stack, assets: { ...stack.assets, [cmd.id]: cmd.asset } };
    case "addCard": {
      const used = usedIds(stack);
      const ids = [cmd.card.id, ...cmd.card.objects.map((o) => o.id)];
      if (ids.some((id) => used.has(id)) || new Set(ids).size !== ids.length) return stack;
      const at = clampIndex(cmd.index, stack.cards.length);
      const card = { ...cmd.card, objects: cmd.card.objects.map((o) => ({ ...o, ...clampRect(o) })) };
      return { ...stack, cards: [...stack.cards.slice(0, at), card, ...stack.cards.slice(at)] };
    }
    case "deleteCard": {
      if (stack.cards.length <= 1 || !stack.cards.some((c) => c.id === cmd.card)) return stack;
      const cards = stack.cards.filter((c) => c.id !== cmd.card);
      const first = cards[0];
      if (!first) return stack;
      const start = stack.start === cmd.card ? first.id : stack.start;
      const gone = new Set(stack.cards.find((c) => c.id === cmd.card)?.objects.map((o) => o.id));
      return rewriteActions({ ...stack, cards, start }, (a) =>
        (a.type === "goto" && a.card === cmd.card) ||
        ((a.type === "show" || a.type === "hide") && gone.has(a.object)) ? null : a);
    }
    case "renameCard":
      return stack.cards.some((c) => c.id === cmd.card && c.name !== cmd.name)
        ? { ...stack, cards: stack.cards.map((c) => (c.id === cmd.card ? { ...c, name: cmd.name } : c)) }
        : stack;
    case "moveCard": {
      const from = stack.cards.findIndex((c) => c.id === cmd.card);
      const moved = stack.cards[from];
      if (!moved) return stack;
      const to = clampIndex(cmd.to, stack.cards.length - 1);
      if (to === from) return stack;
      const rest = stack.cards.filter((_, i) => i !== from);
      return { ...stack, cards: [...rest.slice(0, to), moved, ...rest.slice(to)] };
    }
    case "duplicateCard":
      return duplicate(stack, cmd);
    case "addObject": {
      const used = usedIds(stack);
      if (used.has(cmd.object.id) || !stack.cards.some((c) => c.id === cmd.card)) return stack;
      const o = { ...cmd.object, ...clampRect(cmd.object) };
      return { ...stack, cards: stack.cards.map((c) => (c.id === cmd.card ? { ...c, objects: [...c.objects, o] } : c)) };
    }
    case "deleteObject": {
      if (!stack.cards.some((c) => c.objects.some((o) => o.id === cmd.object))) return stack;
      const removed = {
        ...stack,
        cards: stack.cards.map((c) => ({ ...c, objects: c.objects.filter((o) => o.id !== cmd.object) })),
      };
      return rewriteActions(removed, (a) =>
        (a.type === "show" || a.type === "hide") && a.object === cmd.object ? null : a);
    }
    case "updateObject": {
      const next = mapObject(stack, cmd.object, (o) => patchObject(o, cmd.patch));
      return JSON.stringify(next) === JSON.stringify(stack) ? stack : next;
    }
    case "reorderObject": {
      const card = stack.cards.find((c) => c.objects.some((o) => o.id === cmd.object));
      const from = card?.objects.findIndex((o) => o.id === cmd.object) ?? -1;
      const obj = card?.objects[from];
      if (!card || !obj) return stack;
      const to = clampIndex(cmd.to, card.objects.length - 1);
      if (to === from) return stack;
      const rest = card.objects.filter((_, i) => i !== from);
      const objects = [...rest.slice(0, to), obj, ...rest.slice(to)];
      return { ...stack, cards: stack.cards.map((c) => (c === card ? { ...c, objects } : c)) };
    }
    case "setActions":
      return stack.cards.some((c) => c.objects.some((o) => o.id === cmd.object))
        ? mapObject(stack, cmd.object, (o) => ({ ...o, actions: cmd.actions }))
        : stack;
  }
}

/** Undo/redo history. Commands are pure, so snapshots share structure and stay cheap. */
export interface History {
  readonly past: readonly Stack[];
  readonly present: Stack;
  readonly future: readonly Stack[];
}

export const MAX_UNDO = 200;

export const newHistory = (present: Stack): History => ({ past: [], present, future: [] });

export function exec(h: History, cmd: Command): History {
  const next = applyCommand(h.present, cmd);
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-MAX_UNDO), present: next, future: [] };
}

/** Apply several commands as ONE undo step (e.g. add an asset and the image that uses it). */
export function execBatch(h: History, cmds: readonly Command[]): History {
  const next = cmds.reduce(applyCommand, h.present);
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-MAX_UNDO), present: next, future: [] };
}

export function undo(h: History): History {
  const prev = h.past[h.past.length - 1];
  if (!prev) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (!next) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
}
