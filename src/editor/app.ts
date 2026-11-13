import {
  exec, execBatch, newHistory, redo, replaceStack, undo, type Command, type History,
} from "../core/commands";
import { nextId, usedIds } from "../core/ids";
import type { Card, CardId, ObjectId, Stack, StackObject } from "../core/types";
import { buildHtml, pruneAssets } from "../export/build";
import { fileSlug } from "../export/filename";
import { importStack } from "../export/import";
import { mount, type Mounted } from "../player/player";
import { FONT_CSS } from "../player/fonts";
import { PLAYER_CSS } from "../player/style";
import playerJs from "../../dist-player/player.js?raw";
import { openAbout, openWelcome, wasWelcomed } from "./about";
import { openGallery } from "./gallery";
import type { Ctx, Mode } from "./ctx";
import { confirmDialog, modal, notice } from "./dialogs";
import { h } from "./dom";
import { prepareImage } from "./images";
import { decodeGif } from "../export/gif";
import { encodeDrawing, MAX_EDIT, openPainter } from "./paint";
import { blockSize, downscale, fromRGBA, type Pixels } from "./pixels";
import { renderInspector } from "./inspector";
import { renderMap } from "./map";
import { renderStage } from "./stage";
import { loadStack, PREVIOUS, saveStack } from "./storage";
import { renderStrip } from "./strip";
import { BLANK, loadTemplate, TEMPLATE_LIST } from "./templates";

const SOFT_LIMIT = 10 * 1024 * 1024;

export async function start(root: HTMLElement): Promise<void> {
  const style = document.createElement("style");
  style.textContent = FONT_CSS + PLAYER_CSS;
  document.head.append(style);

  const saved = await loadStack();
  const first = saved ?? await loadTemplate("haunted-house").catch(() => BLANK);
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
  let sizeTimer: number | undefined;
  let exactSize: number | undefined;
  let hasPrevious = (await loadStack(PREVIOUS)) !== undefined;

  const stack = (): Stack => hist.present;
  const card = (): Card => stack().cards.find((c) => c.id === cardId) ?? (stack().cards[0] as Card);
  const sel = (): StackObject | undefined => card().objects.find((o) => o.id === selId);

  const fix = (): void => {
    cardId = card().id;
    if (selId && !sel()) selId = null;
  };
  const scheduleSave = (): void => {
    saveState = "Saving…";
    measure();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveStack(stack()).then(() => { saveState = "Saved in this browser"; paint(); }, () => { saveState = "Autosave unavailable"; paint(); });
    }, 500);
  };
  const changed = (): void => { fix(); scheduleSave(); render(); };

  /** Measure the real exported file (debounced), so the size meter and the 10 MB warning are exact. */
  const measure = (): void => {
    window.clearTimeout(sizeTimer);
    sizeTimer = window.setTimeout(() => {
      buildHtml(stack(), playerJs).then(
        (html) => { exactSize = new Blob([html]).size; paint(); },
        () => { exactSize = undefined; paint(); }); // e.g. no Web Crypto on an insecure origin
    }, 400);
  };

  const ctx: Ctx = {
    stack, card, sel, mode: () => mode,
    dispatch: (cmd: Command) => { const n = exec(hist, cmd); if (n !== hist) { hist = n; changed(); } },
    batch: (cmds) => { const n = execBatch(hist, cmds); if (n !== hist) { hist = n; changed(); } },
    selectCard: (id) => { cardId = id; selId = null; render(); },
    selectObject: (id) => { selId = id; render(); },
    setMode: (m) => { if (m === "play") enterPlay(null); else { if (mode === "play") exitPlay(); mode = m; render(); } },
    render: () => render(),
    draw: async () => {
      const cardNow = card();
      const r = await openPainter({ stack: stack(), card: cardNow, kind: "sprite32" });
      if (!r) return;
      let encoded: { mime: string; data: string };
      try { encoded = encodeDrawing(r.frames, r.delay); } catch {
        await notice("Too many colours for an animation", "Animated drawings can use up to 255 colours. Use fewer custom colours and try again.");
        return;
      }
      const first = r.frames[0] as Pixels;
      const used = usedIds(stack());
      const assetId = nextId("a", used);
      used.add(assetId);
      const id = nextId("o", used);
      const bgnd = first.w === 200 && first.h === 150;
      // Backgrounds fill the card on the bottom layer; sprites are 256 px in the middle, ready to move.
      const rect = bgnd ? { x: 0, y: 0, w: 800, h: 600 } : { x: 272, y: 172, w: 256, h: 256 };
      const obj: StackObject = {
        kind: "image", id, asset: assetId, alt: r.alt, crisp: true, visible: true, actions: [], motion: "none", ...rect,
      };
      ctx.batch([
        { type: "addAsset", id: assetId, asset: encoded },
        { type: "addObject", card: cardNow.id, object: obj },
        ...(bgnd ? [{ type: "reorderObject", object: id, to: 0 } as const] : []),
      ]);
      selId = id;
      const moving = r.frames.length > 1 ? `, ${r.frames.length} frames` : "";
      status = bgnd ? `Added your background${moving} (Ctrl+Z undoes)` : `Added your drawing${moving}: drag it into place`;
      render();
    },
    editDrawing: async (objectId) => {
      const o = stack().cards.flatMap((c) => c.objects).find((x) => x.id === objectId);
      const asset = o?.kind === "image" ? stack().assets[o.asset] : undefined;
      if (!o || o.kind !== "image" || !asset) return;
      // Decode the picture (every frame of a GIF); pixel art scaled up (e.g. 16 px blocks) is shrunk back to
      // its real grid. The block size is shared by all frames, so they stay the same size.
      let full: { w: number; h: number; frames: Pixels[]; delay: number };
      try {
        if (asset.mime === "image/gif") {
          const bin = atob(asset.data), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const gif = decodeGif(bytes);
          full = { w: gif.width, h: gif.height, frames: gif.frames.map((f) => fromRGBA(gif.width, gif.height, f.rgba)), delay: gif.frames[0]?.delay ?? 17 };
        } else {
          const img = new Image();
          img.src = `data:${asset.mime};base64,${asset.data}`;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const g = c.getContext("2d");
          if (!g) return;
          g.drawImage(img, 0, 0);
          full = { w: c.width, h: c.height, frames: [fromRGBA(c.width, c.height, g.getImageData(0, 0, c.width, c.height).data)], delay: 17 };
        }
      } catch {
        await notice("Can't open this picture", "It could not be read.");
        return;
      }
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const k = full.frames.map(blockSize).reduce(gcd, 0) || 1;
      const frames = full.frames.map((f) => downscale(f, k)), first = frames[0] as Pixels;
      if (first.w > MAX_EDIT.w || first.h > MAX_EDIT.h) {
        await notice("This picture is too detailed to draw on", [
          `It is ${first.w}×${first.h} pixels; the drawing tool opens pictures up to ${MAX_EDIT.w}×${MAX_EDIT.h}.`,
          "Photos and large pictures can't be edited here, but you can draw a new picture on top.",
        ]);
        return;
      }
      const r = await openPainter({ stack: stack(), card: card(), start: { frames, delay: full.delay, alt: o.alt } });
      if (!r) return;
      let encoded: { mime: string; data: string };
      try { encoded = encodeDrawing(r.frames, r.delay); } catch {
        await notice("Too many colours for an animation", "Animated drawings can use up to 255 colours.");
        return;
      }
      ctx.batch([
        { type: "replaceAsset", id: o.asset, asset: encoded },
        { type: "updateObject", object: o.id, patch: { crisp: true, alt: r.alt } },
      ]);
      status = "Drawing saved (Ctrl+Z undoes)";
      render();
    },
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
          kind: "image", id, asset: assetId, alt: "", crisp: img.kept, x: 80, y: 80, w, h: hh, visible: true, motion: "none", actions: [],
        };
        ctx.batch([{ type: "addAsset", id: assetId, asset: { mime: img.mime, data: img.data } }, { type: "addObject", card: card().id, object: obj }]);
        selId = id;
        render();
      } catch {
        void notice("That picture could not be read", "Try a PNG, JPEG, WebP or GIF.");
      }
    },
  };

  // ---- Immersive play: full-viewport overlay, browser fullscreen when allowed, Esc to leave. ----
  let overlay: HTMLElement | null = null;
  let fullscreenOn = false;
  /** A stack picked in the gallery to play without replacing the user's own. null = play the user's stack. */
  let guest: Stack | null = null;
  /** Where keyboard focus goes back to after play. */
  let returnFocus: HTMLElement | null = null;

  const mountPlayer = (): void => {
    player?.destroy();
    const host = overlay?.querySelector<HTMLElement>(".play-host");
    if (!host) return;
    player = mount(host, guest ?? stack(), false);
    host.querySelector<HTMLElement>(".sy-root")?.focus({ preventScroll: true }); // Tab starts inside the game
  };
  const showOverlay = (): void => {
    if (overlay) return;
    overlay = h("div", { class: "play-overlay", role: "region", "aria-label": `Playing “${(guest ?? stack()).title}”` },
      h("div", { class: "play-host" }),
      h("div", { class: "play-controls" },
        h("button", { class: "tool", title: "Restart from the first card", "aria-label": "Restart", onclick: mountPlayer }, "↻"),
        h("button", { class: "tool", title: "Exit play mode (Esc)", "aria-label": "Exit play mode", onclick: () => exitPlay() }, "✕ Esc")),
      h("div", { class: "play-hint", role: "status" }, "Press Esc to exit"));
    document.body.append(overlay);
    root.inert = true; // the editor underneath cannot be tabbed into or clicked
    root.classList.add("is-playing"); // ...and is hidden from sight and from screen readers
    mountPlayer();
    const shown = overlay;
    window.setTimeout(() => shown.querySelector(".play-hint")?.classList.add("gone"), 3000);
  };
  const enterPlay = (s: Stack | null = null): void => {
    guest = s;
    // Safari does not focus buttons on click, so activeElement can be <body>: then fall back to the button.
    const at = document.activeElement;
    returnFocus = at instanceof HTMLElement && at !== document.body && !at.closest("dialog") ? at : null;
    mode = "play";
    render();
    // Must run inside the click that started play. Not every browser allows it (iPhone Safari): the overlay still fills the window.
    const req = document.documentElement.requestFullscreen?.bind(document.documentElement);
    if (req) req({ navigationUI: "hide" }).then(() => { fullscreenOn = true; }, () => { fullscreenOn = false; });
  };
  const exitPlay = (): void => {
    if (mode !== "play") return;
    mode = "edit";
    player?.destroy();
    player = null;
    overlay?.remove();
    overlay = null;
    root.inert = false;
    root.classList.remove("is-playing");
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    fullscreenOn = false;
    const wasGuest = guest !== null;
    guest = null;
    render();
    // Back where the user started: the Play button, or the Stacks button after playing an example.
    const label = wasGuest ? "Play an example stack" : "▶ Play";
    (returnFocus?.isConnected ? returnFocus : [...top.querySelectorAll<HTMLElement>("button")].find((b) => b.getAttribute("aria-label") === label))?.focus();
  };
  // Esc inside real fullscreen is consumed by the browser; it tells us through this event.
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && fullscreenOn) exitPlay(); });

  const addObject = (kind: "text" | "button"): void => {
    const id = nextId("o", usedIds(stack()));
    const base = { id, x: 100, y: 100, visible: true, actions: [], motion: "none" } as const;
    const obj: StackObject = kind === "text"
      ? { ...base, kind, w: 440, h: 110, text: "New text", fontSize: 28, bold: false, align: "left", tone: "dark" }
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
  const doExport = async (): Promise<void> => {
    download(`${fileSlug(stack().title)}.html`, "text/html", await buildHtml(stack(), playerJs));
    status = "Exported a single HTML file";
    paint();
  };
  /** Swap in a whole new stack as ONE undo step, keeping the old one as "Previous" in IndexedDB. */
  const replaceWith = (s: Stack, why: string): void => {
    // Re-render only the first time the "Previous" button appears (a full render restarts animations).
    void saveStack(stack(), PREVIOUS).then(() => { if (!hasPrevious) { hasPrevious = true; render(); } }, () => undefined);
    hist = replaceStack(hist, s);
    cardId = s.start;
    selId = null;
    mode = "edit";
    status = `${why} (Ctrl+Z undoes)`;
    scheduleSave();
    render();
  };
  const confirmReplace = (what: string): Promise<boolean> => new Promise((resolve) => {
    const cur = stack();
    modal("Replace your current stack?", [
      h("p", null, `“${cur.title}” (${cur.cards.length} card${cur.cards.length === 1 ? "" : "s"}) will be replaced by ${what}.`),
      h("p", { class: "hint" }, "You can undo this with Ctrl+Z, and the old stack is kept under “Previous” in this browser. For a copy you can keep anywhere, export it first."),
    ], [
      { label: "Cancel", focus: true, run: () => resolve(false) },
      { label: "Export a copy, then replace", run: () => { void doExport().then(() => resolve(true)); } },
      { label: "Replace", primary: true, run: () => resolve(true) },
    ], () => resolve(false));
  });
  const doImport = async (file: File): Promise<void> => {
    const r = importStack(await file.text());
    if (!r.ok) { await notice("Could not import that file", r.errors.slice(0, 4)); return; }
    if (await confirmReplace(`“${r.stack.title}” from ${file.name}`)) replaceWith(r.stack, `Imported “${r.stack.title}”`);
  };
  const restorePrevious = async (): Promise<void> => {
    const p = await loadStack(PREVIOUS);
    if (!p) { hasPrevious = false; render(); await notice("Nothing to restore", "There is no previous stack in this browser."); return; }
    replaceWith(p, `Restored “${p.title}”`); // the current stack becomes "Previous", so this is a swap
  };

  // Rough guess shown only until the real size has been measured.
  const sizeBytes = (): number => exactSize ?? JSON.stringify(pruneAssets(stack())).length + playerJs.length + 2000;
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

  // Work exists once something was edited or an autosave was restored; then replacing needs a yes.
  const hasWork = (): boolean => hist.past.length > 0 || saved !== undefined;
  const startFrom = async (s: Stack, what: string, why: string): Promise<void> => {
    if (!hasWork() || await confirmReplace(what)) replaceWith(s, why);
  };
  const gallery = (): void => openGallery({
    play: (s) => enterPlay(s),
    playMine: () => enterPlay(null),
    edit: (s, info) => void startFrom(s, `the ${info.label} template`, `Started “${s.title}”`),
    mine: () => ({ title: stack().title, cards: stack().cards.length }),
  });
  const quickStart = (): void => openWelcome({
    blank: () => void startFrom(BLANK, "a blank stack", "Started a blank stack"),
    browse: gallery,
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
      h("span", { class: size > SOFT_LIMIT ? "warn" : "" }, `Export size ${exactSize === undefined ? "≈ " : ""}${fmt(size)}${size > SOFT_LIMIT ? " — large! Phones may struggle; try smaller pictures." : ""}`));
  };

  const render = (): void => {
    fix();
    const playing = mode === "play";
    if (playing) { showOverlay(); return; } // the editor stays frozen underneath
    player?.destroy();
    player = null;
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
      btn("✎ Draw", "Draw a picture or background", () => void ctx.draw(), { disabled: mode !== "edit" }),
      h("span", { class: "sep" }),
      modeBtn("edit", "Edit"), modeBtn("map", "Map"), modeBtn("play", "▶ Play"),
      btn("▦ Stacks", "Play an example stack", gallery, { class: "tool stacks" }),
      h("span", { class: "grow" }),
      h("select", { "aria-label": "New from template", value: "", onchange: (e: Event) => {
        const el = e.target as HTMLSelectElement;
        const v = el.value;
        el.value = "";
        if (!v) return;
        const info = v === "blank" ? { id: v, label: "Blank stack" } : TEMPLATE_LIST.find((x) => x.id === v);
        if (!info) return;
        void (v === "blank" ? Promise.resolve(BLANK) : loadTemplate(v)).then((s) => confirmReplace(`the ${info.label} template`).then((ok) => { if (ok) replaceWith(s, `Started “${s.title}”`); }),
          () => notice("Could not load that template", "Please try again."));
      } },
        h("option", { value: "" }, "New from…"), h("option", { value: "blank" }, "Blank stack"),
        ...TEMPLATE_LIST.map((t) => h("option", { value: t.id }, t.label))),
      btn("Import", "Import an exported .html", () => importInput.click()),
      ...(hasPrevious ? [btn("⟲ Previous", "Restore the stack you replaced last", () => void restorePrevious())] : []),
      btn("About", "About Stackyard and its license", () => openAbout(quickStart)),
      btn("Export HTML", "Export one self-contained HTML file", () => void doExport(), { class: "tool primary" }));

    strip.replaceChildren(renderStrip(ctx));
    side.replaceChildren(renderInspector(ctx));
    side.hidden = false;
    if (mode === "map") {
      work.replaceChildren(renderMap(ctx));
    } else {
      work.replaceChildren(renderStage(ctx));
    }
    paint();
  };

  document.addEventListener("keydown", (e) => {
    if (mode === "play") {
      if (e.key === "Escape") { e.preventDefault(); exitPlay(); }
      return; // no editing shortcuts while playing
    }
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
  measure();
  if (!saved && !wasWelcomed()) quickStart();
}
