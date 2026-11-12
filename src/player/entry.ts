/** Entry point bundled (IIFE) into exported files. Reads #stack-data and starts the player. */
import { migrate } from "../core/migrate";
import { validateStack } from "../core/validate";
import { mount } from "./player";

function fail(root: HTMLElement, lines: readonly string[]): void {
  const pre = document.createElement("div");
  pre.className = "sy-err";
  pre.textContent = ["This stack could not be opened.", ...lines].join("\n");
  root.replaceChildren(pre);
}

const root = document.getElementById("stack");
const data = document.getElementById("stack-data");
if (root && data) {
  try {
    const m = migrate(JSON.parse(data.textContent ?? ""));
    if (!m.ok) fail(root, [m.error]);
    else {
      const v = validateStack(m.doc);
      if (v.ok) mount(root, v.stack);
      else fail(root, v.errors.slice(0, 5));
    }
  } catch {
    fail(root, ["The stack data is damaged."]);
  }
}
