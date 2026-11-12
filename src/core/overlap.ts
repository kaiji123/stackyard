import { click, initState, visibleObjects, type PlayState } from "./engine";
import { intersects } from "./layout";
import type { CardId, ObjectId, Stack, TextObject } from "./types";

export interface TextOverlap {
  readonly card: CardId;
  readonly a: ObjectId;
  readonly b: ObjectId;
}

const key = (card: CardId, a: ObjectId, b: ObjectId): string => (a < b ? `${card}|${a}|${b}` : `${card}|${b}|${a}`);

/** Every pair of text boxes on the same card whose rectangles overlap, whatever their visibility. */
export function staticTextOverlaps(stack: Stack): readonly TextOverlap[] {
  const out: TextOverlap[] = [];
  for (const c of stack.cards) {
    const texts = c.objects.filter((o): o is TextObject => o.kind === "text");
    texts.forEach((a, i) => {
      for (const b of texts.slice(i + 1)) if (intersects(a, b)) out.push({ card: c.id, a: a.id, b: b.id });
    });
  }
  return out;
}

export const MAX_STATES = 3000;

/**
 * Text boxes that overlap AND can be visible at the same time in some state the player can reach
 * (explored breadth-first through real clicks, so show/hide/flags/items are all respected).
 * Every card is also tried as a starting point, so unlinked cards under construction are checked.
 * Text that overlaps but is never shown together, such as two alternative messages, is not reported.
 * Exploration is bounded; `complete` is false if the bound was hit.
 */
export function liveTextOverlaps(stack: Stack, maxStates: number = MAX_STATES): { overlaps: readonly TextOverlap[]; complete: boolean } {
  const candidates = new Set(staticTextOverlaps(stack).map((o) => key(o.card, o.a, o.b)));
  if (candidates.size === 0) return { overlaps: [], complete: true };
  const found = new Map<string, TextOverlap>();
  const seen = new Set<string>();
  // Seed from every card (fresh flags), so a card gets checked while it is still being built and unlinked.
  const fresh = initState(stack);
  const queue: PlayState[] = [fresh, ...stack.cards.filter((c) => c.id !== fresh.card).map((c) => ({ ...fresh, card: c.id }))];
  for (let head = 0; head < queue.length && seen.size < maxStates; head++) {
    const s = queue[head] as PlayState;
    const id = JSON.stringify([s.card, s.flags, s.items, s.visibility]);
    if (seen.has(id)) continue;
    seen.add(id);
    const visible = visibleObjects(stack, s);
    const texts = visible.filter((o) => o.kind === "text");
    texts.forEach((a, i) => {
      for (const b of texts.slice(i + 1)) {
        const k = key(s.card, a.id, b.id);
        if (candidates.has(k) && !found.has(k)) found.set(k, { card: s.card, a: a.id, b: b.id });
      }
    });
    for (const o of visible) queue.push(click(stack, s, o.id));
  }
  return { overlaps: [...found.values()], complete: queue.length <= seen.size || seen.size < maxStates };
}
