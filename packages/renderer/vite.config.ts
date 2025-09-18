import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
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
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "#": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: port,
  },
});
