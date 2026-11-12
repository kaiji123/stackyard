import { diagnose } from "../core/doctor";
import type { ObjectPatch } from "../core/commands";
import type { StackObject, TextAlign } from "../core/types";
import { CANVAS_H, CANVAS_W } from "../core/types";
import { actionEditor, namesDatalist } from "./actions";
import type { Ctx } from "./ctx";
import { h, type Child } from "./dom";

const field = (label: string, input: Child): HTMLElement => h("label", { class: "field" }, h("span", null, label), input);

function num(ctx: Ctx, o: StackObject, key: "x" | "y" | "w" | "h" | "fontSize", max: number): HTMLElement {
  return field(key === "fontSize" ? "size" : key, h("input", {
    type: "number", value: String(o[key as keyof StackObject] ?? ""), min: 0, max, step: 1,
    onchange: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (Number.isFinite(v)) ctx.dispatch({ type: "updateObject", object: o.id, patch: { [key]: Math.round(v) } satisfies ObjectPatch });
    },
  }));
}

function objectPanel(ctx: Ctx, o: StackObject): HTMLElement {
  const patch = (p: ObjectPatch): void => ctx.dispatch({ type: "updateObject", object: o.id, patch: p });
  const objs = ctx.card().objects;
  const z = objs.findIndex((x) => x.id === o.id);
  const textBits: Child[] = [];
  if (o.kind === "text") {
    textBits.push(
      field("text", h("textarea", { rows: 4, value: o.text, onchange: (e: Event) => patch({ text: (e.target as HTMLTextAreaElement).value }) })),
      h("div", { class: "grid2" },
        num(ctx, o, "fontSize", 120),
        field("align", h("select", { value: o.align, onchange: (e: Event) => patch({ align: (e.target as HTMLSelectElement).value as TextAlign }) },
          h("option", { value: "left" }, "left"), h("option", { value: "center" }, "center"), h("option", { value: "right" }, "right")))),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: o.bold, onchange: (e: Event) => patch({ bold: (e.target as HTMLInputElement).checked }) }), " bold"));
  } else if (o.kind === "button") {
    textBits.push(field("label", h("input", { type: "text", value: o.label, onchange: (e: Event) => patch({ label: (e.target as HTMLInputElement).value }) })));
  } else {
    textBits.push(field("alt text", h("input", { type: "text", value: o.alt, placeholder: "describe the picture", onchange: (e: Event) => patch({ alt: (e.target as HTMLInputElement).value }) })));
  }
  const zb = (label: string, title: string, to: number): HTMLElement =>
    h("button", { class: "tool", title, "aria-label": title, onclick: () => ctx.dispatch({ type: "reorderObject", object: o.id, to }) }, label);
  return h("section", null,
    h("h3", null, `Selected ${o.kind}`),
    ...textBits,
    h("div", { class: "grid4" }, num(ctx, o, "x", CANVAS_W), num(ctx, o, "y", CANVAS_H), num(ctx, o, "w", CANVAS_W), num(ctx, o, "h", CANVAS_H)),
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: o.visible, onchange: (e: Event) => patch({ visible: (e.target as HTMLInputElement).checked }) }), " visible at start"),
    h("div", { class: "row" },
      zb("⤒", "Bring to front", objs.length - 1), zb("↑", "Bring forward", z + 1), zb("↓", "Send backward", z - 1), zb("⤓", "Send to back", 0),
      h("button", { class: "tool danger", onclick: () => ctx.dispatch({ type: "deleteObject", object: o.id }) }, "Delete")),
    h("h3", null, "When clicked"),
    actionEditor(ctx, o));
}

export function renderInspector(ctx: Ctx): HTMLElement {
  const stack = ctx.stack();
  const card = ctx.card();
  const sel = ctx.sel();
  const issues = diagnose(stack);
  const mark = { error: "⛔", warning: "⚠", info: "ℹ" } as const;
  return h("div", { class: "inspect" },
    namesDatalist(stack),
    h("section", null,
      h("h3", null, "Stack"),
      field("look", h("select", { value: stack.skin, onchange: (e: Event) => ctx.dispatch({ type: "setSkin", skin: (e.target as HTMLSelectElement).value === "haunted" ? "haunted" : "plain" }) },
        h("option", { value: "plain" }, "Plain index card"), h("option", { value: "haunted" }, "Haunted (flicker + ghost trail)")))),
    h("section", null,
      h("h3", null, "Card"),
      field("name", h("input", { type: "text", value: card.name, onchange: (e: Event) => ctx.dispatch({ type: "renameCard", card: card.id, name: (e.target as HTMLInputElement).value }) })),
      h("label", { class: "check" }, h("input", { type: "radio", name: "start", checked: stack.start === card.id, onchange: () => ctx.dispatch({ type: "setStart", card: card.id }) }), " start card")),
    sel ? objectPanel(ctx, sel) : h("section", null, h("h3", null, "Nothing selected"),
      h("p", { class: "hint" }, "Click an object on the card, or add Text, a Button or an Image from the top bar. Drag to move, drag the corners to resize.")),
    h("section", null,
      h("h3", null, `Stack doctor (${issues.filter((i) => i.severity !== "info").length})`),
      issues.length === 0 ? h("p", { class: "hint" }, "✔ Nothing to fix.") : h("ul", { class: "issues" },
        ...issues.map((i) => h("li", { class: i.severity }, h("button", {
          class: "link", onclick: () => { if (i.card) ctx.selectCard(i.card); if (i.object) ctx.selectObject(i.object); },
        }, `${mark[i.severity]} ${i.message}`))))));
}
