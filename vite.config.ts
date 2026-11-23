/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// base './' keeps every asset URL relative, so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2022" },
  test: { environment: "jsdom", include: ["tests/**/*.test.ts"] },
});
