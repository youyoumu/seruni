import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./src/db/index.ts",
    "./src/events/index.ts",
    "./src/ws/index.ts",
    "./src/types/index.ts",
  ],
  format: ["es"],
  dts: true,
  sourcemap: true,
  unbundle: true,
  clean: false,
});
