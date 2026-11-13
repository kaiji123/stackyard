// New sprites: 16×16 grids scaled ×16 (256 px, transparent), in the style of media/sprites
// (ink outline, flat colour, one highlight). Pumpkin pictures are 24×24 ×12 like media/pumpkin-steps.
import { Grid, type Colour } from "./grid.ts";

function art(w: number, h: number, rows: readonly string[], legend: Readonly<Record<string, Colour>>): Grid {
  if (rows.length !== h || rows.some((r) => r.length !== w)) {
    throw new Error(`Sprite rows must be ${w}×${h}: ${rows.map((r) => r.length).join(",")}`);
  }
  return new Grid(w, h).stamp(0, 0, rows, legend);
}

/** Eleanor: a small ghost girl with dark hair, a red ribbon and a grey dress that fades to wisps. */
export const eleanor = (): Grid => art(16, 16, [
  ".....kkkkkk.....",
  "....khhhhhhkrr..",
  "...khhhhhhhhkr..",
  "...khwwwwwwhk...",
  "...khwkwwkwhk...",
  "...khwkwwkwhk...",
  "...khwwmmwwhk...",
  "...kkhwwwwhkk...",
  "....kkwwwwwkk...",
  "...kgggGGgggk...",
  "..kggggGGggggk..",
  "..kggggGGggggk..",
  ".kgggggGGgggggk.",
  ".kgggggGGgggggk.",
  ".kggggggggggggk.",
  "..lkl.lkl.lkl...",
], { k: "ink", h: "woodD", w: "white", m: "stoneL", r: "redL", g: "stone", G: "stoneL", l: "lilac" });

/** Eleanor's open diary with a red ribbon bookmark. */
export const diary = (): Grid => art(16, 16, [
  "................",
  "................",
  "................",
  ".kkkkkk..kkkkkk.",
  "kppppppkkppppppk",
  "kpsssspkkpsssspk",
  "kppppppkkppppppk",
  "kpsssspkkpsspppk",
  "kppppppkkppppppk",
  "kpssppppkpsssspk",
  "kppppppkkppppppk",
  "kpsssspkkpsspppk",
  "kbbbbbbkkbbbbbbk",
  ".kkkkkkkrkkkkkk.",
  "........r.......",
  ".......r.r......",
], { k: "ink", p: "cream", s: "stoneL", b: "red", r: "redL" });

/** An old letter, yellowed, sealed with red wax. */
export const letter = (): Grid => art(16, 16, [
  "................",
  "................",
  ".kkkkkkkkkkkkkk.",
  ".kppppppppppppk.",
  ".kpsssssssssppk.",
  ".kppppppppppppk.",
  ".kpssssssssyppk.",
  ".kppppppppppppk.",
  ".kpsssssspppppk.",
  ".kppppppkkpppyk.",
  ".kyppppkrrkpppk.",
  ".kppppkrRrrkppk.",
  ".kyyppkrrrrkyyk.",
  ".kkkkkkkrrkkkkk.",
  "................",
  "................",
], { k: "ink", p: "cream", y: "yellow", s: "stoneL", r: "red", R: "redL" });

/** A cracked gravestone in the grass with a green light hovering over it. */
export const gravestone = (): Grid => art(16, 16, [
  ".......m........",
  "......mMm.......",
  ".......m........",
  ".....kkkkkk.....",
  "....kssssssk....",
  "...kssSSSSssk...",
  "...ksdddddssk...",
  "...ksssssdssk...",
  "...ksddddsdsk...",
  "...ksssssssdk...",
  "...ksdddddsdk...",
  "...kssssssssk...",
  "...kssssssssk...",
  "..gkkkkkkkkkkg..",
  ".gGgGggGgGggGgg.",
  "gGgggGgggGggGggg",
], { k: "ink", s: "stone", S: "stoneL", d: "slate", g: "green", G: "greenD", m: "mint", M: "white" });

/** A hand lantern with a warm flame (the lantern you catch on the road). */
export const lantern = (): Grid => art(16, 16, [
  "......kkkk......",
  ".....k....k.....",
  ".....k....k.....",
  "......kkkk......",
  ".....kssssk.....",
  "....kkkkkkkk....",
  "....kyyyyyyk....",
  "....kyyooyyk....",
  "....kyoOOoyk....",
  "....kyoOOoyk....",
  "....kyyooyyk....",
  "....kyyyyyyk....",
  "....kkkkkkkk....",
  ".....kssssk.....",
  "......kkkk......",
  "................",
], { k: "ink", s: "stoneL", y: "yellow", o: "orange", O: "cream" });

/** Pumpkin school, step 1: a spoon, a marker and a small saw. 24×24 ×12. */
export function tools(): Grid {
  const g = new Grid(24, 24);
  // Spoon.
  g.disc(6, 6, 3.2, "ink").disc(6, 6, 2.2, "stoneL").set(5, 5, "white");
  g.line(7, 9, 12, 20, "ink").line(8, 9, 13, 20, "ink").line(8, 10, 12, 19, "stoneL");
  // Marker.
  g.rect(15, 3, 4, 14, "ink").rect(16, 4, 2, 12, "red").rect(16, 4, 2, 3, "redL").rect(16, 16, 2, 2, "ink").set(16, 18, "ink");
  // Saw.
  g.rect(2, 20, 16, 3, "ink").rect(3, 20, 14, 2, "stoneL");
  for (let x = 3; x < 17; x += 2) g.set(x, 23, "ink");
  g.rect(18, 18, 5, 6, "ink").rect(19, 19, 3, 4, "wood");
  return g;
}

/** Pumpkin school, bonus step: a tray of roasted seeds. 24×24 ×12. */
export function seeds(): Grid {
  const g = new Grid(24, 24);
  g.rect(1, 9, 22, 11, "ink").rect(2, 10, 20, 9, "stone").rect(2, 10, 20, 1, "stoneL");
  const spots: readonly (readonly [number, number])[] = [
    [4, 12], [8, 11], [12, 13], [16, 11], [19, 13], [5, 15], [9, 16], [14, 15], [18, 16], [6, 18], [11, 18], [16, 18], [20, 17], [3, 17],
  ];
  for (const [x, y] of spots) g.rect(x, y, 2, 1, "cream").set(x, y + 1, "yellow");
  // Steam.
  g.set(7, 6, "white").set(8, 5, "white").set(8, 4, "white").set(14, 7, "white").set(13, 6, "white").set(14, 5, "white");
  return g;
}
