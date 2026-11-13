import { SCHEMA_VERSION } from "./types";

type Rec = Readonly<Record<string, unknown>>;

/** A migration upgrades a document from version N to N+1. Must be pure. */
export type Migration = (doc: Rec) => Rec;

/** Keyed by the version being migrated FROM. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v1 -> v2: stacks gain a `skin`. Existing stacks keep their plain look.
  1: (doc) => ({ ...doc, skin: "plain" }),
  // v2 -> v3: text objects gain a `tone` (dark ink, as before) and images a `crisp` flag (smooth, as before).
  2: (doc) => ({
    ...doc,
    cards: Array.isArray(doc["cards"])
      ? doc["cards"].map((c: unknown) => {
        if (typeof c !== "object" || c === null || !Array.isArray((c as Rec)["objects"])) return c;
        const card = c as Rec;
        return {
          ...card,
          objects: (card["objects"] as unknown[]).map((o: unknown) => {
            if (typeof o !== "object" || o === null) return o;
            const obj = o as Rec;
            if (obj["kind"] === "text") return { ...obj, tone: obj["tone"] ?? "dark" };
            if (obj["kind"] === "image") return { ...obj, crisp: obj["crisp"] ?? false };
            return obj;
          }),
        };
      })
      : doc["cards"],
  }),
  // v3 -> v4: every object gains a `motion`; old objects stay still.
  3: (doc) => ({
    ...doc,
    cards: Array.isArray(doc["cards"])
      ? doc["cards"].map((c: unknown) => {
        if (typeof c !== "object" || c === null || !Array.isArray((c as Rec)["objects"])) return c;
        const card = c as Rec;
        return {
          ...card,
          objects: (card["objects"] as unknown[]).map((o: unknown) =>
            typeof o === "object" && o !== null ? { ...(o as Rec), motion: (o as Rec)["motion"] ?? "none" } : o),
        };
      })
      : doc["cards"],
  }),
};

export type MigrateResult =
  | { readonly ok: true; readonly doc: unknown }
  | { readonly ok: false; readonly error: string };

/**
 * Bring any stack document up to `target` version. Documents already at `target` are returned
 * unchanged. The input is never mutated.
 */
export function migrate(
  doc: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrateResult {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return { ok: false, error: "stack must be an object" };
  }
  let cur = doc as Rec;
  let v = cur["schemaVersion"];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    return { ok: false, error: "schemaVersion must be a non-negative integer" };
  }
  if (v > target) return { ok: false, error: `stack is from a newer version (${v} > ${target})` };
  while (v < target) {
    const step = migrations[v];
    if (!step) return { ok: false, error: `no migration from version ${v}` };
    cur = { ...step(cur), schemaVersion: v + 1 };
    v += 1;
  }
  return { ok: true, doc: cur };
}
