// Draws Stackyard's story art from code and writes it into media/. Run: npm run art
// Deterministic: the same code always writes the same bytes (a test checks the files are up to date).
// Files written here are listed in ART; the original media are never touched.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Grid } from "./art/grid.ts";
import * as scenes from "./art/scenes.ts";
import * as sprites from "./art/sprites.ts";
import * as train from "./art/train.ts";
import * as beasts from "./art/bestiary.ts";
import { encodeGif } from "./gif.ts";
import { encodePng } from "./png.ts";

/** A still picture (PNG), or an animation (GIF) when `frames` is given. */
export interface ArtFile {
  readonly file: string;
  readonly scale: number;
  readonly draw: () => Grid;
  readonly frames?: { readonly count: number; readonly draw: (frame: number) => Grid; readonly delay: number };
}

export const ART: readonly ArtFile[] = [
  { file: "media/backgrounds/bg-foyer.png", draw: scenes.foyer, scale: 4 },
  { file: "media/backgrounds/bg-portrait.png", draw: scenes.portrait, scale: 4 },
  { file: "media/backgrounds/bg-cellar-open.png", draw: scenes.cellarOpen, scale: 4 },
  { file: "media/backgrounds/bg-clearing.png", draw: scenes.clearing, scale: 4 },
  { file: "media/backgrounds/bg-dawn-house.png", draw: scenes.dawnHouse, scale: 4 },
  { file: "media/backgrounds/bg-fog-road.png", draw: scenes.fogRoad, scale: 4 },
  { file: "media/sprites/eleanor.png", draw: sprites.eleanor, scale: 16 },
  { file: "media/sprites/diary.png", draw: sprites.diary, scale: 16 },
  { file: "media/sprites/letter.png", draw: sprites.letter, scale: 16 },
  { file: "media/sprites/gravestone.png", draw: sprites.gravestone, scale: 16 },
  { file: "media/sprites/lantern.png", draw: sprites.lantern, scale: 16 },
  { file: "media/pumpkin-steps/0-tools.png", draw: sprites.tools, scale: 12 },
  { file: "media/pumpkin-steps/7-seeds.png", draw: sprites.seeds, scale: 12 },
  // The Midnight Train.
  { file: "media/train/bg-platform.png", draw: train.platform, scale: 4 },
  { file: "media/train/bg-arrival.png", draw: train.arrival, scale: 4 },
  { file: "media/train/bg-carriage.png", draw: train.carriage, scale: 4 },
  { file: "media/train/bg-window.png", draw: train.windowFrame, scale: 4 },
  { file: "media/train/bg-corridor.png", draw: train.corridor, scale: 4 },
  { file: "media/train/bg-dining.png", draw: train.dining, scale: 4 },
  { file: "media/train/bg-sleeper.png", draw: train.sleeper, scale: 4 },
  { file: "media/train/bg-luggage.png", draw: train.luggage, scale: 4 },
  { file: "media/train/bg-bridge.png", draw: train.bridge, scale: 4 },
  { file: "media/train/bg-home.png", draw: train.homeDawn, scale: 4 },
  { file: "media/train/bg-last-stop.png", draw: train.endOfLine, scale: 4 },
  { file: "media/train/conductor.png", draw: train.conductor, scale: 8 },
  { file: "media/train/mrs-pell.png", draw: train.mrsPell, scale: 8 },
  { file: "media/train/pip.png", draw: train.pip, scale: 8 },
  { file: "media/train/biscuit.png", draw: train.biscuit, scale: 8 },
  { file: "media/train/spectacles.png", draw: train.spectacles, scale: 16 },
  { file: "media/train/music-box.png", draw: train.musicBox, scale: 16 },
  { file: "media/train/ticket.png", draw: train.ticket, scale: 8 },
  { file: "media/train/ticket-punched.png", draw: train.ticketPunched, scale: 8 },
  { file: "media/train/station-clock.png", draw: train.stationClock, scale: 16 },
  { file: "media/train/steam.gif", draw: () => train.steam(0), scale: 4, frames: { count: train.STEAM_FRAMES, draw: train.steam, delay: 12 } },
  // The Halloween Bestiary.
  { file: "media/bestiary/bg-cover.png", draw: beasts.cover, scale: 4 },
  ...([
    ["ghost", beasts.ghost], ["banshee", beasts.banshee], ["reaper", beasts.reaper], ["jack", beasts.jack],
    ["vampire", beasts.vampire], ["zombie", beasts.zombie], ["mummy", beasts.mummy], ["skeleton", beasts.skeleton],
    ["witch", beasts.witch], ["werewolf", beasts.werewolf], ["goblin", beasts.goblin], ["kitsune", beasts.kitsune],
    ["black-cat", beasts.blackCat], ["bat", beasts.bat], ["spider", beasts.spider], ["owl", beasts.owl],
  ] as const).map(([name, draw]) => ({ file: `media/bestiary/${name}.png`, draw, scale: 8 })),
  { file: "media/bestiary/wisp.gif", draw: () => beasts.wisp(0), scale: 8, frames: { count: beasts.WISP_FRAMES, draw: beasts.wisp, delay: 11 } },
  { file: "media/train/window-view.gif", draw: () => train.windowView(0), scale: 4, frames: { count: train.VIEW_FRAMES, draw: train.windowView, delay: 8 } },
];

export function render(a: ArtFile): Uint8Array {
  if (!a.frames) return encodePng(a.draw().toBitmap(a.scale));
  const frames = Array.from({ length: a.frames.count }, (_, i) => {
    const b = a.frames!.draw(i).toBitmap(a.scale);
    return { rgba: b.rgba, delay: a.frames!.delay };
  });
  const first = a.draw().toBitmap(a.scale);
  return encodeGif({ width: first.width, height: first.height, frames });
}

if (import.meta.main) {
  mkdirSync("media/train", { recursive: true });
  mkdirSync("media/bestiary", { recursive: true });
  for (const a of ART) {
    const bytes = render(a);
    let same = false;
    try { same = Buffer.from(bytes).equals(readFileSync(a.file)); } catch { /* new file */ }
    writeFileSync(a.file, bytes);
    console.log(`${same ? "unchanged" : "written  "} ${a.file} (${(bytes.length / 1024).toFixed(1)} KB)`);
  }
}
