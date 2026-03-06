import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./src/db/index.ts",
    "./src/schema/index.ts",
    "./src/types/index.ts",
    "./src/util/index.ts",
    "./src/ws/index.ts",
    "./src/sock.et/index.ts",
    "./src/sock.et/client.ts",
    "./src/sock.et/server.ts",
  ],
  format: ["es"],
  dts: true,
  sourcemap: true,
  unbundle: true,
  clean: false,
});
