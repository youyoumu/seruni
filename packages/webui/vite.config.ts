import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: {
    alias: {
      "#": path.resolve(import.meta.dirname, "./src"),
    },
  },
  plugins: [
    tailwindcss(),
    viteReact(),
    tanstackRouter({
      target: "react",
    }),
  ],
});

export default config;
