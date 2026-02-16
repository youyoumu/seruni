import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./src/db/index.ts",
    "./src/types/index.ts",
    "./src/util/index.ts",
    "./src/ws/index.ts",
    "./src/ws-bus/index.ts",
  ],
  format: ["es"],
  dts: true,
  sourcemap: true,
  unbundle: true,
  clean: false,
});
