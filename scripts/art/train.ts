// Art for "The Midnight Train". Backgrounds are 200×150 grids (×4 = 800×600). Card layout zones, in grid
// pixels: title top-left (x < 125, y < 17), messages y 96–108, story text y 111–130, buttons y 133–148.
// Characters are 32×32 (×8 = 256), items 16×16 or 32×32, and two animations (steam, window view).
import { bayer, Grid, rng, type Colour } from "./grid.ts";

const W = 200, H = 150;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Ink outline around every opaque shape, the way the original sprites are drawn. */
function outline(g: Grid, c: Colour = "ink"): Grid {
  const src = g.clone();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (src.get(x, y) !== null) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => src.get(x + (dx ?? 0), y + (dy ?? 0)) !== null)) g.set(x, y, c);
  }
  return g;
}

function moon(g: Grid, cx: number, cy: number, r: number): void {
  g.glow(cx, cy, r, r + 9, "violet", 5);
  g.disc(cx, cy, r, "mist").disc(cx - 1, cy - 1, r - 1, "white");
  g.disc(cx + r * 0.3, cy - r * 0.2, r * 0.22, "lilac").disc(cx - r * 0.35, cy + r * 0.3, r * 0.15, "lilac").set(cx + r * 0.1, cy + r * 0.5, "lilac");
}

function lampGlow(g: Grid, x: number, y: number, r: number): void {
  g.glow(x, y, r * 0.3, r, "yellow", 5).glow(x, y, 0, r * 0.35, "cream", 9);
}

// ---------------------------------------------------------------------------------------------------
// Platform 13, with or without the train.
function platformBase(g: Grid, withTrain: boolean): void {
  g.vgrad(0, 0, W, 84, ["ink", "night", "violetD"]);
  g.stars(13, 70, 118, 14, 82, 44);
  moon(g, 136, 26, 9);
  // Far town under the hills.
  const r = rng(31);
  for (let x = 0; x < W;) {
    const w = 6 + Math.floor(r() * 9), h = 6 + Math.floor(r() * 12);
    g.rect(x, 80 - h, w, h, "panel");
    if (r() < 0.4) g.poly([[x - 1, 80 - h], [x + w / 2, 80 - h - 4], [x + w + 1, 80 - h]], "panel");
    for (let k = 0; k < 3; k++) if (r() < 0.5) g.set(x + 1 + Math.floor(r() * (w - 2)), 80 - h + 2 + Math.floor(r() * (h - 3)), r() < 0.7 ? "yellow" : "orange");
    x += w + Math.floor(r() * 3);
  }
  // Fence beyond the line.
  g.rect(0, 80, W, 1, "ink");
  for (let x = 1; x < W; x += 5) g.rect(x, 78, 1, 6, "ink");
  // Track bed: ballast, sleepers, two rails.
  g.dither(0, 84, W, 14, "slate", "stone", 5);
  for (let x = 0; x < W; x += 6) g.rect(x, 87, 3, 9, "woodD");
  for (const y of [88, 94]) g.rect(0, y, W, 1, "stoneL").rect(0, y + 1, W, 1, "ink");
  if (!withTrain) {
    // A light far down the line, in the fog: something is coming.
    for (let y = 70; y < 98; y++) for (let x = 120; x < W; x++) if (bayer(x, y) < 3 + Math.round((x - 120) / 30)) g.set(x, y, "stone");
    g.glow(184, 86, 3, 24, "yellow", 6).glow(184, 86, 0, 4, "cream", 16).rect(176, 86, 17, 1, "cream"); // headlamp beam
  }
  // Platform.
  g.rect(0, 98, W, 3, "stoneL").rect(0, 98, W, 1, "white");
  g.rect(0, 101, W, 1, "ink").rect(0, 103, W, 1, "yellow");
  g.vgrad(0, 104, W, H - 104, ["stone", "slate"]);
  for (let y = 110; y < H; y += 9) g.rect(0, y, W, 1, "ink");
  for (let y = 104, k = 0; y < H; y += 9, k++) for (let x = k % 2 ? 8 : 0; x < W; x += 16) g.rect(x, y, 1, 6, "ink");
  const leaves = rng(8);
  for (let k = 0; k < 18; k++) g.set(leaves() * W, 104 + leaves() * 46, leaves() < 0.5 ? "rust" : "orange");
}

function platformCanopy(g: Grid, timetable = true): void {
  // Roof, scalloped valance, iron columns and brackets.
  g.rect(0, 0, 118, 9, "slate").rect(0, 8, 118, 1, "ink");
  for (let x = 0; x < 118; x += 4) g.poly([[x, 9], [x + 4, 9], [x + 2, 13]], "woodD").set(x + 2, 12, "wood");
  for (const cx of [18, 76]) {
    g.rect(cx - 1, 13, 4, 88, "slate").rect(cx, 13, 1, 88, "stoneL").frame(cx - 2, 13, 6, 3, "ink").rect(cx - 2, 97, 6, 4, "ink");
    g.line(cx - 1, 16, cx - 9, 10, "slate").line(cx + 2, 16, cx + 10, 10, "slate");
  }
  // Hanging clock at 11:59.
  g.rect(46, 9, 1, 8, "ink");
  g.disc(46, 23, 6.5, "ink").disc(46, 23, 5.3, "cream");
  for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]] as const) g.set(46 + dx, 23 + dy, "stone");
  g.line(46, 23, 46, 18, "ink").line(46, 23, 45, 20, "ink").set(46, 23, "red");
  // Platform sign.
  g.rect(88, 17, 22, 11, "navy").frame(88, 17, 22, 11, "yellow").rect(98, 13, 1, 4, "ink");
  g.text(93, 20, "13", "cream");
  // Bench with a jack-o'-lantern.
  g.rect(26, 87, 28, 2, "wood").rect(26, 90, 28, 2, "wood").rect(26, 89, 28, 1, "woodD");
  g.rect(24, 94, 32, 2, "woodL").rect(24, 96, 32, 1, "woodD");
  for (const x of [27, 51]) g.rect(x, 97, 2, 4, "ink");
  g.disc(46, 91, 3, "orange").set(46, 87, "green").set(45, 90, "yellow").set(47, 90, "yellow").rect(45, 92, 3, 1, "yellow");
  if (!timetable) return;
  // Timetable board on the second column.
  g.rect(81, 50, 16, 20, "cream").frame(80, 49, 18, 22, "woodD");
  for (let y = 53; y < 68; y += 3) g.rect(83, y, 12, 1, "stone");
  g.rect(83, 66, 9, 1, "lilac"); // the extra line, in silver ink
}

function gasLamp(g: Grid, x: number): void {
  g.rect(x, 50, 2, 51, "ink").rect(x - 2, 97, 6, 4, "ink");
  g.rect(x - 3, 40, 8, 10, "ink").rect(x - 2, 41, 6, 8, "yellow").rect(x - 1, 42, 2, 4, "cream");
  g.poly([[x - 5, 40], [x + 1, 34], [x + 7, 40]], "ink");
  lampGlow(g, x + 1, 45, 20);
}

export function platform(): Grid {
  const g = new Grid(W, H, "ink");
  platformBase(g, false);
  platformCanopy(g);
  gasLamp(g, 156);
  return g.vignette(8);
}

export function arrival(): Grid {
  const g = new Grid(W, H, "ink");
  platformBase(g, true);
  // Carriages.
  const carriage = (x0: number, x1: number, ghosts: readonly number[], door: number | null): void => {
    g.rect(x0, 44, x1 - x0, 3, "slate").rect(x0 + 1, 43, x1 - x0 - 2, 1, "slate").rect(x0, 43, x1 - x0, 1, "ink");
    g.rect(x0, 47, x1 - x0, 39, "redD").rect(x0, 47, x1 - x0, 1, "red").rect(x0, 72, x1 - x0, 1, "yellow");
    g.frame(x0, 43, x1 - x0, 44, "ink");
    let k = 0;
    for (let x = x0 + 4; x + 9 < x1 - 2; x += 13, k++) {
      if (door !== null && x >= door - 4 && x < door + 12) continue;
      g.rect(x, 52, 9, 13, "yellow").rect(x, 52, 9, 2, "cream").frame(x - 1, 51, 11, 15, "ink");
      if (ghosts.includes(k)) g.disc(x + 4, 59, 2.6, "mist").set(x + 3, 59, "ink").set(x + 5, 59, "ink").rect(x + 1, 62, 7, 3, "mist");
    }
    if (door !== null) {
      g.rect(door, 49, 11, 37, "yellow").rect(door, 49, 3, 37, "cream").frame(door - 1, 48, 13, 39, "ink");
      // Warm light spilling onto the platform.
      for (let y = 98; y < 112; y++) {
        const half = 6 + (y - 98) * 1.2;
        for (let x = Math.round(door + 5 - half); x <= Math.round(door + 5 + half); x++) if (bayer(x, y) < 8 - (y - 98) / 2) g.set(x, y, y < 101 ? "cream" : "yellow");
      }
    }
    g.rect(x0, 86, x1 - x0, 3, "ink");
    for (const wx of [x0 + 9, x0 + 19, x1 - 19, x1 - 9]) g.disc(wx, 91, 3.6, "ink").disc(wx, 91, 1.4, "stoneL");
  };
  carriage(-8, 60, [0, 2], null);
  carriage(64, 136, [1, 4], 100);
  g.rect(60, 70, 4, 3, "ink");
  // Locomotive.
  g.rect(136, 38, 24, 3, "ink").rect(138, 41, 20, 45, "navy").rect(138, 41, 2, 45, "navyL").frame(137, 40, 22, 47, "ink");
  g.rect(143, 48, 11, 12, "orange").rect(143, 48, 11, 3, "yellow").frame(142, 47, 13, 14, "ink"); // firebox glow, no driver
  g.rect(158, 54, 40, 30, "navy").rect(158, 54, 40, 4, "navyL").rect(158, 80, 40, 4, "ink");
  for (const x of [166, 178, 190]) g.rect(x, 54, 2, 30, "yellow");
  g.disc(170, 53, 5, "navy").rect(165, 53, 11, 2, "navy").rect(167, 48, 6, 2, "yellow");                // dome
  g.rect(176, 36, 7, 18, "navy").rect(176, 36, 2, 18, "navyL").rect(175, 33, 9, 3, "ink");               // chimney
  g.frame(157, 53, 42, 32, "ink");
  g.rect(136, 86, 64, 3, "ink");
  for (const [wx, r] of [[146, 3.6], [168, 6], [186, 6]] as const) g.disc(wx, 92 - r + 3.6, r, "ink").disc(wx, 92 - r + 3.6, r * 0.4, "stoneL");
  g.line(168, 90, 186, 90, "stoneL");
  platformCanopy(g, false);
  gasLamp(g, 116);
  return g.vignette(12);
}

// ---------------------------------------------------------------------------------------------------
// Inside Carriage One, looking down the aisle (one-point perspective).
export function carriage(): Grid {
  const g = new Grid(W, H, "woodD");
  const L = (t: number): number => 78 * t, R = (t: number): number => 200 - 78 * t;
  const T = (t: number): number => 36 * t, B = (t: number): number => 150 - 74 * t;
  const at = (t: number, f: number): number => T(t) + (B(t) - T(t)) * f;
  // Ceiling with ribs.
  g.poly([[0, 0], [200, 0], [122, 36], [78, 36]], "woodD");
  for (const t of [0.12, 0.3, 0.48, 0.64, 0.78, 0.9]) g.line(L(t), T(t), R(t), T(t), "wood");
  g.poly([[88, 0], [112, 0], [102, 36], [98, 36]], "panel");
  // Walls: panelling above, wainscot below.
  g.poly([[0, 0], [78, 36], [78, 76], [0, 150]], "wood").poly([[200, 0], [122, 36], [122, 76], [200, 150]], "wood");
  g.poly([[0, at(0, 0.62)], [78, at(1, 0.62)], [78, 76], [0, 150]], "woodD").poly([[200, at(0, 0.62)], [122, at(1, 0.62)], [122, 76], [200, 150]], "woodD");
  g.line(0, at(0, 0.62), 78, at(1, 0.62), "woodL").line(200, at(0, 0.62), 122, at(1, 0.62), "woodL");
  // Windows on both walls, night outside.
  const sky = new Grid(W, H, "night");
  sky.vgrad(0, 0, W, H, ["ink", "night", "violetD"]).stars(5, 260, 0, 0, W, H);
  for (const [t0, t1] of [[0.04, 0.2], [0.27, 0.41], [0.48, 0.58], [0.65, 0.72], [0.78, 0.83]] as const) {
    for (const side of [0, 1]) {
      const X = side ? R : L;
      const quad: [number, number][] = [[X(t0), at(t0, 0.2)], [X(t1), at(t1, 0.2)], [X(t1), at(t1, 0.52)], [X(t0), at(t0, 0.52)]];
      const win = new Grid(W, H);
      win.poly(quad, "night");
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (win.get(x, y)) g.set(x, y, sky.get(x, y));
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = quad[i] as [number, number], [bx, by] = quad[(i + 1) % 4] as [number, number];
        g.line(ax, ay, bx, by, "woodL");
      }
      g.line(X(t0), at(t0, 0.2), X(t0), at(t0, 0.52), "redD").line(X(t1), at(t1, 0.2), X(t1), at(t1, 0.52), "redD");
    }
  }
  moon(g, 11, 40, 5);
  // Brass luggage racks.
  for (const [x0, x1] of [[0, 78], [200, 122]] as const) {
    g.line(x0, at(0, 0.13), x1, at(1, 0.13), "yellow").line(x0, at(0, 0.13) + 2, x1, at(1, 0.13) + 1, "rust");
  }
  // Far end: the door to the next carriage, its window lit.
  g.rect(78, 36, 44, 40, "woodD").rect(92, 46, 16, 30, "wood").frame(91, 45, 18, 31, "woodL");
  g.rect(95, 50, 10, 10, "yellow").rect(95, 50, 10, 2, "cream").set(105, 64, "yellow");
  // Floor and the aisle carpet.
  g.poly([[0, 150], [200, 150], [122, 76], [78, 76]], "redD");
  g.poly([[58, 150], [142, 150], [104, 76], [96, 76]], "red");
  g.line(58, 150, 96, 76, "yellow").line(142, 150, 104, 76, "yellow");
  for (let y = 80; y < 150; y += 7) for (let x = 0; x < W; x++) {
    const t = (150 - y) / 74, half = lerp(42, 4, t);
    if (Math.abs(x - 100) < half - 3 && (x + y) % 7 === 0) g.set(x, y, "rust");
  }
  // Ceiling lamps, far to near.
  for (const t of [0.86, 0.7, 0.5, 0.26]) {
    const y = T(t) + 4 * (1 - t) + 2, r = 1.2 + 3.5 * (1 - t);
    lampGlow(g, 100, y, r * 2.6);
    g.disc(100, y, r, "yellow").disc(100, y - r * 0.3, r * 0.5, "cream").rect(100, T(t), 1, Math.max(1, y - r - T(t)), "ink");
  }
  // Seat backs (far to near) with ghost passengers.
  const passengers: Record<string, string> = { "0:0.48": "hat", "1:0.3": "plain", "1:0.78": "plain", "0:0.9": "plain", "1:0.64": "bonnet" };
  for (const t of [0.9, 0.78, 0.64, 0.48, 0.3, 0.12]) {
    for (const side of [0, 1]) {
      const wall = side ? R(t) : L(t), aisle = side ? 142 - 38 * t : 58 + 38 * t;
      const x0 = Math.min(wall, aisle), x1 = Math.max(wall, aisle);
      const h = (B(t) - T(t)) * 0.4, top = B(t) - h;
      const who = passengers[`${side}:${t}`];
      if (who) {
        const r = 1.4 + 4.6 * (1 - t), cx = lerp(x0, x1, 0.55), cy = top - r * 0.5;
        g.disc(cx, cy, r, "mist").disc(cx - r * 0.25, cy - r * 0.25, r * 0.7, "white");
        if (r > 2) g.set(cx - r * 0.35, cy, "ink").set(cx + r * 0.35, cy, "ink");
        if (who === "hat") g.rect(cx - r * 0.8, cy - r * 1.6, r * 1.6, r * 0.9, "ink").rect(cx - r * 1.1, cy - r * 0.8, r * 2.2, 1, "ink");
        if (who === "bonnet") g.disc(cx, cy - r * 0.5, r * 1.05, "lilac").disc(cx, cy + r * 0.1, r * 0.75, "white").set(cx - r * 0.3, cy + r * 0.1, "ink").set(cx + r * 0.3, cy + r * 0.1, "ink");
      }
      g.rect(x0, top, x1 - x0, h, "red").rect(x0, top, x1 - x0, Math.max(1, h * 0.12), "redL").frame(Math.round(x0), Math.round(top), Math.round(x1 - x0), Math.round(h), "ink");
      g.rect(x0 + 1, top + h * 0.35, x1 - x0 - 2, 1, "redD");
    }
  }
  return g.vignette(12);
}

// ---------------------------------------------------------------------------------------------------
// Out of the window: the view is a looping animation; the card background is its first frame.
const VIEW = { x: 30, y: 14, w: 140, h: 82 } as const;
export const VIEW_FRAMES = 16;

export function windowView(frame: number): Grid {
  const g = new Grid(VIEW.w, VIEW.h, "night");
  g.vgrad(0, 0, VIEW.w, 62, ["ink", "night", "violetD"]).stars(17, 60, 0, 0, VIEW.w, 44);
  moon(g, 108, 17, 7);
  for (let x = 0; x < VIEW.w; x++) g.rect(x, Math.round(48 + Math.sin(x / 19) * 3 + Math.sin(x / 7) * 1.2), 1, 30, "panel"); // far hills: still
  // Middle distance: hills and a village, 2 px per frame, repeating every 64.
  const mid = (frame * 4) % 64, near = (frame * 8) % 128;
  const houses = rng(77);
  const village: { x: number; w: number; h: number; lit: number; spire: boolean }[] = [];
  for (let x = 2; x < 64; x += 9 + Math.floor(houses() * 6)) village.push({ x, w: 5 + Math.floor(houses() * 4), h: 4 + Math.floor(houses() * 5), lit: Math.floor(houses() * 3), spire: houses() < 0.15 });
  for (let x = 0; x < VIEW.w; x++) {
    const u = (x + mid) % 64;
    const y = Math.round(58 + Math.sin((u / 64) * Math.PI * 2) * 3 + Math.sin((u / 32) * Math.PI * 2 + 1) * 1.5);
    g.rect(x, y, 1, VIEW.h - y, "greenD");
  }
  for (const v of village) for (const rep of [-64, 0, 64, 128, 192]) {
    const x = v.x + rep - mid;
    if (x > VIEW.w || x + v.w < 0) continue;
    g.rect(x, 60 - v.h, v.w, v.h + 3, "night");
    if (v.spire) g.poly([[x, 60 - v.h], [x + v.w / 2, 60 - v.h - 7], [x + v.w, 60 - v.h]], "night");
    else g.poly([[x - 1, 60 - v.h], [x + v.w / 2, 60 - v.h - 3], [x + v.w + 1, 60 - v.h]], "night");
    for (let k = 0; k <= v.lit; k++) g.set(x + 1 + ((k * 3) % Math.max(1, v.w - 2)), 61 - v.h + 2 + (k % 2) * 2, "yellow");
  }
  // Near: dark embankment, bushes and telegraph poles, 4 px per frame, repeating every 128.
  for (let x = 0; x < VIEW.w; x++) {
    const u = (x + near) % 128;
    const top = Math.round(70 + Math.sin((u / 128) * Math.PI * 4) * 2 + (u % 16 < 5 ? -2 : 0));
    g.rect(x, top, 1, VIEW.h - top, "ink");
  }
  for (const p of [20, 84]) for (const rep of [-128, 0, 128, 256]) {
    const x = p + rep - near;
    if (x < -40 || x > VIEW.w + 40) continue;
    g.rect(x, 30, 1, 42, "ink").rect(x - 4, 32, 9, 1, "ink");
    for (const dx of [-3, 3]) {
      const nx = x + 64;
      for (let i = 0; i <= 64; i++) g.set(x + dx + i, 33 + Math.round(Math.sin((i / 64) * Math.PI) * 4), (i % 2) ? "stone" : "stoneL").set(nx + dx, 33, "ink");
    }
  }
  // Light from the train's own windows on the embankment (moves with you, so it stays still).
  for (const x0 of [8, 46, 84, 122]) for (let y = 74; y < 80; y++) for (let x = x0; x < x0 + 16; x++) if (bayer(x, y) < 5) g.set(x, y, "rust");
  return g;
}

export function windowFrame(): Grid {
  const g = new Grid(W, H, "wood");
  for (let x = 0; x < W; x += 20) g.rect(x, 0, 1, H, "woodD");
  g.rect(0, 104, W, H - 104, "woodD").rect(0, 104, W, 1, "woodL");
  // The view (first frame) and its frame.
  const v = windowView(0);
  for (let y = 0; y < VIEW.h; y++) for (let x = 0; x < VIEW.w; x++) g.set(VIEW.x + x, VIEW.y + y, v.get(x, y));
  g.frame(VIEW.x - 1, VIEW.y - 1, VIEW.w + 2, VIEW.h + 2, "ink").frame(VIEW.x - 3, VIEW.y - 3, VIEW.w + 6, VIEW.h + 6, "woodL").frame(VIEW.x - 4, VIEW.y - 4, VIEW.w + 8, VIEW.h + 8, "woodD");
  g.rect(VIEW.x - 6, VIEW.y + VIEW.h + 4, VIEW.w + 12, 5, "woodL").rect(VIEW.x - 6, VIEW.y + VIEW.h + 8, VIEW.w + 12, 1, "ink");
  g.rect(98, VIEW.y + VIEW.h + 1, 4, 2, "yellow");
  // Velvet curtains, tied back with gold rope.
  for (const [x0, flip] of [[0, false], [172, true]] as const) {
    for (let x = 0; x < 28; x++) {
      const fold = Math.sin(x / 2.2) > 0.3 ? "red" : Math.sin(x / 2.2) < -0.6 ? "redD" : "red";
      for (let y = 0; y < 106; y++) {
        const pinch = y > 52 && y < 66 ? 6 * Math.sin(((y - 52) / 14) * Math.PI) : 0;
        const edge = flip ? x - pinch : 27 - x - pinch;
        if (edge >= 0) g.set(x0 + x, y, fold);
      }
    }
    const rx = flip ? 178 : 20;
    g.rect(rx - 4, 57, 9, 3, "yellow").set(rx, 61, "yellow").set(rx, 62, "orange");
  }
  g.rect(0, 0, W, 4, "rust").rect(0, 4, W, 1, "yellow"); // curtain rail
  return g.vignette(10);
}

// ---------------------------------------------------------------------------------------------------
// The front of the carriage: the door to the engine, where the conductor stands.
export function corridor(): Grid {
  const g = new Grid(W, H, "wood");
  g.poly([[0, 0], [36, 12], [36, 104], [0, 150]], "woodD").poly([[200, 0], [164, 12], [164, 104], [200, 150]], "woodD");
  g.rect(36, 12, 128, 92, "wood");
  for (let x = 44; x < 160; x += 16) g.rect(x, 12, 1, 92, "woodD");
  g.rect(36, 70, 128, 1, "woodL");
  // The engine door with a round window full of firelight.
  g.rect(78, 14, 44, 90, "woodD").frame(77, 13, 46, 92, "ink").frame(80, 16, 40, 86, "woodL");
  g.rect(78, 92, 44, 12, "yellow").rect(78, 92, 44, 1, "cream");
  g.disc(100, 30, 10, "ink").disc(100, 30, 9, "yellow");
  for (let y = 21; y < 40; y++) for (let x = 91; x < 110; x++) if (Math.hypot(x - 100, y - 30) < 8.5) g.set(x, y, bayer(x, y) < 6 ? "red" : bayer(x, y) < 11 ? "orange" : "yellow");
  g.disc(100, 30, 10, null).disc(100, 30, 9.6, "ink");
  for (let y = 21; y < 40; y++) for (let x = 91; x < 110; x++) {
    const d = Math.hypot(x - 100, y - 30);
    if (d < 8.5) g.set(x, y, d < 3 ? "cream" : bayer(x, y) < (y - 21) / 1.5 ? "orange" : bayer(x, y) < 10 ? "yellow" : "red");
  }
  g.glow(100, 30, 10, 18, "orange", 3);
  // Wall lamp, and the route map with the last stop circled.
  g.rect(46, 30, 4, 2, "yellow").rect(47, 26, 2, 4, "cream");
  lampGlow(g, 48, 27, 16);
  g.rect(132, 26, 26, 22, "cream").frame(131, 25, 28, 24, "woodD");
  const stops: readonly (readonly [number, number])[] = [[135, 44], [140, 38], [146, 40], [150, 33], [155, 29]];
  for (let i = 0; i + 1 < stops.length; i++) g.line(stops[i]![0], stops[i]![1], stops[i + 1]![0], stops[i + 1]![1], "stone");
  for (const [x, y] of stops) g.set(x, y, "ink");
  g.frame(153, 27, 5, 5, "red");
  // Checkered floor.
  for (let y = 104; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (y - 104) / 46, u = (x - 100) / lerp(0.7, 1.4, t);
    g.set(x, y, (Math.floor(u / 8) + Math.floor((y - 104) / lerp(3, 8, t))) % 2 ? "slate" : "stone");
  }
  g.rect(36, 104, 128, 1, "ink");
  return g.vignette(12);
}

// ---------------------------------------------------------------------------------------------------
export function dining(): Grid {
  const g = new Grid(W, H, "wood");
  for (let x = 0; x < W; x += 25) g.frame(x + 3, 4, 19, 56, "woodD");
  // Big window.
  g.vgrad(40, 10, 120, 50, ["ink", "night", "violetD"]).stars(23, 40, 40, 10, 120, 34);
  moon(g, 70, 26, 7);
  for (let x = 40; x < 160; x++) g.rect(x, Math.round(50 + Math.sin(x / 11) * 3), 1, 10, "panel");
  g.frame(39, 9, 122, 52, "ink").frame(37, 7, 126, 56, "woodL").rect(99, 10, 2, 50, "woodL");
  // Curtains.
  for (const x0 of [28, 156]) for (let x = 0; x < 16; x++) g.rect(x0 + x, 4, 1, 60 - Math.abs(x - 8), Math.sin(x / 1.8) > 0 ? "red" : "redD");
  g.rect(0, 2, W, 3, "rust").rect(0, 5, W, 1, "yellow");
  // Wall sconces.
  for (const x of [14, 186]) { g.rect(x - 1, 30, 3, 6, "yellow"); g.disc(x, 28, 2, "cream"); lampGlow(g, x, 28, 9); }
  // Benches.
  for (const [x0, x1] of [[0, 42], [158, 200]] as const) g.rect(x0, 52, x1 - x0, 54, "redD").rect(x0, 52, x1 - x0, 3, "red").frame(x0, 52, x1 - x0, 54, "ink");
  // Table with white linen, a red lamp and tea for two.
  g.rect(40, 64, 120, 6, "white").rect(40, 69, 120, 1, "mist");
  g.rect(42, 70, 116, 30, "mist");
  for (let x = 48; x < 158; x += 11) g.rect(x, 71, 1, 28, "stoneL");
  g.frame(40, 63, 120, 37, "ink");
  g.rect(132, 54, 2, 10, "yellow").rect(128, 62, 10, 2, "yellow");
  g.poly([[125, 54], [141, 54], [137, 45], [129, 45]], "red").rect(129, 45, 8, 1, "redL");
  lampGlow(g, 133, 50, 13);
  g.disc(64, 60, 4, "white").rect(60, 60, 9, 4, "white").rect(68, 58, 3, 1, "white").rect(63, 55, 3, 1, "mist").set(64, 54, "lilac"); // teapot
  for (const x of [84, 112]) g.rect(x, 61, 5, 3, "white").set(x + 5, 62, "white").rect(x - 2, 64, 9, 1, "stoneL");
  g.rect(96, 58, 2, 6, "green").set(97, 56, "red").set(96, 55, "redL"); // a rose in a vase
  g.rect(95, 61, 4, 3, "lilac");
  // Floor.
  g.rect(0, 106, W, H - 106, "redD");
  for (let y = 108; y < H; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < W; x += 12) g.set(x, y, "rust");
  return g.vignette(12);
}

// ---------------------------------------------------------------------------------------------------
export function sleeper(): Grid {
  const g = new Grid(W, H, "woodD");
  for (let x = 0; x < W; x += 12) g.rect(x, 0, 1, H, "ink");
  g.dither(0, 0, W, 104, "woodD", "wood", 3);
  // Two bunks with quilts and pillows.
  for (const [y, h] of [[12, 34], [56, 44]] as const) {
    g.rect(2, y, 108, h, "night").frame(1, y - 1, 110, h + 2, "wood");
    g.rect(4, y + h - 12, 104, 10, "navy");
    for (let x = 4; x < 108; x += 8) for (let j = 0; j < 10; j += 5) g.rect(x + ((j / 5) % 2) * 4, y + h - 12 + j, 4, 5, "navyL");
    g.rect(6, y + h - 18, 22, 7, "white").rect(6, y + h - 12, 22, 1, "mist");
    g.rect(1, y + h + 1, 110, 3, "wood").rect(1, y + h + 1, 110, 1, "woodL");
    // Curtain half drawn on the right, on a brass rail.
    g.rect(1, y - 1, 110, 1, "yellow");
    for (let x = 0; x < 20; x++) g.rect(90 + x, y, 1, h, Math.sin(x / 1.6) > 0 ? "redD" : "red");
  }
  // Ladder.
  g.rect(112, 10, 2, 94, "woodL").rect(122, 10, 2, 94, "woodL");
  for (let y = 16; y < 104; y += 10) g.rect(112, y, 12, 1, "woodL");
  // Round window with the moon.
  g.disc(162, 36, 17, "ink").disc(162, 36, 16, "yellow").disc(162, 36, 14, "ink");
  g.disc(162, 36, 13, "night").stars(44, 24, 150, 24, 24, 24);
  moon(g, 166, 32, 5);
  for (let a = 0; a < 360; a += 45) g.set(162 + Math.cos((a * Math.PI) / 180) * 15, 36 + Math.sin((a * Math.PI) / 180) * 15, "cream");
  // A shelf with a little night light.
  g.rect(140, 72, 44, 2, "woodL").rect(140, 74, 44, 1, "ink");
  g.rect(158, 66, 6, 6, "lilac").rect(157, 65, 8, 1, "ink").rect(160, 63, 2, 2, "white");
  g.glow(161, 68, 3, 16, "violet", 4);
  g.rect(146, 66, 4, 6, "red").rect(146, 65, 4, 1, "redL"); // a book
  // Rug and slippers.
  g.rect(0, 104, W, H - 104, "slate");
  g.rect(20, 110, 160, 40, "navy").frame(22, 112, 156, 38, "yellow");
  g.rect(140, 98, 7, 4, "red").rect(149, 99, 7, 4, "red").set(140, 98, "redL").set(149, 99, "redL");
  return g.vignette(12);
}

// ---------------------------------------------------------------------------------------------------
export function luggage(): Grid {
  const g = new Grid(W, H, "night");
  for (let x = 0; x < W; x += 9) g.rect(x, 0, 1, 104, "ink").rect(x + 1, 0, 1, 104, "panel");
  // Sliding door ajar on the right; moonlight falls across the floor.
  g.rect(174, 8, 26, 96, "slate").frame(174, 8, 26, 96, "ink").rect(170, 8, 4, 96, "violetD");
  g.rect(170, 10, 3, 92, "mist");
  for (let y = 10; y < H; y++) {
    const x0 = 170 - (y - 10) * 0.9, x1 = 173 - (y - 10) * 0.35;
    for (let x = Math.round(x0); x < Math.round(x1); x++) if (bayer(x, y) < (y > 104 ? 6 : 3)) g.set(x, y, y > 104 ? "lilac" : "mist");
  }
  // A big steamer trunk with a suitcase and a hatbox.
  g.rect(6, 72, 56, 32, "woodD").rect(6, 72, 56, 4, "wood").frame(6, 72, 56, 32, "ink");
  for (const x of [14, 50]) g.rect(x, 72, 3, 32, "ink");
  for (const [x, y] of [[6, 72], [59, 72], [6, 101], [59, 101]] as const) g.rect(x, y, 3, 3, "yellow");
  g.rect(31, 80, 6, 5, "yellow").set(33, 82, "ink");
  g.rect(12, 58, 40, 14, "red").frame(12, 58, 40, 14, "ink").rect(28, 55, 8, 3, "ink").rect(16, 62, 10, 6, "cream");
  g.rect(18, 64, 6, 1, "stone");
  g.disc(76, 94, 10, "navy").rect(66, 94, 21, 10, "navy").rect(66, 94, 21, 2, "navyL").rect(66, 100, 21, 1, "lilac");
  // Crate.
  g.rect(118, 62, 44, 42, "woodL").frame(118, 62, 44, 42, "ink");
  for (let y = 66; y < 104; y += 9) g.rect(118, y, 44, 1, "wood");
  g.line(118, 62, 162, 104, "wood").line(162, 62, 118, 104, "wood");
  g.text(124, 72, "FRAGILE", "red");
  // Birdcage hanging from the ceiling, its door open, the bird long gone.
  g.rect(96, 0, 1, 14, "ink");
  for (let x = 88; x <= 104; x += 4) g.rect(x, 19, 1, 21, "yellow");
  for (let a = 180; a <= 360; a += 10) g.set(96 + Math.cos((a * Math.PI) / 180) * 8, 19 + Math.sin((a * Math.PI) / 180) * 6, "yellow");
  g.line(96, 13, 96, 19, "yellow");
  g.rect(88, 40, 17, 2, "yellow").rect(92, 30, 9, 1, "rust");
  // Mail sacks and floorboards.
  g.disc(102, 98, 8, "stone").disc(98, 93, 3, "stone").rect(97, 89, 3, 2, "ink");
  g.rect(0, 104, W, H - 104, "woodD");
  for (let y = 108; y < H; y += 6) g.rect(0, y, W, 1, "ink");
  return g.vignette(18);
}

// ---------------------------------------------------------------------------------------------------
export function bridge(): Grid {
  const g = new Grid(W, H, "night");
  // Behind the bridge: sky, moon, far mountains, mist rising from the gorge.
  g.vgrad(0, 0, W, H, ["ink", "night", "violetD", "violet"]).stars(51, 90, 0, 0, W, 60);
  moon(g, 108, 42, 17);
  for (let x = 0; x < W; x++) g.rect(x, Math.round(74 + Math.sin(x / 23) * 6 + Math.sin(x / 9) * 2), 1, 80, "panel");
  for (let x = 0; x < W; x++) g.rect(x, Math.round(92 + Math.sin(x / 13 + 2) * 4), 1, 80, "night");
  for (let y = 100; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < 2 + Math.round((y - 100) / 9 + Math.sin(x / 11 + y / 6) * 2)) g.set(x, y, y % 2 ? "stoneL" : "stone");
  // The viaduct: a deck on stone piers, arch openings showing the gorge behind.
  const SPAN = 34, PIER = 8, SPRING = 88;
  const opening = (x: number, y: number): boolean => {
    const u = ((x % SPAN) + SPAN) % SPAN;
    if (u < PIER || y < 70) return false;
    const cx = PIER + (SPAN - PIER) / 2, r = (SPAN - PIER) / 2;
    return y >= SPRING || Math.hypot(u - cx, y - SPRING) < r;
  };
  for (let y = 66; y < H; y++) for (let x = 0; x < W; x++) {
    if (opening(x, y)) continue;
    const u = ((x % SPAN) + SPAN) % SPAN;
    const brick = (y % 5 === 0) || ((x + (Math.floor(y / 5) % 2) * 3) % 6 === 0);
    g.set(x, y, y < 70 ? (y === 66 ? "stoneL" : "stone") : brick ? "slate" : u === 0 ? "stoneL" : "stone");
  }
  for (let x = 0; x < W; x++) for (let y = 70; y < H; y++) if (!opening(x, y) && opening(x, y + 1)) g.set(x, y, "ink");
  g.rect(0, 64, W, 2, "ink"); // rails
  // The train crossing in front of the moon, every window lit; tiny figures wave.
  g.rect(20, 50, 132, 14, "ink").rect(20, 49, 132, 1, "slate");
  for (const x of [62, 106]) g.rect(x, 50, 2, 14, "night");
  for (let x = 24; x < 148; x += 9) {
    if (x > 58 && x < 66) continue;
    if (x > 102 && x < 110) continue;
    g.rect(x, 53, 6, 6, "yellow").rect(x, 53, 6, 1, "cream");
    if ((x / 9) % 2 < 1) g.set(x + 2, 54, "white").set(x + 3, 55, "white").set(x + 2, 56, "white").set(x + 1, 55, "white");
  }
  g.rect(152, 44, 30, 20, "ink").rect(174, 34, 5, 10, "ink").rect(156, 48, 7, 7, "orange").glow(159, 51, 3, 7, "orange", 4);
  // Steam blowing back over the train.
  for (let k = 0; k < 10; k++) g.disc(174 - k * 10, 32 - k * 0.8 - Math.sin(k) * 2, 2 + k * 0.35, k % 2 ? "mist" : "stoneL");
  return g.vignette(10);
}

// ---------------------------------------------------------------------------------------------------
export function homeDawn(): Grid {
  const g = new Grid(W, H, "violetD");
  g.vgrad(0, 0, W, 104, ["violetD", "violet", "red", "rust", "orange", "yellow"]);
  g.stars(64, 18, 0, 0, W, 20, ["lilac"]);
  // The train climbing into the sky, trailing gold steam down to your street.
  g.rect(150, 14, 18, 6, "ink").rect(166, 10, 3, 4, "ink");
  for (let x = 152; x < 166; x += 4) g.set(x, 16, "yellow");
  for (let k = 0; k < 40; k++) {
    const t = k / 39, x = lerp(148, 96, t) + Math.sin(t * 7) * 6, y = lerp(16, 84, t * t);
    g.set(x, y, k % 3 ? "yellow" : "cream").set(x + 1, y, k % 4 ? "orange" : "yellow");
  }
  // Row of houses.
  const r = rng(12);
  for (let x = -4; x < W;) {
    const w = 22 + Math.floor(r() * 10), h = 34 + Math.floor(r() * 18), top = 100 - h;
    const mine = x < 100 && x + w > 100;
    g.rect(x, top, w, h + 4, mine ? "panel" : "night");
    g.poly([[x - 2, top], [x + w / 2, top - 10], [x + w + 2, top]], mine ? "panel" : "night");
    g.rect(x + w - 7, top - 12, 4, 8, "night");
    for (let wy = top + 6; wy < 92; wy += 12) for (let wx = x + 4; wx < x + w - 5; wx += 9) g.rect(wx, wy, 5, 6, r() < 0.45 ? "yellow" : "slate").rect(wx + 2, wy, 1, 6, "night");
    if (mine) {
      g.rect(94, 82, 12, 18, "red").frame(93, 81, 14, 19, "ink").set(103, 91, "yellow");
      g.disc(109, 98, 3, "orange").set(109, 94, "green").set(108, 97, "yellow").set(110, 97, "yellow").rect(108, 99, 3, 1, "yellow");
    }
    x += w + 1;
  }
  // Cobbled street.
  g.vgrad(0, 100, W, H - 100, ["stone", "slate"]);
  for (let y = 102; y < H; y += 4) for (let x = (y / 4) % 2 ? 0 : 3; x < W; x += 6) g.set(x, y, "ink");
  g.rect(40, 50, 2, 50, "ink").rect(37, 46, 8, 5, "ink").rect(38, 47, 6, 3, "stoneL"); // lamp post, out at dawn
  return g.vignette(10);
}

// ---------------------------------------------------------------------------------------------------
export function endOfLine(): Grid {
  const g = new Grid(W, H, "panel");
  g.vgrad(0, 0, W, H, ["night", "panel", "stone", "stoneL"]);
  // A ghostly station: canopy, columns, the sign, figures waiting.
  g.rect(20, 18, 160, 6, "stone").rect(20, 24, 160, 1, "slate");
  for (const x of [36, 100, 164]) g.rect(x, 25, 3, 74, "stone");
  g.rect(62, 36, 76, 16, "slate").frame(62, 36, 76, 16, "stoneL");
  g.text(72, 42, "LAST STOP", "mist");
  g.disc(150, 44, 6, "stone").disc(150, 44, 5, "mist"); // a clock with no hands
  for (const [x, h] of [[54, 22], [74, 26], [118, 24], [134, 20], [176, 18], [24, 16]] as const) {
    g.disc(x, 98 - h, 3, "stoneL").rect(x - 3, 101 - h, 7, h - 3, "stoneL").rect(x - 3, 101 - h, 2, h - 3, "stone");
  }
  // Platform edge and the train, almost gone in the fog.
  g.rect(0, 98, W, 3, "mist").rect(0, 101, W, H - 101, "stoneL");
  g.rect(0, 60, 40, 30, "stone").rect(150, 62, 50, 28, "stone");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = 4 + Math.round(Math.sin(x / 17 + y / 9) * 3 + (y > 80 ? 4 : 0));
    if (bayer(x, y) < k) g.set(x, y, y > 100 ? "mist" : "stoneL");
  }
  g.glow(100, 30, 2, 12, "lilac", 4);
  return g.vignette(12, "night");
}

// ---------------------------------------------------------------------------------------------------
// Steam from the chimney: 8 looping frames, transparent around the puffs.
export const STEAM_FRAMES = 8;
export function steam(frame: number): Grid {
  const g = new Grid(40, 34);
  for (let k = 0; k < 4; k++) {
    const p = ((frame / STEAM_FRAMES + k / 4) % 1);
    const x = 20 - p * 14 + Math.sin(p * 6 + k) * 2, y = 32 - p * 30, r = 2.5 + p * 6;
    const keep = 16 - Math.round(p * p * 14);
    for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
      const d = Math.hypot(i - x, j - y);
      if (d > r || bayer(i, j) >= keep) continue;
      g.set(i, j, d < r * 0.5 && i < x ? "white" : (i - x) + (j - y) > r * 0.5 ? "stoneL" : "mist");
    }
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------
// Characters: 32×32, ink-outlined, drawn front-on.
function face(g: Grid, x: number, y: number, w: number, h: number): void {
  g.rect(x + 1, y, w - 2, h, "white").rect(x, y + 1, w, h - 2, "white");
  g.rect(x + w - 2, y + 1, 1, h - 2, "mist").rect(x + 1, y + h - 1, w - 2, 1, "mist");
}

export function conductor(): Grid {
  const g = new Grid(32, 32);
  g.poly([[2, 32], [7, 20], [25, 20], [30, 32]], "navy");
  g.poly([[5, 32], [8, 22], [10, 22], [8, 32]], "navyL");
  g.poly([[13, 20], [19, 20], [17, 28], [15, 28]], "white").rect(15, 21, 2, 6, "red");
  g.line(13, 20, 15, 28, "ink").line(18, 20, 16, 28, "ink");
  for (const [x, y] of [[11, 24], [11, 28], [20, 24], [20, 28]] as const) g.set(x, y, "yellow");
  g.rect(6, 20, 5, 2, "yellow").rect(21, 20, 5, 2, "yellow");
  g.rect(14, 17, 4, 3, "mist");
  face(g, 10, 8, 12, 10);
  g.rect(12, 11, 3, 2, "ink").rect(17, 11, 3, 2, "ink").set(13, 11, "lilac").set(18, 11, "lilac");
  g.set(15, 14, "mist").rect(14, 16, 4, 1, "stoneL");
  g.rect(9, 2, 14, 6, "navy").rect(10, 1, 12, 1, "navy").rect(10, 2, 6, 1, "navyL");
  g.rect(9, 6, 14, 1, "yellow").rect(15, 3, 2, 2, "yellow").rect(7, 7, 18, 2, "ink");
  g.disc(26, 28, 2, "white").rect(24, 24, 1, 4, "stoneL").rect(23, 23, 3, 1, "stoneL"); // gloved hand with a ticket punch
  return outline(g);
}

export function mrsPell(): Grid {
  const g = new Grid(32, 32);
  g.poly([[1, 32], [5, 21], [27, 21], [31, 32]], "violet");
  for (let y = 22; y < 32; y++) for (let x = 2; x < 31; x++) if (g.get(x, y) === "violet" && (x + y) % 3 === 0) g.set(x, y, "violetD");
  for (let x = 4; x < 29; x += 2) g.set(x, 31, "lilac");
  for (let x = 11; x < 22; x += 2) g.set(x, 21, "white"); // pearls
  g.rect(14, 18, 4, 3, "mist");
  face(g, 10, 9, 12, 10);
  g.rect(12, 13, 3, 1, "ink").rect(17, 13, 3, 1, "ink").rect(12, 12, 3, 1, "stoneL").rect(17, 12, 3, 1, "stoneL"); // squinting
  g.set(15, 15, "mist").rect(14, 17, 4, 1, "stoneL").set(13, 16, "stoneL").set(18, 16, "stoneL");
  g.disc(16, 9, 7, "stoneL").rect(10, 9, 12, 2, "stoneL").rect(11, 9, 10, 1, "stone");
  face(g, 11, 10, 10, 9);
  g.rect(12, 13, 3, 1, "ink").rect(17, 13, 3, 1, "ink").rect(12, 12, 3, 1, "stoneL").rect(17, 12, 3, 1, "stoneL");
  g.set(15, 15, "mist").rect(14, 17, 4, 1, "stoneL");
  g.disc(16, 3, 3, "stoneL").set(15, 2, "white").set(19, 2, "yellow"); // bun with a hairpin
  g.disc(25, 28, 3, "red").set(24, 27, "redL"); // ball of wool
  g.line(19, 30, 26, 23, "stoneL").line(21, 31, 27, 25, "stoneL");
  return outline(g);
}

export function pip(): Grid {
  const g = new Grid(32, 32);
  g.poly([[5, 32], [9, 20], [23, 20], [27, 32]], "mist");
  for (let x = 9; x < 25; x += 3) g.rect(x, 21, 1, 11, "navyL");
  g.rect(13, 20, 6, 2, "white");
  face(g, 10, 8, 12, 11);
  g.rect(12, 11, 3, 3, "ink").rect(17, 11, 3, 3, "ink").set(12, 11, "white").set(17, 11, "white");
  g.set(11, 10, "ink").set(12, 9, "ink").set(20, 10, "ink").set(19, 9, "ink");    // worried eyebrows (inner ends raised)
  g.rect(14, 16, 4, 1, "stoneL").set(13, 17, "stoneL").set(18, 17, "stoneL");      // a small frown
  g.rect(10, 5, 12, 4, "woodD");
  for (const x of [10, 13, 16, 19, 21]) g.set(x, 4, "woodD").set(x + 1, 3, x % 2 ? "woodD" : null);
  g.rect(9, 7, 2, 4, "woodD").rect(21, 7, 2, 4, "woodD");
  // Mrs. Pell's spectacles in his hands.
  g.disc(12, 27, 2.6, "ink").disc(12, 27, 1.6, "mist").disc(20, 27, 2.6, "ink").disc(20, 27, 1.6, "mist").rect(15, 26, 2, 1, "ink");
  g.set(11, 26, "white").set(19, 26, "white");
  g.rect(3, 29, 26, 3, "navy").rect(3, 29, 26, 1, "navyL"); // the blanket over his knees
  return outline(g);
}

export function biscuit(): Grid {
  const g = new Grid(32, 32);
  g.disc(16, 24, 9, "mist").rect(7, 24, 18, 8, "mist").disc(14, 22, 5, "white");
  g.disc(27, 22, 2.4, "mist").disc(28, 19, 2, "mist");                               // wagging tail
  g.rect(9, 29, 5, 3, "white").rect(18, 29, 5, 3, "white");                          // paws
  g.rect(10, 16, 12, 2, "red").set(16, 18, "yellow").set(16, 19, "yellow");          // collar and tag
  g.disc(16, 10, 7, "white").disc(18, 12, 4, "mist");
  g.poly([[8, 6], [11, 5], [10, 15], [6, 13]], "lilac");                             // floppy ear
  g.poly([[21, 6], [24, 0], [26, 6]], "lilac");                                      // the ear that stands up
  g.rect(12, 9, 3, 3, "lilac").rect(18, 9, 3, 3, "lilac").set(13, 10, "ink").set(19, 10, "ink");
  g.rect(15, 13, 3, 2, "ink").set(16, 15, "redL");
  return outline(g);
}

// ---------------------------------------------------------------------------------------------------
// Items.
export function spectacles(): Grid {
  const g = new Grid(16, 16);
  g.disc(4.5, 9, 3.4, "ink").disc(4.5, 9, 2.4, "mist").disc(11.5, 9, 3.4, "ink").disc(11.5, 9, 2.4, "mist");
  g.set(3, 8, "white").set(10, 8, "white").rect(7, 8, 2, 1, "ink").line(1, 8, 0, 5, "ink").line(15, 8, 15, 5, "ink");
  return g;
}

export function musicBox(): Grid {
  const g = new Grid(16, 16);
  g.rect(2, 8, 12, 6, "woodL").rect(2, 13, 12, 1, "woodD").frame(1, 7, 14, 8, "ink");
  g.poly([[1, 7], [3, 2], [15, 2], [14, 7]], "wood").line(3, 2, 15, 2, "ink").line(1, 7, 3, 2, "ink").line(15, 2, 14, 7, "ink");
  g.rect(4, 4, 8, 2, "yellow").rect(4, 9, 8, 2, "yellow").set(7, 10, "orange");
  g.rect(15, 10, 1, 2, "ink").set(15, 9, "yellow");
  g.set(1, 0, "lilac").set(2, 1, "lilac").set(13, 0, "lilac").set(12, 1, "lilac");
  return g;
}

function ticketBase(punched: boolean): Grid {
  const g = new Grid(32, 32);
  g.rect(2, 7, 28, 18, "cream").rect(2, 7, 28, 2, "red").rect(2, 23, 28, 2, "red").frame(1, 6, 30, 20, "ink");
  for (let y = 9; y < 23; y += 2) g.set(22, y, "stone");
  g.text(4, 11, "HOME", "red");
  g.text(4, 17, "1952", "stone");
  g.rect(24, 13, 4, 6, "yellow").frame(24, 13, 4, 6, "rust");
  if (punched) g.disc(26, 16, 2.2, null).frame(1, 6, 30, 20, "ink");
  return g;
}
export const ticket = (): Grid => ticketBase(false);
export const ticketPunched = (): Grid => ticketBase(true);

export function stationClock(): Grid {
  const g = new Grid(16, 16);
  g.rect(7, 0, 2, 2, "ink").disc(7.5, 8.5, 6.6, "ink").disc(7.5, 8.5, 5.6, "cream");
  for (const [x, y] of [[7, 4], [12, 8], [7, 13], [3, 8]] as const) g.set(x, y, "stone");
  g.line(7, 8, 7, 4, "ink").line(7, 8, 6, 5, "ink").set(8, 9, "red");
  return g;
}
