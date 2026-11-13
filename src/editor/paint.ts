// The drawing tool: a pixel painter in a dialog, with frames for animation. Pure pixel work lives in
// pixels.ts; this file is the UI. Mouse, touch and keyboard all draw. In background mode the current card
// shows faintly underneath, so people can trace and line their picture up with what is already there.
import type { Card, Stack } from "../core/types";
import { encodeGif } from "../export/gif";
import { renderObject } from "../player/player";
import { closeModal, modal } from "./dialogs";
import { h } from "./dom";
import { PALETTE } from "./palette";
import {
  blank, boxCells, brush, colourAt, coloursUsed, fill, fromHex, hex, isEmpty, lineCells, mirror, paint, toRGBA,
  TRANSPARENT, type Cell, type Pixels,
} from "./pixels";

export type DrawKind = "sprite16" | "sprite32" | "background";
export const SIZES: Readonly<Record<DrawKind, { w: number; h: number; label: string }>> = {
  sprite16: { w: 16, h: 16, label: "Small sprite 16×16" },
  sprite32: { w: 32, h: 32, label: "Sprite 32×32" },
  background: { w: 200, h: 150, label: "Background (whole card)" },
};

/** Frames per second offered for animations, and the GIF delay (hundredths of a second) each one means. */
export const SPEEDS: readonly number[] = [2, 4, 6, 8, 12];
export const delayFor = (fps: number): number => Math.max(2, Math.round(100 / fps));
export const fpsFor = (delay: number): number =>
  SPEEDS.reduce((best, f) => (Math.abs(delayFor(f) - delay) < Math.abs(delayFor(best) - delay) ? f : best), 6);
export const MAX_FRAMES = 24;

export interface PaintResult {
  readonly frames: readonly Pixels[];
  /** Hundredths of a second per frame (only meaningful with more than one frame). */
  readonly delay: number;
  readonly kind: DrawKind | "edit";
  readonly alt: string;
}

type Tool = "pen" | "eraser" | "fill" | "line" | "box" | "pick";
const TOOLS: readonly (readonly [Tool, string, string])[] = [
  ["pen", "Pen", "P"], ["eraser", "Erase", "E"], ["fill", "Fill", "F"], ["line", "Line", "L"], ["box", "Box", "B"], ["pick", "Pick", "I"],
];

export interface PaintOptions {
  /** Start from an existing drawing (editing), or choose a size (new drawing). */
  readonly start?: { frames: readonly Pixels[]; delay: number; alt: string };
  readonly kind?: DrawKind;
  /** The card being drawn on, shown faintly under backgrounds. */
  readonly stack: Stack;
  readonly card: Card;
}

interface Snapshot { readonly frames: readonly Pixels[]; readonly cur: number }

const calm = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Open the painter. Resolves with the drawing, or null if the user cancels. */
export function openPainter(opts: PaintOptions): Promise<PaintResult | null> {
  return new Promise((resolve) => {
    let kind: DrawKind | "edit" = opts.start ? "edit" : opts.kind ?? "sprite32";
    const startSize = SIZES[kind === "edit" ? "sprite32" : kind];
    let frames: Pixels[] = opts.start ? [...opts.start.frames] : [blank(startSize.w, startSize.h)];
    let cur = 0;
    let pix: Pixels = frames[0] as Pixels; // the frame being drawn; always equals frames[cur] between strokes
    let fps = opts.start ? fpsFor(opts.start.delay) : 6;
    let tool: Tool = "pen";
    let colour = fromHex("#ff9d3c");
    let size = 1;
    let mirrored = false;
    let onionOn = true;
    let dirty = false;
    let cursor: Cell = [Math.floor(pix.w / 2), Math.floor(pix.h / 2)];
    let anchor: Cell | null = null;     // first corner for line/box (pointer drag or keyboard)
    let base: Pixels | null = null;     // frame before the current stroke, for previews
    let last: Cell | null = null;       // previous cell of a pen stroke
    const past: Snapshot[] = [], future: Snapshot[] = [];
    let discardArmed = false;
    let switchArmed: DrawKind | null = null; // a second click on another size clears the drawing
    let playing = false;
    let timer: number | undefined;
    let shown = 0;                           // frame shown in the preview

    // ---- Elements ------------------------------------------------------------------------------------
    const canvas = h("canvas", { class: "paint-canvas", tabindex: 0, role: "img", "aria-label": "Drawing area. Use the arrow keys to move, Space to draw." });
    const onion = h("div", { class: "paint-onion", "aria-hidden": "true" });
    const stage = h("div", { class: "paint-stage" }, onion, canvas);
    const status = h("p", { class: "paint-status", role: "status", "aria-live": "polite" });
    const swatchRow = h("div", { class: "paint-palette", role: "radiogroup", "aria-label": "Colour" });
    const custom = h("input", { type: "color", class: "paint-custom", "aria-label": "Any colour", value: hex(colour) });
    const altInput = h("input", { type: "text", class: "paint-alt", maxLength: 120, placeholder: "e.g. a green ghost waving", value: opts.start?.alt ?? "" });
    const sizeRow = h("div", { class: "paint-sizes", role: "radiogroup", "aria-label": "What are you drawing?" });
    const toolRow = h("div", { class: "paint-tools", role: "toolbar", "aria-label": "Tools" });
    const brushSel = h("select", { "aria-label": "Brush size", class: "paint-brush" },
      ...[1, 2, 4, 8].map((n) => h("option", { value: String(n) }, `Brush ${n}`)));
    const undoBtn = h("button", { class: "tool", "aria-label": "Undo drawing (Ctrl+Z)", title: "Undo (Ctrl+Z)" }, "↶");
    const redoBtn = h("button", { class: "tool", "aria-label": "Redo drawing (Ctrl+Shift+Z)", title: "Redo" }, "↷");
    const mirrorBtn = h("button", { class: "tool", "aria-pressed": "false", title: "Mirror left and right (M)" }, "⇋ Mirror");
    const clearBtn = h("button", { class: "tool", title: "Clear this frame" }, "Clear");
    const saveBtn = h("button", { class: "tool primary" }, opts.start ? "Save drawing" : "Add to card");
    const cancelBtn = h("button", { class: "tool" }, "Cancel");
    // Animation.
    const strip = h("div", { class: "paint-frames", role: "listbox", "aria-label": "Frames" });
    const addFrameBtn = h("button", { class: "tool", title: "New frame: a copy of this one (N)" }, "＋ Frame");
    const delFrameBtn = h("button", { class: "tool", title: "Delete this frame" }, "Delete frame");
    const leftBtn = h("button", { class: "tool", "aria-label": "Move frame earlier", title: "Move earlier" }, "◀");
    const rightBtn = h("button", { class: "tool", "aria-label": "Move frame later", title: "Move later" }, "▶");
    const onionBtn = h("button", { class: "tool", "aria-pressed": "true", title: "Show the previous frame faintly (O)" }, "Onion skin");
    const speedSel = h("select", { "aria-label": "Speed", class: "paint-speed" },
      ...SPEEDS.map((f) => h("option", { value: String(f) }, `${f} frames a second`)));
    const playBtn = h("button", { class: "tool", "aria-pressed": "false", title: "Play the animation (Enter on the preview)" }, "▶ Preview");
    const preview = h("canvas", { class: "paint-preview", role: "img", "aria-label": "Animation preview" });
    speedSel.value = String(fps);

    const ctx = canvas.getContext("2d");
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    const pctx = preview.getContext("2d");

    const bitmap = (p: Pixels): HTMLCanvasElement => {
      const c = document.createElement("canvas");
      c.width = p.w; c.height = p.h;
      c.getContext("2d")?.putImageData(new ImageData(toRGBA(p), p.w, p.h), 0, 0);
      return c;
    };

    // ---- Drawing on screen ---------------------------------------------------------------------------
    let cell = 8; // screen pixels per drawing pixel
    const layout = (): void => {
      const maxW = Math.min(760, window.innerWidth - 60), maxH = Math.min(400, window.innerHeight - 420);
      cell = Math.max(2, Math.floor(Math.min(maxW / pix.w, Math.max(160, maxH) / pix.h)));
      canvas.width = pix.w * cell; canvas.height = pix.h * cell;
      off.width = pix.w; off.height = pix.h;
      stage.style.width = `${canvas.width}px`; stage.style.height = `${canvas.height}px`;
      const k = Math.max(1, Math.floor(96 / Math.max(pix.w, pix.h)));
      preview.width = pix.w * k; preview.height = pix.h * k;
      drawOnion();
      redraw();
    };
    const drawOnion = (): void => {
      onion.replaceChildren();
      if (kind !== "background" && !(kind === "edit" && pix.w === 200 && pix.h === 150)) return;
      const ghost = h("div", { class: "sy-stage paint-ghost" });
      for (const o of opts.card.objects) if (o.visible) ghost.append(renderObject(opts.stack, o));
      ghost.style.transform = `scale(${canvas.width / 800})`;
      onion.append(ghost);
    };
    const drawPreview = (): void => {
      if (!pctx) return;
      const f = frames[playing ? shown % frames.length : cur] as Pixels;
      pctx.imageSmoothingEnabled = false;
      pctx.clearRect(0, 0, preview.width, preview.height);
      pctx.drawImage(bitmap(f), 0, 0, preview.width, preview.height);
    };
    const drawStrip = (): void => {
      strip.replaceChildren(...frames.map((f, i) => {
        const thumb = bitmap(f);
        thumb.className = "paint-thumb";
        const item = h("button", {
          class: `paint-frame${i === cur ? " on" : ""}`, role: "option", "aria-selected": String(i === cur),
          "aria-label": `Frame ${i + 1}${isEmpty(f) ? " (empty)" : ""}`, onclick: () => selectFrame(i),
        }, thumb, h("span", null, String(i + 1)));
        return item;
      }));
      delFrameBtn.toggleAttribute("disabled", frames.length <= 1);
      leftBtn.toggleAttribute("disabled", cur === 0);
      rightBtn.toggleAttribute("disabled", cur === frames.length - 1);
      addFrameBtn.toggleAttribute("disabled", frames.length >= MAX_FRAMES);
      playBtn.toggleAttribute("disabled", frames.length <= 1);
    };
    const redraw = (): void => {
      if (!ctx || !offCtx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      // Onion skin: the previous frame, faint, under this one.
      if (onionOn && frames.length > 1) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(bitmap(frames[(cur - 1 + frames.length) % frames.length] as Pixels), 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
      offCtx.putImageData(new ImageData(toRGBA(pix), pix.w, pix.h), 0, 0);
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      if (cell >= 6) {
        ctx.strokeStyle = "rgba(13,8,20,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < pix.w; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, canvas.height); }
        for (let y = 1; y < pix.h; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(canvas.width, y * cell + 0.5); }
        ctx.stroke();
      }
      if (mirrored) {
        ctx.strokeStyle = "rgba(255,157,60,0.8)";
        ctx.beginPath(); ctx.moveTo(canvas.width / 2 + 0.5, 0); ctx.lineTo(canvas.width / 2 + 0.5, canvas.height); ctx.stroke();
      }
      if (document.activeElement === canvas) {
        ctx.strokeStyle = "#ffb000"; ctx.lineWidth = 2;
        ctx.strokeRect(cursor[0] * cell + 1, cursor[1] * cell + 1, cell * size - 2, cell * size - 2);
        if (anchor) { ctx.setLineDash([3, 3]); ctx.strokeRect(anchor[0] * cell + 1, anchor[1] * cell + 1, cell - 2, cell - 2); ctx.setLineDash([]); }
      }
      const name = PALETTE.find((p) => fromHex(p.hex) === colour)?.name ?? hex(colour);
      const frameNote = frames.length > 1 ? ` · frame ${cur + 1} of ${frames.length}` : "";
      status.textContent = `x ${cursor[0] + 1}, y ${cursor[1] + 1} of ${pix.w}×${pix.h}${frameNote} · ${TOOLS.find((t) => t[0] === tool)?.[1]} · ${tool === "eraser" ? "transparent" : name}${anchor ? " · press Space again to finish" : ""}`;
      undoBtn.toggleAttribute("disabled", past.length === 0);
      redoBtn.toggleAttribute("disabled", future.length === 0);
      saveBtn.toggleAttribute("disabled", frames.every(isEmpty) && isEmpty(pix));
      drawPreview();
    };

    // ---- History: every change to any frame, or to the list of frames, is one step -------------------
    const snapshot = (): Snapshot => ({ frames: [...frames], cur });
    const restore = (s: Snapshot): void => { frames = [...s.frames]; cur = s.cur; pix = frames[cur] as Pixels; drawStrip(); redraw(); };
    const record = (): void => {
      past.push(snapshot()); if (past.length > 60) past.shift();
      future.length = 0; dirty = true; discardArmed = false;
    };
    const commit = (next: Pixels): void => {
      if (next === frames[cur]) { pix = next; redraw(); return; }
      record();
      frames[cur] = next; pix = next;
      drawStrip(); redraw();
    };

    // ---- Frames --------------------------------------------------------------------------------------
    const selectFrame = (i: number): void => {
      if (i < 0 || i >= frames.length || i === cur) return;
      cur = i; pix = frames[i] as Pixels; anchor = null;
      drawStrip(); redraw();
      strip.querySelectorAll<HTMLElement>(".paint-frame")[i]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    addFrameBtn.addEventListener("click", () => {
      if (frames.length >= MAX_FRAMES) return;
      record();
      frames.splice(cur + 1, 0, pix); cur += 1; // a copy of the current frame, ready to change a little
      drawStrip(); redraw();
      status.textContent = `Frame ${cur + 1} added: a copy of frame ${cur}. Change it a little to make it move.`;
    });
    delFrameBtn.addEventListener("click", () => {
      if (frames.length <= 1) return;
      record();
      frames.splice(cur, 1); cur = Math.min(cur, frames.length - 1); pix = frames[cur] as Pixels;
      drawStrip(); redraw();
    });
    const moveFrame = (d: number): void => {
      const to = cur + d;
      if (to < 0 || to >= frames.length) return;
      record();
      const [f] = frames.splice(cur, 1);
      frames.splice(to, 0, f as Pixels); cur = to;
      drawStrip(); redraw();
    };
    leftBtn.addEventListener("click", () => moveFrame(-1));
    rightBtn.addEventListener("click", () => moveFrame(1));
    onionBtn.addEventListener("click", () => { onionOn = !onionOn; onionBtn.setAttribute("aria-pressed", String(onionOn)); redraw(); });
    speedSel.addEventListener("change", () => { fps = Number(speedSel.value) || 6; if (playing) { stop(); play(); } });
    const play = (): void => {
      if (frames.length <= 1) return;
      playing = true; playBtn.setAttribute("aria-pressed", "true"); playBtn.textContent = "■ Stop";
      shown = cur;
      if (calm()) { status.textContent = "Preview paused: your device asks for reduced motion. Step through frames instead."; stop(); return; }
      timer = window.setInterval(() => { shown = (shown + 1) % frames.length; drawPreview(); }, 1000 / fps);
    };
    const stop = (): void => {
      playing = false; window.clearInterval(timer);
      playBtn.setAttribute("aria-pressed", "false"); playBtn.textContent = "▶ Preview";
      drawPreview();
    };
    playBtn.addEventListener("click", () => (playing ? stop() : play()));

    // ---- Editing -------------------------------------------------------------------------------------
    const stamp = (cells: readonly Cell[]): Cell[] => (mirrored ? mirror(brush(cells, size), pix.w) : brush(cells, size));
    const ink = (): number => (tool === "eraser" ? TRANSPARENT : colour);

    const begin = (c: Cell): void => {
      if (tool === "pick") { const picked = colourAt(pix, c[0], c[1]); if (picked !== TRANSPARENT) setColour(picked); setTool("pen"); return; }
      if (tool === "fill") { commit(fill(pix, c[0], c[1], colour)); return; }
      base = pix;
      if (tool === "line" || tool === "box") { anchor = c; previewShape(c); return; }
      last = c;
      pix = paint(pix, stamp([c]), ink()); redraw();
    };
    const move = (c: Cell): void => {
      if (!base) return;
      if (tool === "line" || tool === "box") { previewShape(c); return; }
      pix = paint(pix, stamp(lineCells(last?.[0] ?? c[0], last?.[1] ?? c[1], c[0], c[1])), ink());
      last = c; redraw();
    };
    const previewShape = (c: Cell): void => {
      if (!base || !anchor) return;
      const cells = tool === "line" ? lineCells(anchor[0], anchor[1], c[0], c[1]) : boxCells(anchor[0], anchor[1], c[0], c[1]);
      pix = paint(base, stamp(cells), colour); redraw();
    };
    const end = (): void => {
      if (!base) return;
      const after = pix;
      base = null; last = null; anchor = null;
      pix = frames[cur] as Pixels;
      commit(after);
    };

    // ---- Pointer (mouse, pen and touch) --------------------------------------------------------------
    const cellAt = (e: PointerEvent): Cell => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * pix.w), y = Math.floor(((e.clientY - r.top) / r.height) * pix.h);
      return [Math.min(pix.w - 1, Math.max(0, x)), Math.min(pix.h - 1, Math.max(0, y))];
    };
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      cursor = cellAt(e);
      begin(cursor);
    });
    canvas.addEventListener("pointermove", (e) => { if (base) { cursor = cellAt(e); move(cursor); } });
    canvas.addEventListener("pointerup", () => end());
    canvas.addEventListener("pointercancel", () => end());
    canvas.addEventListener("focus", redraw);
    canvas.addEventListener("blur", redraw);

    // ---- Keyboard: arrows move a cursor, Space draws, [ and ] change frame ---------------------------
    canvas.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 4 : 1;
      const moves: Record<string, Cell> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const mv = moves[e.key];
      if (mv) {
        e.preventDefault();
        cursor = [Math.min(pix.w - 1, Math.max(0, cursor[0] + mv[0])), Math.min(pix.h - 1, Math.max(0, cursor[1] + mv[1]))];
        if (anchor) previewShape(cursor);
        else if (base) move(cursor);
        redraw();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        if (tool === "line" || tool === "box") { if (anchor) end(); else begin(cursor); return; }
        begin(cursor);
        if (tool === "pen" || tool === "eraser") end();
      }
    });

    // ---- Controls ------------------------------------------------------------------------------------
    const setTool = (t: Tool): void => {
      tool = t; anchor = null;
      toolRow.querySelectorAll<HTMLElement>("button[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset["tool"] === t)));
      redraw();
    };
    const setColour = (c: number): void => {
      colour = c; custom.value = hex(c);
      swatchRow.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-checked", String(fromHex(b.dataset["hex"] ?? "#000000") === c)));
      if (tool === "eraser" || tool === "pick") setTool("pen");
      redraw();
    };
    for (const [t, label, key] of TOOLS) {
      toolRow.append(h("button", { class: "tool", "data-tool": t, "aria-pressed": String(t === tool), title: `${label} (${key})`, onclick: () => setTool(t) }, label));
    }
    toolRow.append(brushSel, mirrorBtn, undoBtn, redoBtn, clearBtn);
    brushSel.addEventListener("change", () => { size = Number(brushSel.value) || 1; redraw(); });
    mirrorBtn.addEventListener("click", () => { mirrored = !mirrored; mirrorBtn.setAttribute("aria-pressed", String(mirrored)); redraw(); });
    undoBtn.addEventListener("click", () => { const s = past.pop(); if (s) { future.push(snapshot()); restore(s); } });
    redoBtn.addEventListener("click", () => { const s = future.pop(); if (s) { past.push(snapshot()); restore(s); } });
    clearBtn.addEventListener("click", () => commit(blank(pix.w, pix.h)));
    custom.addEventListener("input", () => setColour(fromHex(custom.value)));

    const extra = opts.start
      ? [...new Set(opts.start.frames.flatMap(coloursUsed))].filter((c) => !PALETTE.some((p) => fromHex(p.hex) === c)).slice(0, 12)
      : [];
    for (const p of [...PALETTE.map((x) => ({ name: x.name, c: fromHex(x.hex) })), ...extra.map((c) => ({ name: `Colour ${hex(c)} (from this picture)`, c }))]) {
      swatchRow.append(h("button", {
        class: "swatch", role: "radio", "aria-label": p.name, title: p.name, "data-hex": hex(p.c), "aria-checked": String(p.c === colour),
        style: `background:${hex(p.c)}`, onclick: () => setColour(p.c),
      }));
    }

    if (!opts.start) {
      for (const k of Object.keys(SIZES) as DrawKind[]) {
        sizeRow.append(h("button", {
          class: "tool", role: "radio", "aria-checked": String(k === kind), "data-kind": k,
          onclick: () => {
            if (k === kind) return;
            if (dirty && switchArmed !== k) {
              switchArmed = k;
              status.textContent = `Click “${SIZES[k].label}” again to clear your drawing and switch.`;
              return;
            }
            switchArmed = null;
            stop();
            kind = k; frames = [blank(SIZES[k].w, SIZES[k].h)]; cur = 0; pix = frames[0] as Pixels;
            past.length = 0; future.length = 0; dirty = false;
            cursor = [Math.floor(pix.w / 2), Math.floor(pix.h / 2)];
            sizeRow.querySelectorAll<HTMLElement>("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset["kind"] === k)));
            drawStrip(); layout();
          },
        }, SIZES[k].label));
      }
    }

    // ---- Dialog --------------------------------------------------------------------------------------
    const animRow = h("div", { class: "paint-anim" },
      h("div", { class: "paint-anim-tools" }, addFrameBtn, delFrameBtn, leftBtn, rightBtn, onionBtn, speedSel, playBtn),
      h("div", { class: "paint-anim-body" }, strip, h("div", { class: "paint-preview-box" }, preview, h("span", null, "Preview"))));
    const dlg = modal(opts.start ? "Edit drawing" : "Draw", [
      opts.start ? h("p", { class: "hint" }, `Editing a ${pix.w}×${pix.h} picture${frames.length > 1 ? ` with ${frames.length} frames` : ""}. Every card that uses it will change.`) : sizeRow,
      toolRow,
      swatchRow,
      h("div", { class: "paint-colour-row" }, h("span", null, "Or any colour:"), custom),
      h("div", { class: "paint-wrap" }, stage),
      status,
      h("details", { class: "paint-animation", open: frames.length > 1 },
        h("summary", null, "Animation: add frames to make it move"),
        animRow),
      h("label", { class: "field" }, h("span", null, "Describe your picture (read aloud to people who can't see it)"), altInput),
      h("div", { class: "modal-actions" }, cancelBtn, saveBtn),
    ], [], () => { cleanup(); resolve(null); });
    dlg.classList.add("wide", "paint");

    const cleanup = (): void => { window.clearInterval(timer); window.removeEventListener("resize", layout); };
    const finish = (result: PaintResult | null): void => { cleanup(); closeModal(dlg); resolve(result); };
    saveBtn.addEventListener("click", () => {
      if (frames.every(isEmpty)) return;
      finish({ frames: [...frames], delay: delayFor(fps), kind, alt: altInput.value.trim() });
    });
    cancelBtn.addEventListener("click", () => finish(null));
    // Esc with unsaved work asks twice instead of throwing the drawing away.
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dirty && !discardArmed) {
        e.preventDefault(); e.stopPropagation();
        discardArmed = true;
        status.textContent = "Press Esc again to throw this drawing away, or keep drawing.";
      }
      const k = e.key.toLowerCase(), typing = (e.target as HTMLElement).matches("input, select");
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); (e.shiftKey ? redoBtn : undoBtn).click(); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "[") { selectFrame(cur - 1); return; }
      if (k === "]") { selectFrame(cur + 1); return; }
      if (k === "n") { addFrameBtn.click(); return; }
      if (k === "o") { onionBtn.click(); return; }
      const t = TOOLS.find(([, , key]) => key.toLowerCase() === k);
      if (t) { setTool(t[0]); return; }
      if (k === "m") mirrorBtn.click();
    }, true);
    window.addEventListener("resize", layout);
    drawStrip();
    layout();
    canvas.focus({ preventScroll: true });
  });
}

/** Encode a still drawing as a PNG (base64, no "data:" prefix), one image pixel per drawing pixel. */
export function pixelsToPng(p: Pixels): string {
  const c = document.createElement("canvas");
  c.width = p.w; c.height = p.h;
  c.getContext("2d")?.putImageData(new ImageData(toRGBA(p), p.w, p.h), 0, 0);
  return c.toDataURL("image/png").split(",")[1] ?? "";
}

/**
 * Encode a drawing for storing in the stack: one frame becomes a PNG, several become a looping animated
 * GIF (which plays everywhere, including exported files, with no player code). Throws if the frames use
 * more than 255 colours, the GIF limit.
 */
export function encodeDrawing(frames: readonly Pixels[], delay: number): { mime: string; data: string } {
  const first = frames[0];
  if (!first) throw new Error("No frames");
  if (frames.length === 1) return { mime: "image/png", data: pixelsToPng(first) };
  const bytes = encodeGif({ width: first.w, height: first.h, frames: frames.map((f) => ({ rgba: Uint8Array.from(toRGBA(f)), delay })) });
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mime: "image/gif", data: btoa(bin) };
}

/** The largest picture the painter will open for editing (in big pixels). */
export const MAX_EDIT = { w: 256, h: 200 } as const;
