import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { bundleStats } from "rollup-plugin-bundle-stats";
import { defineConfig } from "vite";
import webfontDownload from "vite-plugin-webfont-dl";

const config = defineConfig({
  resolve: {
    alias: {
      "#": path.resolve(import.meta.dirname, "./src"),
    },
  },
  plugins: [
    tailwindcss(),
    viteReact({
      babel: { plugins: ["babel-plugin-react-compiler"] },
    }),
    tanstackRouter({
      target: "react",
    }),
    webfontDownload([
      "https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap",
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap",
    ]),
    bundleStats({
      outDir: "..",
    }),
  ],
});

export default config;
