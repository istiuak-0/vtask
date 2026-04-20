import { defineConfig } from "tsup";

export default defineConfig({
  entry: "./src/core.ts",

  format: ["esm"],
  dts: { resolve: true },
  sourcemap: true,
  clean: true,
  splitting: true,
  minify: false,
  external: ["vue"],
  outDir: "dist",
});
