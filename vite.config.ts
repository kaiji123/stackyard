import { defineConfig } from "vite";

// Relative base so the built editor works from GitHub Pages sub-paths.
export default defineConfig({ base: "./", build: { outDir: "dist", target: "es2020" } });
