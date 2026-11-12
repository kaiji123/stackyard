import { allActions } from "../core/graph";
import type { Action, Cond, IfAction, SimpleAction, Stack, StackObject } from "../core/types";
import { h, type Child } from "./dom";
import type { Ctx } from "./ctx";

const LABELS: Readonly<Record<Action["type"], string>> = {
  goto: "Go to card…", next: "Go to next card", prev: "Go to previous card", back: "Go back",
  show: "Show object…", hide: "Hide object…", setFlag: "Set flag…", addItem: "Add item to inventory…",
  if: "If flag / item…",
};
const SIMPLE_TYPES: readonly SimpleAction["type"][] = ["goto", "next", "prev", "back", "show", "hide", "setFlag", "addItem"];

export function objectLabel(stack: Stack, o: StackObject): string {
  const card = stack.cards.find((c) => c.objects.some((x) => x.id === o.id));
  const what = o.kind === "button" ? o.label : o.kind === "text" ? o.text : o.alt || "picture";
  const short = what.length > 22 ? `${what.slice(0, 22)}…` : what;
  return `${card?.name ?? "?"}: ${o.kind} “${short.replace(/\s+/g, " ")}”`;
}

function select(options: readonly (readonly [string, string])[], value: string, onChange: (v: string) => void, cls = ""): HTMLSelectElement {
  const known = options.some(([v]) => v === value);
  return h("select", { class: cls, value, onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
    ...options.map(([v, label]) => h("option", { value: v }, label)),
    known ? null : h("option", { value }, `⚠ missing (${value})`));
}

function textInput(value: string, placeholder: string, onChange: (v: string) => void): HTMLInputElement {
  return h("input", { type: "text", value, placeholder, list: "sy-names", maxLength: 40, onchange: (e: Event) => onChange((e.target as HTMLInputElement).value.trim()) });
}

function defaultSimple(type: SimpleAction["type"], stack: Stack, self: StackObject): SimpleAction {
  switch (type) {
    case "goto": return { type, card: stack.cards[0]?.id ?? "" };
    case "show": case "hide": return { type, object: self.id };
    case "setFlag": return { type, flag: "flag", value: true };
    case "addItem": return { type, item: "item" };
    default: return { type };
  }
}

function simpleParams(a: SimpleAction, stack: Stack, set: (a: SimpleAction) => void): Child[] {
  switch (a.type) {
    case "goto":
      return [select(stack.cards.map((c) => [c.id, c.name || c.id] as const), a.card, (card) => set({ ...a, card }))];
    case "show": case "hide":
      return [select(stack.cards.flatMap((c) => c.objects).map((o) => [o.id, objectLabel(stack, o)] as const), a.object, (object) => set({ ...a, object }))];
    case "setFlag":
      return [
        textInput(a.flag, "flag name", (flag) => set({ ...a, flag })),
        select([["true", "on"], ["false", "off"]], String(a.value), (v) => set({ ...a, value: v === "true" })),
      ];
    case "addItem":
      return [textInput(a.item, "item name", (item) => set({ ...a, item }))];
    default:
      return [];
  }
}

function simpleList(list: readonly SimpleAction[], stack: Stack, self: StackObject, set: (l: SimpleAction[]) => void): HTMLElement {
  const replace = (i: number, a: SimpleAction): void => set(list.map((x, j) => (j === i ? a : x)));
  return h("div", { class: "alist" },
    ...list.map((a, i) => h("div", { class: "arow" },
      select(SIMPLE_TYPES.map((t) => [t, LABELS[t]] as const), a.type, (t) => replace(i, defaultSimple(t as SimpleAction["type"], stack, self))),
      ...simpleParams(a, stack, (n) => replace(i, n)),
      h("button", { class: "mini", title: "Remove", "aria-label": "Remove action", onclick: () => set(list.filter((_, j) => j !== i)) }, "✕"))),
    addPicker(SIMPLE_TYPES, stack, self, (a) => set([...list, a as SimpleAction])));
}

function addPicker(types: readonly Action["type"][], stack: Stack, self: StackObject, add: (a: Action) => void): HTMLElement {
  return h("select", {
    class: "add-picker", "aria-label": "Add action", value: "",
    onchange: (e: Event) => {
      const t = (e.target as HTMLSelectElement).value as Action["type"];
      if (!t) return;
      add(t === "if" ? { type: "if", cond: { flag: "flag" }, then: [], else: [] } : defaultSimple(t, stack, self));
    },
  }, h("option", { value: "" }, "＋ Add action"), ...types.map((t) => h("option", { value: t }, LABELS[t])));
}

function ifRow(a: IfAction, stack: Stack, self: StackObject, set: (a: IfAction) => void): HTMLElement {
  const kind = "flag" in a.cond ? "flag" : "item";
  const name = "flag" in a.cond ? a.cond.flag : a.cond.item;
  const cond = (k: string, n: string): Cond => (k === "flag" ? { flag: n } : { item: n });
  return h("div", { class: "if-block" },
    h("div", { class: "arow" }, h("b", null, "If"),
      select([["flag", "flag is on"], ["item", "has item"]], kind, (k) => set({ ...a, cond: cond(k, name) })),
      textInput(name, kind === "flag" ? "flag name" : "item name", (n) => set({ ...a, cond: cond(kind, n) }))),
    h("div", { class: "branch" }, h("span", { class: "tag" }, "then"),
      simpleList(a.then, stack, self, (then) => set({ ...a, then }))),
    h("div", { class: "branch" }, h("span", { class: "tag" }, "else"),
      simpleList(a.else, stack, self, (els) => set({ ...a, else: els }))));
}

/** Dropdown-only, no-code action list for one object. */
export function actionEditor(ctx: Ctx, obj: StackObject): HTMLElement {
  const stack = ctx.stack();
  const commit = (actions: readonly Action[]): void => ctx.dispatch({ type: "setActions", object: obj.id, actions });
  const list = obj.actions;
  const rows = list.map((a, i) => {
    const swap = (d: number): void => {
      const to = i + d;
      const target = list[to];
      if (!target) return;
      commit(list.map((x, j) => (j === i ? target : j === to ? a : x)));
    };
    const tools = h("div", { class: "row-tools" },
      h("button", { class: "mini", title: "Move up", "aria-label": "Move action up", disabled: i === 0, onclick: () => swap(-1) }, "↑"),
      h("button", { class: "mini", title: "Move down", "aria-label": "Move action down", disabled: i === list.length - 1, onclick: () => swap(1) }, "↓"),
      h("button", { class: "mini", title: "Remove", "aria-label": "Remove action", onclick: () => commit(list.filter((_, j) => j !== i)) }, "✕"));
    if (a.type === "if") {
      return h("div", { class: "action" }, ifRow(a, stack, obj, (n) => commit(list.map((x, j) => (j === i ? n : x)))), tools);
    }
    return h("div", { class: "action" },
      h("div", { class: "arow" },
        select((Object.keys(LABELS) as Action["type"][]).map((t) => [t, LABELS[t]] as const), a.type, (t) => {
          const type = t as Action["type"];
          commit(list.map((x, j) => (j === i ? (type === "if" ? { type: "if", cond: { flag: "flag" }, then: [], else: [] } : defaultSimple(type, stack, obj)) : x)));
        }),
        ...simpleParams(a, stack, (n) => commit(list.map((x, j) => (j === i ? n : x))))),
      tools);
  });
  return h("div", { class: "actions" },
    list.length === 0 ? h("p", { class: "hint" }, "Nothing happens when this is clicked. Add an action.") : null,
    ...rows,
    addPicker(Object.keys(LABELS) as Action["type"][], stack, obj, (a) => commit([...list, a])));
}

/** <datalist> of flag and item names already used, to avoid typos. */
export function namesDatalist(stack: Stack): HTMLElement {
  const names = new Set<string>();
  for (const { action } of allActions(stack)) {
    if (action.type === "setFlag") names.add(action.flag);
    if (action.type === "addItem") names.add(action.item);
  }
  for (const c of stack.cards) for (const o of c.objects) for (const a of o.actions) {
    if (a.type === "if") names.add("flag" in a.cond ? a.cond.flag : a.cond.item);
  }
  return h("datalist", { id: "sy-names" }, ...[...names].map((n) => h("option", { value: n })));
}
