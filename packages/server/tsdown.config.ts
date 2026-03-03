import { bundleStats } from "rollup-plugin-bundle-stats";
import { defineConfig } from "tsdown";

import { getPackageVersion } from "./script/util.ts";

const version = getPackageVersion();

export default defineConfig({
  entry: ["./src/main.ts"],
  noExternal: [/.*/],
  external: ["open"],
  nodeProtocol: true,
  define: {
    __DEV__: JSON.stringify(false),
    __VERSION__: JSON.stringify(version),
  },
  copy: [
    "./drizzle/",
    { from: "../webui/dist", to: "./dist", rename: "webui" },
    {
      from: ["../python/pyproject.toml", "../python/uv.lock", "../python/src"],
      to: "./dist/python",
    },
    {
      from: "./package.json",
      to: "./dist",
    },
  ],
  plugins: [
    bundleStats({
      outDir: "..",
    }),
  ],
  shims: true,
});
