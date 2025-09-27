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
  unbundle: true,
  dts: true,
});

export default [
  defineConfig({
    ...preloadConfig,
    entry: ["src/ipc.ts"],
  }),
  defineConfig({
    ...preloadConfig,
    entry: ["src/chrome.ts"],
  }),
  defineConfig({
    ...libConfig,
    entry: ["src/ipc.ts"],
  }),
];
