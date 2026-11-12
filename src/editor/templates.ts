import type { Stack } from "../core/types";
import { validateStack } from "../core/validate";
import ghost from "../../templates/ghost-story.json";
import haunted from "../../templates/haunted-house.json";
import pumpkin from "../../templates/pumpkin-tutorial.json";

export interface Template { readonly id: string; readonly label: string; readonly stack: Stack }

function load(doc: unknown): Stack {
  const r = validateStack(doc);
  if (!r.ok) throw new Error(`Bad template: ${r.errors.join("; ")}`);
  return r.stack;
}

export const TEMPLATES: readonly Template[] = [
  { id: "haunted-house", label: "Haunted House Escape Room", stack: load(haunted) },
  { id: "ghost-story", label: "Choose-your-path Ghost Story", stack: load(ghost) },
  { id: "pumpkin-tutorial", label: "Tutorial: How to Carve a Pumpkin", stack: load(pumpkin) },
];

export const BLANK: Stack = {
  schemaVersion: 1,
  title: "My first stack",
  start: "c1",
  cards: [{ id: "c1", name: "Card 1", objects: [] }],
  assets: {},
};
