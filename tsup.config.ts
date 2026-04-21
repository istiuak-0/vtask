import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],

  format: ["esm"],
  dts: { resolve: true },
  sourcemap: false,
  clean: true,
  splitting: true,
  minify: false,
  external: ["vue"],
  outDir: "dist",
});
