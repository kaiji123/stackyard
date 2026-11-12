import { h, type Child } from "./dom";

/** Set at build time (the Pages workflow passes the repository URL). Empty when unknown. */
export const REPO_URL: string = (import.meta.env["VITE_REPO_URL"] as string | undefined) ?? "";
const WELCOMED = "stackyard:welcomed";

export function wasWelcomed(): boolean {
  try { return localStorage.getItem(WELCOMED) === "1"; } catch { return false; }
}
function markWelcomed(): void {
  try { localStorage.setItem(WELCOMED, "1"); } catch { /* storage can be blocked; harmless */ }
}

interface Action { readonly label: string; readonly primary?: boolean; readonly run?: () => void }

/** Accessible modal built on <dialog>: focus trap, Esc to close, labelled by its heading. */
function modal(title: string, body: readonly Child[], actions: readonly Action[]): void {
  const dlg = h("dialog", { class: "modal", "aria-labelledby": "modal-title" });
  const close = (): void => { dlg.close(); dlg.remove(); };
  dlg.append(
    h("h2", { id: "modal-title" }, title),
    ...body.filter(Boolean) as Node[],
    h("div", { class: "modal-actions" }, ...actions.map((a) =>
      h("button", { class: a.primary ? "tool primary" : "tool", onclick: () => { close(); a.run?.(); } }, a.label))));
  dlg.addEventListener("cancel", () => { dlg.remove(); });
  document.body.append(dlg);
  dlg.showModal();
  dlg.querySelector<HTMLElement>(".primary, button")?.focus();
}

export function openAbout(showQuickStart: () => void): void {
  modal("About Stackyard", [
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

export function openWelcome(opts: { blank: () => void; template: () => void }): void {
  modal("Make your first card in 30 seconds", [
    h("ol", { class: "steps" },
      h("li", null, h("b", null, "Add text. "), "Press ", h("kbd", null, "T Text"), " and type a title."),
      h("li", null, h("b", null, "Add a button. "), "Press ", h("kbd", null, "▭ Button"), ", then under “When clicked” pick “Go to card…”."),
      h("li", null, h("b", null, "Play it. "), "Press ", h("kbd", null, "▶ Play"), ". Export gives you one HTML file to share.")),
    h("p", { class: "hint" }, "Your work is saved in this browser automatically."),
  ], [
    { label: "Start with a blank stack", primary: true, run: () => { markWelcomed(); opts.blank(); } },
    { label: "Explore the Haunted House", run: () => { markWelcomed(); opts.template(); } },
    { label: "Skip", run: markWelcomed },
  ]);
}
