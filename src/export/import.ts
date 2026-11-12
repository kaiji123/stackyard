import { migrate } from "../core/migrate";
import type { Stack } from "../core/types";
import { validateStack } from "../core/validate";

export type ImportResult =
  | { readonly ok: true; readonly stack: Stack }
  | { readonly ok: false; readonly errors: readonly string[] };

const OPEN = '<script type="application/json" id="stack-data">';

/**
 * Read a stack back out of an exported HTML file (or a bare JSON file). String-based, so it also
 * runs outside a browser. The exporter escapes "<", so the first "</script>" really is the end.
 */
export function importStack(text: string): ImportResult {
  let json = text.trim();
  if (!json.startsWith("{")) {
    const start = text.indexOf(OPEN);
    if (start < 0) return { ok: false, errors: ["No Stackyard data found in this file."] };
    const from = start + OPEN.length;
    const end = text.indexOf("</script>", from);
    if (end < 0) return { ok: false, errors: ["The stack data is cut off."] };
    json = text.slice(from, end);
  }
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return { ok: false, errors: ["The stack data is damaged."] };
  }
  const m = migrate(doc);
  if (!m.ok) return { ok: false, errors: [m.error] };
  const v = validateStack(m.doc);
  return v.ok ? { ok: true, stack: v.stack } : { ok: false, errors: v.errors };
}
