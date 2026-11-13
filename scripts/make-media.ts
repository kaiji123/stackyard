// Derives media assets that the art does not ship with. Run: npm run media
// The originals in media/ are never modified.
import { readFileSync, writeFileSync } from "node:fs";
import { clearBackground, decodeGif, encodeGif } from "./gif.ts";

export const DERIVED = [
  // The candle sits on scenes and on the cream card, so its dark square background must go. Its
  // background colour also fills the gaps between flame pixels, so every pixel of it is cleared ("all").
  { src: "media/gifs/candle-flicker.gif", dst: "media/gifs/candle-flicker-transparent.gif", mode: "all" },
] as const;

for (const { src, dst, mode } of DERIVED) {
  const gif = clearBackground(decodeGif(readFileSync(src)), { mode });
  const bytes = encodeGif(gif);
  // Self-check: what we wrote decodes back to exactly the frames we meant.
  const back = decodeGif(bytes);
  const same = back.frames.length === gif.frames.length && back.frames.every((f, i) => Buffer.compare(Buffer.from(f.rgba), Buffer.from(gif.frames[i]?.rgba ?? [])) === 0);
  if (!same) throw new Error(`${dst}: round trip failed`);
  writeFileSync(dst, bytes);
  console.log(`${dst}: ${gif.frames.length} frames, ${(bytes.length / 1024).toFixed(1)} KB`);
}
