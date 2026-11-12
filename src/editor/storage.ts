import type { Stack } from "../core/types";
import { importStack } from "../export/import";

const DB = "stackyard";
const STORE = "kv";
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Autosave target. Failures are non-fatal (private mode, quota): the caller shows a status. */
export async function saveStack(stack: Stack): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(JSON.stringify(stack), KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadStack(): Promise<Stack | undefined> {
  try {
    const db = await open();
    const text = await new Promise<unknown>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (typeof text !== "string") return undefined;
    const r = importStack(text);
    return r.ok ? r.stack : undefined;
  } catch {
    return undefined;
  }
}
