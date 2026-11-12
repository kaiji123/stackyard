import { allActions, dangling, edges, reachable } from "./graph";
import type { CardId, Cond, ObjectId, Stack } from "./types";

export interface Issue {
  readonly severity: "error" | "warning" | "info";
  readonly code:
    | "unreachable-card" | "dangling-target" | "empty-button" | "flag-never-set"
    | "item-never-added" | "dead-end" | "missing-asset";
  readonly message: string;
  readonly card?: CardId;
  readonly object?: ObjectId;
}

/** Lint a stack. Pure: reads the graph, returns findings, changes nothing. */
export function diagnose(stack: Stack): readonly Issue[] {
  const issues: Issue[] = [];
  const name = (id: CardId): string => stack.cards.find((c) => c.id === id)?.name || id;
  const seen = reachable(stack);
  const out = edges(stack);

  for (const c of stack.cards) {
    if (!seen.has(c.id)) {
      issues.push({ severity: "warning", code: "unreachable-card", card: c.id, message: `Card "${name(c.id)}" can never be reached from the start card.` });
    } else if ((out.get(c.id)?.size ?? 0) === 0 && stack.cards.length > 1) {
      issues.push({ severity: "info", code: "dead-end", card: c.id, message: `Card "${name(c.id)}" has no way out (fine for an ending).` });
    }
    for (const o of c.objects) {
      if (o.kind === "button" && o.actions.length === 0) {
        issues.push({ severity: "warning", code: "empty-button", card: c.id, object: o.id, message: `Button "${o.label}" on "${name(c.id)}" does nothing.` });
      }
      if (o.kind === "image" && !Object.prototype.hasOwnProperty.call(stack.assets, o.asset)) {
        issues.push({ severity: "error", code: "missing-asset", card: c.id, object: o.id, message: `An image on "${name(c.id)}" has no picture data.` });
      }
    }
  }

  for (const d of dangling(stack)) {
    issues.push({ severity: "error", code: "dangling-target", card: d.card, object: d.object, message: `An action on "${name(d.card)}" points at a missing ${d.kind}.` });
  }

  const flagsSet = new Set<string>();
  const itemsAdded = new Set<string>();
  for (const { action } of allActions(stack)) {
    if (action.type === "setFlag" && action.value) flagsSet.add(action.flag);
    if (action.type === "addItem") itemsAdded.add(action.item);
  }
  const conds: { cond: Cond; card: CardId; object: ObjectId }[] = [];
  for (const c of stack.cards) for (const o of c.objects) for (const a of o.actions) {
    if (a.type === "if") conds.push({ cond: a.cond, card: c.id, object: o.id });
  }
  for (const { cond, card, object } of conds) {
    if ("flag" in cond && !flagsSet.has(cond.flag)) {
      issues.push({ severity: "warning", code: "flag-never-set", card, object, message: `Flag "${cond.flag}" is checked but nothing ever sets it.` });
    } else if ("item" in cond && !itemsAdded.has(cond.item)) {
      issues.push({ severity: "warning", code: "item-never-added", card, object, message: `Item "${cond.item}" is checked but nothing ever adds it.` });
    }
  }
  return issues;
}
