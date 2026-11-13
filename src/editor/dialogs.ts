import { h, type Child } from "./dom";

export interface DialogAction {
  readonly label: string;
  readonly primary?: boolean;
  /** Which button gets keyboard focus first. Defaults to the primary one; use Cancel for risky actions. */
  readonly focus?: boolean;
  readonly run?: () => void;
}

/**
 * Accessible modal built on <dialog>.showModal(): the rest of the page becomes inert (focus stays
 * inside), Esc closes it, and it is labelled by its heading. `onDismiss` runs for Esc.
 */
const closers = new WeakMap<HTMLDialogElement, () => void>();

/** Close a dialog made by `modal` from code (e.g. a button inside its body). */
export function closeModal(dlg: HTMLDialogElement): void {
  closers.get(dlg)?.();
}

export function modal(title: string, body: readonly Child[], actions: readonly DialogAction[], onDismiss?: () => void): HTMLDialogElement {
  const dlg = h("dialog", { class: "modal", "aria-labelledby": "modal-title" });
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const done = (): void => {
    if (dlg.open) dlg.close();
    dlg.remove();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  const buttons = actions.map((a) =>
    h("button", { class: a.primary ? "tool primary" : "tool", "data-focus": a.focus ? "1" : null, onclick: () => { done(); a.run?.(); } }, a.label));
  dlg.append(
    h("h2", { id: "modal-title" }, title),
    ...(body.filter(Boolean) as Node[]),
    h("div", { class: "modal-actions" }, ...buttons));
  closers.set(dlg, done);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(); onDismiss?.(); });
  // Keep Tab / Shift+Tab inside the dialog: wrap at the ends instead of escaping to the page or browser UI.
  dlg.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const items = [...dlg.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")]
      .filter((el) => !el.hasAttribute("disabled") && el.tabIndex >= 0);
    const first = items[0], last = items[items.length - 1];
    if (!first || !last) return;
    const at = document.activeElement;
    if (!dlg.contains(at)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  });
  document.body.append(dlg);
  dlg.showModal();
  (dlg.querySelector<HTMLElement>("[data-focus]") ?? dlg.querySelector<HTMLElement>(".primary") ?? dlg.querySelector<HTMLElement>("button"))?.focus();
  return dlg;
}

/** Plain message with one OK button. Replaces window.alert. */
export function notice(title: string, message: string | readonly string[]): Promise<void> {
  const lines = typeof message === "string" ? [message] : message;
  return new Promise((resolve) => {
    modal(title, lines.map((l) => h("p", null, l)), [{ label: "OK", primary: true, run: resolve }], resolve);
  });
}

/** Yes/no question. Resolves false on Cancel or Esc. Replaces window.confirm. */
export function confirmDialog(opts: {
  title: string;
  body: readonly Child[];
  confirmLabel: string;
  cancelLabel?: string;
  /** Focus Cancel first, for destructive actions. */
  risky?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    modal(opts.title, opts.body, [
      { label: opts.cancelLabel ?? "Cancel", focus: opts.risky === true, run: () => resolve(false) },
      { label: opts.confirmLabel, primary: true, run: () => resolve(true) },
    ], () => resolve(false));
  });
}
