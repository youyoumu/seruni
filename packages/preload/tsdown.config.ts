import { defineConfig } from "tsdown";

const preloadConfig = defineConfig({
  external: ["electron"],
  report: false,
  noExternal: ["zod"],
  format: ["commonjs"],
  outExtensions: () => ({
    js: ".js",
  }),
  outDir: "dist/_preload",
});

const libConfig = defineConfig({
  external: ["electron"],
  report: false,
  dts: true,
});

export default [
  defineConfig({
    ...preloadConfig,
    entry: ["src/_preload/ipc.ts"],
  }),
  defineConfig({
    ...preloadConfig,
    entry: ["src/_preload/chrome.ts"],
  }),
  defineConfig({
    ...libConfig,
    entry: {
      ipc: "src/ipc/index.ts",
      chrome: "src/chrome/index.ts",
    },
  }),
];
