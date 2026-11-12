import type {
  Action, Asset, Card, Cond, SimpleAction, Stack, StackObject, TextAlign,
} from "./types";
import { SCHEMA_VERSION } from "./types";

export type ValidationResult =
  | { readonly ok: true; readonly stack: Stack }
  | { readonly ok: false; readonly errors: readonly string[] };

type Rec = Readonly<Record<string, unknown>>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

function cond(v: unknown, path: string, errs: string[]): v is Cond {
  if (isRec(v) && isStr(v["flag"]) && v["item"] === undefined) return true;
  if (isRec(v) && isStr(v["item"]) && v["flag"] === undefined) return true;
  errs.push(`${path}: condition must be {flag} or {item}`);
  return false;
}

function simple(v: unknown, path: string, errs: string[]): v is SimpleAction {
  if (!isRec(v) || !isStr(v["type"])) {
    errs.push(`${path}: action needs a string type`);
    return false;
  }
  const need = (key: string, check: (x: unknown) => boolean): boolean => {
    if (check(v[key])) return true;
    errs.push(`${path}: "${v["type"]}" needs valid "${key}"`);
    return false;
  };
  switch (v["type"]) {
    case "next": case "prev": case "back": return true;
    case "goto": return need("card", isStr);
    case "show": case "hide": return need("object", isStr);
    case "addItem": return need("item", isStr);
    case "setFlag": return need("flag", isStr) && need("value", isBool);
    default:
      errs.push(`${path}: unknown action type "${v["type"]}"`);
      return false;
  }
}

function actions(v: unknown, path: string, errs: string[]): v is readonly Action[] {
  if (!Array.isArray(v)) {
    errs.push(`${path}: must be an array`);
    return false;
  }
  let ok = true;
  v.forEach((a: unknown, i) => {
    const p = `${path}[${i}]`;
    if (isRec(a) && a["type"] === "if") {
      ok = cond(a["cond"], `${p}.cond`, errs) && ok;
      for (const branch of ["then", "else"] as const) {
        const list = a[branch];
        if (!Array.isArray(list)) {
          errs.push(`${p}.${branch}: must be an array`);
          ok = false;
        } else {
          list.forEach((s: unknown, j) => { ok = simple(s, `${p}.${branch}[${j}]`, errs) && ok; });
        }
      }
    } else {
      ok = simple(a, p, errs) && ok;
    }
  });
  return ok;
}

const ALIGNS: readonly TextAlign[] = ["left", "center", "right"];

function object(v: unknown, path: string, errs: string[]): v is StackObject {
  if (!isRec(v)) {
    errs.push(`${path}: must be an object`);
    return false;
  }
  let ok = true;
  const bad = (m: string): void => { errs.push(`${path}: ${m}`); ok = false; };
  if (!isStr(v["id"])) bad("id must be a string");
  for (const k of ["x", "y", "w", "h"]) if (!isNum(v[k])) bad(`${k} must be a finite number`);
  if (!isBool(v["visible"])) bad("visible must be a boolean");
  ok = actions(v["actions"], `${path}.actions`, errs) && ok;
  switch (v["kind"]) {
    case "text":
      if (!isStr(v["text"])) bad("text must be a string");
      if (!isNum(v["fontSize"])) bad("fontSize must be a number");
      if (!isBool(v["bold"])) bad("bold must be a boolean");
      if (!ALIGNS.some((a) => a === v["align"])) bad("align must be left|center|right");
      break;
    case "image":
      if (!isStr(v["asset"])) bad("asset must be a string");
      if (!isStr(v["alt"])) bad("alt must be a string");
      break;
    case "button":
      if (!isStr(v["label"])) bad("label must be a string");
      break;
    default:
      bad(`unknown kind "${String(v["kind"])}"`);
  }
  return ok;
}

function card(v: unknown, path: string, errs: string[]): v is Card {
  if (!isRec(v)) {
    errs.push(`${path}: must be an object`);
    return false;
  }
  let ok = true;
  if (!isStr(v["id"])) { errs.push(`${path}.id: must be a string`); ok = false; }
  if (!isStr(v["name"])) { errs.push(`${path}.name: must be a string`); ok = false; }
  if (!Array.isArray(v["objects"])) {
    errs.push(`${path}.objects: must be an array`);
    return false;
  }
  v["objects"].forEach((o: unknown, i) => { ok = object(o, `${path}.objects[${i}]`, errs) && ok; });
  return ok;
}

function asset(v: unknown, path: string, errs: string[]): v is Asset {
  if (isRec(v) && isStr(v["mime"]) && isStr(v["data"])) return true;
  errs.push(`${path}: asset needs string mime and data`);
  return false;
}

/**
 * Structural validation of an unknown document that is already at the current schemaVersion.
 * Checks shape, unique ids and that `start` exists. Dangling action targets are NOT errors here:
 * the doctor reports them (see graph.ts).
 */
export function validateStack(doc: unknown): ValidationResult {
  const errs: string[] = [];
  if (!isRec(doc)) return { ok: false, errors: ["stack must be an object"] };
  if (doc["schemaVersion"] !== SCHEMA_VERSION) errs.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (!isStr(doc["title"])) errs.push("title must be a string");
  if (doc["skin"] !== "plain" && doc["skin"] !== "haunted") errs.push("skin must be plain or haunted");
  if (!isStr(doc["start"])) errs.push("start must be a string");
  const cards = doc["cards"];
  if (!Array.isArray(cards) || cards.length === 0) {
    errs.push("cards must be a non-empty array");
  } else {
    cards.forEach((c: unknown, i) => { card(c, `cards[${i}]`, errs); });
  }
  const assets = doc["assets"];
  if (!isRec(assets)) {
    errs.push("assets must be an object");
  } else {
    for (const [k, a] of Object.entries(assets)) asset(a, `assets.${k}`, errs);
  }
  if (errs.length > 0) return { ok: false, errors: errs };

  // Shape is valid; check id uniqueness and start.
  const stack = doc as unknown as Stack;
  const seen = new Set<string>();
  const dup = (id: string): void => {
    if (seen.has(id)) errs.push(`duplicate id "${id}"`);
    seen.add(id);
  };
  for (const c of stack.cards) {
    dup(c.id);
    for (const o of c.objects) dup(o.id);
  }
  if (!stack.cards.some((c) => c.id === stack.start)) errs.push(`start "${stack.start}" is not a card`);
  return errs.length > 0 ? { ok: false, errors: errs } : { ok: true, stack };
}
