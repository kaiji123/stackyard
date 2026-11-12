import type { Action, CardId, ObjectId, SimpleAction, Stack } from "./types";

function* flatten(actions: readonly Action[]): Generator<SimpleAction> {
  for (const a of actions) {
    if (a.type === "if") {
      yield* a.then;
      yield* a.else;
    } else {
      yield a;
    }
  }
}

/** Every simple action in the stack (both branches of `if`), with the card it lives on. */
export function* allActions(stack: Stack): Generator<{ card: CardId; object: ObjectId; action: SimpleAction }> {
  for (const c of stack.cards) {
    for (const o of c.objects) {
      for (const action of flatten(o.actions)) yield { card: c.id, object: o.id, action };
    }
  }
}

/**
 * Static card-to-card edges: where a click on an object can leave the player.
 * Actions are followed in order (so `prev, prev` moves two cards), and both branches of an `if`
 * are explored. Intermediate cards of a multi-step click are not edges because the player never
 * rests on them. `back` is dynamic (depends on history) and is treated as "stay".
 */
export function edges(stack: Stack): ReadonlyMap<CardId, ReadonlySet<CardId>> {
  const index = new Map(stack.cards.map((c, i) => [c.id, i] as const));
  const out = new Map<CardId, Set<CardId>>(stack.cards.map((c) => [c.id, new Set<CardId>()]));
  const step = (pos: ReadonlySet<CardId>, a: SimpleAction): Set<CardId> => {
    const next = new Set<CardId>();
    for (const p of pos) {
      const i = index.get(p) ?? -1;
      if (a.type === "goto") { if (index.has(a.card)) next.add(a.card); else next.add(p); }
      else if (a.type === "next") next.add(stack.cards[i + 1]?.id ?? p);
      else if (a.type === "prev") next.add(stack.cards[i - 1]?.id ?? p);
      else next.add(p);
    }
    return next;
  };
  const runList = (pos: ReadonlySet<CardId>, list: readonly Action[]): Set<CardId> => {
    let cur = new Set(pos);
    for (const a of list) {
      if (a.type === "if") {
        cur = new Set([...a.then.reduce(step, cur), ...a.else.reduce(step, cur)]);
      } else {
        cur = step(cur, a);
      }
    }
    return cur;
  };
  for (const c of stack.cards) {
    for (const o of c.objects) {
      for (const end of runList(new Set([c.id]), o.actions)) {
        if (end !== c.id) out.get(c.id)?.add(end);
      }
    }
  }
  return out;
}

/** Cards statically reachable from the start card (breadth-first). */
export function reachable(stack: Stack): ReadonlySet<CardId> {
  const g = edges(stack);
  const seen = new Set<CardId>([stack.start]);
  const queue: CardId[] = [stack.start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === undefined) continue;
    for (const n of g.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

export interface Dangling {
  readonly card: CardId;
  readonly object: ObjectId;
  readonly kind: "card" | "object";
  readonly target: string;
}

/** Actions whose goto/show/hide target no longer exists. Nothing dangles silently. */
export function dangling(stack: Stack): readonly Dangling[] {
  const cards = new Set(stack.cards.map((c) => c.id));
  const objects = new Set(stack.cards.flatMap((c) => c.objects.map((o) => o.id)));
  const out: Dangling[] = [];
  for (const { card, object, action } of allActions(stack)) {
    if (action.type === "goto" && !cards.has(action.card)) {
      out.push({ card, object, kind: "card", target: action.card });
    } else if ((action.type === "show" || action.type === "hide") && !objects.has(action.object)) {
      out.push({ card, object, kind: "object", target: action.object });
    }
  }
  return out;
}
