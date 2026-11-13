import type { Stack } from "../core/types";
import { closeModal, modal } from "./dialogs";
import { h } from "./dom";
import { match, searchDoc, type SearchDoc } from "./search";
import { thumbnail } from "./strip";
import { loadAllTemplates, TEMPLATE_LIST, type TemplateInfo } from "./templates";

export interface GalleryActions {
  /** Play straight away. Must not touch the user's own stack. */
  play(stack: Stack): void;
  /** Replace the user's stack with an editable copy (the caller asks first). */
  edit(stack: Stack, info: TemplateInfo): void;
  /** Play the user's own stack. */
  playMine(): void;
  /** Title and card count of the user's stack, for its tile. */
  mine(): { title: string; cards: number };
}

const cardsLabel = (n: number): string => `${n} card${n === 1 ? "" : "s"}`;

/**
 * "Example stacks" gallery: one tile per template with a picture of its first card, what it is, and
 * two actions. Play opens it full screen at once and leaves your work alone; Edit a copy replaces it.
 */
export function openGallery(actions: GalleryActions): void {
  const grid = h("div", { class: "gallery", role: "list", "aria-busy": "true" },
    ...TEMPLATE_LIST.map(() => h("div", { class: "tile loading", role: "listitem" }, h("div", { class: "tile-pic" }), h("p", null, "Loading…"))));
  const mine = actions.mine();
  const search = h("input", {
    type: "search", class: "gallery-search", placeholder: "Search: a title, a character, “quiz”, “escape room”…",
    "aria-label": "Search stacks", "aria-controls": "gallery-list", autocomplete: "off", spellcheck: false,
  });
  const status = h("p", { class: "gallery-status hint", role: "status", "aria-live": "polite" });
  const empty = h("div", { class: "gallery-empty", hidden: true },
    h("p", null, "No stack matches that."),
    h("button", { class: "tool", onclick: () => { search.value = ""; apply(); search.focus(); } }, "Clear search"));
  grid.id = "gallery-list";
  const dlg = modal("Play a stack", [
    h("p", { class: "hint" }, "Pick a stack to play now, or make an editable copy. Playing never changes your own stack."),
    h("div", { class: "gallery-bar" }, search, status),
    grid,
    empty,
    h("div", { class: "mine" },
      h("span", null, "Your stack: ", h("b", null, mine.title.trim() ? `“${mine.title}”` : "Untitled stack"), ` · ${cardsLabel(mine.cards)}`),
      h("button", { class: "tool", onclick: () => { closeModal(dlg); actions.playMine(); } }, "▶ Play yours")),
  ], [{ label: "Close" }]);
  dlg.classList.add("wide");

  // Filtering. Tiles are built once; search only shows and hides them.
  const docs = new Map<HTMLElement, SearchDoc>();
  let loaded = false;
  const apply = (): void => {
    const q = search.value;
    let shown = 0;
    for (const [tile, doc] of docs) {
      const m = match(doc, q);
      tile.hidden = !m.ok;
      if (m.ok) shown++;
      const why = tile.querySelector<HTMLElement>(".why");
      if (why) { why.textContent = m.card ? `Found on the card “${m.card}”` : ""; why.hidden = !m.card; }
    }
    if (!loaded) return;
    empty.hidden = shown > 0;
    status.textContent = q.trim() ? `${shown} of ${docs.size} stacks` : `${docs.size} stacks`;
  };
  search.addEventListener("input", apply);
  search.addEventListener("keydown", (e) => {
    // Esc clears the search first; only an empty box lets Esc close the dialog.
    if (e.key === "Escape" && search.value) { e.preventDefault(); e.stopPropagation(); search.value = ""; apply(); }
    // Enter jumps to the first result's Play button.
    if (e.key === "Enter") { e.preventDefault(); grid.querySelector<HTMLElement>(".tile:not([hidden]) .tile-actions .primary")?.focus(); }
  });
  // Typing on a phone opens the keyboard over the results, so only desktop starts in the search box.
  const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (!touch) search.focus();

  void loadAllTemplates().then((stacks) => {
    grid.replaceChildren(...TEMPLATE_LIST.map((info) => {
      const s = stacks.get(info.id);
      if (!s) return h("div", { class: "tile", role: "listitem" }, h("h3", null, info.label), h("p", { class: "hint" }, "Could not load this stack."));
      const first = s.cards.find((c) => c.id === s.start) ?? s.cards[0];
      const tile = h("div", { class: "tile", role: "listitem", "data-template": info.id },
        first ? h("div", { class: `tile-pic${s.skin === "haunted" ? " haunted" : ""}`, "aria-hidden": "true" }, thumbnail(s, first)) : null,
        h("h3", null, info.label),
        h("p", { class: "meta" }, `${s.title} · ${cardsLabel(s.cards.length)}`),
        h("p", { class: "blurb" }, info.blurb),
        h("p", { class: "why", hidden: true }),
        h("div", { class: "tile-actions" },
          h("button", { class: "tool primary", "aria-label": `Play ${info.label}`, onclick: () => { closeModal(dlg); actions.play(s); } }, "▶ Play"),
          h("button", { class: "tool", "aria-label": `Edit a copy of ${info.label}`, onclick: () => { closeModal(dlg); actions.edit(s, info); } }, "Edit a copy")));
      docs.set(tile, searchDoc(s, info.label, info.blurb, info.tags));
      return tile;
    }));
    // Scale each 800×600 card picture to its tile's real width.
    const fit = new ResizeObserver((entries) => {
      for (const e of entries) (e.target as HTMLElement).style.setProperty("--k", String(e.contentRect.width / 800));
    });
    grid.querySelectorAll<HTMLElement>(".tile-pic").forEach((el) => fit.observe(el));
    dlg.addEventListener("close", () => fit.disconnect(), { once: true });
    grid.removeAttribute("aria-busy");
    loaded = true;
    apply(); // honour anything typed while the stacks were loading
    if (touch) grid.querySelector<HTMLElement>(".tile-actions .primary")?.focus();
  });
}
