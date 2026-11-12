import { diagnose } from "../core/doctor";
import { edges, reachable } from "../core/graph";
import type { CardId } from "../core/types";
import type { Ctx } from "./ctx";
import { h, s } from "./dom";

const NW = 150, NH = 56, GX = 90, GY = 40, PAD = 32;

/** Node graph of cards and the links between them. Unreachable cards are red, dead ends amber. */
export function renderMap(ctx: Ctx): HTMLElement {
  const stack = ctx.stack();
  const g = edges(stack);
  const seen = reachable(stack);
  const depth = new Map<CardId, number>([[stack.start, 0]]);
  const queue: CardId[] = [stack.start];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i] as CardId;
    for (const n of g.get(c) ?? []) {
      if (!depth.has(n)) { depth.set(n, (depth.get(c) ?? 0) + 1); queue.push(n); }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  for (const c of stack.cards) if (!depth.has(c.id)) depth.set(c.id, maxDepth + 1);

  const rows = new Map<number, number>();
  const pos = new Map<CardId, { x: number; y: number }>();
  for (const c of stack.cards) {
    const d = depth.get(c.id) ?? 0;
    const r = rows.get(d) ?? 0;
    rows.set(d, r + 1);
    pos.set(c.id, { x: PAD + d * (NW + GX), y: PAD + r * (NH + GY) });
  }
  const cols = Math.max(...depth.values()) + 1;
  const width = PAD * 2 + cols * NW + (cols - 1) * GX;
  const height = PAD * 2 + Math.max(...rows.values()) * (NH + GY);

  const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Stack map" },
    s("defs", null, s("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
      s("path", { d: "M0,0 L10,5 L0,10 z", fill: "#b79cff" }))));
  for (const [from, tos] of g) {
    for (const to of tos) {
      const a = pos.get(from), b = pos.get(to);
      if (!a || !b) continue;
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
      const back = x2 <= x1;
      const d = back
        ? `M${a.x + NW / 2},${a.y + NH} C${a.x + NW / 2},${a.y + NH + 60} ${b.x + NW / 2},${b.y - 60} ${b.x + NW / 2},${b.y}`
        : `M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2},${y2}`;
      svg.append(s("path", { d, fill: "none", stroke: "#b79cff", "stroke-width": 2, "marker-end": "url(#arrow)" }));
    }
  }
  for (const [i, c] of stack.cards.entries()) {
    const p = pos.get(c.id);
    if (!p) continue;
    const dead = seen.has(c.id) && (g.get(c.id)?.size ?? 0) === 0 && stack.cards.length > 1;
    const cls = !seen.has(c.id) ? "node bad" : dead ? "node dead" : "node";
    const name = c.name.length > 20 ? `${c.name.slice(0, 19)}…` : c.name;
    const node = s("g", { class: `${cls}${c.id === ctx.card().id ? " cur" : ""}`, tabindex: 0, role: "button", "aria-label": `Open card ${c.name}`,
      onclick: () => { ctx.selectCard(c.id); ctx.setMode("edit"); },
      onkeydown: (e: Event) => { if ((e as KeyboardEvent).key === "Enter") { ctx.selectCard(c.id); ctx.setMode("edit"); } } },
      s("rect", { x: p.x, y: p.y, width: NW, height: NH, rx: 0 }),
      s("text", { x: p.x + 10, y: p.y + 24 }, `${i + 1}. ${c.id === stack.start ? "★ " : ""}${name}`),
      s("text", { x: p.x + 10, y: p.y + 44, class: "sub" }, !seen.has(c.id) ? "unreachable" : dead ? "no way out" : `${c.objects.length} objects`));
    svg.append(node);
  }

  const issues = diagnose(stack);
  return h("div", { class: "work-map" },
    h("p", { class: "hint" }, stack.cards.length < 2 ? "Add a second card, then give a button a “Go to card…” action. Arrows will appear here." : "Arrows show where buttons lead. Red = unreachable, amber = no way out. Click a card to edit it."),
    h("div", { class: "map-scroll" }, svg),
    h("p", { class: "hint" }, issues.length === 0 ? "✔ The stack doctor found nothing to fix." : `${issues.length} thing(s) for the stack doctor to flag (see the right panel).`));
}
