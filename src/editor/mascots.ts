import candleGif from "../../media/gifs/candle-flicker-transparent.gif?inline";
import candlePng from "../../media/sprites/candle.png?inline";
import ghostGif from "../../media/gifs/ghost-float.gif?inline";
import ghostPng from "../../media/sprites/ghost.png?inline";
import { h } from "./dom";

const calm = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Decorative pixel mascot. Animated GIF normally, a still sprite when the user prefers reduced motion. */
function mascot(animated: string, still: string, cls: string): HTMLImageElement {
  return h("img", { class: `mascot ${cls}`, src: calm() ? still : animated, alt: "", "aria-hidden": "true", draggable: false });
}

export const ghostMascot = (): HTMLImageElement => mascot(ghostGif, ghostPng, "ghost");
export const candleMascot = (): HTMLImageElement => mascot(candleGif, candlePng, "candle");
