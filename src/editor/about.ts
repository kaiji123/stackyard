import { modal } from "./dialogs";
import { h } from "./dom";
import { ghostMascot } from "./mascots";

/** Set at build time (the Pages workflow passes the repository URL). Empty when unknown. */
export const REPO_URL: string = (import.meta.env["VITE_REPO_URL"] as string | undefined) ?? "";
const WELCOMED = "stackyard:welcomed";

export function wasWelcomed(): boolean {
  try { return localStorage.getItem(WELCOMED) === "1"; } catch { return false; }
}
function markWelcomed(): void {
  try { localStorage.setItem(WELCOMED, "1"); } catch { /* storage can be blocked; harmless */ }
}

export function openAbout(showQuickStart: () => void): void {
  modal("About Stackyard", [
    ghostMascot(),
    h("p", null, "Stack index cards. Link them. Share one file that runs forever."),
    h("p", null, "Stackyard is a no-code card-stack maker inspired by the classic 1987 card-stack tools. Anything you make exports as a single HTML file that works offline in any browser. That file is also your save file: import it here to keep editing."),
    h("h3", null, "License"),
    h("p", null, "Stackyard is open source, released under the ",
      h("strong", null, "MIT License"), ". Copyright © 2026 Stackyard contributors."),
    REPO_URL ? h("p", null, "Source code: ", h("a", { href: REPO_URL, target: "_blank", rel: "noopener noreferrer" }, REPO_URL)) : null,
    h("h3", null, "Fonts"),
    h("p", null, "Silkscreen and VT323 are licensed under the SIL Open Font License 1.1 and are embedded in exported files."),
    h("p", { class: "hint" }, "Stackyard is not affiliated with or endorsed by any company whose older software inspired it."),
  ], [
    { label: "Quick start", run: showQuickStart },
    { label: "Close", primary: true },
  ]);
}

export function openWelcome(opts: { blank: () => void; browse: () => void }): void {
  modal("Make your first card in 30 seconds", [
    ghostMascot(),
    h("ol", { class: "steps" },
      h("li", null, h("b", null, "Add text. "), "Press ", h("kbd", null, "T Text"), " and type a title."),
      h("li", null, h("b", null, "Add a button. "), "Press ", h("kbd", null, "▭ Button"), ", then under “When clicked” pick “Go to card…”."),
      h("li", null, h("b", null, "Play it. "), "Press ", h("kbd", null, "▶ Play"), ". Export gives you one HTML file to share.")),
    h("p", { class: "hint" }, "Your work is saved in this browser automatically."),
  ], [
    { label: "Start with a blank stack", primary: true, run: () => { markWelcomed(); opts.blank(); } },
    { label: "Play an example stack", run: () => { markWelcomed(); opts.browse(); } },
    { label: "Skip", run: markWelcomed },
  ]);
}
