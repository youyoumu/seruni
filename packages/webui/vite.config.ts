import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: {
    alias: {
      "#": path.resolve(import.meta.dirname, "./src"),
    },
  },
  plugins: [tailwindcss(), viteReact()],
});

export default config;
