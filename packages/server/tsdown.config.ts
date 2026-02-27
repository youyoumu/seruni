import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/main.ts"],
  noExternal: [/.*/, "@libsql/linux-x64-gnu"],
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
      from: "node_modules/@libsql/linux-x64-gnu/index.node",
      to: "./dist/node_modules/@libsql/linux-x64-gnu",
    },
    {
      from: "node_modules/@libsql/win32-x64-msvc/index.node",
      to: "./dist/node_modules/@libsql/win32-x64-msvc",
    },
  ],
});
