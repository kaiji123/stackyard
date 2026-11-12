/** Tiny DOM helpers. Strings become text nodes or attributes; markup is never parsed. */
export type Child = Node | string | null | undefined | false;
type Props = Readonly<Record<string, unknown>>;

function apply(el: Element, props: Props, late: boolean): void {
  for (const [k, v] of Object.entries(props)) {
    // value/checked must be set after <option> children exist.
    if ((k === "value" || k === "checked") !== late) continue;
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "class") el.setAttribute("class", String(v));
    else if (!(el instanceof SVGElement) && k in el) Reflect.set(el, k, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Props | null = null, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, props ?? {}, false);
  for (const c of children) if (c) el.append(c);
  apply(el, props ?? {}, true);
  return el;
}

const NS = "http://www.w3.org/2000/svg";
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K, props: Props | null = null, ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  apply(el, props ?? {}, false);
  for (const c of children) if (c) el.append(c);
  return el;
}
