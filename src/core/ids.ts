import type { Stack } from "./types";

/** All card, object and asset ids currently used in a stack. */
export function usedIds(stack: Stack): Set<string> {
  const ids = new Set<string>();
  for (const card of stack.cards) {
    ids.add(card.id);
    for (const o of card.objects) ids.add(o.id);
  }
  for (const a of Object.keys(stack.assets)) ids.add(a);
  return ids;
}

/**
 * Deterministic next free id like "c1", "c2"... Pure: the caller passes the used set.
 * Ids are never reused within one call sequence as long as the caller adds results to `used`.
 */
export function nextId(prefix: string, used: ReadonlySet<string>): string {
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
