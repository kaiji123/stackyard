import { planDuplicate } from "../core/commands";
import { nextId, usedIds } from "../core/ids";
import type { Card, Stack } from "../core/types";
import { renderObject } from "../player/player";
import type { Ctx } from "./ctx";
import { h } from "./dom";

export function thumbnail(stack: Stack, card: Card): HTMLElement {
  const stage = h("div", { class: "sy-stage thumb-stage" });
  for (const o of card.objects) if (o.visible) stage.append(renderObject(stack, o));
  return h("div", { class: "thumb" }, stage);
}

/** Thumbnail strip plus create / duplicate / delete / reorder. */
export function renderStrip(ctx: Ctx): HTMLElement {
  const stack = ctx.stack();
  const cur = ctx.card();
  const idx = stack.cards.findIndex((c) => c.id === cur.id);
  const add = (): void => {
    const used = usedIds(stack);
    const id = nextId("c", used);
    ctx.dispatch({ type: "addCard", index: idx + 1, card: { id, name: `Card ${stack.cards.length + 1}`, objects: [] } });
    ctx.selectCard(id);
  };
  const dup = (): void => {
    const cmd = planDuplicate(stack, cur.id);
    if (cmd && cmd.type === "duplicateCard") { ctx.dispatch(cmd); ctx.selectCard(cmd.newId); }
  };
  const del = (): void => {
    if (stack.cards.length > 1 && confirm(`Delete “${cur.name}”? Buttons that led to it lose that action.`)) {
      ctx.dispatch({ type: "deleteCard", card: cur.id });
    }
  };
  const tool = (label: string, title: string, fn: () => void, disabled = false): HTMLElement =>
    h("button", { class: "tool", title, "aria-label": title, disabled, onclick: fn }, label);
  return h("div", { class: "strip" },
    h("div", { class: "strip-tools" },
      tool("＋", "Add card", add), tool("⧉", "Duplicate card", dup),
      tool("↑", "Move card up", () => ctx.dispatch({ type: "moveCard", card: cur.id, to: idx - 1 }), idx === 0),
      tool("↓", "Move card down", () => ctx.dispatch({ type: "moveCard", card: cur.id, to: idx + 1 }), idx === stack.cards.length - 1),
      tool("🗑", "Delete card", del, stack.cards.length <= 1)),
    h("div", { class: "cards", role: "list" },
      ...stack.cards.map((c, i) => h("button", {
        class: `card-item${c.id === cur.id ? " active" : ""}`, role: "listitem",
        "aria-current": c.id === cur.id ? "true" : null, onclick: () => ctx.selectCard(c.id),
      }, thumbnail(stack, c), h("span", { class: "card-name" }, `${i + 1}. ${c.id === stack.start ? "★ " : ""}${c.name}`)))));
}
