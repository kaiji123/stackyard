import { applyCommand, planDuplicate } from "../core/commands";
import { allActions, reachable } from "../core/graph";
import { nextId, usedIds } from "../core/ids";
import type { Card, Stack } from "../core/types";
import { renderObject } from "../player/player";
import type { Ctx } from "./ctx";
import { modal } from "./dialogs";
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
    if (stack.cards.length <= 1) return;
    const name = (id: string): string => stack.cards.find((c) => c.id === id)?.name || id;
    // Buttons elsewhere that lead to this card.
    const inbound = [...allActions(stack)].filter(({ card, action }) => action.type === "goto" && action.card === cur.id && card !== cur.id);
    const owners = [...new Map(inbound.map((x) => [x.object, x])).values()];
    const label = (obj: string): string => {
      const o = stack.cards.flatMap((c) => c.objects).find((x) => x.id === obj);
      return o?.kind === "button" ? o.label : o?.kind === "text" ? "text" : "picture";
    };

    // Predict the damage for the chosen option so the user decides with the facts in front of them.
    const impact = (redirect: string): string => {
      const after = redirect ? applyCommand(applyCommand(stack, { type: "retargetLinks", from: cur.id, to: redirect }), { type: "deleteCard", card: cur.id })
        : applyCommand(stack, { type: "deleteCard", card: cur.id });
      const was = reachable(stack), now = reachable(after);
      const lost = stack.cards.filter((c) => c.id !== cur.id && was.has(c.id) && !now.has(c.id));
      const wasEmpty = new Set(stack.cards.flatMap((c) => c.objects).filter((o) => o.kind === "button" && o.actions.length === 0).map((o) => o.id));
      const dead = after.cards.flatMap((c) => c.objects).filter((o) => o.kind === "button" && o.actions.length === 0 && !wasEmpty.has(o.id));
      const bits: string[] = [];
      if (dead.length) bits.push(`${dead.length} button${dead.length === 1 ? "" : "s"} will do nothing`);
      if (lost.length) bits.push(`${lost.length} card${lost.length === 1 ? "" : "s"} will become unreachable: ${lost.map((c) => c.name).join(", ")}`);
      return bits.length ? `Result: ${bits.join("; ")}.` : "Result: nothing else breaks.";
    };

    const result = h("p", { class: "impact", role: "status" }, impact(""));
    const pick = h("select", { "aria-label": "Send those buttons to", onchange: () => { result.textContent = impact(pick.value); } },
      h("option", { value: "" }, "Nowhere (remove those actions)"),
      ...stack.cards.filter((c) => c.id !== cur.id).map((c) => h("option", { value: c.id }, name(c.id))));
    modal(`Delete “${cur.name}”?`, [
      owners.length === 0
        ? h("p", null, "Nothing links to this card.")
        : h("div", null,
          h("p", null, `${owners.length} button${owners.length === 1 ? "" : "s"} or object${owners.length === 1 ? "" : "s"} lead here:`),
          h("ul", { class: "links" }, ...owners.map((x) => h("li", null, `${name(x.card)} → “${label(x.object)}”`))),
          h("label", { class: "field" }, h("span", null, "Send those buttons to"), pick)),
      result,
      h("p", { class: "hint" }, "You can undo this with Ctrl+Z."),
    ], [
      { label: "Cancel", focus: true },
      { label: "Delete card", primary: true, run: () => {
        const to = pick.value;
        ctx.batch(to ? [{ type: "retargetLinks", from: cur.id, to }, { type: "deleteCard", card: cur.id }] : [{ type: "deleteCard", card: cur.id }]);
      } },
    ]);
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
