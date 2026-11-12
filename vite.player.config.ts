import { defineConfig } from "vite";

// Builds the zero-dependency player as one IIFE script that gets inlined into exported files.
export default defineConfig({
  build: {
    outDir: "dist-player",
    emptyOutDir: true,
    minify: true,
    target: "es2020",
    lib: { entry: "src/player/entry.ts", formats: ["iife"], name: "Stackyard", fileName: () => "player.js" },
  },
});
