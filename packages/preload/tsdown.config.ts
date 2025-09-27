import { defineConfig } from "tsdown";

const preloadConfig = defineConfig({
  external: ["electron"],
  report: false,
  noExternal: ["zod"],
  format: ["commonjs"],
  outExtensions: () => ({
    js: ".js",
  }),
  outDir: "dist/__preload",
});

const libConfig = defineConfig({
  external: ["electron"],
  report: false,
  dts: true,
});

export default [
  defineConfig({
    ...preloadConfig,
    entry: ["src/__preload/ipc.ts"],
  }),
  defineConfig({
    ...preloadConfig,
    entry: ["src/__preload/chrome.ts"],
  }),
  defineConfig({
    ...libConfig,
    entry: {
      ipc: "src/ipc/index.ts",
      chrome: "src/chrome/index.ts",
    },
  }),
];
