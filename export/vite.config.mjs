import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": resolve(dir, "../src") } },
  build: {
    outDir: dir,
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve(dir, "play.ts"),
      name: "TideglassBoot",
      formats: ["iife"],
      fileName: () => "game.js",
    },
  },
});
