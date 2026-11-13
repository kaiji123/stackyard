import type { Stack } from "../core/types";
import { validateStack } from "../core/validate";

export interface TemplateInfo { readonly id: string; readonly label: string; readonly blurb: string; readonly tags: readonly string[] }

export const TEMPLATE_LIST: readonly TemplateInfo[] = [
  { id: "midnight-train", label: "The Midnight Train", blurb: "A ghost train calls at Platform 13 on Halloween. Help its passengers and find a ticket home before the last stop.", tags: ["adventure", "puzzle", "story", "ghosts", "animated"] },
  { id: "bestiary", label: "Wiki: The Halloween Bestiary", blurb: "A field guide to 17 Halloween creatures: where each comes from, what is true, and links between them.", tags: ["wiki", "encyclopedia", "facts", "creatures", "monsters", "folklore", "animals", "lesson", "classroom"] },
  { id: "haunted-house", label: "Haunted House Escape Room", blurb: "Find the lamp, the note and the key, then face the ghost. A puzzle with flags and an inventory.", tags: ["escape room", "puzzle", "mystery", "ghosts"] },
  { id: "ghost-story", label: "Choose-your-path Ghost Story", blurb: "Follow the lanterns and meet Eleanor. Your choices lead to one of five endings.", tags: ["story", "choose your path", "branching", "ghosts"] },
  { id: "pumpkin-tutorial", label: "Tutorial: How to Carve a Pumpkin", blurb: "Eight illustrated steps and a four-question quiz. A lesson a teacher could make.", tags: ["tutorial", "lesson", "quiz", "classroom", "kids"] },
];

// Templates carry their pictures inline, so each is its own chunk and is fetched only when chosen.
const LOADERS: Readonly<Record<string, () => Promise<{ default: unknown }>>> = {
  "midnight-train": () => import("../../templates/midnight-train.json"),
  "bestiary": () => import("../../templates/bestiary.json"),
  "haunted-house": () => import("../../templates/haunted-house.json"),
  "ghost-story": () => import("../../templates/ghost-story.json"),
  "pumpkin-tutorial": () => import("../../templates/pumpkin-tutorial.json"),
};

export async function loadTemplate(id: string): Promise<Stack> {
  const load = LOADERS[id];
  if (!load) throw new Error(`Unknown template "${id}"`);
  const r = validateStack((await load()).default);
  if (!r.ok) throw new Error(`Bad template ${id}: ${r.errors.join("; ")}`);
  return r.stack;
}

export const BLANK: Stack = {
  schemaVersion: 4,
  skin: "plain",
  title: "My first stack",
  start: "c1",
  cards: [{ id: "c1", name: "Card 1", objects: [] }],
  assets: {},
};

/** Load every template (for the gallery). Failures become `undefined` so one bad file cannot hide the rest. */
export function loadAllTemplates(): Promise<ReadonlyMap<string, Stack | undefined>> {
  return Promise.all(TEMPLATE_LIST.map((t) => loadTemplate(t.id).then((s) => [t.id, s] as const, () => [t.id, undefined] as const)))
    .then((pairs) => new Map(pairs));
}
