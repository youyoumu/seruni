import path from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],
  skipNodeModulesBundle: true,
  alias: {
    "#": path.resolve(import.meta.dirname, "src/main"),
  },
});
