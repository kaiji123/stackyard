import type { Stack } from "../core/types";

/** Lower case, accents removed, punctuation turned into spaces: "Mrs. Pell's" -> "mrs pell s". */
export function normalize(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export const words = (query: string): string[] => normalize(query).split(" ").filter(Boolean);

/** Everything a player might search a stack for, in two parts: what the tile shows, and what is inside. */
export interface SearchDoc {
  readonly head: string;
  readonly cards: readonly { readonly name: string; readonly text: string }[];
}

export function searchDoc(stack: Stack, label: string, blurb: string, tags: readonly string[]): SearchDoc {
  return {
    head: normalize([label, stack.title, blurb, ...tags].join(" ")),
    cards: stack.cards.map((c) => ({
      name: c.name,
      text: normalize([c.name, ...c.objects.map((o) => (o.kind === "text" ? o.text : o.kind === "button" ? o.label : o.alt))].join(" ")),
    })),
  };
}

const hasWord = (text: string, w: string): boolean => (" " + text).includes(" " + w); // matches word starts: "lant" finds "lantern"

export interface Match {
  readonly ok: boolean;
  /** When some words were only found inside the stack: the first card that has them, to show why it matched. */
  readonly card?: string;
}

/** Every word of the query must appear somewhere (title, description, tags, or any card). Empty query matches all. */
export function match(doc: SearchDoc, query: string): Match {
  const ws = words(query);
  if (ws.length === 0) return { ok: true };
  const all = doc.head + " " + doc.cards.map((c) => c.text).join(" ");
  if (!ws.every((w) => hasWord(all, w))) return { ok: false };
  const inside = ws.filter((w) => !hasWord(doc.head, w));
  if (inside.length === 0) return { ok: true };
  // Best hint first: a card NAMED after the words (the "Kitsune" article), then a card that has them all.
  const named = doc.cards.find((c) => inside.every((w) => hasWord(normalize(c.name), w)));
  const card = named ?? doc.cards.find((c) => inside.every((w) => hasWord(c.text, w))) ?? doc.cards.find((c) => inside.some((w) => hasWord(c.text, w)));
  return card ? { ok: true, card: card.name } : { ok: true };
}
