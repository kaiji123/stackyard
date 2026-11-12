/**
 * Embedded OFL pixel fonts (Silkscreen, VT323), Latin subset, as data URIs. Used by the editor and
 * inlined into exported files, so the retro look needs no installed fonts and no network.
 * Kept out of the player bundle itself (src/player/entry.ts) to protect the size budget.
 */
import silkscreen from "@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2?inline";
import vt323 from "@fontsource/vt323/files/vt323-latin-400-normal.woff2?inline";

const face = (family: string, url: string): string =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:400;font-display:block;src:url(${url}) format("woff2")}`;

export const FONT_CSS = face("Silkscreen", silkscreen) + face("VT323", vt323);
