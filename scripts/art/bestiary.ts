// Art for "The Halloween Bestiary": 17 creature portraits (32×32 ×8 = 256 px, transparent, ink outline),
// an animated will-o'-the-wisp, and the cover (a candlelit library, 200×150 ×4).
// Designs are our own and generic folklore; nothing is copied from films (no studio monster make-up).
import { bayer, Grid, rng, type Colour } from "./grid.ts";

/** Ink outline around every opaque pixel. */
function outline(g: Grid, c: Colour = "ink"): Grid {
  const src = g.clone();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (src.get(x, y) !== null) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => src.get(x + (dx ?? 0), y + (dy ?? 0)) !== null)) g.set(x, y, c);
  }
  return g;
}
const sym = (g: Grid, f: (x: number) => void): void => { f(1); f(-1); };

// ---- Spirits ---------------------------------------------------------------------------------------
export function ghost(): Grid {
  const g = new Grid(32, 32);
  g.disc(16, 12, 10, "white").rect(6, 12, 20, 14, "white");
  for (const [x, d] of [[6, 0], [11, 2], [16, 0], [21, 2]] as const) g.disc(x + 2.5, 26 + d, 2.6, "white");
  for (let y = 4; y < 27; y++) for (let x = 22; x < 27; x++) if (g.get(x, y) === "white" && x - 22 > (y < 12 ? 2 : 0)) g.set(x, y, "mist"); // soft shade on the right
  g.disc(12, 12, 2.6, "ink").disc(20, 12, 2.6, "ink").set(11, 11, "lilac").set(19, 11, "lilac"); // eyes
  g.disc(16, 18, 2.2, "ink").set(16, 17, "violetD");                                             // "oooh"
  g.disc(9, 16, 1.4, "lilac").disc(23, 16, 1.4, "lilac");                                        // cheeks
  g.rect(2, 16, 4, 2, "white").rect(26, 14, 4, 2, "white");                                      // little arms
  return outline(g);
}

export function banshee(): Grid {
  const g = new Grid(32, 32);
  g.poly([[8, 9], [24, 9], [29, 32], [3, 32]], "stoneL");                                       // long grey hair
  g.poly([[11, 16], [21, 16], [25, 32], [7, 32]], "mist");                                      // pale dress
  for (let x = 9; x < 24; x += 3) g.line(x, 20, x - 1, 31, "lilac");
  g.disc(16, 11, 6, "white").rect(10, 7, 12, 3, "stoneL");                                      // face, fringe
  g.rect(12, 10, 3, 2, "ink").rect(17, 10, 3, 2, "ink").set(12, 12, "lilac").set(19, 12, "lilac"); // tears
  g.disc(16, 15, 1.8, "ink");                                                                   // wailing mouth
  // The cry: small sound arcs beside her face.
  for (const s of [-1, 1]) for (const r of [3, 5]) for (let a = -0.6; a <= 0.6; a += 0.3) g.set(16 + s * (6 + r * Math.cos(a)), 13 + r * Math.sin(a), r === 3 ? "lilac" : "violet");
  g.rect(13, 20, 6, 2, "redL");                                                                 // a red cloak clasp
  return outline(g);
}

export function reaper(): Grid {
  const g = new Grid(32, 32);
  g.line(26, 3, 26, 31, "woodL").line(27, 3, 27, 31, "wood");                                   // scythe handle
  g.poly([[26, 3], [13, 2], [6, 6], [14, 5], [26, 6]], "stoneL").line(7, 6, 14, 4, "white");   // blade
  g.poly([[9, 12], [22, 12], [27, 32], [4, 32]], "ink");                                        // robe
  g.poly([[8, 11], [16, 3], [24, 11], [24, 20], [8, 20]], "night");                             // hood
  g.disc(16, 13, 5, "panel");                                                                   // shadowed face
  g.disc(14, 13, 1.3, "mint").disc(18, 13, 1.3, "mint");                                        // eyes glow
  g.rect(14, 16, 5, 1, "stone");
  g.rect(22, 20, 4, 3, "white").set(25, 19, "white");                                           // bony hand on the handle
  g.rect(5, 22, 4, 6, "yellow").rect(5, 22, 4, 1, "rust").rect(5, 27, 4, 1, "rust").set(6, 24, "orange").set(7, 25, "orange"); // hourglass
  return outline(g, "night");
}

export const WISP_FRAMES = 8;
export function wisp(frame: number): Grid {
  const g = new Grid(32, 32);
  const t = (frame / WISP_FRAMES) * Math.PI * 2;
  const cx = 16 + Math.sin(t) * 3, cy = 14 + Math.cos(t * 2) * 2;
  // A soft, flickering ball of green light trailing sparks.
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
    const d = Math.hypot(i - cx, j - cy);
    if (d < 2.2) g.set(i, j, "white");
    else if (d < 4.6) g.set(i, j, "mint");
    else if (d < 10 && bayer(i + frame, j) < Math.round((10 - d) * 2.4)) g.set(i, j, d < 7.5 ? "mint" : "green");
  }
  for (let k = 0; k < 6; k++) {
    const a = t + k * 1.1, r = 8 + (k % 3) * 2;
    g.set(cx + Math.cos(a) * r, cy + 8 + Math.sin(a) * 2 + k, k % 2 ? "mint" : "yellow");
  }
  for (let k = 1; k <= 4; k++) g.set(cx - Math.sin(t) * k * 1.5, cy + 6 + k * 2.5, k % 2 ? "green" : "mint");
  return g;
}

export function jack(): Grid {
  // Stingy Jack, the wandering man, holding up his carved turnip lantern.
  const g = new Grid(32, 32);
  g.poly([[6, 14], [20, 14], [23, 32], [3, 32]], "woodD");                                     // ragged coat
  for (let x = 4; x < 23; x += 3) g.set(x, 31, null).set(x + 1, 30, "woodD");
  g.rect(11, 14, 4, 18, "red").line(13, 15, 13, 31, "redD");                                  // scarf
  g.disc(13, 9, 5, "cream").rect(8, 3, 11, 3, "ink").rect(6, 6, 15, 1, "ink");                // face, hat
  g.rect(11, 8, 1, 2, "ink").rect(15, 8, 1, 2, "ink").line(11, 12, 15, 11, "woodD");          // a sly grin
  g.line(21, 17, 25, 12, "woodD").line(22, 18, 26, 13, "woodD");                              // raised arm
  g.disc(26, 10, 4.5, "cream").disc(26, 11, 3.6, "mist").rect(25, 4, 2, 3, "green");          // the turnip
  g.rect(24, 9, 2, 2, "orange").rect(27, 9, 2, 2, "orange").rect(24, 12, 5, 1, "orange").set(26, 11, "yellow"); // its carved face, a coal inside
  return outline(g);
}

// ---- The Undead ------------------------------------------------------------------------------------
export function vampire(): Grid {
  const g = new Grid(32, 32);
  g.poly([[2, 32], [7, 14], [16, 18], [25, 14], [30, 32]], "ink");                             // cape
  g.poly([[7, 14], [3, 7], [11, 13]], "red").poly([[25, 14], [29, 7], [21, 13]], "red");       // high red collar
  g.poly([[11, 18], [21, 18], [24, 32], [8, 32]], "night");                                    // suit
  g.poly([[14, 18], [18, 18], [17, 25], [15, 25]], "white").rect(15, 19, 2, 2, "red");         // shirt and tie
  g.disc(16, 11, 6, "mist").rect(10, 11, 12, 4, "mist");                                       // pale face
  g.poly([[9, 9], [16, 3], [23, 9], [16, 6]], "ink");                                          // widow's peak
  g.rect(12, 10, 3, 2, "red").rect(17, 10, 3, 2, "red").set(13, 10, "white").set(18, 10, "white"); // red eyes
  g.rect(14, 14, 4, 1, "redD").set(14, 15, "white").set(17, 15, "white");                      // fangs
  return outline(g);
}

export function zombie(): Grid {
  const g = new Grid(32, 32);
  g.poly([[6, 17], [26, 17], [28, 32], [4, 32]], "stone");                                     // torn shirt
  for (const x of [8, 14, 22]) g.line(x, 32, x + 2, 27, null);
  g.rect(9, 22, 4, 4, "green").set(21, 24, "green");                                           // skin through the holes
  g.line(26, 18, 31, 14, "green").line(26, 19, 31, 15, "green").line(5, 18, 0, 15, "green").line(5, 19, 0, 16, "green"); // arms out
  g.disc(16, 10, 7, "green").rect(9, 10, 14, 5, "green").disc(18, 8, 3, "mint");              // head
  g.rect(9, 3, 4, 2, "woodD").rect(15, 2, 5, 2, "woodD").set(21, 4, "woodD");                 // patchy hair
  g.disc(12, 10, 2, "cream").disc(20, 10, 2.4, "cream").set(12, 10, "ink").set(21, 11, "ink"); // mismatched eyes
  g.rect(12, 14, 8, 2, "greenD").set(13, 14, "white").set(16, 15, "white").set(18, 14, "white"); // groan
  g.line(20, 5, 23, 8, "greenD").line(21, 5, 22, 6, "redD");                                   // stitches
  return outline(g);
}

export function mummy(): Grid {
  const g = new Grid(32, 32);
  g.poly([[8, 16], [24, 16], [26, 32], [6, 32]], "cream");
  g.disc(16, 10, 8, "cream").rect(8, 10, 16, 7, "cream");
  // Bandage stripes in two directions.
  for (let y = 3; y < 32; y += 3) for (let x = 0; x < 32; x++) if (g.get(x, y) === "cream") g.set(x, y + ((x / 7) | 0) % 2, "mist");
  for (const [x0, y0, x1, y1] of [[8, 6, 24, 9], [7, 20, 25, 24], [9, 27, 24, 25]] as const) g.line(x0, y0, x1, y1, "yellow");
  g.rect(10, 9, 13, 4, "night").disc(13, 11, 1.4, "yellow").disc(20, 11, 1.4, "yellow");     // dark gap, glowing eyes
  g.line(24, 13, 29, 22, "cream").line(25, 13, 30, 21, "mist").set(29, 23, "cream");         // a loose bandage
  g.rect(13, 18, 6, 4, "yellow").rect(15, 18, 2, 4, "orange").set(16, 19, "ink");            // a gold scarab
  return outline(g);
}

export function skeleton(): Grid {
  const g = new Grid(32, 32);
  g.disc(16, 9, 7.5, "white").rect(11, 12, 10, 6, "white");                                   // skull
  g.disc(13, 9, 2.4, "ink").disc(19, 9, 2.4, "ink").poly([[16, 12], [15, 14], [17, 14]], "ink"); // sockets, nose
  for (let x = 12; x < 21; x += 2) g.rect(x, 16, 1, 2, "ink");                                // teeth
  g.disc(13, 9, 0.8, "mint").disc(19, 9, 0.8, "mint");                                        // a friendly glint
  g.rect(15, 18, 2, 14, "mist");                                                              // spine
  for (let k = 0; k < 4; k++) { const y = 20 + k * 3; g.line(16, y, 8 + k, y + 2, "white").line(16, y, 24 - k, y + 2, "white"); } // ribs
  g.rect(6, 19, 4, 2, "white").rect(22, 19, 4, 2, "white");                                   // shoulders
  g.line(23, 20, 29, 13, "white").disc(29, 12, 1.6, "white");                                 // waving
  g.disc(10, 4, 2, "orange").set(10, 2, "green");                                             // a marigold (Day of the Dead)
  return outline(g);
}

// ---- Magic folk ------------------------------------------------------------------------------------
export function witch(): Grid {
  const g = new Grid(32, 32);
  g.poly([[5, 32], [10, 16], [22, 16], [27, 32]], "violetD");                                 // robe
  g.rect(14, 16, 4, 2, "yellow").set(15, 17, "orange");                                       // buckle
  g.disc(16, 13, 5, "green").rect(11, 12, 10, 5, "green");                                   // face
  g.rect(12, 12, 2, 2, "ink").rect(18, 12, 2, 2, "ink").set(12, 12, "white").set(18, 12, "white");
  g.poly([[16, 13], [15, 16], [18, 16]], "greenD").rect(13, 17, 6, 1, "greenD").set(19, 16, "greenD"); // nose, smirk
  g.rect(7, 12, 4, 10, "orange").rect(21, 12, 4, 10, "orange");                               // orange hair
  g.poly([[4, 10], [28, 10], [26, 12], [6, 12]], "ink");                                      // brim
  g.poly([[9, 10], [23, 10], [20, 2], [24, -1], [14, 3]], "ink");                             // crooked pointed hat
  g.rect(9, 8, 14, 2, "violet").set(15, 8, "yellow").set(16, 8, "yellow");                    // hat band
  g.line(25, 18, 31, 31, "woodL").poly([[28, 26], [31, 25], [32, 32], [26, 32]], "yellow");   // broom
  return outline(g);
}

export function werewolf(): Grid {
  const g = new Grid(32, 32);
  g.poly([[3, 32], [7, 17], [25, 17], [29, 32]], "wood");                                     // shaggy shoulders
  for (let x = 4; x < 29; x += 2) g.set(x, 17 + (x % 4 === 0 ? 0 : 1), "woodL");
  g.poly([[12, 22], [20, 22], [22, 32], [10, 32]], "woodL");                                  // chest
  g.poly([[7, 8], [9, 1], [13, 6]], "wood").poly([[25, 8], [23, 1], [19, 6]], "wood");        // ears
  g.set(9, 4, "redD").set(23, 4, "redD");
  g.disc(16, 11, 8, "wood").rect(9, 9, 14, 7, "wood");                                       // head
  g.poly([[11, 13], [21, 13], [19, 20], [13, 20]], "woodL");                                  // muzzle
  g.rect(14, 13, 4, 2, "ink");                                                                // nose
  g.rect(12, 18, 8, 2, "ink").set(13, 18, "white").set(18, 18, "white").set(13, 19, "white").set(18, 19, "white"); // fangs
  g.rect(10, 9, 3, 2, "yellow").rect(19, 9, 3, 2, "yellow").set(11, 9, "ink").set(20, 9, "ink"); // eyes
  g.line(8, 8, 12, 8, "woodD").line(24, 8, 20, 8, "woodD");                                   // brows
  g.rect(14, 24, 1, 6, "redD").rect(16, 24, 2, 5, "stoneL");                                  // torn shirt hint
  return outline(g);
}

export function goblin(): Grid {
  const g = new Grid(32, 32);
  g.poly([[8, 32], [11, 20], [21, 20], [24, 32]], "woodD").rect(10, 25, 12, 2, "rust");      // jerkin and belt
  g.poly([[2, 9], [10, 12], [9, 15]], "green").poly([[30, 9], [22, 12], [23, 15]], "green");  // big ears
  g.disc(16, 13, 7, "green").rect(9, 13, 14, 5, "green");
  g.disc(12, 12, 2.4, "yellow").disc(20, 12, 2.4, "yellow").set(12, 12, "ink").set(21, 12, "ink"); // big eyes
  g.poly([[16, 13], [14, 18], [19, 17]], "greenD");                                           // long nose
  g.line(11, 18, 21, 18, "ink").set(12, 19, "white").set(19, 19, "white");                    // toothy grin
  g.rect(12, 4, 8, 3, "redD").set(16, 3, "redD");                                             // tiny cap
  g.disc(25, 26, 3, "yellow").set(24, 25, "cream");                                           // a stolen coin
  return outline(g);
}

export function kitsune(): Grid {
  const g = new Grid(32, 32);
  // Nine tails as a fan behind her: nine wedges, ink lines between them, white tips.
  const cx = 16, cy = 22, R = 15.5, from = Math.PI * 0.86, span = Math.PI * 1.28, n = 9;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x - cx, y - cy);
    let a = Math.atan2(y - cy, x - cx); if (a < from) a += Math.PI * 2;
    const u = (a - from) / span;
    if (u < 0 || u > 1) continue;
    const k = Math.floor(u * n), f = u * n - k;
    const reach = R - (1 - Math.sin(f * Math.PI)) * 4.5;    // each tail ends in its own rounded tip
    if (d > reach) continue;
    const edge = (f < 0.12 || f > 0.88) && d > 7;
    g.set(x, y, edge ? "ink" : d > reach - 2.2 ? "white" : k % 2 ? "rust" : "orange");
  }
  // Sitting body and head in front.
  g.poly([[11, 32], [12, 20], [20, 20], [21, 32]], "orange").poly([[14, 24], [18, 24], [18, 32], [14, 32]], "white");
  g.poly([[10, 9], [11, 2], [15, 7]], "orange").poly([[22, 9], [21, 2], [17, 7]], "orange").set(11, 5, "white").set(21, 5, "white");
  g.disc(16, 12, 5.6, "orange").poly([[11, 13], [21, 13], [16, 19]], "white");                // face, white muzzle
  g.line(12, 11, 14, 12, "ink").line(20, 11, 18, 12, "ink");                                  // narrow, clever eyes
  g.set(16, 18, "ink").line(11, 10, 10, 8, "red").line(21, 10, 22, 8, "red");                 // nose, red markings
  g.disc(16, 22, 1.5, "white").set(16, 21, "mint");                                           // a glowing jewel
  return outline(g);
}

// ---- Real animals ----------------------------------------------------------------------------------
export function blackCat(): Grid {
  const g = new Grid(32, 32);
  g.poly([[9, 32], [11, 18], [21, 18], [24, 32]], "night");                                   // body
  g.line(23, 30, 28, 26, "night").line(28, 26, 27, 18, "night").line(24, 31, 29, 26, "night").line(29, 26, 28, 18, "night"); // tail
  g.poly([[8, 9], [9, 1], [14, 6]], "night").poly([[24, 9], [23, 1], [18, 6]], "night").set(10, 5, "red").set(22, 5, "red");
  g.disc(16, 11, 7, "night").rect(9, 11, 14, 5, "night");
  g.disc(12, 11, 2.4, "yellow").disc(20, 11, 2.4, "yellow").rect(12, 9, 1, 5, "ink").rect(20, 9, 1, 5, "ink"); // slit eyes
  g.poly([[15, 14], [17, 14], [16, 15]], "redL");
  for (const s of [-1, 1]) g.line(16 + s * 3, 15, 16 + s * 9, 14, "stone").line(16 + s * 3, 16, 16 + s * 9, 17, "stone"); // whiskers
  g.rect(13, 18, 6, 1, "orange").set(16, 19, "yellow");                                       // collar with a bell
  return outline(g, "panel");
}

export function bat(): Grid {
  const g = new Grid(32, 32);
  const wing = (s: number): void => {
    g.poly([[16, 12], [16 + s * 15, 6], [16 + s * 13, 12], [16 + s * 11, 10], [16 + s * 9, 16], [16 + s * 7, 13], [16, 19]], "violetD");
    g.line(16, 12, 16 + s * 15, 6, "violet").line(16 + s * 4, 12, 16 + s * 11, 10, "violet").line(16 + s * 3, 14, 16 + s * 9, 16, "violet");
  };
  sym(g, wing);
  g.disc(16, 16, 5, "woodD").disc(16, 17, 3.5, "wood");                                       // furry body
  g.poly([[12, 12], [12, 6], [15, 10]], "woodD").poly([[20, 12], [20, 6], [17, 10]], "woodD"); // ears
  g.disc(16, 12, 3.6, "woodD");
  g.set(14, 12, "white").set(18, 12, "white").set(15, 14, "white").set(17, 14, "white");     // eyes, tiny fangs
  g.set(16, 13, "redL");
  g.line(14, 21, 13, 24, "woodD").line(18, 21, 19, 24, "woodD");                              // feet
  return outline(g);
}

export function spider(): Grid {
  const g = new Grid(32, 32);
  g.line(16, 0, 16, 8, "mist");                                                               // hanging by a thread
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const y = 13 + k * 3;
    g.line(16, y, 16 + s * 9, y - 6 + k * 2, "ink").line(16 + s * 9, y - 6 + k * 2, 16 + s * 13, y + 2 + k * 2, "ink");
  }
  g.disc(16, 19, 6, "night").disc(16, 11, 4, "night");
  g.rect(14, 16, 4, 1, "red").rect(15, 17, 2, 4, "red").rect(14, 21, 4, 1, "red");           // markings
  for (const [x, y] of [[14, 10], [18, 10], [13, 12], [19, 12]] as const) g.set(x, y, "mint"); // eight eyes, four you can see
  g.set(15, 11, "white").set(17, 11, "white");
  return outline(g, "panel");
}

export function owl(): Grid {
  const g = new Grid(32, 32);
  g.rect(2, 28, 28, 3, "woodD").rect(2, 28, 28, 1, "wood");                                   // branch
  g.disc(16, 18, 10, "wood").rect(6, 18, 20, 9, "wood");
  for (let y = 20; y < 27; y += 2) for (let x = 11; x < 22; x += 3) g.set(x + (y % 4 ? 1 : 0), y, "cream"); // speckled chest
  g.poly([[7, 9], [9, 3], [12, 8]], "wood").poly([[25, 9], [23, 3], [20, 8]], "wood");        // ear tufts
  g.disc(16, 11, 8, "wood");
  g.disc(12, 11, 3.6, "cream").disc(20, 11, 3.6, "cream");                                    // facial discs
  g.disc(12, 11, 2.2, "orange").disc(20, 11, 2.2, "orange").disc(12, 11, 1.2, "ink").disc(20, 11, 1.2, "ink");
  g.set(11, 10, "white").set(19, 10, "white");
  g.poly([[15, 14], [17, 14], [16, 17]], "yellow");                                           // beak
  g.rect(11, 27, 3, 2, "yellow").rect(18, 27, 3, 2, "yellow");                                // talons
  return outline(g);
}

// ---- Cover: a candlelit library with the bestiary open on a lectern ---------------------------------
export function cover(): Grid {
  const W = 200, H = 150;
  const g = new Grid(W, H, "night");
  // Bookshelves floor to ceiling.
  const r = rng(91);
  for (let shelf = 0; shelf < 5; shelf++) {
    const y = 6 + shelf * 21;
    g.rect(0, y + 17, W, 3, "woodD").rect(0, y + 17, W, 1, "wood");
    for (let x = 2; x < W - 2;) {
      const w = 3 + Math.floor(r() * 4), h = 10 + Math.floor(r() * 7);
      const c = (["red", "redD", "navy", "navyL", "greenD", "green", "violetD", "wood", "rust"] as const)[Math.floor(r() * 9)] ?? "red";
      if (r() < 0.06) { x += 6; continue; } // a gap
      g.rect(x, y + 17 - h, w, h, c).rect(x, y + 17 - h + 2, w, 1, "yellow").set(x, y + 17 - h, "ink");
      x += w + (r() < 0.2 ? 1 : 0);
    }
  }
  for (const x of [0, 66, 132, 198]) g.rect(x, 0, 3, 110, "woodD"); // uprights
  // A skull and a sleeping owl on the shelves.
  g.disc(28, 33, 4, "white").rect(25, 34, 6, 3, "white").set(26, 33, "ink").set(29, 33, "ink").set(27, 36, "ink");
  g.disc(170, 75, 5, "wood").disc(168, 72, 2, "cream").disc(172, 72, 2, "cream").line(167, 72, 169, 72, "ink").line(171, 72, 173, 72, "ink").set(170, 74, "yellow");
  // Warm light falling from the candles; the room darker toward the edges.
  g.vignette(30, "ink");
  // Lectern and the open book.
  g.poly([[78, 150], [122, 150], [112, 96], [88, 96]], "woodD").rect(92, 96, 16, 54, "wood");
  g.poly([[56, 96], [144, 96], [136, 78], [64, 78]], "wood");
  g.poly([[62, 92], [99, 92], [99, 72], [66, 74]], "cream").poly([[101, 92], [138, 92], [134, 74], [101, 72]], "cream");
  g.rect(99, 72, 2, 21, "woodD");
  for (let y = 77; y < 90; y += 3) { g.line(68, y, 95, y - 1, "stone"); g.line(105, y - 1, 131, y, "stone"); }
  // Tiny pictures on the pages: a bat and a ghost.
  g.stamp(72, 76, ["v.....v", "vv.v.vv", ".vvvvv.", "..v.v.."], { v: "violetD" });
  g.stamp(118, 76, [".www.", "wkwkw", "wwwww", "w.w.w"], { w: "mist", k: "ink" });
  g.rect(65, 92, 72, 1, "ink");
  // Ribbon bookmark.
  g.rect(100, 92, 1, 9, "red").set(99, 101, "red").set(101, 101, "red");
  // Candlelight on the open pages (the candles themselves are animated sprites on the card).
  for (let y = 70; y < 96; y++) for (let x = 56; x < 144; x++) if (g.get(x, y) === "cream" && bayer(x, y) < 3) g.set(x, y, "yellow");
  // Floor.
  g.rect(0, 110, W, 40, "woodD");
  for (let y = 114; y < H; y += 6) g.rect(0, y, W, 1, "ink");
  return g;
}
