import { join } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import lucidePreprocess from "vite-plugin-lucide-preprocess";
import solidPlugin from "vite-plugin-solid";
import webfontDownload from "vite-plugin-webfont-dl";
import "dotenv/config";
import AutoImport from "unplugin-auto-import/vite";

const port = parseInt(process.env.GSM_RENDERER_PORT || "3000");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    lucidePreprocess(),
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
    }),
    solidPlugin(),
    webfontDownload([
      "https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap",
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap",
    ]),
    //@ts-expect-error idk whats wrong here
    AutoImport({
      imports: ["solid-js"],
    }),
  ],
  resolve: {
    alias: {
      "#": join(import.meta.dirname, "./src"),
      "styled-system": join(import.meta.dirname, "./styled-system"),
    },
  },
  server: {
    port: port,
  },
});
