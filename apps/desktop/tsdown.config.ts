import path from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts", "src/extension/yomitan-shim.ts"],
  skipNodeModulesBundle: true,
  unbundle: true,
  alias: {
    "#": path.resolve(import.meta.dirname, "src/main"),
  },
});
