import { SCHEMA_VERSION } from "./types";

type Rec = Readonly<Record<string, unknown>>;

/** A migration upgrades a document from version N to N+1. Must be pure. */
export type Migration = (doc: Rec) => Rec;

/** Keyed by the version being migrated FROM. Empty until the schema first changes after v1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

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
