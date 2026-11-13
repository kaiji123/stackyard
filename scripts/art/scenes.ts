// New backgrounds for the story cards: 200×150 grids, scaled ×4 to 800×600.
// Layout rule shared with the templates: the title sits top-left (x < 60 on this grid), story text covers
// y 111–130 and buttons y 133–148, so the important drawing stays above y 110 and right of the title.
import { bayer, Grid, rng, type Colour } from "./grid.ts";

const W = 200, H = 150;

function treeLine(g: Grid, seed: number, base: number, height: number, c: Colour, spacing = 9): void {
  const r = rng(seed);
  for (let x = -6; x < W + 6; x += spacing) {
    const h = height * (0.6 + r() * 0.5), cx = x + r() * 4, half = 4 + r() * 3;
    g.poly([[cx - half, base], [cx, base - h], [cx + half, base]], c);
  }
}

/** The front door from inside: chained double door, fanlight, grandfather clock at eleven, a coat stand. */
export function foyer(): Grid {
  const g = new Grid(W, H, "night");
  // Wallpaper: dark violet with dithered stripes.
  g.vgrad(0, 0, W, 108, ["ink", "night", "panel"]);
  for (let x = 4; x < W; x += 10) g.dither(x, 0, 2, 108, "panel", "violetD", 6);
  // Floorboards.
  g.rect(0, 108, W, 4, "woodD").rect(0, 108, W, 1, "wood");
  g.rect(0, 112, W, H - 112, "woodD");
  for (let y = 116; y < H; y += 6) g.rect(0, y, W, 1, "ink");
  for (let y = 112, k = 0; y < H; y += 6, k++) for (let x = (k % 2) * 14; x < W; x += 28) g.rect(x, y, 1, 6, "ink");
  // Moonlight from the fanlight falling on the floor.
  for (let y = 112; y < H; y++) {
    const half = 22 + (y - 112) * 0.9;
    for (let x = Math.round(100 - half); x <= Math.round(100 + half); x++) if ((x * 7 + y * 3) % 5 === 0) g.set(x, y, "violet");
  }
  // Fanlight: half-moon window above the door.
  for (let y = 4; y <= 30; y++) for (let x = 72; x <= 128; x++) {
    const d = Math.hypot(x - 100, y - 30);
    if (d <= 28) g.set(x, y, d >= 26 ? "woodD" : (x + y) % 3 === 0 ? "lilac" : "violetD");
  }
  for (const a of [-60, -30, 0, 30, 60]) {
    const t = (a * Math.PI) / 180;
    g.line(100, 30, 100 + Math.sin(t) * 26, 30 - Math.cos(t) * 26, "woodD");
  }
  // Double door.
  g.rect(72, 30, 56, 78, "wood").frame(72, 30, 56, 78, "woodD").frame(73, 31, 54, 76, "woodD");
  g.rect(99, 31, 2, 77, "woodD");
  for (const x of [77, 104]) { g.frame(x, 36, 19, 28, "woodD"); g.frame(x, 70, 19, 32, "woodD"); }
  g.set(96, 72, "yellow").set(103, 72, "yellow"); // handles
  // Chains crossing the door, and the padlock.
  const chain = (x0: number, y0: number, x1: number, y1: number): void => {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) g.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, i % 3 === 0 ? "stone" : "stoneL");
  };
  chain(74, 52, 126, 84); chain(74, 84, 126, 52);
  g.rect(96, 64, 9, 8, "yellow").frame(96, 64, 9, 8, "ink").rect(99, 66, 2, 3, "ink");
  g.frame(97, 60, 7, 5, "stoneL").rect(98, 61, 5, 3, "wood"); // shackle; the door shows through it
  // Grandfather clock, showing eleven.
  g.rect(150, 34, 18, 74, "woodD").frame(150, 34, 18, 74, "ink");
  g.poly([[149, 34], [159, 24], [169, 34]], "woodD");
  g.disc(159, 45, 6, "cream");
  g.set(159, 39, "ink").set(159, 51, "ink").set(153, 45, "ink").set(165, 45, "ink");
  g.line(159, 45, 159, 40, "ink");      // minute hand: twelve
  g.line(159, 45, 156, 42, "ink");      // hour hand: eleven
  g.rect(154, 58, 10, 36, "ink");
  g.line(159, 58, 159, 84, "stoneL");
  g.disc(159, 86, 3, "yellow");
  // Coat stand with a forgotten grey coat.
  g.rect(38, 44, 2, 64, "woodD").rect(32, 106, 14, 2, "woodD");
  g.line(39, 46, 32, 42, "woodD").line(39, 46, 46, 42, "woodD");
  g.poly([[33, 48], [45, 48], [48, 84], [30, 84]], "stone");
  g.rect(38, 48, 2, 36, "slate").rect(34, 47, 10, 2, "stoneL");
  g.disc(39, 43, 3, "ink"); // hat
  return g.vignette(16);
}

/** Close-up of the portrait in the hall: Eleanor in a grey dress, a brass name plate. */
export function portrait(): Grid {
  const g = new Grid(W, H, "panel");
  g.vgrad(0, 0, W, H, ["night", "panel", "night"]);
  for (let y = 6; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W; x += 12) g.stamp(x, y, [".v.", "vlv", ".v."], { v: "violetD", l: "violet" });
  g.rect(0, 116, W, H - 116, "woodD").rect(0, 116, W, 2, "wood"); // dado rail
  // Ornate frame.
  const fx = 66, fy = 6, fw = 108, fh = 96;
  g.rect(fx - 4, fy - 4, fw + 8, fh + 8, "rust").frame(fx - 4, fy - 4, fw + 8, fh + 8, "ink");
  g.frame(fx - 2, fy - 2, fw + 4, fh + 4, "orange");
  for (const [cx, cy] of [[fx - 3, fy - 3], [fx + fw + 2, fy - 3], [fx - 3, fy + fh + 2], [fx + fw + 2, fy + fh + 2]] as const) g.disc(cx, cy, 3, "yellow");
  for (let x = fx + 6; x < fx + fw - 4; x += 8) { g.set(x, fy - 4, "yellow"); g.set(x, fy + fh + 3, "yellow"); }
  // Painted background: dark, with a little window of moonlight behind her.
  g.vgrad(fx, fy, fw, fh, ["ink", "violetD", "night"]);
  g.glow(fx + 82, fy + 22, 6, 18, "violet", 7);
  // Eleanor.
  const cx = fx + fw / 2;
  g.poly([[cx - 12, fy + 50], [cx + 12, fy + 50], [cx + 26, fy + fh], [cx - 26, fy + fh]], "stone");      // dress
  g.poly([[cx - 4, fy + 50], [cx + 4, fy + 50], [cx + 7, fy + fh], [cx - 7, fy + fh]], "stoneL");          // front panel
  g.rect(cx - 9, fy + 50, 18, 3, "white");                                                                   // collar
  g.rect(cx - 3, fy + 44, 6, 6, "cream");                                                                    // neck
  g.disc(cx, fy + 30, 15, "woodD");                                                                          // hair
  g.rect(cx - 15, fy + 30, 6, 22, "woodD").rect(cx + 9, fy + 30, 6, 22, "woodD");
  g.disc(cx, fy + 33, 10, "white");                                                                          // face
  g.rect(cx - 10, fy + 22, 20, 5, "woodD");                                                                  // fringe
  g.rect(cx - 6, fy + 32, 3, 3, "ink").rect(cx + 3, fy + 32, 3, 3, "ink");                                   // eyes
  g.set(cx - 5, fy + 32, "lilac").set(cx + 4, fy + 32, "lilac");                                             // the eyes catch the light
  g.rect(cx - 2, fy + 39, 4, 1, "stoneL");                                                                   // mouth
  g.stamp(cx + 8, fy + 14, ["rr.rr", ".rRr.", "rr.rr"], { r: "red", R: "redL" });                           // ribbon
  // Crackle in the old paint.
  g.line(fx + 10, fy + 70, fx + 22, fy + 60, "slate").line(fx + 22, fy + 60, fx + 30, fy + 66, "slate");
  // Brass name plate.
  g.rect(cx - 20, fy + fh + 6, 40, 7, "yellow").frame(cx - 20, fy + fh + 6, 40, 7, "rust");
  for (let x = cx - 16; x < cx + 16; x += 3) g.set(x, fy + fh + 9, "woodD");
  return g.vignette(14);
}

/** The cellar after the ghost lets you pass: the iron door stands open onto the moonlit woods. */
export function cellarOpen(): Grid {
  const g = new Grid(W, H, "stone");
  for (let y = 0; y < 112; y += 6) {
    g.rect(0, y, W, 1, "slate");
    for (let x = (y / 6) % 2 ? 0 : 7; x < W; x += 14) g.rect(x, y, 1, 6, "slate");
  }
  g.dither(0, 0, W, 112, "stone", "slate", 3);
  // Opening in the wall: an arch onto the forest.
  const ax = 100, aw = 30, top = 22;
  const inArch = (x: number, y: number): boolean => y >= top + aw ? Math.abs(x - ax) < aw : Math.hypot(x - ax, y - (top + aw)) < aw;
  for (let y = top; y < 112; y++) for (let x = ax - aw; x < ax + aw; x++) if (inArch(x, y)) g.set(x, y, "night");
  const view = new Grid(W, H, "night");
  view.vgrad(0, 0, W, 112, ["ink", "night", "violetD"]);
  view.stars(7, 40, 70, 20, 60, 40);
  view.disc(116, 36, 6, "white").disc(118, 35, 2, "lilac");
  treeLine(view, 3, 98, 30, "greenD", 7);
  treeLine(view, 9, 112, 22, "ink", 9);
  view.glow(90, 74, 1, 6, "mint", 9).glow(110, 82, 1, 5, "lilac", 8);
  for (let y = top; y < 112; y++) for (let x = ax - aw; x < ax + aw; x++) if (inArch(x, y)) g.set(x, y, view.get(x, y));
  // Arch stones.
  for (let a = 0; a <= 180; a += 12) {
    const t = (a * Math.PI) / 180;
    g.disc(ax - Math.cos(t) * (aw + 2), top + aw - Math.sin(t) * (aw + 2), 2, "stoneL");
  }
  g.rect(ax - aw - 4, top + aw, 4, 112 - top - aw, "stoneL").rect(ax + aw, top + aw, 4, 112 - top - aw, "stoneL");
  // The iron door, swung open against the wall on the left.
  g.poly([[ax - aw - 18, top + 14], [ax - aw - 4, top + 24], [ax - aw - 4, 112], [ax - aw - 18, 108]], "slate");
  g.line(ax - aw - 18, top + 14, ax - aw - 18, 108, "ink").line(ax - aw - 4, top + 24, ax - aw - 4, 112, "ink");
  for (const y of [44, 64, 84, 100]) { g.set(ax - aw - 14, y, "stoneL"); g.set(ax - aw - 8, y + 2, "stoneL"); }
  // Floor flagstones.
  g.rect(0, 112, W, H - 112, "slate");
  for (let y = 112; y < H; y += 7) g.rect(0, y, W, 1, "ink");
  for (let y = 112, k = 0; y < H; y += 7, k++) for (let x = k % 2 ? 10 : 0; x < W; x += 20) g.rect(x, y, 1, 7, "ink");
  // The open padlock on the floor.
  g.rect(140, 104, 9, 7, "yellow").frame(140, 104, 9, 7, "ink").rect(143, 106, 2, 2, "ink");
  g.line(141, 104, 141, 99, "stoneL").line(141, 99, 145, 97, "stoneL");
  // Lamplight spilling through the arch onto the floor (the lamp itself is a sprite in the card).
  for (let y = 112; y < H; y++) {
    const half = aw - 4 + (y - 112) * 0.8;
    for (let x = Math.round(ax - half); x <= Math.round(ax + half); x++) if ((x + y * 2) % 4 === 0) g.set(x, y, "stoneL");
  }
  return g.vignette(16);
}

/** A clearing in the woods, ringed by trees and mushrooms, where the green light waits. */
export function clearing(): Grid {
  const g = new Grid(W, H, "ink");
  g.vgrad(0, 0, W, 80, ["ink", "night", "violetD"]);
  g.stars(21, 70, 0, 0, W, 60);
  g.glow(168, 20, 8, 17, "violet", 5).disc(168, 20, 8, "white").disc(171, 18, 2.5, "lilac").set(165, 23, "lilac");
  treeLine(g, 5, 82, 40, "greenD", 8);
  treeLine(g, 11, 92, 30, "ink", 10);
  g.vgrad(0, 88, W, H - 88, ["greenD", "green", "greenD"]);
  // Lighter ground in the middle of the clearing.
  for (let y = 92; y < H; y++) for (let x = 0; x < W; x++) {
    const e = ((x - 100) / 70) ** 2 + ((y - 112) / 22) ** 2;
    if (e < 1 && (x + y) % 2 === 0) g.set(x, y, e < 0.4 ? "mint" : "green");
  }
  // Fairy ring of mushrooms.
  for (let a = 0; a < 360; a += 24) {
    const t = (a * Math.PI) / 180, x = 100 + Math.cos(t) * 62, y = 110 + Math.sin(t) * 16;
    g.rect(x - 1, y - 2, 3, 1, a % 48 ? "red" : "redL").set(x, y - 1, "white");
  }
  // The green light, and fireflies.
  g.glow(100, 92, 2, 26, "mint", 8);
  g.glow(100, 92, 0, 3, "white", 16);
  const r = rng(4);
  for (let k = 0; k < 24; k++) g.set(20 + r() * 160, 40 + r() * 64, r() < 0.7 ? "mint" : "yellow");
  return g.vignette(18);
}

/** The Ashby house at dawn: sky on fire, the front door open and lit, gold lights drifting home. */
export function dawnHouse(): Grid {
  const g = new Grid(W, H, "violetD");
  g.vgrad(0, 0, W, 100, ["violetD", "violet", "red", "rust", "orange", "yellow"]);
  g.disc(152, 98, 16, "cream").disc(152, 98, 12, "white");
  for (let k = 0; k < 4; k++) g.rect(130 + k * 9, 30 + k * 5, 6, 1, "ink"); // birds, far off
  // Far hills.
  for (let x = 0; x < W; x++) {
    const y = Math.round(92 + Math.sin(x / 17) * 4 + Math.sin(x / 7) * 2);
    g.rect(x, y, 1, 110 - y, "greenD");
  }
  // The house.
  g.rect(64, 58, 70, 50, "night");
  g.poly([[58, 60], [99, 30], [140, 60]], "night");
  g.rect(66, 30, 16, 30, "night");
  g.poly([[63, 31], [74, 10], [85, 31]], "night");
  g.rect(110, 34, 4, 14, "night"); // chimney
  for (const [x, y] of [[72, 40], [72, 66], [118, 66]] as const) g.rect(x, y, 6, 7, "slate").rect(x + 3, y, 1, 7, "night");
  g.rect(118, 44, 6, 7, "yellow").rect(121, 44, 1, 7, "orange").glow(121, 47, 4, 9, "yellow", 5); // Eleanor's room
  g.rect(92, 84, 14, 24, "yellow").rect(92, 84, 3, 24, "cream"); // open door, lit
  g.poly([[92, 84], [86, 86], [86, 108], [92, 108]], "wood");   // door leaf
  g.glow(99, 98, 6, 18, "yellow", 4);
  // Fence and open gate.
  for (let x = 2; x < W; x += 6) if (x < 84 || x > 114) g.rect(x, 100, 2, 12, "ink").set(x, 99, "ink");
  g.rect(0, 103, 84, 1, "ink").rect(116, 103, 84, 1, "ink");
  g.poly([[84, 100], [74, 104], [74, 114], [84, 112]], "ink");
  // Grass and the path to the door.
  g.vgrad(0, 108, W, H - 108, ["green", "greenD"]);
  for (let y = 108; y < H; y++) {
    const half = 7 + (y - 108) * 0.7;
    g.dither(Math.round(99 - half), y, Math.round(half * 2), 1, "wood", "stoneL", 5);
  }
  // Gold lights drifting up the path into the house.
  for (let k = 0; k < 12; k++) {
    const t = k / 11, x = 60 + t * 38 + Math.sin(t * 9) * 6, y = 140 - t * 44;
    g.set(x, y, k % 3 ? "yellow" : "cream");
  }
  return g.vignette(10);
}

/** The lantern road swallowed by fog: bands of mist, the moon a smudge, lights barely visible. */
export function fogRoad(): Grid {
  const g = new Grid(W, H, "ink");
  g.vgrad(0, 0, W, 90, ["ink", "night", "panel"]);
  g.glow(44, 24, 4, 14, "stoneL", 6);
  treeLine(g, 2, 86, 34, "greenD", 8);
  treeLine(g, 8, 96, 26, "ink", 11);
  g.rect(0, 92, W, H - 92, "greenD");
  g.poly([[94, 84], [106, 84], [160, H], [40, H]], "stone");
  for (let y = 90; y < H; y += 8) g.rect(99, y, 2, 4, "stoneL");
  g.glow(70, 70, 1, 6, "mint", 6).glow(132, 64, 1, 5, "lilac", 6).glow(150, 88, 1, 4, "mint", 5);
  // Fog: wide dithered bands of grey over everything.
  const band = (y: number, h: number, amount: number): void => {
    for (let j = y; j < y + h; j++) {
      const k = Math.round(amount * (1 - Math.abs((j - y - h / 2) / (h / 2))));
      for (let i = 0; i < W; i++) {
        const wave = Math.round(Math.sin((i + j * 0.3) / 13) * 2);
        if (bayer(i, j) < k + wave) g.set(i, j, bayer(i + 1, j + 2) < k / 2 ? "stoneL" : "stone");
      }
    }
  };
  band(40, 30, 11); band(70, 34, 14); band(102, 36, 13); band(128, 22, 10);
  return g.vignette(14);
}
