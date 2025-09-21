import { resolve } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import "dotenv/config";

const port = parseInt(process.env.GSM_RENDERER_PORT || "3000");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
    }),
    solidPlugin(),
  ],
  resolve: {
    alias: {
      "#": resolve(__dirname, "./src"),
      "styled-system": resolve(__dirname, "./styled-system"),
    },
  },
  server: {
    port: port,
  },
});
