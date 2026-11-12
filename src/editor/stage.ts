import { clampRect, fitScale, MIN_SIZE, type Rect } from "../core/layout";
import type { StackObject } from "../core/types";
import { CANVAS_H, CANVAS_W } from "../core/types";
import { renderObject } from "../player/player";
import type { Ctx } from "./ctx";
import { h } from "./dom";

/** Screen px per logical px for the live stage. Module-level so drags survive re-renders. */
let scale = 1;

type Corner = "nw" | "ne" | "sw" | "se";

function liveEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.sy-stage.edit [data-id="${CSS.escape(id)}"]`);
}

function place(el: HTMLElement | null, r: Rect): void {
  if (!el) return;
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
}

function drag(ctx: Ctx, e: PointerEvent, o: StackObject, corner: Corner | null): void {
  e.preventDefault();
  e.stopPropagation();
  if (ctx.sel()?.id !== o.id) ctx.selectObject(o.id);
  const sx = e.clientX, sy = e.clientY;
  const base: Rect = { x: o.x, y: o.y, w: o.w, h: o.h };
  let cur = base;
  let moved = false;
  const onMove = (ev: PointerEvent): void => {
    const dx = Math.round((ev.clientX - sx) / scale);
    const dy = Math.round((ev.clientY - sy) / scale);
    if (dx === 0 && dy === 0 && !moved) return;
    moved = true;
    let { x, y, w, h: hh } = base;
    if (corner === null) {
      x += dx; y += dy;
    } else {
      if (corner.endsWith("e")) w = Math.max(MIN_SIZE, base.w + dx);
      else { w = Math.max(MIN_SIZE, base.w - dx); x = base.x + base.w - w; }
      if (corner.startsWith("s")) hh = Math.max(MIN_SIZE, base.h + dy);
      else { hh = Math.max(MIN_SIZE, base.h - dy); y = base.y + base.h - hh; }
    }
    cur = clampRect({ x, y, w, h: hh });
    place(liveEl(o.id), cur);
    place(document.querySelector<HTMLElement>(".ed-sel"), cur);
  };
  const onUp = (): void => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (moved) ctx.dispatch({ type: "updateObject", object: o.id, patch: cur });
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/** The editable card canvas: select, drag, resize. Objects use the same renderer as the player. */
export function renderStage(ctx: Ctx): HTMLElement {
  const stack = ctx.stack();
  const sel = ctx.sel();
  const stage = h("div", { class: "sy-stage edit" });
  for (const o of ctx.card().objects) {
    const el = renderObject(stack, o);
    el.classList.add("ed-obj");
    if (!o.visible) el.classList.add("ed-hidden");
    el.addEventListener("pointerdown", (e) => drag(ctx, e, o, null));
    stage.append(el);
  }
  if (sel) {
    const corners: Corner[] = ["nw", "ne", "sw", "se"];
    const box = h("div", { class: "ed-sel" },
      ...corners.map((c) => h("div", { class: `ed-handle ${c}`, onpointerdown: (e: Event) => drag(ctx, e as PointerEvent, sel, c) })));
    place(box, sel);
    stage.append(box);
  }
  stage.addEventListener("pointerdown", () => { if (ctx.sel()) ctx.selectObject(null); });

  const wrap = h("div", { class: "stage-wrap" }, stage);
  const work = h("div", { class: "work-edit" }, wrap);
  const fit = (): void => {
    const r = work.getBoundingClientRect();
    scale = fitScale(r.width - 48, r.height - 48);
    wrap.style.width = `${CANVAS_W * scale}px`;
    wrap.style.height = `${CANVAS_H * scale}px`;
    stage.style.transform = `scale(${scale})`;
  };
  // Start at the last known scale so re-renders do not flash an unscaled stage.
  wrap.style.width = `${CANVAS_W * scale}px`;
  wrap.style.height = `${CANVAS_H * scale}px`;
  stage.style.transform = `scale(${scale})`;
  new ResizeObserver(fit).observe(work);
  requestAnimationFrame(fit);
  return work;
}
