import {
  exec, execBatch, newHistory, redo, undo, type Command, type History,
} from "../core/commands";
import { nextId, usedIds } from "../core/ids";
import type { Card, CardId, ObjectId, Stack, StackObject } from "../core/types";
import { buildHtml, pruneAssets } from "../export/build";
import { importStack } from "../export/import";
import { mount, type Mounted } from "../player/player";
import { FONT_CSS } from "../player/fonts";
import { PLAYER_CSS } from "../player/style";
import playerJs from "../../dist-player/player.js?raw";
import { openAbout, openWelcome, wasWelcomed } from "./about";
import type { Ctx, Mode } from "./ctx";
import { h } from "./dom";
import { prepareImage } from "./images";
import { renderInspector } from "./inspector";
import { renderMap } from "./map";
import { renderStage } from "./stage";
import { loadStack, saveStack } from "./storage";
import { renderStrip } from "./strip";
import { BLANK, TEMPLATES } from "./templates";

const SOFT_LIMIT = 10 * 1024 * 1024;

export async function start(root: HTMLElement): Promise<void> {
  const style = document.createElement("style");
  style.textContent = FONT_CSS + PLAYER_CSS;
  document.head.append(style);

  const saved = await loadStack();
  const first = saved ?? TEMPLATES[0]?.stack ?? BLANK;
  let hist: History = newHistory(first);
  let cardId: CardId = first.start;
  let selId: ObjectId | null = null;
  let mode: Mode = "edit";
  let status = saved ? "Restored from autosave" : "Loaded the Haunted House template";
  let player: Mounted | null = null;
  let panelTab: "cards" | "inspect" = "cards";
  let lastSel: ObjectId | null = null;
  let saveState = saved ? "Saved" : "Not saved yet";
  let saveTimer: number | undefined;

  const stack = (): Stack => hist.present;
  const card = (): Card => stack().cards.find((c) => c.id === cardId) ?? (stack().cards[0] as Card);
  const sel = (): StackObject | undefined => card().objects.find((o) => o.id === selId);

  const fix = (): void => {
    cardId = card().id;
    if (selId && !sel()) selId = null;
  };
  const scheduleSave = (): void => {
    saveState = "Saving…";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveStack(stack()).then(() => { saveState = "Saved in this browser"; paint(); }, () => { saveState = "Autosave unavailable"; paint(); });
    }, 500);
  };
  const changed = (): void => { fix(); scheduleSave(); render(); };

  const ctx: Ctx = {
    stack, card, sel, mode: () => mode,
    dispatch: (cmd: Command) => { const n = exec(hist, cmd); if (n !== hist) { hist = n; changed(); } },
    batch: (cmds) => { const n = execBatch(hist, cmds); if (n !== hist) { hist = n; changed(); } },
    selectCard: (id) => { cardId = id; selId = null; render(); },
    selectObject: (id) => { selId = id; render(); },
    setMode: (m) => { mode = m; render(); },
    render: () => render(),
    addImageFile: async (file) => {
      try {
        const img = await prepareImage(file);
        const used = usedIds(stack());
        const assetId = nextId("a", used);
        used.add(assetId);
        const id = nextId("o", used);
        const k = Math.min(1, 480 / img.w, 360 / img.h);
        const w = Math.max(16, Math.round(img.w * k)), hh = Math.max(16, Math.round(img.h * k));
        const obj: StackObject = {
          kind: "image", id, asset: assetId, alt: "", x: 80, y: 80, w, h: hh, visible: true, actions: [],
        };
        ctx.batch([{ type: "addAsset", id: assetId, asset: { mime: img.mime, data: img.data } }, { type: "addObject", card: card().id, object: obj }]);
        selId = id;
        render();
      } catch {
        alert("Sorry, that picture could not be read. Try a PNG, JPEG, WebP or GIF.");
      }
    },
  };

  const addObject = (kind: "text" | "button"): void => {
    const id = nextId("o", usedIds(stack()));
    const base = { id, x: 100, y: 100, visible: true, actions: [] } as const;
    const obj: StackObject = kind === "text"
      ? { ...base, kind, w: 440, h: 110, text: "New text", fontSize: 28, bold: false, align: "left" }
      : { ...base, kind, w: 220, h: 64, label: "Button" };
    ctx.dispatch({ type: "addObject", card: card().id, object: obj });
    selId = id;
    render();
  };

  const download = (name: string, type: string, body: string): void => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = h("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const slug = (): string => (stack().title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stack");
  const doExport = async (): Promise<void> => {
    download(`${slug()}.html`, "text/html", await buildHtml(stack(), playerJs));
    status = "Exported a single HTML file";
    paint();
  };
  const loadNew = (s: Stack, why: string): void => {
    hist = newHistory(s);
    cardId = s.start;
    selId = null;
    mode = "edit";
    status = why;
    scheduleSave();
    render();
  };
  const doImport = async (file: File): Promise<void> => {
    const r = importStack(await file.text());
    if (r.ok) loadNew(r.stack, `Imported “${r.stack.title}”`);
    else alert(`Could not import that file:\n${r.errors.slice(0, 4).join("\n")}`);
  };

  const sizeBytes = (): number => JSON.stringify(pruneAssets(stack())).length + playerJs.length + 2000;
  const fmt = (n: number): string => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  const imageInput = h("input", { type: "file", accept: "image/*", hidden: true, onchange: (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = "";
    if (f) void ctx.addImageFile(f);
  } });
  const importInput = h("input", { type: "file", accept: ".html,.htm,.json,text/html,application/json", hidden: true, onchange: (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = "";
    if (f) void doImport(f);
  } });

  const quickStart = (): void => openWelcome({
    blank: () => loadNew(BLANK, "Started a blank stack"),
    template: () => { const t = TEMPLATES[0]; if (t) loadNew(t.stack, "Loaded the Haunted House template"); },
  });

  const top = h("header", { class: "top" });
  const strip = h("aside", { class: "left", "aria-label": "Cards" });
  const work = h("main", { class: "work" });
  const side = h("aside", { class: "right", "aria-label": "Inspector" });
  const bar = h("footer", { class: "status" });
  const tabs = h("nav", { class: "tabs", "aria-label": "Panels" });
  root.replaceChildren(top, strip, work, tabs, side, bar, imageInput, importInput);

  const btn = (label: string, title: string, fn: () => void, extra: Record<string, unknown> = {}): HTMLElement =>
    h("button", { class: "tool", title, "aria-label": title, onclick: fn, ...extra }, label);
  const modeBtn = (m: Mode, label: string): HTMLElement =>
    btn(label, label, () => ctx.setMode(m), { "aria-pressed": mode === m ? "true" : "false", class: `tool mode${mode === m ? " on" : ""}` });

  const paint = (): void => {
    const size = sizeBytes();
    bar.replaceChildren(
      h("span", null, `${status} · ${saveState}`),
      h("span", { class: size > SOFT_LIMIT ? "warn" : "" }, `Export size ≈ ${fmt(size)}${size > SOFT_LIMIT ? " — large! Phones may struggle; try smaller pictures." : ""}`));
  };

  const render = (): void => {
    fix();
    player?.destroy();
    player = null;
    const playing = mode === "play";
    // On phones the side panels share one slot: jump to the inspector when something is selected.
    if (selId && selId !== lastSel) panelTab = "inspect";
    lastSel = selId;
    root.dataset["tab"] = panelTab;
    root.classList.toggle("playing", playing);
    tabs.replaceChildren(
      h("button", { class: `tool${panelTab === "cards" ? " on" : ""}`, "aria-pressed": String(panelTab === "cards"), onclick: () => { panelTab = "cards"; render(); } }, "Cards"),
      h("button", { class: `tool${panelTab === "inspect" ? " on" : ""}`, "aria-pressed": String(panelTab === "inspect"), onclick: () => { panelTab = "inspect"; render(); } }, "Edit object"));
    top.replaceChildren(
      h("span", { class: "logo" }, "STACKYARD"),
      h("input", { class: "title", type: "text", "aria-label": "Stack title", value: stack().title, onchange: (e: Event) => ctx.dispatch({ type: "setTitle", title: (e.target as HTMLInputElement).value }) }),
      btn("↶", "Undo (Ctrl+Z)", () => { hist = undo(hist); changed(); }, { disabled: hist.past.length === 0 }),
      btn("↷", "Redo (Ctrl+Shift+Z)", () => { hist = redo(hist); changed(); }, { disabled: hist.future.length === 0 }),
      h("span", { class: "sep" }),
      btn("T Text", "Add text", () => addObject("text"), { disabled: mode !== "edit" }),
      btn("▭ Button", "Add button", () => addObject("button"), { disabled: mode !== "edit" }),
      btn("🖼 Image", "Add image", () => imageInput.click(), { disabled: mode !== "edit" }),
      h("span", { class: "sep" }),
      modeBtn("edit", "Edit"), modeBtn("map", "Map"), modeBtn("play", "▶ Play"),
      h("span", { class: "grow" }),
      h("select", { "aria-label": "New from template", value: "", onchange: (e: Event) => {
        const el = e.target as HTMLSelectElement;
        const v = el.value;
        el.value = "";
        if (!v) return;
        const s = v === "blank" ? BLANK : TEMPLATES.find((t) => t.id === v)?.stack;
        if (s && confirm("Replace the current stack? Export it first if you want to keep it.")) loadNew(s, "Started a new stack");
      } },
        h("option", { value: "" }, "New from…"), h("option", { value: "blank" }, "Blank stack"),
        ...TEMPLATES.map((t) => h("option", { value: t.id }, t.label))),
      btn("Import", "Import an exported .html", () => importInput.click()),
      btn("About", "About Stackyard and its license", () => openAbout(quickStart)),
      btn("Export HTML", "Export one self-contained HTML file", () => void doExport(), { class: "tool primary" }));

    strip.replaceChildren(renderStrip(ctx));
    side.replaceChildren(renderInspector(ctx));
    side.hidden = playing;
    if (playing) {
      work.replaceChildren(h("div", { class: "play-host" }));
      const host = work.firstElementChild as HTMLElement;
      player = mount(host, stack(), true);
      work.append(h("button", { class: "tool restart", onclick: () => ctx.render() }, "↻ Restart"));
    } else if (mode === "map") {
      work.replaceChildren(renderMap(ctx));
    } else {
      work.replaceChildren(renderStage(ctx));
    }
    paint();
  };

  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("input, textarea, select")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); hist = e.shiftKey ? redo(hist) : undo(hist); changed(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); hist = redo(hist); changed(); return; }
    const o = sel();
    if (!o || mode !== "edit") return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); ctx.dispatch({ type: "deleteObject", object: o.id }); return; }
    const step = e.shiftKey ? 10 : 1;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const mv = d[e.key];
    if (mv) { e.preventDefault(); ctx.dispatch({ type: "updateObject", object: o.id, patch: { x: o.x + mv[0], y: o.y + mv[1] } }); }
  });
  document.addEventListener("paste", (e) => {
    if (mode !== "edit" || (e.target as HTMLElement).matches("input, textarea")) return;
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
    if (f) { e.preventDefault(); void ctx.addImageFile(f); }
  });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    const f = [...(e.dataTransfer?.files ?? [])][0];
    if (!f) return;
    e.preventDefault();
    if (f.type.startsWith("image/")) void ctx.addImageFile(f);
    else if (/\.(html?|json)$/i.test(f.name)) void doImport(f);
  });
  render();
  if (!saved && !wasWelcomed()) quickStart();
}
