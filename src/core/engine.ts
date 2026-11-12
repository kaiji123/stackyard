import type {
  Action, Card, Cond, ObjectId, SimpleAction, Stack, StackObject,
} from "./types";

/** Everything that changes while a stack is being played. Plain JSON, safe to persist. */
export interface PlayState {
  readonly card: string;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly items: readonly string[];
  /** Runtime show/hide overrides, keyed by object id. */
  readonly visibility: Readonly<Record<ObjectId, boolean>>;
  /** Cards we left via goto/next/prev, most recent last. Used by "back". */
  readonly history: readonly string[];
}

export const MAX_HISTORY = 100;

export function initState(stack: Stack): PlayState {
  return { card: stack.start, flags: {}, items: [], visibility: {}, history: [] };
}

export function findCard(stack: Stack, id: string): Card | undefined {
  return stack.cards.find((c) => c.id === id);
}

export function findObject(stack: Stack, id: string): StackObject | undefined {
  for (const c of stack.cards) {
    const o = c.objects.find((x) => x.id === id);
    if (o) return o;
  }
  return undefined;
}

export function isVisible(state: PlayState, obj: StackObject): boolean {
  return state.visibility[obj.id] ?? obj.visible;
}

export function evalCond(state: PlayState, cond: Cond): boolean {
  if ("flag" in cond) return state.flags[cond.flag] === true;
  return state.items.includes(cond.item);
}

function moveTo(state: PlayState, target: string): PlayState {
  if (target === state.card) return state;
  const history = [...state.history, state.card].slice(-MAX_HISTORY);
  return { ...state, card: target, history };
}

function runSimple(stack: Stack, state: PlayState, a: SimpleAction): PlayState {
  switch (a.type) {
    case "goto":
      return findCard(stack, a.card) ? moveTo(state, a.card) : state;
    case "next":
    case "prev": {
      const i = stack.cards.findIndex((c) => c.id === state.card);
      const t = stack.cards[i + (a.type === "next" ? 1 : -1)];
      return i >= 0 && t ? moveTo(state, t.id) : state;
    }
    case "back": {
      const target = state.history[state.history.length - 1];
      if (target === undefined) return state;
      return { ...state, card: target, history: state.history.slice(0, -1) };
    }
    case "show":
    case "hide":
      return findObject(stack, a.object)
        ? { ...state, visibility: { ...state.visibility, [a.object]: a.type === "show" } }
        : state;
    case "setFlag":
      return { ...state, flags: { ...state.flags, [a.flag]: a.value } };
    case "addItem":
      return state.items.includes(a.item) ? state : { ...state, items: [...state.items, a.item] };
  }
}

/** Run an ordered action list. Total: never throws, always terminates (no loops exist). */
export function runActions(stack: Stack, state: PlayState, actions: readonly Action[]): PlayState {
  let s = state;
  for (const a of actions) {
    if (a.type === "if") {
      const branch = evalCond(s, a.cond) ? a.then : a.else;
      for (const b of branch) s = runSimple(stack, s, b);
    } else {
      s = runSimple(stack, s, a);
    }
  }
  return s;
}

/** Objects the player currently sees and can click on the current card. */
export function visibleObjects(stack: Stack, state: PlayState): readonly StackObject[] {
  const card = findCard(stack, state.card);
  return card ? card.objects.filter((o) => isVisible(state, o)) : [];
}

/** Click an object on the current card. Hidden or unknown objects ignore clicks. */
export function click(stack: Stack, state: PlayState, objectId: ObjectId): PlayState {
  const obj = visibleObjects(stack, state).find((o) => o.id === objectId);
  return obj ? runActions(stack, state, obj.actions) : state;
}
