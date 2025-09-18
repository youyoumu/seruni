import path from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],
  external: ["electron"],
  noExternal: ["zod"],
  treeshake: true,
  format: "cjs",
  outExtensions: () => ({
    js: ".js",
  }),
  alias: {
    "#": path.resolve(import.meta.dirname, "src/main"),
  },
});
