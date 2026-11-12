/**
 * Tiny runtime. Renders a Stack and runs actions through src/core/engine, so play mode in the
 * editor and exported files behave identically. User text is only ever set via textContent.
 */
import { click, findCard, initState, visibleObjects, type PlayState } from "../core/engine";
import { fitScale } from "../core/layout";
import type { Stack, StackObject } from "../core/types";

const SAFE_MIME = /^image\/[a-z0-9.+-]{1,20}$/i;
const SAFE_B64 = /^[a-z0-9+/=]*$/i;

export function assetUrl(stack: Stack, id: string): string | undefined {
  const a = Object.prototype.hasOwnProperty.call(stack.assets, id) ? stack.assets[id] : undefined;
  return a && SAFE_MIME.test(a.mime) && SAFE_B64.test(a.data) ? `data:${a.mime};base64,${a.data}` : undefined;
}

/** Build the DOM element for one object. `onClick` is omitted for static thumbnails. */
export function renderObject(stack: Stack, o: StackObject, onClick?: () => void): HTMLElement {
  let el: HTMLElement;
  const clickable = onClick !== undefined && o.actions.length > 0;
  if (o.kind === "button") {
    const b = document.createElement("button");
    b.type = "button";
    el = b;
    el.className = "sy-obj sy-btn";
    el.textContent = o.label;
    if (onClick === undefined) el.tabIndex = -1;
  } else if (o.kind === "image") {
    const img = document.createElement("img");
    img.className = "sy-obj sy-img";
    img.alt = o.alt;
    const url = assetUrl(stack, o.asset);
    if (url) img.src = url;
    img.draggable = false;
    el = img;
  } else {
    el = document.createElement("div");
    el.className = "sy-obj sy-text";
    el.textContent = o.text;
    el.style.fontSize = `${o.fontSize}px`;
    el.style.fontWeight = o.bold ? "bold" : "normal";
    el.style.textAlign = o.align;
  }
  el.style.left = `${o.x}px`;
  el.style.top = `${o.y}px`;
  el.style.width = `${o.w}px`;
  el.style.height = `${o.h}px`;
  el.dataset["id"] = o.id;
  if (clickable && onClick) {
    if (o.kind !== "button") {
      el.classList.add("sy-click");
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      });
    }
    el.addEventListener("click", onClick);
  }
  return el;
}

export interface Mounted {
  destroy(): void;
  state(): PlayState;
}

/** Mount a stack into `root`. `embedded` keeps the stage inside root instead of filling the window. */
export function mount(root: HTMLElement, stack: Stack, embedded = false): Mounted {
  const host = document.createElement("div");
  host.className = embedded ? "sy-root sy-embedded" : "sy-root";
  const stage = document.createElement("div");
  stage.className = "sy-stage";
  stage.setAttribute("role", "group");
  if (stack.skin === "haunted") stage.classList.add("sy-haunted");
  host.append(stage);
  root.replaceChildren(host);

  let state = initState(stack);

  const fit = (): void => {
    const r = embedded ? host.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    stage.style.transform = `scale(${fitScale(r.width - 24, r.height - 24)})`;
  };

  const draw = (): void => {
    const card = findCard(stack, state.card);
    stage.setAttribute("aria-label", card ? card.name : "");
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement.dataset["id"] : undefined;
    stage.replaceChildren(...visibleObjects(stack, state).map((o) =>
      renderObject(stack, o, () => { state = click(stack, state, o.id); draw(); })));
    if (prevFocus) stage.querySelector<HTMLElement>(`[data-id="${CSS.escape(prevFocus)}"]`)?.focus();
  };

  // Haunted skin: a fading ghost trail behind the pointer (skipped for reduced-motion users).
  let lastGhost = 0;
  const trail = (e: PointerEvent): void => {
    if (e.timeStamp - lastGhost < 70 || host.querySelectorAll(".sy-ghost").length > 14) return;
    lastGhost = e.timeStamp;
    const g = document.createElement("div");
    g.className = "sy-ghost";
    g.style.left = `${e.clientX}px`;
    g.style.top = `${e.clientY}px`;
    g.addEventListener("animationend", () => g.remove());
    host.append(g);
  };
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (stack.skin === "haunted" && !calm) {
    host.addEventListener("pointermove", trail);
  }

  const onResize = (): void => fit();
  window.addEventListener("resize", onResize);
  fit();
  draw();
  // Embedded hosts may not be laid out yet.
  if (embedded) requestAnimationFrame(fit);
  return {
    destroy: () => { window.removeEventListener("resize", onResize); host.remove(); },
    state: () => state,
  };
}
