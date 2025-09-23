import { defineConfig } from "tsdown";

function from1Entry(entry: string) {
  return defineConfig({
    entry: [entry],
    external: ["electron"],
    noExternal: ["zod"],
    treeshake: true,
    format: "cjs",
    outExtensions: () => ({
      js: ".js",
    }),
    dts: {
      cjsDefault: true,
      parallel: true,
    },
  });
}

export default [from1Entry("src/ipc.ts"), from1Entry("src/chrome.ts")];
