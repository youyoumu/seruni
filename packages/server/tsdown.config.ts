import { bundleStats } from "rollup-plugin-bundle-stats";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/main.ts"],
  noExternal: [/.*/],
  external: ["open"],
  nodeProtocol: true,
  define: {
    __DEV__: "false",
  },
  copy: [
    "./drizzle/",
    { from: "../webui/dist", to: "./dist", rename: "webui" },
    {
      from: ["../python/pyproject.toml", "../python/uv.lock", "../python/src"],
      to: "./dist/python",
    },
    {
      from: "./.better-sqlite3/better-sqlite3-v12.6.2-node-v137-linux-x64/build/Release/better_sqlite3.node",
      to: "./dist/lib/binding/node-v137-linux-x64",
    },
    {
      from: "./.better-sqlite3/better-sqlite3-v12.6.2-node-v137-win32-x64/build/Release/better_sqlite3.node",
      to: "./dist/lib/binding/node-v137-win32-x64",
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
