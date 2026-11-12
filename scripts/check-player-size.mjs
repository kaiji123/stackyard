// Fails if the player (min+gzip) exceeds the 30 KB budget in .kiro/steering/tech.md.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET = 30 * 1024;
execSync("npx vite build -c vite.player.config.ts", { stdio: "ignore" });
const size = gzipSync(readFileSync("dist-player/player.js")).length;
const pct = Math.round((size / BUDGET) * 100);
console.log(`player: ${(size / 1024).toFixed(2)} KB min+gzip (${pct}% of the 30 KB budget)`);
if (size > BUDGET) {
  console.error("FAIL: player is over budget. Remove code or avoid importing heavy modules into src/player.");
  process.exit(1);
}
